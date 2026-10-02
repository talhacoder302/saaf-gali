import { describe, expect, it } from "vitest";

import {
  approvalStatusFor,
  canAddExpenses,
  canEditExpense,
  canReviewExpense,
  categoryKey,
  checkExpenseDay,
  countsAsSpent,
  isValidDay,
  summariseExpenses,
} from "@/lib/expenses";
import { dayKey, karachiDayStart } from "@/lib/format";
import { expenseFormSchema, listExpensesSchema, reviewExpenseSchema } from "@/lib/validators/expenses";
import { settingsFormSchema } from "@/lib/validators/settings";

const AREA = "a".repeat(24);
const OTHER_AREA = "b".repeat(24);

describe("approval rule", () => {
  it("approves at or below the limit and holds anything above it", () => {
    expect(approvalStatusFor(4999, 5000)).toBe("auto");
    expect(approvalStatusFor(5000, 5000)).toBe("auto");
    expect(approvalStatusFor(5001, 5000)).toBe("pending");
  });

  it("sends everything for approval when the limit is 0", () => {
    expect(approvalStatusFor(1, 0)).toBe("pending");
  });

  it("counts only auto and approved expenses as spent", () => {
    expect(countsAsSpent("auto")).toBe(true);
    expect(countsAsSpent("approved")).toBe(true);
    expect(countsAsSpent("pending")).toBe(false);
    expect(countsAsSpent("rejected")).toBe(false);
  });
});

describe("who may do what", () => {
  it("lets supervisors add expenses only when settings allow it", () => {
    expect(canAddExpenses("supervisor", false)).toBe(false);
    expect(canAddExpenses("supervisor", true)).toBe(true);
    expect(canAddExpenses("area_manager", false)).toBe(true);
    expect(canAddExpenses("super_admin", false)).toBe(true);
    expect(canAddExpenses("committee", true)).toBe(false);
    expect(canAddExpenses("worker", true)).toBe(false);
  });

  const pending = { status: "pending" as const, createdById: "creator", areaId: AREA };

  it("lets committee members review pending expenses in their own areas", () => {
    expect(canReviewExpense({ id: "c1", role: "committee", areaIds: [AREA] }, pending)).toBe(true);
    expect(canReviewExpense({ id: "c1", role: "committee", areaIds: [OTHER_AREA] }, pending)).toBe(false);
  });

  it("lets super admins review anywhere, but area managers never", () => {
    expect(canReviewExpense({ id: "s1", role: "super_admin", areaIds: [] }, pending)).toBe(true);
    expect(canReviewExpense({ id: "m1", role: "area_manager", areaIds: [AREA] }, pending)).toBe(false);
  });

  it("never lets anyone decide their own expense, or one already decided", () => {
    expect(canReviewExpense({ id: "creator", role: "super_admin", areaIds: [] }, pending)).toBe(false);
    expect(canReviewExpense({ id: "s1", role: "super_admin", areaIds: [] }, { ...pending, status: "approved" })).toBe(false);
    expect(canReviewExpense({ id: "s1", role: "super_admin", areaIds: [] }, { ...pending, status: "auto" })).toBe(false);
  });

  it("lets admins edit, area managers only in their areas", () => {
    expect(canEditExpense({ role: "super_admin", areaIds: [] }, AREA)).toBe(true);
    expect(canEditExpense({ role: "area_manager", areaIds: [AREA] }, AREA)).toBe(true);
    expect(canEditExpense({ role: "area_manager", areaIds: [AREA] }, OTHER_AREA)).toBe(false);
    expect(canEditExpense({ role: "supervisor", areaIds: [AREA] }, AREA)).toBe(false);
  });
});

describe("expense dates", () => {
  it("knows real calendar days", () => {
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("1-2-2026")).toBe(false);
  });

  it("refuses future days and days more than a year back", () => {
    expect(checkExpenseDay("2026-10-02", "2026-10-02")).toBeNull();
    expect(checkExpenseDay("2026-10-03", "2026-10-02")).toBe("dateInFuture");
    expect(checkExpenseDay("2025-10-01", "2026-10-02")).toBeNull();
    expect(checkExpenseDay("2025-09-30", "2026-10-02")).toBe("dateTooOld");
    expect(checkExpenseDay("2026-02-30", "2026-10-02")).toBe("invalidDate");
  });

  it("stores the day as Pakistan midnight and reads it back unchanged", () => {
    const date = karachiDayStart("2026-10-01");
    expect(date.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(dayKey(date)).toBe("2026-10-01");
  });
});

