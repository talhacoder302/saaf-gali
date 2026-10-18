import "server-only";

import type { City } from "@/lib/areas";
import { connectDB } from "@/lib/db";
import { HISAAB_ROLES, publicHisaabPath } from "@/lib/hisaab";
import { requireRole, scopeQueryToUserAreas } from "@/lib/permissions";
import { areaSlugSchema, hisaabQuerySchema, publicHisaabQuerySchema, type HisaabQuery } from "@/lib/validators/hisaab";
import { Area } from "@/models/Area";
import { getAppOrigin } from "@/server/app-url";
import { buildAreaHisaab, type AreaHisaab } from "@/server/hisaab-core";
import { loadSettings } from "@/server/settings";
import { photoUrl } from "@/server/storage";

export type { AreaHisaab, HisaabExpense } from "@/server/hisaab-core";

/** A hisaab with what every screen around it needs (organisation name, logo). */
export type HisaabView = AreaHisaab & { organisationName: string; logoUrl: string | null };

export type HisaabPicker = { id: string; name: string; city: City; archived: boolean }[];

async function withOrganisation(hisaab: AreaHisaab): Promise<HisaabView> {
  const settings = await loadSettings();
  return { ...hisaab, organisationName: settings.organisationName, logoUrl: await photoUrl(settings.logoKey) };
}

/**
 * The hisaab inside the app. Admins pick any area in scope; residents and
 * committee members see only their own area(s). `hisaab` is null when the
 * requested area is missing or out of scope (the page 404s), or when the
 * user has no area at all (`areas` is then empty).
 */
export async function getHisaab(input: Partial<HisaabQuery>): Promise<{ areas: HisaabPicker; hisaab: HisaabView | null }> {
  const actor = await requireRole(...HISAAB_ROLES);
  const query = hisaabQuerySchema.parse(input);
  await connectDB();

  // Archived areas too: their history stays readable.
  const areas = await Area.find(scopeQueryToUserAreas(actor, {}, "_id"))
    .select("name city slug publicHisaab status")
    .sort({ status: 1, city: 1, name: 1 })
    .lean();
  const picker = areas.map((area) => ({
    id: area._id.toString(),
    name: area.name,
    city: area.city,
    archived: area.status === "archived",
  }));

  const area = query.area ? areas.find((item) => item._id.toString() === query.area) : areas[0];
  if (!area) return { areas: picker, hisaab: null };
  return { areas: picker, hisaab: await withOrganisation(await buildAreaHisaab(area, query.month, photoUrl)) };
}

/**
 * The public hisaab behind /hisaab/<slug>. No login: only areas whose admin
 * switched the link on, and only while the area is active. Null otherwise,
 * exactly like a slug that does not exist.
 */
export async function getPublicHisaab(slug: string, input: { month?: unknown }): Promise<HisaabView | null> {
  const parsed = areaSlugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const { month } = publicHisaabQuerySchema.parse(input);
  await connectDB();

  const area = await Area.findOne({ slug: parsed.data, publicHisaab: true, status: "active" })
    .select("name city slug publicHisaab status")
    .lean();
  if (!area) return null;
  return withOrganisation(await buildAreaHisaab(area, month, photoUrl));
}

/** Absolute public link for this hisaab's month, or null while the link is off (or the area archived). */
export async function publicHisaabUrl(hisaab: AreaHisaab): Promise<string | null> {
  const { slug, publicHisaab, archived } = hisaab.area;
  if (!slug || !publicHisaab || archived) return null;
  return `${await getAppOrigin()}${publicHisaabPath(slug, hisaab.month)}`;
}
