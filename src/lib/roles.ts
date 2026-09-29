export const ROLES = [
  "super_admin",
  "area_manager",
  "supervisor",
  "worker",
  "resident",
  "committee",
] as const;

export type Role = (typeof ROLES)[number];

/** Where each role lands after login. */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/admin",
  area_manager: "/admin",
  committee: "/admin",
  supervisor: "/supervisor",
  worker: "/worker",
  resident: "/resident",
};

/** Pakistani mobile number, e.g. 03001234567. */
export const MOBILE_REGEX = /^03\d{9}$/;
