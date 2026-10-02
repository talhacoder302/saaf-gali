"use client";

import { House, MessageSquareWarning, ReceiptText, UserRound } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";

export const RESIDENT_ROOT = "/resident";

const items: NavItem[] = [
  { key: "home", icon: House, href: RESIDENT_ROOT },
  { key: "myBills", icon: ReceiptText, href: `${RESIDENT_ROOT}/bills` },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "profile", icon: UserRound, href: `${RESIDENT_ROOT}/profile` },
];

export function ResidentShell({ children }: { children: React.ReactNode }) {
  return (
    <BottomNavShell portal="resident" rootHref={RESIDENT_ROOT} items={items}>
      {children}
    </BottomNavShell>
  );
}
