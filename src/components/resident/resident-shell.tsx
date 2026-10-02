"use client";

import { ClipboardCheck, House, MessageSquareWarning, ReceiptText, UserRound } from "lucide-react";

import { BottomNavShell } from "@/components/shared/bottom-nav-shell";
import type { NavItem } from "@/components/shared/nav-types";
import type { Role } from "@/lib/roles";

export const RESIDENT_ROOT = "/resident";

const items: NavItem[] = [
  { key: "home", icon: House, href: RESIDENT_ROOT },
  { key: "myBills", icon: ReceiptText, href: `${RESIDENT_ROOT}/bills` },
  { key: "approvals", icon: ClipboardCheck, href: `${RESIDENT_ROOT}/approvals`, roles: ["committee"] },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "profile", icon: UserRound, href: `${RESIDENT_ROOT}/profile` },
];

export function ResidentShell({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <BottomNavShell
      portal="resident"
      rootHref={RESIDENT_ROOT}
      items={items.filter((item) => !item.roles || item.roles.includes(role))}
    >
      {children}
    </BottomNavShell>
  );
}
