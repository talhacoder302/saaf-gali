"use client";

import { ArrowRightLeft, CalendarRange, ChevronLeft, ChevronRight, Copy, ListPlus, MapPinned, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { copyLastWeekAction } from "@/app/actions/duties";
import { EmptyState } from "@/components/shared/empty-state";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, isPlannableDay, SHIFTS, weekStart } from "@/lib/duties";
import { cn } from "@/lib/utils";
import type { DutyCell, RosterView as Roster } from "@/server/duties";

import { BulkAssignDialog } from "./bulk-assign-dialog";
import { CellDialog, SHIFT_ICONS } from "./cell-dialog";
import { DUTY_STATUS_STYLE } from "./duty-labels";
import { ReassignDialog } from "./reassign-dialog";

const ALL = "all";

type DialogState = { type: "cell"; streetId: string; day: string } | { type: "bulk" } | { type: "reassign" } | { type: "copy" } | null;

/**
 * Weekly duty roster: streets as rows, days as columns, a morning and an
 * evening line in every cell. Shared by the admin and supervisor screens;
 * area, block and week live in the URL.
 */
export function RosterView({ roster }: { roster: Roster }) {
  const t = useTranslations("duties.roster");
  const tDuties = useTranslations("duties");
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const byCell = new Map<string, DutyCell[]>();
  for (const duty of roster.duties) {
    const key = `${duty.streetId}|${duty.day}`;
    byCell.set(key, [...(byCell.get(key) ?? []), duty]);
  }
  const plannableDays = roster.days.filter((day) => isPlannableDay(day, roster.today));
  const thisWeek = weekStart(roster.today);
  const dayHeader = (day: string) => ({
    weekday: format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: "short", timeZone: "UTC" }),
    date: format.dateTime(new Date(`${day}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" }),
  });
  const longDay = (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { dateStyle: "full", timeZone: "UTC" });
  const close = (open: boolean) => !open && setDialog(null);
  const noWorkers = roster.workers.length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[28rem]">
          <Select value={roster.area.id} onValueChange={(value) => setParams({ area: value, block: null })}>
            <SelectTrigger className="w-full" aria-label={t("area")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roster.areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roster.blockId ?? ALL} onValueChange={(value) => setParams({ block: value === ALL ? null : value })}>
            <SelectTrigger className="w-full" aria-label={t("block")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allBlocks")}</SelectItem>
              {roster.blocks.map((block) => (
                <SelectItem key={block.id} value={block.id}>
                  {block.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setParams({ week: addDays(roster.week, -7) })} aria-label={t("previousWeek")}>
            <ChevronLeft className="rtl:-scale-x-100" />
          </Button>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap lg:flex-none">
            <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
            {t("weekOf", { date: format.dateTime(new Date(`${roster.week}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setParams({ week: addDays(roster.week, 7) })} aria-label={t("nextWeek")}>
            <ChevronRight className="rtl:-scale-x-100" />
          </Button>
          {roster.week === thisWeek ? null : (
            <Button variant="ghost" size="sm" onClick={() => setParams({ week: null })}>
              {t("thisWeek")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDialog({ type: "copy" })} disabled={plannableDays.length === 0}>
          <Copy aria-hidden />
          {t("copyLastWeek")}
        </Button>
        <Button variant="outline" onClick={() => setDialog({ type: "bulk" })} disabled={plannableDays.length === 0 || noWorkers || roster.streets.length === 0}>
          <ListPlus aria-hidden />
          {t("bulkAssign")}
        </Button>
        <Button variant="outline" onClick={() => setDialog({ type: "reassign" })} disabled={noWorkers}>
          <ArrowRightLeft aria-hidden />
          {t("reassign")}
        </Button>
      </div>

      {noWorkers ? (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0" aria-hidden />
          {t("noWorkers")}
        </p>
      ) : null}

      {roster.streets.length === 0 ? (
        <EmptyState icon={MapPinned} title={t("noStreetsTitle")} description={t("noStreetsBody")} />
      ) : (
        <div className={cn("overflow-x-auto rounded-xl border bg-card transition-opacity", isPending && "opacity-60")}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {t("title")} · {roster.area.name} · {t("legend")}
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="sticky start-0 z-10 min-w-28 bg-card p-2 text-start font-medium">
                  {t("street")}
                </th>
                {roster.days.map((day) => {
                  const header = dayHeader(day);
                  const isToday = day === roster.today;
                  return (
                    <th key={day} scope="col" className={cn("min-w-24 p-2 text-start font-medium", isToday && "bg-primary/5")}>
                      <span className="block">{header.weekday}</span>
                      <span className={cn("block text-xs font-normal text-muted-foreground", isToday && "font-medium text-primary")}>
                        {isToday ? t("today") : header.date}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roster.streets.map((street) => (
                <tr key={street.id} className="border-b last:border-b-0">
                  <th scope="row" className="sticky start-0 z-10 bg-card p-2 text-start align-top font-normal">
                    <span className="block font-medium">{street.name}</span>
                    <span className="block text-xs text-muted-foreground">{street.blockName}</span>
                  </th>
                  {roster.days.map((day) => {
                    const duties = byCell.get(`${street.id}|${day}`) ?? [];
                    return (
                      <td key={day} className={cn("p-1 align-top", day === roster.today && "bg-primary/5")}>
                        <button
                          type="button"
                          onClick={() => setDialog({ type: "cell", streetId: street.id, day })}
                          className="flex w-full flex-col gap-1 rounded-lg p-1 text-start outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {SHIFTS.map((shift) => {
                            const duty = duties.find((item) => item.shift === shift);
                            const Icon = SHIFT_ICONS[shift];
                            const StatusIcon = duty ? DUTY_STATUS_STYLE[duty.status].icon : null;
                            return (
                              <span
                                key={shift}
                                aria-label={t("cellLabel", {
                                  street: street.name,
                                  date: longDay(day),
                                  shift: tDuties(`shift.${shift}`),
                                  worker: duty ? `${duty.workerName}, ${tDuties(`status.${duty.status}`)}` : t("empty"),
                                })}
                                className={cn(
                                  "flex min-h-7 items-center gap-1 rounded-md border px-1.5 text-xs",
                                  duty ? DUTY_STATUS_STYLE[duty.status].className : "border-dashed text-muted-foreground",
                                )}
                              >
                                <Icon className="size-3 shrink-0 opacity-60" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{duty ? duty.workerName : "—"}</span>
                                {StatusIcon && duty?.status !== "scheduled" ? <StatusIcon className="size-3 shrink-0" aria-hidden /> : null}
                              </span>
                            );
                          })}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.type === "cell"
        ? (() => {
            const street = roster.streets.find((item) => item.id === dialog.streetId);
            if (!street) return null;
            return (
              <CellDialog
                open
                onOpenChange={close}
                street={street}
                day={dialog.day}
                dayLabel={longDay(dialog.day)}
                plannable={isPlannableDay(dialog.day, roster.today)}
                duties={byCell.get(`${street.id}|${dialog.day}`) ?? []}
                workers={roster.workers}
              />
            );
          })()
        : null}
      {dialog?.type === "bulk" ? (
        <BulkAssignDialog open onOpenChange={close} workers={roster.workers} streets={roster.streets} days={plannableDays} />
      ) : null}
      {dialog?.type === "reassign" ? <ReassignDialog open onOpenChange={close} workers={roster.workers} /> : null}
      {dialog?.type === "copy" ? <CopyWeekDialog open onOpenChange={close} areaId={roster.area.id} week={roster.week} /> : null}
    </div>
  );
}

function CopyWeekDialog({ open, onOpenChange, areaId, week }: { open: boolean; onOpenChange: (open: boolean) => void; areaId: string; week: string }) {
  const t = useTranslations("duties.roster");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await copyLastWeekAction({ areaId, week });
      if (!result.ok) {
        toast.error(errorMessage(result.fieldErrors?.week ?? result.error));
        return;
      }
      toast.success(t("copied", { created: result.data.created }), {
        description: result.data.skipped > 0 ? t("skipped", { count: result.data.skipped }) : undefined,
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("copyTitle")}</DialogTitle>
          <DialogDescription>{t("copyBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={confirm} disabled={isPending}>
            <Copy aria-hidden />
            {isPending ? tCommon("saving") : t("copyLastWeek")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
