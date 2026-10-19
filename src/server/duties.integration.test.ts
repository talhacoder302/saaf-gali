/**
 * Runs against a real MongoDB when MONGODB_TEST_URI is set, e.g.
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
 * It uses (and drops) its own database "saaf_gali_vitest_duties". Skipped otherwise.
 */
import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PlannedDuty } from "@/lib/duties";

const uri = process.env.MONGODB_TEST_URI;

describe.skipIf(!uri)("duties with MongoDB", () => {
  let mongoose: typeof import("mongoose").default;
  let Duty: typeof import("@/models/Duty").Duty;
  let core: typeof import("./duties-core");
  const areaId = new Types.ObjectId();
  const otherAreaId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const [aslam, rashid, javed] = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  const [street1, street2, street3] = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  const plan = (workerId: Types.ObjectId, streetId: Types.ObjectId, day: string, shift: "morning" | "evening" = "morning"): PlannedDuty => ({
    workerId: workerId.toString(),
    streetId: streetId.toString(),
    day,
    shift,
  });

  beforeAll(async () => {
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = "saaf_gali_vitest_duties";
    const db = await import("@/lib/db");
    mongoose = await db.connectDB();
    await mongoose.connection.dropDatabase();
    Duty = (await import("@/models/Duty")).Duty;
    await Duty.syncIndexes();
    core = await import("./duties-core");
  });

  afterAll(async () => {
    if (!mongoose) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("allows one live duty per street, day and shift and counts clashes", async () => {
    const first = await core.insertPlannedDuties(
      [plan(aslam, street1, "2026-10-20"), plan(aslam, street1, "2026-10-20", "evening"), plan(aslam, street2, "2026-10-20")],
      areaId,
      actorId,
    );
    expect(first).toEqual({ created: 3, clashed: 0 });

    const second = await core.insertPlannedDuties([plan(rashid, street1, "2026-10-20"), plan(rashid, street3, "2026-10-20")], areaId, actorId);
    expect(second).toEqual({ created: 1, clashed: 1 });
    const cell = await Duty.find({ streetId: street1, day: "2026-10-20", shift: "morning" }).lean();
    expect(cell).toHaveLength(1);
    expect(cell[0]?.workerId.equals(aslam)).toBe(true);
  });

  it("never double-books a cell when two people plan at the same moment", async () => {
    const results = await Promise.all(
      [aslam, rashid, javed].map((worker) => core.insertPlannedDuties([plan(worker, street2, "2026-10-21")], areaId, actorId)),
    );
    expect(results.reduce((sum, result) => sum + result.created, 0)).toBe(1);
    expect(await Duty.countDocuments({ streetId: street2, day: "2026-10-21", active: true })).toBe(1);
  });

  it("reassigns scheduled duties and keeps the old ones as history", async () => {
    await core.insertPlannedDuties([plan(javed, street1, "2026-10-22"), plan(javed, street2, "2026-10-22")], areaId, actorId);
    await core.insertPlannedDuties([plan(javed, street3, "2026-10-22")], otherAreaId, actorId);
    // One already started: it stays with Javed.
    await Duty.updateOne({ workerId: javed, streetId: street2, day: "2026-10-22" }, { $set: { status: "in_progress" } });

    const result = await core.reassignDutiesCore({ fromWorkerId: javed, toWorkerId: rashid, day: "2026-10-22", areaIds: [areaId], actorId });
    expect(result).toEqual({ moved: 1, skipped: 0 });

    const old = await Duty.findOne({ workerId: javed, streetId: street1, day: "2026-10-22" }).lean();
    expect(old).toMatchObject({ status: "reassigned", active: false });
    expect(old?.reassignedTo?.equals(rashid)).toBe(true);
    const replacement = await Duty.findById(old?.reassignedDutyId).lean();
    expect(replacement).toMatchObject({ status: "scheduled", active: true, day: "2026-10-22", shift: "morning" });
    expect(replacement?.workerId.equals(rashid)).toBe(true);
    expect(replacement?.reassignedFrom?.equals(old!._id)).toBe(true);

    // The other area was out of scope and the started duty was not scheduled.
    expect(await Duty.countDocuments({ workerId: javed, day: "2026-10-22", active: true })).toBe(2);
    // Running it again moves nothing.
    expect(await core.reassignDutiesCore({ fromWorkerId: javed, toWorkerId: rashid, day: "2026-10-22", areaIds: [areaId], actorId })).toEqual({ moved: 0, skipped: 0 });
  });

  it("derives attendance from completed duties", async () => {
    await Duty.updateOne({ workerId: aslam, streetId: street1, day: "2026-10-20", shift: "morning" }, { $set: { status: "completed" } });
    const month = await core.loadAttendance(aslam, "2026-10", "2026-10-22");
    expect(month.days.find((day) => day.day === "2026-10-20")).toEqual({ day: "2026-10-20", state: "present", duties: 3, completed: 1 });
    expect(month.present).toBe(1);

    // Javed's only duty in this area on the 22nd went to Rashid; his started one still counts as pending today.
    const javedMonth = await core.loadAttendance(javed, "2026-10", "2026-10-22");
    expect(javedMonth.days.find((day) => day.day === "2026-10-22")?.state).toBe("pending");
    const rashidMonth = await core.loadAttendance(rashid, "2026-10", "2026-10-23");
    expect(rashidMonth.days.find((day) => day.day === "2026-10-22")?.state).toBe("absent");
  });
});
