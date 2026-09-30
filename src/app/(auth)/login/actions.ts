"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

import { setLocaleCookie } from "@/i18n/cookie";
import type { ActionResult } from "@/lib/action-result";
import { signIn } from "@/lib/auth";
import { LOGIN_ERROR_CODES, type LoginErrorCode } from "@/lib/auth-types";
import { postLoginRedirect } from "@/lib/route-access";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { getLoginInfo } from "@/server/auth";

function toLoginError(code: string): LoginErrorCode {
  return (LOGIN_ERROR_CODES as readonly string[]).includes(code)
    ? (code as LoginErrorCode)
    : "invalid_credentials";
}

export async function loginAction(input: LoginInput, callbackUrl: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_credentials" };

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) return { ok: false, error: toLoginError(error.code) };
    if (error instanceof AuthError) {
      console.error("[login]", error);
      return { ok: false, error: "unknown" };
    }
    throw error;
  }

  const info = await getLoginInfo(parsed.data.mobile);
  if (!info) return { ok: false, error: "unknown" };

  // Show the app in the language saved on the account.
  await setLocaleCookie(info.language);
  redirect(postLoginRedirect(info, callbackUrl));
}
