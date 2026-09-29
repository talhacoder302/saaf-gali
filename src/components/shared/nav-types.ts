import type { LucideIcon } from "lucide-react";

import type en from "@/i18n/en.json";

export type NavKey = keyof (typeof en)["nav"];
export type PortalKey = keyof (typeof en)["portal"];

export type NavItem = {
  key: NavKey;
  icon: LucideIcon;
  /** Leave out while the page is not built yet; it shows as "Soon". */
  href?: string;
};

export function isActivePath(pathname: string, href: string, rootHref: string): boolean {
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
