export const ROLES = [
  "super_admin",
  "area_manager",
  "supervisor",
  "worker",
  "resident",
  "committee",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Roles that use the admin panel. */
export const ADMIN_ROLES = ["super_admin", "area_manager"] as const satisfies readonly Role[];

/** Which roles may open each section of the app. */
export const SECTION_ROLES = {
  "/admin": ADMIN_ROLES,
  "/supervisor": ["supervisor"],
  "/worker": ["worker"],
  "/resident": ["resident", "committee"],
} as const satisfies Record<string, readonly Role[]>;

export type Section = keyof typeof SECTION_ROLES;

/** Where each role lands after login. */
export const ROLE_HOME: Record<Role, Section> = {
  super_admin: "/admin",
  area_manager: "/admin",
  supervisor: "/supervisor",
  worker: "/worker",
  resident: "/resident",
  committee: "/resident",
};

/** Which roles each role may create and edit on the Users page. */
export const MANAGEABLE_ROLES: Record<Role, readonly Role[]> = {
  super_admin: ROLES,
  area_manager: ["supervisor", "worker", "resident", "committee"],
  supervisor: [],
  worker: [],
  resident: [],
  committee: [],
};

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return MANAGEABLE_ROLES[actorRole].includes(targetRole);
}

/** Every role except super admin works inside one or more areas. */
export function roleNeedsArea(role: Role): boolean {
  return role !== "super_admin";
}

/** A resident belongs to exactly one area (the area of their household). */
export function roleAllowsManyAreas(role: Role): boolean {
  return role !== "resident";
}
