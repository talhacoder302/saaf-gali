import "server-only";

import { isValidObjectId } from "mongoose";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Locale } from "@/i18n/config";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { CHANGE_PASSWORD_PATH } from "@/lib/route-access";
import { User } from "@/models/User";

export type CurrentUser = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  areaIds: string[];
  householdId: string | null;
  language: Locale;
  mustChangePassword: boolean;
};

/**
 * The signed-in user, loaded fresh from the database once per request.
 *
 * The JWT alone is not trusted for permissions: a user who was disabled, had
 * their role changed or their password reset gets a higher sessionVersion in
 * the database, and their old session stops working here immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const claims = session?.user;
  if (!claims?.id || !isValidObjectId(claims.id)) return null;

  await connectDB();
  const user = await User.findById(claims.id)
    .select("name mobile role areaIds householdId language status mustChangePassword sessionVersion")
    .lean();

  if (!user || user.status !== "active") return null;
  if ((user.sessionVersion ?? 0) !== claims.sessionVersion) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    areaIds: user.areaIds.map((id) => id.toString()),
    householdId: user.householdId?.toString() ?? null,
    language: user.language === "ur" ? "ur" : "en",
    mustChangePassword: user.mustChangePassword ?? false,
  };
});

/** Clears a stale session cookie (see src/app/logout/route.ts). */
export const EXPIRED_SESSION_PATH = "/logout?expired=1";

/**
 * For pages and layouts: the current user, or a redirect to login / the
 * password change page / the user's own home when the role does not fit.
 */
export async function requirePageUser(roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const session = await auth();
    // A cookie that the proxy trusts but the database does not: clear it,
    // otherwise /login would bounce the user straight back here.
    redirect(session?.user ? EXPIRED_SESSION_PATH : "/login");
  }
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
