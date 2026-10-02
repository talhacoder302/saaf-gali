"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reviewExpenseAction } from "@/app/actions/expenses";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatRupees } from "@/lib/format";
import type { ExpenseRow } from "@/server/expenses";

type ReviewExpenseDialogProps = {
  expense: ExpenseRow;
  decision: "approve" | "reject";
  onOpenChange: (open: boolean) => void;
};

/** Approve (note optional) or reject (reason required). Used by super admins and the committee. */
export function ReviewExpenseDialog({ expense, decision, onOpenChange }: ReviewExpenseDialogProps) {
  const t = useTranslations("expenses.review");
  const tExpenses = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  function submit() {
    if (decision === "reject" && note.trim().length < 3) {
      setNoteError("rejectNoteRequired");
      return;
    }
    startTransition(async () => {
      const result = await reviewExpenseAction({ id: expense.id, decision, note });
      if (!result.ok) {
        setNoteError(result.fieldErrors?.note ?? null);
        toast.error(errorMessage(result.error));
        if (result.error === "expense_already_reviewed") onOpenChange(false);
        return;
      }
      toast.success(decision === "approve" ? t("approved") : t("rejected"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{decision === "approve" ? t("approveTitle") : t("rejectTitle")}</DialogTitle>
          <DialogDescription>
            {t("summary", { description: expense.description, amount: formatRupees(expense.amount), area: expense.areaName })}
          </DialogDescription>
        </DialogHeader>
        <Field data-invalid={Boolean(noteError)}>
          <FieldLabel htmlFor="review-note">{t("note")}</FieldLabel>
          <Textarea
            id="review-note"
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(null);
            }}
            placeholder={decision === "approve" ? t("notePlaceholder") : t("reasonPlaceholder")}
            aria-invalid={Boolean(noteError)}
          />
          <FieldError>{errorMessage(noteError)}</FieldError>
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" variant={decision === "reject" ? "destructive" : "default"} disabled={isPending} onClick={submit}>
            {decision === "approve" ? tExpenses("approve") : tExpenses("reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
