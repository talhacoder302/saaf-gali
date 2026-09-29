import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <EmptyState icon={LayoutDashboard} title={t("emptyTitle")} description={t("emptyBody")} />
    </div>
  );
}
