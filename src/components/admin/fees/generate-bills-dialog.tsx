"use client";

import { CheckCircle2, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateBillsAction } from "@/app/admin/fees/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GenerateResult } from "@/server/billing-core";

const ALL = "all";

type GenerateBillsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: string[];
  defaultMonth: string;
  areas: { id: string; name: string }[];
  defaultAreaId: string | null;
  monthName: (month: string) => string;
};

export function GenerateBillsDialog({
  open,
  onOpenChange,
  months,
  defaultMonth,
  areas,
  defaultAreaId,
  monthName,
}: GenerateBillsDialogProps) {
  const t = useTranslations("fees.generate");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [month, setMonth] = useState(defaultMonth);
  const [areaId, setAreaId] = useState<string>(defaultAreaId ?? ALL);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const response = await generateBillsAction({ month, areaId: areaId === ALL ? null : areaId });
      if (!response.ok) {
        toast.error(errorMessage(response.error));
        return;
      }
      setResult(response.data);
      toast.success(t("done", { count: response.data.created }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-accent p-4 text-accent-foreground">
              <CheckCircle2 className="size-8 shrink-0" aria-hidden />
              <p className="font-medium">{t("summaryTitle", { month: monthName(result.month) })}</p>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <dt>{t("created")}</dt>
              <dd className="text-end font-semibold tabular-nums">{result.created}</dd>
              <dt className="text-muted-foreground">{t("alreadyBilled")}</dt>
              <dd className="text-end tabular-nums">{result.alreadyBilled}</dd>
              <dt className="text-muted-foreground">{t("notBillable")}</dt>
              <dd className="text-end tabular-nums">{result.notBillable}</dd>
            </dl>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{tCommon("done")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="generate-month">{t("month")}</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="generate-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((option) => (
                    <SelectItem key={option} value={option}>
                      {monthName(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-area">{t("area")}</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger id="generate-area" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allAreas")}</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{t("safeNote")}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={generate} disabled={isPending}>
                <ReceiptText aria-hidden />
                {isPending ? t("working") : t("button")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
