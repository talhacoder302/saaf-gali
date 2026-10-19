"use client";

import { ArrowRightLeft, CalendarRange, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { DutyCard } from "@/components/shared/duties/duty-card";
import { DUTY_STATUS_STYLE } from "@/components/shared/duties/duty-labels";
import { ReassignDialog } from "@/components/shared/duties/reassign-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SupervisorToday } from "@/server/duties";

const COUNTED = ["scheduled", "in_progress", "completed", "missed"] as const;

/** Today's duties on the supervisor's streets, with marking for workers without a phone. */
export function TodayDuties({ data }: { data: SupervisorToday }) {
  const t = useTranslations("duties.today");
  const tStatus = useTranslations("duties.status");
  const tRoster = useTranslations("duties.roster");
  const [reassigning, setReassigning] = useState(false);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{data.ownStreets ? t("ownStreets") : t("areaStreets")}</p>
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {COUNTED.map((status) => {
          const Icon = DUTY_STATUS_STYLE[status].icon;
          return (
            <li key={status} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-center", DUTY_STATUS_STYLE[status].className)}>
              <Icon className="size-4" aria-hidden />
              <span className="text-xl font-semibold tabular-nums">{data.counts[status]}</span>
              <span className="text-[11px] leading-tight">{tStatus(status)}</span>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link href="/supervisor/roster">
            <CalendarRange aria-hidden />
            {t("openRoster")}
          </Link>
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setReassigning(true)} disabled={data.workers.length < 2}>
          <ArrowRightLeft aria-hidden />
          {tRoster("reassign")}
        </Button>
      </div>

      {data.unassignedStreets > 0 ? <p className="text-sm text-muted-foreground">{t("unassigned", { count: data.unassignedStreets })}</p> : null}

      {data.duties.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="space-y-3">
          {data.duties.map((duty) => (
            <DutyCard key={duty.id} duty={duty} showWorker canMark />
          ))}
        </div>
      )}

      {reassigning ? <ReassignDialog open onOpenChange={(open) => !open && setReassigning(false)} workers={data.workers} /> : null}
    </section>
  );
}
