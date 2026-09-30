import "server-only";

import { isValidObjectId, type Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { requireRole, scopeQueryToUserAreas, type Actor } from "@/lib/permissions";
import { exactNameRegex } from "@/lib/regex";
import { ADMIN_ROLES } from "@/lib/roles";
import { sortByName } from "@/lib/sort";
import {
  createBlockSchema,
  updateBlockSchema,
  type CreateBlockInput,
  type UpdateBlockInput,
} from "@/lib/validators/areas";
import { objectIdSchema } from "@/lib/validators/users";
import { Block, type BlockDoc } from "@/models/Block";
import { Household } from "@/models/Household";
import { Street } from "@/models/Street";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { ServiceError } from "@/server/errors";

export type BlockRow = {
  id: string;
  name: string;
  streets: number;
  households: number;
};

async function countBy(model: typeof Street | typeof Household, areaId: Types.ObjectId) {
  const rows = await model.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { areaId } },
    { $group: { _id: "$blockId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function listBlocks(areaId: string): Promise<BlockRow[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  await connectDB();
  const area = await loadAreaInScope(actor, areaId);

  const [blocks, streets, households] = await Promise.all([
    Block.find({ areaId: area._id }).select("name").lean(),
    countBy(Street, area._id),
    countBy(Household, area._id),
  ]);

  return sortByName(
    blocks.map((block) => ({
      id: block._id.toString(),
      name: block.name,
      streets: streets.get(block._id.toString()) ?? 0,
      households: households.get(block._id.toString()) ?? 0,
    })),
  );
}

/** A block the actor may change: in scope and in an active area. */
async function loadBlockForWrite(actor: Actor, blockId: string): Promise<BlockDoc> {
  if (!isValidObjectId(blockId)) throw new ServiceError("not_found");
  const block = await Block.findOne(scopeQueryToUserAreas(actor, { _id: blockId })).lean();
  if (!block) throw new ServiceError("not_found");
  await loadAreaInScope(actor, block.areaId.toString(), { forWrite: true });
  return block;
}

async function assertBlockNameFree(areaId: Types.ObjectId, name: string, exceptId?: Types.ObjectId) {
  const clash = await Block.exists({
    areaId,
    name: exactNameRegex(name),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new ServiceError("block_name_taken", { name: "blockNameTaken" });
}

export async function createBlock(input: CreateBlockInput): Promise<{ id: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = createBlockSchema.parse(input);
  await connectDB();

  const area = await loadAreaInScope(actor, data.areaId, { forWrite: true });
  await assertBlockNameFree(area._id, data.name);
  const block = await Block.create({ areaId: area._id, name: data.name });

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "Block",
    entityId: block._id,
    areaId: area._id,
    meta: { name: data.name },
  });
  return { id: block._id.toString() };
}

export async function updateBlock(input: UpdateBlockInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateBlockSchema.parse(input);
  await connectDB();

  const block = await loadBlockForWrite(actor, data.id);
  if (block.name === data.name) return;
  await assertBlockNameFree(block.areaId, data.name, block._id);
  await Block.updateOne({ _id: block._id }, { $set: { name: data.name } });

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Block",
    entityId: block._id,
    areaId: block.areaId,
    meta: { from: block.name, to: data.name },
  });
}

/** Only empty blocks can be deleted, so no street or house is left without a block. */
export async function deleteBlock(blockId: string): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const id = objectIdSchema.parse(blockId);
  await connectDB();

  const block = await loadBlockForWrite(actor, id);
  if (await Street.exists({ blockId: block._id })) throw new ServiceError("block_has_streets");
  await Block.deleteOne({ _id: block._id });

  await logActivity({
    actorId: actor.id,
    action: "delete",
    entity: "Block",
    entityId: block._id,
    areaId: block.areaId,
    meta: { name: block.name },
  });
}
