import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { amountForMonths, billDue, type BillStatus, type PaymentMethod, type PaymentStatus } from "@/lib/fees";
import { monthKey } from "@/lib/format";
import { addMonths, compareMonths } from "@/lib/months";
import { requireRole, requireUser, scopeQueryToUserAreas, type MongoFilter } from "@/lib/permissions";
import { escapeRegex } from "@/lib/regex";
import { ADMIN_ROLES, type Role } from "@/lib/roles";
import {
  cancelPaymentSchema,
  paymentSearchSchema,
  recordPaymentSchema,
  type CancelPaymentInput,
  type RecordPaymentInput,
} from "@/lib/validators/fees";
import { FeeBill } from "@/models/FeeBill";
import { Household } from "@/models/Household";
import { Payment } from "@/models/Payment";
import { Street } from "@/models/Street";
import { User } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { namesFor } from "@/server/billing";
import { ServiceError } from "@/server/errors";
import { cancelPaymentCore, recordPaymentCore } from "@/server/payments-core";
import { loadSettings } from "@/server/settings";

/** Who can take payments: admins and supervisors (in their own areas). */
export const COLLECTOR_ROLES = [...ADMIN_ROLES, "supervisor"] as const satisfies readonly Role[];

/** How many future months the collect screen offers for advance payment. */
const ADVANCE_CHOICES = 12;

// ---------------------------------------------------------------------------
// Find a household to collect from
// ---------------------------------------------------------------------------

export type PaymentSearchRow = {
  id: string;
  houseNumber: string;
  name: string;
  mobile: string | null;
  streetName: string;
  blockName: string;
  areaName: string;
  status: "active" | "vacant" | "exempt";
  dueNow: number;
};

