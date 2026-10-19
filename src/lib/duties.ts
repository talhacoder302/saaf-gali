import { isValidDay } from "@/lib/expenses";
import type { Role } from "@/lib/roles";

// Constants and pure rules for workers, duties and attendance. No mongoose
// here: client code imports this. Days are "YYYY-MM-DD" strings in Pakistan
// time; the helpers below never touch timezones.

export const WORKER_STATUSES = ["active", "inactive"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const SHIFTS = ["morning", "evening"] as const;
export type Shift = (typeof SHIFTS)[number];

/**
 * scheduled: planned. in_progress / completed: work started / done.
 * missed: nobody did it. reassigned: given to another worker (kept as history;
 * the new worker gets a new duty).
 */
export const DUTY_STATUSES = ["scheduled", "in_progress", "completed", "missed", "reassigned"] as const;
export type DutyStatus = (typeof DUTY_STATUSES)[number];

export const MARK_ACTIONS = ["start", "complete", "miss"] as const;
export type MarkAction = (typeof MARK_ACTIONS)[number];

/** Who plans duties (roster, copy, bulk assign, reassign). Supervisors only in their own areas. */
export const DUTY_MANAGE_ROLES = ["super_admin", "area_manager", "supervisor"] as const satisfies readonly Role[];

export const WORKERS_PAGE_SIZE = 25;

/** Duties can be planned this far ahead. */
export const ROSTER_AHEAD_DAYS = 8 * 7;

/** The roster can be browsed this many weeks back. */
export const ROSTER_BACK_WEEKS = 26;

/** A supervisor can mark a duty done up to this many days later. */
export const MARK_BACKDATE_DAYS = 7;

/** Most streets one bulk assignment can cover. */
export const MAX_BULK_STREETS = 100;

// ---------------------------------------------------------------------------
// Days and weeks
// ---------------------------------------------------------------------------

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** addDays("2026-10-31", 1) -> "2026-11-01" */
export function addDays(day: string, count: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + count);
  return fromUtc(date);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (toUtc(day).getUTCDay() + 6) % 7;
}

