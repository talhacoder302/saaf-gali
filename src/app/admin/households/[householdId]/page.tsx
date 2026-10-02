import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { HouseholdDetailView } from "@/components/admin/households/household-detail-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { getHousehold } from "@/server/households";
import { getLocationTree } from "@/server/locations";
import { getHouseholdFeeHistory } from "@/server/payments";
import { requirePageUser } from "@/server/session";

type HouseholdPageProps = {
  params: Promise<{ householdId: string }>;
};

export async function generateMetadata({ params }: HouseholdPageProps): Promise<Metadata> {
  const { householdId } = await params;
  const household = await getHousehold(householdId);
  const t = await getTranslations("households");
  return {
    title: household ? `${t("houseLabel", { number: household.houseNumber })}, ${household.streetName}` : t("title"),
  };
}

export default async function HouseholdPage({ params }: HouseholdPageProps) {
  const user = await requirePageUser(ADMIN_ROLES);
  const { householdId } = await params;

  // Out-of-scope households come back as null, so they 404 like missing ones.
  const [household, tree, feeHistory] = await Promise.all([
    getHousehold(householdId),
    getLocationTree(),
    getHouseholdFeeHistory(householdId),
  ]);
  if (!household || !feeHistory) notFound();

  return (
    <HouseholdDetailView
      household={household}
      tree={tree}
      feeHistory={feeHistory}
      canCancelPayments={user.role === "super_admin"}
    />
  );
}
