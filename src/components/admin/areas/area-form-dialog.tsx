"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createAreaAction, updateAreaAction } from "@/app/admin/areas/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CITIES, type City } from "@/lib/areas";
import { areaFormSchema, type AreaFormInput } from "@/lib/validators/areas";

type EditableArea = {
  id: string;
  name: string;
  city: City;
  description: string;
  defaultMonthlyFee: number;
};

type AreaFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leave out to create a new area. */
  area?: EditableArea;
};

export function AreaFormDialog({ open, onOpenChange, area }: AreaFormDialogProps) {
  const t = useTranslations("areas.form");
  const tAreas = useTranslations("areas");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AreaFormInput>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: area
      ? { name: area.name, city: area.city, description: area.description, defaultMonthlyFee: area.defaultMonthlyFee }
      : { name: "", city: "Rawalpindi", description: "", defaultMonthlyFee: 150 },
  });

  function onSubmit(values: AreaFormInput) {
    startTransition(async () => {
      const result = area ? await updateAreaAction({ ...values, id: area.id }) : await createAreaAction(values);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<AreaFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(area ? tAreas("updated") : tAreas("created"));
      onOpenChange(false);
      // A new area opens straight away so blocks and streets can be added.
      if (!area && result.data && typeof result.data === "object" && "id" in result.data) {
        router.push(`/admin/areas/${String(result.data.id)}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{area ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{area ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="area-name">{t("name")}</FieldLabel>
                    <Input {...field} id="area-name" placeholder={t("namePlaceholder")} aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="city"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="area-city">{t("city")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="area-city" className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CITIES.map((city) => (
                          <SelectItem key={city} value={city}>
                            {tAreas(`cities.${city}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Controller
              name="defaultMonthlyFee"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="area-fee">{t("fee")}</FieldLabel>
                  <div className="relative">
                    <span className="absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">
                      Rs.
                    </span>
                    <Input
                      id="area-fee"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      dir="ltr"
                      className="ps-10"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(event) =>
                        field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
                      }
                      aria-invalid={fieldState.invalid}
                    />
                  </div>
                  <FieldDescription>{t("feeHint")}</FieldDescription>
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="area-description">{t("description")}</FieldLabel>
                  <Textarea
                    {...field}
                    id="area-description"
                    rows={3}
                    placeholder={t("descriptionPlaceholder")}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : area ? tCommon("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
