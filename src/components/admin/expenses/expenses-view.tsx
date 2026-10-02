"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, ReceiptText, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { ExpenseFormDialog } from "@/components/shared/expenses/expense-form-dialog";
import { ExpenseStatusBadge, useCategoryLabel, useDayLabel } from "@/components/shared/expenses/expense-labels";
import { ReviewExpenseDialog } from "@/components/shared/expenses/review-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/expenses";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ALL_MONTHS } from "@/lib/validators/expenses";
import type { ExpenseFormOptions, ExpenseList, ExpenseRow } from "@/server/expenses";

const ALL = "all";
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ExpenseRow>();

export type ExpenseFilters = {
  areaId: string | null;
  month: string;
  category: string | null;
  status: ExpenseStatus | null;
};

type ExpensesViewProps = {
  list: ExpenseList;
  options: ExpenseFormOptions;
  filters: ExpenseFilters;
  months: string[];
  /** Every area in scope, archived ones too (for reading old expenses). */
  filterAreas: { id: string; name: string }[];
};

type Dialog =
  | { type: "create" }
  | { type: "edit"; expense: ExpenseRow }
  | { type: "review"; expense: ExpenseRow; decision: "approve" | "reject" };

function useMonthName() {
  const format = useFormatter();
  return (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15)), { month: "long", year: "numeric", timeZone: "UTC" });
  };
}

