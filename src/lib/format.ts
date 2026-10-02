import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const TIMEZONE = "Asia/Karachi";

/** The given moment as a date in Pakistan time. */
export function toKarachi(date: Date | number = Date.now()): TZDate {
  return new TZDate(typeof date === "number" ? date : date.getTime(), TIMEZONE);
}

/** Month key used on fee bills and salaries, e.g. "2026-09". */
export function monthKey(date: Date | number = Date.now()): string {
  return format(toKarachi(date), "yyyy-MM");
}

/** A calendar day as "YYYY-MM-DD". */
export const DAY_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Day key in Pakistan time, e.g. "2026-09-29" (used by date inputs). */
export function dayKey(date: Date | number = Date.now()): string {
  return format(toKarachi(date), "yyyy-MM-dd");
}

/** Midnight in Pakistan at the start of a "YYYY-MM-DD" day. Pakistan has no DST. */
export function karachiDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+05:00`);
}

/** Format a date in Pakistan time, e.g. "29 Sep 2026". */
export function formatDate(date: Date | number, pattern = "d MMM yyyy"): string {
  return format(toKarachi(date), pattern);
}

const rupeeFormatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** Money is stored as whole rupees. formatRupees(1500) -> "Rs. 1,500" */
export function formatRupees(amount: number): string {
  return `Rs. ${rupeeFormatter.format(Math.round(amount))}`;
}
