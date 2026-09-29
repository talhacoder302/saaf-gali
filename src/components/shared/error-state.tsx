"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/** Used by every error.tsx boundary. */
export function ErrorState({ error, retry }: ErrorStateProps) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("errorTitle")}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{t("errorBody")}</p>
        {error.digest ? <p className="text-xs text-muted-foreground">#{error.digest}</p> : null}
      </div>
      <Button onClick={() => retry()}>{t("tryAgain")}</Button>
    </div>
  );
}
