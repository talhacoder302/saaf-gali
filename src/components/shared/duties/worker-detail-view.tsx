"use client";

import { ArrowLeft, CalendarDays, MapPinned, Phone, Wallet } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";

import { useDayLabel } from "@/components/shared/expenses/expense-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayStatus } from "@/lib/duties";
import { formatRupees } from "@/lib/format";
import { formatMobile } from "@/lib/mobile";
import type { WorkerDetail } from "@/server/workers";

import { AttendanceCalendar } from "./attendance-calendar";
import { DutyStatusBadge } from "./duty-labels";

type WorkerDetailViewProps = {
  detail: WorkerDetail;
  backHref: string;
  backLabel: string;
  /** Salary is for admins only. */
  showSalary?: boolean;
  actions?: React.ReactNode;
};

/** A worker's details, attendance calendar and the month's duties. */
export function WorkerDetailView({ detail, backHref, backLabel, showSalary, actions }: WorkerDetailViewProps) {
  const t = useTranslations("workers");
  const tDuties = useTranslations("duties");
  const format = useFormatter();
  const dayLabel = useDayLabel();
  const { worker } = detail;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href={backHref}>
          <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
          {backLabel}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{worker.name}</h1>
            <Badge variant={worker.status === "active" ? "default" : "outline"}>{t(`status.${worker.status}`)}</Badge>
            {worker.login ? <Badge variant="secondary">{t(worker.login.status === "active" ? "login.active" : "login.disabled")}</Badge> : null}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Phone className="size-4" aria-hidden />
              {worker.mobile ? <span dir="ltr">{formatMobile(worker.mobile)}</span> : t("noPhone")}
            </li>
            <li className="flex items-center gap-1.5">
              <MapPinned className="size-4" aria-hidden />
              {format.list(worker.areaNames)}
            </li>
            <li className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {t("detail.joined", { date: dayLabel(worker.joiningDate) })}
            </li>
            {showSalary ? (
              <li className="flex items-center gap-1.5">
                <Wallet className="size-4" aria-hidden />
                {t("detail.salary", { amount: formatRupees(worker.monthlySalary) })}
              </li>
            ) : null}
          </ul>
        </div>
        {actions}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <AttendanceCalendar attendance={detail.attendance} months={detail.months} today={detail.today} />

        <section className="space-y-3">
          <h2 className="font-medium">{t("detail.dutiesTitle")}</h2>
          {detail.duties.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("detail.noDuties")}</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {detail.duties.map((duty) => (
                <li key={duty.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{duty.streetName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dayLabel(duty.day)} · {tDuties(`shift.${duty.shift}`)} · {duty.areaName}
                    </p>
                  </div>
                  <DutyStatusBadge status={displayStatus(duty.status, duty.day, detail.today)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
