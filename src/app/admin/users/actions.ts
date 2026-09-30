"use server";

import { refresh } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from "@/lib/validators/users";
import type { UserStatus } from "@/models/User";
import { runAction } from "@/server/run-action";
import { createUser, resetUserPassword, setUserStatus, updateUser } from "@/server/users";

// Thin wrappers: every permission and area check lives in src/server/users.ts.

export async function createUserAction(input: CreateUserInput): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(() => createUser(input));
  if (result.ok) refresh();
  return result;
}

export async function updateUserAction(input: UpdateUserInput): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    await updateUser(input);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function setUserStatusAction(id: string, status: UserStatus): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    await setUserStatus({ id, status });
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    await resetUserPassword(input);
    return null;
  });
  if (result.ok) refresh();
  return result;
}