describe("totals", () => {
  it("adds spent, pending and rejected separately and ranks categories", () => {
    const totals = summariseExpenses([
      { status: "auto", category: "supplies", amount: 3000, count: 2 },
      { status: "approved", category: "transport", amount: 9000, count: 1 },
      { status: "auto", category: "transport", amount: 2500, count: 1 },
      { status: "pending", category: "repair", amount: 7000, count: 1 },
      { status: "rejected", category: "repair", amount: 8000, count: 1 },
    ]);
    expect(totals).toEqual({
      spent: 14500,
      pending: 7000,
      rejected: 8000,
      pendingCount: 1,
      count: 6,
      byCategory: [
        { category: "transport", amount: 11500 },
        { category: "supplies", amount: 3000 },
      ],
    });
  });

  it("is all zeros with no expenses", () => {
    expect(summariseExpenses([])).toEqual({ spent: 0, pending: 0, rejected: 0, pendingCount: 0, count: 0, byCategory: [] });
  });
});

describe("expense validators", () => {
  const valid = {
    areaId: AREA,
    category: "supplies",
    description: "Brooms, 12 pcs",
    amount: 2400,
    date: "2026-10-01",
    photoKey: null,
  };

  it("accepts a normal expense", () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true);
  });

  it("wants whole rupees above zero", () => {
    expect(expenseFormSchema.safeParse({ ...valid, amount: 0 }).error?.issues[0]?.message).toBe("amountInvalid");
    expect(expenseFormSchema.safeParse({ ...valid, amount: 99.5 }).error?.issues[0]?.message).toBe("amountWholeRupees");
    expect(expenseFormSchema.safeParse({ ...valid, amount: Number.NaN }).success).toBe(false);
  });

  it("needs an area, category and description", () => {
    const result = expenseFormSchema.safeParse({ ...valid, areaId: "", category: "", description: "x" });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["chooseArea", "chooseCategory", "descriptionTooShort"]);
  });

  it("requires a reason to reject but not to approve", () => {
    const id = AREA;
    expect(reviewExpenseSchema.safeParse({ id, decision: "approve", note: "" }).success).toBe(true);
    expect(reviewExpenseSchema.safeParse({ id, decision: "reject", note: " " }).error?.issues[0]?.message).toBe(
      "rejectNoteRequired",
    );
    expect(reviewExpenseSchema.safeParse({ id, decision: "reject", note: "Too costly" }).success).toBe(true);
  });

  it("falls back to defaults for bad list filters", () => {
    expect(listExpensesSchema.parse({ month: "2026-13", status: "paid", page: "x" })).toEqual({ page: 1 });
    expect(listExpensesSchema.parse({ month: "all", status: "pending", page: "2" })).toEqual({
      month: "all",
      status: "pending",
      page: 2,
    });
  });
});

describe("settings validator", () => {
  const valid = {
    organisationName: "Saaf Gali",
    logoKey: null,
    receiptPrefix: "sg",
    feeDueDay: 10,
    expenseApprovalLimit: 5000,
    supervisorsCanAddExpenses: true,
    expenseCategories: ["supplies", "  Pest   control "],
  };

  it("upper-cases the prefix and tidies category names", () => {
    const data = settingsFormSchema.parse(valid);
    expect(data.receiptPrefix).toBe("SG");
    expect(data.expenseCategories).toEqual(["supplies", "Pest control"]);
  });

  it("rejects bad prefixes, due days and duplicate categories", () => {
    expect(settingsFormSchema.safeParse({ ...valid, receiptPrefix: "SG-1" }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, feeDueDay: 31 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, expenseCategories: [] }).error?.issues[0]?.message).toBe(
      "categoriesRequired",
    );
    expect(
      settingsFormSchema.safeParse({ ...valid, expenseCategories: ["Fuel", "fuel "] }).error?.issues[0]?.message,
    ).toBe("categoryDuplicate");
  });

  it("compares category names ignoring case and spaces", () => {
    expect(categoryKey("  Pest   Control ")).toBe(categoryKey("pest control"));
  });
});
