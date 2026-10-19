"use server";

import type { ActionResult } from "@/lib/action-result";
import type { DutyStatus } from "@/lib/duties";
import type { AssignDutyInput, BulkAssignInput, CopyWeekInput, MarkDutyInput, ReassignInput } from "@/lib/validators/duties";
import { assignDuty, bulkAssign, copyLastWeek, markDuty, reassignToday, removeDuty, type PlanResult } from "@/server/duties";
import { runMutation } from "@/server/run-action";

// Duty actions, shared by the admin roster and the supervisor screens.
// Every permission and area check lives in src/server/duties.ts.

export async function assignDutyAction(input: AssignDutyInput): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await assignDuty(input);
    return null;
  });
}

export async function removeDutyAction(id: string): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await removeDuty({ id });
    return null;
  });
}

export async function bulkAssignAction(input: BulkAssignInput): Promise<ActionResult<PlanResult>> {
  return runMutation(() => bulkAssign(input));
}

export async function copyLastWeekAction(input: CopyWeekInput): Promise<ActionResult<PlanResult>> {
  return runMutation(() => copyLastWeek(input));
}

export async function reassignTodayAction(input: ReassignInput): Promise<ActionResult<{ moved: number; skipped: number }>> {
  return runMutation(() => reassignToday(input));
}

export async function markDutyAction(input: MarkDutyInput): Promise<ActionResult<{ status: DutyStatus }>> {
  return runMutation(() => markDuty(input));
}
