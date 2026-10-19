import "server-only";

import { isValidObjectId, Types } from "mongoose";

import type { City } from "@/lib/areas";
import { connectDB } from "@/lib/db";
import {
  addDays,
  cellKey,
  displayStatus,
  DUTY_MANAGE_ROLES,
  isEditableDuty,
  isPlannableDay,
  MARK_ACTIONS,
  nextStatus,
  SHIFTS,
  pickRosterWeek,
  planBulkAssign,
  planCopyWeek,
  weekDays,
  weekStart,
  type AttendanceMonth,
  type DutyStatus,
  type MarkAction,
  type PlannedDuty,
  type Shift,
} from "@/lib/duties";
import { dayKey, monthKey } from "@/lib/format";
import { hasAllAreaAccess, requireRole, scopeQueryToUserAreas, type Actor } from "@/lib/permissions";
import { compareNames } from "@/lib/sort";
import {
  assignDutySchema,
  bulkAssignSchema,
  copyWeekSchema,
  dutyIdSchema,
  markDutySchema,
  reassignSchema,
  rosterQuerySchema,
  type AssignDutyInput,
  type BulkAssignInput,
  type CopyWeekInput,
  type MarkDutyInput,
  type ReassignInput,
  type RosterQuery,
} from "@/lib/validators/duties";
import { Area } from "@/models/Area";
import { Block } from "@/models/Block";
import { Duty, type DutyDoc } from "@/models/Duty";
import { Street } from "@/models/Street";
import { User } from "@/models/User";
import { Worker, type WorkerDoc } from "@/models/Worker";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { insertPlannedDuties, loadAttendance, reassignDutiesCore } from "@/server/duties-core";
import { ServiceError } from "@/server/errors";
import { loadWorkerInScope } from "@/server/workers";

export type WorkerOption = { id: string; name: string; hasLogin: boolean };

export type DutyCell = {
  id: string;
  streetId: string;
  day: string;
  shift: Shift;
  workerId: string;
  workerName: string;
  /** Has a working phone login (marks own work); otherwise the supervisor marks for them. */
  workerHasLogin: boolean;
  /** As shown: a past scheduled duty is "missed". */
  status: DutyStatus;
  /** Can be changed or removed on the roster. */
  editable: boolean;
  /** Marks the signed-in user may make now (start/complete only for workers without a login). */
  actions: MarkAction[];
  reassignedFromName: string | null;
};

