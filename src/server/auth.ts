import "server-only";

import { isValidObjectId } from "mongoose";

import { isLocale } from "@/i18n/config";
import type { LoginErrorCode, SessionUser } from "@/lib/auth-types";
import { connectDB } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { logActivity } from "@/server/activity";
import { LOGIN_WINDOW_SECONDS, LoginAttempt, MAX_FAILED_LOGINS } from "@/models/LoginAttempt";
import { User, type UserDoc } from "@/models/User";

type ClaimSource = Pick<
  UserDoc,
  "_id" | "name" | "role" | "areaIds" | "householdId" | "language" | "mustChangePassword" | "sessionVersion"
>;

const CLAIM_FIELDS = "name role areaIds householdId language mustChangePassword sessionVersion status";

export function toSessionUser(user: ClaimSource): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
    areaIds: user.areaIds.map((id) => id.toString()),
    householdId: user.householdId?.toString() ?? null,
    language: isLocale(user.language) ? user.language : "en",
    mustChangePassword: user.mustChangePassword ?? false,
    sessionVersion: user.sessionVersion ?? 0,
  };
}

async function recentFailures(mobile: string): Promise<number> {
  const since = new Date(Date.now() - LOGIN_WINDOW_SECONDS * 1000);
  return LoginAttempt.countDocuments({ mobile, createdAt: { $gte: since } });
}

async function recordFailure(mobile: string): Promise<void> {
  await LoginAttempt.create({ mobile });
}

export async function clearFailedLogins(mobile: string): Promise<void> {
  await connectDB();
  await LoginAttempt.deleteMany({ mobile });
}

export type VerifyResult = { ok: true; user: SessionUser } | { ok: false; error: LoginErrorCode };

/**
 * Check a mobile + password. Allows MAX_FAILED_LOGINS failures per mobile in
 * LOGIN_WINDOW_SECONDS, then refuses until the window passes.
 */
export async function verifyCredentials(mobile: string, password: string): Promise<VerifyResult> {
  await connectDB();

  if ((await recentFailures(mobile)) >= MAX_FAILED_LOGINS) {
    return { ok: false, error: "rate_limited" };
  }

  const user = await User.findOne({ mobile }).select(`+passwordHash ${CLAIM_FIELDS}`).lean();
  if (!user) {
    await burnPasswordCheck(password);
    await recordFailure(mobile);
    return { ok: false, error: "invalid_credentials" };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailure(mobile);
    return { ok: false, error: "invalid_credentials" };
  }

  // Only reveal that the account is disabled once the password was right.
  if (user.status !== "active") return { ok: false, error: "account_disabled" };

  await LoginAttempt.deleteMany({ mobile });
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  await logActivity({ actorId: user._id, action: "login", entity: "User", entityId: user._id });

  return { ok: true, user: toSessionUser(user) };
}

/** Fresh claims for an active user, or null if the user is gone or disabled. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  if (!isValidObjectId(userId)) return null;
  await connectDB();
  const user = await User.findById(userId).select(CLAIM_FIELDS).lean();
  if (!user || user.status !== "active") return null;
  return toSessionUser(user);
}

/** Used right after login to pick the landing page and language. */
export async function getLoginInfo(
  mobile: string,
): Promise<{ role: Role; mustChangePassword: boolean; language: SessionUser["language"] } | null> {
  await connectDB();
  const user = await User.findOne({ mobile, status: "active" })
    .select("role mustChangePassword language")
    .lean();
  if (!user) return null;
  return {
    role: user.role,
    mustChangePassword: user.mustChangePassword ?? false,
    language: isLocale(user.language) ? user.language : "en",
  };
}
