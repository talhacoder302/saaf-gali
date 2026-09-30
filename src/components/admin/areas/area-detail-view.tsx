"use client";

import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { setAreaStatusAction } from "@/app/admin/areas/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AreaTab } from "@/lib/areas";
import { formatRupees } from "@/lib/format";

import { AreaFormDialog } from "./area-form-dialog";
import { BlocksTab } from "./blocks-tab";
import { StreetsTab } from "./streets-tab";
import { TeamTab } from "./team-tab";
import type { AreaDetail, AreaTeam, BlockRow, StreetRow, SupervisorOption } from "./types";

type AreaDetailViewProps = {
  area: AreaDetail;
  blocks: BlockRow[];
  streets: StreetRow[];
  supervisors: SupervisorOption[];
  team: AreaTeam;
  tab: AreaTab;
  blockFilter: string | null;
  isSuperAdmin: boolean;
};

export function AreaDetailView({
  area,
  blocks,
  streets,
  supervisors,
  team,
  tab,
  blockFilter,
  isSuperAdmin,
}: AreaDetailViewProps) {
  const t = useTranslations("areas");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<"edit" | "status" | null>(null);
  const archived = area.status === "archived";

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const stats = [
    { label: t("columns.blocks"), value: area.blocks },
    { label: t("columns.streets"), value: area.streets },
    { label: t("columns.households"), value: area.households },
    { label: t("columns.fee"), value: formatRupees(area.defaultMonthlyFee) },
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/admin/areas">
          <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
          {t("backToAreas")}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{area.name}</h1>
            <Badge variant="secondary">{t(`cities.${area.city}`)}</Badge>
            {archived ? <Badge variant="outline">{t("status.archived")}</Badge> : null}
          </div>
          {area.description ? <p className="max-w-2xl text-muted-foreground">{area.description}</p> : null}
        </div>
        <div className="flex gap-2">
          {archived ? null : (
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil aria-hidden />
              {t("actions.edit")}
            </Button>
          )}
          {isSuperAdmin ? (
            <Button variant={archived ? "default" : "outline"} onClick={() => setDialog("status")}>
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {archived ? t("actions.restore") : t("actions.archive")}
            </Button>
          ) : null}
        </div>
      </div>

      {archived ? (
        <p role="status" className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {t("archivedNotice")}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value === "blocks" ? null : value })}>
        <TabsList>
          <TabsTrigger value="blocks">{t("tabs.blocks")}</TabsTrigger>
          <TabsTrigger value="streets">{t("tabs.streets")}</TabsTrigger>
          <TabsTrigger value="team">{t("tabs.team")}</TabsTrigger>
        </TabsList>
        <TabsContent value="blocks" className="pt-4">
          <BlocksTab
            areaId={area.id}
            blocks={blocks}
            readOnly={archived}
            onShowStreets={(blockId) => setParams({ tab: "streets", block: blockId })}
          />
        </TabsContent>
        <TabsContent value="streets" className="pt-4">
          <StreetsTab
            blocks={blocks}
            streets={streets}
            supervisors={supervisors}
            blockFilter={blockFilter}
            onBlockFilterChange={(blockId) => setParams({ block: blockId })}
            readOnly={archived}
          />
        </TabsContent>
        <TabsContent value="team" className="pt-4">
          <TeamTab areaId={area.id} team={team} />
        </TabsContent>
      </Tabs>

      {dialog === "edit" ? <AreaFormDialog open onOpenChange={(open) => !open && setDialog(null)} area={area} /> : null}
      {dialog === "status" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={archived ? t("restoreDialog.title", { name: area.name }) : t("archiveDialog.title", { name: area.name })}
          description={archived ? t("restoreDialog.body") : t("archiveDialog.body")}
          confirmLabel={archived ? t("actions.restore") : t("actions.archive")}
          destructive={!archived}
          successMessage={archived ? t("restored") : t("archived")}
          onConfirm={() => setAreaStatusAction(area.id, archived ? "active" : "archived")}
        />
      ) : null}
    </div>
  );
}
