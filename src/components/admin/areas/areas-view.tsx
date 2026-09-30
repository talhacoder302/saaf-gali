"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Archive, ArchiveRestore, ExternalLink, MapPinned, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { setAreaStatusAction } from "@/app/admin/areas/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AreaStatus } from "@/lib/areas";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AreaFormDialog } from "./area-form-dialog";
import type { AreaListRow } from "./types";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AreaListRow>();

type DialogState = { type: "create" } | { type: "edit"; area: AreaListRow } | { type: "status"; area: AreaListRow } | null;

type AreasViewProps = {
  rows: AreaListRow[];
  filters: { q: string; status: AreaStatus };
  isSuperAdmin: boolean;
};

export function AreasView({ rows, filters, isSuperAdmin }: AreasViewProps) {
  const t = useTranslations("areas");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [dialog, setDialog] = useState<DialogState>(null);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => updateParams({ q: search.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [search, filters.q, updateParams]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: t("columns.name"),
          cell: (info) => {
            const area = info.row.original;
            return (
              <div className="min-w-44">
                <Link href={`/admin/areas/${area.id}`} className="font-medium hover:underline">
                  {area.name}
                </Link>
                <p className="text-xs text-muted-foreground">{t(`cities.${area.city}`)}</p>
              </div>
            );
          },
        }),
        helper.accessor("managerNames", {
          header: t("columns.managers"),
          cell: (info) => {
            const names = info.getValue();
            return names.length > 0 ? (
              <span className="text-sm">{names.join(", ")}</span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("noManager")}</span>
            );
          },
        }),
        helper.accessor("blocks", {
          header: t("columns.blocks"),
          cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        }),
        helper.accessor("streets", {
          header: t("columns.streets"),
          cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        }),
        helper.accessor("households", {
          header: t("columns.households"),
          cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        }),
        helper.accessor("defaultMonthlyFee", {
          header: t("columns.fee"),
          cell: (info) => <span className="whitespace-nowrap tabular-nums">{formatRupees(info.getValue())}</span>,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          cell: (info) => {
            const area = info.row.original;
            const archived = area.status === "archived";
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: area.name })}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/areas/${area.id}`}>
                      <ExternalLink aria-hidden />
                      {t("actions.open")}
                    </Link>
                  </DropdownMenuItem>
                  {archived ? null : (
                    <DropdownMenuItem onSelect={() => setDialog({ type: "edit", area })}>
                      <Pencil aria-hidden />
                      {t("actions.edit")}
                    </DropdownMenuItem>
                  )}
                  {isSuperAdmin ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant={archived ? "default" : "destructive"}
                        onSelect={() => setDialog({ type: "status", area })}
                      >
                        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                        {archived ? t("actions.restore") : t("actions.archive")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [t, isSuperAdmin],
  );

  const table = useTable({ features, columns, data: rows });
  const statusArea = dialog?.type === "status" ? dialog.area : null;
  const archiving = statusArea?.status === "active";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{isSuperAdmin ? t("intro") : t("introManager")}</p>
        </div>
        {isSuperAdmin ? (
          <Button onClick={() => setDialog({ type: "create" })}>
            <Plus aria-hidden />
            {t("addArea")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Tabs value={filters.status} onValueChange={(value) => updateParams({ status: value === "active" ? null : value })}>
          <TabsList>
            <TabsTrigger value="active">{t("status.active")}</TabsTrigger>
            <TabsTrigger value="archived">{t("status.archived")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title={filters.q ? t("noResults") : filters.status === "archived" ? t("noArchived") : t("emptyTitle")}
          description={
            filters.q ? t("noResultsHint") : filters.status === "archived" ? undefined : isSuperAdmin ? t("emptyBody") : t("emptyBodyManager")
          }
          action={
            isSuperAdmin && !filters.q && filters.status === "active" ? (
              <Button onClick={() => setDialog({ type: "create" })}>
                <Plus aria-hidden />
                {t("addArea")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("overflow-x-auto rounded-xl border bg-card transition-opacity", isPending && "opacity-60")}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} className="text-start">
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog?.type === "create" ? <AreaFormDialog open onOpenChange={(open) => !open && setDialog(null)} /> : null}
      {dialog?.type === "edit" ? (
        <AreaFormDialog open onOpenChange={(open) => !open && setDialog(null)} area={dialog.area} />
      ) : null}
      {statusArea ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={archiving ? t("archiveDialog.title", { name: statusArea.name }) : t("restoreDialog.title", { name: statusArea.name })}
          description={archiving ? t("archiveDialog.body") : t("restoreDialog.body")}
          confirmLabel={archiving ? t("actions.archive") : t("actions.restore")}
          destructive={archiving}
          successMessage={archiving ? t("archived") : t("restored")}
          onConfirm={() => setAreaStatusAction(statusArea.id, archiving ? "archived" : "active")}
        />
      ) : null}
    </div>
  );
}
