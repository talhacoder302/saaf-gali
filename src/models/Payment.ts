import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/fees";
import { MONTH_REGEX } from "@/lib/months";

const allocationSchema = new Schema(
  {
    billId: { type: Schema.Types.ObjectId, ref: "FeeBill", required: true },
    month: { type: String, required: true, match: MONTH_REGEX },
    // Whole rupees of this payment that went to the bill.
    amount: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

// Payments are never deleted. Cancelling sets status "cancelled", records who
// and why, and takes the allocations back off the bills.
const paymentSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    streetId: { type: Schema.Types.ObjectId, ref: "Street", required: true },
    billIds: { type: [{ type: Schema.Types.ObjectId, ref: "FeeBill" }], default: [] },
    allocations: { type: [allocationSchema], default: [] },
    monthsCovered: { type: [{ type: String, match: MONTH_REGEX }], default: [] },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiptNumber: { type: String, required: true, unique: true },
    // Random, unguessable id for the shareable receipt link (/receipt/<token>).
    publicToken: { type: String, required: true, unique: true },
    paidAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: PAYMENT_STATUSES, default: "active" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

paymentSchema.index({ areaId: 1, paidAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };

export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc> | undefined) ?? model<PaymentDoc>("Payment", paymentSchema);
