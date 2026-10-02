import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CollectView } from "@/components/shared/fees/collect-view";
import { SECTION_ROLES } from "@/lib/roles";
import { getAppOrigin } from "@/server/app-url";
import { requirePageUser } from "@/server/session";
import { loadSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("collect");
  return { title: t("title") };
}

export default async function SupervisorCollectPage() {
  await requirePageUser(SECTION_ROLES["/supervisor"]);
  const [settings, appOrigin] = await Promise.all([loadSettings(), getAppOrigin()]);
  return <CollectView organisationName={settings.organisationName} appOrigin={appOrigin} withBottomNav />;
}
