"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

import { useMonthName } from "@/components/shared/fees/fee-history";
import { formatRupees } from "@/lib/format";
import type { MonthTotals } from "@/lib/hisaab";

// Two series with colours from --chart-1 / --chart-2 (validated for colour-blind
// separation in light and dark). Identity never rests on colour alone: the
// legend names both, the tooltip labels each value, and a table view follows.

const SERIES = [
  { key: "collected", color: "var(--chart-1)" },
  { key: "spent", color: "var(--chart-2)" },
] as const;

export function HisaabChart({ data }: { data: MonthTotals[] }) {
  const t = useTranslations("hisaab.chart");
  const format = useFormatter();
  const monthName = useMonthName();

  const compact = (value: number) => format.number(value, { notation: "compact", maximumFractionDigits: 1 });
  // Six "Oct 2026" labels do not fit a phone (Urdu month names are long):
  // the axis shows the month only, with the year on the first tick and on January.
  const tick = (month: string, index: number) => {
    const [year, mon] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15));
    const withYear = index === 0 || mon === 1;
    return format.dateTime(date, { month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  };

  if (data.every((entry) => entry.collected === 0 && entry.spent === 0)) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ backgroundColor: series.color }} aria-hidden />
            {t(series.key)}
          </li>
        ))}
      </ul>

      {/* Charts read left to right in both languages, like the numbers in them. */}
      <div dir="ltr" className="h-60 w-full" role="img" aria-label={t("description")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickFormatter={tick}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval={0}
            />
            <YAxis
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(props) => <ChartTooltip {...props} />} />
            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={t(series.key)}
                fill={series.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("showTable")}</summary>
        <table className="mt-2 w-full text-start tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-normal">{t("month")}</th>
              <th className="py-1 text-end font-normal">{t("collected")}</th>
              <th className="py-1 text-end font-normal">{t("spent")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month} className="border-t">
                <td className="py-1">{monthName(row.month)}</td>
                <td className="py-1 text-end">{formatRupees(row.collected)}</td>
                <td className="py-1 text-end">{formatRupees(row.spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  const monthName = useMonthName();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{typeof label === "string" ? monthName(label) : null}</p>
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ms-auto ps-3 tabular-nums">{formatRupees(Number(item.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
