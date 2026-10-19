import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RosterPage } from "@/components/shared/duties/roster-page";
import { ADMIN_ROLES } from "@/lib/roles";
import { rosterQuerySchema } from "@/lib/validators/duties";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("duties.roster");
  return { title: t("title") };
}

type AdminRosterPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminRosterPage({ searchParams }: AdminRosterPageProps) {
  await requirePageUser(ADMIN_ROLES);
  return <RosterPage query={rosterQuerySchema.parse(await searchParams)} />;
}
