"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
};

/** Two-button toggle: English / اردو. The choice is saved in a cookie. */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const current = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      try {
        await setLocale(locale);
        router.refresh();
      } catch {
        toast.error(t("errorTitle"));
      }
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex items-center rounded-full border bg-background p-0.5 text-sm",
        isPending && "opacity-60",
        className,
      )}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            disabled={isPending}
            onClick={() => choose(locale)}
            className={cn(
              "rounded-full px-3 py-1 leading-normal transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              locale === "ur" && "font-urdu",
            )}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
