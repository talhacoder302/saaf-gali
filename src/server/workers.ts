import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { attendanceState, DUTY_MANAGE_ROLES, WORKERS_PAGE_SIZE, type AttendanceMonth, type AttendanceState, type DutyStatus, type WorkerStatus } from "@/lib/duties";
import { dayKey, karachiDayStart, monthKey } from "@/lib/format";
import { addMonths, compareMonths, monthRange } from "@/lib/months";
import { hashPassword } from "@/lib/password";
import { hasAllAreaAccess, PermissionError, requireRole, scopeQueryToUserAreas, type Actor, type MongoFilter } from "@/lib/permissions";
import { escapeRegex } from "@/lib/regex";
import { ADMIN_ROLES } from "@/lib/roles";
import { compareNames } from "@/lib/sort";
import {
  listWorkersSchema,
  setWorkerStatusSchema,
  updateWorkerSchema,
  workerFormSchema,
  workerLoginSchema,
  type ListWorkersInput,
  type UpdateWorkerInput,
  type WorkerFormInput,
  type WorkerLoginInput,
} from "@/lib/validators/workers";
import { Area } from "@/models/Area";
import { Duty } from "@/models/Duty";
import { Street } from "@/models/Street";
import { User } from "@/models/User";
import { Worker, type WorkerDoc } from "@/models/Worker";
import { logActivity } from "@/server/activity";
import { loadAttendance } from "@/server/duties-core";
import { ServiceError } from "@/server/errors";

export type WorkerLogin = { userId: string; status: "active" | "disabled"; mustChangePassword: boolean };

export type WorkerRow = {
  id: string;
  name: string;
  mobile: string | null;
  cnic: string | null;
  address: string;
  monthlySalary: number;
  /** "YYYY-MM-DD" */
  joiningDate: string;
  areaIds: string[];
  areaNames: string[];
  status: WorkerStatus;
  login: WorkerLogin | null;
};

