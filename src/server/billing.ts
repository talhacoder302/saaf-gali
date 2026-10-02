import "server-only";

import { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { DEFAULTER_MONTHS, type BillStatus } from "@/lib/fees";
import { monthKey } from "@/lib/format";
import { addMonths, compareMonths } from "@/lib/months";
import { hasAllAreaAccess, requireRole, scopeQueryToUserAreas, type MongoFilter } from "@/lib/permissions";
import { ADMIN_ROLES } from "@/lib/roles";
import { feesOverviewSchema, generateBillsSchema, type FeesOverviewInput, type GenerateBillsInput } from "@/lib/validators/fees";
import { Area } from "@/models/Area";
import { Block } from "@/models/Block";
import { FeeBill } from "@/models/FeeBill";
import { Household } from "@/models/Household";
import { Street } from "@/models/Street";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { generateBillsForAreas, type GenerateResult } from "@/server/billing-core";
import { ServiceError } from "@/server/errors";
import { loadSettings } from "@/server/settings";

/** Bills can be generated from a year back up to next month. */
export function billableMonthRange(today = monthKey()): { from: string; to: string } {
  return { from: addMonths(today, -12), to: addMonths(today, 1) };
}

export async function generateBills(input: GenerateBillsInput): Promise<GenerateResult> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = generateBillsSchema.parse(input);
  const range = billableMonthRange();
  if (compareMonths(data.month, range.from) < 0 || compareMonths(data.month, range.to) > 0) {
    throw new ServiceError("invalid_input", { month: "monthOutOfRange" });
  }
  await connectDB();

  let areaIds: Types.ObjectId[];
  if (data.areaId) {
    areaIds = [(await loadAreaInScope(actor, data.areaId, { forWrite: true }))._id];
  } else {
    const areas = await Area.find(scopeQueryToUserAreas(actor, { status: "active" }, "_id")).select("_id").lean();
    areaIds = areas.map((area) => area._id);
  }
  if (areaIds.length === 0) throw new ServiceError("no_areas");

  const result = await generateBillsForAreas(areaIds, data.month);
  for (const { areaId, created } of result.perArea) {
    await logActivity({ actorId: actor.id, action: "generate", entity: "FeeBill", areaId, meta: { month: data.month, created } });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type FeeRow = {
  householdId: string;
  houseNumber: string;
  name: string;
  mobile: string | null;
  streetName: string;
  blockName: string;
  areaName: string;
  /** This month's bill. */
  amount: number;
  paidAmount: number;
  status: BillStatus;
  /** Everything still owed up to and including the selected month. */
  totalDue: number;
  dueMonths: string[];
};

export type FeesOverview = {
  month: string;
  areaId: string | null;
  organisationName: string;
  totals: { billed: number; collected: number; pending: number; percent: number; bills: number };
  /** Active households in scope with no bill for this month yet. */
  unbilled: number;
  paid: FeeRow[];
  pending: FeeRow[];
  defaulters: FeeRow[];
};

export async function getFeesOverview(input: Partial<FeesOverviewInput>): Promise<FeesOverview> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = feesOverviewSchema.parse(input);
  const month = params.month ?? monthKey();
  await connectDB();

  if (params.areaId) await loadAreaInScope(actor, params.areaId);
  // Built with ObjectIds on purpose: aggregation pipelines don't cast strings
  // the way find() does, so the string ids from scopeQueryToUserAreas would match nothing.
  const scoped: MongoFilter = params.areaId
    ? { areaId: new Types.ObjectId(params.areaId) }
    : hasAllAreaAccess(actor)
      ? {}
      : { areaId: { $in: actor.areaIds.map((id) => new Types.ObjectId(id)) } };

  const [bills, open, settings] = await Promise.all([
    FeeBill.find({ $and: [scoped, { month }] }).select("householdId amount paidAmount status").lean(),
    // Everything unpaid up to the selected month, per household (for defaulters and reminders).
    FeeBill.aggregate<{ _id: Types.ObjectId; due: number; months: string[] }>([
      { $match: { $and: [scoped, { month: { $lte: month }, status: { $in: ["unpaid", "partial"] } }] } },
      { $group: { _id: "$householdId", due: { $sum: { $subtract: ["$amount", "$paidAmount"] } }, months: { $push: "$month" } } },
    ]),
    loadSettings(),
  ]);

  const openByHousehold = new Map(open.map((row) => [row._id.toString(), row]));
  const householdIds = [...new Set([...bills.map((b) => b.householdId.toString()), ...openByHousehold.keys()])];
  const households = await Household.find({ _id: { $in: householdIds } })
    .select("houseNumber ownerName contactName mobile areaId blockId streetId")
    .lean();
  const names = await namesFor(households);
  const householdById = new Map(households.map((h) => [h._id.toString(), h]));

  const activeHouseholds = await Household.countDocuments({ $and: [scoped, { status: "active", monthlyFee: { $gt: 0 } }] });

  function row(householdId: string, bill?: { amount: number; paidAmount: number; status: BillStatus }): FeeRow | null {
    const household = householdById.get(householdId);
    if (!household) return null;
    const due = openByHousehold.get(householdId);
    return {
      householdId,
      houseNumber: household.houseNumber,
      name: household.contactName || household.ownerName,
      mobile: household.mobile ?? null,
      streetName: names.streets.get(household.streetId.toString()) ?? "",
      blockName: names.blocks.get(household.blockId.toString()) ?? "",
      areaName: names.areas.get(household.areaId.toString()) ?? "",
      amount: bill?.amount ?? 0,
      paidAmount: bill?.paidAmount ?? 0,
      status: bill?.status ?? "unpaid",
      totalDue: due?.due ?? 0,
      dueMonths: (due?.months ?? []).sort(compareMonths),
    };
  }

  const byPlace = (a: FeeRow, b: FeeRow) =>
    a.areaName.localeCompare(b.areaName) ||
    a.blockName.localeCompare(b.blockName, "en", { numeric: true }) ||
    a.streetName.localeCompare(b.streetName, "en", { numeric: true }) ||
    a.houseNumber.localeCompare(b.houseNumber, "en", { numeric: true });

  const paid: FeeRow[] = [];
  const pending: FeeRow[] = [];
  let billed = 0;
  let collected = 0;
  for (const bill of bills) {
    billed += bill.amount;
    collected += Math.min(bill.paidAmount, bill.amount);
    const item = row(bill.householdId.toString(), bill);
    if (!item) continue;
    (bill.status === "paid" ? paid : pending).push(item);
  }

  const defaulters = open
    .filter((entry) => entry.months.length >= DEFAULTER_MONTHS)
    .map((entry) => row(entry._id.toString()))
    .filter((item): item is FeeRow => item !== null)
    .sort((a, b) => b.dueMonths.length - a.dueMonths.length || b.totalDue - a.totalDue);

  return {
    month,
    areaId: params.areaId ?? null,
    organisationName: settings.organisationName,
    totals: {
      billed,
      collected,
      pending: billed - collected,
      // Whole percent, rounded down so 99.6% never shows as 100%.
      percent: billed > 0 ? Math.floor((collected * 100) / billed) : 0,
      bills: bills.length,
    },
    unbilled: Math.max(0, activeHouseholds - bills.length),
    paid: paid.sort(byPlace),
    pending: pending.sort(byPlace),
    defaulters,
  };
}

type NameMaps = { areas: Map<string, string>; blocks: Map<string, string>; streets: Map<string, string> };

export async function namesFor(
  docs: { areaId: Types.ObjectId; blockId: Types.ObjectId; streetId: Types.ObjectId }[],
): Promise<NameMaps> {
  const unique = (ids: Types.ObjectId[]) => [...new Set(ids.map((id) => id.toString()))];
  const [areas, blocks, streets] = await Promise.all([
    Area.find({ _id: { $in: unique(docs.map((d) => d.areaId)) } }).select("name").lean(),
    Block.find({ _id: { $in: unique(docs.map((d) => d.blockId)) } }).select("name").lean(),
    Street.find({ _id: { $in: unique(docs.map((d) => d.streetId)) } }).select("name").lean(),
  ]);
  const toMap = (items: { _id: Types.ObjectId; name: string }[]) => new Map(items.map((i) => [i._id.toString(), i.name]));
  return { areas: toMap(areas), blocks: toMap(blocks), streets: toMap(streets) };
}
