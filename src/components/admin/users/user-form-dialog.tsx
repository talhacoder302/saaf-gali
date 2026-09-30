"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { createUserAction, updateUserAction } from "@/app/admin/users/actions";
import { AreaChecklist, type AreaChoice } from "@/components/shared/area-checklist";
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
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { normalizeMobile } from "@/lib/mobile";
import { roleAllowsManyAreas, roleNeedsArea, type Role } from "@/lib/roles";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { createUserSchema, editUserFormSchema, type CreateUserInput } from "@/lib/validators/users";

import { CredentialsShare } from "./credentials-share";
import type { IssuedCredentials, UserRow, UsersActor } from "./types";

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leave out to create a new user. */
  user?: UserRow;
  actor: UsersActor;
  areas: AreaChoice[];
};

function defaultsFor(user: UserRow | undefined, actor: UsersActor): CreateUserInput {
  if (user) {
    return {
      name: user.name,
      mobile: user.mobile,
      email: user.email ?? "",
      role: user.role,
      areaIds: user.areaIds,
      language: user.language,
      password: "",
    };
  }
  return {
    name: "",
    mobile: "",
    email: "",
    role: actor.manageableRoles.includes("worker") ? "worker" : (actor.manageableRoles[0] ?? "worker"),
    areaIds: [],
    language: "ur",
    password: generateTemporaryPassword(),
  };
}

export function UserFormDialog({ open, onOpenChange, user, actor, areas }: UserFormDialogProps) {
  const isEdit = Boolean(user);
  const t = useTranslations("users.form");
  const tUsers = useTranslations("users");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(isEdit ? editUserFormSchema : createUserSchema),
    defaultValues: defaultsFor(user, actor),
  });
  const role = useWatch({ control: form.control, name: "role" });
  const editingSelf = user?.id === actor.id;
  // Editing someone whose role this actor can't hand out (e.g. yourself as area manager).
  const roleOptions: Role[] = actor.manageableRoles.includes(form.getValues("role"))
    ? actor.manageableRoles
    : [form.getValues("role"), ...actor.manageableRoles];

  function onRoleChange(next: Role) {
    form.setValue("role", next, { shouldDirty: true });
    const areaIds = form.getValues("areaIds");
    if (!roleNeedsArea(next)) form.setValue("areaIds", []);
    else if (!roleAllowsManyAreas(next) && areaIds.length > 1) form.setValue("areaIds", areaIds.slice(0, 1));
  }

  function onSubmit(values: CreateUserInput) {
    startTransition(async () => {
      const result = user
        ? await updateUserAction({ ...values, id: user.id })
        : await createUserAction(values);

      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<CreateUserInput>, { message: key });
        }
        toast.error(errorMessage(result.error));
        return;
      }

      if (user) {
        toast.success(tUsers("updated"));
        onOpenChange(false);
        return;
      }
      toast.success(tUsers("created"));
      setIssued({
        name: values.name.trim(),
        mobile: normalizeMobile(values.mobile) ?? values.mobile,
        password: values.password,
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{issued ? t("createdTitle") : isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {issued ? t("createdDescription", { name: issued.name }) : isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
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
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="user-name">{t("name")}</FieldLabel>
                    <Input {...field} id="user-name" autoComplete="off" aria-invalid={fieldState.invalid} />
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
                      <FieldLabel htmlFor="user-mobile">{t("mobile")}</FieldLabel>
                      <Input
                        {...field}
                        id="user-mobile"
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        placeholder="03XX-XXXXXXX"
                        autoComplete="off"
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
                      <FieldLabel htmlFor="user-email">{t("email")}</FieldLabel>
                      <Input
                        {...field}
                        id="user-email"
                        type="email"
                        dir="ltr"
                        placeholder={t("optional")}
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="role"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="user-role">{t("role")}</FieldLabel>
                      <Select value={field.value} onValueChange={(value) => onRoleChange(value as Role)} disabled={editingSelf}>
                        <SelectTrigger id="user-role" className="w-full" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option} value={option} disabled={!actor.manageableRoles.includes(option)}>
                              {tRoles(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editingSelf ? <FieldDescription>{t("ownRoleLocked")}</FieldDescription> : null}
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
                <Controller
                  name="language"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="user-language">{t("language")}</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="user-language" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCALES.map((locale) => (
                            <SelectItem key={locale} value={locale}>
                              {LOCALE_LABELS[locale]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              {roleNeedsArea(role) ? (
                <Controller
                  name="areaIds"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t("areas")}</FieldLabel>
                      {areas.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t("noAreas")}</p>
                      ) : (
                        <AreaChecklist
                          areas={areas}
                          value={field.value}
                          onChange={field.onChange}
                          single={!roleAllowsManyAreas(role)}
                          invalid={fieldState.invalid}
                        />
                      )}
                      <FieldDescription>
                        {roleAllowsManyAreas(role) ? t("areasHint") : t("areasHintResident")}
                      </FieldDescription>
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
              ) : null}

              {isEdit ? null : (
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="user-password">{t("tempPassword")}</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          {...field}
                          id="user-password"
                          dir="ltr"
                          autoComplete="off"
                          className="font-mono"
                          aria-invalid={fieldState.invalid}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("password", generateTemporaryPassword(), { shouldValidate: true })}
                        >
                          <WandSparkles aria-hidden />
                          {t("generate")}
                        </Button>
                      </div>
                      <FieldDescription>{t("tempPasswordHint")}</FieldDescription>
                      <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? tCommon("saving") : isEdit ? tCommon("save") : t("create")}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
