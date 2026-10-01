import "server-only";

import type { City } from "@/lib/areas";
import { connectDB } from "@/lib/db";
import { lookupKey, type LocationLookup } from "@/lib/household-import";
import { requireRole, scopeQueryToUserAreas, type Actor } from "@/lib/permissions";
import { ADMIN_ROLES } from "@/lib/roles";
import { compareNames, sortByName } from "@/lib/sort";
import { Area } from "@/models/Area";
import { Block } from "@/models/Block";
import { Street } from "@/models/Street";

export type StreetNode = { id: string; name: string };
export type BlockNode = { id: string; name: string; streets: StreetNode[] };
export type AreaNode = { id: string; name: string; city: City; defaultMonthlyFee: number; blocks: BlockNode[] };

/** Active areas in scope with their blocks and streets, sorted naturally. */
export async function loadLocationTree(actor: Actor): Promise<AreaNode[]> {
  await connectDB();
  const areas = await Area.find(scopeQueryToUserAreas(actor, { status: "active" }, "_id"))
    .select("name city defaultMonthlyFee")
    .lean();
  const areaIds = areas.map((area) => area._id);
  const [blocks, streets] = await Promise.all([
    Block.find({ areaId: { $in: areaIds } }).select("areaId name").lean(),
    Street.find({ areaId: { $in: areaIds } }).select("blockId name").lean(),
  ]);

  const streetsByBlock = new Map<string, StreetNode[]>();
  for (const street of streets) {
    const key = street.blockId.toString();
    const list = streetsByBlock.get(key) ?? [];
    list.push({ id: street._id.toString(), name: street.name });
    streetsByBlock.set(key, list);
  }

  const blocksByArea = new Map<string, BlockNode[]>();
  for (const block of blocks) {
    const key = block.areaId.toString();
    const list = blocksByArea.get(key) ?? [];
    list.push({ id: block._id.toString(), name: block.name, streets: sortByName(streetsByBlock.get(block._id.toString()) ?? []) });
    blocksByArea.set(key, list);
  }

  return areas
    .map((area) => ({
      id: area._id.toString(),
      name: area.name,
      city: area.city,
      defaultMonthlyFee: area.defaultMonthlyFee,
      blocks: sortByName(blocksByArea.get(area._id.toString()) ?? []),
    }))
    .sort((a, b) => compareNames(a.city, b.city) || compareNames(a.name, b.name));
}

/** For filters and household forms in the admin panel. */
export async function getLocationTree(): Promise<AreaNode[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  return loadLocationTree(actor);
}

/** The same tree keyed by lookupKey(name), for matching names in an Excel import. */
export function toLocationLookup(tree: AreaNode[]): LocationLookup {
  return new Map(
    tree.map((area) => [
      lookupKey(area.name),
      {
        id: area.id,
        defaultMonthlyFee: area.defaultMonthlyFee,
        blocks: new Map(
          area.blocks.map((block) => [
            lookupKey(block.name),
            { id: block.id, streets: new Map(block.streets.map((street) => [lookupKey(street.name), { id: street.id }])) },
          ]),
        ),
      },
    ]),
  );
}