export type RosterView = {
  area: { id: string; name: string };
  areas: { id: string; name: string; city: City }[];
  blocks: { id: string; name: string }[];
  blockId: string | null;
  /** Monday of the week shown. */
  week: string;
  days: string[];
  today: string;
  streets: { id: string; name: string; blockName: string }[];
  duties: DutyCell[];
  /** Active workers of the area, for the pickers. */
  workers: WorkerOption[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Workers (any status) by id with whether they have a working login. */
async function workerInfo(ids: Types.ObjectId[]): Promise<Map<string, { name: string; hasLogin: boolean; status: string }>> {
  const workers = await Worker.find({ _id: { $in: ids } }).select("name userId status").lean();
  const userIds = workers.map((worker) => worker.userId).filter((id): id is Types.ObjectId => Boolean(id));
  const activeUsers = new Set(
    (await User.find({ _id: { $in: userIds }, status: "active" }).select("_id").lean()).map((user) => user._id.toString()),
  );
  return new Map(
    workers.map((worker) => [
      worker._id.toString(),
      { name: worker.name, status: worker.status, hasLogin: Boolean(worker.userId && activeUsers.has(worker.userId.toString())) },
    ]),
  );
}

/** What the actor may mark on a duty. Workers with a working login mark their own work (photos, next module). */
function allowedActions(duty: Pick<DutyDoc, "status" | "day">, hasLogin: boolean, today: string): MarkAction[] {
  return MARK_ACTIONS.filter((action) => {
    if (hasLogin && action !== "miss") return false;
    return nextStatus(action, duty.status, duty.day, today) !== null;
  });
}

function toCell(
  duty: DutyDoc,
  workers: Map<string, { name: string; hasLogin: boolean }>,
  fromNames: Map<string, string>,
  today: string,
): DutyCell {
  const worker = workers.get(duty.workerId.toString());
  return {
    id: duty._id.toString(),
    streetId: duty.streetId.toString(),
    day: duty.day,
    shift: duty.shift,
    workerId: duty.workerId.toString(),
    workerName: worker?.name ?? "",
    workerHasLogin: worker?.hasLogin ?? false,
    status: displayStatus(duty.status, duty.day, today),
    editable: isEditableDuty(duty.status, duty.day, today),
    actions: allowedActions(duty, worker?.hasLogin ?? false, today),
    reassignedFromName: duty.reassignedFrom ? (fromNames.get(duty.reassignedFrom.toString()) ?? null) : null,
  };
}

/** Names of the workers whose duties were handed over (for "instead of ..."). */
async function reassignedFromNames(duties: DutyDoc[]): Promise<Map<string, string>> {
  const ids = duties.map((duty) => duty.reassignedFrom).filter((id): id is Types.ObjectId => Boolean(id));
  if (ids.length === 0) return new Map();
  const originals = await Duty.find({ _id: { $in: ids } }).select("workerId").lean();
  const names = await workerInfo(originals.map((duty) => duty.workerId));
  return new Map(originals.map((duty) => [duty._id.toString(), names.get(duty.workerId.toString())?.name ?? ""]));
}

/** An active worker who works in the given area, or a field error. */
async function loadActiveWorkerForArea(actor: Actor, workerId: string, areaId: Types.ObjectId): Promise<WorkerDoc> {
  const worker = await loadWorkerInScope(actor, workerId);
  if (worker.status !== "active" || !worker.areaIds.some((id) => id.equals(areaId))) {
    throw new ServiceError("invalid_input", { workerId: "workerNotInArea" });
  }
  return worker;
}

/** Duties the actor may see, by id. */
async function loadDutyInScope(actor: Actor, id: string): Promise<DutyDoc> {
  if (!isValidObjectId(id)) throw new ServiceError("not_found");
  const duty = await Duty.findOne(scopeQueryToUserAreas(actor, { _id: id })).lean();
  if (!duty) throw new ServiceError("not_found");
  return duty;
}

async function areaWorkers(areaId: Types.ObjectId): Promise<WorkerOption[]> {
  const workers = await Worker.find({ areaIds: areaId, status: "active" }).select("_id").lean();
  const info = await workerInfo(workers.map((worker) => worker._id));
  return [...info]
    .map(([id, worker]) => ({ id, name: worker.name, hasLogin: worker.hasLogin }))
    .sort((a, b) => compareNames(a.name, b.name));
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/** The weekly roster of one area: streets as rows, days as columns, two shifts per cell. */
export async function getRoster(input: Partial<RosterQuery>): Promise<{ areas: RosterView["areas"]; roster: RosterView | null }> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const query = rosterQuerySchema.parse(input);
  await connectDB();

  const areaDocs = await Area.find(scopeQueryToUserAreas(actor, { status: "active" }, "_id"))
    .select("name city")
    .sort({ city: 1, name: 1 })
    .lean();
  const areas = areaDocs.map((area) => ({ id: area._id.toString(), name: area.name, city: area.city }));
  const area = query.area ? areaDocs.find((item) => item._id.toString() === query.area) : areaDocs[0];
  if (!area) return { areas, roster: null };

  const today = dayKey();
  const week = pickRosterWeek(query.week, today);
  const days = weekDays(week);
  const blocks = (await Block.find({ areaId: area._id }).select("name").lean())
    .map((block) => ({ id: block._id.toString(), name: block.name }))
    .sort((a, b) => compareNames(a.name, b.name));
  const blockId = query.block && blocks.some((block) => block.id === query.block) ? query.block : null;
  const blockName = new Map(blocks.map((block) => [block.id, block.name]));

  const streetDocs = await Street.find({ areaId: area._id, ...(blockId ? { blockId } : {}) }).select("name blockId").lean();
  const streets = streetDocs
    .map((street) => ({ id: street._id.toString(), name: street.name, blockName: blockName.get(street.blockId.toString()) ?? "" }))
    .sort((a, b) => compareNames(a.blockName, b.blockName) || compareNames(a.name, b.name));

  const duties = await Duty.find({
    areaId: area._id,
    day: { $gte: days[0], $lte: days[6] },
    active: true,
    ...(blockId ? { streetId: { $in: streetDocs.map((street) => street._id) } } : {}),
  }).lean();
  const [info, fromNames, workers] = await Promise.all([
    workerInfo([...new Set(duties.map((duty) => duty.workerId.toString()))].map((id) => new Types.ObjectId(id))),
    reassignedFromNames(duties),
    areaWorkers(area._id),
  ]);

  return {
    areas,
    roster: {
      area: { id: area._id.toString(), name: area.name },
      areas,
      blocks,
      blockId,
      week,
      days,
      today,
      streets,
      duties: duties.map((duty) => toCell(duty, info, fromNames, today)),
      workers,
    },
  };
}

/** Put a worker on a street for a day and shift, or change who is on it. */
export async function assignDuty(input: AssignDutyInput): Promise<void> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const data = assignDutySchema.parse(input);
  await connectDB();

  const street = await Street.findOne(scopeQueryToUserAreas(actor, { _id: data.streetId })).select("areaId name").lean();
  if (!street) throw new ServiceError("not_found");
  const area = await loadAreaInScope(actor, street.areaId.toString(), { forWrite: true });
  if (!isPlannableDay(data.day, dayKey())) throw new ServiceError("invalid_input", { day: "dayNotPlannable" });
  const worker = await loadActiveWorkerForArea(actor, data.workerId, area._id);

  const existing = await Duty.findOne({ streetId: street._id, day: data.day, shift: data.shift, active: true }).lean();
  if (existing) {
    if (existing.workerId.equals(worker._id)) return;
    if (!isEditableDuty(existing.status, existing.day, dayKey())) throw new ServiceError("duty_locked");
    // Guarded on "scheduled": a duty that was started meanwhile is not swapped.
    const result = await Duty.updateOne({ _id: existing._id, status: "scheduled" }, { $set: { workerId: worker._id } });
    if (result.modifiedCount === 0) throw new ServiceError("duty_locked");
  } else {
    const { created } = await insertPlannedDuties([{ ...data, workerId: worker._id.toString(), streetId: street._id.toString() }], area._id, actor.id);
    if (created === 0) throw new ServiceError("duty_cell_taken");
  }

  await logActivity({
    actorId: actor.id,
    action: "assign",
    entity: "Duty",
    entityId: existing?._id,
    areaId: area._id,
    meta: { street: street.name, day: data.day, shift: data.shift, worker: worker.name, ...(existing ? { replacedWorkerId: existing.workerId.toString() } : {}) },
  });
}

/** Take a planned duty off the roster (only scheduled ones from today on). */
export async function removeDuty(input: { id: string }): Promise<void> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const { id } = dutyIdSchema.parse(input);
  await connectDB();

  const duty = await loadDutyInScope(actor, id);
  await loadAreaInScope(actor, duty.areaId.toString(), { forWrite: true });
  if (!duty.active || !isEditableDuty(duty.status, duty.day, dayKey())) throw new ServiceError("duty_locked");
  const result = await Duty.deleteOne({ _id: duty._id, status: "scheduled", active: true });
  if (result.deletedCount === 0) throw new ServiceError("duty_locked");

  await logActivity({
    actorId: actor.id,
    action: "delete",
    entity: "Duty",
    entityId: duty._id,
    areaId: duty.areaId,
    meta: { day: duty.day, shift: duty.shift, workerId: duty.workerId.toString(), streetId: duty.streetId.toString() },
  });
}

