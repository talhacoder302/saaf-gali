"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { isBuiltInCategory, type ExpenseStatus } from "@/lib/expenses";

/** Built-in categories are translated; custom ones from Settings show as typed. */
export function useCategoryLabel() {
  const t = useTranslations("expenses.category");
  return useCallback((category: string) => (isBuiltInCategory(category) ? t(category) : category), [t]);
}

/** "2026-09-29" -> "29 Sep 2026" in the user's language. The day is already in Pakistan time. */
export function useDayLabel() {
  const format = useFormatter();
  return useCallback(
    (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }),
    [format],
  );
}

const VARIANT: Record<ExpenseStatus, "default" | "secondary" | "outline" | "destructive"> = {
  auto: "secondary",
  approved: "default",
  pending: "outline",
  rejected: "destructive",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const t = useTranslations("expenses.status");
  return (
    <Badge variant={VARIANT[status]} className={status === "pending" ? "border-amber-500 text-amber-700 dark:text-amber-400" : undefined}>
      {t(status)}
    </Badge>
  );
}
