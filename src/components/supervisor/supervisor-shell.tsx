"use client";

import { Banknote, Camera, House, UserRound } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";

export const SUPERVISOR_ROOT = "/supervisor";

const items: NavItem[] = [
  { key: "home", icon: House, href: SUPERVISOR_ROOT },
  { key: "collect", icon: Banknote, href: `${SUPERVISOR_ROOT}/collect` },
  { key: "review", icon: Camera },
  { key: "profile", icon: UserRound, href: `${SUPERVISOR_ROOT}/profile` },
];

export function SupervisorShell({ children }: { children: React.ReactNode }) {
  return (
    <BottomNavShell portal="supervisor" rootHref={SUPERVISOR_ROOT} items={items}>
      {children}
    </BottomNavShell>
  );
}
