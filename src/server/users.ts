import "server-only";

import { Types } from "mongoose";

import type { Locale } from "@/i18n/config";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  hasAllAreaAccess,
  PermissionError,
  requireRole,
  scopeQueryToUserAreas,
  type Actor,
  type MongoFilter,
} from "@/lib/permissions";
import { escapeRegex } from "@/lib/regex";
import { ADMIN_ROLES, canManageRole, MANAGEABLE_ROLES, roleNeedsArea, type Role } from "@/lib/roles";
import {
  createUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  setUserStatusSchema,
  updateUserSchema,
  USERS_PAGE_SIZE,
  type CreateUserInput,
  type ListUsersInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from "@/lib/validators/users";
import { Area } from "@/models/Area";
import { LoginAttempt } from "@/models/LoginAttempt";
import { User, type UserDoc, type UserStatus } from "@/models/User";
import { logActivity } from "@/server/activity";
import { ServiceError } from "@/server/errors";
import { syncUserAreaMemberships } from "@/server/team-sync";

export type UserRow = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: Role;
  areaIds: string[];
  areaNames: string[];
  status: UserStatus;
  language: Locale;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserList = {
  rows: UserRow[];
  total: number;
  page: number;
  pageCount: number;
};

type ManagedUser = Pick<UserDoc, "_id" | "role" | "areaIds" | "status" | "mobile">;

// ---------------------------------------------------------------------------
// Scope and permission helpers
// ---------------------------------------------------------------------------

/** Users the actor may see and manage. Super admins: everyone. */
function manageableUsersFilter(actor: Actor): MongoFilter {
  if (hasAllAreaAccess(actor)) return {};
  return scopeQueryToUserAreas(actor, { role: { $in: [...MANAGEABLE_ROLES[actor.role]] } }, "areaIds");
}

function assertCanManage(actor: Actor, target: ManagedUser): void {
  if (hasAllAreaAccess(actor)) return;
  const sharesArea = target.areaIds.some((id) => actor.areaIds.includes(id.toString()));
  if (!canManageRole(actor.role, target.role) || !sharesArea) {
    throw new PermissionError("forbidden");
  }
}

async function loadManagedUser(actor: Actor, id: string): Promise<ManagedUser> {
  const target = await User.findById(id).select("role areaIds status mobile").lean();
  if (!target) throw new ServiceError("not_found");
  assertCanManage(actor, target);
  return target;
}

async function assertNotLastSuperAdmin(target: ManagedUser): Promise<void> {
  if (target.role !== "super_admin") return;
  const others = await User.countDocuments({
    _id: { $ne: target._id },
    role: "super_admin",
    status: "active",
  });
  if (others === 0) throw new ServiceError("last_super_admin");
}

/**
 * Work out the areas to save. Area managers can only hand out their own areas;
 * any areas the user already had outside the manager's reach are kept.
 */
async function resolveAreaIds(
  actor: Actor,
  role: Role,
  requested: string[],
  existing: Types.ObjectId[] = [],
): Promise<Types.ObjectId[]> {
  if (!roleNeedsArea(role)) return [];

  const unique = [...new Set(requested)];
  const found = await Area.countDocuments({ _id: { $in: unique }, status: "active" });
  if (found !== unique.length) throw new ServiceError("invalid_input", { areaIds: "areaNotFound" });

  if (hasAllAreaAccess(actor)) return unique.map((id) => new Types.ObjectId(id));

  if (unique.some((id) => !actor.areaIds.includes(id))) throw new PermissionError("forbidden");
  const kept = existing.map((id) => id.toString()).filter((id) => !actor.areaIds.includes(id));
  return [...new Set([...kept, ...unique])].map((id) => new Types.ObjectId(id));
}

function searchFilter(q: string): MongoFilter {
  const text = new RegExp(escapeRegex(q), "i");
  const or: MongoFilter[] = [{ name: text }, { email: text }];
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) {
    // Let "+92 300..." find "0300...".
    const local = digits.startsWith("92") ? `0${digits.slice(2)}` : digits;
    or.push({ mobile: new RegExp(escapeRegex(local)) });
  }
  return { $or: or };
}

