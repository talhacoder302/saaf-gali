"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";

/** Current locale plus a function to switch it (saved on the account when signed in). */
export function useChangeLocale() {
  const current = useLocale();
  const t = useTranslations("errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      try {
        await setLocale(locale);
        router.refresh();
      } catch {
        toast.error(t("unknown"));
      }
    });
  }

  return { current, change, isPending };
}
