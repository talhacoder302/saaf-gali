/**
 * Runs against a real MongoDB when MONGODB_TEST_URI is set, e.g.
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
 * It uses (and drops) its own database "saaf_gali_vitest_hisaab". Skipped otherwise.
 */
import { randomBytes } from "node:crypto";

import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ExpenseStatus } from "@/lib/expenses";
import type { BillStatus } from "@/lib/fees";

const uri = process.env.MONGODB_TEST_URI;

describe.skipIf(!uri)("hisaab with MongoDB", () => {
  let mongoose: typeof import("mongoose").default;
  let models: {
    Area: typeof import("@/models/Area").Area;
    Block: typeof import("@/models/Block").Block;
    Street: typeof import("@/models/Street").Street;
    Household: typeof import("@/models/Household").Household;
    FeeBill: typeof import("@/models/FeeBill").FeeBill;
    Payment: typeof import("@/models/Payment").Payment;
    Expense: typeof import("@/models/Expense").Expense;
  };
  let core: typeof import("./hisaab-core");
  let area: import("@/models/Area").AreaDoc;
  let otherAreaId: Types.ObjectId;
  let householdIds: Types.ObjectId[];
  let streetId: Types.ObjectId;
  let blockId: Types.ObjectId;
  const userId = new Types.ObjectId();
  const noPhotos = async (key: string | null | undefined) => (key ? `https://photos.test/${key}` : null);

  async function pay(amount: number, paidAt: string, options: { status?: "active" | "cancelled"; areaId?: Types.ObjectId } = {}) {
    await models.Payment.create({
      householdId: householdIds[0],
      areaId: options.areaId ?? area._id,
      streetId,
      amount,
      method: "cash",
      receivedBy: userId,
      receiptNumber: `T-${randomBytes(6).toString("hex")}`,
      publicToken: randomBytes(16).toString("hex"),
      paidAt: new Date(paidAt),
      status: options.status ?? "active",
    });
  }

  async function spend(amount: number, day: string, approvalStatus: ExpenseStatus, extra: Record<string, unknown> = {}) {
    await models.Expense.create({
      areaId: area._id,
      category: "supplies",
      description: `Spent ${amount} on ${day}`,
      amount,
      date: new Date(`${day}T00:00:00+05:00`),
      month: day.slice(0, 7),
      createdBy: userId,
      approvalStatus,
      ...extra,
    });
  }

  beforeAll(async () => {
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = "saaf_gali_vitest_hisaab";
    const db = await import("@/lib/db");
    mongoose = await db.connectDB();
    await mongoose.connection.dropDatabase();

    models = {
      Area: (await import("@/models/Area")).Area,
      Block: (await import("@/models/Block")).Block,
      Street: (await import("@/models/Street")).Street,
      Household: (await import("@/models/Household")).Household,
      FeeBill: (await import("@/models/FeeBill")).FeeBill,
      Payment: (await import("@/models/Payment")).Payment,
      Expense: (await import("@/models/Expense")).Expense,
    };
    await Promise.all(Object.values(models).map((model) => model.syncIndexes()));
    core = await import("./hisaab-core");

    const created = await models.Area.create({ name: "Saddar", city: "Rawalpindi", defaultMonthlyFee: 150 });
    area = created.toObject();
    otherAreaId = (await models.Area.create({ name: "Saddar", city: "Islamabad", defaultMonthlyFee: 150 }))._id;
    blockId = (await models.Block.create({ areaId: area._id, name: "Block A" }))._id;
    streetId = (await models.Street.create({ areaId: area._id, blockId, name: "Street 1" }))._id;
    const base = { areaId: area._id, blockId, streetId, ownerName: "Owner", monthlyFee: 150, status: "active" as const };
    const households = await models.Household.create([1, 2, 3, 4].map((n) => ({ ...base, houseNumber: String(n) })));
    householdIds = households.map((household) => household._id);

    // August: 3,000 in, 1,000 spent (+ a rejected one that must not count).
    await pay(3_000, "2026-08-10T06:00:00Z");
    await spend(1_000, "2026-08-12", "auto");
    await spend(9_000, "2026-08-20", "rejected");
    // Paid at 00:30 on 1 September in Pakistan (still 31 August in UTC): a September payment.
    await pay(500, "2026-08-31T19:30:00Z");
    // September: a cancelled payment and another area's payment never count.
    await pay(2_000, "2026-09-05T06:00:00Z", { status: "cancelled" });
    await pay(7_777, "2026-09-05T06:00:00Z", { areaId: otherAreaId });
    await spend(6_000, "2026-09-15", "approved", { receiptPhotoKey: "expense-receipts/u/1.jpg" });
    await spend(8_000, "2026-09-18", "pending");
    await spend(200, "2026-09-02", "auto");
    // October.
    await pay(1_200, "2026-10-03T06:00:00Z");

    const bill = (householdId: Types.ObjectId, amount: number, paidAmount: number, status: BillStatus) => ({
      householdId,
      areaId: area._id,
      blockId,
      streetId,
      month: "2026-09",
      amount,
      paidAmount,
      status,
    });
    await models.FeeBill.create([
      bill(householdIds[0]!, 150, 150, "paid"),
      bill(householdIds[1]!, 150, 100, "partial"),
      bill(householdIds[2]!, 150, 0, "unpaid"),
      bill(householdIds[3]!, 150, 0, "exempt"),
    ]);
  });

  afterAll(async () => {
    if (!mongoose) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("buckets payments by the Pakistan month and skips cancelled ones and other areas", async () => {
    const august = await core.buildAreaHisaab(area, "2026-08", noPhotos, "2026-10");
    expect(august.balance).toEqual({ opening: 0, collected: 3_000, spent: 1_000, closing: 2_000 });

    const september = await core.buildAreaHisaab(area, "2026-09", noPhotos, "2026-10");
    expect(september.balance.collected).toBe(500);
  });

  it("opens each month with the previous closing balance and counts only auto and approved expenses", async () => {
    const september = await core.buildAreaHisaab(area, "2026-09", noPhotos, "2026-10");
    expect(september.balance).toEqual({ opening: 2_000, collected: 500, spent: 6_200, closing: -3_700 });
    expect(september.pending).toEqual({ count: 1, amount: 8_000 });
    expect(september.byCategory).toEqual([{ category: "supplies", amount: 6_200 }]);

    const october = await core.buildAreaHisaab(area, "2026-10", noPhotos, "2026-10");
    expect(october.balance.opening).toBe(september.balance.closing);
    expect(october.balance.closing).toBe(-2_500);
  });

  it("lists approved expenses oldest first with photo links, never pending or rejected ones", async () => {
    const september = await core.buildAreaHisaab(area, "2026-09", noPhotos, "2026-10");
    expect(september.expenses.map((expense) => expense.amount)).toEqual([200, 6_000]);
    expect(september.expenses[1]).toMatchObject({ day: "2026-09-15", hasPhoto: true, photoUrl: "https://photos.test/expense-receipts/u/1.jpg" });
    expect(september.expenses[0]).toMatchObject({ hasPhoto: false, photoUrl: null });
  });

  it("summarises collection without exempt bills and without any household details", async () => {
    const september = await core.buildAreaHisaab(area, "2026-09", noPhotos, "2026-10");
    expect(september.collection).toEqual({ households: 3, paid: 1, partial: 1, unpaid: 1, billed: 450, collected: 250, percent: 55 });
    expect(JSON.stringify(september)).not.toContain("Owner");

    const october = await core.buildAreaHisaab(area, "2026-10", noPhotos, "2026-10");
    expect(october.collection).toBeNull();
  });

  it("offers months from the first record to now and falls back to the newest", async () => {
    const hisaab = await core.buildAreaHisaab(area, "2031-01", noPhotos, "2026-10");
    expect(hisaab.month).toBe("2026-10");
    expect(hisaab.months).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(hisaab.chart.map((entry) => entry.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(hisaab.chart.at(-2)).toEqual({ month: "2026-09", collected: 500, spent: 6_200 });
  });

  it("gives areas with the same name different slugs and keeps them", async () => {
    const [first, again] = await Promise.all([core.ensureAreaSlug(area._id), core.ensureAreaSlug(area._id)]);
    expect(first).toBe("saddar");
    expect(again).toBe("saddar");
    expect(await core.ensureAreaSlug(otherAreaId)).toBe("saddar-islamabad");
    await models.Area.updateOne({ _id: area._id }, { $set: { name: "Saddar Bazaar" } });
    expect(await core.ensureAreaSlug(area._id)).toBe("saddar");
  });
});
