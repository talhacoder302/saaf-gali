import type { AreaNode, BlockNode, StreetNode } from "@/server/locations";

export type { HouseholdDetail, HouseholdList, HouseholdRow, LinkedResident } from "@/server/households";
export type { ImportPreview, ImportPreviewRow } from "@/server/household-excel";
export type { AreaNode, BlockNode, StreetNode };

export function blocksOf(tree: AreaNode[], areaId: string | null): BlockNode[] {
  return tree.find((area) => area.id === areaId)?.blocks ?? [];
}

export function streetsOf(tree: AreaNode[], areaId: string | null, blockId: string | null): StreetNode[] {
  return blocksOf(tree, areaId).find((block) => block.id === blockId)?.streets ?? [];
}

/** Where a street sits in the tree, to pre-fill the area and block pickers. */
export function locateStreet(tree: AreaNode[], streetId: string): { areaId: string; blockId: string } | null {
  for (const area of tree) {
    for (const block of area.blocks) {
      if (block.streets.some((street) => street.id === streetId)) return { areaId: area.id, blockId: block.id };
    }
  }
  return null;
}
