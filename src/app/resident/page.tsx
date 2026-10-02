import { MessageSquarePlus, ReceiptText, Scale, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyFeesView } from "@/components/resident/my-fees";
import { ActionTile } from "@/components/shared/action-tile";
import { SECTION_ROLES } from "@/lib/roles";
import { getMyFees } from "@/server/payments";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("resident") };
}

export default async function ResidentHomePage() {
  const user = await requirePageUser(SECTION_ROLES["/resident"]);
  const [t, tCommon, fees] = await Promise.all([getTranslations("resident"), getTranslations("common"), getMyFees()]);
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <MyFeesView fees={fees} compact />

      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={ReceiptText} label={t("actions.myBills")} soonLabel={soon} href="/resident/bills" />
        <ActionTile icon={MessageSquarePlus} label={t("actions.newComplaint")} soonLabel={soon} />
        <ActionTile icon={Scale} label={t("actions.hisaab")} soonLabel={soon} />
        <ActionTile icon={UserRound} label={t("actions.profile")} soonLabel={soon} href="/resident/profile" />
      </div>
    </div>
  );
}
