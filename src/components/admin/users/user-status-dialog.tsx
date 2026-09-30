"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { setUserStatusAction } from "@/app/admin/users/actions";
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

import type { UserRow } from "./types";

type UserStatusDialogProps = {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Confirm before disabling or enabling a user. */
export function UserStatusDialog({ user, open, onOpenChange }: UserStatusDialogProps) {
  const t = useTranslations("users.statusDialog");
  const tUsers = useTranslations("users");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [isPending, startTransition] = useTransition();
  const disabling = user.status === "active";

  function confirm() {
    startTransition(async () => {
      const result = await setUserStatusAction(user.id, disabling ? "disabled" : "active");
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(disabling ? tUsers("disabledToast") : tUsers("enabledToast"));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {disabling ? t("disableTitle", { name: user.name }) : t("enableTitle", { name: user.name })}
          </DialogTitle>
          <DialogDescription>{disabling ? t("disableBody") : t("enableBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant={disabling ? "destructive" : "default"}
            disabled={isPending}
            onClick={confirm}
          >
            {disabling ? t("disableButton") : t("enableButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
