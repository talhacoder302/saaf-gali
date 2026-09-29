import { MessageSquarePlus, ReceiptText, Scale, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("resident") };
}

export default function ResidentHomePage() {
  const t = useTranslations("resident");
  const tCommon = useTranslations("common");
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={ReceiptText} label={t("actions.myBills")} soonLabel={soon} primary />
        <ActionTile icon={MessageSquarePlus} label={t("actions.newComplaint")} soonLabel={soon} />
        <ActionTile icon={Scale} label={t("actions.hisaab")} soonLabel={soon} />
        <ActionTile icon={UserRound} label={t("actions.profile")} soonLabel={soon} />
      </div>
    </div>
  );
}
