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
  { key: "areas", icon: MapPinned },
  { key: "households", icon: House },
  { key: "workers", icon: Users },
  { key: "duties", icon: ClipboardList },
  { key: "workProof", icon: Camera },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "fees", icon: Banknote },
  { key: "expenses", icon: ReceiptText },
  { key: "reports", icon: ChartColumn },
  { key: "users", icon: UserCog },
  { key: "settings", icon: Settings },
];
