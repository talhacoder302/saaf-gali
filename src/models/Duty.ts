import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { DUTY_STATUSES, SHIFTS } from "@/lib/duties";

// One worker on one street for one shift of one day. Duties are history:
// reassigning keeps the old duty (status "reassigned", active false) and
// creates a new one for the other worker.
const dutySchema = new Schema(
  {
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
    streetId: { type: Schema.Types.ObjectId, ref: "Street", required: true },
    // Copied from the street, for area scoping without joins.
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    // "YYYY-MM-DD" in Pakistan time.
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    shift: { type: String, enum: SHIFTS, required: true },
    status: { type: String, enum: DUTY_STATUSES, default: "scheduled" },
    // The live duty of its roster cell. False once reassigned, so the cell can
    // hold the replacement (see the unique index below).
    active: { type: Boolean, default: true },
    // Reassignment history, on the old duty and the new one.
    reassignedTo: { type: Schema.Types.ObjectId, ref: "Worker" },
    reassignedDutyId: { type: Schema.Types.ObjectId, ref: "Duty" },
    reassignedFrom: { type: Schema.Types.ObjectId, ref: "Duty" },
    reassignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reassignedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    // A supervisor who marked the duty for a worker without a phone.
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// One live duty per street, day and shift: assigning twice at the same moment
// (two supervisors, copy + manual) can never double-book a cell.
dutySchema.index({ streetId: 1, day: 1, shift: 1 }, { unique: true, partialFilterExpression: { active: true } });
dutySchema.index({ areaId: 1, day: 1 });
dutySchema.index({ workerId: 1, day: 1 });

export type DutyDoc = InferSchemaType<typeof dutySchema> & { _id: Types.ObjectId };

export const Duty: Model<DutyDoc> =
  (models.Duty as Model<DutyDoc> | undefined) ?? model<DutyDoc>("Duty", dutySchema);
