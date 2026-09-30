import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const locationSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const streetSchema = new Schema(
  {
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true, index: true },
    blockId: { type: Schema.Types.ObjectId, ref: "Block", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: locationSchema, required: false },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

streetSchema.index({ blockId: 1, name: 1 }, { unique: true });

export type StreetDoc = InferSchemaType<typeof streetSchema> & { _id: Types.ObjectId };

export const Street: Model<StreetDoc> =
  (models.Street as Model<StreetDoc> | undefined) ?? model<StreetDoc>("Street", streetSchema);