export type WorkerList = { rows: WorkerRow[]; total: number; page: number; pageCount: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

/** A worker the actor may see: they share an area (super admins see all). Missing and out of scope look the same. */
export async function loadWorkerInScope(actor: Actor, workerId: string): Promise<WorkerDoc> {
  if (!isValidObjectId(workerId)) throw new ServiceError("not_found");
  const worker = await Worker.findOne(scopeQueryToUserAreas(actor, { _id: workerId }, "areaIds")).lean();
  if (!worker) throw new ServiceError("not_found");
  return worker;
}

/**
 * Areas to save on a worker. Area managers can only give their own active
 * areas; areas the worker already had outside their reach are kept.
 */
async function resolveAreaIds(actor: Actor, requested: string[], existing: Types.ObjectId[] = []): Promise<Types.ObjectId[]> {
  const unique = [...new Set(requested)];
  const found = await Area.countDocuments({ _id: { $in: unique }, status: "active" });
  if (found !== unique.length) throw new ServiceError("invalid_input", { areaIds: "areaNotFound" });
  if (hasAllAreaAccess(actor)) return unique.map((id) => new Types.ObjectId(id));
  if (unique.some((id) => !actor.areaIds.includes(id))) throw new PermissionError("forbidden");
  const kept = existing.map((id) => id.toString()).filter((id) => !actor.areaIds.includes(id));
  return [...new Set([...kept, ...unique])].map((id) => new Types.ObjectId(id));
}

function assertJoiningDate(day: string): void {
  if (day > dayKey()) throw new ServiceError("invalid_input", { joiningDate: "dateInFuture" });
}

async function assertMobileFree(mobile: string, exceptUserId?: Types.ObjectId): Promise<void> {
  const clash = await User.exists({ mobile, ...(exceptUserId ? { _id: { $ne: exceptUserId } } : {}) });
  if (clash) throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
}

async function toRows(docs: WorkerDoc[]): Promise<WorkerRow[]> {
  const areaIds = [...new Set(docs.flatMap((doc) => doc.areaIds.map((id) => id.toString())))];
  const userIds = docs.map((doc) => doc.userId).filter((id): id is Types.ObjectId => Boolean(id));
  const [areas, users] = await Promise.all([
    Area.find({ _id: { $in: areaIds } }).select("name").lean(),
    User.find({ _id: { $in: userIds } }).select("status mustChangePassword").lean(),
  ]);
  const areaName = new Map(areas.map((area) => [area._id.toString(), area.name]));
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  return docs.map((doc) => {
    const ids = doc.areaIds.map((id) => id.toString());
    const user = doc.userId ? userById.get(doc.userId.toString()) : undefined;
    return {
      id: doc._id.toString(),
      name: doc.name,
      mobile: doc.mobile ?? null,
      cnic: doc.cnic ?? null,
      address: doc.address ?? "",
      monthlySalary: doc.monthlySalary,
      joiningDate: dayKey(doc.joiningDate),
      areaIds: ids,
      areaNames: ids.map((id) => areaName.get(id)).filter((name): name is string => Boolean(name)),
      status: doc.status,
      login: user
        ? { userId: user._id.toString(), status: user.status, mustChangePassword: user.mustChangePassword ?? false }
        : null,
    };
  });
}

/** Scheduled duties from `fromDay` on, optionally only in some areas. Used when a worker leaves an area or stops. */
async function dropFutureDuties(workerId: Types.ObjectId, fromDay: string, areaIds?: Types.ObjectId[]): Promise<number> {
  const result = await Duty.deleteMany({
    workerId,
    day: { $gte: fromDay },
    status: "scheduled",
    active: true,
    ...(areaIds ? { areaId: { $in: areaIds } } : {}),
  });
  return result.deletedCount;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listWorkers(input: Partial<ListWorkersInput>): Promise<WorkerList> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listWorkersSchema.parse(input);
  await connectDB();

  const conditions: MongoFilter[] = [];
  if (params.areaId) conditions.push({ areaIds: new Types.ObjectId(params.areaId) });
  if (params.status) conditions.push({ status: params.status });
  if (params.q) {
    const text = new RegExp(escapeRegex(params.q), "i");
    const digits = params.q.replace(/\D/g, "");
    const or: MongoFilter[] = [{ name: text }];
    if (digits.length >= 3) {
      const local = digits.startsWith("92") ? `0${digits.slice(2)}` : digits;
      or.push({ mobile: new RegExp(escapeRegex(local)) }, { cnic: new RegExp(escapeRegex(params.q.trim())) });
    }
    conditions.push({ $or: or });
  }
  const filter = scopeQueryToUserAreas(actor, conditions.length > 0 ? { $and: conditions } : {}, "areaIds");

  const [docs, total] = await Promise.all([
    Worker.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ status: 1, name: 1 })
      .skip((params.page - 1) * WORKERS_PAGE_SIZE)
      .limit(WORKERS_PAGE_SIZE)
      .lean(),
    Worker.countDocuments(filter),
  ]);
  return { rows: await toRows(docs), total, page: params.page, pageCount: Math.max(1, Math.ceil(total / WORKERS_PAGE_SIZE)) };
}

export type WorkerDetail = {
  worker: WorkerRow;
  attendance: AttendanceMonth;
  /** Months the calendar offers, newest first (joining month to now, at most a year). */
  months: string[];
  /** The month's duties, newest first. */
  duties: { id: string; day: string; shift: "morning" | "evening"; status: DutyStatus; streetName: string; areaName: string }[];
  today: string;
};

