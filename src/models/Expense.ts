import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { EXPENSE_STATUSES } from "@/lib/expenses";
import { MONTH_REGEX } from "@/lib/months";

// Expenses are never deleted, so the public hisaab always adds up. Rejected
// expenses stay in the list but never count in totals.
const expenseSchema = new Schema(
  {
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    // A built-in key ("supplies") or a custom name from Settings.expenseCategories.
    category: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    // Whole rupees.
    amount: { type: Number, required: true, min: 1 },
    // Midnight Asia/Karachi of the day the money was spent.
    date: { type: Date, required: true },
    // "YYYY-MM" of `date`, for the month filter and monthly hisaab.
    month: { type: String, required: true, match: MONTH_REGEX },
    // R2 object key; the URL is built when the expense is read (public or pre-signed).
    receiptPhotoKey: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvalStatus: { type: String, enum: EXPENSE_STATUSES, required: true },
    // Who approved or rejected it, when, and why.
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

expenseSchema.index({ areaId: 1, month: 1, date: -1 });
expenseSchema.index({ approvalStatus: 1, areaId: 1 });
expenseSchema.index({ createdBy: 1, date: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & { _id: Types.ObjectId };

export const Expense: Model<ExpenseDoc> =
  (models.Expense as Model<ExpenseDoc> | undefined) ?? model<ExpenseDoc>("Expense", expenseSchema);
