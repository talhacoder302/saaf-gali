import { describe, expect, it } from "vitest";

import {
  addDays,
  attendanceMonth,
  attendanceState,
  cellKey,
  daysBetween,
  displayStatus,
  isEditableDuty,
  isPlannableDay,
  monthDays,
  nextStatus,
  normalizeCnic,
  pickRosterWeek,
  planBulkAssign,
  planCopyWeek,
  weekDays,
  weekdayIndex,
  weekStart,
  type PlannedDuty,
} from "@/lib/duties";
import { bulkAssignSchema, reassignSchema, rosterQuerySchema } from "@/lib/validators/duties";
import { workerFormSchema } from "@/lib/validators/workers";

const TODAY = "2026-10-21"; // a Wednesday

describe("days and weeks", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-21", "2026-11-04")).toBe(14);
  });

  it("starts weeks on Monday", () => {
    expect(weekdayIndex("2026-10-19")).toBe(0);
    expect(weekdayIndex("2026-10-25")).toBe(6);
    expect(weekStart(TODAY)).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekDays("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("lists the days of a month", () => {
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthDays("2028-02").at(-1)).toBe("2028-02-29");
    expect(monthDays("2026-10")[0]).toBe("2026-10-01");
  });

  it("picks this week unless a valid browsable week is asked for", () => {
    expect(pickRosterWeek(undefined, TODAY)).toBe("2026-10-19");
    expect(pickRosterWeek("2026-10-29", TODAY)).toBe("2026-10-26");
    expect(pickRosterWeek("2026-02-30", TODAY)).toBe("2026-10-19");
    expect(pickRosterWeek("2020-01-06", TODAY)).toBe("2026-10-19");
    expect(pickRosterWeek("2027-06-01", TODAY)).toBe("2026-10-19");
  });

  it("plans from today up to eight weeks ahead", () => {
    expect(isPlannableDay(TODAY, TODAY)).toBe(true);
    expect(isPlannableDay("2026-10-20", TODAY)).toBe(false);
    expect(isPlannableDay("2026-12-16", TODAY)).toBe(true);
    expect(isPlannableDay("2026-12-17", TODAY)).toBe(false);
  });
});

describe("duty status", () => {
  it("shows past scheduled duties as missed", () => {
    expect(displayStatus("scheduled", "2026-10-20", TODAY)).toBe("missed");
    expect(displayStatus("scheduled", TODAY, TODAY)).toBe("scheduled");
    expect(displayStatus("in_progress", "2026-10-20", TODAY)).toBe("in_progress");
  });

  it("starts only today's scheduled duties", () => {
    expect(nextStatus("start", "scheduled", TODAY, TODAY)).toBe("in_progress");
    expect(nextStatus("start", "scheduled", "2026-10-20", TODAY)).toBeNull();
    expect(nextStatus("start", "in_progress", TODAY, TODAY)).toBeNull();
  });

  it("completes today's and recent duties, even missed ones", () => {
    expect(nextStatus("complete", "scheduled", TODAY, TODAY)).toBe("completed");
    expect(nextStatus("complete", "in_progress", TODAY, TODAY)).toBe("completed");
    expect(nextStatus("complete", "missed", "2026-10-15", TODAY)).toBe("completed");
    expect(nextStatus("complete", "scheduled", "2026-10-14", TODAY)).toBe("completed");
    expect(nextStatus("complete", "scheduled", "2026-10-13", TODAY)).toBeNull();
    expect(nextStatus("complete", "completed", TODAY, TODAY)).toBeNull();
  });

  it("never marks future or reassigned duties", () => {
    expect(nextStatus("complete", "scheduled", "2026-10-22", TODAY)).toBeNull();
    expect(nextStatus("miss", "reassigned", TODAY, TODAY)).toBeNull();
    expect(nextStatus("miss", "scheduled", TODAY, TODAY)).toBe("missed");
    expect(nextStatus("miss", "completed", TODAY, TODAY)).toBeNull();
  });

  it("edits only scheduled duties from today on", () => {
    expect(isEditableDuty("scheduled", TODAY, TODAY)).toBe(true);
    expect(isEditableDuty("in_progress", TODAY, TODAY)).toBe(false);
    expect(isEditableDuty("scheduled", "2026-10-20", TODAY)).toBe(false);
  });
});

