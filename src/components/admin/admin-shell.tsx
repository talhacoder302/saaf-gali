"use client";

import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ADMIN_ROOT, adminNavItems } from "@/components/admin/nav-items";
import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { isActivePath } from "@/components/shared/nav-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { localeDirection } from "@/i18n/config";
import { cn } from "@/lib/utils";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <nav className="flex flex-col gap-1 p-3">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const active = item.href ? isActivePath(pathname, item.href, ADMIN_ROOT) : false;
        const classes = cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80",
        );

        if (!item.href) {
          return (
            <span key={item.key} aria-disabled="true" className={cn(classes, "cursor-not-allowed opacity-60")}>
              <Icon className="size-4" aria-hidden />
              <span className="flex-1">{t(item.key)}</span>
              <Badge variant="outline" className="text-[10px]">
                {tCommon("soon")}
              </Badge>
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(classes, "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Responsive admin layout: fixed sidebar on desktop, slide-out sheet on mobile. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tPortal = useTranslations("portal");
  const sheetSide = localeDirection(locale) === "rtl" ? "right" : "left";

  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand href={ADMIN_ROOT} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t p-4">
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label={tCommon("openMenu")}>
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side={sheetSide} className="w-72 bg-sidebar p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>
                    <Brand href={ADMIN_ROOT} />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  <SidebarNav onNavigate={() => setOpen(false)} />
                </div>
                <div className="border-t p-4">
                  <LanguageSwitcher />
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-medium lg:hidden">{tCommon("appName")}</span>
            <span className="hidden text-sm text-muted-foreground lg:inline">{tPortal("admin")}</span>
          </div>
          <div className="lg:hidden">
            <LanguageSwitcher />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
