import { Camera, CircleHelp, ClipboardList, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActionTile } from "@/components/shared/action-tile";
import { TodayList } from "@/components/worker/my-duties";
import { SECTION_ROLES } from "@/lib/roles";
import { getMyDuties } from "@/server/duties";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return { title: t("worker") };
}

export default async function WorkerHomePage() {
  const user = await requirePageUser(SECTION_ROLES["/worker"]);
  const [t, tCommon, duties] = await Promise.all([getTranslations("worker"), getTranslations("common"), getMyDuties()]);
  const soon = tCommon("soon");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <TodayList data={duties} />
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={ClipboardList} label={t("actions.myDuties")} soonLabel={soon} href="/worker/duties" primary />
        <ActionTile icon={Camera} label={t("actions.startWork")} soonLabel={soon} />
        <ActionTile icon={Wallet} label={t("actions.salary")} soonLabel={soon} />
        <ActionTile icon={CircleHelp} label={t("actions.help")} soonLabel={soon} />
      </div>
    </div>
  );
}
