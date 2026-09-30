import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { LogoutButton } from "@/components/shared/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { EXPIRED_SESSION_PATH, getCurrentUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("changePasswordTitle") };
}

/** Shown after login when an admin set a temporary password. */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect((await auth())?.user ? EXPIRED_SESSION_PATH : "/login");
  if (!user.mustChangePassword) redirect(ROLE_HOME[user.role]);

  const t = await getTranslations("auth");

  return (
    <div className="w-full max-w-sm space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("changePasswordTitle")}</CardTitle>
          <CardDescription>{t("changePasswordIntro", { name: user.name })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced />
        </CardContent>
      </Card>
      <LogoutButton variant="ghost" className="w-full" />
    </div>
  );
}
