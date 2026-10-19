"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bulkAssignAction } from "@/app/actions/duties";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SHIFTS, type Shift } from "@/lib/duties";
import { cn } from "@/lib/utils";
import type { WorkerOption } from "@/server/duties";

type BulkAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: WorkerOption[];
  streets: { id: string; name: string; blockName: string }[];
  /** Days of the shown week that can still be planned. */
  days: string[];
};

/** One worker on several streets (and days) in one go. */
export function BulkAssignDialog({ open, onOpenChange, workers, streets, days }: BulkAssignDialogProps) {
  const t = useTranslations("duties.bulk");
  const tDuties = useTranslations("duties");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const [workerId, setWorkerId] = useState("");
  const [shift, setShift] = useState<Shift>("morning");
  const [chosenDays, setChosenDays] = useState<string[]>(days.slice(0, 1));
  const [streetIds, setStreetIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const toggle = (list: string[], value: string, checked: boolean) => (checked ? [...list, value] : list.filter((item) => item !== value));
  const dayName = (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: "short", day: "numeric", timeZone: "UTC" });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!workerId) next.workerId = "required";
    if (chosenDays.length === 0) next.days = "chooseDays";
    if (streetIds.length === 0) next.streetIds = "chooseStreets";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await bulkAssignAction({ workerId, shift, days: chosenDays, streetIds });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done", { created: result.data.created }), {
        description: result.data.skipped > 0 ? tDuties("roster.skipped", { count: result.data.skipped }) : undefined,
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field data-invalid={Boolean(errors.workerId)}>
                <FieldLabel htmlFor="bulk-worker">{t("worker")}</FieldLabel>
                <Select value={workerId} onValueChange={setWorkerId}>
                  <SelectTrigger id="bulk-worker" className="w-full">
                    <SelectValue placeholder={t("chooseWorker")} />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errorMessage(errors.workerId)}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-shift">{t("shift")}</FieldLabel>
                <Select value={shift} onValueChange={(value) => setShift(value as Shift)}>
                  <SelectTrigger id="bulk-shift" className="w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {tDuties(`shift.${item}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.days)}>
              <FieldLabel>{t("days")}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => {
                  const id = `bulk-day-${day}`;
                  const checked = chosenDays.includes(day);
                  return (
                    <Label
                      key={day}
                      htmlFor={id}
                      className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal", checked && "border-primary bg-primary/5")}
                    >
                      <Checkbox id={id} checked={checked} onCheckedChange={(value) => setChosenDays(toggle(chosenDays, day, value === true))} />
                      {dayName(day)}
                    </Label>
                  );
                })}
              </div>
              <FieldError>{errorMessage(errors.days)}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.streetIds)}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{t("streets")}</FieldLabel>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">{t("selected", { count: streetIds.length })}</span>
                  <Button type="button" variant="link" size="sm" onClick={() => setStreetIds(streets.map((street) => street.id))}>
                    {t("selectAll")}
                  </Button>
                  <Button type="button" variant="link" size="sm" onClick={() => setStreetIds([])}>
                    {t("clear")}
                  </Button>
                </div>
              </div>
              <div className={cn("grid max-h-60 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2", errors.streetIds && "border-destructive")}>
                {streets.map((street) => {
                  const id = `bulk-street-${street.id}`;
                  return (
                    <div key={street.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={streetIds.includes(street.id)}
                        onCheckedChange={(value) => setStreetIds(toggle(streetIds, street.id, value === true))}
                      />
                      <Label htmlFor={id} className="font-normal">
                        {street.name}
                        <span className="text-xs text-muted-foreground">{street.blockName}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
              <FieldError>{errorMessage(errors.streetIds)}</FieldError>
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : t("submit")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
