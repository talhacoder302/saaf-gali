"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createExpenseAction, updateExpenseAction } from "@/app/actions/expenses";
import { PhotoUpload, type PhotoValue } from "@/components/shared/photo-upload";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRupees } from "@/lib/format";
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormOutput } from "@/lib/validators/expenses";
import type { ExpenseFormOptions, ExpenseRow } from "@/server/expenses";

import { useCategoryLabel } from "./expense-labels";

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ExpenseFormOptions;
  /** Leave out to add a new expense. */
  expense?: ExpenseRow;
  defaultAreaId?: string | null;
};

/** Add or edit an expense. Used by admins (dialog on desktop) and supervisors (on their phone). */
export function ExpenseFormDialog({ open, onOpenChange, options, expense, defaultAreaId }: ExpenseFormDialogProps) {
  const t = useTranslations("expenses.form");
  const tExpenses = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const categoryLabel = useCategoryLabel();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<PhotoValue | null>(
    expense?.photoKey ? { key: expense.photoKey, url: expense.photoUrl } : null,
  );

  // An expense keeps a category that was removed from Settings later.
  const categories =
    expense && !options.categories.includes(expense.category) ? [...options.categories, expense.category] : options.categories;
  const singleArea = options.areas.length === 1 ? options.areas[0]?.id : undefined;

  const form = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expense
      ? {
          areaId: expense.areaId,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          date: expense.day,
          photoKey: expense.photoKey,
        }
      : {
          areaId: defaultAreaId ?? singleArea ?? "",
          category: "",
          description: "",
          amount: Number.NaN,
          date: options.today,
          photoKey: null,
        },
  });
  const amount = useWatch({ control: form.control, name: "amount" });
  const limit = formatRupees(options.approvalLimit);
  const overLimit = typeof amount === "number" && amount > options.approvalLimit;

  function onSubmit(values: ExpenseFormOutput) {
    const input: ExpenseFormInput = { ...values, photoKey: photo?.key ?? null };
    startTransition(async () => {
      const result = expense ? await updateExpenseAction({ ...input, id: expense.id }) : await createExpenseAction(input);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<ExpenseFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      if (expense) toast.success(tExpenses("updated"));
      else if (result.data.status === "pending") toast.success(tExpenses("createdPending", { limit }));
      else toast.success(tExpenses("created"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{expense ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="areaId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="expense-area">{t("area")}</FieldLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="expense-area" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("chooseArea")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.areas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="category"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="expense-category">{t("category")}</FieldLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="expense-category" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("chooseCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {categoryLabel(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="expense-description">{t("description")}</FieldLabel>
                  <Textarea
                    {...field}
                    id="expense-description"
                    rows={2}
                    placeholder={t("descriptionPlaceholder")}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="expense-amount">{t("amount")}</FieldLabel>
                    <div className="relative">
                      <span className="absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">Rs.</span>
                      <Input
                        id="expense-amount"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        dir="ltr"
                        className="ps-10"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                    </div>
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="expense-date">{t("date")}</FieldLabel>
                    <Input {...field} id="expense-date" type="date" max={options.today} dir="ltr" aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            {overLimit ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="status">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("needsApproval", { limit })}
              </p>
            ) : (
              <FieldDescription>{t("limitHint", { limit })}</FieldDescription>
            )}

            <Field data-invalid={Boolean(form.formState.errors.photoKey)}>
              <FieldLabel htmlFor="expense-photo">{t("photo")}</FieldLabel>
              <PhotoUpload
                id="expense-photo"
                kind="expense_receipt"
                value={photo}
                onChange={(next) => {
                  setPhoto(next);
                  form.clearErrors("photoKey");
                }}
                enabled={options.storageEnabled}
                onBusyChange={setUploading}
                invalid={Boolean(form.formState.errors.photoKey)}
              />
              <FieldError>{errorMessage(form.formState.errors.photoKey?.message)}</FieldError>
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending || uploading}>
                {isPending ? tCommon("saving") : expense ? tCommon("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
