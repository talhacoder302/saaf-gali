import { z } from "zod";

import { categoryKey, MAX_EXPENSE } from "@/lib/expenses";
import { photoKeySchema } from "@/lib/validators/expenses";

// Messages are keys under "errors" in the i18n files.

export const MAX_EXPENSE_CATEGORIES = 20;

export const categoryNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(2, "categoryTooShort").max(30, "categoryTooLong"));

export const settingsFormSchema = z.object({
  organisationName: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  logoKey: photoKeySchema,
  receiptPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, "receiptPrefixInvalid"),
  feeDueDay: z.number({ error: "feeDueDayInvalid" }).int("feeDueDayInvalid").min(1, "feeDueDayInvalid").max(28, "feeDueDayInvalid"),
  expenseApprovalLimit: z
    .number({ error: "amountInvalid" })
    .int("amountWholeRupees")
    .min(0, "amountInvalid")
    .max(MAX_EXPENSE, "amountTooLarge"),
  supervisorsCanAddExpenses: z.boolean(),
  expenseCategories: z
    .array(categoryNameSchema)
    .min(1, "categoriesRequired")
    .max(MAX_EXPENSE_CATEGORIES, "tooManyCategories")
    .refine((names) => new Set(names.map(categoryKey)).size === names.length, "categoryDuplicate"),
});

export type SettingsFormInput = z.input<typeof settingsFormSchema>;
export type SettingsFormOutput = z.output<typeof settingsFormSchema>;
