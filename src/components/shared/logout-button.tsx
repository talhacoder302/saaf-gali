"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { logoutAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function LogoutButton({ className, variant = "outline" }: LogoutButtonProps) {
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      disabled={isPending}
      onClick={() => startTransition(() => logoutAction())}
      className={cn("h-11 text-base", className)}
    >
      <LogOut aria-hidden className="rtl:-scale-x-100" />
      {t("logout")}
    </Button>
  );
}
