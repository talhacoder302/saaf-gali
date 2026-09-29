import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  href?: string;
  className?: string;
};

export function Brand({ href = "/", className }: BrandProps) {
  const t = useTranslations("common");
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <span>{t("appName")}</span>
    </Link>
  );
}
