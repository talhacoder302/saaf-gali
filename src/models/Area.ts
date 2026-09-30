import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const CITIES = ["Rawalpindi", "Islamabad"] as const;
export type City = (typeof CITIES)[number];

// Area management screens come in a later module. For now areas are created by
// the seed script so users can be assigned to them.
const areaSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    city: { type: String, enum: CITIES, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    managerIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    supervisorIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    committeeIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    // Whole rupees.
    defaultMonthlyFee: { type: Number, required: true, min: 0, default: 150 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

areaSchema.index({ city: 1, name: 1 }, { unique: true });

export type AreaDoc = InferSchemaType<typeof areaSchema> & { _id: Types.ObjectId };

export const Area: Model<AreaDoc> =
  (models.Area as Model<AreaDoc> | undefined) ?? model<AreaDoc>("Area", areaSchema);
