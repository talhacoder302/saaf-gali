import { addMonths, compareMonths } from "@/lib/months";

// Pure fee logic. Money is always whole rupees (integers); nothing here uses
// floating point maths beyond integer addition and subtraction.

export const BILL_STATUSES = ["unpaid", "partial", "paid", "exempt"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "bank", "jazzcash", "easypaisa"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["active", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Most months that can be paid in advance in one go. */
export const MAX_ADVANCE_MONTHS = 24;
/** A household with this many unpaid months (up to the selected month) is a defaulter. */
export const DEFAULTER_MONTHS = 2;

export function assertRupees(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a whole number of rupees`);
}

export function billStatus(amount: number, paidAmount: number): BillStatus {
  if (paidAmount <= 0) return "unpaid";
  return paidAmount >= amount ? "paid" : "partial";
}

export function billDue(bill: { amount: number; paidAmount: number }): number {
  return Math.max(0, bill.amount - bill.paidAmount);
}

// ---------------------------------------------------------------------------
// Bill generation
// ---------------------------------------------------------------------------

export type BillableHousehold = {
  id: string;
  status: "active" | "vacant" | "exempt";
  monthlyFee: number;
};

export type BillPlan = {
  toCreate: { householdId: string; amount: number }[];
  alreadyBilled: number;
  notBillable: number;
};

/**
 * Which households get a bill for a month. Only active households with a fee
 * above zero, and only if they don't already have a bill for that month, so
 * running it twice creates nothing the second time.
 */
export function planBills(households: BillableHousehold[], existingBillHouseholdIds: ReadonlySet<string>): BillPlan {
  const plan: BillPlan = { toCreate: [], alreadyBilled: 0, notBillable: 0 };
  for (const household of households) {
    if (household.status !== "active" || household.monthlyFee <= 0) {
      plan.notBillable += 1;
    } else if (existingBillHouseholdIds.has(household.id)) {
      plan.alreadyBilled += 1;
    } else {
      plan.toCreate.push({ householdId: household.id, amount: household.monthlyFee });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Payment allocation
// ---------------------------------------------------------------------------

export type OpenBill = { id: string; month: string; amount: number; paidAmount: number };

export type Allocation = {
  /** null for a bill that has to be created (advance payment). */
  billId: string | null;
  month: string;
  /** Rupees of this payment that go to this bill. */
  amount: number;
  /** The bill's total amount (for new bills: the household's monthly fee). */
  billAmount: number;
};

export type PaymentPlanInput = {
  /** Unpaid and partly paid bills, any order. */
  openBills: OpenBill[];
  amount: number;
  /** Fee for months that have no bill yet (advance). */
  monthlyFee: number;
  /** Months that already have a bill (paid or not); advance never re-bills them. */
  billedMonths: ReadonlySet<string>;
  /** Advance bills start at this month (normally the current month). */
  advanceFrom: string;
  /** Whether months without a bill may be created (false for vacant/exempt houses). */
  allowAdvance: boolean;
};

export type PaymentPlanError = "invalid_amount" | "advance_not_allowed" | "too_many_advance_months";

export type PaymentPlan = { ok: true; allocations: Allocation[] } | { ok: false; error: PaymentPlanError };

/**
 * Spread a payment over bills: oldest unpaid month first, then (advance)
 * months that have no bill yet, from `advanceFrom` onwards. A remainder that
 * doesn't cover a full month leaves the last bill partly paid.
 */
export function planPayment(input: PaymentPlanInput): PaymentPlan {
  const { amount, monthlyFee } = input;
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "invalid_amount" };

  const allocations: Allocation[] = [];
  let remaining = amount;

  const oldestFirst = [...input.openBills].sort((a, b) => compareMonths(a.month, b.month));
  for (const bill of oldestFirst) {
    if (remaining === 0) break;
    const due = billDue(bill);
    if (due === 0) continue;
    const take = Math.min(due, remaining);
    allocations.push({ billId: bill.id, month: bill.month, amount: take, billAmount: bill.amount });
    remaining -= take;
  }

  if (remaining > 0) {
    if (!input.allowAdvance || monthlyFee <= 0) return { ok: false, error: "advance_not_allowed" };
    let month = input.advanceFrom;
    let created = 0;
    while (remaining > 0) {
      while (input.billedMonths.has(month)) month = addMonths(month, 1);
      created += 1;
      if (created > MAX_ADVANCE_MONTHS) return { ok: false, error: "too_many_advance_months" };
      const take = Math.min(monthlyFee, remaining);
      allocations.push({ billId: null, month, amount: take, billAmount: monthlyFee });
      remaining -= take;
      month = addMonths(month, 1);
    }
  }

  return { ok: true, allocations };
}

/**
 * The amount for paying exactly the given months: what is still due on their
 * bills, plus the monthly fee for months that have no bill yet.
 */
export function amountForMonths(months: string[], openBills: OpenBill[], monthlyFee: number): number {
  const byMonth = new Map(openBills.map((bill) => [bill.month, bill]));
  let total = 0;
  for (const month of new Set(months)) {
    const bill = byMonth.get(month);
    total += bill ? billDue(bill) : monthlyFee;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Receipt numbers
// ---------------------------------------------------------------------------

/** "SG", "SAT", 123 -> "SG-SAT-000123" */
export function formatReceiptNumber(prefix: string, areaCode: string, sequence: number): string {
  return `${prefix}-${areaCode}-${String(sequence).padStart(6, "0")}`;
}

/**
 * A short code for an area, used in receipt numbers: letters and digits of
 * the name, first word's first 3 letters ("Satellite Town" -> "SAT",
 * "G-11" -> "G11", "I-8" -> "I8"). Adds a number if the code is taken.
 */
export function makeAreaCode(name: string, taken: ReadonlySet<string>): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0] ?? "AREA";
  const base = /\d/.test(first) ? first.slice(0, 4) : first.slice(0, 3);
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
