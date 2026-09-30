import "server-only";

import { Types } from "mongoose";

import { isTeamRole, TEAM_ROLES, type TeamRole } from "@/lib/areas";
import { connectDB } from "@/lib/db";
import { hasAllAreaAccess, PermissionError, requireRole, type Actor, type MongoFilter } from "@/lib/permissions";
import { ADMIN_ROLES, canManageRole } from "@/lib/roles";
import { sortByName } from "@/lib/sort";
import { teamMemberSchema, type TeamMemberInput } from "@/lib/validators/areas";
import { User, type UserStatus } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { ServiceError } from "@/server/errors";
import { syncUserAreaMemberships } from "@/server/team-sync";

export type TeamMember = {
  id: string;
  name: string;
  mobile: string;
  role: TeamRole;
  status: UserStatus;
};

export type TeamCandidate = { id: string; name: string; mobile: string };

export type AreaTeam = {
  members: Record<TeamRole, TeamMember[]>;
  candidates: Record<TeamRole, TeamCandidate[]>;
  /** Team roles the current user may add or remove in this area. */
  manageableRoles: TeamRole[];
};

export type SupervisorOption = { id: string; name: string };

function teamRolesFor(actor: Actor): TeamRole[] {
  return TEAM_ROLES.filter((role) => canManageRole(actor.role, role));
}

/**
 * Users an area manager can reach: people in one of their areas, or people
 * with no area at all (for example after being removed from their last one).
 */
function reachableFilter(actor: Actor): MongoFilter {
  if (hasAllAreaAccess(actor)) return {};
  return {
    $or: [{ areaIds: { $in: actor.areaIds.map((id) => new Types.ObjectId(id)) } }, { areaIds: { $size: 0 } }],
  };
}

export async function getAreaTeam(areaId: string): Promise<AreaTeam> {
  const actor = await requireRole(...ADMIN_ROLES);
  await connectDB();
  const area = await loadAreaInScope(actor, areaId);
  const manageableRoles = area.status === "active" ? teamRolesFor(actor) : [];

  const [members, candidates] = await Promise.all([
    User.find({ areaIds: area._id, role: { $in: TEAM_ROLES } })
      .select("name mobile role status")
      .lean(),
    manageableRoles.length > 0
      ? User.find({
          $and: [
            { role: { $in: manageableRoles }, status: "active", areaIds: { $ne: area._id } },
            reachableFilter(actor),
          ],
        })
          .select("name mobile role")
          .lean()
      : Promise.resolve([]),
  ]);

  const empty = (): Record<TeamRole, never[]> => ({ area_manager: [], supervisor: [], committee: [] });
  const team: AreaTeam = { members: empty(), candidates: empty(), manageableRoles };

  for (const user of members) {
    if (!isTeamRole(user.role)) continue;
    team.members[user.role].push({
      id: user._id.toString(),
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
    });
  }
  for (const user of candidates) {
    if (!isTeamRole(user.role)) continue;
    team.candidates[user.role].push({ id: user._id.toString(), name: user.name, mobile: user.mobile });
  }
  for (const role of TEAM_ROLES) {
    team.members[role] = sortByName(team.members[role]);
    team.candidates[role] = sortByName(team.candidates[role]);
  }
  return team;
}

/** Active supervisors of an area, for the street supervisor picker. */
export async function listAreaSupervisors(areaId: string): Promise<SupervisorOption[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  await connectDB();
  const area = await loadAreaInScope(actor, areaId);
  const users = await User.find({ areaIds: area._id, role: "supervisor", status: "active" }).select("name").lean();
  return sortByName(users.map((user) => ({ id: user._id.toString(), name: user.name })));
}

async function loadTeamChange(input: TeamMemberInput) {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = teamMemberSchema.parse(input);
  await connectDB();

  const area = await loadAreaInScope(actor, data.areaId, { forWrite: true });
  const user = await User.findOne({ $and: [{ _id: data.userId }, reachableFilter(actor)] })
    .select("name role areaIds status")
    .lean();
  if (!user) throw new ServiceError("not_found");
  if (!isTeamRole(user.role)) throw new ServiceError("not_team_role");
  if (!canManageRole(actor.role, user.role)) throw new PermissionError("forbidden");
  return { actor, area, user, role: user.role };
}

export async function assignTeamMember(input: TeamMemberInput): Promise<void> {
  const { actor, area, user, role } = await loadTeamChange(input);
  if (user.status !== "active") throw new ServiceError("user_disabled");
  if (user.areaIds.some((id) => id.equals(area._id))) return;

  const areaIds = [...user.areaIds, area._id];
  // New area: sign the user in again so every token carries the change.
  await User.updateOne({ _id: user._id }, { $addToSet: { areaIds: area._id }, $inc: { sessionVersion: 1 } });
  await syncUserAreaMemberships(user._id, role, areaIds);

  await logActivity({
    actorId: actor.id,
    action: "assign",
    entity: "Area",
    entityId: area._id,
    areaId: area._id,
    meta: { userId: user._id.toString(), name: user.name, role },
  });
}

export async function removeTeamMember(input: TeamMemberInput): Promise<void> {
  const { actor, area, user, role } = await loadTeamChange(input);
  if (!user.areaIds.some((id) => id.equals(area._id))) return;

  const areaIds = user.areaIds.filter((id) => !id.equals(area._id));
  await User.updateOne({ _id: user._id }, { $pull: { areaIds: area._id }, $inc: { sessionVersion: 1 } });
  // Also clears the supervisor from this area's streets.
  await syncUserAreaMemberships(user._id, role, areaIds);

  await logActivity({
    actorId: actor.id,
    action: "unassign",
    entity: "Area",
    entityId: area._id,
    areaId: area._id,
    meta: { userId: user._id.toString(), name: user.name, role },
  });
}