describe("attendance", () => {
  it("is present with one completed duty", () => {
    expect(attendanceState(["missed", "completed"], "2026-10-20", TODAY)).toBe("present");
    expect(attendanceState(["reassigned", "completed"], TODAY, TODAY)).toBe("present");
  });

  it("is absent when the day passed without a completed duty, or everything was reassigned", () => {
    expect(attendanceState(["scheduled"], "2026-10-20", TODAY)).toBe("absent");
    expect(attendanceState(["reassigned", "reassigned"], TODAY, TODAY)).toBe("absent");
  });

  it("is pending today and off without duties", () => {
    expect(attendanceState(["scheduled", "in_progress"], TODAY, TODAY)).toBe("pending");
    expect(attendanceState([], "2026-10-20", TODAY)).toBe("off");
  });

  it("adds up a month", () => {
    const month = attendanceMonth(
      "2026-10",
      [
        { day: "2026-10-19", status: "completed" },
        { day: "2026-10-19", status: "completed" },
        { day: "2026-10-20", status: "missed" },
        { day: "2026-10-21", status: "scheduled" },
        { day: "2026-09-30", status: "completed" },
      ],
      TODAY,
    );
    expect(month.days).toHaveLength(31);
    expect(month.days[18]).toEqual({ day: "2026-10-19", state: "present", duties: 2, completed: 2 });
    expect(month.days[19]?.state).toBe("absent");
    expect(month.days[20]?.state).toBe("pending");
    expect(month).toMatchObject({ present: 1, absent: 1, workingDays: 2 });
  });
});

describe("roster planning", () => {
  const lastWeek: PlannedDuty[] = [
    { workerId: "w1", streetId: "s1", day: "2026-10-12", shift: "morning" },
    { workerId: "w1", streetId: "s1", day: "2026-10-15", shift: "morning" },
    { workerId: "w1", streetId: "s2", day: "2026-10-16", shift: "morning" },
    { workerId: "w2", streetId: "s3", day: "2026-10-16", shift: "evening" },
    { workerId: "gone", streetId: "s4", day: "2026-10-17", shift: "morning" },
  ];

  it("copies last week seven days on, skipping past days, filled cells and inactive workers", () => {
    const taken = new Set([cellKey("s2", "2026-10-23", "morning")]);
    const plan = planCopyWeek(lastWeek, taken, new Set(["w1", "w2"]), TODAY);
    expect(plan.create).toEqual([
      { workerId: "w1", streetId: "s1", day: "2026-10-22", shift: "morning" },
      { workerId: "w2", streetId: "s3", day: "2026-10-23", shift: "evening" },
    ]);
    expect(plan).toMatchObject({ skippedPast: 1, skippedTaken: 1, skippedWorker: 1 });
  });

  it("bulk assigns every street and day once, leaving filled cells alone", () => {
    const plan = planBulkAssign(
      { workerId: "w1", streetIds: ["s1", "s2", "s1"], days: ["2026-10-23", "2026-10-22"], shift: "morning" },
      new Set([cellKey("s2", "2026-10-22", "morning")]),
    );
    expect(plan.create.map((duty) => `${duty.day}/${duty.streetId}`)).toEqual(["2026-10-22/s1", "2026-10-23/s1", "2026-10-23/s2"]);
    expect(plan.skippedTaken).toBe(1);
  });
});

describe("validators", () => {
  const worker = {
    name: "Muhammad Aslam",
    mobile: "",
    cnic: "",
    address: "",
    monthlySalary: 25_000,
    joiningDate: "2026-01-15",
    areaIds: ["665f00000000000000000001"],
    createLogin: false,
    password: "",
  };

  it("formats a CNIC", () => {
    expect(normalizeCnic("3740512345671")).toBe("37405-1234567-1");
    expect(normalizeCnic("37405-1234567-1")).toBe("37405-1234567-1");
    expect(normalizeCnic("1234")).toBeNull();
    expect(workerFormSchema.parse({ ...worker, cnic: "37405 1234567 1" }).cnic).toBe("37405-1234567-1");
  });

  it("needs a mobile and a password for a login", () => {
    const result = workerFormSchema.safeParse({ ...worker, createLogin: true, password: "short" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
    expect(paths).toEqual(["mobile:mobileNeededForLogin", "password:passwordTooShort"]);
    expect(workerFormSchema.safeParse({ ...worker, mobile: "0300-1234567", createLogin: true, password: "Safai@1234" }).success).toBe(true);
  });

  it("needs an area and a whole-rupee salary", () => {
    expect(workerFormSchema.safeParse({ ...worker, areaIds: [] }).error?.issues[0]?.message).toBe("areaRequired");
    expect(workerFormSchema.safeParse({ ...worker, monthlySalary: 100.5 }).error?.issues[0]?.message).toBe("salaryInvalid");
  });

  it("checks duty inputs", () => {
    expect(reassignSchema.safeParse({ fromWorkerId: "665f00000000000000000001", toWorkerId: "665f00000000000000000001" }).error?.issues[0]?.message).toBe("sameWorker");
    expect(bulkAssignSchema.safeParse({ workerId: "665f00000000000000000001", streetIds: [], days: ["2026-10-21"], shift: "morning" }).error?.issues[0]?.message).toBe("chooseStreets");
    expect(rosterQuerySchema.parse({ area: "x", week: "2026-13-01" })).toEqual({ area: undefined, week: undefined, block: undefined });
  });
});
