"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { loginAction } from "@/app/(auth)/login/actions";
import { PasswordInput } from "@/components/shared/password-input";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

type LoginFormProps = {
  callbackUrl: string | null;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: "", password: "" },
  });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    startTransition(async () => {
      // On success the action redirects, so we only get here on failure.
      const result = await loginAction(values, callbackUrl);
      if (!result.ok) {
        setFormError(result.error);
        form.setValue("password", "");
        form.setFocus("password");
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage(formError)}
          </p>
        ) : null}

        <Controller
          name="mobile"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="mobile">{t("mobile")}</FieldLabel>
              <Input
                {...field}
                id="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                dir="ltr"
                placeholder="03XX-XXXXXXX"
                aria-invalid={fieldState.invalid}
                className="h-11 text-base"
              />
              <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <PasswordInput
                {...field}
                id="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                className="h-11 text-base"
              />
              <FieldError>{errorMessage(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Button type="submit" size="lg" className="h-11 text-base" disabled={isPending}>
          <LogIn aria-hidden className="rtl:-scale-x-100" />
          {isPending ? t("signingIn") : t("loginButton")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">{t("forgotPassword")}</p>
      </FieldGroup>
    </form>
  );
}
