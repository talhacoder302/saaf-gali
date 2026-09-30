"use server";

import { z } from "zod";

import { refreshSession } from "@/lib/auth";
import { updateOwnLanguage } from "@/server/account";
import { getCurrentUser } from "@/server/session";

import { LOCALES } from "./config";
import { setLocaleCookie } from "./cookie";

const localeSchema = z.enum(LOCALES);

/**
 * Switch the interface language. Signed-in users also get it saved on their
 * account, so it follows them to other devices after the next login.
 */
export async function setLocale(locale: string): Promise<void> {
  const parsed = localeSchema.parse(locale);
  await setLocaleCookie(parsed);

  if (await getCurrentUser()) {
    await updateOwnLanguage({ language: parsed });
    await refreshSession();
  }
}
