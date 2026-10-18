import { MapPinned } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { HisaabShare } from "@/components/shared/hisaab/hisaab-share";
import { HisaabView } from "@/components/shared/hisaab/hisaab-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { hisaabQuerySchema } from "@/lib/validators/hisaab";
import { getHisaab, publicHisaabUrl } from "@/server/hisaab";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hisaab");
  return { title: t("title") };
}

type AdminHisaabPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The monthly hisaab of any area in scope, with the public link and its share buttons. */
export default async function AdminHisaabPage({ searchParams }: AdminHisaabPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const query = hisaabQuerySchema.parse(await searchParams);
  const [t, { areas, hisaab }] = await Promise.all([getTranslations("hisaab"), getHisaab(query)]);

  if (areas.length === 0) return <EmptyState icon={MapPinned} title={t("noAreaTitle")} description={t("noAreaBody")} />;
  // An area id outside the user's scope looks exactly like one that does not exist.
  if (!hisaab) notFound();

  const url = await publicHisaabUrl(hisaab);
  return (
    <HisaabView
      hisaab={hisaab}
      areas={areas}
      pdfHref={`/admin/hisaab/pdf?area=${hisaab.area.id}&month=${hisaab.month}`}
      share={
        <HisaabShare
          hisaab={hisaab}
          url={url}
          archived={hisaab.area.archived}
          settingsHref={`/admin/areas/${hisaab.area.id}`}
        />
      }
    />
  );
}
