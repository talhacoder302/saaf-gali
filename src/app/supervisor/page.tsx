import { Banknote, Camera, MessageSquareWarning, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("supervisor") };
}

export default async function SupervisorHomePage() {
  const user = await requirePageUser(SECTION_ROLES["/supervisor"]);
  const t = await getTranslations("supervisor");
  const tCommon = await getTranslations("common");
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={Banknote} label={t("actions.collect")} soonLabel={soon} href="/supervisor/collect" primary />
        <ActionTile icon={Users} label={t("actions.team")} soonLabel={soon} />
        <ActionTile icon={Camera} label={t("actions.review")} soonLabel={soon} />
        <ActionTile icon={MessageSquareWarning} label={t("actions.complaints")} soonLabel={soon} />
      </div>
    </div>
  );
}
