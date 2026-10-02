import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requirePageUser } from "@/server/session";
import { getSettingsView } from "@/server/settings-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Super admins only; area managers are sent to the admin dashboard. */
export default async function SettingsPage() {
  await requirePageUser(["super_admin"]);
  const [settings, t] = await Promise.all([getSettingsView(), getTranslations("settings")]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
