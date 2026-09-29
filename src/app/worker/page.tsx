import { Camera, CircleHelp, ClipboardList, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("worker") };
}

export default function WorkerHomePage() {
  const t = useTranslations("worker");
  const tCommon = useTranslations("common");
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={Camera} label={t("actions.startWork")} soonLabel={soon} primary />
        <ActionTile icon={ClipboardList} label={t("actions.myDuties")} soonLabel={soon} />
        <ActionTile icon={Wallet} label={t("actions.salary")} soonLabel={soon} />
        <ActionTile icon={CircleHelp} label={t("actions.help")} soonLabel={soon} />
      </div>
    </div>
  );
}