function isDuplicateMobile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listUsers(input: Partial<ListUsersInput>): Promise<UserList> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listUsersSchema.parse(input);
  await connectDB();

  const conditions: MongoFilter[] = [manageableUsersFilter(actor)];
  if (params.role) conditions.push({ role: params.role });
  if (params.status) conditions.push({ status: params.status });
  if (params.q) conditions.push(searchFilter(params.q));
  const filter = { $and: conditions };

  const [docs, total] = await Promise.all([
    User.find(filter)
      .select("name mobile email role areaIds status language mustChangePassword lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * USERS_PAGE_SIZE)
      .limit(USERS_PAGE_SIZE)
      .lean(),
    User.countDocuments(filter),
  ]);

  const areaIds = [...new Set(docs.flatMap((doc) => doc.areaIds.map((id) => id.toString())))];
  const areas = await Area.find({ _id: { $in: areaIds } }).select("name").lean();
  const areaNames = new Map(areas.map((area) => [area._id.toString(), area.name]));

  const rows: UserRow[] = docs.map((doc) => {
    const ids = doc.areaIds.map((id) => id.toString());
    return {
      id: doc._id.toString(),
      name: doc.name,
      mobile: doc.mobile,
      email: doc.email ?? null,
      role: doc.role,
      areaIds: ids,
      areaNames: ids.map((id) => areaNames.get(id)).filter((name): name is string => Boolean(name)),
      status: doc.status,
      language: doc.language === "ur" ? "ur" : "en",
      mustChangePassword: doc.mustChangePassword ?? false,
      lastLoginAt: doc.lastLoginAt?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
    };
  });

  return {
    rows,
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = createUserSchema.parse(input);
  if (!canManageRole(actor.role, data.role)) throw new PermissionError("forbidden");
  await connectDB();

  const areaIds = await resolveAreaIds(actor, data.role, data.areaIds);
  if (await User.exists({ mobile: data.mobile })) {
    throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
  }

  try {
    const user = await User.create({
      name: data.name,
      mobile: data.mobile,
      email: data.email || undefined,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      areaIds,
      language: data.language,
      // The admin chose this password, so the user must replace it.
      mustChangePassword: true,
      createdBy: actor.id,
    });
    await syncUserAreaMemberships(user._id, data.role, areaIds);

    await logActivity({
      actorId: actor.id,
      action: "create",
      entity: "User",
      entityId: user._id,
      areaId: areaIds[0],
      meta: { name: data.name, role: data.role },
    });
    return { id: user._id.toString() };
  } catch (error) {
    if (isDuplicateMobile(error)) throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateUserSchema.parse(input);
  await connectDB();

  const target = await User.findById(data.id).lean();
  if (!target) throw new ServiceError("not_found");
  assertCanManage(actor, target);
  if (!canManageRole(actor.role, data.role)) throw new PermissionError("forbidden");

  const roleChanged = data.role !== target.role;
  if (roleChanged && target._id.toString() === actor.id) {
    throw new ServiceError("cannot_change_own_role", { role: "cannotChangeOwnRole" });
  }
  if (roleChanged) await assertNotLastSuperAdmin(target);

  if (data.mobile !== target.mobile && (await User.exists({ mobile: data.mobile }))) {
    throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
  }

  const areaIds = await resolveAreaIds(actor, data.role, data.areaIds, target.areaIds);
  const before = target.areaIds.map((id) => id.toString()).sort().join(",");
  const after = areaIds.map((id) => id.toString()).sort().join(",");
  const areasChanged = before !== after;

  const changes = [
    data.name !== target.name && "name",
    data.mobile !== target.mobile && "mobile",
    (data.email || null) !== (target.email ?? null) && "email",
    roleChanged && "role",
    areasChanged && "areaIds",
    data.language !== target.language && "language",
  ].filter((change): change is string => Boolean(change));

  if (changes.length === 0) return;

  try {
    await User.updateOne(
      { _id: target._id },
      {
        $set: {
          name: data.name,
          mobile: data.mobile,
          email: data.email || undefined,
          role: data.role,
          areaIds,
          language: data.language,
        },
        // New role or areas: make the user sign in again so every token is fresh.
        ...(roleChanged || areasChanged ? { $inc: { sessionVersion: 1 } } : {}),
      },
    );
  } catch (error) {
    if (isDuplicateMobile(error)) throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
    throw error;
  }
  if (roleChanged || areasChanged) await syncUserAreaMemberships(target._id, data.role, areaIds);

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "User",
    entityId: target._id,
    areaId: areaIds[0],
    meta: { changes, ...(roleChanged ? { fromRole: target.role, toRole: data.role } : {}) },
  });
}

export async function setUserStatus(input: { id: string; status: UserStatus }): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = setUserStatusSchema.parse(input);
  if (data.id === actor.id) throw new ServiceError("cannot_disable_self");
  await connectDB();

  const target = await loadManagedUser(actor, data.id);
  if (target.status === data.status) return;
  if (data.status === "disabled") await assertNotLastSuperAdmin(target);

  await User.updateOne(
    { _id: target._id },
    {
      $set: { status: data.status },
      // Disabling logs the user out everywhere.
      ...(data.status === "disabled" ? { $inc: { sessionVersion: 1 } } : {}),
    },
  );

  await logActivity({
    actorId: actor.id,
    action: data.status === "disabled" ? "disable" : "enable",
    entity: "User",
    entityId: target._id,
    areaId: target.areaIds[0],
  });
}

export async function resetUserPassword(input: ResetPasswordInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = resetPasswordSchema.parse(input);
  if (data.id === actor.id) throw new ServiceError("use_profile_for_own_password");
  await connectDB();

  const target = await loadManagedUser(actor, data.id);

  await User.updateOne(
    { _id: target._id },
    {
      $set: { passwordHash: await hashPassword(data.password), mustChangePassword: true },
      $inc: { sessionVersion: 1 },
    },
  );
  // A fresh password should not be blocked by earlier failed attempts.
  await LoginAttempt.deleteMany({ mobile: target.mobile });

  await logActivity({
    actorId: actor.id,
    action: "password_reset",
    entity: "User",
    entityId: target._id,
    areaId: target.areaIds[0],
  });
}