/** One worker with a month of attendance. Admins and supervisors (their areas). */
export async function getWorkerDetail(workerId: string, requestedMonth?: string): Promise<WorkerDetail | null> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  await connectDB();
  let doc: WorkerDoc;
  try {
    doc = await loadWorkerInScope(actor, workerId);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "not_found") return null;
    throw error;
  }

  const today = dayKey();
  const current = monthKey();
  const joined = monthKey(doc.joiningDate);
  const oldest = addMonths(current, -11);
  const from = compareMonths(joined, oldest) > 0 ? joined : oldest;
  const months = monthRange(compareMonths(from, current) > 0 ? current : from, current).reverse();
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : current;

  const [[worker], attendance, duties] = await Promise.all([
    toRows([doc]),
    loadAttendance(doc._id, month, today),
    Duty.find({ workerId: doc._id, day: { $gte: `${month}-01`, $lte: `${month}-31` } })
      .sort({ day: -1, shift: 1 })
      .select("day shift status streetId areaId")
      .lean(),
  ]);
  const [streets, areas] = await Promise.all([
    Street.find({ _id: { $in: [...new Set(duties.map((d) => d.streetId.toString()))] } }).select("name").lean(),
    Area.find({ _id: { $in: [...new Set(duties.map((d) => d.areaId.toString()))] } }).select("name").lean(),
  ]);
  const streetName = new Map(streets.map((street) => [street._id.toString(), street.name]));
  const areaName = new Map(areas.map((area) => [area._id.toString(), area.name]));

  return {
    worker: worker!,
    attendance,
    months,
    today,
    duties: duties.map((duty) => ({
      id: duty._id.toString(),
      day: duty.day,
      shift: duty.shift,
      status: duty.status,
      streetName: streetName.get(duty.streetId.toString()) ?? "",
      areaName: areaName.get(duty.areaId.toString()) ?? "",
    })),
  };
}

export type TeamMember = {
  id: string;
  name: string;
  mobile: string | null;
  hasLogin: boolean;
  areaNames: string[];
  today: { state: AttendanceState; duties: number; completed: number; inProgress: number };
};

/** Active workers in the supervisor's areas with how today is going. */
export async function listTeam(): Promise<TeamMember[]> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  await connectDB();
  const today = dayKey();
  const docs = await Worker.find(scopeQueryToUserAreas(actor, { status: "active" }, "areaIds")).lean();
  const rows = await toRows(docs);
  const duties = await Duty.find({ workerId: { $in: docs.map((doc) => doc._id) }, day: today }).select("workerId status").lean();
  const byWorker = new Map<string, DutyStatus[]>();
  for (const duty of duties) {
    const key = duty.workerId.toString();
    byWorker.set(key, [...(byWorker.get(key) ?? []), duty.status]);
  }
  return rows
    .map((row) => {
      const statuses = byWorker.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        hasLogin: row.login?.status === "active",
        areaNames: row.areaNames,
        today: {
          state: attendanceState(statuses, today, today),
          duties: statuses.filter((status) => status !== "reassigned").length,
          completed: statuses.filter((status) => status === "completed").length,
          inProgress: statuses.filter((status) => status === "in_progress").length,
        },
      };
    })
    .sort((a, b) => compareNames(a.name, b.name));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createWorker(input: WorkerFormInput): Promise<{ id: string; login: { name: string; mobile: string } | null }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = workerFormSchema.parse(input);
  await connectDB();

  const areaIds = await resolveAreaIds(actor, data.areaIds);
  assertJoiningDate(data.joiningDate);
  if (data.createLogin && data.mobile) await assertMobileFree(data.mobile);
  if (data.cnic && (await Worker.exists({ cnic: data.cnic }))) throw new ServiceError("cnic_taken", { cnic: "cnicTaken" });

  // The login first: if the mobile was taken a moment ago, nothing is left half made.
  let userId: Types.ObjectId | undefined;
  if (data.createLogin && data.mobile) {
    try {
      const user = await User.create({
        name: data.name,
        mobile: data.mobile,
        passwordHash: await hashPassword(data.password),
        role: "worker",
        areaIds,
        // Worker screens open in Urdu.
        language: "ur",
        mustChangePassword: true,
        createdBy: actor.id,
      });
      userId = user._id;
    } catch (error) {
      if (isDuplicateKey(error)) throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
      throw error;
    }
  }

  let worker;
  try {
    worker = await Worker.create({
      userId,
      name: data.name,
      mobile: data.mobile ?? undefined,
      cnic: data.cnic ?? undefined,
      address: data.address || undefined,
      monthlySalary: data.monthlySalary,
      joiningDate: karachiDayStart(data.joiningDate),
      areaIds,
      createdBy: actor.id,
    });
  } catch (error) {
    if (userId) await User.deleteOne({ _id: userId });
    if (isDuplicateKey(error)) throw new ServiceError("cnic_taken", { cnic: "cnicTaken" });
    throw error;
  }

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "Worker",
    entityId: worker._id,
    areaId: areaIds[0],
    meta: { name: data.name, withLogin: Boolean(userId) },
  });
  if (userId) {
    await logActivity({ actorId: actor.id, action: "create", entity: "User", entityId: userId, areaId: areaIds[0], meta: { name: data.name, role: "worker" } });
  }
  return { id: worker._id.toString(), login: userId && data.mobile ? { name: data.name, mobile: data.mobile } : null };
}

