import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CollectView } from "@/components/shared/fees/collect-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { getAppOrigin } from "@/server/app-url";
import { requirePageUser } from "@/server/session";
import { loadSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("collect");
  return { title: t("title") };
}

type CollectPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCollectPage({ searchParams }: CollectPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const { household } = await searchParams;
  const [settings, appOrigin] = await Promise.all([loadSettings(), getAppOrigin()]);
  return (
    <div className="mx-auto w-full max-w-md">
      <CollectView
        organisationName={settings.organisationName}
        appOrigin={appOrigin}
        initialHouseholdId={typeof household === "string" ? household : null}
      />
    </div>
  );
}
