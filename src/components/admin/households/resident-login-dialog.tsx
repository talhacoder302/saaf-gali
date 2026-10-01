"use client";

import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createResidentLoginAction } from "@/app/admin/households/actions";
import { CredentialsShare } from "@/components/admin/users/credentials-share";
import type { IssuedCredentials } from "@/components/admin/users/types";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMobile } from "@/lib/mobile";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { passwordSchema } from "@/lib/validators/auth";

type ResidentLoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  name: string;
  mobile: string;
};

/** Create a resident account for a household, using the household's mobile number. */
export function ResidentLoginDialog({ open, onOpenChange, householdId, name, mobile }: ResidentLoginDialogProps) {
  const t = useTranslations("households.residentLogin");
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
      const result = await createResidentLoginAction({ householdId, password: parsed.data });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("created"));
      setIssued({ name: result.data.name, mobile: result.data.mobile, password: parsed.data });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {issued ? t("shareDescription") : t("description", { name, mobile: formatMobile(mobile) })}
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
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="resident-password">{tForm("tempPassword")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="resident-password"
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
