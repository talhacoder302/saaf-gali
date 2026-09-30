import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

// Screens for households come in a later module. The model exists now so
// areas, blocks and streets can show household counts and refuse deletes
// that would orphan houses.
const householdSchema = new Schema(
  {
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true, index: true },
    blockId: { type: Schema.Types.ObjectId, ref: "Block", required: true, index: true },
    streetId: { type: Schema.Types.ObjectId, ref: "Street", required: true },
    houseNumber: { type: String, required: true, trim: true, maxlength: 20 },
    ownerName: { type: String, required: true, trim: true, maxlength: 80 },
    occupantType: { type: String, enum: ["owner", "tenant"], default: "owner" },
    contactName: { type: String, trim: true, maxlength: 80 },
    mobile: { type: String, match: /^03\d{9}$/ },
    email: { type: String, trim: true, lowercase: true },
    // Whole rupees.
    monthlyFee: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "vacant", "exempt"], default: "active" },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

householdSchema.index({ streetId: 1, houseNumber: 1 }, { unique: true });

export type HouseholdDoc = InferSchemaType<typeof householdSchema> & { _id: Types.ObjectId };

export const Household: Model<HouseholdDoc> =
  (models.Household as Model<HouseholdDoc> | undefined) ?? model<HouseholdDoc>("Household", householdSchema);
