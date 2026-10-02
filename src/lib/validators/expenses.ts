import { z } from "zod";

import { EXPENSE_STATUSES, MAX_EXPENSE } from "@/lib/expenses";
import { DAY_REGEX } from "@/lib/format";
import { MONTH_REGEX } from "@/lib/months";
import { objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

export const photoKeySchema = z.string().trim().min(1).max(200).nullable();

export const expenseFormSchema = z.object({
  areaId: z.string().regex(/^[a-f\d]{24}$/i, "chooseArea"),
  category: z.string().trim().min(1, "chooseCategory").max(40, "chooseCategory"),
  description: z.string().trim().min(3, "descriptionTooShort").max(300, "descriptionTooLong"),
  amount: z
    .number({ error: "amountInvalid" })
    .int("amountWholeRupees")
    .min(1, "amountInvalid")
    .max(MAX_EXPENSE, "amountTooLarge"),
  date: z.string().regex(DAY_REGEX, "invalidDate"),
  photoKey: photoKeySchema,
});

export const updateExpenseSchema = expenseFormSchema.extend({ id: objectIdSchema });

export const reviewExpenseSchema = z
  .object({
    id: objectIdSchema,
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(300, "notesTooLong"),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "reject" && data.note.length < 3) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "rejectNoteRequired" });
    }
  });

/** "all" shows every month; anything else must be "YYYY-MM". */
export const ALL_MONTHS = "all";

/** Search params on the Expenses page. Bad values fall back to defaults. */
export const listExpensesSchema = z.object({
  areaId: objectIdSchema.optional().catch(undefined),
  month: z
    .union([z.literal(ALL_MONTHS), z.string().regex(MONTH_REGEX)])
    .optional()
    .catch(undefined),
  category: z.string().trim().min(1).max(40).optional().catch(undefined),
  status: z.enum(EXPENSE_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormOutput = z.output<typeof expenseFormSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type ReviewExpenseInput = z.input<typeof reviewExpenseSchema>;
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;
