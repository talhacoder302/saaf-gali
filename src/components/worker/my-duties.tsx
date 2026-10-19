"use client";

import { CalendarCheck, Camera, ClipboardList, UserX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { AttendanceCalendar } from "@/components/shared/duties/attendance-calendar";
import { DutyCard } from "@/components/shared/duties/duty-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { MyDuties, TodayDuty } from "@/server/duties";

/** Today's duties as big cards: street, shift and status. */
export function TodayList({ data }: { data: MyDuties }) {
  const t = useTranslations("workerPortal");

  if (!data.worker) return <EmptyState icon={UserX} title={t("notLinkedTitle")} description={t("notLinkedBody")} />;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ClipboardList className="size-6 text-primary" aria-hidden />
        {t("today")}
      </h2>
      {data.duties.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t("noDutiesTitle")} description={t("noDutiesBody")} />
      ) : (
        <div className="space-y-3">
          {data.duties.map((duty) => (
            <DutyCard key={duty.id} duty={duty} large />
          ))}
        </div>
      )}
      {data.attendance ? (
        <p className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-base font-medium text-primary">
          <CalendarCheck className="size-5" aria-hidden />
          {t("attendanceThisMonth", { present: data.attendance.present })}
        </p>
      ) : null}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("photosSoon")}
      </p>
    </section>
  );
}

/** The coming days, grouped by day, and this month's attendance. */
export function UpcomingDuties({ data }: { data: MyDuties }) {
  const t = useTranslations("workerPortal");
  const format = useFormatter();

  if (!data.worker) return <EmptyState icon={UserX} title={t("notLinkedTitle")} description={t("notLinkedBody")} />;

  const byDay = new Map<string, TodayDuty[]>();
  for (const duty of data.upcoming) byDay.set(duty.day, [...(byDay.get(duty.day) ?? []), duty]);
  const dayTitle = (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("myDutiesTitle")}</h1>
      <TodayList data={data} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("upcoming")}</h2>
        {byDay.size === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{t("noUpcoming")}</p>
        ) : (
          [...byDay].map(([day, duties]) => (
            <div key={day} className="space-y-2">
              <h3 className="font-medium text-muted-foreground">{dayTitle(day)}</h3>
              {duties.map((duty) => (
                <DutyCard key={duty.id} duty={duty} />
              ))}
            </div>
          ))
        )}
      </section>
      {data.attendance ? <AttendanceCalendar attendance={data.attendance} today={data.today} /> : null}
    </div>
  );
}
