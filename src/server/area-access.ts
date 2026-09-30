import "server-only";

import { isValidObjectId } from "mongoose";

import { scopeQueryToUserAreas, type Actor } from "@/lib/permissions";
import { Area, type AreaDoc } from "@/models/Area";
import { ServiceError } from "@/server/errors";

/**
 * Load an area the actor may see. The area scope is part of the query, so an
 * area outside the actor's reach looks exactly like one that does not exist.
 * With `forWrite`, archived areas are refused: they are read-only.
 */
export async function loadAreaInScope(
  actor: Actor,
  areaId: string,
  options: { forWrite?: boolean } = {},
): Promise<AreaDoc> {
  if (!isValidObjectId(areaId)) throw new ServiceError("not_found");
  const area = await Area.findOne(scopeQueryToUserAreas(actor, { _id: areaId }, "_id")).lean();
  if (!area) throw new ServiceError("not_found");
  if (options.forWrite && area.status === "archived") throw new ServiceError("area_archived");
  return area;
}
