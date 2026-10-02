import "server-only";

import { connectDB } from "@/lib/db";
import { features } from "@/lib/env";
import { requireRole } from "@/lib/permissions";
import { settingsFormSchema, type SettingsFormInput } from "@/lib/validators/settings";
import { Settings } from "@/models/Settings";
import { logActivity } from "@/server/activity";
import { loadSettings, type AppSettings } from "@/server/settings";
import { assertUploadedPhoto, photoUrl } from "@/server/storage";

export type SettingsView = Omit<AppSettings, "currency"> & {
  currency: string;
  logoUrl: string | null;
  storageEnabled: boolean;
};

/** Everything the Settings page shows. Super admins only. */
export async function getSettingsView(): Promise<SettingsView> {
  await requireRole("super_admin");
  const settings = await loadSettings();
  return { ...settings, logoUrl: await photoUrl(settings.logoKey), storageEnabled: features.storage };
}

const TRACKED = [
  "organisationName",
  "logoKey",
  "receiptPrefix",
  "feeDueDay",
  "expenseApprovalLimit",
  "supervisorsCanAddExpenses",
  "expenseCategories",
] as const;

export async function updateSettings(input: SettingsFormInput): Promise<void> {
  const actor = await requireRole("super_admin");
  const data = settingsFormSchema.parse(input);
  const current = await loadSettings();

  // A new logo must be a photo this admin just uploaded.
  if (data.logoKey && data.logoKey !== current.logoKey) {
    await assertUploadedPhoto(actor, "logo", data.logoKey);
  }

  const changes = TRACKED.filter((field) => JSON.stringify(data[field]) !== JSON.stringify(current[field]));
  if (changes.length === 0) return;

  await connectDB();
  const { logoKey, ...rest } = data;
  await Settings.updateOne(
    { key: "singleton" },
    logoKey ? { $set: { ...rest, logoKey } } : { $set: rest, $unset: { logoKey: 1 } },
  );

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Settings",
    meta: {
      changes,
      ...(changes.includes("expenseApprovalLimit")
        ? { fromLimit: current.expenseApprovalLimit, toLimit: data.expenseApprovalLimit }
        : {}),
      ...(changes.includes("receiptPrefix") ? { fromPrefix: current.receiptPrefix, toPrefix: data.receiptPrefix } : {}),
    },
  });
}
