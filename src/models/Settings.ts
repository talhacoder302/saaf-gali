import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

// Single document holding organisation-wide settings.
const settingsSchema = new Schema(
  {
    key: { type: String, default: "singleton", unique: true, immutable: true },
    organisationName: { type: String, required: true, trim: true, default: "Saaf Gali" },
    logoUrl: { type: String, trim: true },
    receiptPrefix: { type: String, required: true, trim: true, uppercase: true, default: "SG" },
    feeDueDay: { type: Number, required: true, min: 1, max: 28, default: 10 },
    // Expenses above this amount (whole rupees) need committee approval.
    expenseApprovalLimit: { type: Number, required: true, min: 0, default: 5000 },
    currency: { type: String, enum: ["PKR"], default: "PKR" },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc> | undefined) ?? model<SettingsDoc>("Settings", settingsSchema);
