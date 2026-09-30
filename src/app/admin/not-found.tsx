import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/** Shown inside the admin layout, e.g. for an area that doesn't exist or isn't yours. */
export default function AdminNotFound() {
  const t = useTranslations("common");
  return (
    <EmptyState
      icon={MapPinOff}
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      className="mt-8"
      action={
        <Button asChild variant="outline">
          <Link href="/admin">{t("backToDashboard")}</Link>
        </Button>
      }
    />
  );
}
