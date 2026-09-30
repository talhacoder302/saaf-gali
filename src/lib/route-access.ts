import { ROLE_HOME, SECTION_ROLES, type Role, type Section } from "@/lib/roles";

export type RouteUser = { role: Role; mustChangePassword: boolean };

export const LOGIN_PATH = "/login";
export const CHANGE_PASSWORD_PATH = "/change-password";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function sectionForPath(pathname: string): Section | null {
  const sections = Object.keys(SECTION_ROLES) as Section[];
  return sections.find((section) => matchesPrefix(pathname, section)) ?? null;
}

export function canOpenPath(role: Role, pathname: string): boolean {
  const section = sectionForPath(pathname);
  if (!section) return true;
  return (SECTION_ROLES[section] as readonly Role[]).includes(role);
}

export function homeFor(user: RouteUser): string {
  return user.mustChangePassword ? CHANGE_PASSWORD_PATH : ROLE_HOME[user.role];
}

/**
 * Decide where a request should go. Returns a path to redirect to, or null to
 * let the request through. Used by src/proxy.ts; pure so it can be unit tested.
 */
export function resolveRouteRedirect(
  pathname: string,
  search: string,
  user: RouteUser | null,
): string | null {
  if (pathname === LOGIN_PATH) {
    return user ? homeFor(user) : null;
  }

  if (pathname === CHANGE_PASSWORD_PATH) {
    if (!user) return LOGIN_PATH;
    return user.mustChangePassword ? null : ROLE_HOME[user.role];
  }

  const section = sectionForPath(pathname);
  if (!section) return null;

  if (!user) {
    const callbackUrl = encodeURIComponent(`${pathname}${search}`);
    return `${LOGIN_PATH}?callbackUrl=${callbackUrl}`;
  }
  if (user.mustChangePassword) return CHANGE_PASSWORD_PATH;
  if (!canOpenPath(user.role, pathname)) return ROLE_HOME[user.role];
  return null;
}

/**
 * Where to send a user after login. Honours callbackUrl only when it is a
 * local path the user's role may open; anything else goes to the role home.
 */
export function postLoginRedirect(user: RouteUser, callbackUrl: string | null | undefined): string {
  if (user.mustChangePassword) return CHANGE_PASSWORD_PATH;
  if (!callbackUrl || !callbackUrl.startsWith("/") || /^\/[/\\]/.test(callbackUrl)) {
    return ROLE_HOME[user.role];
  }
  const path = callbackUrl.split(/[?#]/)[0] ?? "";
  const isOwnSection = sectionForPath(path) !== null && canOpenPath(user.role, path);
  return isOwnSection ? callbackUrl : ROLE_HOME[user.role];
}
