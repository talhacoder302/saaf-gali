"use client";

import { Camera, ClipboardList, House, UserRound } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";

export const WORKER_ROOT = "/worker";

const items: NavItem[] = [
  { key: "home", icon: House, href: WORKER_ROOT },
  { key: "startWork", icon: Camera },
  { key: "myDuties", icon: ClipboardList },
  { key: "profile", icon: UserRound, href: `${WORKER_ROOT}/profile` },
];

export function WorkerShell({ children }: { children: React.ReactNode }) {
  return (
    <BottomNavShell portal="worker" rootHref={WORKER_ROOT} items={items}>
      {children}
    </BottomNavShell>
  );
}
