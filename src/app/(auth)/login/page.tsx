import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/shared/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  const expired = params.expired === "1";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {expired ? (
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
            {t("sessionExpired")}
          </p>
        ) : null}
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
