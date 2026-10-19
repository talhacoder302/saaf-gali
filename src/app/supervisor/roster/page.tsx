import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RosterPage } from "@/components/shared/duties/roster-page";
import { rosterQuerySchema } from "@/lib/validators/duties";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("duties.roster");
  return { title: t("title") };
}

type SupervisorRosterPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SupervisorRosterPage({ searchParams }: SupervisorRosterPageProps) {
  await requirePageUser(["supervisor"]);
  return <RosterPage query={rosterQuerySchema.parse(await searchParams)} />;
}
