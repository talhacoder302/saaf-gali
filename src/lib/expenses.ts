import { DAY_REGEX } from "@/lib/format";
import { addMonths, compareMonths } from "@/lib/months";
import type { Role } from "@/lib/roles";

// Constants and pure rules for expenses. No mongoose here: client code imports this.

/**
 * auto: at or below the approval limit, counted straight away.
 * pending: above the limit, waiting for a committee member or super admin.
 * approved / rejected: reviewed. Rejected expenses never count in totals.
 */
export const EXPENSE_STATUSES = ["auto", "pending", "approved", "rejected"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** Categories that have a translated label. Settings may add custom ones (shown as typed). */
export const BUILT_IN_CATEGORIES = ["supplies", "repair", "fuel", "salary", "transport", "misc"] as const;
export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [...BUILT_IN_CATEGORIES];

export function isBuiltInCategory(value: string): value is BuiltInCategory {
  return (BUILT_IN_CATEGORIES as readonly string[]).includes(value);
}

/** Who may add expenses. Supervisors only when Settings allow it. */
export const EXPENSE_ADD_ROLES = ["super_admin", "area_manager", "supervisor"] as const satisfies readonly Role[];

/** Who may approve or reject expenses above the limit. */
export const EXPENSE_REVIEW_ROLES = ["super_admin", "committee"] as const satisfies readonly Role[];

export const EXPENSES_PAGE_SIZE = 25;

/** Largest single expense accepted (whole rupees). */
export const MAX_EXPENSE = 10_000_000;

/** How far back an expense date may go when it is entered. */
export const EXPENSE_BACKDATE_MONTHS = 12;

/** How many months the list's month filter offers. */
export const EXPENSE_FILTER_MONTHS = 24;

/** Above the limit needs approval; at or below it is approved automatically. */
export function approvalStatusFor(amount: number, approvalLimit: number): "auto" | "pending" {
  return amount > approvalLimit ? "pending" : "auto";
}

/** Only these statuses count as money spent (totals, hisaab). */
export function countsAsSpent(status: ExpenseStatus): boolean {
  return status === "auto" || status === "approved";
}

export function canAddExpenses(role: Role, supervisorsCanAddExpenses: boolean): boolean {
  if (role === "supervisor") return supervisorsCanAddExpenses;
  return role === "super_admin" || role === "area_manager";
}

/** A reviewer may decide pending expenses in their areas, but never their own. */
export function canReviewExpense(
  actor: { id: string; role: Role; areaIds: readonly string[] },
  expense: { status: ExpenseStatus; createdById: string; areaId: string },
): boolean {
  if (expense.status !== "pending" || expense.createdById === actor.id) return false;
  if (actor.role === "super_admin") return true;
  return actor.role === "committee" && actor.areaIds.includes(expense.areaId);
}

/** Admins edit expenses; area managers only in their own areas. */
export function canEditExpense(actor: { role: Role; areaIds: readonly string[] }, areaId: string): boolean {
  if (actor.role === "super_admin") return true;
  return actor.role === "area_manager" && actor.areaIds.includes(areaId);
}

/** A real calendar day ("2026-02-30" is not). */
export function isValidDay(day: string): boolean {
  if (!DAY_REGEX.test(day)) return false;
  const [year, month, date] = day.split("-").map(Number);
  const check = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1));
  return check.getUTCMonth() === (month ?? 1) - 1 && check.getUTCDate() === date;
}

/**
 * An expense date must not be in the future, nor more than
 * EXPENSE_BACKDATE_MONTHS months back. Returns an error key or null.
 */
export function checkExpenseDay(day: string, today: string): "invalidDate" | "dateInFuture" | "dateTooOld" | null {
  if (!isValidDay(day)) return "invalidDate";
  if (day > today) return "dateInFuture";
  const oldest = addMonths(today.slice(0, 7), -EXPENSE_BACKDATE_MONTHS);
  if (compareMonths(day.slice(0, 7), oldest) < 0) return "dateTooOld";
  return null;
}

/** Same name ignoring case and spaces, for category lists. */
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ExpenseTotals = {
  /** auto + approved */
  spent: number;
  pending: number;
  rejected: number;
  pendingCount: number;
  count: number;
  /** Spent per category, largest first. */
  byCategory: { category: string; amount: number }[];
};

/** Add up grouped amounts ({status, category, amount, count}) into the totals the list shows. */
export function summariseExpenses(
  groups: { status: ExpenseStatus; category: string; amount: number; count: number }[],
): ExpenseTotals {
  const totals: ExpenseTotals = { spent: 0, pending: 0, rejected: 0, pendingCount: 0, count: 0, byCategory: [] };
  const byCategory = new Map<string, number>();
  for (const group of groups) {
    totals.count += group.count;
    if (countsAsSpent(group.status)) {
      totals.spent += group.amount;
      byCategory.set(group.category, (byCategory.get(group.category) ?? 0) + group.amount);
    } else if (group.status === "pending") {
      totals.pending += group.amount;
      totals.pendingCount += group.count;
    } else {
      totals.rejected += group.amount;
    }
  }
  totals.byCategory = [...byCategory]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  return totals;
}

export const EXPENSE_EXCEL_COLUMNS = [
  "Date",
  "Area",
  "Category",
  "Description",
  "Amount",
  "Status",
  "Added by",
  "Reviewed by",
  "Review note",
  "Receipt photo",
] as const;
