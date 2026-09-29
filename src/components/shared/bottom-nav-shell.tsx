"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { isActivePath, type NavItem, type PortalKey } from "@/components/shared/nav-types";
import { cn } from "@/lib/utils";

type BottomNavShellProps = {
  portal: PortalKey;
  rootHref: string;
  items: NavItem[];
  children: React.ReactNode;
};

/** Mobile-first layout with a top bar and a fixed bottom navigation. */
export function BottomNavShell({ portal, rootHref, items, children }: BottomNavShellProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tPortal = useTranslations("portal");
  const tCommon = useTranslations("common");

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Brand href={rootHref} />
            <span className="truncate text-xs text-muted-foreground">{tPortal(portal)}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-28">{children}</main>

      <nav
        aria-label={tCommon("menu")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul
          className="mx-auto grid max-w-md"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const label = tNav(item.key);
            const active = item.href ? isActivePath(pathname, item.href, rootHref) : false;
            const itemClasses = cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-xs leading-tight",
              active ? "text-primary" : "text-muted-foreground",
            );

            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(itemClasses, "hover:text-foreground")}
                  >
                    <Icon className="size-6" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title={tCommon("soon")}
                    className={cn(itemClasses, "cursor-not-allowed opacity-50")}
                  >
                    <Icon className="size-6" aria-hidden />
                    <span className="truncate">{label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