async function takenCells(streetIds: Types.ObjectId[], days: string[]): Promise<Set<string>> {
  const duties = await Duty.find({ streetId: { $in: streetIds }, day: { $in: days }, active: true }).select("streetId day shift").lean();
  return new Set(duties.map((duty) => cellKey(duty.streetId.toString(), duty.day, duty.shift)));
}

export type PlanResult = { created: number; skipped: number };

/** One worker on several streets (and days) of one area in one shift. Filled cells are left alone. */
export async function bulkAssign(input: BulkAssignInput): Promise<PlanResult> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const data = bulkAssignSchema.parse(input);
  await connectDB();

  const streetIds = [...new Set(data.streetIds)];
  const streets = await Street.find(scopeQueryToUserAreas(actor, { _id: { $in: streetIds } })).select("areaId").lean();
  const areaIds = new Set(streets.map((street) => street.areaId.toString()));
  if (streets.length !== streetIds.length || areaIds.size !== 1) throw new ServiceError("invalid_input", { streetIds: "chooseStreets" });
  const area = await loadAreaInScope(actor, [...areaIds][0]!, { forWrite: true });
  const today = dayKey();
  if (data.days.some((day) => !isPlannableDay(day, today))) throw new ServiceError("invalid_input", { days: "dayNotPlannable" });
  const worker = await loadActiveWorkerForArea(actor, data.workerId, area._id);

  const plan = planBulkAssign({ ...data, workerId: worker._id.toString() }, await takenCells(streets.map((s) => s._id), data.days));
  const { created, clashed } = await insertPlannedDuties(plan.create, area._id, actor.id);
  const result = { created, skipped: plan.skippedTaken + clashed };

  await logActivity({
    actorId: actor.id,
    action: "assign",
    entity: "Duty",
    areaId: area._id,
    meta: { bulk: true, worker: worker.name, shift: data.shift, days: data.days, streets: streetIds.length, ...result },
  });
  return result;
}

