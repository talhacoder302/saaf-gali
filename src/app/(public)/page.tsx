import {
  Bell,
  Camera,
  ClipboardList,
  LogIn,
  MapPin,
  MessageSquareWarning,
  Scale,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { key: "duties", icon: ClipboardList },
  { key: "proof", icon: Camera },
  { key: "fees", icon: Wallet },
  { key: "hisaab", icon: Scale },
  { key: "complaints", icon: MessageSquareWarning },
  { key: "alerts", icon: Bell },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>;

const STEPS = ["one", "two", "three"] as const;

export default function LandingPage() {
  const t = useTranslations("landing");

  return (
    <>
      <section className="border-b bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <Badge variant="outline" className="gap-1 bg-background">
            <MapPin className="size-3" aria-hidden />
            {t("badge")}
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                <LogIn aria-hidden className="rtl:-scale-x-100" />
                {t("ctaLogin")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">{t("ctaLearnMore")}</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-semibold">{t("featuresTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle>{t(`features.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(`features.${key}.body`)}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-center text-2xl font-semibold">{t("howTitle")}</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="pt-1">{t(`steps.${step}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Card className="items-center text-center">
          <CardHeader className="w-full">
            <CardTitle className="text-xl">{t("ctaTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">{t("ctaBody")}</p>
            <Button asChild size="lg">
              <Link href="/login">{t("ctaLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
