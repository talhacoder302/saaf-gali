import {
  Banknote,
  Camera,
  ChartColumn,
  ClipboardList,
  House,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  ReceiptText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

import type { NavItem } from "@/components/shared/nav-types";

export const ADMIN_ROOT = "/admin";

export const adminNavItems: NavItem[] = [
  { key: "dashboard", icon: LayoutDashboard, href: ADMIN_ROOT },
  { key: "areas", icon: MapPinned, href: `${ADMIN_ROOT}/areas` },
  { key: "households", icon: House, href: `${ADMIN_ROOT}/households` },
  { key: "workers", icon: Users },
  { key: "duties", icon: ClipboardList },
  { key: "workProof", icon: Camera },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "fees", icon: Banknote, href: `${ADMIN_ROOT}/fees` },
  { key: "expenses", icon: ReceiptText, href: `${ADMIN_ROOT}/expenses` },
  { key: "reports", icon: ChartColumn },
  { key: "users", icon: UserCog, href: `${ADMIN_ROOT}/users` },
  { key: "settings", icon: Settings, href: `${ADMIN_ROOT}/settings`, roles: ["super_admin"] },
];
