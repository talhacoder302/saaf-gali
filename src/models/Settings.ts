import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses";

// Single document holding organisation-wide settings. Edited on /admin/settings.
const settingsSchema = new Schema(
  {
    key: { type: String, default: "singleton", unique: true, immutable: true },
    organisationName: { type: String, required: true, trim: true, default: "Saaf Gali" },
    // R2 object key of the logo (see src/server/storage.ts).
    logoKey: { type: String, trim: true },
    receiptPrefix: { type: String, required: true, trim: true, uppercase: true, default: "SG" },
    feeDueDay: { type: Number, required: true, min: 1, max: 28, default: 10 },
    // Expenses above this amount (whole rupees) need committee approval.
    expenseApprovalLimit: { type: Number, required: true, min: 0, default: 5000 },
    // Built-in keys ("supplies") and custom names, in the order shown in forms.
    expenseCategories: { type: [String], default: () => [...DEFAULT_EXPENSE_CATEGORIES] },
    supervisorsCanAddExpenses: { type: Boolean, default: false },
    currency: { type: String, enum: ["PKR"], default: "PKR" },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc> | undefined) ?? model<SettingsDoc>("Settings", settingsSchema);
