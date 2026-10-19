"use client";

import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createWorkerLoginAction } from "@/app/admin/workers/actions";
import { CredentialsShare } from "@/components/admin/users/credentials-share";
import type { IssuedCredentials } from "@/components/admin/users/types";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMobile } from "@/lib/mobile";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { passwordSchema } from "@/lib/validators/auth";

type WorkerLoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: { id: string; name: string; mobile: string };
};

/** A login for a worker who has a phone, with a temporary password to pass on. */
export function WorkerLoginDialog({ open, onOpenChange, worker }: WorkerLoginDialogProps) {
  const t = useTranslations("workers.loginDialog");
  const tForm = useTranslations("workers.form");
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
      const result = await createWorkerLoginAction({ workerId: worker.id, password: parsed.data });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("created"));
      setIssued({ ...result.data, password: parsed.data });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {issued ? t("shareDescription") : t("description", { name: worker.name, mobile: formatMobile(worker.mobile) })}
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
              <FieldLabel htmlFor="worker-login-password">{tForm("password")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="worker-login-password"
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
