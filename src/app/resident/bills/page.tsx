import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyFeesView } from "@/components/resident/my-fees";
import { SECTION_ROLES } from "@/lib/roles";
import { getMyFees } from "@/server/payments";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("resident.fees");
  return { title: t("billsTitle") };
}

export default async function ResidentBillsPage() {
  await requirePageUser(SECTION_ROLES["/resident"]);
  const [t, fees] = await Promise.all([getTranslations("resident.fees"), getMyFees()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("billsTitle")}</h1>
      <MyFeesView fees={fees} />
    </div>
  );
}
