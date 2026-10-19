import { MapPinned } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/shared/empty-state";
import type { RosterQuery } from "@/lib/validators/duties";
import { getRoster } from "@/server/duties";

import { RosterView } from "./roster-view";

/** Server part of the roster page, shared by /admin/duties and /supervisor/roster. */
export async function RosterPage({ query }: { query: RosterQuery }) {
  const [t, { roster }] = await Promise.all([getTranslations("duties.roster"), getRoster(query)]);
  if (!roster) return <EmptyState icon={MapPinned} title={t("noAreasTitle")} description={t("noAreasBody")} />;
  return <RosterView roster={roster} />;
}
