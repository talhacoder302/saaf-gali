import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AreasView } from "@/components/admin/areas/areas-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { listAreasSchema } from "@/lib/validators/areas";
import { listAreas } from "@/server/areas";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("areas");
  return { title: t("title") };
}

type AreasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AreasPage({ searchParams }: AreasPageProps) {
  const user = await requirePageUser(ADMIN_ROLES);
  const filters = listAreasSchema.parse(await searchParams);
  const rows = await listAreas(filters);

  return (
    <AreasView
      rows={rows}
      filters={{ q: filters.q ?? "", status: filters.status }}
      isSuperAdmin={user.role === "super_admin"}
    />
  );
}
