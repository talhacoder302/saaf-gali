import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { HOUSEHOLD_STATUSES, OCCUPANT_TYPES } from "@/lib/households";

export type { HouseholdStatus, OccupantType } from "@/lib/households";

const householdSchema = new Schema(
  {
    // areaId and blockId are copied from the street so lists can filter without joins.
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    blockId: { type: Schema.Types.ObjectId, ref: "Block", required: true, index: true },
    streetId: { type: Schema.Types.ObjectId, ref: "Street", required: true },
    houseNumber: { type: String, required: true, trim: true, maxlength: 20 },
    ownerName: { type: String, required: true, trim: true, maxlength: 80 },
    occupantType: { type: String, enum: OCCUPANT_TYPES, default: "owner" },
    contactName: { type: String, trim: true, maxlength: 80 },
    // Not unique: one person can own several houses.
    mobile: { type: String, match: /^03\d{9}$/, index: true },
    email: { type: String, trim: true, lowercase: true },
    // Whole rupees. Starts at the area's defaultMonthlyFee.
    monthlyFee: { type: Number, required: true, min: 0 },
    // Only "active" households are billed (see isBillable in src/lib/households.ts).
    status: { type: String, enum: HOUSEHOLD_STATUSES, default: "active" },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

householdSchema.index({ streetId: 1, houseNumber: 1 }, { unique: true });
householdSchema.index({ areaId: 1, status: 1 });

export type HouseholdDoc = InferSchemaType<typeof householdSchema> & { _id: Types.ObjectId };

export const Household: Model<HouseholdDoc> =
  (models.Household as Model<HouseholdDoc> | undefined) ?? model<HouseholdDoc>("Household", householdSchema);
