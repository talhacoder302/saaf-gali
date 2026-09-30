"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createStreetAction, updateStreetAction } from "@/app/admin/areas/actions";
import { LocationPicker } from "@/components/shared/location-picker";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { streetFormSchema, type StreetFormInput } from "@/lib/validators/areas";

import type { BlockRow, StreetRow, SupervisorOption } from "./types";

const NONE = "none";

type StreetFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: BlockRow[];
  supervisors: SupervisorOption[];
  /** Leave out to add a new street. */
  street?: StreetRow;
  defaultBlockId?: string;
};

export function StreetFormDialog({
  open,
  onOpenChange,
  blocks,
  supervisors,
  street,
  defaultBlockId,
}: StreetFormDialogProps) {
  const t = useTranslations("streets");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();

  // Keep a supervisor who was disabled or moved visible so the form doesn't silently drop them.
  const supervisorChoices =
    street?.supervisorId && !supervisors.some((s) => s.id === street.supervisorId)
      ? [...supervisors, { id: street.supervisorId, name: street.supervisorName ?? "" }]
      : supervisors;

  const form = useForm<StreetFormInput>({
    resolver: zodResolver(streetFormSchema),
    defaultValues: street
      ? {
          blockId: street.blockId,
          name: street.name,
          supervisorId: street.supervisorId,
          location: street.location,
        }
      : { blockId: defaultBlockId ?? blocks[0]?.id ?? "", name: "", supervisorId: null, location: null },
  });

  function onSubmit(values: StreetFormInput) {
    startTransition(async () => {
      const result = street ? await updateStreetAction({ ...values, id: street.id }) : await createStreetAction(values);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<StreetFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(street ? t("updated") : t("created"));
      onOpenChange(false);
    });
  }

  const locationError = form.formState.errors.location;
  const locationMessage =
    locationError?.message ?? locationError?.lat?.message ?? locationError?.lng?.message ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{street ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="street-name">{t("name")}</FieldLabel>
                    <Input {...field} id="street-name" placeholder={t("namePlaceholder")} aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="blockId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="street-block">{t("block")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="street-block" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("chooseBlock")} />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((block) => (
                          <SelectItem key={block.id} value={block.id}>
                            {block.name}
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
              name="supervisorId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="street-supervisor">{t("supervisor")}</FieldLabel>
                  <Select value={field.value ?? NONE} onValueChange={(value) => field.onChange(value === NONE ? null : value)}>
                    <SelectTrigger id="street-supervisor" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("noSupervisor")}</SelectItem>
                      {supervisorChoices.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {supervisors.length === 0 ? <FieldDescription>{t("noSupervisorsHint")}</FieldDescription> : null}
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />

            <Controller
              name="location"
              control={form.control}
              render={({ field }) => (
                <Field data-invalid={Boolean(locationMessage)}>
                  <FieldLabel>{t("location")}</FieldLabel>
                  <FieldDescription>{t("locationHint")}</FieldDescription>
                  <LocationPicker value={field.value} onChange={field.onChange} invalid={Boolean(locationMessage)} />
                  <FieldError>{errorMessage(locationMessage)}</FieldError>
                </Field>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : street ? tCommon("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
