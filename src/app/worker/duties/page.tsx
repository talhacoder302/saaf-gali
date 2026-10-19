import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UpcomingDuties } from "@/components/worker/my-duties";
import { SECTION_ROLES } from "@/lib/roles";
import { getMyDuties } from "@/server/duties";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workerPortal");
  return { title: t("myDutiesTitle") };
}

export default async function WorkerDutiesPage() {
  await requirePageUser(SECTION_ROLES["/worker"]);
  return <UpcomingDuties data={await getMyDuties()} />;
}
