import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";

import { HisaabShare } from "@/components/shared/hisaab/hisaab-share";
import { HisaabView } from "@/components/shared/hisaab/hisaab-view";
import { formatRupees } from "@/lib/format";
import { getPublicHisaab, publicHisaabUrl } from "@/server/hisaab";

type PublicHisaabPageProps = {
  params: Promise<{ areaSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PublicHisaabPageProps): Promise<Metadata> {
  const { areaSlug } = await params;
  const [hisaab, t] = await Promise.all([getPublicHisaab(areaSlug, await searchParams), getTranslations("hisaab")]);
  // Shared by link on WhatsApp; kept out of search engines.
  const robots = { index: false, follow: false };
  if (!hisaab) return { title: t("title"), robots };
  const title = t("pageTitle", { area: hisaab.area.name });
  const description = `${t("balance.collected")}: ${formatRupees(hisaab.balance.collected)} · ${t("balance.spent")}: ${formatRupees(hisaab.balance.spent)} · ${t("balance.closing")}: ${formatRupees(hisaab.balance.closing)}`;
  return { title, description, robots, openGraph: { title, description } };
}

/** Public monthly hisaab of one area. Only works while the area's admin keeps the link switched on. */
export default async function PublicHisaabPage({ params, searchParams }: PublicHisaabPageProps) {
  const { areaSlug } = await params;
  const hisaab = await getPublicHisaab(areaSlug, await searchParams);
  if (!hisaab) notFound();

  const [t, url] = await Promise.all([getTranslations("hisaab"), publicHisaabUrl(hisaab)]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <HisaabView
        hisaab={hisaab}
        pdfHref={`/hisaab/${areaSlug}/pdf?month=${hisaab.month}`}
        intro={
          <div className="flex items-center gap-3">
            {hisaab.logoUrl ? (
              <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border bg-card">
                <Image src={hisaab.logoUrl} alt="" fill unoptimized sizes="40px" className="object-contain" />
              </span>
            ) : null}
            <p className="text-muted-foreground">
              {t("publicIntro", { area: hisaab.area.name, organisation: hisaab.organisationName })}
            </p>
          </div>
        }
        share={<HisaabShare hisaab={hisaab} url={url} archived={false} />}
      />
    </div>
  );
}
