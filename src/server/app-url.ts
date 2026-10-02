import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/** Public origin of the app, e.g. "https://saafgali.pk", for links sent on WhatsApp. */
export async function getAppOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
