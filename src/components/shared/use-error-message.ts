"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import type en from "@/i18n/en.json";

type ErrorKey = keyof (typeof en)["errors"];

/**
 * Turn an error key from Zod or an ActionResult into a message in the
 * user's language. Unknown keys fall back to a generic message.
 */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (key: string | undefined | null): string | undefined => {
      if (!key) return undefined;
      return t.has(key as ErrorKey) ? t(key as ErrorKey) : t("unknown");
    },
    [t],
  );
}
