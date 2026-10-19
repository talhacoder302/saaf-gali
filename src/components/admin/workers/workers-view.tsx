"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { CalendarCheck, ChevronLeft, ChevronRight, KeyRound, MoreHorizontal, Pencil, Search, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { setWorkerStatusAction } from "@/app/admin/workers/actions";
import type { AreaChoice } from "@/components/shared/area-checklist";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDayLabel } from "@/components/shared/expenses/expense-labels";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WORKER_STATUSES } from "@/lib/duties";
import { formatRupees } from "@/lib/format";
import { formatMobile } from "@/lib/mobile";
import { cn } from "@/lib/utils";
import type { WorkerList, WorkerRow } from "@/server/workers";

import { WorkerFormDialog } from "./worker-form-dialog";
import { WorkerLoginDialog } from "./worker-login-dialog";

const ALL = "all";

// Filtering and paging happen on the server, so only the core table is needed.
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, WorkerRow>();

type DialogState =
  | { type: "create" }
  | { type: "edit"; worker: WorkerRow }
  | { type: "status"; worker: WorkerRow }
  | { type: "login"; worker: WorkerRow }
  | null;

type WorkersViewProps = {
  list: WorkerList;
  areas: AreaChoice[];
  filterAreas: { id: string; name: string }[];
  filters: { q: string; areaId: string | null; status: string | null };
  today: string;
};

export function WorkersView({ list, areas, filterAreas, filters, today }: WorkersViewProps) {
  const t = useTranslations("workers");
  const format = useFormatter();
  const dayLabel = useDayLabel();
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
        helper.accessor("name", {
          header: t("columns.name"),
          cell: (info) => (
            <Link href={`/admin/workers/${info.row.original.id}`} className="font-medium hover:underline">
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor("mobile", {
          header: t("columns.mobile"),
          cell: (info) => {
            const mobile = info.getValue();
            return mobile ? (
              <span dir="ltr" className="font-mono text-sm whitespace-nowrap">
                {formatMobile(mobile)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("noPhone")}</span>
            );
          },
        }),
        helper.accessor("areaNames", {
          header: t("columns.areas"),
          cell: (info) => <span className="line-clamp-2 max-w-48 text-sm">{format.list(info.getValue())}</span>,
        }),
        helper.accessor("monthlySalary", {
          header: t("columns.salary"),
          cell: (info) => <span className="tabular-nums whitespace-nowrap">{formatRupees(info.getValue())}</span>,
        }),
        helper.accessor("joiningDate", {
          header: t("columns.joined"),
          cell: (info) => <span className="text-sm whitespace-nowrap text-muted-foreground">{dayLabel(info.getValue())}</span>,
        }),
        helper.accessor("login", {
          header: t("columns.login"),
          cell: (info) => {
            const login = info.getValue();
            if (!login) return <span className="text-sm text-muted-foreground">{t("login.none")}</span>;
            return (
              <div className="flex flex-col items-start gap-1">
                <Badge variant={login.status === "active" ? "secondary" : "outline"}>
                  {login.status === "active" ? t("login.active") : t("login.disabled")}
                </Badge>
                {login.mustChangePassword && login.status === "active" ? (
                  <span className="text-[10px] text-muted-foreground">{t("login.temp")}</span>
                ) : null}
              </div>
            );
          },
        }),
        helper.accessor("status", {
          header: t("columns.status"),
          cell: (info) => (
            <Badge variant={info.getValue() === "active" ? "default" : "outline"} className={cn(info.getValue() === "inactive" && "text-muted-foreground")}>
              {t(`status.${info.getValue()}`)}
            </Badge>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          cell: (info) => {
            const worker = info.row.original;
            const active = worker.status === "active";
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: worker.name })}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/workers/${worker.id}`}>
                      <CalendarCheck aria-hidden />
                      {t("actions.attendance")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDialog({ type: "edit", worker })}>
                    <Pencil aria-hidden />
                    {t("actions.edit")}
                  </DropdownMenuItem>
                  {active && worker.mobile && !worker.login ? (
                    <DropdownMenuItem onSelect={() => setDialog({ type: "login", worker })}>
                      <KeyRound aria-hidden />
                      {t("actions.createLogin")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant={active ? "destructive" : "default"} onSelect={() => setDialog({ type: "status", worker })}>
                    {active ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                    {active ? t("actions.deactivate") : t("actions.activate")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [t, format, dayLabel],
  );

  const table = useTable({ features, columns, data: list.rows });
  const close = (open: boolean) => !open && setDialog(null);
  const hasFilters = Boolean(filters.q || filters.areaId || filters.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <Button onClick={() => setDialog({ type: "create" })}>
          <UserPlus aria-hidden />
          {t("addWorker")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
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
        <Select value={filters.areaId ?? ALL} onValueChange={(value) => updateParams({ areaId: value === ALL ? null : value })}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t("columns.areas")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allAreas")}</SelectItem>
            {filterAreas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? ALL} onValueChange={(value) => updateParams({ status: value === ALL ? null : value })}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t("columns.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {WORKER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? t("noResults") : t("emptyTitle")}
          description={hasFilters ? t("noResultsHint") : t("emptyBody")}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  updateParams({ q: null, areaId: null, status: null });
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : (
              <Button onClick={() => setDialog({ type: "create" })}>
                <UserPlus aria-hidden />
                {t("addWorker")}
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
                  <TableRow key={row.id} className={cn(row.original.status === "inactive" && "opacity-60")}>
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

      {dialog?.type === "create" ? <WorkerFormDialog open onOpenChange={close} areas={areas} today={today} /> : null}
      {dialog?.type === "edit" ? <WorkerFormDialog open onOpenChange={close} worker={dialog.worker} areas={areas} today={today} /> : null}
      {dialog?.type === "login" && dialog.worker.mobile ? (
        <WorkerLoginDialog open onOpenChange={close} worker={{ id: dialog.worker.id, name: dialog.worker.name, mobile: dialog.worker.mobile }} />
      ) : null}
      {dialog?.type === "status" ? (
        <WorkerStatusDialog worker={dialog.worker} onOpenChange={close} />
      ) : null}
    </div>
  );
}

/** Mark as left / bring back. Also used on the worker page. */
export function WorkerStatusDialog({ worker, onOpenChange }: { worker: { id: string; name: string; status: string }; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workers");
  const active = worker.status === "active";
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={active ? t("statusDialog.deactivateTitle", { name: worker.name }) : t("statusDialog.activateTitle", { name: worker.name })}
      description={active ? t("statusDialog.deactivateBody") : t("statusDialog.activateBody")}
      confirmLabel={active ? t("actions.deactivate") : t("actions.activate")}
      destructive={active}
      successMessage={active ? t("statusDialog.deactivated") : t("statusDialog.activated")}
      onConfirm={() => setWorkerStatusAction(worker.id, active ? "inactive" : "active")}
    />
  );
}
