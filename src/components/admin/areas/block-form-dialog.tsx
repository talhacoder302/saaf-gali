"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createBlockAction, updateBlockAction } from "@/app/admin/areas/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { blockFormSchema, type BlockFormInput } from "@/lib/validators/areas";

type BlockFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaId: string;
  /** Leave out to add a new block. */
  block?: { id: string; name: string };
};

export function BlockFormDialog({ open, onOpenChange, areaId, block }: BlockFormDialogProps) {
  const t = useTranslations("blocks");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();

  const form = useForm<BlockFormInput>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: { name: block?.name ?? "" },
  });

  function onSubmit(values: BlockFormInput) {
    startTransition(async () => {
      const result = block
        ? await updateBlockAction({ id: block.id, name: values.name })
        : await createBlockAction({ areaId, name: values.name });
      if (!result.ok) {
        if (result.fieldErrors?.name) form.setError("name", { message: result.fieldErrors.name });
        else toast.error(errorMessage(result.error));
        return;
      }
      toast.success(block ? t("updated") : t("created"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{block ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="block-name">{t("name")}</FieldLabel>
                  <Input {...field} id="block-name" placeholder={t("namePlaceholder")} aria-invalid={fieldState.invalid} autoFocus />
                  <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                </Field>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : block ? tCommon("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