/** Weeks start on Monday. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** The seven days of the week that starts on `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Every day of a "YYYY-MM" month. */
export function monthDays(month: string): string[] {
  const days: string[] = [];
  for (let day = `${month}-01`; day.startsWith(month); day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * The week the roster shows: the requested one (any day of it), or this week
 * when it is missing or outside the browsable range.
 */
export function pickRosterWeek(requested: string | null | undefined, today: string): string {
  const current = weekStart(today);
  if (!requested || !isValidDay(requested)) return current;
  const week = weekStart(requested);
  const weeksBack = daysBetween(week, current) / 7;
  const lastPlannable = weekStart(addDays(today, ROSTER_AHEAD_DAYS));
  if (weeksBack > ROSTER_BACK_WEEKS || week > lastPlannable) return current;
  return week;
}

/** A duty can be planned or changed for today up to ROSTER_AHEAD_DAYS ahead. */
export function isPlannableDay(day: string, today: string): boolean {
  return isValidDay(day) && day >= today && daysBetween(today, day) <= ROSTER_AHEAD_DAYS;
}

// ---------------------------------------------------------------------------
// Duty status
// ---------------------------------------------------------------------------

/** What to show: a scheduled duty whose day has passed was missed, even if nobody marked it. */
export function displayStatus(status: DutyStatus, day: string, today: string): DutyStatus {
  return status === "scheduled" && day < today ? "missed" : status;
}

/**
 * The status a duty moves to when a supervisor marks it, or null when the
 * mark is not allowed. Starting is for today only; completing and marking
 * missed work for today and up to MARK_BACKDATE_DAYS back. Future duties
 * and reassigned ones can't be marked.
 */
export function nextStatus(action: MarkAction, status: DutyStatus, day: string, today: string): DutyStatus | null {
  if (status === "reassigned" || day > today) return null;
  if (daysBetween(day, today) > MARK_BACKDATE_DAYS) return null;
  const shown = displayStatus(status, day, today);
  switch (action) {
    case "start":
      return day === today && status === "scheduled" ? "in_progress" : null;
    case "complete":
      return shown === "scheduled" || shown === "in_progress" || shown === "missed" ? "completed" : null;
    case "miss":
      return status === "scheduled" || status === "in_progress" ? "missed" : null;
  }
}

/** Only scheduled duties from today on can be changed or removed on the roster. */
export function isEditableDuty(status: DutyStatus, day: string, today: string): boolean {
  return status === "scheduled" && day >= today;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/**
 * present: at least one duty completed that day.
 * absent: had duties but completed none, and the day is over (or every duty
 *   was reassigned to someone else).
 * pending: today or later, duties not done yet.
 * off: no duties that day.
 */
export const ATTENDANCE_STATES = ["present", "absent", "pending", "off"] as const;
export type AttendanceState = (typeof ATTENDANCE_STATES)[number];

export function attendanceState(statuses: readonly DutyStatus[], day: string, today: string): AttendanceState {
  if (statuses.length === 0) return "off";
  if (statuses.includes("completed")) return "present";
  if (day < today || statuses.every((status) => status === "reassigned")) return "absent";
  return "pending";
}

export type AttendanceDay = { day: string; state: AttendanceState; duties: number; completed: number };

export type AttendanceMonth = {
  month: string;
  days: AttendanceDay[];
  present: number;
  absent: number;
  /** Days with duties that are over (present + absent). */
  workingDays: number;
};

/** A month of attendance from a worker's duties ({day, status}). */
export function attendanceMonth(
  month: string,
  duties: readonly { day: string; status: DutyStatus }[],
  today: string,
): AttendanceMonth {
  const byDay = new Map<string, DutyStatus[]>();
  for (const duty of duties) {
    if (!duty.day.startsWith(month)) continue;
    byDay.set(duty.day, [...(byDay.get(duty.day) ?? []), duty.status]);
  }
  const days = monthDays(month).map((day) => {
    const statuses = byDay.get(day) ?? [];
    return {
      day,
      state: attendanceState(statuses, day, today),
      duties: statuses.length,
      completed: statuses.filter((status) => status === "completed").length,
    };
  });
  const present = days.filter((day) => day.state === "present").length;
  const absent = days.filter((day) => day.state === "absent").length;
  return { month, days, present, absent, workingDays: present + absent };
}

// ---------------------------------------------------------------------------
// Roster planning
// ---------------------------------------------------------------------------

/** One roster cell: a street on a day in a shift. */
export function cellKey(streetId: string, day: string, shift: Shift): string {
  return `${streetId}|${day}|${shift}`;
}

export type PlannedDuty = { workerId: string; streetId: string; day: string; shift: Shift };

export type CopyPlan = { create: PlannedDuty[]; skippedTaken: number; skippedPast: number; skippedWorker: number };

/**
 * "Copy last week": every live duty of last week moves seven days on. Cells
 * that are already filled, days before today and workers who are no longer
 * active in the area are skipped.
 */
export function planCopyWeek(
  lastWeek: readonly PlannedDuty[],
  takenCells: ReadonlySet<string>,
  activeWorkerIds: ReadonlySet<string>,
  today: string,
): CopyPlan {
  const plan: CopyPlan = { create: [], skippedTaken: 0, skippedPast: 0, skippedWorker: 0 };
  const taken = new Set(takenCells);
  for (const duty of lastWeek) {
    const day = addDays(duty.day, 7);
    const key = cellKey(duty.streetId, day, duty.shift);
    if (day < today) plan.skippedPast += 1;
    else if (!activeWorkerIds.has(duty.workerId)) plan.skippedWorker += 1;
    else if (taken.has(key)) plan.skippedTaken += 1;
    else {
      taken.add(key);
      plan.create.push({ ...duty, day });
    }
  }
  return plan;
}

export type BulkPlan = { create: PlannedDuty[]; skippedTaken: number };

/** One worker on several streets and days in one shift; filled cells are left alone. */
export function planBulkAssign(
  input: { workerId: string; streetIds: readonly string[]; days: readonly string[]; shift: Shift },
  takenCells: ReadonlySet<string>,
): BulkPlan {
  const plan: BulkPlan = { create: [], skippedTaken: 0 };
  for (const day of [...new Set(input.days)].sort()) {
    for (const streetId of new Set(input.streetIds)) {
      if (takenCells.has(cellKey(streetId, day, input.shift))) plan.skippedTaken += 1;
      else plan.create.push({ workerId: input.workerId, streetId, day, shift: input.shift });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// CNIC
// ---------------------------------------------------------------------------

/** "3520112345671" or "35201-1234567-1" -> "35201-1234567-1"; null when it is not 13 digits. */
export function normalizeCnic(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
