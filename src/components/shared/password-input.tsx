"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

/** Password field with a show/hide button. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        dir="ltr"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pe-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
