"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseCard } from "@/components/shared/expenses/expense-card";
import { ReviewExpenseDialog } from "@/components/shared/expenses/review-expense-dialog";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/format";
import type { ApprovalQueue, ExpenseRow } from "@/server/expenses";

type Review = { expense: ExpenseRow; decision: "approve" | "reject" };

/** Committee member's phone screen: pending expenses with big approve / reject buttons. */
export function ApprovalsView({ queue }: { queue: ApprovalQueue }) {
  const t = useTranslations("expenses");
  const [review, setReview] = useState<Review | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("approvals.title")}</h1>
        <p className="text-muted-foreground">{t("approvals.intro", { limit: formatRupees(queue.approvalLimit) })}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">{t("approvals.pendingTitle")}</h2>
        {queue.pending.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t("approvals.emptyTitle")} description={t("approvals.emptyBody")} />
        ) : (
          queue.pending.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              showAddedBy
              actions={
                expense.canReview ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" className="h-12" onClick={() => setReview({ expense, decision: "approve" })}>
                      <Check aria-hidden />
                      {t("approve")}
                    </Button>
                    <Button size="lg" variant="outline" className="h-12" onClick={() => setReview({ expense, decision: "reject" })}>
                      <X aria-hidden />
                      {t("reject")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("approvals.ownExpense")}</p>
                )
              }
            />
          ))
        )}
      </section>

      {queue.recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-medium">{t("approvals.recentTitle")}</h2>
          {queue.recent.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} showAddedBy />
          ))}
        </section>
      ) : null}

      {review ? (
        <ReviewExpenseDialog
          key={review.expense.id}
          expense={review.expense}
          decision={review.decision}
          onOpenChange={(open) => !open && setReview(null)}
        />
      ) : null}
    </div>
  );
}
