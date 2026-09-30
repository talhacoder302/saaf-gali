import type { Role } from "@/lib/roles";
import { getCurrentUser, type CurrentUser } from "@/server/session";

/** The minimum we need to know about a user to check permissions. */
export type Actor = {
  id: string;
  role: Role;
  areaIds: readonly string[];
};

export type PermissionErrorCode = "unauthenticated" | "forbidden" | "password_change_required";

export class PermissionError extends Error {
  readonly code: PermissionErrorCode;

  constructor(code: PermissionErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PermissionError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Pure checks (no session, easy to test)
// ---------------------------------------------------------------------------

export function hasRole(actor: Pick<Actor, "role">, roles: readonly Role[]): boolean {
  return roles.includes(actor.role);
}

/** Super admins see every area; everyone else only their own areaIds. */
export function hasAllAreaAccess(actor: Pick<Actor, "role">): boolean {
  return actor.role === "super_admin";
}

export function canAccessArea(actor: Actor, areaId: string): boolean {
  return hasAllAreaAccess(actor) || actor.areaIds.includes(areaId);
}

export function assertRole(actor: Actor, roles: readonly Role[]): void {
  if (!hasRole(actor, roles)) throw new PermissionError("forbidden");
}

export function assertAreaAccess(actor: Actor, areaId: string): void {
  if (!canAccessArea(actor, areaId)) throw new PermissionError("forbidden");
}

export type MongoFilter = Record<string, unknown>;
export type ScopedFilter = { $and: MongoFilter[] };

/**
 * Restrict a MongoDB filter to the actor's areas. Every list/find query in a
 * service must go through this so a supervisor or resident can never read
 * another area's data, whatever the UI sends.
 *
 * The caller's filter and the area scope are combined with $and, so a
 * condition the caller put on the same field can only narrow the result,
 * never widen it.
 *
 * `field` is the document field holding the area: "areaId" for most
 * collections, "areaIds" for users, "_id" for the areas collection itself.
 */
export function scopeQueryToUserAreas(actor: Actor, filter: MongoFilter, field = "areaId"): ScopedFilter {
  if (hasAllAreaAccess(actor)) return { $and: [filter] };
  return { $and: [filter, { [field]: { $in: [...actor.areaIds] } }] };
}

// ---------------------------------------------------------------------------
// Session-aware guards for services. Each throws PermissionError.
// ---------------------------------------------------------------------------

type RequireOptions = {
  /** Let users who still have a temporary password through (password change only). */
  allowPendingPasswordChange?: boolean;
};

export async function requireUser(options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new PermissionError("unauthenticated");
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    throw new PermissionError("password_change_required");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  assertRole(user, roles);
  return user;
}

/** Signed-in user who may work in the given area (optionally limited to some roles). */
export async function requireAreaAccess(areaId: string, roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (roles) assertRole(user, roles);
  assertAreaAccess(user, areaId);
  return user;
}
