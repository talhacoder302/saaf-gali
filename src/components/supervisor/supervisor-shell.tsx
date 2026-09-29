"use client";

import { Camera, House, MessageSquareWarning, Users } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";

export const SUPERVISOR_ROOT = "/supervisor";

const items: NavItem[] = [
  { key: "home", icon: House, href: SUPERVISOR_ROOT },
  { key: "team", icon: Users },
  { key: "review", icon: Camera },
  { key: "complaints", icon: MessageSquareWarning },
];

export function SupervisorShell({ children }: { children: React.ReactNode }) {
  return (
    <BottomNavShell portal="supervisor" rootHref={SUPERVISOR_ROOT} items={items}>
      {children}
    </BottomNavShell>
  );
}
