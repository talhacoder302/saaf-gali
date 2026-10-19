import { Banknote, Camera, MessageSquareWarning, ReceiptText, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";
import { TodayDuties } from "@/components/supervisor/today-duties";
import { SECTION_ROLES } from "@/lib/roles";
import { getSupervisorToday } from "@/server/duties";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("supervisor") };
}

export default async function SupervisorHomePage() {
  const user = await requirePageUser(SECTION_ROLES["/supervisor"]);
  const [t, tCommon, today] = await Promise.all([getTranslations("supervisor"), getTranslations("common"), getSupervisorToday()]);
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <TodayDuties data={today} />

      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={Users} label={t("actions.team")} soonLabel={soon} href="/supervisor/team" />
        <ActionTile icon={Banknote} label={t("actions.collect")} soonLabel={soon} href="/supervisor/collect" />
        <ActionTile icon={ReceiptText} label={t("actions.expenses")} soonLabel={soon} href="/supervisor/expenses" />
        <ActionTile icon={Camera} label={t("actions.review")} soonLabel={soon} />
        <ActionTile icon={MessageSquareWarning} label={t("actions.complaints")} soonLabel={soon} />
      </div>
    </div>
  );
}
