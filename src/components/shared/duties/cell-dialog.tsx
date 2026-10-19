"use client";

import { Lock, Moon, Sun, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { assignDutyAction, removeDutyAction } from "@/app/actions/duties";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SHIFTS, type Shift } from "@/lib/duties";
import type { DutyCell, WorkerOption } from "@/server/duties";

import { MarkButtons } from "./duty-card";
import { DutyStatusBadge } from "./duty-labels";

export const SHIFT_ICONS = { morning: Sun, evening: Moon } as const;

type CellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  street: { id: string; name: string; blockName: string };
  day: string;
  dayLabel: string;
  /** Today or later (and within the planning window). */
  plannable: boolean;
  duties: DutyCell[];
  workers: WorkerOption[];
};

/** One roster cell: a street on a day, with a worker picker per shift. */
export function CellDialog({ open, onOpenChange, street, day, dayLabel, plannable, duties, workers }: CellDialogProps) {
  const t = useTranslations("duties.cell");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { street: `${street.name} · ${street.blockName}` })}</DialogTitle>
          <DialogDescription>{t("description", { date: dayLabel })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {SHIFTS.map((shift) => (
            <ShiftEditor
              key={shift}
              shift={shift}
              streetId={street.id}
              day={day}
              plannable={plannable}
              duty={duties.find((duty) => duty.shift === shift) ?? null}
              workers={workers}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShiftEditor({
  shift,
  streetId,
  day,
  plannable,
  duty,
  workers,
}: {
  shift: Shift;
  streetId: string;
  day: string;
  plannable: boolean;
  duty: DutyCell | null;
  workers: WorkerOption[];
}) {
  const t = useTranslations("duties.cell");
  const tDuties = useTranslations("duties");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [workerId, setWorkerId] = useState(duty?.workerId ?? "");
  const [isPending, startTransition] = useTransition();
  const Icon = SHIFT_ICONS[shift];
  const canPick = duty ? duty.editable : plannable;
  // A worker who left can still be on an old duty; show them, but only offer active workers.
  const options = duty && !workers.some((worker) => worker.id === duty.workerId)
    ? [{ id: duty.workerId, name: duty.workerName, hasLogin: duty.workerHasLogin }, ...workers]
    : workers;

  function save() {
    if (!workerId) return;
    startTransition(async () => {
      const result = await assignDutyAction({ streetId, day, shift, workerId });
      if (result.ok) toast.success(t("saved"));
      else toast.error(errorMessage(result.fieldErrors?.workerId ?? result.fieldErrors?.day ?? result.error));
    });
  }

  function remove() {
    if (!duty) return;
    startTransition(async () => {
      const result = await removeDutyAction(duty.id);
      if (result.ok) {
        setWorkerId("");
        toast.success(t("removed"));
      } else toast.error(errorMessage(result.error));
    });
  }

  return (
    <section className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {tDuties(`shift.${shift}`)}
        </h3>
        {duty ? <DutyStatusBadge status={duty.status} /> : null}
      </div>

      {duty?.reassignedFromName ? <p className="text-xs text-muted-foreground">{tDuties("instead", { name: duty.reassignedFromName })}</p> : null}

      {canPick ? (
        <div className="flex gap-2">
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger className="w-full" aria-label={`${tDuties(`shift.${shift}`)}: ${t("worker")}`}>
              <SelectValue placeholder={t("nobody")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  {worker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={save} disabled={isPending || !workerId || workerId === duty?.workerId}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
          {duty ? (
            <Button type="button" variant="outline" size="icon" onClick={remove} disabled={isPending} aria-label={t("remove")}>
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : duty ? (
        <div className="space-y-2">
          <p className="font-medium">{duty.workerName}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            {t("locked")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("notPlannable")}</p>
      )}

      {duty && !duty.workerHasLogin ? <MarkButtons dutyId={duty.id} actions={duty.actions} /> : null}
      {duty && duty.workerHasLogin && duty.actions.includes("miss") ? <MarkButtons dutyId={duty.id} actions={["miss"]} /> : null}
    </section>
  );
}
