"use client";

import { Ban, Plus, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseCard } from "@/components/shared/expenses/expense-card";
import { ExpenseFormDialog } from "@/components/shared/expenses/expense-form-dialog";
import { Button } from "@/components/ui/button";
import type { ExpenseFormOptions, ExpenseRow } from "@/server/expenses";

type MyExpensesViewProps = { options: ExpenseFormOptions; expenses: ExpenseRow[] };

/** Supervisor's phone screen: a big "Add expense" button and their own expenses with status. */
export function MyExpensesView({ options, expenses }: MyExpensesViewProps) {
  const t = useTranslations("expenses");
  const [adding, setAdding] = useState(false);
  const canAdd = options.canAdd && options.areas.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("mine.title")}</h1>
        <p className="text-muted-foreground">{t("mine.intro")}</p>
      </div>

      {canAdd ? (
        <Button size="lg" className="h-14 w-full text-base" onClick={() => setAdding(true)}>
          <Plus className="size-5" aria-hidden />
          {t("add")}
        </Button>
      ) : (
        <EmptyState icon={Ban} title={t("mine.notAllowedTitle")} description={t("mine.notAllowedBody")} />
      )}

      <section className="space-y-3">
        <h2 className="font-medium">{t("mine.recentTitle")}</h2>
        {expenses.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t("mine.emptyTitle")} description={t("mine.emptyBody")} />
        ) : (
          expenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} />)
        )}
      </section>

      {adding ? <ExpenseFormDialog open onOpenChange={setAdding} options={options} /> : null}
    </div>
  );
}
