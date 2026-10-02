"use client";

import { ImageIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";

import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExpenseRow } from "@/server/expenses";

import { ExpenseStatusBadge, useCategoryLabel, useDayLabel } from "./expense-labels";

type ExpenseCardProps = {
  expense: ExpenseRow;
  /** Show who added it (approvals screen). */
  showAddedBy?: boolean;
  /** Buttons under the card (approve / reject). */
  actions?: React.ReactNode;
  className?: string;
};

/** One expense as a card, for the phone screens of supervisors and committee members. */
export function ExpenseCard({ expense, showAddedBy, actions, className }: ExpenseCardProps) {
  const t = useTranslations("expenses");
  const format = useFormatter();
  const categoryLabel = useCategoryLabel();
  const dayLabel = useDayLabel();

  return (
    <article className={cn("space-y-3 rounded-2xl border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            {categoryLabel(expense.category)} · {expense.areaName} · {dayLabel(expense.day)}
          </p>
          <p className="font-medium break-words">{expense.description}</p>
          {showAddedBy ? <p className="text-xs text-muted-foreground">{t("addedBy", { name: expense.createdByName })}</p> : null}
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums">{formatRupees(expense.amount)}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <ExpenseStatusBadge status={expense.status} />
        {expense.photoUrl ? (
          <a
            href={expense.photoUrl}
            target="_blank"
            rel="noreferrer"
            className="relative size-12 overflow-hidden rounded-lg border bg-muted"
            aria-label={t("viewPhoto")}
          >
            <Image src={expense.photoUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />
          </a>
        ) : expense.photoKey ? (
          <ImageIcon className="size-5 text-muted-foreground" aria-label={t("viewPhoto")} />
        ) : null}
      </div>

      {expense.reviewedByName ? (
        <p className="rounded-lg bg-muted/60 p-2 text-sm">
          <span className="text-muted-foreground">
            {t("reviewedBy", {
              name: expense.reviewedByName,
              date: expense.reviewedAt ? format.dateTime(new Date(expense.reviewedAt), { dateStyle: "medium" }) : "",
            })}
          </span>
          {expense.reviewNote ? <span className="block">{expense.reviewNote}</span> : null}
        </p>
      ) : null}

      {actions}
    </article>
  );
}
