import { useTranslations } from "next-intl";
import Link from "next/link";

import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Button } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("common.login")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        {t("landing.footer", { year })}
      </footer>
    </div>
  );
}
