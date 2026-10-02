import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { AREA_STATUSES, CITIES } from "@/lib/areas";

export type { AreaStatus, City } from "@/lib/areas";

const areaSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    city: { type: String, enum: CITIES, required: true },
    // Short code used in receipt numbers (SG-SAT-000123). Set when first needed.
    code: { type: String, trim: true, uppercase: true, maxlength: 8 },
    description: { type: String, trim: true, maxlength: 500 },
    // Kept in sync with User.areaIds by src/server/area-team.ts. User.areaIds
    // decides access; these lists are for showing the team quickly.
    managerIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    supervisorIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    committeeIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    // Whole rupees.
    defaultMonthlyFee: { type: Number, required: true, min: 0, default: 150 },
    // Archived areas are hidden from pickers and read-only, but keep their history.
    status: { type: String, enum: AREA_STATUSES, default: "active", index: true },
  },
  { timestamps: true },
);

areaSchema.index({ city: 1, name: 1 }, { unique: true });
areaSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });

export type AreaDoc = InferSchemaType<typeof areaSchema> & { _id: Types.ObjectId };

export const Area: Model<AreaDoc> =
  (models.Area as Model<AreaDoc> | undefined) ?? model<AreaDoc>("Area", areaSchema);
