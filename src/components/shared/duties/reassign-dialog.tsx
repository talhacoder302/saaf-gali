"use client";

import { ArrowRightLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reassignTodayAction } from "@/app/actions/duties";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkerOption } from "@/server/duties";

type ReassignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: WorkerOption[];
  /** Pre-select the absent worker. */
  fromWorkerId?: string;
};

/** A worker is absent: give all of today's remaining duties to someone else in one action. */
export function ReassignDialog({ open, onOpenChange, workers, fromWorkerId }: ReassignDialogProps) {
  const t = useTranslations("duties.reassign");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [from, setFrom] = useState(fromWorkerId ?? "");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!from || !to) {
      setError("required");
      return;
    }
    if (from === to) {
      setError("sameWorker");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reassignTodayAction({ fromWorkerId: from, toWorkerId: to });
      if (!result.ok) {
        setError(result.fieldErrors?.toWorkerId ?? null);
        toast.error(errorMessage(result.error === "invalid_input" && result.fieldErrors?.toWorkerId ? result.fieldErrors.toWorkerId : result.error));
        return;
      }
      toast.success(t("done", { moved: result.data.moved }), {
        description: result.data.skipped > 0 ? t("notMoved", { count: result.data.skipped }) : undefined,
      });
      onOpenChange(false);
    });
  }

  const picker = (id: string, value: string, onChange: (value: string) => void, exclude?: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("choose")} />
      </SelectTrigger>
      <SelectContent>
        {workers
          .filter((worker) => worker.id !== exclude)
          .map((worker) => (
            <SelectItem key={worker.id} value={worker.id}>
              {worker.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reassign-from">{t("from")}</FieldLabel>
              {picker("reassign-from", from, setFrom)}
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="reassign-to">{t("to")}</FieldLabel>
              {picker("reassign-to", to, setTo, from)}
              <FieldError>{errorMessage(error)}</FieldError>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                <ArrowRightLeft aria-hidden />
                {isPending ? tCommon("saving") : t("submit")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
