import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { resolveRouteRedirect } from "@/lib/route-access";

// Next.js 16 renamed middleware.ts to proxy.ts. This only reads the JWT to send
// people to the right section quickly; pages and services still check the
// user against the database (src/server/session.ts, src/lib/permissions.ts).
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const sessionUser = request.auth?.user;
  const user = sessionUser?.role
    ? { role: sessionUser.role, mustChangePassword: sessionUser.mustChangePassword }
    : null;

  const target = resolveRouteRedirect(pathname, search, user);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/supervisor/:path*",
    "/worker/:path*",
    "/resident/:path*",
    "/login",
    "/change-password",
  ],
};
