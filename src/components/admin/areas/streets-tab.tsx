"use client";

import { MapPin, Milestone, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { deleteStreetAction } from "@/app/admin/areas/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapLink } from "@/lib/areas";

import { StreetFormDialog } from "./street-form-dialog";
import type { BlockRow, StreetRow, SupervisorOption } from "./types";

const ALL = "all";

type DialogState = { type: "create" } | { type: "edit"; street: StreetRow } | { type: "delete"; street: StreetRow } | null;

type StreetsTabProps = {
  blocks: BlockRow[];
  streets: StreetRow[];
  supervisors: SupervisorOption[];
  blockFilter: string | null;
  onBlockFilterChange: (blockId: string | null) => void;
  readOnly: boolean;
};

export function StreetsTab({ blocks, streets, supervisors, blockFilter, onBlockFilterChange, readOnly }: StreetsTabProps) {
  const t = useTranslations("streets");
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = (open: boolean) => !open && setDialog(null);

  const visible = blockFilter ? streets.filter((street) => street.blockId === blockFilter) : streets;
  const unsupervised = visible.filter((street) => !street.supervisorId).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={blockFilter ?? ALL} onValueChange={(value) => onBlockFilterChange(value === ALL ? null : value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label={t("block")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allBlocks")}</SelectItem>
              {blocks.map((block) => (
                <SelectItem key={block.id} value={block.id}>
                  {block.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unsupervised > 0 ? (
            <Badge variant="outline" className="whitespace-nowrap">
              {t("unsupervised", { count: unsupervised })}
            </Badge>
          ) : null}
        </div>
        {readOnly ? null : (
          <Button onClick={() => setDialog({ type: "create" })} disabled={blocks.length === 0}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Milestone}
          title={t("emptyTitle")}
          description={blocks.length === 0 ? t("needBlockFirst") : t("emptyBody")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("columns.name")}</TableHead>
                <TableHead className="text-start">{t("columns.block")}</TableHead>
                <TableHead className="text-start">{t("columns.supervisor")}</TableHead>
                <TableHead className="text-start">{t("columns.location")}</TableHead>
                <TableHead className="text-start">{t("columns.households")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((street) => (
                <TableRow key={street.id}>
                  <TableCell className="font-medium">{street.name}</TableCell>
                  <TableCell>{street.blockName}</TableCell>
                  <TableCell>
                    {street.supervisorName ? (
                      <span className={street.supervisorActive ? undefined : "text-muted-foreground line-through"}>
                        {street.supervisorName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t("noSupervisor")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {street.location ? (
                      <a
                        href={mapLink(street.location.lat, street.location.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <MapPin className="size-3.5" aria-hidden />
                        {t("viewMap")}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{street.households}</TableCell>
                  <TableCell className="text-end">
                    {readOnly ? null : (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDialog({ type: "edit", street })}
                          aria-label={t("editFor", { name: street.name })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDialog({ type: "delete", street })}
                          aria-label={t("deleteFor", { name: street.name })}
                          disabled={street.households > 0}
                          title={street.households > 0 ? t("deleteBlocked") : undefined}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog?.type === "create" ? (
        <StreetFormDialog
          open
          onOpenChange={close}
          blocks={blocks}
          supervisors={supervisors}
          defaultBlockId={blockFilter ?? undefined}
        />
      ) : null}
      {dialog?.type === "edit" ? (
        <StreetFormDialog open onOpenChange={close} blocks={blocks} supervisors={supervisors} street={dialog.street} />
      ) : null}
      {dialog?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t("deleteTitle", { name: dialog.street.name })}
          description={t("deleteBody")}
          confirmLabel={t("delete")}
          destructive
          successMessage={t("deleted")}
          onConfirm={() => deleteStreetAction(dialog.street.id)}
        />
      ) : null}
    </div>
  );
}