export async function updateWorker(input: UpdateWorkerInput): Promise<{ droppedDuties: number }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateWorkerSchema.parse(input);
  await connectDB();

  const worker = await loadWorkerInScope(actor, data.id);
  const areaIds = await resolveAreaIds(actor, data.areaIds, worker.areaIds);
  assertJoiningDate(data.joiningDate);
  if (worker.userId && !data.mobile) throw new ServiceError("invalid_input", { mobile: "mobileNeededForLogin" });
  if (worker.userId && data.mobile && data.mobile !== worker.mobile) await assertMobileFree(data.mobile, worker.userId);
  if (data.cnic && data.cnic !== worker.cnic && (await Worker.exists({ cnic: data.cnic, _id: { $ne: worker._id } }))) {
    throw new ServiceError("cnic_taken", { cnic: "cnicTaken" });
  }

  const before = worker.areaIds.map((id) => id.toString());
  const after = areaIds.map((id) => id.toString());
  const removedAreas = worker.areaIds.filter((id) => !after.includes(id.toString()));
  const areasChanged = before.length !== after.length || removedAreas.length > 0;
  const changes = [
    data.name !== worker.name && "name",
    (data.mobile ?? null) !== (worker.mobile ?? null) && "mobile",
    (data.cnic ?? null) !== (worker.cnic ?? null) && "cnic",
    data.address !== (worker.address ?? "") && "address",
    data.monthlySalary !== worker.monthlySalary && "monthlySalary",
    data.joiningDate !== dayKey(worker.joiningDate) && "joiningDate",
    areasChanged && "areaIds",
  ].filter((change): change is string => Boolean(change));
  if (changes.length === 0) return { droppedDuties: 0 };

  const unset: Record<string, 1> = {};
  if (!data.mobile) unset.mobile = 1;
  if (!data.cnic) unset.cnic = 1;
  if (!data.address) unset.address = 1;
  try {
    await Worker.updateOne(
      { _id: worker._id },
      {
        $set: {
          name: data.name,
          monthlySalary: data.monthlySalary,
          joiningDate: karachiDayStart(data.joiningDate),
          areaIds,
          ...(data.mobile ? { mobile: data.mobile } : {}),
          ...(data.cnic ? { cnic: data.cnic } : {}),
          ...(data.address ? { address: data.address } : {}),
        },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
  } catch (error) {
    if (isDuplicateKey(error)) throw new ServiceError("cnic_taken", { cnic: "cnicTaken" });
    throw error;
  }

  // Keep the login in step: same name, mobile and areas. New mobile or areas sign it out.
  if (worker.userId && data.mobile) {
    const signOut = areasChanged || data.mobile !== worker.mobile;
    try {
      await User.updateOne(
        { _id: worker.userId },
        { $set: { name: data.name, mobile: data.mobile, areaIds }, ...(signOut ? { $inc: { sessionVersion: 1 } } : {}) },
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw new ServiceError("mobile_taken", { mobile: "mobileTaken" });
      throw error;
    }
  }

  // Planned duties in areas the worker left go away; they can't do them any more.
  const droppedDuties = removedAreas.length > 0 ? await dropFutureDuties(worker._id, dayKey(), removedAreas) : 0;

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Worker",
    entityId: worker._id,
    areaId: areaIds[0],
    meta: {
      changes,
      ...(changes.includes("monthlySalary") ? { fromSalary: worker.monthlySalary, toSalary: data.monthlySalary } : {}),
      ...(droppedDuties > 0 ? { droppedDuties } : {}),
    },
  });
  return { droppedDuties };
}

