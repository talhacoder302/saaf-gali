import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { applyClaims, authConfig } from "@/lib/auth.config";
import type { LoginErrorCode } from "@/lib/auth-types";
import { loginSchema } from "@/lib/validators/auth";
import { loadSessionUser, verifyCredentials } from "@/server/auth";

/** Carries our error code through Auth.js to the login action. */
export class LoginError extends CredentialsSignin {
  constructor(code: LoginErrorCode) {
    super();
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      // Wrong passwords are expected; don't fill the logs with them.
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { mobile: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) throw new LoginError("invalid_credentials");

        const result = await verifyCredentials(parsed.data.mobile, parsed.data.password);
        if (!result.ok) throw new LoginError(result.error);
        return result.user;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      // unstable_update() after a password, language or profile change:
      // reload the claims from the database instead of trusting the caller.
      if (params.trigger === "update" && params.token.sub) {
        const user = await loadSessionUser(params.token.sub);
        if (!user) return null;
        return applyClaims(params.token, user);
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});

/** Re-issue the session cookie with fresh claims from the database. */
export async function refreshSession(): Promise<void> {
  await unstable_update({});
}
