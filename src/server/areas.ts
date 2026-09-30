import "server-only";

import { connectDB } from "@/lib/db";
import { requireUser, scopeQueryToUserAreas } from "@/lib/permissions";
import { Area, type City } from "@/models/Area";

export type AreaOption = { id: string; name: string; city: City };

/** Active areas the current user may see, for pickers and filters. */
export async function listAreaOptions(): Promise<AreaOption[]> {
  const actor = await requireUser();
  await connectDB();
  const areas = await Area.find(scopeQueryToUserAreas(actor, { status: "active" }, "_id"))
    .select("name city")
    .sort({ city: 1, name: 1 })
    .lean();
  return areas.map((area) => ({ id: area._id.toString(), name: area.name, city: area.city }));
}
