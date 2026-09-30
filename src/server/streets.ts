import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { requireRole, scopeQueryToUserAreas, type Actor } from "@/lib/permissions";
import { exactNameRegex } from "@/lib/regex";
import { ADMIN_ROLES } from "@/lib/roles";
import { compareNames } from "@/lib/sort";
import {
  createStreetSchema,
  updateStreetSchema,
  type StreetFormInput,
  type UpdateStreetInput,
} from "@/lib/validators/areas";
import { objectIdSchema } from "@/lib/validators/users";
import { Block } from "@/models/Block";
import { Household } from "@/models/Household";
import { Street, type StreetDoc } from "@/models/Street";
import { User } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { ServiceError } from "@/server/errors";

export type StreetLocation = { lat: number; lng: number };

export type StreetRow = {
  id: string;
  name: string;
  blockId: string;
  blockName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorActive: boolean;
  location: StreetLocation | null;
  households: number;
};

export async function listStreets(areaId: string): Promise<StreetRow[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  await connectDB();
  const area = await loadAreaInScope(actor, areaId);

  const [streets, blocks, households] = await Promise.all([
    Street.find({ areaId: area._id }).lean(),
    Block.find({ areaId: area._id }).select("name").lean(),
    Household.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { areaId: area._id } },
      { $group: { _id: "$streetId", count: { $sum: 1 } } },
    ]),
  ]);

  const blockNames = new Map(blocks.map((block) => [block._id.toString(), block.name]));
  const householdCounts = new Map(households.map((row) => [row._id.toString(), row.count]));
  const supervisorIds = [...new Set(streets.flatMap((s) => (s.supervisorId ? [s.supervisorId.toString()] : [])))];
  const supervisors = await User.find({ _id: { $in: supervisorIds } }).select("name status").lean();
  const supervisorById = new Map(supervisors.map((user) => [user._id.toString(), user]));

  return streets
    .map((street) => {
      const supervisor = street.supervisorId ? supervisorById.get(street.supervisorId.toString()) : undefined;
      return {
        id: street._id.toString(),
        name: street.name,
        blockId: street.blockId.toString(),
        blockName: blockNames.get(street.blockId.toString()) ?? "",
        supervisorId: supervisor ? supervisor._id.toString() : null,
        supervisorName: supervisor?.name ?? null,
        supervisorActive: supervisor?.status === "active",
        location: street.location ? { lat: street.location.lat, lng: street.location.lng } : null,
        households: householdCounts.get(street._id.toString()) ?? 0,
      };
    })
    .sort((a, b) => compareNames(a.blockName, b.blockName) || compareNames(a.name, b.name));
}

/** The block a street goes in: in scope and in an active area. */
async function loadBlockForStreet(actor: Actor, blockId: string) {
  const block = await Block.findOne(scopeQueryToUserAreas(actor, { _id: blockId })).lean();
  if (!block) throw new ServiceError("invalid_input", { blockId: "blockNotFound" });
  await loadAreaInScope(actor, block.areaId.toString(), { forWrite: true });
  return block;
}

async function loadStreetForWrite(actor: Actor, streetId: string): Promise<StreetDoc> {
  if (!isValidObjectId(streetId)) throw new ServiceError("not_found");
  const street = await Street.findOne(scopeQueryToUserAreas(actor, { _id: streetId })).lean();
  if (!street) throw new ServiceError("not_found");
  await loadAreaInScope(actor, street.areaId.toString(), { forWrite: true });
  return street;
}

/** A street supervisor must be an active supervisor of the street's area. */
async function assertSupervisorFits(supervisorId: string, areaId: Types.ObjectId): Promise<void> {
  const ok = await User.exists({ _id: supervisorId, role: "supervisor", status: "active", areaIds: areaId });
  if (!ok) throw new ServiceError("invalid_input", { supervisorId: "supervisorNotInArea" });
}

async function assertStreetNameFree(blockId: Types.ObjectId, name: string, exceptId?: Types.ObjectId) {
  const clash = await Street.exists({
    blockId,
    name: exactNameRegex(name),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new ServiceError("street_name_taken", { name: "streetNameTaken" });
}

export async function createStreet(input: StreetFormInput): Promise<{ id: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = createStreetSchema.parse(input);
  await connectDB();

  const block = await loadBlockForStreet(actor, data.blockId);
  if (data.supervisorId) await assertSupervisorFits(data.supervisorId, block.areaId);
  await assertStreetNameFree(block._id, data.name);

  const street = await Street.create({
    areaId: block.areaId,
    blockId: block._id,
    name: data.name,
    ...(data.supervisorId ? { supervisorId: data.supervisorId } : {}),
    ...(data.location ? { location: data.location } : {}),
  });

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "Street",
    entityId: street._id,
    areaId: block.areaId,
    meta: { name: data.name, block: block.name },
  });
  return { id: street._id.toString() };
}

export async function updateStreet(input: UpdateStreetInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateStreetSchema.parse(input);
  await connectDB();

  const street = await loadStreetForWrite(actor, data.id);
  const block = await loadBlockForStreet(actor, data.blockId);
  // Streets can move between blocks, but not to another area.
  if (!block.areaId.equals(street.areaId)) {
    throw new ServiceError("invalid_input", { blockId: "blockNotInArea" });
  }

  const supervisorChanged = (street.supervisorId?.toString() ?? null) !== data.supervisorId;
  if (supervisorChanged && data.supervisorId) await assertSupervisorFits(data.supervisorId, street.areaId);
  await assertStreetNameFree(block._id, data.name, street._id);

  const sameLocation =
    (street.location?.lat ?? null) === (data.location?.lat ?? null) &&
    (street.location?.lng ?? null) === (data.location?.lng ?? null);
  const changes = [
    street.name !== data.name && "name",
    !street.blockId.equals(block._id) && "block",
    supervisorChanged && "supervisor",
    !sameLocation && "location",
  ].filter((change): change is string => Boolean(change));
  if (changes.length === 0) return;

  const set: Record<string, unknown> = { name: data.name, blockId: block._id };
  const unset: Record<string, 1> = {};
  if (data.supervisorId) set.supervisorId = new Types.ObjectId(data.supervisorId);
  else unset.supervisorId = 1;
  if (data.location) set.location = data.location;
  else unset.location = 1;

  await Street.updateOne(
    { _id: street._id },
    Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
  );

  await logActivity({
    actorId: actor.id,
    action: supervisorChanged && changes.length === 1 ? "assign" : "update",
    entity: "Street",
    entityId: street._id,
    areaId: street.areaId,
    meta: { changes, ...(supervisorChanged ? { supervisorId: data.supervisorId } : {}) },
  });
}

/** Only streets without households can be deleted. */
export async function deleteStreet(streetId: string): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const id = objectIdSchema.parse(streetId);
  await connectDB();

  const street = await loadStreetForWrite(actor, id);
  if (await Household.exists({ streetId: street._id })) throw new ServiceError("street_has_households");
  await Street.deleteOne({ _id: street._id });

  await logActivity({
    actorId: actor.id,
    action: "delete",
    entity: "Street",
    entityId: street._id,
    areaId: street.areaId,
    meta: { name: street.name },
  });
}
