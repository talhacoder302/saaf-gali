import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProfileView } from "@/components/shared/profile-view";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function SupervisorProfilePage() {
  const user = await requirePageUser(SECTION_ROLES["/supervisor"]);
  return <ProfileView user={user} />;
}
