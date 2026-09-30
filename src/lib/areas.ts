import type { Role } from "@/lib/roles";

// Plain constants shared by models, services and client forms (no mongoose here).

export const CITIES = ["Rawalpindi", "Islamabad"] as const;
export type City = (typeof CITIES)[number];

export const AREA_STATUSES = ["active", "archived"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

/** Tabs on the area detail page, kept in the URL as ?tab=. */
export const AREA_TABS = ["blocks", "streets", "team"] as const;
export type AreaTab = (typeof AREA_TABS)[number];

/** Roles that make up an area's team, and the Area field that lists them. */
export const TEAM_ROLES = ["area_manager", "supervisor", "committee"] as const satisfies readonly Role[];
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_FIELD = {
  area_manager: "managerIds",
  supervisor: "supervisorIds",
  committee: "committeeIds",
} as const satisfies Record<TeamRole, string>;

export function isTeamRole(role: Role): role is TeamRole {
  return (TEAM_ROLES as readonly Role[]).includes(role);
}

/** Rough box around Pakistan, to catch swapped or mistyped coordinates. */
export const PAKISTAN_BOUNDS = { minLat: 23.5, maxLat: 37.2, minLng: 60.8, maxLng: 77.9 } as const;

export function isInPakistan(lat: number, lng: number): boolean {
  return (
    lat >= PAKISTAN_BOUNDS.minLat &&
    lat <= PAKISTAN_BOUNDS.maxLat &&
    lng >= PAKISTAN_BOUNDS.minLng &&
    lng <= PAKISTAN_BOUNDS.maxLng
  );
}

/** Free map link (no API key) for a point. */
export function mapLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}
