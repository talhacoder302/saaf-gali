"use client";

import { ChevronRight, Smartphone, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { ATTENDANCE_STYLE } from "@/components/shared/duties/duty-labels";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/server/workers";

/** Workers in the supervisor's areas and how today is going; each opens their attendance. */
export function TeamView({ team }: { team: TeamMember[] }) {
  const t = useTranslations("duties.team");
  const tAttendance = useTranslations("attendance.states");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {team.length === 0 ? (
        <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ul className="space-y-2">
          {team.map((member) => {
            const style = ATTENDANCE_STYLE[member.today.state];
            const Icon = style.icon;
            return (
              <li key={member.id}>
                <Link
                  href={`/supervisor/team/${member.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary active:scale-[0.99]"
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border", style.className)}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{member.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {member.today.duties > 0
                        ? `${tAttendance(member.today.state)} · ${t("todayDone", { completed: member.today.completed, duties: member.today.duties })}`
                        : t("noDutyToday")}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Smartphone className="size-3.5" aria-hidden />
                      {member.hasLogin ? t("hasLogin") : t("noLogin")}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
