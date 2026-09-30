import "server-only";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, type Locale } from "./config";

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
