"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createHouseholdAction, updateHouseholdAction } from "@/app/admin/households/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRupees } from "@/lib/format";
import { HOUSEHOLD_STATUSES, OCCUPANT_TYPES } from "@/lib/households";
import {
  householdFormSchema,
  type HouseholdFormInput,
  type HouseholdFormOutput,
} from "@/lib/validators/households";

import { blocksOf, locateStreet, streetsOf, type AreaNode, type HouseholdDetail } from "./types";

type HouseholdFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: AreaNode[];
  /** Leave out to add a new household. */
  household?: HouseholdDetail;
  /** Pre-select the street (e.g. from the page's filters). */
  defaults?: { areaId?: string | null; blockId?: string | null; streetId?: string | null };
};

export function HouseholdFormDialog({ open, onOpenChange, tree, household, defaults }: HouseholdFormDialogProps) {
  const t = useTranslations("households.form");
  const tHouseholds = useTranslations("households");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const start = household ? locateStreet(tree, household.streetId) : null;
  const [areaId, setAreaId] = useState<string | null>(
    start?.areaId ?? defaults?.areaId ?? (tree.length === 1 ? (tree[0]?.id ?? null) : null),
  );
  const [blockId, setBlockId] = useState<string | null>(start?.blockId ?? defaults?.blockId ?? null);
  const area = tree.find((node) => node.id === areaId);
  // Set once the fee is typed by hand, so choosing an area no longer overwrites it.
  const feeTouched = useRef(Boolean(household));

  const form = useForm<HouseholdFormInput, unknown, HouseholdFormOutput>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: household
      ? {
          streetId: household.streetId,
          houseNumber: household.houseNumber,
          ownerName: household.ownerName,
          occupantType: household.occupantType,
          contactName: household.contactName ?? "",
          mobile: household.mobile ?? "",
          email: household.email ?? "",
          monthlyFee: household.monthlyFee,
          status: household.status,
          notes: household.notes ?? "",
        }
      : {
          streetId: defaults?.streetId ?? "",
          houseNumber: "",
          ownerName: "",
          occupantType: "owner",
          contactName: "",
          mobile: "",
          email: "",
          monthlyFee: area?.defaultMonthlyFee ?? 0,
          status: "active",
          notes: "",
        },
  });

  function chooseArea(next: string) {
    setAreaId(next);
    setBlockId(null);
    form.setValue("streetId", "");
    // New houses start at the area's fee unless the fee was typed by hand.
    const nextArea = tree.find((node) => node.id === next);
    if (nextArea && !feeTouched.current) {
      form.setValue("monthlyFee", nextArea.defaultMonthlyFee);
    }
  }

  function chooseBlock(next: string) {
    setBlockId(next);
    form.setValue("streetId", "");
  }

  function onSubmit(output: HouseholdFormOutput) {
    // Actions take the form's input shape; the server validates it again.
    const values: HouseholdFormInput = { ...output, mobile: output.mobile ?? "" };
    startTransition(async () => {
      const result = household
        ? await updateHouseholdAction({ ...values, id: household.id })
        : await createHouseholdAction(values);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<HouseholdFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(household ? tHouseholds("updated") : tHouseholds("created"));
      onOpenChange(false);
      if (!household && result.data && typeof result.data === "object" && "id" in result.data) {
        router.push(`/admin/households/${String(result.data.id)}`);
      }
    });
  }

  const blocks = blocksOf(tree, areaId);
  const streets = streetsOf(tree, areaId, blockId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{household ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{household ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="household-area">{t("area")}</FieldLabel>
                <Select value={areaId ?? undefined} onValueChange={chooseArea}>
                  <SelectTrigger id="household-area" className="w-full">
                    <SelectValue placeholder={t("chooseArea")} />
                  </SelectTrigger>
                  <SelectContent>
                    {tree.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="household-block">{t("block")}</FieldLabel>
                <Select value={blockId ?? undefined} onValueChange={chooseBlock} disabled={!areaId}>
                  <SelectTrigger id="household-block" className="w-full">
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
              </Field>
              <Controller
                name="streetId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-street">{t("street")}</FieldLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange} disabled={!blockId}>
                      <SelectTrigger id="household-street" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("chooseStreet")} />
                      </SelectTrigger>
                      <SelectContent>
                        {streets.map((street) => (
                          <SelectItem key={street.id} value={street.id}>
                            {street.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Controller
                name="houseNumber"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-number">{t("houseNumber")}</FieldLabel>
                    <Input {...field} id="household-number" dir="ltr" placeholder="12-B" aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="ownerName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-owner">{t("ownerName")}</FieldLabel>
                    <Input {...field} id="household-owner" aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                name="occupantType"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="household-occupant">{t("occupantType")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="household-occupant" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCUPANT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {tHouseholds(`occupant.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="contactName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                    <FieldLabel htmlFor="household-contact">{t("contactName")}</FieldLabel>
                    <Input {...field} id="household-contact" placeholder={t("contactPlaceholder")} aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="mobile"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-mobile">{t("mobile")}</FieldLabel>
                    <Input
                      {...field}
                      id="household-mobile"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="03XX-XXXXXXX"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-email">{t("email")}</FieldLabel>
                    <Input
                      {...field}
                      id="household-email"
                      type="email"
                      dir="ltr"
                      placeholder={t("optional")}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="monthlyFee"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="household-fee">{t("monthlyFee")}</FieldLabel>
                    <div className="relative">
                      <span className="absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">Rs.</span>
                      <Input
                        id="household-fee"
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
                        onChange={(event) => {
                          feeTouched.current = true;
                          field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value));
                        }}
                        aria-invalid={fieldState.invalid}
                      />
                    </div>
                    {area ? (
                      <FieldDescription>
                        {t("feeHint", { fee: formatRupees(area.defaultMonthlyFee) })}
                      </FieldDescription>
                    ) : null}
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="household-status">{t("status")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="household-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSEHOLD_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {tHouseholds(`status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>{tHouseholds(`statusHint.${field.value}`)}</FieldDescription>
                  </Field>
                )}
              />
            </div>

            <Controller
              name="notes"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="household-notes">{t("notes")}</FieldLabel>
                  <Textarea {...field} id="household-notes" rows={2} placeholder={t("optional")} aria-invalid={fieldState.invalid} />
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : household ? tCommon("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
