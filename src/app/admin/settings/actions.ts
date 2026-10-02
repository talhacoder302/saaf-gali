"use server";

import type { ActionResult } from "@/lib/action-result";
import type { SettingsFormInput } from "@/lib/validators/settings";
import { runMutation } from "@/server/run-action";
import { updateSettings } from "@/server/settings-admin";

export async function updateSettingsAction(input: SettingsFormInput): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await updateSettings(input);
    return null;
  });
}