/** Copy last week's roster of an area into the given week (from today on). */
export async function copyLastWeek(input: CopyWeekInput): Promise<PlanResult> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const data = copyWeekSchema.parse(input);
  await connectDB();

  const area = await loadAreaInScope(actor, data.areaId, { forWrite: true });
  const today = dayKey();
  const week = weekStart(data.week);
  if (!isPlannableDay(addDays(week, 6), today)) throw new ServiceError("invalid_input", { week: "dayNotPlannable" });

  const lastWeekDays = weekDays(addDays(week, -7));
  const [lastWeek, workers, streets] = await Promise.all([
    Duty.find({ areaId: area._id, day: { $gte: lastWeekDays[0], $lte: lastWeekDays[6] }, active: true }).select("workerId streetId day shift").lean(),
    Worker.find({ areaIds: area._id, status: "active" }).select("_id").lean(),
    Street.find({ areaId: area._id }).select("_id").lean(),
  ]);
  const planned: PlannedDuty[] = lastWeek.map((duty) => ({
    workerId: duty.workerId.toString(),
    streetId: duty.streetId.toString(),
    day: duty.day,
    shift: duty.shift,
  }));
  const plan = planCopyWeek(
    planned,
    await takenCells(streets.map((street) => street._id), weekDays(week)),
    new Set(workers.map((worker) => worker._id.toString())),
    today,
  );
  const { created, clashed } = await insertPlannedDuties(plan.create, area._id, actor.id);
  const result = { created, skipped: plan.skippedTaken + plan.skippedPast + plan.skippedWorker + clashed };

  await logActivity({ actorId: actor.id, action: "create", entity: "Duty", areaId: area._id, meta: { copiedWeek: week, ...result } });
  return result;
}

