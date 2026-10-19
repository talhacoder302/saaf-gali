import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { WORKER_STATUSES } from "@/lib/duties";

// A safai worker. Many have no phone: they get no login, and their supervisor
// marks their duties for them. Workers with a phone may get a `worker` login
// (userId); name, mobile and areas are kept in step with that user.
const workerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // 03XXXXXXXXX when the worker has a phone.
    mobile: { type: String, match: /^03\d{9}$/ },
    // "12345-1234567-1"
    cnic: { type: String, match: /^\d{5}-\d{7}-\d$/ },
    address: { type: String, trim: true, maxlength: 200 },
    // Whole rupees.
    monthlySalary: { type: Number, required: true, min: 0, default: 0 },
    // Midnight Asia/Karachi.
    joiningDate: { type: Date, required: true },
    areaIds: { type: [{ type: Schema.Types.ObjectId, ref: "Area" }], default: [], index: true },
    status: { type: String, enum: WORKER_STATUSES, default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

workerSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
workerSchema.index({ cnic: 1 }, { unique: true, partialFilterExpression: { cnic: { $type: "string" } } });

export type WorkerDoc = InferSchemaType<typeof workerSchema> & { _id: Types.ObjectId };

export const Worker: Model<WorkerDoc> =
  (models.Worker as Model<WorkerDoc> | undefined) ?? model<WorkerDoc>("Worker", workerSchema);
