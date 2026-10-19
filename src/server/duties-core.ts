// No "server-only" import and no session checks: the seed and the DB
// integration test use this. Only call it from services that already
// checked permissions (src/server/duties.ts).

import { Types } from "mongoose";

import { attendanceMonth, type AttendanceMonth, type PlannedDuty } from "@/lib/duties";
import { Duty } from "@/models/Duty";

type Id = Types.ObjectId | string;

const toId = (id: Id) => new Types.ObjectId(id.toString());

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

/**
 * Insert planned duties in one round trip. A cell someone filled in the
 * meantime hits the unique (street, day, shift) index and is skipped, so two
 * people planning at once can never double-book a street.
 */
export async function insertPlannedDuties(
  planned: readonly PlannedDuty[],
  areaId: Id,
  createdBy: Id,
): Promise<{ created: number; clashed: number }> {
  if (planned.length === 0) return { created: 0, clashed: 0 };
  const docs = planned.map((duty) => ({
    workerId: toId(duty.workerId),
    streetId: toId(duty.streetId),
    areaId: toId(areaId),
    day: duty.day,
    shift: duty.shift,
    status: "scheduled" as const,
    active: true,
    createdBy: toId(createdBy),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  try {
    // The driver's insertMany (ordered: false) reports how many got in even when some clash.
    const result = await Duty.collection.insertMany(docs, { ordered: false });
    return { created: result.insertedCount, clashed: 0 };
  } catch (error) {
    const bulk = error as { writeErrors?: { code?: number }[] | { code?: number }; insertedCount?: number; result?: { insertedCount?: number } };
    const writeErrors = Array.isArray(bulk.writeErrors) ? bulk.writeErrors : bulk.writeErrors ? [bulk.writeErrors] : [];
    if (writeErrors.length === 0 || writeErrors.some((item) => item.code !== 11000)) throw error;
    const created = bulk.insertedCount ?? bulk.result?.insertedCount ?? docs.length - writeErrors.length;
    return { created, clashed: docs.length - created };
  }
}

/**
 * Give a worker's scheduled duties of one day to another worker. Each old
 * duty is kept as history (status "reassigned", pointing at the new duty);
 * the new worker gets a fresh scheduled duty on the same street and shift.
 * `areaIds` limits which areas are touched (the actor's scope and the new
 * worker's areas). Every step is guarded, so a duty started or reassigned
 * by someone else in the meantime is left alone.
 */
export async function reassignDutiesCore(input: {
  fromWorkerId: Id;
  toWorkerId: Id;
  day: string;
  areaIds: Id[];
  actorId: Id;
}): Promise<{ moved: number; skipped: number }> {
  const duties = await Duty.find({
    workerId: toId(input.fromWorkerId),
    day: input.day,
    active: true,
    status: "scheduled",
    areaId: { $in: input.areaIds.map(toId) },
  }).lean();

  let moved = 0;
  let skipped = 0;
  for (const duty of duties) {
    const now = new Date();
    const released = await Duty.updateOne(
      { _id: duty._id, active: true, status: "scheduled" },
      { $set: { status: "reassigned", active: false, reassignedTo: toId(input.toWorkerId), reassignedBy: toId(input.actorId), reassignedAt: now } },
    );
    if (released.modifiedCount === 0) {
      skipped += 1;
      continue;
    }
    try {
      const replacement = await Duty.create({
        workerId: toId(input.toWorkerId),
        streetId: duty.streetId,
        areaId: duty.areaId,
        day: duty.day,
        shift: duty.shift,
        reassignedFrom: duty._id,
        createdBy: toId(input.actorId),
      });
      await Duty.updateOne({ _id: duty._id }, { $set: { reassignedDutyId: replacement._id } });
      moved += 1;
    } catch (error) {
      // Put the old duty back so the cell is never left empty by a failure.
      await Duty.updateOne(
        { _id: duty._id },
        { $set: { status: "scheduled", active: true }, $unset: { reassignedTo: 1, reassignedBy: 1, reassignedAt: 1 } },
      );
      if (!isDuplicateKey(error)) throw error;
      skipped += 1;
    }
  }
  return { moved, skipped };
}

/** A worker's attendance for one month, derived from their duties. */
export async function loadAttendance(workerId: Id, month: string, today: string): Promise<AttendanceMonth> {
  const duties = await Duty.find({ workerId: toId(workerId), day: { $gte: `${month}-01`, $lte: `${month}-31` } })
    .select("day status")
    .lean();
  return attendanceMonth(month, duties, today);
}