/** A worker is absent: hand today's scheduled duties to another worker in one go. */
export async function reassignToday(input: ReassignInput): Promise<{ moved: number; skipped: number }> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const data = reassignSchema.parse(input);
  await connectDB();

  const [from, to] = await Promise.all([loadWorkerInScope(actor, data.fromWorkerId), loadWorkerInScope(actor, data.toWorkerId)]);
  if (to.status !== "active") throw new ServiceError("invalid_input", { toWorkerId: "workerInactive" });

  // Only areas the actor may plan, the new worker works in, and that are not archived.
  const activeAreas = await Area.find({ _id: { $in: to.areaIds }, status: "active" }).select("_id").lean();
  const areaIds = activeAreas
    .map((area) => area._id)
    .filter((id) => hasAllAreaAccess(actor) || actor.areaIds.includes(id.toString()));
  if (areaIds.length === 0) throw new ServiceError("invalid_input", { toWorkerId: "workerNotInArea" });

  const today = dayKey();
  const pending = await Duty.countDocuments({ workerId: from._id, day: today, active: true, status: "scheduled" });
  if (pending === 0) throw new ServiceError("no_duties_to_reassign");

  const result = await reassignDutiesCore({ fromWorkerId: from._id, toWorkerId: to._id, day: today, areaIds, actorId: actor.id });
  // Duties in areas the new worker doesn't cover stay with the absent worker.
  const notMoved = pending - result.moved;

  await logActivity({
    actorId: actor.id,
    action: "reassign",
    entity: "Duty",
    entityId: from._id,
    areaId: areaIds[0],
    meta: { day: today, from: from.name, to: to.name, moved: result.moved, notMoved },
  });
  return { moved: result.moved, skipped: notMoved };
}

/** A supervisor marks a duty started, completed or missed (start/complete only for workers without a login). */
export async function markDuty(input: MarkDutyInput): Promise<{ status: DutyStatus }> {
  const actor = await requireRole(...DUTY_MANAGE_ROLES);
  const data = markDutySchema.parse(input);
  await connectDB();

  const duty = await loadDutyInScope(actor, data.id);
  await loadAreaInScope(actor, duty.areaId.toString(), { forWrite: true });
  const today = dayKey();
  const info = (await workerInfo([duty.workerId])).get(duty.workerId.toString());
  if (info?.hasLogin && data.action !== "miss") throw new ServiceError("worker_has_login");
  const status = duty.active ? nextStatus(data.action, duty.status, duty.day, today) : null;
  if (!status) throw new ServiceError("duty_cannot_mark");

  const now = new Date();
  const result = await Duty.updateOne(
    { _id: duty._id, status: duty.status, active: true },
    {
      $set: {
        status,
        markedBy: new Types.ObjectId(actor.id),
        ...(status === "in_progress" ? { startedAt: now } : {}),
        ...(status === "completed" ? { completedAt: now } : {}),
      },
    },
  );
  if (result.modifiedCount === 0) throw new ServiceError("duty_cannot_mark");

  await logActivity({
    actorId: actor.id,
    action: "mark",
    entity: "Duty",
    entityId: duty._id,
    areaId: duty.areaId,
    meta: { action: data.action, from: duty.status, to: status, day: duty.day, onBehalf: !info?.hasLogin },
  });
  return { status };
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

export type TodayDuty = DutyCell & { streetName: string; blockName: string; areaName: string };

export type SupervisorToday = {
  today: string;
  /** False when the supervisor has no streets of their own and sees their whole area. */
  ownStreets: boolean;
  duties: TodayDuty[];
  /** Streets in view with no duty today. */
  unassignedStreets: number;
  counts: Record<"scheduled" | "in_progress" | "completed" | "missed", number>;
  /** Active workers in the supervisor's areas, for "reassign". */
  workers: WorkerOption[];
};

async function describeDuties(duties: DutyDoc[], today: string): Promise<TodayDuty[]> {
  const [info, fromNames, streets, areas] = await Promise.all([
    workerInfo([...new Set(duties.map((duty) => duty.workerId.toString()))].map((id) => new Types.ObjectId(id))),
    reassignedFromNames(duties),
    Street.find({ _id: { $in: duties.map((duty) => duty.streetId) } }).select("name blockId").lean(),
    Area.find({ _id: { $in: duties.map((duty) => duty.areaId) } }).select("name").lean(),
  ]);
  const blocks = await Block.find({ _id: { $in: streets.map((street) => street.blockId) } }).select("name").lean();
  const blockName = new Map(blocks.map((block) => [block._id.toString(), block.name]));
  const street = new Map(streets.map((item) => [item._id.toString(), { name: item.name, block: blockName.get(item.blockId.toString()) ?? "" }]));
  const areaName = new Map(areas.map((area) => [area._id.toString(), area.name]));

  return duties
    .map((duty) => ({
      ...toCell(duty, info, fromNames, today),
      streetName: street.get(duty.streetId.toString())?.name ?? "",
      blockName: street.get(duty.streetId.toString())?.block ?? "",
      areaName: areaName.get(duty.areaId.toString()) ?? "",
    }))
    .sort(
      (a, b) =>
        SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift) ||
        compareNames(a.blockName, b.blockName) ||
        compareNames(a.streetName, b.streetName),
    );
}

