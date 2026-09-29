"use client";

import { House, MessageSquareWarning, ReceiptText, Scale } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";

export const RESIDENT_ROOT = "/resident";

const items: NavItem[] = [
  { key: "home", icon: House, href: RESIDENT_ROOT },
  { key: "myBills", icon: ReceiptText },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "hisaab", icon: Scale },
];

export function ResidentShell({ children }: { children: React.ReactNode }) {
  return (
    <BottomNavShell portal="resident" rootHref={RESIDENT_ROOT} items={items}>
      {children}
    </BottomNavShell>
  );
}
