"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMobile } from "@/lib/mobile";
import { cn } from "@/lib/utils";

import type { UserRow } from "./types";

// Filtering and paging happen on the server, so only the core table is needed.
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, UserRow>();

export type UserRowAction = "edit" | "reset" | "status";

type UsersTableProps = {
  rows: UserRow[];
  actorId: string;
  onAction: (action: UserRowAction, user: UserRow) => void;
  pending?: boolean;
};

export function UsersTable({ rows, actorId, onAction, pending }: UsersTableProps) {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
  const format = useFormatter();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: t("columns.name"),
          cell: (info) => {
            const user = info.row.original;
            return (
              <div className="min-w-40">
                <p className="font-medium">{user.name}</p>
                {user.email ? <p className="text-xs text-muted-foreground">{user.email}</p> : null}
                {user.mustChangePassword ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {t("tempPasswordBadge")}
                  </Badge>
                ) : null}
              </div>
            );
          },
        }),
        helper.accessor("mobile", {
          header: t("columns.mobile"),
          cell: (info) => (
            <span dir="ltr" className="whitespace-nowrap font-mono text-sm">
              {formatMobile(info.getValue())}
            </span>
          ),
        }),
        helper.accessor("role", {
          header: t("columns.role"),
          cell: (info) => <Badge variant="secondary">{tRoles(info.getValue())}</Badge>,
        }),
        helper.accessor("areaNames", {
          header: t("columns.areas"),
          cell: (info) => {
            const names = info.getValue();
            if (info.row.original.role === "super_admin") {
              return <span className="text-sm text-muted-foreground">{t("allAreas")}</span>;
            }
            return names.length > 0 ? (
              <span className="line-clamp-2 max-w-56 text-sm">{format.list(names)}</span>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            );
          },
        }),
        helper.accessor("status", {
          header: t("columns.status"),
          cell: (info) => {
            const status = info.getValue();
            return (
              <Badge
                variant={status === "active" ? "default" : "outline"}
                className={cn(status === "disabled" && "text-muted-foreground")}
              >
                {t(`status.${status}`)}
              </Badge>
            );
          },
        }),
        helper.accessor("lastLoginAt", {
          header: t("columns.lastLogin"),
          cell: (info) => {
            const value = info.getValue();
            return (
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : t("never")}
              </span>
            );
          },
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          cell: (info) => {
            const user = info.row.original;
            const isSelf = user.id === actorId;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: user.name })}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onAction("edit", user)}>
                    <Pencil aria-hidden />
                    {t("actions.edit")}
                  </DropdownMenuItem>
                  {isSelf ? null : (
                    <>
                      <DropdownMenuItem onSelect={() => onAction("reset", user)}>
                        <KeyRound aria-hidden />
                        {t("actions.resetPassword")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant={user.status === "active" ? "destructive" : "default"}
                        onSelect={() => onAction("status", user)}
                      >
                        {user.status === "active" ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                        {user.status === "active" ? t("actions.disable") : t("actions.enable")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [t, tRoles, format, actorId, onAction],
  );

  const table = useTable({ features, columns, data: rows });

  return (
    <div className={cn("overflow-x-auto rounded-xl border bg-card transition-opacity", pending && "opacity-60")}>
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
            <TableRow key={row.id} className={cn(row.original.status === "disabled" && "opacity-60")}>
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
  );
}
