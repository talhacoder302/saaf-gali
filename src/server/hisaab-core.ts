// No "server-only" import and no session checks: the seed and the DB
// integration test use this. Only call it after checking permissions
// (src/server/hisaab.ts does).

import { Types } from "mongoose";

import { countsAsSpent, EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/expenses";
import { dayKey, monthKey, TIMEZONE } from "@/lib/format";
import {
  balanceFor,
  chartSeries,
  collectionSummary,
  HISAAB_EXPENSE_LIMIT,
  hisaabMonths,
  makeAreaSlug,
  pickHisaabMonth,
  type CollectionSummary,
  type HisaabBalance,
  type MonthTotals,
} from "@/lib/hisaab";
import { compareMonths } from "@/lib/months";
import type { City } from "@/lib/areas";
import { Area, type AreaDoc } from "@/models/Area";
import { Expense } from "@/models/Expense";
import { FeeBill } from "@/models/FeeBill";
import { Payment } from "@/models/Payment";

const SPENT_STATUSES = EXPENSE_STATUSES.filter(countsAsSpent);

export type HisaabExpense = {
  id: string;
  /** "YYYY-MM-DD" in Pakistan time. */
  day: string;
  category: string;
  description: string;
  amount: number;
  hasPhoto: boolean;
  photoUrl: string | null;
};

export type AreaHisaab = {
  area: { id: string; name: string; city: City; slug: string | null; publicHisaab: boolean; archived: boolean };
  month: string;
  /** Months the picker offers, newest first. */
  months: string[];
  balance: HisaabBalance;
  /** Money spent this month per category, largest first. */
  byCategory: { category: string; amount: number }[];
  /** Expenses waiting for approval this month: shown as a note, not counted. */
  pending: { count: number; amount: number };
  /** Null when no bills were generated for the month yet. */
  collection: CollectionSummary | null;
  /** auto + approved expenses of the month, oldest first. */
  expenses: HisaabExpense[];
  /** Collection vs expenses for the last six months, oldest first. */
  chart: MonthTotals[];
};

/** Builds a URL for a stored photo key (public or pre-signed); injected so this file stays session- and R2-free. */
export type PhotoUrlFn = (key: string | null | undefined) => Promise<string | null>;

/**
 * Money collected (active payments, by the Pakistan month they were received
 * in) and spent (auto + approved expenses) per month, up to `upTo`.
 */
async function monthlyTotals(areaId: Types.ObjectId, upTo: string): Promise<MonthTotals[]> {
  const [payments, expenses] = await Promise.all([
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: { areaId, status: "active" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: TIMEZONE } }, amount: { $sum: "$amount" } } },
    ]),
    Expense.aggregate<{ _id: string; amount: number }>([
      { $match: { areaId, approvalStatus: { $in: SPENT_STATUSES }, month: { $lte: upTo } } },
      { $group: { _id: "$month", amount: { $sum: "$amount" } } },
    ]),
  ]);
  const byMonth = new Map<string, MonthTotals>();
  const entry = (month: string) => {
    const existing = byMonth.get(month) ?? { month, collected: 0, spent: 0 };
    byMonth.set(month, existing);
    return existing;
  };
  for (const row of payments) if (compareMonths(row._id, upTo) <= 0) entry(row._id).collected += row.amount;
  for (const row of expenses) entry(row._id).spent += row.amount;
  return [...byMonth.values()].sort((a, b) => compareMonths(a.month, b.month));
}

/** The earliest month with a bill, payment or expense in the area. */
async function firstMonthOf(areaId: Types.ObjectId): Promise<string | null> {
  const [bill, expense, payment] = await Promise.all([
    FeeBill.findOne({ areaId }).sort({ month: 1 }).select("month").lean(),
    Expense.findOne({ areaId }).sort({ month: 1 }).select("month").lean(),
    Payment.findOne({ areaId, status: "active" }).sort({ paidAt: 1 }).select("paidAt").lean(),
  ]);
  const months = [bill?.month, expense?.month, payment ? monthKey(payment.paidAt) : undefined].filter(
    (month): month is string => Boolean(month),
  );
  return months.sort(compareMonths)[0] ?? null;
}

/**
 * The monthly hisaab of one area. `requestedMonth` falls back to the current
 * month when it is not one the picker offers. Only aggregate numbers and
 * expense details: no household names or per-house amounts.
 */
export async function buildAreaHisaab(
  area: Pick<AreaDoc, "_id" | "name" | "city" | "slug" | "publicHisaab" | "status">,
  requestedMonth: string | null | undefined,
  photoUrl: PhotoUrlFn,
  today = monthKey(),
): Promise<AreaHisaab> {
  const areaId = area._id;
  const months = hisaabMonths(await firstMonthOf(areaId), today);
  const month = pickHisaabMonth(requestedMonth, months);

  const [totals, groups, bills, docs] = await Promise.all([
    monthlyTotals(areaId, month),
    Expense.aggregate<{ _id: { status: ExpenseStatus; category: string }; amount: number; count: number }>([
      { $match: { areaId, month } },
      { $group: { _id: { status: "$approvalStatus", category: "$category" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    FeeBill.find({ areaId, month, status: { $ne: "exempt" } }).select("amount paidAmount").lean(),
    Expense.find({ areaId, month, approvalStatus: { $in: SPENT_STATUSES } })
      .sort({ date: 1, createdAt: 1 })
      .limit(HISAAB_EXPENSE_LIMIT)
      .select("date category description amount receiptPhotoKey")
      .lean(),
  ]);

  const byCategory = new Map<string, number>();
  const pending = { count: 0, amount: 0 };
  for (const group of groups) {
    if (countsAsSpent(group._id.status)) {
      byCategory.set(group._id.category, (byCategory.get(group._id.category) ?? 0) + group.amount);
    } else if (group._id.status === "pending") {
      pending.count += group.count;
      pending.amount += group.amount;
    }
  }

  const urls = await Promise.all(docs.map((doc) => photoUrl(doc.receiptPhotoKey)));

  return {
    area: {
      id: areaId.toString(),
      name: area.name,
      city: area.city,
      slug: area.slug ?? null,
      publicHisaab: Boolean(area.publicHisaab),
      archived: area.status === "archived",
    },
    month,
    months,
    balance: balanceFor(month, totals),
    byCategory: [...byCategory]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category)),
    pending,
    collection: collectionSummary(bills),
    expenses: docs.map((doc, index) => ({
      id: doc._id.toString(),
      day: dayKey(doc.date),
      category: doc.category,
      description: doc.description,
      amount: doc.amount,
      hasPhoto: Boolean(doc.receiptPhotoKey),
      photoUrl: urls[index] ?? null,
    })),
    chart: chartSeries(month, totals),
  };
}

/** The area's public link slug, assigning one on first use (like ensureAreaCode). */
export async function ensureAreaSlug(areaId: Types.ObjectId | string): Promise<string> {
  const id = new Types.ObjectId(areaId.toString());
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const area = await Area.findById(id).select("name city slug").lean();
    if (!area) throw new Error("Area not found");
    if (area.slug) return area.slug;

    const taken = new Set((await Area.distinct("slug", { slug: { $type: "string" } })).map(String));
    const slug = makeAreaSlug(area.name, area.city, taken);
    try {
      await Area.updateOne({ _id: id, slug: { $exists: false } }, { $set: { slug } });
    } catch (error) {
      // Another area took this slug at the same moment: try again with a fresh list.
      if ((error as { code?: unknown }).code !== 11000) throw error;
    }
  }
  throw new Error("Could not assign an area slug");
}
