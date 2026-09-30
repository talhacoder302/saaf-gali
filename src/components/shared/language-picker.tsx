"use client";

import { Check } from "lucide-react";

import { useChangeLocale } from "@/components/shared/use-change-locale";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Large language choice for the profile page. */
export function LanguagePicker() {
  const { current, change, isPending } = useChangeLocale();

  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            lang={locale}
            disabled={isPending}
            onClick={() => change(locale)}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-xl border text-base transition-colors",
              active ? "border-primary bg-accent text-accent-foreground" : "hover:border-primary/50",
              locale === "ur" && "font-urdu",
              isPending && "opacity-60",
            )}
          >
            {active ? <Check className="size-4" aria-hidden /> : null}
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
