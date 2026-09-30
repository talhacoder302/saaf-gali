import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AreaDetailView } from "@/components/admin/areas/area-detail-view";
import { AREA_TABS, type AreaTab } from "@/lib/areas";
import { ADMIN_ROLES } from "@/lib/roles";
import { getAreaTeam, listAreaSupervisors } from "@/server/area-team";
import { getAreaDetail } from "@/server/areas";
import { listBlocks } from "@/server/blocks";
import { requirePageUser } from "@/server/session";
import { listStreets } from "@/server/streets";

type AreaPageProps = {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: AreaPageProps): Promise<Metadata> {
  const { areaId } = await params;
  const area = await getAreaDetail(areaId);
  const t = await getTranslations("areas");
  return { title: area?.name ?? t("title") };
}

function pickTab(value: unknown): AreaTab {
  return (AREA_TABS as readonly unknown[]).includes(value) ? (value as AreaTab) : "blocks";
}

export default async function AreaPage({ params, searchParams }: AreaPageProps) {
  const user = await requirePageUser(ADMIN_ROLES);
  const { areaId } = await params;
  const query = await searchParams;

  // Out-of-scope areas come back as null, so they 404 like missing ones.
  const area = await getAreaDetail(areaId);
  if (!area) notFound();

  const [blocks, streets, supervisors, team] = await Promise.all([
    listBlocks(area.id),
    listStreets(area.id),
    listAreaSupervisors(area.id),
    getAreaTeam(area.id),
  ]);

  const blockParam = typeof query.block === "string" ? query.block : null;
  const blockFilter = blocks.some((block) => block.id === blockParam) ? blockParam : null;

  return (
    <AreaDetailView
      area={area}
      blocks={blocks}
      streets={streets}
      supervisors={supervisors}
      team={team}
      tab={pickTab(query.tab)}
      blockFilter={blockFilter}
      isSuperAdmin={user.role === "super_admin"}
    />
  );
}
