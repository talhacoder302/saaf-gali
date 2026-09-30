"use client";

import { useTranslations } from "next-intl";

import { useChangeLocale } from "@/components/shared/use-change-locale";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
};

/** Two-button toggle: English / اردو. */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const t = useTranslations("common");
  const { current, change, isPending } = useChangeLocale();

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
            onClick={() => change(locale)}
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
