import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const blockSchema = new Schema(
  {
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { timestamps: true },
);

blockSchema.index({ areaId: 1, name: 1 }, { unique: true });

export type BlockDoc = InferSchemaType<typeof blockSchema> & { _id: Types.ObjectId };

export const Block: Model<BlockDoc> =
  (models.Block as Model<BlockDoc> | undefined) ?? model<BlockDoc>("Block", blockSchema);
