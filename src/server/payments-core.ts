// No "server-only" import: scripts/seed.ts and the DB integration test use this.
// Callers are responsible for permission checks (see src/server/payments.ts).

import { randomBytes } from "node:crypto";
import { Types } from "mongoose";

import { billStatus, formatReceiptNumber, planPayment, type PaymentMethod } from "@/lib/fees";
import { compareMonths } from "@/lib/months";
import { Counter } from "@/models/Counter";
import { FeeBill } from "@/models/FeeBill";
import type { HouseholdDoc } from "@/models/Household";
import { Payment, type PaymentDoc } from "@/models/Payment";
import { ensureAreaCode } from "@/server/billing-core";
import { ServiceError } from "@/server/errors";
import { loadSettings } from "@/server/settings";

export type PayingHousehold = Pick<
  HouseholdDoc,
  "_id" | "areaId" | "blockId" | "streetId" | "monthlyFee" | "status"
>;

export type RecordPaymentCoreInput = {
  household: PayingHousehold;
  amount: number;
  method: PaymentMethod;
  note?: string;
  receivedBy: Types.ObjectId | string;
  /** "YYYY-MM" of today in Asia/Karachi; advance months start here. */
  currentMonth: string;
  paidAt?: Date;
};

type Applied =
  | { kind: "updated"; billId: Types.ObjectId; amount: number; previousPaid: number }
  | { kind: "created"; billId: Types.ObjectId };

async function nextReceiptNumber(areaId: Types.ObjectId): Promise<string> {
  const [settings, code, counter] = await Promise.all([
    loadSettings(),
    ensureAreaCode(areaId),
    Counter.findOneAndUpdate(
      { _id: `receipt:${areaId.toString()}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    ).lean(),
  ]);
  return formatReceiptNumber(settings.receiptPrefix, code, counter?.seq ?? 1);
}

/** Undo bill changes made for a payment that could not be completed. */
async function rollBack(applied: Applied[]): Promise<void> {
  for (const step of [...applied].reverse()) {
    if (step.kind === "created") {
      await FeeBill.deleteOne({ _id: step.billId, paidAmount: { $gte: 0 } });
    } else {
      const bill = await FeeBill.findById(step.billId).select("amount paidAmount").lean();
      if (!bill) continue;
      const paid = Math.max(0, bill.paidAmount - step.amount);
      await FeeBill.updateOne({ _id: step.billId }, { $set: { paidAmount: paid, status: billStatus(bill.amount, paid) } });
    }
  }
}

/**
 * Record a payment: allocate it oldest month first (creating bills for advance
 * months), take a receipt number, and save the payment. Each bill update only
 * succeeds if nobody else changed the bill since we read it; otherwise all
 * changes are undone and "payment_conflict" is thrown so the cashier retries.
 */
export async function recordPaymentCore(input: RecordPaymentCoreInput): Promise<PaymentDoc> {
  const { household, amount } = input;
  const bills = await FeeBill.find({ householdId: household._id }).select("month amount paidAmount").lean();

  const plan = planPayment({
    openBills: bills
      .filter((bill) => bill.paidAmount < bill.amount)
      .map((bill) => ({ id: bill._id.toString(), month: bill.month, amount: bill.amount, paidAmount: bill.paidAmount })),
    amount,
    monthlyFee: household.monthlyFee,
    billedMonths: new Set(bills.map((bill) => bill.month)),
    advanceFrom: input.currentMonth,
    allowAdvance: household.status === "active",
  });
  if (!plan.ok) throw new ServiceError(plan.error, plan.error === "invalid_amount" ? { amount: "amountInvalid" } : undefined);

  const paymentId = new Types.ObjectId();
  const paidById = new Map(bills.map((bill) => [bill._id.toString(), bill.paidAmount]));
  const applied: Applied[] = [];
  const allocations: { billId: Types.ObjectId; month: string; amount: number }[] = [];

  try {
    for (const allocation of plan.allocations) {
      if (allocation.billId) {
        const billId = new Types.ObjectId(allocation.billId);
        const previousPaid = paidById.get(allocation.billId) ?? 0;
        const paid = previousPaid + allocation.amount;
        const result = await FeeBill.updateOne(
          { _id: billId, paidAmount: previousPaid },
          { $set: { paidAmount: paid, status: billStatus(allocation.billAmount, paid) } },
        );
        if (result.modifiedCount !== 1) throw new ServiceError("payment_conflict");
        applied.push({ kind: "updated", billId, amount: allocation.amount, previousPaid });
        allocations.push({ billId, month: allocation.month, amount: allocation.amount });
      } else {
        const bill = await FeeBill.create({
          householdId: household._id,
          areaId: household.areaId,
          blockId: household.blockId,
          streetId: household.streetId,
          month: allocation.month,
          amount: allocation.billAmount,
          paidAmount: allocation.amount,
          status: billStatus(allocation.billAmount, allocation.amount),
          createdByPaymentId: paymentId,
        });
        applied.push({ kind: "created", billId: bill._id });
        allocations.push({ billId: bill._id, month: allocation.month, amount: allocation.amount });
      }
    }

    const receiptNumber = await nextReceiptNumber(household.areaId);
    return await Payment.create({
      _id: paymentId,
      householdId: household._id,
      areaId: household.areaId,
      streetId: household.streetId,
      billIds: allocations.map((a) => a.billId),
      allocations,
      monthsCovered: [...new Set(allocations.map((a) => a.month))].sort(compareMonths),
      amount,
      method: input.method,
      ...(input.note ? { note: input.note } : {}),
      receivedBy: new Types.ObjectId(input.receivedBy.toString()),
      receiptNumber,
      publicToken: randomBytes(16).toString("base64url"),
      paidAt: input.paidAt ?? new Date(),
    });
  } catch (error) {
    await rollBack(applied);
    if ((error as { code?: unknown }).code === 11000) throw new ServiceError("payment_conflict");
    throw error;
  }
}

/**
 * Cancel a payment: take every allocation back off its bill and mark the
 * payment cancelled with who, when and why. Nothing is deleted; bills created
 * for advance months stay (unpaid) so the history is complete.
 */
export async function cancelPaymentCore(input: {
  paymentId: Types.ObjectId | string;
  cancelledBy: Types.ObjectId | string;
  reason: string;
}): Promise<PaymentDoc> {
  const payment = await Payment.findById(input.paymentId).lean();
  if (!payment) throw new ServiceError("not_found");
  if (payment.status === "cancelled") throw new ServiceError("payment_already_cancelled");

  // Claim the payment first so two cancels can't both reverse the bills.
  const claimed = await Payment.updateOne(
    { _id: payment._id, status: "active" },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: new Types.ObjectId(input.cancelledBy.toString()),
        cancelReason: input.reason,
      },
    },
  );
  if (claimed.modifiedCount !== 1) throw new ServiceError("payment_already_cancelled");

  for (const allocation of payment.allocations) {
    // Retry a few times in case a payment for the same bill lands at the same moment.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const bill = await FeeBill.findById(allocation.billId).select("amount paidAmount").lean();
      if (!bill) break;
      const paid = Math.max(0, bill.paidAmount - allocation.amount);
      const result = await FeeBill.updateOne(
        { _id: bill._id, paidAmount: bill.paidAmount },
        { $set: { paidAmount: paid, status: billStatus(bill.amount, paid) } },
      );
      if (result.modifiedCount === 1) break;
    }
  }

  const updated = await Payment.findById(payment._id).lean();
  if (!updated) throw new ServiceError("not_found");
  return updated;
}