/**
 * Deactivate (left the job) or bring back. Deactivating disables the login
 * and removes planned duties after today; today's duties stay for the
 * supervisor to reassign.
 */
export async function setWorkerStatus(input: { id: string; status: WorkerStatus }): Promise<{ droppedDuties: number }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = setWorkerStatusSchema.parse(input);
  await connectDB();

  const worker = await loadWorkerInScope(actor, data.id);
  if (worker.status === data.status) return { droppedDuties: 0 };
  await Worker.updateOne({ _id: worker._id }, { $set: { status: data.status } });

  let droppedDuties = 0;
  if (data.status === "inactive") {
    droppedDuties = await dropFutureDuties(worker._id, dayKey(Date.now() + 86_400_000));
    if (worker.userId) await User.updateOne({ _id: worker.userId }, { $set: { status: "disabled" }, $inc: { sessionVersion: 1 } });
  } else if (worker.userId) {
    await User.updateOne({ _id: worker.userId }, { $set: { status: "active" } });
  }

  await logActivity({
    actorId: actor.id,
    action: data.status === "inactive" ? "disable" : "enable",
    entity: "Worker",
    entityId: worker._id,
    areaId: worker.areaIds[0],
    meta: droppedDuties > 0 ? { droppedDuties } : undefined,
  });
  return { droppedDuties };
}

/** A login for a worker who has a phone but no account yet. */
export async function createWorkerLogin(input: WorkerLoginInput): Promise<{ name: string; mobile: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = workerLoginSchema.parse(input);
  await connectDB();

  const worker = await loadWorkerInScope(actor, data.workerId);
  if (worker.status !== "active") throw new ServiceError("worker_inactive");
  if (!worker.mobile) throw new ServiceError("worker_has_no_mobile");
  if (worker.userId) throw new ServiceError("worker_has_login");
  await assertMobileFree(worker.mobile);

  let userId: Types.ObjectId;
  try {
    const user = await User.create({
      name: worker.name,
      mobile: worker.mobile,
      passwordHash: await hashPassword(data.password),
      role: "worker",
      areaIds: worker.areaIds,
      language: "ur",
      mustChangePassword: true,
      createdBy: actor.id,
    });
    userId = user._id;
  } catch (error) {
    if (isDuplicateKey(error)) throw new ServiceError("mobile_taken");
    throw error;
  }
  // Guarded: if another admin linked a login at the same moment, undo ours.
  const linked = await Worker.updateOne({ _id: worker._id, userId: { $exists: false } }, { $set: { userId } });
  if (linked.modifiedCount === 0) {
    await User.deleteOne({ _id: userId });
    throw new ServiceError("worker_has_login");
  }

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "User",
    entityId: userId,
    areaId: worker.areaIds[0],
    meta: { name: worker.name, role: "worker", workerId: worker._id.toString() },
  });
  return { name: worker.name, mobile: worker.mobile };
}
