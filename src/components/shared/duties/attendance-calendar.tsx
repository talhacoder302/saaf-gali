"use client";

import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useMonthName } from "@/components/shared/fees/fee-history";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ATTENDANCE_STATES, weekdayIndex, type AttendanceMonth } from "@/lib/duties";
import { cn } from "@/lib/utils";

import { ATTENDANCE_STYLE } from "./duty-labels";

type AttendanceCalendarProps = {
  attendance: AttendanceMonth;
  /** Month picker options (newest first); the choice goes into ?month=. Leave out for a fixed month. */
  months?: string[];
  today: string;
};

/** A month of attendance, Monday first. Each day shows an icon as well as a colour. */
export function AttendanceCalendar({ attendance, months, today }: AttendanceCalendarProps) {
  const t = useTranslations("attendance");
  const format = useFormatter();
  const monthName = useMonthName();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const first = attendance.days[0]?.day ?? `${attendance.month}-01`;
  const blanks = weekdayIndex(first);
  // Mon..Sun names in the user's language (1 Jan 2024 was a Monday). "short", not
  // "narrow": Urdu has no narrow names and would fall back to Latin letters.
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    format.dateTime(new Date(Date.UTC(2024, 0, 1 + index)), { weekday: "short", timeZone: "UTC" }),
  );
  const dayLabel = (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });

  function setMonth(month: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", month);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <section className={cn("space-y-4 rounded-xl border bg-card p-4 transition-opacity", isPending && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{t("title")}</h2>
        {months && months.length > 1 ? (
          <Select value={attendance.month} onValueChange={setMonth}>
            <SelectTrigger className="w-40" aria-label={t("month")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {monthName(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{monthName(attendance.month)}</span>
        )}
      </div>

      <p className="text-sm">
        {t("summary", { present: attendance.present, absent: attendance.absent, working: attendance.workingDays })}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={monthName(attendance.month)}>
        {weekdays.map((name, index) => (
          <div key={index} className="truncate pb-1 text-xs text-muted-foreground" role="columnheader">
            {name}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden />
        ))}
        {attendance.days.map((entry) => {
          const style = ATTENDANCE_STYLE[entry.state];
          const Icon = style.icon;
          const label = `${t("dayLabel", { date: dayLabel(entry.day), state: t(`states.${entry.state}`) })}${
            entry.duties > 0 ? `. ${t("dutiesDone", { completed: entry.completed, duties: entry.duties })}` : ""
          }`;
          return (
            <div
              key={entry.day}
              role="gridcell"
              aria-label={label}
              title={label}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm tabular-nums",
                style.className,
                entry.day === today && "ring-2 ring-ring/60",
              )}
            >
              <span>{Number(entry.day.slice(8))}</span>
              {entry.state === "off" ? null : <Icon className="size-3.5" aria-hidden />}
            </div>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ATTENDANCE_STATES.map((state) => {
          const Icon = ATTENDANCE_STYLE[state].icon;
          return (
            <li key={state} className="flex items-center gap-1">
              <span className={cn("flex size-5 items-center justify-center rounded border", ATTENDANCE_STYLE[state].className)}>
                <Icon className="size-3" aria-hidden />
              </span>
              {t(`states.${state}`)}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t("rule")}</p>
    </section>
  );
}
