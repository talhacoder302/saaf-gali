"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { updateSettingsAction } from "@/app/admin/settings/actions";
import { useCategoryLabel } from "@/components/shared/expenses/expense-labels";
import { PhotoUpload, type PhotoValue } from "@/components/shared/photo-upload";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { categoryKey, isBuiltInCategory } from "@/lib/expenses";
import { categoryNameSchema, MAX_EXPENSE_CATEGORIES, settingsFormSchema, type SettingsFormInput, type SettingsFormOutput } from "@/lib/validators/settings";
import type { SettingsView } from "@/server/settings-admin";

function numberInputProps(value: number, onChange: (value: number) => void) {
  return {
    type: "number" as const,
    inputMode: "numeric" as const,
    dir: "ltr" as const,
    step: 1,
    value: Number.isNaN(value) ? "" : value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value === "" ? Number.NaN : Number(event.target.value)),
  };
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 rounded-xl border bg-card p-5 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <FieldGroup>{children}</FieldGroup>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: SettingsView }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const categoryLabel = useCategoryLabel();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [logo, setLogo] = useState<PhotoValue | null>(settings.logoKey ? { key: settings.logoKey, url: settings.logoUrl } : null);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const form = useForm<SettingsFormInput, unknown, SettingsFormOutput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      organisationName: settings.organisationName,
      logoKey: settings.logoKey,
      receiptPrefix: settings.receiptPrefix,
      feeDueDay: settings.feeDueDay,
      expenseApprovalLimit: settings.expenseApprovalLimit,
      supervisorsCanAddExpenses: settings.supervisorsCanAddExpenses,
      expenseCategories: settings.expenseCategories,
    },
  });
  const prefix = useWatch({ control: form.control, name: "receiptPrefix" });
  const categories = useWatch({ control: form.control, name: "expenseCategories" });

  function addCategory() {
    const parsed = categoryNameSchema.safeParse(newCategory);
    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? "invalid");
      return;
    }
    if (categories.some((name) => categoryKey(name) === categoryKey(parsed.data))) {
      setCategoryError("categoryDuplicate");
      return;
    }
    if (categories.length >= MAX_EXPENSE_CATEGORIES) {
      setCategoryError("tooManyCategories");
      return;
    }
    form.setValue("expenseCategories", [...categories, parsed.data], { shouldDirty: true, shouldValidate: true });
    setNewCategory("");
    setCategoryError(null);
  }

  function onSubmit(values: SettingsFormOutput) {
    startTransition(async () => {
      const result = await updateSettingsAction({ ...values, logoKey: logo?.key ?? null });
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<SettingsFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Section title={t("sections.organisation")} hint={t("sections.organisationHint")}>
        <Controller
          name="organisationName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-name">{t("organisationName")}</FieldLabel>
              <Input {...field} id="settings-name" aria-invalid={fieldState.invalid} />
              <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <Field data-invalid={Boolean(form.formState.errors.logoKey)}>
          <FieldLabel htmlFor="settings-logo">{t("logo")}</FieldLabel>
          <PhotoUpload
            id="settings-logo"
            kind="logo"
            value={logo}
            onChange={setLogo}
            enabled={settings.storageEnabled}
            keepFormat
            onBusyChange={setUploading}
            className="max-w-md"
          />
          <FieldDescription>{t("logoHint")}</FieldDescription>
          <FieldError>{errorMessage(form.formState.errors.logoKey?.message)}</FieldError>
        </Field>
      </Section>

      <Section title={t("sections.fees")} hint={t("sections.feesHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="receiptPrefix"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-prefix">{t("receiptPrefix")}</FieldLabel>
                <Input
                  {...field}
                  id="settings-prefix"
                  dir="ltr"
                  maxLength={6}
                  className="uppercase"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  {t("receiptPrefixHint", { example: `${(prefix || "SG").toUpperCase()}-SAT-000123` })}
                </FieldDescription>
                <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="feeDueDay"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-due-day">{t("feeDueDay")}</FieldLabel>
                <Input
                  id="settings-due-day"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  min={1}
                  max={28}
                  {...numberInputProps(field.value, field.onChange)}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>{t("feeDueDayHint")}</FieldDescription>
                <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>
      </Section>

      <Section title={t("sections.expenses")} hint={t("sections.expensesHint")}>
        <Controller
          name="expenseApprovalLimit"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="max-w-xs">
              <FieldLabel htmlFor="settings-limit">{t("approvalLimit")}</FieldLabel>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">Rs.</span>
                <Input
                  id="settings-limit"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  min={0}
                  className="ps-10"
                  {...numberInputProps(field.value, field.onChange)}
                  aria-invalid={fieldState.invalid}
                />
              </div>
              <FieldDescription>{t("approvalLimitHint")}</FieldDescription>
              <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <Controller
          name="supervisorsCanAddExpenses"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="settings-supervisors" checked={field.value} onCheckedChange={field.onChange} />
              <div className="space-y-1">
                <FieldLabel htmlFor="settings-supervisors">{t("supervisorsCanAdd")}</FieldLabel>
                <FieldDescription>{t("supervisorsCanAddHint")}</FieldDescription>
              </div>
            </Field>
          )}
        />
        <Field data-invalid={Boolean(form.formState.errors.expenseCategories) || Boolean(categoryError)}>
          <FieldLabel htmlFor="settings-new-category">{t("categories")}</FieldLabel>
          <FieldDescription>{t("categoriesHint")}</FieldDescription>
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category}>
                <Badge variant="secondary" className="gap-1 py-1 ps-3 pe-1 text-sm">
                  {categoryLabel(category)}
                  {isBuiltInCategory(category) ? null : <span className="text-xs text-muted-foreground">({t("custom")})</span>}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={() =>
                      form.setValue(
                        "expenseCategories",
                        categories.filter((name) => name !== category),
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                    aria-label={t("removeCategory", { name: categoryLabel(category) })}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
          <div className="flex max-w-md gap-2">
            <Input
              id="settings-new-category"
              value={newCategory}
              onChange={(event) => {
                setNewCategory(event.target.value);
                setCategoryError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCategory();
                }
              }}
              placeholder={t("newCategoryPlaceholder")}
              aria-label={t("newCategory")}
              aria-invalid={Boolean(categoryError)}
            />
            <Button type="button" variant="outline" onClick={addCategory}>
              <Plus aria-hidden />
              {t("addCategory")}
            </Button>
          </div>
          <FieldError>{errorMessage(categoryError ?? form.formState.errors.expenseCategories?.message)}</FieldError>
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || uploading}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
