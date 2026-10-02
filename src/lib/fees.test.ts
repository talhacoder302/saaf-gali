import { describe, expect, it } from "vitest";

import { receiptMessage, reminderMessage } from "./fee-messages";
import {
  amountForMonths,
  billStatus,
  formatReceiptNumber,
  makeAreaCode,
  planBills,
  planPayment,
  type OpenBill,
  type PaymentPlanInput,
} from "./fees";
import { addMonths, compareMonths, describeMonths, monthLabel, monthRange } from "./months";

describe("months", () => {
  it("adds across year ends", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });

  it("compares and ranges", () => {
    expect(compareMonths("2026-09", "2026-10")).toBeLessThan(0);
    expect(monthRange("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("labels and groups months", () => {
    expect(monthLabel("2026-10")).toBe("Oct 2026");
    expect(describeMonths(["2026-10", "2026-08", "2026-09", "2026-12"])).toBe("Aug 2026 - Oct 2026, Dec 2026");
    expect(describeMonths(["2026-10"])).toBe("Oct 2026");
    expect(describeMonths([])).toBe("");
  });
});

describe("billStatus", () => {
  it("is unpaid, partial or paid", () => {
    expect(billStatus(150, 0)).toBe("unpaid");
    expect(billStatus(150, 50)).toBe("partial");
    expect(billStatus(150, 150)).toBe("paid");
  });
});

describe("planBills (generation idempotency)", () => {
  const households = [
    { id: "h1", status: "active" as const, monthlyFee: 150 },
    { id: "h2", status: "active" as const, monthlyFee: 200 },
    { id: "h3", status: "vacant" as const, monthlyFee: 150 },
    { id: "h4", status: "exempt" as const, monthlyFee: 0 },
    { id: "h5", status: "active" as const, monthlyFee: 0 },
  ];

  it("bills only active households with a fee", () => {
    const plan = planBills(households, new Set());
    expect(plan.toCreate).toEqual([
      { householdId: "h1", amount: 150 },
      { householdId: "h2", amount: 200 },
    ]);
    expect(plan.notBillable).toBe(3);
  });

  it("creates nothing when run a second time", () => {
    const first = planBills(households, new Set());
    const second = planBills(households, new Set(first.toCreate.map((bill) => bill.householdId)));
    expect(second.toCreate).toEqual([]);
    expect(second.alreadyBilled).toBe(2);
  });

  it("only adds bills for households added since the last run", () => {
    const plan = planBills([...households, { id: "h6", status: "active", monthlyFee: 100 }], new Set(["h1", "h2"]));
    expect(plan.toCreate).toEqual([{ householdId: "h6", amount: 100 }]);
  });
});

describe("planPayment (allocation)", () => {
  const bills: OpenBill[] = [
    { id: "oct", month: "2026-10", amount: 150, paidAmount: 0 },
    { id: "aug", month: "2026-08", amount: 150, paidAmount: 50 },
    { id: "sep", month: "2026-09", amount: 150, paidAmount: 0 },
  ];
  const base: PaymentPlanInput = {
    openBills: bills,
    amount: 0,
    monthlyFee: 150,
    billedMonths: new Set(["2026-08", "2026-09", "2026-10"]),
    advanceFrom: "2026-10",
    allowAdvance: true,
  };

  it("pays the oldest month first", () => {
    const plan = planPayment({ ...base, amount: 100 });
    expect(plan).toEqual({ ok: true, allocations: [{ billId: "aug", month: "2026-08", amount: 100, billAmount: 150 }] });
  });

  it("fills several months in order and leaves the last one partial", () => {
    const plan = planPayment({ ...base, amount: 200 });
    expect(plan.ok && plan.allocations).toEqual([
      { billId: "aug", month: "2026-08", amount: 100, billAmount: 150 },
      { billId: "sep", month: "2026-09", amount: 100, billAmount: 150 },
    ]);
  });

  it("clears everything owed exactly", () => {
    const plan = planPayment({ ...base, amount: 400 });
    expect(plan.ok && plan.allocations.map((a) => [a.month, a.amount])).toEqual([
      ["2026-08", 100],
      ["2026-09", 150],
      ["2026-10", 150],
    ]);
  });

  it("puts the rest into future months as advance", () => {
    const plan = planPayment({ ...base, amount: 400 + 150 * 2 + 70 });
    expect(plan.ok && plan.allocations.slice(3)).toEqual([
      { billId: null, month: "2026-11", amount: 150, billAmount: 150 },
      { billId: null, month: "2026-12", amount: 150, billAmount: 150 },
      { billId: null, month: "2027-01", amount: 70, billAmount: 150 },
    ]);
  });

  it("starts advance at the current month when it has no bill yet, skipping billed months", () => {
    const plan = planPayment({
      openBills: [],
      amount: 300,
      monthlyFee: 150,
      billedMonths: new Set(["2026-11"]),
      advanceFrom: "2026-10",
      allowAdvance: true,
    });
    expect(plan.ok && plan.allocations.map((a) => a.month)).toEqual(["2026-10", "2026-12"]);
  });

  it("refuses advance for vacant or exempt houses", () => {
    expect(planPayment({ ...base, amount: 1000, allowAdvance: false })).toEqual({ ok: false, error: "advance_not_allowed" });
  });

  it("refuses zero, negative and fractional amounts", () => {
    for (const amount of [0, -150, 150.5, Number.NaN]) {
      expect(planPayment({ ...base, amount })).toEqual({ ok: false, error: "invalid_amount" });
    }
  });

  it("caps how far ahead one payment can go", () => {
    expect(planPayment({ ...base, openBills: [], amount: 150 * 30 })).toEqual({ ok: false, error: "too_many_advance_months" });
  });

  it("never allocates more or less than the payment", () => {
    for (const amount of [1, 49, 100, 101, 399, 400, 401, 1234]) {
      const plan = planPayment({ ...base, amount });
      expect(plan.ok && plan.allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(amount);
    }
  });
});

describe("amountForMonths", () => {
  it("adds what is due on selected bills and the fee for unbilled months", () => {
    const bills: OpenBill[] = [{ id: "aug", month: "2026-08", amount: 150, paidAmount: 50 }];
    expect(amountForMonths(["2026-08", "2026-11", "2026-11"], bills, 200)).toBe(100 + 200);
  });
});

describe("receipts", () => {
  it("formats receipt numbers", () => {
    expect(formatReceiptNumber("SG", "SAT", 123)).toBe("SG-SAT-000123");
  });

  it("makes short unique area codes", () => {
    expect(makeAreaCode("Satellite Town", new Set())).toBe("SAT");
    expect(makeAreaCode("G-11", new Set())).toBe("G11");
    expect(makeAreaCode("I-8", new Set())).toBe("I8");
    expect(makeAreaCode("Bahria Enclave", new Set(["BAH"]))).toBe("BAH2");
  });

  it("writes Roman Urdu WhatsApp messages", () => {
    const receipt = receiptMessage({
      organisation: "Saaf Gali",
      name: "Ayesha",
      amount: 300,
      months: ["2026-09", "2026-10"],
      receiptNumber: "SG-SAT-000001",
      receiptUrl: "https://example.com/receipt/abc",
    });
    expect(receipt).toContain("Rs. 300 wusool ho gayi");
    expect(receipt).toContain("Sep 2026 - Oct 2026");
    expect(receipt).toContain("https://example.com/receipt/abc");
    const reminder = reminderMessage({ organisation: "Saaf Gali", name: "Ali", houseNumber: "12", street: "Street 1", amount: 450, months: ["2026-08", "2026-09", "2026-10"] });
    expect(reminder).toContain("Ghar number 12, Street 1");
    expect(reminder).toContain("Rs. 450 (Aug 2026 - Oct 2026) abhi baqi hai");
  });
});
