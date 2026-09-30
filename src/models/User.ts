import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { LOCALES } from "@/i18n/config";
import { ROLES } from "@/lib/roles";

const pushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Always stored normalised as 03XXXXXXXXX (see src/lib/mobile.ts).
    mobile: { type: String, required: true, unique: true, match: /^03\d{9}$/ },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    areaIds: { type: [{ type: Schema.Types.ObjectId, ref: "Area" }], default: [], index: true },
    householdId: { type: Schema.Types.ObjectId, ref: "Household" },
    language: { type: String, enum: LOCALES, default: "en" },
    status: { type: String, enum: ["active", "disabled"], default: "active", index: true },
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [], select: false },
    lastLoginAt: { type: Date },
    // Set when an admin gives a temporary password; cleared when the user picks their own.
    mustChangePassword: { type: Boolean, default: false },
    // Bumped on password change/reset, role change and disable. Sessions carrying an
    // older version are rejected, which logs the user out everywhere.
    sessionVersion: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserStatus = UserDoc["status"];

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>("User", userSchema);
