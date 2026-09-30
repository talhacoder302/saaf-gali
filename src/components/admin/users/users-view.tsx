"use client";

import { ChevronLeft, ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import type { AreaChoice } from "@/components/shared/area-checklist";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES } from "@/lib/roles";
import { USER_STATUSES } from "@/lib/validators/users";
import type { UserList } from "@/server/users";

import { ResetPasswordDialog } from "./reset-password-dialog";
import type { UserRow, UsersActor, UsersFilters } from "./types";
import { UserFormDialog } from "./user-form-dialog";
import { UserStatusDialog } from "./user-status-dialog";
import { UsersTable, type UserRowAction } from "./users-table";

const ALL = "all";

type DialogState =
  | { type: "create" }
  | { type: "edit"; user: UserRow }
  | { type: "reset"; user: UserRow }
  | { type: "status"; user: UserRow }
  | null;

type UsersViewProps = {
  list: UserList;
  areas: AreaChoice[];
  filters: UsersFilters;
  actor: UsersActor;
};

export function UsersView({ list, areas, filters, actor }: UsersViewProps) {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
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
      // Any filter change starts again from page 1.
      if (!("page" in patch)) params.delete("page");
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
    },
    [pathname, router, searchParams],
  );

  // Search as the admin types, without a request per keystroke.
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => updateParams({ q: search.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [search, filters.q, updateParams]);

  const onAction = useCallback((action: UserRowAction, user: UserRow) => {
    setDialog({ type: action, user });
  }, []);

  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const hasFilters = Boolean(filters.q || filters.role || filters.status);
  const roleOptions = actor.role === "super_admin" ? ROLES : actor.manageableRoles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <Button onClick={() => setDialog({ type: "create" })}>
          <UserPlus aria-hidden />
          {t("addUser")}
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
        <Select value={filters.role ?? ALL} onValueChange={(value) => updateParams({ role: value === ALL ? null : value })}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t("columns.role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allRoles")}</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {tRoles(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? ALL}
          onValueChange={(value) => updateParams({ status: value === ALL ? null : value })}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label={t("columns.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {USER_STATUSES.map((status) => (
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
                  updateParams({ q: null, role: null, status: null });
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : (
              <Button onClick={() => setDialog({ type: "create" })}>
                <UserPlus aria-hidden />
                {t("addUser")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <UsersTable rows={list.rows} actorId={actor.id} onAction={onAction} pending={isPending} />
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
        <UserFormDialog open onOpenChange={closeDialog} actor={actor} areas={areas} />
      ) : null}
      {dialog?.type === "edit" ? (
        <UserFormDialog open onOpenChange={closeDialog} user={dialog.user} actor={actor} areas={areas} />
      ) : null}
      {dialog?.type === "reset" ? <ResetPasswordDialog open onOpenChange={closeDialog} user={dialog.user} /> : null}
      {dialog?.type === "status" ? <UserStatusDialog open onOpenChange={closeDialog} user={dialog.user} /> : null}
    </div>
  );
}
