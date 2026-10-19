"use client";

import { CheckCircle2, MapPin, Play, Smartphone, UserRound, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { markDutyAction } from "@/app/actions/duties";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import type { MarkAction } from "@/lib/duties";
import { cn } from "@/lib/utils";
import type { TodayDuty } from "@/server/duties";

import { DutyStatusBadge } from "./duty-labels";

const MARK_ICONS: Record<MarkAction, LucideIcon> = { start: Play, complete: CheckCircle2, miss: XCircle };

/** Mark buttons for one duty (supervisors, for workers without a phone). */
export function MarkButtons({ dutyId, actions, size = "default" }: { dutyId: string; actions: MarkAction[]; size?: "default" | "lg" }) {
  const t = useTranslations("duties.mark");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();

  if (actions.length === 0) return null;

  function mark(action: MarkAction) {
    startTransition(async () => {
      const result = await markDutyAction({ id: dutyId, action });
      if (result.ok) toast.success(t("saved"));
      else toast.error(errorMessage(result.error));
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = MARK_ICONS[action];
        return (
          <Button
            key={action}
            type="button"
            size={size}
            variant={action === "complete" ? "default" : action === "miss" ? "outline" : "secondary"}
            disabled={isPending}
            onClick={() => mark(action)}
            className={cn(size === "lg" && "h-11 flex-1 text-base")}
          >
            <Icon aria-hidden />
            {t(action)}
          </Button>
        );
      })}
    </div>
  );
}

type DutyCardProps = {
  duty: TodayDuty;
  /** Show who does it (supervisor view); the worker's own screen leaves it out. */
  showWorker?: boolean;
  /** Show the mark buttons the signed-in user may use. */
  canMark?: boolean;
  /** Bigger text for the worker's phone. */
  large?: boolean;
};

/** One duty: street, shift, status and (for supervisors) who does it and the mark buttons. */
export function DutyCard({ duty, showWorker, canMark, large }: DutyCardProps) {
  const t = useTranslations("duties");
  const tMark = useTranslations("duties.mark");

  return (
    <article className={cn("space-y-3 rounded-2xl border bg-card p-4", duty.status === "reassigned" && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={cn("flex items-center gap-2 font-semibold break-words", large ? "text-xl" : "text-base")}>
            <MapPin className={cn("shrink-0 text-primary", large ? "size-6" : "size-4")} aria-hidden />
            {duty.streetName}
          </p>
          <p className={cn("text-muted-foreground", large ? "text-base" : "text-sm")}>
            {duty.blockName} · {duty.areaName} · {t(`shift.${duty.shift}`)}
          </p>
        </div>
        <DutyStatusBadge status={duty.status} className={large ? "text-sm" : undefined} />
      </div>

      {showWorker ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            {duty.workerName}
          </span>
          {duty.reassignedFromName ? <span className="text-muted-foreground">{t("instead", { name: duty.reassignedFromName })}</span> : null}
          {canMark && duty.workerHasLogin ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="size-3.5" aria-hidden />
              {tMark("hasPhone")}
            </span>
          ) : null}
        </div>
      ) : duty.reassignedFromName ? (
        <p className="text-sm text-muted-foreground">{t("instead", { name: duty.reassignedFromName })}</p>
      ) : null}

      {canMark ? <MarkButtons dutyId={duty.id} actions={duty.actions} /> : null}
    </article>
  );
}
