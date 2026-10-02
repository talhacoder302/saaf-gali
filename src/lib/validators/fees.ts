import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/fees";
import { MONTH_REGEX } from "@/lib/months";
import { objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

export const monthSchema = z.string().regex(MONTH_REGEX, "invalidMonth");

/** Largest single payment accepted (whole rupees). */
export const MAX_PAYMENT = 1_000_000;

export const generateBillsSchema = z.object({
  month: monthSchema,
  /** null = every area the user can manage. */
  areaId: objectIdSchema.nullable(),
});

/** Search params on the fees overview. Bad values fall back to defaults. */
export const feesOverviewSchema = z.object({
  month: monthSchema.optional().catch(undefined),
  areaId: objectIdSchema.optional().catch(undefined),
});

export const paymentSearchSchema = z.object({
  q: z.string().trim().min(1, "required").max(60),
});

export const recordPaymentSchema = z
  .object({
    householdId: objectIdSchema,
    /** "months": pay the selected months. "amount": pay a typed amount (partial or advance). */
    mode: z.enum(["months", "amount"]),
    months: z.array(monthSchema).max(36),
    amount: z.number({ error: "amountInvalid" }).int("amountWholeRupees").min(0, "amountInvalid").max(MAX_PAYMENT, "amountTooLarge"),
    method: z.enum(PAYMENT_METHODS),
    note: z.string().trim().max(300, "notesTooLong"),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "months" && data.months.length === 0) {
      ctx.addIssue({ code: "custom", path: ["months"], message: "chooseMonths" });
    }
    if (data.mode === "amount" && data.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "amountInvalid" });
    }
  });

export const cancelPaymentSchema = z.object({
  paymentId: objectIdSchema,
  reason: z.string().trim().min(5, "reasonTooShort").max(300, "reasonTooLong"),
});

export type GenerateBillsInput = z.input<typeof generateBillsSchema>;
export type FeesOverviewInput = z.infer<typeof feesOverviewSchema>;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type CancelPaymentInput = z.input<typeof cancelPaymentSchema>;
