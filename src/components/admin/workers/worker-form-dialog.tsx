"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createWorkerAction, updateWorkerAction } from "@/app/admin/workers/actions";
import { CredentialsShare } from "@/components/admin/users/credentials-share";
import type { IssuedCredentials } from "@/components/admin/users/types";
import { AreaChecklist, type AreaChoice } from "@/components/shared/area-checklist";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMobile } from "@/lib/mobile";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { workerFormSchema, type WorkerFormInput, type WorkerFormOutput } from "@/lib/validators/workers";
import type { WorkerRow } from "@/server/workers";

type WorkerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leave out to add a new worker. */
  worker?: WorkerRow;
  areas: AreaChoice[];
  today: string;
};

function defaultsFor(worker: WorkerRow | undefined, today: string): WorkerFormInput {
  if (worker) {
    return {
      name: worker.name,
      mobile: worker.mobile ? formatMobile(worker.mobile) : "",
      cnic: worker.cnic ?? "",
      address: worker.address,
      monthlySalary: worker.monthlySalary,
      joiningDate: worker.joiningDate,
      areaIds: worker.areaIds,
      createLogin: false,
      password: "",
    };
  }
  return {
    name: "",
    mobile: "",
    cnic: "",
    address: "",
    monthlySalary: 25_000,
    joiningDate: today,
    areaIds: [],
    createLogin: false,
    password: generateTemporaryPassword(),
  };
}

export function WorkerFormDialog({ open, onOpenChange, worker, areas, today }: WorkerFormDialogProps) {
  const t = useTranslations("workers.form");
  const tWorkers = useTranslations("workers");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);

  const form = useForm<WorkerFormInput, unknown, WorkerFormOutput>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: defaultsFor(worker, today),
  });
  const createLogin = useWatch({ control: form.control, name: "createLogin" });

  // Runs after the form validated. It sends the raw input (the service parses it with the same schema).
  function onSubmit() {
    const input = form.getValues();
    startTransition(async () => {
      const result = worker
        ? await updateWorkerAction({
            id: worker.id,
            name: input.name,
            mobile: input.mobile,
            cnic: input.cnic,
            address: input.address,
            monthlySalary: input.monthlySalary,
            joiningDate: input.joiningDate,
            areaIds: input.areaIds,
          })
        : await createWorkerAction(input);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<WorkerFormInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }
      const dropped = "droppedDuties" in result.data ? result.data.droppedDuties : 0;
      toast.success(worker ? tWorkers("updated") : tWorkers("created"), {
        description: dropped > 0 ? tWorkers("droppedDuties", { count: dropped }) : undefined,
      });
      if ("login" in result.data && result.data.login) {
        setIssued({ ...result.data.login, password: input.password });
        return;
      }
      onOpenChange(false);
    });
  }

  const salaryField = (
    <Controller
      name="monthlySalary"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="worker-salary">{t("salary")}</FieldLabel>
          <div className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">Rs.</span>
            <Input
              id="worker-salary"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
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
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{issued ? tWorkers("loginDialog.created") : worker ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{issued ? tWorkers("loginDialog.shareDescription") : t("description")}</DialogDescription>
        </DialogHeader>
        {issued ? (
          <>
            <CredentialsShare credentials={issued} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {tCommon("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(() => onSubmit())} noValidate>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="worker-name">{t("name")}</FieldLabel>
                    <Input {...field} id="worker-name" placeholder={t("namePlaceholder")} aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="mobile"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="worker-mobile">{t("mobile")}</FieldLabel>
                      <Input {...field} id="worker-mobile" type="tel" inputMode="tel" dir="ltr" placeholder="0300-1234567" aria-invalid={fieldState.invalid} />
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
                <Controller
                  name="cnic"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="worker-cnic">{t("cnic")}</FieldLabel>
                      <Input {...field} id="worker-cnic" inputMode="numeric" dir="ltr" placeholder={t("cnicPlaceholder")} aria-invalid={fieldState.invalid} />
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {salaryField}
                <Controller
                  name="joiningDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="worker-joining">{t("joiningDate")}</FieldLabel>
                      <Input {...field} id="worker-joining" type="date" max={today} dir="ltr" aria-invalid={fieldState.invalid} />
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
              </div>
              <Controller
                name="address"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="worker-address">{t("address")}</FieldLabel>
                    <Textarea {...field} id="worker-address" rows={2} aria-invalid={fieldState.invalid} />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="areaIds"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>{t("areas")}</FieldLabel>
                    <AreaChecklist areas={areas} value={field.value} onChange={field.onChange} invalid={fieldState.invalid} idPrefix="worker-area" />
                    <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />

              {worker ? (
                worker.login ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("loginLinked")}</p> : null
              ) : (
                <>
                  <Controller
                    name="createLogin"
                    control={form.control}
                    render={({ field }) => (
                      <Field orientation="horizontal">
                        <Checkbox id="worker-create-login" checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} />
                        <div className="space-y-1">
                          <FieldLabel htmlFor="worker-create-login">{t("createLogin")}</FieldLabel>
                          <FieldDescription>{t("createLoginHint")}</FieldDescription>
                        </div>
                      </Field>
                    )}
                  />
                  {createLogin ? (
                    <Controller
                      name="password"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="worker-password">{t("password")}</FieldLabel>
                          <div className="flex gap-2">
                            <Input {...field} id="worker-password" dir="ltr" autoComplete="off" className="font-mono" aria-invalid={fieldState.invalid} />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => form.setValue("password", generateTemporaryPassword(), { shouldValidate: true })}
                            >
                              <WandSparkles aria-hidden />
                              {t("generate")}
                            </Button>
                          </div>
                          <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                        </Field>
                      )}
                    />
                  ) : null}
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? tCommon("saving") : worker ? tCommon("save") : t("create")}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
