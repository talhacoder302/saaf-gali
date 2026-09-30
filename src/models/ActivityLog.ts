import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const ACTIVITY_ACTIONS = [
  "create",
  "update",
  "delete",
  "approve",
  "payment",
  "enable",
  "disable",
  "archive",
  "restore",
  "assign",
  "unassign",
  "login",
  "password_reset",
  "password_change",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

const activityLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", index: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & { _id: Types.ObjectId };

export const ActivityLog: Model<ActivityLogDoc> =
  (models.ActivityLog as Model<ActivityLogDoc> | undefined) ??
  model<ActivityLogDoc>("ActivityLog", activityLogSchema);
