import { formatRupees } from "@/lib/format";
import { addMonths, compareMonths, monthLabel, monthRange } from "@/lib/months";
import type { Role } from "@/lib/roles";
import { whatsappLink } from "@/lib/whatsapp";

// Pure rules for the monthly hisaab (transparency page). No mongoose here:
// client code imports this.

/** Who sees the hisaab inside the app. Residents and committee see their own area only. */
export const HISAAB_ROLES = ["super_admin", "area_manager", "resident", "committee"] as const satisfies readonly Role[];

/** Months in the "collection vs expenses" chart, ending with the selected month. */
export const HISAAB_CHART_MONTHS = 6;

/** How far back the month picker goes. */
export const HISAAB_MAX_MONTHS = 36;

/** Most expenses listed for one month (a month normally has a few dozen). */
export const HISAAB_EXPENSE_LIMIT = 300;

/** Money in and out of an area in one month (whole rupees). */
export type MonthTotals = { month: string; collected: number; spent: number };

export type HisaabBalance = {
  opening: number;
  collected: number;
  spent: number;
  closing: number;
};

/**
 * Balance for one month. The area starts at zero; the opening balance of a
 * month is the closing balance of the month before, i.e. everything
 * collected minus everything spent before it.
 */
export function balanceFor(month: string, totals: readonly MonthTotals[]): HisaabBalance {
  let opening = 0;
  let collected = 0;
  let spent = 0;
  for (const entry of totals) {
    const order = compareMonths(entry.month, month);
    if (order < 0) opening += entry.collected - entry.spent;
    else if (order === 0) {
      collected += entry.collected;
      spent += entry.spent;
    }
  }
  return { opening, collected, spent, closing: opening + collected - spent };
}

/** The last `count` months up to and including `month`, oldest first, zero-filled. */
export function chartSeries(month: string, totals: readonly MonthTotals[], count = HISAAB_CHART_MONTHS): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>();
  for (const entry of totals) {
    const existing = byMonth.get(entry.month) ?? { month: entry.month, collected: 0, spent: 0 };
    existing.collected += entry.collected;
    existing.spent += entry.spent;
    byMonth.set(entry.month, existing);
  }
  return monthRange(addMonths(month, -(count - 1)), month).map(
    (key) => byMonth.get(key) ?? { month: key, collected: 0, spent: 0 },
  );
}

/**
 * Months the picker offers, newest first: from the area's first record (at
 * most HISAAB_MAX_MONTHS back) to the current month. Never in the future,
 * even when advance bills exist.
 */
export function hisaabMonths(firstMonth: string | null, currentMonth: string): string[] {
  const oldest = addMonths(currentMonth, -(HISAAB_MAX_MONTHS - 1));
  let from = firstMonth ?? currentMonth;
  if (compareMonths(from, oldest) < 0) from = oldest;
  if (compareMonths(from, currentMonth) > 0) from = currentMonth;
  return monthRange(from, currentMonth).reverse();
}

/** The requested month when the picker offers it, otherwise the newest one. */
export function pickHisaabMonth(requested: string | null | undefined, months: readonly string[]): string {
  if (requested && months.includes(requested)) return requested;
  return months[0] ?? requested ?? "";
}

export type CollectionSummary = {
  /** Households billed this month. */
  households: number;
  paid: number;
  partial: number;
  unpaid: number;
  billed: number;
  /** Paid towards this month's bills (never more than the bill). */
  collected: number;
  /** Whole percent of this month's fees collected, rounded down. */
  percent: number;
};

/**
 * This month's bills in numbers only: how many households paid, and how much
 * of the month's fees came in. No names or per-house amounts, so it is safe
 * to show publicly.
 */
export function collectionSummary(bills: readonly { amount: number; paidAmount: number }[]): CollectionSummary | null {
  const real = bills.filter((bill) => bill.amount > 0);
  if (real.length === 0) return null;
  const summary: CollectionSummary = { households: real.length, paid: 0, partial: 0, unpaid: 0, billed: 0, collected: 0, percent: 0 };
  for (const bill of real) {
    summary.billed += bill.amount;
    summary.collected += Math.min(bill.paidAmount, bill.amount);
    if (bill.paidAmount >= bill.amount) summary.paid += 1;
    else if (bill.paidAmount > 0) summary.partial += 1;
    else summary.unpaid += 1;
  }
  summary.percent = Math.floor((summary.collected * 100) / summary.billed);
  return summary;
}

// ---------------------------------------------------------------------------
// Public link
// ---------------------------------------------------------------------------

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 60;

/** "Bahria Town Phase 4" -> "bahria-town-phase-4". Names without Latin letters fall back to "area". */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH - 4)
    .replace(/-+$/, "");
  return slug || "area";
}

/**
 * A free slug for an area: its name, then name + city, then a number.
 * `taken` holds the slugs other areas already use.
 */
export function makeAreaSlug(name: string, city: string, taken: ReadonlySet<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  const withCity = slugify(`${name} ${city}`);
  if (!taken.has(withCity)) return withCity;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Path of the public page, e.g. "/hisaab/g-11?month=2026-10". */
export function publicHisaabPath(slug: string, month?: string): string {
  return `/hisaab/${slug}${month ? `?month=${month}` : ""}`;
}

export type HisaabMessageInput = {
  organisation: string;
  area: string;
  month: string;
  collected: number;
  spent: number;
  closing: number;
  url: string;
};

/** WhatsApp text for sharing the public hisaab, in Roman Urdu like the other messages. */
export function hisaabMessage(input: HisaabMessageInput): string {
  return [
    `Assalam-o-Alaikum! ${input.area} ka ${monthLabel(input.month)} ka hisaab:`,
    `Wusooli: ${formatRupees(input.collected)}`,
    `Kharcha: ${formatRupees(input.spent)}`,
    `Baqi raqam: ${formatRupees(input.closing)}`,
    `Poora hisaab aur receipts yahan dekhein: ${input.url}`,
    `Shukriya - ${input.organisation}`,
  ].join("\n");
}

export function hisaabWhatsappLink(input: HisaabMessageInput): string {
  return whatsappLink(hisaabMessage(input));
}
