"use server";

import type { ActionResult } from "@/lib/action-result";
import type { AreaStatus } from "@/lib/areas";
import type {
  AreaFormInput,
  CreateBlockInput,
  StreetFormInput,
  TeamMemberInput,
  UpdateAreaInput,
  UpdateBlockInput,
  UpdateStreetInput,
} from "@/lib/validators/areas";
import { assignTeamMember, removeTeamMember } from "@/server/area-team";
import { createArea, setAreaStatus, updateArea } from "@/server/areas";
import { createBlock, deleteBlock, updateBlock } from "@/server/blocks";
import { runMutation } from "@/server/run-action";
import { createStreet, deleteStreet, updateStreet } from "@/server/streets";

// Thin wrappers: every permission and area check lives in the services.

const done = async (fn: () => Promise<unknown>): Promise<null> => {
  await fn();
  return null;
};

export async function createAreaAction(input: AreaFormInput): Promise<ActionResult<{ id: string }>> {
  return runMutation(() => createArea(input));
}

export async function updateAreaAction(input: UpdateAreaInput): Promise<ActionResult<null>> {
  return runMutation(() => done(() => updateArea(input)));
}

export async function setAreaStatusAction(id: string, status: AreaStatus): Promise<ActionResult<null>> {
  return runMutation(() => done(() => setAreaStatus({ id, status })));
}

export async function createBlockAction(input: CreateBlockInput): Promise<ActionResult<{ id: string }>> {
  return runMutation(() => createBlock(input));
}

export async function updateBlockAction(input: UpdateBlockInput): Promise<ActionResult<null>> {
  return runMutation(() => done(() => updateBlock(input)));
}

export async function deleteBlockAction(id: string): Promise<ActionResult<null>> {
  return runMutation(() => done(() => deleteBlock(id)));
}

export async function createStreetAction(input: StreetFormInput): Promise<ActionResult<{ id: string }>> {
  return runMutation(() => createStreet(input));
}

export async function updateStreetAction(input: UpdateStreetInput): Promise<ActionResult<null>> {
  return runMutation(() => done(() => updateStreet(input)));
}

export async function deleteStreetAction(id: string): Promise<ActionResult<null>> {
  return runMutation(() => done(() => deleteStreet(id)));
}

export async function assignTeamMemberAction(input: TeamMemberInput): Promise<ActionResult<null>> {
  return runMutation(() => done(() => assignTeamMember(input)));
}

export async function removeTeamMemberAction(input: TeamMemberInput): Promise<ActionResult<null>> {
  return runMutation(() => done(() => removeTeamMember(input)));
}
