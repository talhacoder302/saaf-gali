import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FeesOverviewView } from "@/components/admin/fees/fees-overview-view";
import { monthRange } from "@/lib/months";
import { ADMIN_ROLES } from "@/lib/roles";
import { feesOverviewSchema } from "@/lib/validators/fees";
import { listAreaOptions } from "@/server/areas";
import { billableMonthRange, getFeesOverview } from "@/server/billing";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fees");
  return { title: t("title") };
}

type FeesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FeesPage({ searchParams }: FeesPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const params = feesOverviewSchema.parse(await searchParams);
  const [overview, areas] = await Promise.all([getFeesOverview(params), listAreaOptions()]);
  const range = billableMonthRange();

  return (
    <FeesOverviewView
      overview={overview}
      months={monthRange(range.from, range.to).reverse()}
      areas={areas.map((area) => ({ id: area.id, name: area.name }))}
    />
  );
}
