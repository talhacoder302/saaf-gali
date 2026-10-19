import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { WorkerDetailView } from "@/components/shared/duties/worker-detail-view";
import { attendanceQuerySchema } from "@/lib/validators/workers";
import { requirePageUser } from "@/server/session";
import { getWorkerDetail } from "@/server/workers";

type TeamMemberPageProps = {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: TeamMemberPageProps): Promise<Metadata> {
  const { workerId } = await params;
  const [detail, t] = await Promise.all([getWorkerDetail(workerId), getTranslations("attendance")]);
  return { title: detail?.worker.name ?? t("title") };
}

/** A team member's attendance calendar (supervisors, their areas only). */
export default async function TeamMemberPage({ params, searchParams }: TeamMemberPageProps) {
  await requirePageUser(["supervisor"]);
  const { workerId } = await params;
  const { month } = attendanceQuerySchema.parse(await searchParams);
  const [detail, t] = await Promise.all([getWorkerDetail(workerId, month), getTranslations("workers.detail")]);
  if (!detail) notFound();
  return <WorkerDetailView detail={detail} backHref="/supervisor/team" backLabel={t("backToTeam")} />;
}
