"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { LOCALE_COOKIE, LOCALES } from "./config";

const localeSchema = z.enum(LOCALES);

export async function setLocale(locale: string): Promise<void> {
  const parsed = localeSchema.parse(locale);
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
