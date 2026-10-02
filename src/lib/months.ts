/** Billing months are strings "YYYY-MM" (Asia/Karachi). These helpers never touch Date timezones. */

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_REGEX.test(value);
}

function toIndex(month: string): number {
  const [year, mon] = month.split("-").map(Number);
  return (year ?? 0) * 12 + ((mon ?? 1) - 1);
}

function fromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/** addMonths("2026-11", 3) -> "2027-02" */
export function addMonths(month: string, count: number): string {
  return fromIndex(toIndex(month) + count);
}

/** Negative when a is earlier than b. */
export function compareMonths(a: string, b: string): number {
  return toIndex(a) - toIndex(b);
}

/** Inclusive list of months from `from` to `to`. */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let index = toIndex(from); index <= toIndex(to); index += 1) months.push(fromIndex(index));
  return months;
}

/** How many months from a to b (positive when b is later). */
export function monthsBetween(a: string, b: string): number {
  return toIndex(b) - toIndex(a);
}

const SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" -> "Oct 2026" (English; used in receipts and WhatsApp messages). */
export function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return `${SHORT_NAMES[(mon ?? 1) - 1]} ${year}`;
}

/**
 * Short list of months for messages: consecutive months are joined into a
 * range. ["2026-08","2026-09","2026-10","2026-12"] -> "Aug 2026 - Oct 2026, Dec 2026"
 */
export function describeMonths(months: string[]): string {
  const sorted = [...new Set(months)].sort(compareMonths);
  const parts: string[] = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && compareMonths(sorted[end + 1] ?? "", sorted[end] ?? "") === 1) end += 1;
    const first = monthLabel(sorted[start] ?? "");
    parts.push(start === end ? first : `${first} - ${monthLabel(sorted[end] ?? "")}`);
    start = end + 1;
  }
  return parts.join(", ");
}
