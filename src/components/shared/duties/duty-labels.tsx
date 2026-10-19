"use client";

import { ArrowRightLeft, CheckCircle2, CircleDashed, Clock, LoaderCircle, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AttendanceState, DutyStatus } from "@/lib/duties";
import { cn } from "@/lib/utils";

/** Each status has its own icon as well as a colour, so it never rests on colour alone. */
export const DUTY_STATUS_STYLE: Record<DutyStatus, { icon: LucideIcon; className: string }> = {
  scheduled: { icon: Clock, className: "border-border bg-background text-foreground" },
  in_progress: { icon: LoaderCircle, className: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200" },
  completed: { icon: CheckCircle2, className: "border-primary/40 bg-primary/10 text-primary" },
  missed: { icon: XCircle, className: "border-destructive/40 bg-destructive/10 text-destructive" },
  reassigned: { icon: ArrowRightLeft, className: "border-dashed border-border bg-muted text-muted-foreground" },
};

export function DutyStatusBadge({ status, className }: { status: DutyStatus; className?: string }) {
  const t = useTranslations("duties.status");
  const { icon: Icon, className: tone } = DUTY_STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

export const ATTENDANCE_STYLE: Record<AttendanceState, { icon: LucideIcon; className: string }> = {
  present: { icon: CheckCircle2, className: "bg-primary/15 text-primary border-primary/30" },
  absent: { icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  pending: { icon: Clock, className: "bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800" },
  off: { icon: CircleDashed, className: "bg-transparent text-muted-foreground border-transparent" },
};
