"use client";

import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { deleteBlockAction } from "@/app/admin/areas/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { BlockFormDialog } from "./block-form-dialog";
import type { BlockRow } from "./types";

type DialogState = { type: "create" } | { type: "edit"; block: BlockRow } | { type: "delete"; block: BlockRow } | null;

type BlocksTabProps = {
  areaId: string;
  blocks: BlockRow[];
  readOnly: boolean;
  onShowStreets: (blockId: string) => void;
};

export function BlocksTab({ areaId, blocks, readOnly, onShowStreets }: BlocksTabProps) {
  const t = useTranslations("blocks");
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="space-y-4">
      {readOnly ? null : (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ type: "create" })}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </div>
      )}

      {blocks.length === 0 ? (
        <EmptyState icon={LayoutGrid} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("columns.name")}</TableHead>
                <TableHead className="text-start">{t("columns.streets")}</TableHead>
                <TableHead className="text-start">{t("columns.households")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((block) => (
                <TableRow key={block.id}>
                  <TableCell className="font-medium">{block.name}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onShowStreets(block.id)}
                      className="tabular-nums text-primary hover:underline"
                    >
                      {t("streetCount", { count: block.streets })}
                    </button>
                  </TableCell>
                  <TableCell className="tabular-nums">{block.households}</TableCell>
                  <TableCell className="text-end">
                    {readOnly ? null : (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDialog({ type: "edit", block })}
                          aria-label={t("editFor", { name: block.name })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDialog({ type: "delete", block })}
                          aria-label={t("deleteFor", { name: block.name })}
                          disabled={block.streets > 0}
                          title={block.streets > 0 ? t("deleteBlocked") : undefined}
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

      {dialog?.type === "create" ? <BlockFormDialog open onOpenChange={close} areaId={areaId} /> : null}
      {dialog?.type === "edit" ? <BlockFormDialog open onOpenChange={close} areaId={areaId} block={dialog.block} /> : null}
      {dialog?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t("deleteTitle", { name: dialog.block.name })}
          description={t("deleteBody")}
          confirmLabel={t("delete")}
          destructive
          successMessage={t("deleted")}
          onConfirm={() => deleteBlockAction(dialog.block.id)}
        />
      ) : null}
    </div>
  );
}