export function ExpensesView({ list, options, filters, months, filterAreas }: ExpensesViewProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const format = useFormatter();
  const monthName = useMonthName();
  const categoryLabel = useCategoryLabel();
  const dayLabel = useDayLabel();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog | null>(null);

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

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("day", {
          header: t("columns.date"),
          cell: (info) => <span className="whitespace-nowrap">{dayLabel(info.getValue())}</span>,
        }),
        helper.accessor("description", {
          header: t("columns.details"),
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-52 max-w-md">
                <p className="break-words">{row.description}</p>
                <p className="text-xs text-muted-foreground">
                  {categoryLabel(row.category)} · {row.areaName}
                </p>
              </div>
            );
          },
        }),
        helper.accessor("amount", {
          header: t("columns.amount"),
          cell: (info) => (
            <span className={cn("whitespace-nowrap font-medium tabular-nums", info.row.original.status === "rejected" && "line-through")}>
              {formatRupees(info.getValue())}
            </span>
          ),
        }),
        helper.accessor("status", {
          header: t("columns.status"),
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="min-w-36 space-y-1">
                <ExpenseStatusBadge status={row.status} />
                {row.reviewedByName ? (
                  <p className="text-xs text-muted-foreground">
                    {t("reviewedBy", {
                      name: row.reviewedByName,
                      date: row.reviewedAt ? format.dateTime(new Date(row.reviewedAt), { dateStyle: "medium" }) : "",
                    })}
                  </p>
                ) : null}
                {row.reviewNote ? <p className="max-w-56 text-xs break-words">{row.reviewNote}</p> : null}
              </div>
            );
          },
        }),
        helper.accessor("createdByName", {
          header: t("columns.addedBy"),
          cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue()}</span>,
        }),
        helper.accessor("photoUrl", {
          header: t("columns.photo"),
          cell: (info) => {
            const url = info.getValue();
            if (url) {
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block size-10 overflow-hidden rounded-md border bg-muted"
                  aria-label={t("viewPhoto")}
                >
                  <Image src={url} alt="" fill unoptimized sizes="40px" className="object-cover" />
                </a>
              );
            }
            return <span className="text-xs text-muted-foreground">{t("noPhoto")}</span>;
          },
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="flex justify-end gap-1">
                {row.canReview ? (
                  <>
                    <Button size="sm" onClick={() => setDialog({ type: "review", expense: row, decision: "approve" })}>
                      <Check aria-hidden />
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog({ type: "review", expense: row, decision: "reject" })}
                    >
                      <X aria-hidden />
                      {t("reject")}
                    </Button>
                  </>
                ) : null}
                {row.canEdit ? (
                  <Button size="icon" variant="ghost" onClick={() => setDialog({ type: "edit", expense: row })} aria-label={t("edit")}>
                    <Pencil aria-hidden />
                  </Button>
                ) : null}
              </div>
            );
          },
        }),
      ]),
    [t, dayLabel, categoryLabel, format],
  );

  const table = useTable({ features, columns, data: list.rows });
  const { totals } = list;
  const hasFilters = Boolean(filters.areaId || filters.category || filters.status);
  const exportQuery = new URLSearchParams(
    Object.entries(filters).flatMap(([key, value]) => (value ? [[key, value]] : [])),
  ).toString();
  const largestCategory = totals.byCategory[0]?.amount ?? 0;

  const stats = [
    { label: t("stats.spent"), value: formatRupees(totals.spent), hint: t("stats.spentHint") },
    {
      label: t("stats.pending"),
      value: formatRupees(totals.pending),
      hint: t("stats.pendingHint", { count: totals.pendingCount }),
      warn: totals.pendingCount > 0,
    },
    { label: t("stats.rejected"), value: formatRupees(totals.rejected), hint: t("stats.rejectedHint") },
    { label: t("stats.entries"), value: String(totals.count) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/expenses/export${exportQuery ? `?${exportQuery}` : ""}`} download>
              <Download aria-hidden />
              {t("export")}
            </a>
          </Button>
          <Button onClick={() => setDialog({ type: "create" })} disabled={options.areas.length === 0}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={filters.areaId ?? ALL}
          onValueChange={(value) => updateParams({ areaId: value === ALL ? null : value })}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.area")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allAreas")}</SelectItem>
            {filterAreas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.month} onValueChange={(value) => updateParams({ month: value })}>
          <SelectTrigger className="w-full" aria-label={t("filters.month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MONTHS}>{t("filters.allMonths")}</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {monthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.category ?? ALL}
          onValueChange={(value) => updateParams({ category: value === ALL ? null : value })}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
            {options.categories.map((category) => (
              <SelectItem key={category} value={category}>
                {categoryLabel(category)}
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
            {EXPENSE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", isPending && "opacity-60")}>
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className={cn("text-2xl font-semibold tabular-nums", stat.warn && "text-amber-600 dark:text-amber-400")}>
              {stat.value}
            </dd>
            {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
          </div>
        ))}
      </dl>

      {totals.byCategory.length > 0 ? (
        <section className={cn("space-y-3 rounded-xl border bg-card p-4", isPending && "opacity-60")}>
          <h2 className="text-sm font-medium">{t("byCategory")}</h2>
          <ul className="space-y-2">
            {totals.byCategory.map((entry) => (
              <li key={entry.category} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
                <button
                  type="button"
                  className="truncate text-start hover:underline"
                  onClick={() => updateParams({ category: entry.category })}
                >
                  {categoryLabel(entry.category)}
                </button>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${largestCategory > 0 ? Math.max(2, Math.floor((entry.amount * 100) / largestCategory)) : 0}%` }}
                  />
                </div>
                <span className="tabular-nums">{formatRupees(entry.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {list.rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={hasFilters ? t("noResults") : t("emptyTitle")}
          description={hasFilters ? t("noResultsHint") : options.areas.length === 0 ? t("needAreasFirst") : t("emptyBody")}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => updateParams({ areaId: null, category: null, status: null })}>
                {t("clearFilters")}
              </Button>
            ) : options.areas.length > 0 ? (
              <Button onClick={() => setDialog({ type: "create" })}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            ) : null
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
                  <TableRow key={row.id} className={cn(row.original.status === "rejected" && "text-muted-foreground")}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top">
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

      {dialog?.type === "create" ? (
        <ExpenseFormDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          options={options}
          defaultAreaId={filters.areaId && options.areas.some((area) => area.id === filters.areaId) ? filters.areaId : null}
        />
      ) : null}
      {dialog?.type === "edit" ? (
        <ExpenseFormDialog
          key={dialog.expense.id}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          options={options}
          expense={dialog.expense}
        />
      ) : null}
      {dialog?.type === "review" ? (
        <ReviewExpenseDialog
          expense={dialog.expense}
          decision={dialog.decision}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}
    </div>
  );
}
