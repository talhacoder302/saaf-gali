import { Camera, MessageSquareWarning, Users } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("supervisor") };
}

export default function SupervisorHomePage() {
  const t = useTranslations("supervisor");
  const tCommon = useTranslations("common");
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={Users} label={t("actions.team")} soonLabel={soon} primary />
        <ActionTile icon={Camera} label={t("actions.review")} soonLabel={soon} />
        <ActionTile icon={MessageSquareWarning} label={t("actions.complaints")} soonLabel={soon} />
      </div>
    </div>
  );
}