export async function searchHouseholdsForPayment(query: string): Promise<PaymentSearchRow[]> {
  const actor = await requireRole(...COLLECTOR_ROLES);
  const { q } = paymentSearchSchema.parse({ q: query });
  await connectDB();

  const streetsNamed = async (text: string) =>
    (
      await Street.find(scopeQueryToUserAreas(actor, { name: new RegExp(escapeRegex(text), "i") }))
        .select("_id")
        .limit(20)
        .lean()
    ).map((street) => street._id);
  // "12" finds house 12 and 12-A, but not 120.
  const houseNumberRegex = (text: string) => new RegExp(`^${escapeRegex(text)}(-?[A-Za-z])?$`, "i");
  const HOUSE_TOKEN = /^\d+[A-Za-z]?(-[A-Za-z0-9]+)?$/;

  const tokens = q.split(/\s+/);
  const digits = q.replace(/\D/g, "");
  let filter: MongoFilter;
  if (digits.length >= 4 && digits.length === q.replace(/[\s\-+()]/g, "").length) {
    // Looks like a phone number.
    filter = { mobile: new RegExp(escapeRegex(digits.startsWith("92") ? `0${digits.slice(2)}` : digits)) };
  } else if (tokens.length > 1 && HOUSE_TOKEN.test(tokens[0] ?? "")) {
    // "12 Street 5": house number on a street.
    filter = { houseNumber: houseNumberRegex(tokens[0] ?? ""), streetId: { $in: await streetsNamed(tokens.slice(1).join(" ")) } };
  } else {
    const text = new RegExp(escapeRegex(q), "i");
    const or: MongoFilter[] = [{ ownerName: text }, { contactName: text }];
    if (HOUSE_TOKEN.test(q)) or.push({ houseNumber: houseNumberRegex(q) });
    const streetIds = await streetsNamed(q);
    if (streetIds.length > 0) or.push({ streetId: { $in: streetIds } });
    filter = { $or: or };
  }

  const households = await Household.find(scopeQueryToUserAreas(actor, filter))
    .collation({ locale: "en", numericOrdering: true })
    .sort({ streetId: 1, houseNumber: 1 })
    .limit(50)
    .lean();
  const [names, dues] = await Promise.all([
    namesFor(households),
    FeeBill.aggregate<{ _id: Types.ObjectId; due: number }>([
      {
        $match: {
          householdId: { $in: households.map((h) => h._id) },
          month: { $lte: monthKey() },
          status: { $in: ["unpaid", "partial"] },
        },
      },
      { $group: { _id: "$householdId", due: { $sum: { $subtract: ["$amount", "$paidAmount"] } } } },
    ]),
  ]);
  const dueById = new Map(dues.map((d) => [d._id.toString(), d.due]));

  return households.map((h) => ({
    id: h._id.toString(),
    houseNumber: h.houseNumber,
    name: h.contactName || h.ownerName,
    mobile: h.mobile ?? null,
    streetName: names.streets.get(h.streetId.toString()) ?? "",
    blockName: names.blocks.get(h.blockId.toString()) ?? "",
    areaName: names.areas.get(h.areaId.toString()) ?? "",
    status: h.status,
    dueNow: dueById.get(h._id.toString()) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Collect screen data
// ---------------------------------------------------------------------------

export type MonthChoice = {
  month: string;
  /** Still owed for this month (for months without a bill: the monthly fee). */
  due: number;
  billAmount: number;
  paidAmount: number;
  kind: "open" | "advance";
};

export type PaymentContext = {
  household: PaymentSearchRow & { monthlyFee: number; ownerName: string };
  currentMonth: string;
  /** Unpaid/partly paid months (oldest first), then months that could be paid in advance. */
  choices: MonthChoice[];
  dueNow: number;
  allowAdvance: boolean;
};

async function loadHouseholdForCollector(householdId: string) {
  const actor = await requireRole(...COLLECTOR_ROLES);
  if (!isValidObjectId(householdId)) throw new ServiceError("not_found");
  await connectDB();
  const household = await Household.findOne(scopeQueryToUserAreas(actor, { _id: householdId })).lean();
  if (!household) throw new ServiceError("not_found");
  return { actor, household };
}

export async function getPaymentContext(householdId: string): Promise<PaymentContext> {
  const { household } = await loadHouseholdForCollector(householdId);
  const currentMonth = monthKey();
  const [bills, names] = await Promise.all([
    FeeBill.find({ householdId: household._id }).select("month amount paidAmount").lean(),
    namesFor([household]),
  ]);

  const open = bills.filter((bill) => bill.paidAmount < bill.amount).sort((a, b) => compareMonths(a.month, b.month));
  const billed = new Set(bills.map((bill) => bill.month));
  const allowAdvance = household.status === "active" && household.monthlyFee > 0;

  const choices: MonthChoice[] = open.map((bill) => ({
    month: bill.month,
    due: billDue(bill),
    billAmount: bill.amount,
    paidAmount: bill.paidAmount,
    kind: "open",
  }));
  if (allowAdvance) {
    let month = currentMonth;
    let added = 0;
    while (added < ADVANCE_CHOICES) {
      if (!billed.has(month)) {
        choices.push({ month, due: household.monthlyFee, billAmount: household.monthlyFee, paidAmount: 0, kind: "advance" });
        added += 1;
      }
      month = addMonths(month, 1);
    }
  }

  const dueNow = open.filter((bill) => compareMonths(bill.month, currentMonth) <= 0).reduce((sum, bill) => sum + billDue(bill), 0);

  return {
    household: {
      id: household._id.toString(),
      houseNumber: household.houseNumber,
      name: household.contactName || household.ownerName,
      ownerName: household.ownerName,
      mobile: household.mobile ?? null,
      streetName: names.streets.get(household.streetId.toString()) ?? "",
      blockName: names.blocks.get(household.blockId.toString()) ?? "",
      areaName: names.areas.get(household.areaId.toString()) ?? "",
      status: household.status,
      dueNow,
      monthlyFee: household.monthlyFee,
    },
    currentMonth,
    choices,
    dueNow,
    allowAdvance,
  };
}

// ---------------------------------------------------------------------------
// Record and cancel
// ---------------------------------------------------------------------------

export type RecordedPayment = {
  paymentId: string;
  receiptNumber: string;
  publicToken: string;
  amount: number;
  months: string[];
};

export async function recordPayment(input: RecordPaymentInput): Promise<RecordedPayment> {
  const data = recordPaymentSchema.parse(input);
  const { actor, household } = await loadHouseholdForCollector(data.householdId);
  await loadAreaInScope(actor, household.areaId.toString(), { forWrite: true });

  let amount = data.amount;
  if (data.mode === "months") {
    const bills = await FeeBill.find({ householdId: household._id }).select("month amount paidAmount").lean();
    amount = amountForMonths(
      data.months,
      bills.map((b) => ({ id: b._id.toString(), month: b.month, amount: b.amount, paidAmount: b.paidAmount })),
      household.monthlyFee,
    );
    if (amount <= 0) throw new ServiceError("invalid_input", { months: "chooseMonths" });
  }

  const payment = await recordPaymentCore({
    household,
    amount,
    method: data.method,
    note: data.note || undefined,
    receivedBy: actor.id,
    currentMonth: monthKey(),
  });

  await logActivity({
    actorId: actor.id,
    action: "payment",
    entity: "Payment",
    entityId: payment._id,
    areaId: household.areaId,
    meta: { receiptNumber: payment.receiptNumber, amount, method: data.method, months: payment.monthsCovered },
  });

  return {
    paymentId: payment._id.toString(),
    receiptNumber: payment.receiptNumber,
    publicToken: payment.publicToken,
    amount,
    months: payment.monthsCovered,
  };
}

/** Only super admins can cancel, and must give a reason. */
export async function cancelPayment(input: CancelPaymentInput): Promise<void> {
  const actor = await requireRole("super_admin");
  const data = cancelPaymentSchema.parse(input);
  await connectDB();

  const payment = await cancelPaymentCore({ paymentId: data.paymentId, cancelledBy: actor.id, reason: data.reason });
  await logActivity({
    actorId: actor.id,
    action: "cancel",
    entity: "Payment",
    entityId: payment._id,
    areaId: payment.areaId,
    meta: { receiptNumber: payment.receiptNumber, amount: payment.amount, reason: data.reason },
  });
}

// ---------------------------------------------------------------------------
// Receipts and history
// ---------------------------------------------------------------------------

export type ReceiptView = {
  organisationName: string;
  receiptNumber: string;
  publicToken: string;
  amount: number;
  method: PaymentMethod;
  months: string[];
  allocations: { month: string; amount: number }[];
  paidAt: string;
  receivedBy: string;
  status: PaymentStatus;
  cancelReason: string | null;
  note: string | null;
  household: { houseNumber: string; name: string; mobile: string | null; streetName: string; blockName: string; areaName: string };
};

async function toReceiptView(paymentId: Types.ObjectId): Promise<ReceiptView | null> {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) return null;
  const [household, receiver, settings] = await Promise.all([
    Household.findById(payment.householdId).lean(),
    User.findById(payment.receivedBy).select("name").lean(),
    loadSettings(),
  ]);
  if (!household) return null;
  const names = await namesFor([household]);
  return {
    organisationName: settings.organisationName,
    receiptNumber: payment.receiptNumber,
    publicToken: payment.publicToken,
    amount: payment.amount,
    method: payment.method,
    months: payment.monthsCovered,
    allocations: payment.allocations.map((a) => ({ month: a.month, amount: a.amount })),
    paidAt: payment.paidAt.toISOString(),
    receivedBy: receiver?.name ?? "",
    status: payment.status,
    cancelReason: payment.cancelReason ?? null,
    note: payment.note ?? null,
    household: {
      houseNumber: household.houseNumber,
      name: household.contactName || household.ownerName,
      mobile: household.mobile ?? null,
      streetName: names.streets.get(household.streetId.toString()) ?? "",
      blockName: names.blocks.get(household.blockId.toString()) ?? "",
      areaName: names.areas.get(household.areaId.toString()) ?? "",
    },
  };
}

/**
 * Public: anyone with the link can see the receipt (it is what we send on
 * WhatsApp). The token is 128 random bits, so links can't be guessed.
 */
export async function getReceiptByToken(token: string): Promise<ReceiptView | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  await connectDB();
  const payment = await Payment.findOne({ publicToken: token }).select("_id").lean();
  return payment ? toReceiptView(payment._id) : null;
}

export type BillHistoryRow = { id: string; month: string; amount: number; paidAmount: number; status: BillStatus };
export type PaymentHistoryRow = {
  id: string;
  receiptNumber: string;
  publicToken: string;
  amount: number;
  method: PaymentMethod;
  months: string[];
  paidAt: string;
  receivedBy: string;
  status: PaymentStatus;
  cancelReason: string | null;
};
export type FeeHistory = { bills: BillHistoryRow[]; payments: PaymentHistoryRow[]; dueNow: number; currentMonth: string };

async function historyFor(householdId: Types.ObjectId): Promise<FeeHistory> {
  const currentMonth = monthKey();
  const [bills, payments] = await Promise.all([
    FeeBill.find({ householdId }).select("month amount paidAmount status").lean(),
    Payment.find({ householdId }).sort({ paidAt: -1 }).lean(),
  ]);
  const receivers = await User.find({ _id: { $in: [...new Set(payments.map((p) => p.receivedBy.toString()))] } })
    .select("name")
    .lean();
  const receiverName = new Map(receivers.map((u) => [u._id.toString(), u.name]));

  return {
    currentMonth,
    dueNow: bills
      .filter((bill) => compareMonths(bill.month, currentMonth) <= 0)
      .reduce((sum, bill) => sum + billDue(bill), 0),
    bills: bills
      .sort((a, b) => compareMonths(b.month, a.month))
      .map((bill) => ({ id: bill._id.toString(), month: bill.month, amount: bill.amount, paidAmount: bill.paidAmount, status: bill.status })),
    payments: payments.map((payment) => ({
      id: payment._id.toString(),
      receiptNumber: payment.receiptNumber,
      publicToken: payment.publicToken,
      amount: payment.amount,
      method: payment.method,
      months: payment.monthsCovered,
      paidAt: payment.paidAt.toISOString(),
      receivedBy: receiverName.get(payment.receivedBy.toString()) ?? "",
      status: payment.status,
      cancelReason: payment.cancelReason ?? null,
    })),
  };
}

/** Full fee history of a household, for the admin household page. */
export async function getHouseholdFeeHistory(householdId: string): Promise<FeeHistory | null> {
  const actor = await requireRole(...ADMIN_ROLES);
  if (!isValidObjectId(householdId)) return null;
  await connectDB();
  const household = await Household.findOne(scopeQueryToUserAreas(actor, { _id: householdId })).select("_id").lean();
  return household ? historyFor(household._id) : null;
}

export type MyFees = FeeHistory & {
  household: { houseNumber: string; streetName: string; areaName: string; monthlyFee: number } | null;
};

/** The signed-in resident's own bills and receipts. */
export async function getMyFees(): Promise<MyFees> {
  const user = await requireUser();
  await connectDB();
  if (!user.householdId) return { household: null, bills: [], payments: [], dueNow: 0, currentMonth: monthKey() };

  const household = await Household.findById(user.householdId).lean();
  if (!household) return { household: null, bills: [], payments: [], dueNow: 0, currentMonth: monthKey() };
  const names = await namesFor([household]);
  return {
    household: {
      houseNumber: household.houseNumber,
      streetName: names.streets.get(household.streetId.toString()) ?? "",
      areaName: names.areas.get(household.areaId.toString()) ?? "",
      monthlyFee: household.monthlyFee,
    },
    ...(await historyFor(household._id)),
  };
}
