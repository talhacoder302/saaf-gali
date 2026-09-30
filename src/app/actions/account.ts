"use server";

import type { ActionResult } from "@/lib/action-result";
import { refreshSession, signOut } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import type { ChangePasswordInput } from "@/lib/validators/auth";
import { changeOwnPassword } from "@/server/account";
import { runAction } from "@/server/run-action";

// Account actions shared by every role (profile page, forced password change).

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    const { role } = await changeOwnPassword(input);
    // The change bumped sessionVersion; re-issue this device's cookie so it
    // stays signed in while every other device is logged out.
    await refreshSession();
    return { home: ROLE_HOME[role] };
  });
}
