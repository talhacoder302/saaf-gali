"use client";

import { Banknote, MessageCircle, ReceiptText, Search, Wallet } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reminderWhatsappLink } from "@/lib/fee-messages";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeeRow, FeesOverview } from "@/server/billing";

import { GenerateBillsDialog } from "./generate-bills-dialog";

const ALL = "all";

type FeesOverviewViewProps = {
  overview: FeesOverview;
  months: string[];
  areas: { id: string; name: string }[];
};

function useMonthName() {
  const format = useFormatter();
  return (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15)), { month: "long", year: "numeric", timeZone: "UTC" });
  };
}

export function FeesOverviewView({ overview, months, areas }: FeesOverviewViewProps) {
  const t = useTranslations("fees");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthName = useMonthName();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  const { totals } = overview;
  const filter = (rows: FeeRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.houseNumber, row.name, row.streetName, row.blockName, row.mobile ?? ""].some((value) => value.toLowerCase().includes(q)),
    );
  };

  const stats = [
    { label: t("stats.billed"), value: formatRupees(totals.billed), hint: t("stats.bills", { count: totals.bills }) },
    { label: t("stats.collected"), value: formatRupees(totals.collected) },
    { label: t("stats.pending"), value: formatRupees(totals.pending), danger: totals.pending > 0 },
    { label: t("stats.percent"), value: `${totals.percent}%`, progress: totals.percent },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGenerating(true)}>
            <ReceiptText aria-hidden />
            {t("generate.open")}
          </Button>
          <Button asChild>
            <Link href="/admin/fees/collect">
              <Banknote aria-hidden />
              {t("collect")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Select value={overview.month} onValueChange={(value) => setParam("month", value)}>
          <SelectTrigger className="w-full" aria-label={t("month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {monthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={overview.areaId ?? ALL} onValueChange={(value) => setParam("areaId", value === ALL ? null : value)}>
          <SelectTrigger className="w-full" aria-label={t("area")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allAreas")}</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overview.unbilled > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{t("unbilled", { count: overview.unbilled, month: monthName(overview.month) })}</p>
          <Button size="sm" onClick={() => setGenerating(true)}>
            {t("generate.open")}
          </Button>
        </div>
      ) : null}

      <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", isPending && "opacity-60")}>
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className={cn("text-2xl font-semibold tabular-nums", stat.danger && "text-destructive")}>{stat.value}</dd>
            {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
            {stat.progress !== undefined ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, stat.progress)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </dl>

      {totals.bills === 0 && overview.defaulters.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("noBillsTitle", { month: monthName(overview.month) })}
          description={t("noBillsBody")}
          action={<Button onClick={() => setGenerating(true)}>{t("generate.open")}</Button>}
        />
      ) : (
        <Tabs defaultValue="pending" className={cn(isPending && "opacity-60")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="pending">{t("tabs.pending", { count: overview.pending.length })}</TabsTrigger>
              <TabsTrigger value="paid">{t("tabs.paid", { count: overview.paid.length })}</TabsTrigger>
              <TabsTrigger value="defaulters">{t("tabs.defaulters", { count: overview.defaulters.length })}</TabsTrigger>
            </TabsList>
            <div className="relative sm:w-64">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("filterPlaceholder")}
                aria-label={t("filterPlaceholder")}
                className="ps-9"
              />
            </div>
          </div>
          <TabsContent value="pending" className="pt-4">
            <FeeTable rows={filter(overview.pending)} kind="pending" organisationName={overview.organisationName} monthName={monthName} />
          </TabsContent>
          <TabsContent value="paid" className="pt-4">
            <FeeTable rows={filter(overview.paid)} kind="paid" organisationName={overview.organisationName} monthName={monthName} />
          </TabsContent>
          <TabsContent value="defaulters" className="pt-4">
            <FeeTable rows={filter(overview.defaulters)} kind="defaulters" organisationName={overview.organisationName} monthName={monthName} />
          </TabsContent>
        </Tabs>
      )}

      {generating ? (
        <GenerateBillsDialog
          open
          onOpenChange={(open) => !open && setGenerating(false)}
          months={months}
          defaultMonth={overview.month}
          areas={areas}
          defaultAreaId={overview.areaId}
          monthName={monthName}
        />
      ) : null}
    </div>
  );
}

function FeeTable({
  rows,
  kind,
  organisationName,
  monthName,
}: {
  rows: FeeRow[];
  kind: "pending" | "paid" | "defaulters";
  organisationName: string;
  monthName: (month: string) => string;
}) {
  const t = useTranslations("fees");
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t(`empty.${kind}`)}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t("columns.house")}</TableHead>
            <TableHead className="text-start">{kind === "defaulters" ? t("columns.monthsDue") : t("columns.bill")}</TableHead>
            <TableHead className="text-start">{kind === "paid" ? t("columns.paid") : t("columns.due")}</TableHead>
            {kind === "paid" ? null : (
              <TableHead>
                <span className="sr-only">{t("columns.reminder")}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.householdId}>
              <TableCell>
                <Link href={`/admin/households/${row.householdId}`} className="font-medium hover:underline">
                  {t("houseLabel", { number: row.houseNumber })} · {row.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.streetName} · {row.blockName} · {row.areaName}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                {kind === "defaulters" ? (
                  <div>
                    <Badge variant="destructive">{t("monthsCount", { count: row.dueMonths.length })}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{row.dueMonths.map(monthName).join(", ")}</p>
                  </div>
                ) : (
                  <span className="tabular-nums">
                    {formatRupees(row.amount)}
                    {row.status === "partial" ? (
                      <span className="ms-2 text-xs text-muted-foreground">{t("partPaid", { paid: formatRupees(row.paidAmount) })}</span>
                    ) : null}
                  </span>
                )}
              </TableCell>
              <TableCell className={cn("tabular-nums font-medium", kind !== "paid" && "text-destructive")}>
                {kind === "paid" ? formatRupees(row.paidAmount) : formatRupees(kind === "defaulters" ? row.totalDue : row.amount - row.paidAmount)}
              </TableCell>
              {kind === "paid" ? null : (
                <TableCell className="text-end">
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={reminderWhatsappLink(
                        {
                          organisation: organisationName,
                          name: row.name,
                          houseNumber: row.houseNumber,
                          street: row.streetName,
                          amount: row.totalDue,
                          months: row.dueMonths,
                        },
                        row.mobile,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle aria-hidden />
                      {t("reminder")}
                    </a>
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
