"use client";

import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetPasswordAction } from "@/app/admin/users/actions";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { passwordSchema } from "@/lib/validators/auth";

import { CredentialsShare } from "./credentials-share";
import type { IssuedCredentials, UserRow } from "./types";

type ResetPasswordDialogProps = {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const t = useTranslations("users.reset");
  const tForm = useTranslations("users.form");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState(generateTemporaryPassword);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "invalid");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ id: user.id, password: parsed.data });
      if (!result.ok) {
        setError(result.fieldErrors?.password ?? null);
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done"));
      setIssued({ name: user.name, mobile: user.mobile, password: parsed.data });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: user.name })}</DialogTitle>
          <DialogDescription>{issued ? t("shareDescription") : t("description", { name: user.name })}</DialogDescription>
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
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="reset-password">{tForm("tempPassword")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  dir="ltr"
                  autoComplete="off"
                  className="font-mono"
                  aria-invalid={Boolean(error)}
                />
                <Button type="button" variant="outline" onClick={() => setPassword(generateTemporaryPassword())}>
                  <WandSparkles aria-hidden />
                  {tForm("generate")}
                </Button>
              </div>
              <FieldDescription>{tForm("tempPasswordHint")}</FieldDescription>
              <FieldError>{errorMessage(error)}</FieldError>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : t("button")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