/** Today's duties on the supervisor's streets (their whole area when no street is theirs). */
export async function getSupervisorToday(): Promise<SupervisorToday> {
  const actor = await requireRole("supervisor");
  await connectDB();
  const today = dayKey();

  const scoped = scopeQueryToUserAreas(actor, {});
  const own = await Street.find(scopeQueryToUserAreas(actor, { supervisorId: new Types.ObjectId(actor.id) })).select("_id").lean();
  const streets = own.length > 0 ? own : await Street.find(scoped).select("_id").lean();
  const streetIds = streets.map((street) => street._id);

  const duties = await Duty.find(scopeQueryToUserAreas(actor, { streetId: { $in: streetIds }, day: today, active: true })).lean();
  const rows = await describeDuties(duties, today);
  const covered = new Set(rows.map((row) => row.streetId));
  const counts = { scheduled: 0, in_progress: 0, completed: 0, missed: 0 };
  for (const row of rows) if (row.status in counts) counts[row.status as keyof typeof counts] += 1;

  const workerDocs = await Worker.find(scopeQueryToUserAreas(actor, { status: "active" }, "areaIds")).select("_id").lean();
  const info = await workerInfo(workerDocs.map((worker) => worker._id));
  const workers = [...info]
    .map(([id, worker]) => ({ id, name: worker.name, hasLogin: worker.hasLogin }))
    .sort((a, b) => compareNames(a.name, b.name));

  return {
    today,
    ownStreets: own.length > 0,
    duties: rows,
    unassignedStreets: streetIds.filter((id) => !covered.has(id.toString())).length,
    counts,
    workers,
  };
}

export type MyDuties = {
  worker: { id: string; name: string } | null;
  today: string;
  duties: TodayDuty[];
  /** The next six days. */
  upcoming: TodayDuty[];
  attendance: AttendanceMonth | null;
};

/** The signed-in worker's duties: today, the coming days and this month's attendance. Null worker: login not linked to a worker. */
export async function getMyDuties(): Promise<MyDuties> {
  const actor = await requireRole("worker");
  await connectDB();
  const today = dayKey();
  const worker = await Worker.findOne({ userId: new Types.ObjectId(actor.id) }).select("name").lean();
  if (!worker) return { worker: null, today, duties: [], upcoming: [], attendance: null };

  const duties = await Duty.find({ workerId: worker._id, day: { $gte: today, $lte: addDays(today, 6) } })
    .sort({ day: 1 })
    .lean();
  // Reassigned ones are listed too, so the worker sees that a street went to someone else.
  const rows = await describeDuties(duties, today);
  return {
    worker: { id: worker._id.toString(), name: worker.name },
    today,
    duties: rows.filter((row) => row.day === today),
    upcoming: rows.filter((row) => row.day > today).sort((a, b) => a.day.localeCompare(b.day)),
    attendance: await loadAttendance(worker._id, monthKey(), today),
  };
}
