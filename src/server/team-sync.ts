// No "server-only" import: scripts/seed.ts uses this too.

import { Types } from "mongoose";

import { isTeamRole, TEAM_FIELD } from "@/lib/areas";
import type { Role } from "@/lib/roles";
import { Area } from "@/models/Area";
import { Street } from "@/models/Street";

type Id = string | Types.ObjectId;

/**
 * Bring an area's team lists and street supervisors in line with a user's
 * current role and areaIds. Call after any change to a user's role or areas.
 *
 * - The user appears in managerIds / supervisorIds / committeeIds of exactly
 *   the areas in their areaIds (and only if the role belongs to a team).
 * - Streets they supervise outside their areas, or at all once they stop
 *   being a supervisor, lose their supervisor.
 */
export async function syncUserAreaMemberships(userId: Id, role: Role, areaIds: readonly Id[]): Promise<void> {
  const id = new Types.ObjectId(userId.toString());
  const areas = areaIds.map((areaId) => new Types.ObjectId(areaId.toString()));

  await Area.updateMany(
    { $or: [{ managerIds: id }, { supervisorIds: id }, { committeeIds: id }] },
    { $pull: { managerIds: id, supervisorIds: id, committeeIds: id } },
  );
  if (isTeamRole(role) && areas.length > 0) {
    await Area.updateMany({ _id: { $in: areas } }, { $addToSet: { [TEAM_FIELD[role]]: id } });
  }

  const orphaned = role === "supervisor" ? { supervisorId: id, areaId: { $nin: areas } } : { supervisorId: id };
  await Street.updateMany(orphaned, { $unset: { supervisorId: 1 } });
}
