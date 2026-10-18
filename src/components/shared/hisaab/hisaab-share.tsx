"use client";

import { Check, Copy, ExternalLink, Link2, MessageCircle, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hisaabWhatsappLink } from "@/lib/hisaab";
import type { HisaabView } from "@/server/hisaab";

type HisaabShareProps = {
  hisaab: HisaabView;
  /** Absolute public link for this month, or null when the link is off. */
  url: string | null;
  archived: boolean;
  /** Admins see the "off" state with a link to the area settings; others see nothing then. */
  settingsHref?: string;
};

/** The public link with copy and WhatsApp buttons. */
export function HisaabShare({ hisaab, url, archived, settingsHref }: HisaabShareProps) {
  const t = useTranslations("hisaab.share");
  const [copied, setCopied] = useState(false);

  if (!url) {
    if (!settingsHref) return null;
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {archived ? t("offArchived") : t("off")}
        </p>
        {archived ? null : (
          <Button asChild size="sm" variant="outline">
            <Link href={settingsHref}>
              <Settings2 aria-hidden />
              {t("settings")}
            </Link>
          </Button>
        )}
      </section>
    );
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const whatsapp = hisaabWhatsappLink({
    organisation: hisaab.organisationName,
    area: hisaab.area.name,
    month: hisaab.month,
    collected: hisaab.balance.collected,
    spent: hisaab.balance.spent,
    closing: hisaab.balance.closing,
    url,
  });

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4 text-primary" aria-hidden />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("on")}</p>
      </div>
      <Input readOnly value={url} dir="ltr" aria-label={t("title")} onFocus={(event) => event.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button asChild size="sm">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            {t("whatsapp")}
          </a>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t("open")}
          </a>
        </Button>
      </div>
    </section>
  );
}
