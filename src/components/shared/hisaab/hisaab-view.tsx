"use client";

import { Clock, Download, ReceiptText, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { useCategoryLabel, useDayLabel } from "@/components/shared/expenses/expense-labels";
import { useMonthName } from "@/components/shared/fees/fee-history";
import { PhotoViewer } from "@/components/shared/photo-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HisaabPicker, HisaabView as Hisaab } from "@/server/hisaab";

import { HisaabChart } from "./hisaab-chart";

type HisaabViewProps = {
  hisaab: Hisaab;
  /** Area picker; shown when there is more than one area to choose from. */
  areas?: HisaabPicker;
  pdfHref: string;
  /** Replaces the default line under the heading (public page). */
  intro?: React.ReactNode;
  /** Public link box, shown under the pickers. */
  share?: React.ReactNode;
};

/**
 * The monthly hisaab of one area: balance, fee collection (numbers only),
 * spending by category, a six-month chart and the approved expenses with
 * their receipt photos. Shared by the admin, resident and public pages; its
 * layout follows the width it gets (container queries), not the screen.
 */
export function HisaabView({ hisaab, areas, pdfHref, intro, share }: HisaabViewProps) {
  const t = useTranslations("hisaab");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthName = useMonthName();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    // Another area has its own months; start from its newest.
    if (key === "area") params.delete("month");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const { balance } = hisaab;

  return (
    <div className="@container space-y-6">
      <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("pageTitle", { area: hisaab.area.name })}</h1>
          {intro ?? <p className="text-muted-foreground">{t("intro")}</p>}
        </div>
        <Button asChild variant="outline" className="print:hidden">
          <a href={pdfHref} download>
            <Download aria-hidden />
            {t("downloadPdf")}
          </a>
        </Button>
      </div>

      <div className="grid gap-3 @lg:grid-cols-2 @2xl:max-w-xl print:hidden">
        <Select value={hisaab.month} onValueChange={(value) => setParam("month", value)}>
          <SelectTrigger className="w-full" aria-label={t("month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hisaab.months.map((month) => (
              <SelectItem key={month} value={month}>
                {monthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {areas && areas.length > 1 ? (
          <Select value={hisaab.area.id} onValueChange={(value) => setParam("area", value)}>
            <SelectTrigger className="w-full" aria-label={t("area")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                  {area.archived ? ` (${t("archived")})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {share}

      <div className={cn("space-y-6 transition-opacity", isPending && "opacity-60")}>
        <BalanceTiles balance={balance} />

        {hisaab.pending.count > 0 ? (
          <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("pending", { count: hisaab.pending.count, amount: formatRupees(hisaab.pending.amount) })}
          </p>
        ) : null}

        <div className="grid gap-6 @3xl:grid-cols-2">
          <CollectionCard hisaab={hisaab} />
          <CategoryCard hisaab={hisaab} />
        </div>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <h2 className="font-medium">{t("chart.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("chart.description")}</p>
          </div>
          <HisaabChart data={hisaab.chart} />
        </section>

        <ExpenseList hisaab={hisaab} />
      </div>
    </div>
  );
}

function BalanceTiles({ balance }: { balance: Hisaab["balance"] }) {
  const t = useTranslations("hisaab.balance");
  const tiles = [
    { key: "opening", value: balance.opening, hint: t("openingHint") },
    { key: "collected", value: balance.collected, hint: t("collectedHint") },
    { key: "spent", value: balance.spent, hint: t("spentHint") },
    { key: "closing", value: balance.closing, hint: t("closingHint"), main: true },
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className={cn("rounded-xl border bg-card p-4", "main" in tile && "border-primary/50 bg-primary/5")}
        >
          <dt className="text-sm text-muted-foreground">{t(tile.key)}</dt>
          <dd className={cn("text-xl font-semibold tabular-nums @md:text-2xl", tile.value < 0 && "text-destructive")}>
            {formatRupees(tile.value)}
          </dd>
          <p className="text-xs text-muted-foreground">{tile.hint}</p>
        </div>
      ))}
    </dl>
  );
}

function CollectionCard({ hisaab }: { hisaab: Hisaab }) {
  const t = useTranslations("hisaab.collection");
  const collection = hisaab.collection;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <Users className="size-4 text-primary" aria-hidden />
        {t("title")}
      </h2>
      {collection ? (
        <>
          <p className="text-3xl font-semibold tabular-nums">{collection.percent}%</p>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={collection.percent}
            aria-label={t("percent", { percent: collection.percent })}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, collection.percent)}%` }} />
          </div>
          <p className="text-sm">{t("percent", { percent: collection.percent })}</p>
          <p className="text-sm font-medium">{t("households", { paid: collection.paid, total: collection.households })}</p>
          {collection.partial > 0 ? <p className="text-sm text-muted-foreground">{t("partial", { count: collection.partial })}</p> : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noBills")}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("privacy")}</p>
    </section>
  );
}

function CategoryCard({ hisaab }: { hisaab: Hisaab }) {
  const t = useTranslations("hisaab.byCategory");
  const categoryLabel = useCategoryLabel();
  const largest = hisaab.byCategory[0]?.amount ?? 0;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">{t("title")}</h2>
      {hisaab.byCategory.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {hisaab.byCategory.map((entry) => (
            <li key={entry.category} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{categoryLabel(entry.category)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-[var(--chart-2)]"
                  style={{ width: `${largest > 0 ? Math.max(2, Math.floor((entry.amount * 100) / largest)) : 0}%` }}
                />
              </div>
              <span className="tabular-nums">{formatRupees(entry.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExpenseList({ hisaab }: { hisaab: Hisaab }) {
  const t = useTranslations("hisaab.expenses");
  const categoryLabel = useCategoryLabel();
  const dayLabel = useDayLabel();

  if (hisaab.expenses.length === 0) {
    return <EmptyState icon={ReceiptText} title={t("emptyTitle")} description={t("emptyBody")} />;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{t("title")}</h2>
        <Badge variant="secondary">{t("count", { count: hisaab.expenses.length })}</Badge>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {hisaab.expenses.map((expense) => (
          <li key={expense.id} className="flex items-center gap-3 p-3">
            {expense.hasPhoto ? (
              <PhotoViewer
                url={expense.photoUrl}
                label={t("viewPhoto", { description: expense.description })}
                title={t("photoTitle")}
                description={`${expense.description} · ${formatRupees(expense.amount)} · ${dayLabel(expense.day)}`}
                missingLabel={t("photoMissing")}
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
                <ReceiptText className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{expense.description}</p>
              <p className="text-xs text-muted-foreground">
                {categoryLabel(expense.category)} · {dayLabel(expense.day)}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{formatRupees(expense.amount)}</p>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 p-3 font-semibold">
          <span>{t("total")}</span>
          <span className="tabular-nums">{formatRupees(hisaab.balance.spent)}</span>
        </li>
      </ul>
    </section>
  );
}
