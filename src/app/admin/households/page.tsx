import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HouseholdsView } from "@/components/admin/households/households-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { listHouseholdsSchema } from "@/lib/validators/households";
import { listHouseholds } from "@/server/households";
import { getLocationTree } from "@/server/locations";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("households");
  return { title: t("title") };
}

type HouseholdsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HouseholdsPage({ searchParams }: HouseholdsPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const filters = listHouseholdsSchema.parse(await searchParams);
  const [list, tree] = await Promise.all([listHouseholds(filters), getLocationTree()]);

  return (
    <HouseholdsView
      list={list}
      tree={tree}
      filters={{
        q: filters.q ?? "",
        areaId: filters.areaId ?? null,
        blockId: filters.blockId ?? null,
        streetId: filters.streetId ?? null,
        status: filters.status ?? null,
      }}
    />
  );
}
