"use client";

import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { importHouseholdsAction, previewImportAction } from "@/app/admin/households/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExcelColumn } from "@/lib/households";
import { cn } from "@/lib/utils";

import type { ImportPreview } from "./types";

const SHOWN_ROWS = 300;

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const t = useTranslations("households.import");
  const tColumns = useTranslations("households.excelColumns");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [isChecking, startChecking] = useTransition();
  const [isImporting, startImporting] = useTransition();

  const columnLabel = (column: ExcelColumn | null) => (column ? tColumns(column) : "");

  function check() {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      toast.error(errorMessage("import_no_file"));
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startChecking(async () => {
      const result = await previewImportAction(formData);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setPreview(result.data);
      setOnlyProblems(result.data.invalidCount > 0 && result.data.validCount === 0);
    });
  }

  function reset() {
    setPreview(null);
    setFileName(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function runImport() {
    if (!preview) return;
    const rows = preview.rows.filter((row) => row.issues.length === 0).map((row) => row.row);
    startImporting(async () => {
      const result = await importHouseholdsAction(rows);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done", { count: result.data.imported }));
      if (result.data.skipped > 0) toast.warning(t("skipped", { count: result.data.skipped }));
      onOpenChange(false);
    });
  }

  const visibleRows = preview
    ? (onlyProblems ? preview.rows.filter((row) => row.issues.length > 0) : preview.rows).slice(0, SHOWN_ROWS)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{preview ? t("previewDescription") : t("description")}</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-5">
            <ol className="space-y-4 text-sm">
              <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <strong>1.</strong> {t("step1")}
                </span>
                <Button asChild variant="outline">
                  <a href="/admin/households/template" download>
                    <Download aria-hidden />
                    {t("downloadTemplate")}
                  </a>
                </Button>
              </li>
              <li>
                <strong>2.</strong> {t("step2")}
              </li>
              <li className="space-y-2">
                <span>
                  <strong>3.</strong> {t("step3")}
                </span>
                <label
                  htmlFor="import-file"
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center hover:border-primary"
                >
                  <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{fileName ?? t("chooseFile")}</span>
                  <span className="text-xs text-muted-foreground">{t("fileHint")}</span>
                  <input
                    ref={fileInput}
                    id="import-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  />
                </label>
              </li>
            </ol>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="button" onClick={check} disabled={!fileName || isChecking}>
                <Upload aria-hidden />
                {isChecking ? t("checking") : t("check")}
              </Button>
            </DialogFooter>
          </div>
        ) : preview.missingColumns.length > 0 ? (
          <div className="space-y-4">
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("missingColumns", { columns: preview.missingColumns.map(columnLabel).join(", ") })}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                {t("chooseAnother")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {t("validCount", { count: preview.validCount })}
                </Badge>
                {preview.invalidCount > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="size-3.5" aria-hidden />
                    {t("invalidCount", { count: preview.invalidCount })}
                  </Badge>
                ) : null}
              </div>
              {preview.invalidCount > 0 ? (
                <div className="flex items-center gap-2">
                  <Switch id="only-problems" checked={onlyProblems} onCheckedChange={setOnlyProblems} />
                  <Label htmlFor="only-problems">{t("onlyProblems")}</Label>
                </div>
              ) : null}
            </div>

            <div className="max-h-[50dvh] overflow-auto rounded-xl border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-start">{t("row")}</TableHead>
                    <TableHead className="text-start">{tColumns("House number")}</TableHead>
                    <TableHead className="text-start">{tColumns("Street")}</TableHead>
                    <TableHead className="text-start">{tColumns("Owner name")}</TableHead>
                    <TableHead className="text-start">{t("problems")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map(({ row, issues }) => (
                    <TableRow key={row.rowNumber} className={cn(issues.length > 0 && "bg-destructive/5")}>
                      <TableCell className="tabular-nums text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{row["House number"] || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {[row.Area, row.Block, row.Street].filter(Boolean).join(" › ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{row["Owner name"] || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 className="size-4" aria-hidden />
                            {t("ok")}
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-destructive">
                            {issues.map((issue, index) => (
                              <li key={index}>
                                {issue.column ? <span className="font-medium">{columnLabel(issue.column)}: </span> : null}
                                {errorMessage(issue.code)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.rows.length > SHOWN_ROWS ? (
              <p className="text-xs text-muted-foreground">{t("truncated", { shown: SHOWN_ROWS })}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                {t("chooseAnother")}
              </Button>
              <Button type="button" onClick={runImport} disabled={preview.validCount === 0 || isImporting}>
                {isImporting ? t("importing") : t("importButton", { count: preview.validCount })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
