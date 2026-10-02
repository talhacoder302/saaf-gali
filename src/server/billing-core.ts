// No "server-only" import: scripts/seed.ts and the DB integration test use this.
// Callers are responsible for permission checks (see src/server/billing.ts).

import { Types } from "mongoose";

import { makeAreaCode, planBills } from "@/lib/fees";
import { Area } from "@/models/Area";
import { FeeBill } from "@/models/FeeBill";
import { Household } from "@/models/Household";

export type GenerateResult = {
  month: string;
  created: number;
  alreadyBilled: number;
  notBillable: number;
  perArea: { areaId: string; created: number }[];
};

function upsertedCountOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const result = (error as { result?: { upsertedCount?: unknown; nUpserted?: unknown } }).result;
  if (typeof result?.upsertedCount === "number") return result.upsertedCount;
  if (typeof result?.nUpserted === "number") return result.nUpserted;
  return null;
}

/**
 * Create the month's bill for every active household in the given areas.
 * Safe to run any number of times: existing bills are skipped, and the upsert
 * on the unique (householdId, month) index stops two clicks at the same
 * moment from creating duplicates.
 */
export async function generateBillsForAreas(areaIds: Types.ObjectId[], month: string): Promise<GenerateResult> {
  const households = await Household.find({ areaId: { $in: areaIds } })
    .select("areaId blockId streetId status monthlyFee")
    .lean();
  const existing = await FeeBill.find({ month, householdId: { $in: households.map((h) => h._id) } })
    .select("householdId")
    .lean();

  const plan = planBills(
    households.map((h) => ({ id: h._id.toString(), status: h.status, monthlyFee: h.monthlyFee })),
    new Set(existing.map((bill) => bill.householdId.toString())),
  );
  const byId = new Map(households.map((h) => [h._id.toString(), h]));

  const operations = plan.toCreate.flatMap(({ householdId, amount }) => {
    const household = byId.get(householdId);
    if (!household) return [];
    return [
      {
        updateOne: {
          filter: { householdId: household._id, month },
          update: {
            $setOnInsert: {
              householdId: household._id,
              areaId: household.areaId,
              blockId: household.blockId,
              streetId: household.streetId,
              month,
              amount,
              paidAmount: 0,
              status: "unpaid" as const,
            },
          },
          upsert: true,
        },
      },
    ];
  });

  let created = 0;
  if (operations.length > 0) {
    try {
      created = (await FeeBill.bulkWrite(operations, { ordered: false })).upsertedCount;
    } catch (error) {
      // Another click created some of the same bills a moment earlier.
      const partial = upsertedCountOf(error);
      if (partial === null) throw error;
      created = partial;
    }
  }

  const perAreaCounts = new Map<string, number>();
  for (const bill of plan.toCreate) {
    const areaId = byId.get(bill.householdId)?.areaId.toString();
    if (areaId) perAreaCounts.set(areaId, (perAreaCounts.get(areaId) ?? 0) + 1);
  }

  return {
    month,
    created,
    alreadyBilled: plan.alreadyBilled + (plan.toCreate.length - created),
    notBillable: plan.notBillable,
    perArea: [...perAreaCounts].map(([areaId, count]) => ({ areaId, created: count })),
  };
}

/** The area's short receipt code, assigning one on first use. */
export async function ensureAreaCode(areaId: Types.ObjectId | string): Promise<string> {
  const id = new Types.ObjectId(areaId.toString());
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const area = await Area.findById(id).select("name code").lean();
    if (!area) throw new Error("Area not found");
    if (area.code) return area.code;

    const taken = new Set((await Area.distinct("code", { code: { $type: "string" } })).map(String));
    const code = makeAreaCode(area.name, taken);
    try {
      await Area.updateOne({ _id: id, code: { $exists: false } }, { $set: { code } });
    } catch (error) {
      // Someone else took this code at the same moment: try again with a fresh list.
      if ((error as { code?: unknown }).code !== 11000) throw error;
    }
  }
  throw new Error("Could not assign an area code");
}
