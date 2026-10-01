"use server";

import type { ActionResult } from "@/lib/action-result";
import type { ImportRawRow } from "@/lib/household-import";
import type { HouseholdFormInput, ResidentLoginInput, UpdateHouseholdInput } from "@/lib/validators/households";
import { importHouseholds, previewHouseholdImport, type ImportPreview } from "@/server/household-excel";
import { createHousehold, createResidentLogin, updateHousehold } from "@/server/households";
import { runAction, runMutation } from "@/server/run-action";

// Thin wrappers: every permission and area check lives in the services.

export async function createHouseholdAction(input: HouseholdFormInput): Promise<ActionResult<{ id: string }>> {
  return runMutation(() => createHousehold(input));
}

export async function updateHouseholdAction(input: UpdateHouseholdInput): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await updateHousehold(input);
    return null;
  });
}

export async function createResidentLoginAction(
  input: ResidentLoginInput,
): Promise<ActionResult<{ name: string; mobile: string }>> {
  return runMutation(() => createResidentLogin(input));
}

/** Upload step: read the file and report problems per row. Saves nothing. */
export async function previewImportAction(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(() => previewHouseholdImport(formData.get("file")));
}

/** Confirm step: re-validates the rows and saves the valid ones. */
export async function importHouseholdsAction(
  rows: ImportRawRow[],
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  return runMutation(() => importHouseholds(rows));
}
