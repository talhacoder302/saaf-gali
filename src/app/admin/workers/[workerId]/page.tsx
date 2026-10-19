import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { WorkerDetailActions } from "@/components/admin/workers/worker-detail-actions";
import { WorkerDetailView } from "@/components/shared/duties/worker-detail-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { attendanceQuerySchema } from "@/lib/validators/workers";
import { listAreaOptions } from "@/server/areas";
import { requirePageUser } from "@/server/session";
import { getWorkerDetail } from "@/server/workers";

type WorkerPageProps = {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: WorkerPageProps): Promise<Metadata> {
  const { workerId } = await params;
  const [detail, t] = await Promise.all([getWorkerDetail(workerId), getTranslations("workers")]);
  return { title: detail?.worker.name ?? t("title") };
}

/** A worker's details and attendance calendar. Out-of-scope workers 404 like missing ones. */
export default async function WorkerPage({ params, searchParams }: WorkerPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const { workerId } = await params;
  const { month } = attendanceQuerySchema.parse(await searchParams);
  const [detail, areas, t] = await Promise.all([getWorkerDetail(workerId, month), listAreaOptions(), getTranslations("workers.detail")]);
  if (!detail) notFound();

  return (
    <WorkerDetailView
      detail={detail}
      backHref="/admin/workers"
      backLabel={t("back")}
      showSalary
      actions={<WorkerDetailActions worker={detail.worker} areas={areas} today={detail.today} />}
    />
  );
}
