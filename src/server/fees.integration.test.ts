/**
 * Runs against a real MongoDB when MONGODB_TEST_URI is set, e.g.
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
 * It uses (and drops) its own database "saaf_gali_vitest". Skipped otherwise.
 */
import type { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const uri = process.env.MONGODB_TEST_URI;

describe.skipIf(!uri)("fees with MongoDB", () => {
  let mongoose: typeof import("mongoose").default;
  let models: {
    Area: typeof import("@/models/Area").Area;
    Block: typeof import("@/models/Block").Block;
    Street: typeof import("@/models/Street").Street;
    Household: typeof import("@/models/Household").Household;
    FeeBill: typeof import("@/models/FeeBill").FeeBill;
    Payment: typeof import("@/models/Payment").Payment;
  };
  let generate: typeof import("./billing-core").generateBillsForAreas;
  let record: typeof import("./payments-core").recordPaymentCore;
  let cancel: typeof import("./payments-core").cancelPaymentCore;
  let areaId: Types.ObjectId;
  const cashier = "665f0000000000000000aaaa";

  beforeAll(async () => {
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = "saaf_gali_vitest";
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
    };
    await Promise.all(Object.values(models).map((model) => model.syncIndexes()));
    generate = (await import("./billing-core")).generateBillsForAreas;
    ({ recordPaymentCore: record, cancelPaymentCore: cancel } = await import("./payments-core"));

    const area = await models.Area.create({ name: "Test Town", city: "Rawalpindi", defaultMonthlyFee: 150 });
    areaId = area._id;
    const block = await models.Block.create({ areaId, name: "Block A" });
    const street = await models.Street.create({ areaId, blockId: block._id, name: "Street 1" });
    const base = { areaId, blockId: block._id, streetId: street._id, ownerName: "Test Owner", monthlyFee: 150 };
    await models.Household.create([
      { ...base, houseNumber: "1", status: "active" },
      { ...base, houseNumber: "2", status: "active", monthlyFee: 200 },
      { ...base, houseNumber: "3", status: "vacant" },
    ]);
  });

  afterAll(async () => {
    if (!mongoose) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("generates one bill per active household and nothing the second time", async () => {
    const first = await generate([areaId], "2026-08");
    expect(first.created).toBe(2);
    expect(first.notBillable).toBe(1);
    const second = await generate([areaId], "2026-08");
    expect(second.created).toBe(0);
    expect(second.alreadyBilled).toBe(2);
    expect(await models.FeeBill.countDocuments({ month: "2026-08" })).toBe(2);
  });

  it("never duplicates when two clicks arrive together", async () => {
    const results = await Promise.all([generate([areaId], "2026-09"), generate([areaId], "2026-09"), generate([areaId], "2026-09")]);
    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(2);
    expect(await models.FeeBill.countDocuments({ month: "2026-09" })).toBe(2);
  });

  it("allocates oldest first, then advance, and cancelling reverses it", async () => {
    await generate([areaId], "2026-10");
    const household = await models.Household.findOne({ houseNumber: "1" }).lean();
    if (!household) throw new Error("missing household");

    // Aug + Sep + Oct = 450 owed; pay 100 (partial on August).
    const partial = await record({ household, amount: 100, method: "cash", receivedBy: cashier, currentMonth: "2026-10" });
    expect(partial.monthsCovered).toEqual(["2026-08"]);
    expect(partial.receiptNumber).toMatch(/^SG-TES-0000\d\d$/);

    // 50 finishes August, 300 pays Sep + Oct, 175 is advance: Nov paid, Dec partial (25).
    const big = await record({ household, amount: 525, method: "jazzcash", receivedBy: cashier, currentMonth: "2026-10" });
    expect(big.monthsCovered).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    const bills = await models.FeeBill.find({ householdId: household._id }).sort({ month: 1 }).lean();
    expect(bills.map((b) => [b.month, b.paidAmount, b.status])).toEqual([
      ["2026-08", 150, "paid"],
      ["2026-09", 150, "paid"],
      ["2026-10", 150, "paid"],
      ["2026-11", 150, "paid"],
      ["2026-12", 25, "partial"],
    ]);
    expect(Number(big.receiptNumber.slice(-6))).toBe(Number(partial.receiptNumber.slice(-6)) + 1);

    await cancel({ paymentId: big._id, cancelledBy: cashier, reason: "Entered twice by mistake" });
    const after = await models.FeeBill.find({ householdId: household._id }).sort({ month: 1 }).lean();
    expect(after.map((b) => [b.month, b.paidAmount, b.status])).toEqual([
      ["2026-08", 100, "partial"],
      ["2026-09", 0, "unpaid"],
      ["2026-10", 0, "unpaid"],
      ["2026-11", 0, "unpaid"],
      ["2026-12", 0, "unpaid"],
    ]);
    const cancelled = await models.Payment.findById(big._id).lean();
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.cancelReason).toBe("Entered twice by mistake");
    await expect(cancel({ paymentId: big._id, cancelledBy: cashier, reason: "again" })).rejects.toMatchObject({
      code: "payment_already_cancelled",
    });
  });

  it("refuses advance for a vacant house", async () => {
    const vacant = await models.Household.findOne({ houseNumber: "3" }).lean();
    if (!vacant) throw new Error("missing household");
    await expect(record({ household: vacant, amount: 150, method: "cash", receivedBy: cashier, currentMonth: "2026-10" })).rejects.toMatchObject({
      code: "advance_not_allowed",
    });
  });

  it("gives every concurrent payment its own receipt number without overpaying a bill", async () => {
    const household = await models.Household.findOne({ houseNumber: "2" }).lean();
    if (!household) throw new Error("missing household");
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, () => record({ household, amount: 200, method: "cash", receivedBy: cashier, currentMonth: "2026-10" })),
    );
    const done = attempts.filter((a) => a.status === "fulfilled").map((a) => a.value);
    const numbers = done.map((p) => p.receiptNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    const bills = await models.FeeBill.find({ householdId: household._id }).lean();
    const paidInBills = bills.reduce((sum, b) => sum + b.paidAmount, 0);
    const paidInPayments = done.reduce((sum, p) => sum + p.amount, 0);
    expect(paidInBills).toBe(paidInPayments);
    expect(bills.every((b) => b.paidAmount <= b.amount)).toBe(true);
  });
});
