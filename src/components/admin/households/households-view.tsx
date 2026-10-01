"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Download, FileUp, House, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupees } from "@/lib/format";
import { HOUSEHOLD_STATUSES, type HouseholdStatus } from "@/lib/households";
import { formatMobile } from "@/lib/mobile";
import { cn } from "@/lib/utils";

import { HouseholdFormDialog } from "./household-form-dialog";
import { ImportDialog } from "./import-dialog";
import { blocksOf, streetsOf, type AreaNode, type HouseholdList, type HouseholdRow } from "./types";

const ALL = "all";
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, HouseholdRow>();

export type HouseholdFilters = {
  q: string;
  areaId: string | null;
  blockId: string | null;
  streetId: string | null;
  status: HouseholdStatus | null;
};

export const STATUS_BADGE: Record<HouseholdStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  vacant: "outline",
  exempt: "secondary",
};

type HouseholdsViewProps = {
  list: HouseholdList;
  tree: AreaNode[];
  filters: HouseholdFilters;
};

export function HouseholdsView({ list, tree, filters }: HouseholdsViewProps) {
  const t = useTranslations("households");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [dialog, setDialog] = useState<"create" | "import" | null>(null);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!("page" in patch)) params.delete("page");
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
        helper.accessor("houseNumber", {
          header: t("columns.house"),
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-40">
                <Link href={`/admin/households/${row.id}`} className="font-medium hover:underline">
                  {t("houseLabel", { number: row.houseNumber })}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.streetName} · {row.blockName} · {row.areaName}
                </p>
              </div>
            );
          },
        }),
        helper.accessor("ownerName", {
          header: t("columns.owner"),
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-36">
                <p>{row.ownerName}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`occupant.${row.occupantType}`)}
                  {row.contactName ? ` · ${row.contactName}` : ""}
                </p>
              </div>
            );
          },
        }),
        helper.accessor("mobile", {
          header: t("columns.mobile"),
          cell: (info) => {
            const mobile = info.getValue();
            return mobile ? (
              <span dir="ltr" className="whitespace-nowrap font-mono text-sm">
                {formatMobile(mobile)}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        }),
        helper.accessor("monthlyFee", {
          header: t("columns.fee"),
          cell: (info) => <span className="whitespace-nowrap tabular-nums">{formatRupees(info.getValue())}</span>,
        }),
        helper.accessor("status", {
          header: t("columns.status"),
          cell: (info) => <Badge variant={STATUS_BADGE[info.getValue()]}>{t(`status.${info.getValue()}`)}</Badge>,
        }),
      ]),
    [t],
  );

  const table = useTable({ features, columns, data: list.rows });
  const blocks = blocksOf(tree, filters.areaId);
  const streets = streetsOf(tree, filters.areaId, filters.blockId);
  const hasFilters = Boolean(filters.q || filters.areaId || filters.status);
  const exportQuery = new URLSearchParams(
    Object.entries({ ...filters, q: filters.q || null }).flatMap(([key, value]) => (value ? [[key, value]] : [])),
  ).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/households/export${exportQuery ? `?${exportQuery}` : ""}`} download>
              <Download aria-hidden />
              {t("export")}
            </a>
          </Button>
          <Button variant="outline" onClick={() => setDialog("import")}>
            <FileUp aria-hidden />
            {t("importLabel")}
          </Button>
          <Button onClick={() => setDialog("create")} disabled={tree.length === 0}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,minmax(0,11rem))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
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
        <Select
          value={filters.areaId ?? ALL}
          onValueChange={(value) => updateParams({ areaId: value === ALL ? null : value, blockId: null, streetId: null })}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.area")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allAreas")}</SelectItem>
            {tree.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.blockId ?? ALL}
          onValueChange={(value) => updateParams({ blockId: value === ALL ? null : value, streetId: null })}
          disabled={!filters.areaId}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.block")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allBlocks")}</SelectItem>
            {blocks.map((block) => (
              <SelectItem key={block.id} value={block.id}>
                {block.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.streetId ?? ALL}
          onValueChange={(value) => updateParams({ streetId: value === ALL ? null : value })}
          disabled={!filters.blockId}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.street")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStreets")}</SelectItem>
            {streets.map((street) => (
              <SelectItem key={street.id} value={street.id}>
                {street.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? ALL} onValueChange={(value) => updateParams({ status: value === ALL ? null : value })}>
          <SelectTrigger className="w-full" aria-label={t("filters.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            {HOUSEHOLD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.rows.length === 0 ? (
        <EmptyState
          icon={House}
          title={hasFilters ? t("noResults") : t("emptyTitle")}
          description={hasFilters ? t("noResultsHint") : tree.length === 0 ? t("needStreetsFirst") : t("emptyBody")}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  updateParams({ q: null, areaId: null, blockId: null, streetId: null, status: null });
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : tree.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog("create")}>
                  <Plus aria-hidden />
                  {t("add")}
                </Button>
                <Button variant="outline" onClick={() => setDialog("import")}>
                  <FileUp aria-hidden />
                  {t("importLabel")}
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline">
                <Link href="/admin/areas">{t("goToAreas")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
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
                  <TableRow key={row.id} className={cn(row.original.status !== "active" && "text-muted-foreground")}>
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
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>{t("total", { total: list.total })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={list.page <= 1 || isPending}
                onClick={() => updateParams({ page: String(list.page - 1) })}
                aria-label={t("previous")}
              >
                <ChevronLeft className="rtl:-scale-x-100" />
              </Button>
              <span>{t("pageOf", { page: list.page, pageCount: list.pageCount })}</span>
              <Button
                variant="outline"
                size="icon"
                disabled={list.page >= list.pageCount || isPending}
                onClick={() => updateParams({ page: String(list.page + 1) })}
                aria-label={t("next")}
              >
                <ChevronRight className="rtl:-scale-x-100" />
              </Button>
            </div>
          </div>
        </>
      )}

      {dialog === "create" ? (
        <HouseholdFormDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          tree={tree}
          defaults={{ areaId: filters.areaId, blockId: filters.blockId, streetId: filters.streetId }}
        />
      ) : null}
      {dialog === "import" ? <ImportDialog open onOpenChange={(open) => !open && setDialog(null)} /> : null}
    </div>
  );
}
