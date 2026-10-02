import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ApprovalsView } from "@/components/resident/approvals-view";
import { getApprovalQueue } from "@/server/expenses";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses.approvals");
  return { title: t("title") };
}

/** Committee members only; residents are sent back to their home. */
export default async function ApprovalsPage() {
  await requirePageUser(["committee"]);
  return <ApprovalsView queue={await getApprovalQueue()} />;
}
