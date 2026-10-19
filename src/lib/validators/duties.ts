import { z } from "zod";

import { MARK_ACTIONS, MAX_BULK_STREETS, SHIFTS } from "@/lib/duties";
import { isValidDay } from "@/lib/expenses";
import { objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

const daySchema = z.string().refine(isValidDay, "invalidDate");

/** Search params on the roster. Bad values fall back to defaults (first area, this week). */
export const rosterQuerySchema = z.object({
  area: objectIdSchema.optional().catch(undefined),
  week: daySchema.optional().catch(undefined),
  block: objectIdSchema.optional().catch(undefined),
});

/** Put a worker on one roster cell (or change who is on it). */
export const assignDutySchema = z.object({
  streetId: objectIdSchema,
  day: daySchema,
  shift: z.enum(SHIFTS),
  workerId: objectIdSchema,
});

export const dutyIdSchema = z.object({ id: objectIdSchema });

export const bulkAssignSchema = z.object({
  workerId: objectIdSchema,
  streetIds: z.array(objectIdSchema).min(1, "chooseStreets").max(MAX_BULK_STREETS),
  days: z.array(daySchema).min(1, "chooseDays").max(7),
  shift: z.enum(SHIFTS),
});

export const copyWeekSchema = z.object({ areaId: objectIdSchema, week: daySchema });

/** Give an absent worker's remaining duties for today to someone else. */
export const reassignSchema = z
  .object({ fromWorkerId: objectIdSchema, toWorkerId: objectIdSchema })
  .refine((data) => data.fromWorkerId !== data.toWorkerId, { path: ["toWorkerId"], message: "sameWorker" });

export const markDutySchema = z.object({ id: objectIdSchema, action: z.enum(MARK_ACTIONS) });

export type RosterQuery = z.infer<typeof rosterQuerySchema>;
export type AssignDutyInput = z.input<typeof assignDutySchema>;
export type BulkAssignInput = z.input<typeof bulkAssignSchema>;
export type CopyWeekInput = z.input<typeof copyWeekSchema>;
export type ReassignInput = z.input<typeof reassignSchema>;
export type MarkDutyInput = z.input<typeof markDutySchema>;
