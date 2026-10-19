import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TeamView } from "@/components/supervisor/team-view";
import { requirePageUser } from "@/server/session";
import { listTeam } from "@/server/workers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("duties.team");
  return { title: t("title") };
}

export default async function SupervisorTeamPage() {
  await requirePageUser(["supervisor"]);
  return <TeamView team={await listTeam()} />;
}
