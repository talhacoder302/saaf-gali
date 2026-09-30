"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatMobile } from "@/lib/mobile";
import { whatsappLink } from "@/lib/whatsapp";

import type { IssuedCredentials } from "./types";

/** Temporary login details with copy and WhatsApp buttons. */
export function CredentialsShare({ credentials }: { credentials: IssuedCredentials }) {
  const t = useTranslations("users.credentials");
  const [copied, setCopied] = useState(false);

  const loginUrl = typeof window === "undefined" ? "/login" : `${window.location.origin}/login`;
  const message = t("message", {
    name: credentials.name,
    url: loginUrl,
    mobile: formatMobile(credentials.mobile),
    password: credentials.password,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-muted p-4 text-sm">
        <dt className="text-muted-foreground">{t("mobile")}</dt>
        <dd dir="ltr" className="text-start font-mono font-medium">
          {formatMobile(credentials.mobile)}
        </dd>
        <dt className="text-muted-foreground">{t("password")}</dt>
        <dd dir="ltr" className="text-start font-mono text-base font-semibold">
          {credentials.password}
        </dd>
      </dl>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={copy} className="flex-1">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button asChild className="flex-1">
          <a href={whatsappLink(message, credentials.mobile)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            {t("whatsapp")}
          </a>
        </Button>
      </div>
    </div>
  );
}
