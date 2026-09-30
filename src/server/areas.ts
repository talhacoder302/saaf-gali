import "server-only";

import { isValidObjectId, type Types } from "mongoose";

import type { AreaStatus, City } from "@/lib/areas";
import { connectDB } from "@/lib/db";
import { requireRole, requireUser, scopeQueryToUserAreas, type MongoFilter } from "@/lib/permissions";
import { escapeRegex, exactNameRegex } from "@/lib/regex";
import { ADMIN_ROLES } from "@/lib/roles";
import {
  areaFormSchema,
  listAreasSchema,
  setAreaStatusSchema,
  updateAreaSchema,
  type AreaFormInput,
  type ListAreasInput,
  type UpdateAreaInput,
} from "@/lib/validators/areas";
import { Area } from "@/models/Area";
import { Block } from "@/models/Block";
import { Household } from "@/models/Household";
import { Street } from "@/models/Street";
import { User } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { ServiceError } from "@/server/errors";

export type AreaOption = { id: string; name: string; city: City };

export type AreaCounts = { blocks: number; streets: number; households: number };

export type AreaListRow = AreaCounts & {
  id: string;
  name: string;
  city: City;
  description: string;
  defaultMonthlyFee: number;
  status: AreaStatus;
  managerNames: string[];
  supervisorCount: number;
};

export type AreaDetail = AreaCounts & {
  id: string;
  name: string;
  city: City;
  description: string;
  defaultMonthlyFee: number;
  status: AreaStatus;
};

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

/** Blocks, streets and households per area, in three grouped queries. */
async function countsByArea(areaIds: Types.ObjectId[]): Promise<Map<string, AreaCounts>> {
  const group = [{ $match: { areaId: { $in: areaIds } } }, { $group: { _id: "$areaId", count: { $sum: 1 } } }];
  const [blocks, streets, households] = await Promise.all([
    Block.aggregate<{ _id: Types.ObjectId; count: number }>(group),
    Street.aggregate<{ _id: Types.ObjectId; count: number }>(group),
    Household.aggregate<{ _id: Types.ObjectId; count: number }>(group),
  ]);

  const counts = new Map<string, AreaCounts>();
  const get = (id: Types.ObjectId) => {
    const key = id.toString();
    const existing = counts.get(key) ?? { blocks: 0, streets: 0, households: 0 };
    counts.set(key, existing);
    return existing;
  };
  for (const row of blocks) get(row._id).blocks = row.count;
  for (const row of streets) get(row._id).streets = row.count;
  for (const row of households) get(row._id).households = row.count;
  return counts;
}

const NO_COUNTS: AreaCounts = { blocks: 0, streets: 0, households: 0 };

export async function listAreas(input: Partial<ListAreasInput>): Promise<AreaListRow[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listAreasSchema.parse(input);
  await connectDB();

  const filter: MongoFilter = { status: params.status };
  if (params.q) {
    const text = new RegExp(escapeRegex(params.q), "i");
    filter.$or = [{ name: text }, { description: text }];
  }

  const areas = await Area.find(scopeQueryToUserAreas(actor, filter, "_id")).sort({ city: 1, name: 1 }).lean();
  const counts = await countsByArea(areas.map((area) => area._id));

  const managerIds = [...new Set(areas.flatMap((area) => area.managerIds.map((id) => id.toString())))];
  const managers = await User.find({ _id: { $in: managerIds } }).select("name").lean();
  const managerNames = new Map(managers.map((user) => [user._id.toString(), user.name]));

  return areas.map((area) => ({
    id: area._id.toString(),
    name: area.name,
    city: area.city,
    description: area.description ?? "",
    defaultMonthlyFee: area.defaultMonthlyFee,
    status: area.status,
    managerNames: area.managerIds
      .map((id) => managerNames.get(id.toString()))
      .filter((name): name is string => Boolean(name)),
    supervisorCount: area.supervisorIds.length,
    ...(counts.get(area._id.toString()) ?? NO_COUNTS),
  }));
}

/** One area with its counts, or null when it does not exist or is out of scope. */
export async function getAreaDetail(areaId: string): Promise<AreaDetail | null> {
  const actor = await requireRole(...ADMIN_ROLES);
  if (!isValidObjectId(areaId)) return null;
  await connectDB();

  const area = await Area.findOne(scopeQueryToUserAreas(actor, { _id: areaId }, "_id")).lean();
  if (!area) return null;
  const counts = await countsByArea([area._id]);

  return {
    id: area._id.toString(),
    name: area.name,
    city: area.city,
    description: area.description ?? "",
    defaultMonthlyFee: area.defaultMonthlyFee,
    status: area.status,
    ...(counts.get(area._id.toString()) ?? NO_COUNTS),
  };
}

async function assertAreaNameFree(city: City, name: string, exceptId?: Types.ObjectId): Promise<void> {
  const clash = await Area.exists({
    city,
    name: exactNameRegex(name),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new ServiceError("area_name_taken", { name: "areaNameTaken" });
}

/** Only super admins create areas; area managers are then assigned to them. */
export async function createArea(input: AreaFormInput): Promise<{ id: string }> {
  const actor = await requireRole("super_admin");
  const data = areaFormSchema.parse(input);
  await connectDB();

  await assertAreaNameFree(data.city, data.name);
  const area = await Area.create({ ...data, description: data.description || undefined });

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "Area",
    entityId: area._id,
    areaId: area._id,
    meta: { name: data.name, city: data.city },
  });
  return { id: area._id.toString() };
}

export async function updateArea(input: UpdateAreaInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateAreaSchema.parse(input);
  await connectDB();

  const area = await loadAreaInScope(actor, data.id, { forWrite: true });
  await assertAreaNameFree(data.city, data.name, area._id);

  const changes = [
    data.name !== area.name && "name",
    data.city !== area.city && "city",
    data.description !== (area.description ?? "") && "description",
    data.defaultMonthlyFee !== area.defaultMonthlyFee && "defaultMonthlyFee",
  ].filter((change): change is string => Boolean(change));
  if (changes.length === 0) return;

  const set = { name: data.name, city: data.city, defaultMonthlyFee: data.defaultMonthlyFee };
  await Area.updateOne(
    { _id: area._id },
    data.description
      ? { $set: { ...set, description: data.description } }
      : { $set: set, $unset: { description: 1 } },
  );

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Area",
    entityId: area._id,
    areaId: area._id,
    meta: {
      changes,
      ...(changes.includes("defaultMonthlyFee")
        ? { fromFee: area.defaultMonthlyFee, toFee: data.defaultMonthlyFee }
        : {}),
    },
  });
}

/** Archive or restore. Archived areas disappear from pickers and become read-only. */
export async function setAreaStatus(input: { id: string; status: AreaStatus }): Promise<void> {
  const actor = await requireRole("super_admin");
  const data = setAreaStatusSchema.parse(input);
  await connectDB();

  const area = await loadAreaInScope(actor, data.id);
  if (area.status === data.status) return;
  await Area.updateOne({ _id: area._id }, { $set: { status: data.status } });

  await logActivity({
    actorId: actor.id,
    action: data.status === "archived" ? "archive" : "restore",
    entity: "Area",
    entityId: area._id,
    areaId: area._id,
  });
}
