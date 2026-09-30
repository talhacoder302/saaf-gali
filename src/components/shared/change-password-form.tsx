"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/actions/account";
import { PasswordInput } from "@/components/shared/password-input";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordInput,
} from "@/lib/validators/auth";

type ChangePasswordFormProps = {
  /** Forced change after an admin reset: go to the user's home when done. */
  forced?: boolean;
};

const FIELDS = [
  { name: "currentPassword", label: "currentPassword", autoComplete: "current-password" },
  { name: "newPassword", label: "newPassword", autoComplete: "new-password" },
  { name: "confirmPassword", label: "confirmPassword", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm({ forced = false }: ChangePasswordFormProps) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<ChangePasswordInput>, { message: key });
        }
        if (!result.fieldErrors) toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("passwordChanged"));
      form.reset();
      if (forced) router.replace(result.data.home);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {FIELDS.map(({ name, label, autoComplete }) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={name}>{t(label)}</FieldLabel>
                <PasswordInput
                  {...field}
                  id={name}
                  autoComplete={autoComplete}
                  aria-invalid={fieldState.invalid}
                  className="h-11 text-base"
                />
                {name === "newPassword" && !fieldState.error ? (
                  <FieldDescription>{t("passwordRules", { min: PASSWORD_MIN_LENGTH })}</FieldDescription>
                ) : null}
                <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        ))}
        <Button type="submit" size="lg" className="h-11 text-base" disabled={isPending}>
          {isPending ? t("saving") : t("changePasswordButton")}
        </Button>
      </FieldGroup>
    </form>
  );
}
