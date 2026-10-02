import { model, models, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { BILL_STATUSES } from "@/lib/fees";
import { MONTH_REGEX } from "@/lib/months";

const feeBillSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true },
    // Copied from the household when the bill is made, so reports don't need joins.
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    blockId: { type: Schema.Types.ObjectId, ref: "Block", required: true },
    streetId: { type: Schema.Types.ObjectId, ref: "Street", required: true },
    month: { type: String, required: true, match: MONTH_REGEX },
    // Whole rupees.
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: BILL_STATUSES, default: "unpaid" },
    // Set when an advance payment created the bill; cancelling that payment removes it again.
    createdByPaymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true },
);

// One bill per household per month: this is what makes "Generate bills" safe to press twice.
feeBillSchema.index({ householdId: 1, month: 1 }, { unique: true });
feeBillSchema.index({ areaId: 1, month: 1, status: 1 });

export type FeeBillDoc = InferSchemaType<typeof feeBillSchema> & { _id: Types.ObjectId };

export const FeeBill: Model<FeeBillDoc> =
  (models.FeeBill as Model<FeeBillDoc> | undefined) ?? model<FeeBillDoc>("FeeBill", feeBillSchema);
