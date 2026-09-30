import { KeyRound, Languages, UserRound } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { LanguagePicker } from "@/components/shared/language-picker";
import { LogoutButton } from "@/components/shared/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMobile } from "@/lib/mobile";
import { hasAllAreaAccess } from "@/lib/permissions";
import { listAreaOptions } from "@/server/areas";
import type { CurrentUser } from "@/server/session";

type ProfileViewProps = {
  user: CurrentUser;
};

/** Profile page body shared by every role: details, language, password, logout. */
export async function ProfileView({ user }: ProfileViewProps) {
  const t = await getTranslations("profile");
  const tRoles = await getTranslations("roles");
  const format = await getFormatter();
  const areas = await listAreaOptions();
  const areaNames = hasAllAreaAccess(user)
    ? [t("allAreas")]
    : areas.filter((area) => user.areaIds.includes(area.id)).map((area) => area.name);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-primary" aria-hidden />
            {t("details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t("name")}</dt>
            <dd className="font-medium">{user.name}</dd>
            <dt className="text-muted-foreground">{t("mobile")}</dt>
            <dd dir="ltr" className="text-start font-medium">
              {formatMobile(user.mobile)}
            </dd>
            <dt className="text-muted-foreground">{t("role")}</dt>
            <dd>
              <Badge variant="secondary">{tRoles(user.role)}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t("areas")}</dt>
            <dd>{areaNames.length > 0 ? format.list(areaNames) : t("noAreas")}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-5 text-primary" aria-hidden />
            {t("languageTitle")}
          </CardTitle>
          <CardDescription>{t("languageIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguagePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            {t("passwordTitle")}
          </CardTitle>
          <CardDescription>{t("passwordIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <LogoutButton className="w-full" />
    </div>
  );
}
