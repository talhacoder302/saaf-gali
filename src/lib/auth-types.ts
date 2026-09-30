import type { Locale } from "@/i18n/config";
import type { Role } from "@/lib/roles";

/** What we keep in the JWT and expose as session.user. */
export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  areaIds: string[];
  householdId: string | null;
  language: Locale;
  mustChangePassword: boolean;
  sessionVersion: number;
};

export const LOGIN_ERROR_CODES = ["invalid_credentials", "rate_limited", "account_disabled"] as const;
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];
