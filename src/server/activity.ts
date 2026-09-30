import "server-only";

import type { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { ActivityLog, type ActivityAction } from "@/models/ActivityLog";

type Id = string | Types.ObjectId;

export type ActivityEntry = {
  actorId: Id;
  action: ActivityAction;
  entity: string;
  entityId?: Id;
  areaId?: Id | null;
  meta?: Record<string, unknown>;
};

/** Record who did what. Call after every create, update, delete, approve and payment. */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  await connectDB();
  await ActivityLog.create({ ...entry, areaId: entry.areaId ?? undefined });
}
