import type { NextAuthConfig, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

import type { SessionUser } from "@/lib/auth-types";

/** Copy our claims onto the token (sign-in and session refresh). */
export function applyClaims(token: JWT, user: SessionUser | User): JWT {
  token.sub = user.id ?? token.sub;
  token.name = user.name;
  token.role = user.role;
  token.areaIds = user.areaIds;
  token.householdId = user.householdId;
  token.language = user.language;
  token.mustChangePassword = user.mustChangePassword;
  token.sessionVersion = user.sessionVersion;
  return token;
}

function sessionUserFromToken(token: JWT): SessionUser | null {
  if (!token.sub || !token.role) return null;
  return {
    id: token.sub,
    name: token.name ?? "",
    role: token.role,
    areaIds: token.areaIds ?? [],
    householdId: token.householdId ?? null,
    language: token.language ?? "en",
    mustChangePassword: token.mustChangePassword ?? false,
    sessionVersion: token.sessionVersion ?? 0,
  };
}

/**
 * Auth.js settings that need no database, shared by src/lib/auth.ts and
 * src/proxy.ts. The proxy only decodes the JWT to route requests; every
 * service re-checks the user against the database (src/server/session.ts).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // Hostinger runs the app behind its own proxy.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) applyClaims(token, user);
      return token;
    },
    session({ session, token }): Session {
      const user = sessionUserFromToken(token);
      return user ? { ...session, user } : session;
    },
  },
} satisfies NextAuthConfig;
