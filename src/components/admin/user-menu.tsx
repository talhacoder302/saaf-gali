"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useTransition } from "react";

import { logoutAction } from "@/app/actions/account";
import type { ShellUser } from "@/components/shared/nav-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type UserMenuProps = {
  user: ShellUser;
  profileHref: string;
};

export function UserMenu({ user, profileHref }: UserMenuProps) {
  const t = useTranslations("common");
  const tRoles = useTranslations("roles");
  const tNav = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label={t("accountMenu")}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">{user.name}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{tRoles(user.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserRound aria-hidden />
            {tNav("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onSelect={() => startTransition(() => logoutAction())}
        >
          <LogOut aria-hidden className="rtl:-scale-x-100" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
