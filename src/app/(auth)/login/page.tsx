import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

// Placeholder until the login module adds the mobile + password form.
export default function LoginPage() {
  const t = useTranslations();
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={LockKeyhole}
          title={t("common.comingSoonTitle")}
          description={t("auth.loginSoon")}
          action={
            <Button asChild variant="outline">
              <Link href="/">{t("common.backHome")}</Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
