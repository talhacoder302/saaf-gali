import { z } from "zod";

// Urdu keyboards type Extended Arabic-Indic digits (۰۱۲…), some phones Arabic-Indic (٠١٢…).
function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Normalise a Pakistani mobile number to 03XXXXXXXXX.
 *
 * Accepts 03XXXXXXXXX, 03XX-XXXXXXX, 3XXXXXXXXX, +92 3XX XXXXXXX,
 * 923XXXXXXXXX and 00923XXXXXXXXX. Returns null for anything else.
 */
export function normalizeMobile(input: string): string | null {
  const value = toAsciiDigits(input).trim();
  if (value === "") return null;
  // Only digits and the usual separators are allowed.
  if (!/^\+?[\d\s\-().]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, "");

  if (/^03\d{9}$/.test(digits)) return digits;
  if (/^3\d{9}$/.test(digits)) return `0${digits}`;
  if (/^923\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^00923\d{9}$/.test(digits)) return `0${digits.slice(4)}`;
  return null;
}

/** 03001234567 -> 0300-1234567 */
export function formatMobile(mobile: string): string {
  return /^03\d{9}$/.test(mobile) ? `${mobile.slice(0, 4)}-${mobile.slice(4)}` : mobile;
}

/** Like mobileSchema, but an empty value is allowed and becomes null. */
export const optionalMobileSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const mobile = normalizeMobile(value);
    if (!mobile) {
      ctx.addIssue({ code: "custom", message: "invalidMobile" });
      return z.NEVER;
    }
    return mobile;
  });

/** Zod field that accepts any supported format and outputs 03XXXXXXXXX. */
export const mobileSchema = z
  .string()
  .trim()
  .min(1, "required")
  .transform((value, ctx) => {
    const mobile = normalizeMobile(value);
    if (!mobile) {
      ctx.addIssue({ code: "custom", message: "invalidMobile" });
      return z.NEVER;
    }
    return mobile;
  });
