import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={MapPinOff}
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        className="w-full max-w-md border-none"
        action={
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
