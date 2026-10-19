import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WorkersView } from "@/components/admin/workers/workers-view";
import { dayKey } from "@/lib/format";
import { ADMIN_ROLES } from "@/lib/roles";
import { listWorkersSchema } from "@/lib/validators/workers";
import { listAreaFilterOptions, listAreaOptions } from "@/server/areas";
import { requirePageUser } from "@/server/session";
import { listWorkers } from "@/server/workers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workers");
  return { title: t("title") };
}

type WorkersPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function WorkersPage({ searchParams }: WorkersPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const filters = listWorkersSchema.parse(await searchParams);
  const [list, areas, filterAreas] = await Promise.all([listWorkers(filters), listAreaOptions(), listAreaFilterOptions()]);

  return (
    <WorkersView
      list={list}
      areas={areas}
      filterAreas={filterAreas.map((area) => ({ id: area.id, name: area.name }))}
      filters={{ q: filters.q ?? "", areaId: filters.areaId ?? null, status: filters.status ?? null }}
      today={dayKey()}
    />
  );
}
