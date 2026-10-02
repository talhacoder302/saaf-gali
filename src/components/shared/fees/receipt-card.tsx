import { getFormatter, getTranslations } from "next-intl/server";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { formatRupees } from "@/lib/format";
import { formatMobile } from "@/lib/mobile";
import type { ReceiptView } from "@/server/payments";

/** The receipt itself: used on the public receipt page. */
export async function ReceiptCard({ receipt }: { receipt: ReceiptView }) {
  const t = await getTranslations("receipt");
  const tMethods = await getTranslations("fees.methods");
  const format = await getFormatter();
  const monthName = (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15)), { month: "long", year: "numeric", timeZone: "UTC" });
  };
  const cancelled = receipt.status === "cancelled";

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
      {cancelled ? (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <p className="font-semibold">{t("cancelled")}</p>
          {receipt.cancelReason ? <p>{receipt.cancelReason}</p> : null}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          {receipt.logoUrl ? (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={receipt.logoUrl} alt="" fill unoptimized sizes="48px" className="object-contain" />
            </span>
          ) : null}
          <div>
            <p className="text-lg font-semibold">{receipt.organisationName}</p>
            <p className="text-sm text-muted-foreground">{t("title")}</p>
          </div>
        </div>
        <div className="text-end">
          <p dir="ltr" className="font-mono text-sm font-semibold">
            {receipt.receiptNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {format.dateTime(new Date(receipt.paidAt), { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 py-4 text-sm">
        <dt className="text-muted-foreground">{t("receivedFrom")}</dt>
        <dd className="font-medium">{receipt.household.name}</dd>
        <dt className="text-muted-foreground">{t("house")}</dt>
        <dd>
          {receipt.household.houseNumber}, {receipt.household.streetName}, {receipt.household.blockName}, {receipt.household.areaName}
        </dd>
        {receipt.household.mobile ? (
          <>
            <dt className="text-muted-foreground">{t("mobile")}</dt>
            <dd dir="ltr" className="text-start">
              {formatMobile(receipt.household.mobile)}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t("method")}</dt>
        <dd>{tMethods(receipt.method)}</dd>
        <dt className="text-muted-foreground">{t("receivedBy")}</dt>
        <dd>{receipt.receivedBy}</dd>
        {receipt.note ? (
          <>
            <dt className="text-muted-foreground">{t("note")}</dt>
            <dd>{receipt.note}</dd>
          </>
        ) : null}
      </dl>

      <table className="w-full border-t text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-2 text-start font-normal">{t("month")}</th>
            <th className="py-2 text-end font-normal">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {receipt.allocations.map((allocation) => (
            <tr key={allocation.month} className="border-t">
              <td className="py-2">{monthName(allocation.month)}</td>
              <td className="py-2 text-end tabular-nums">{formatRupees(allocation.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <td className="py-3 font-semibold">{t("total")}</td>
            <td className="py-3 text-end text-lg font-semibold tabular-nums">{formatRupees(receipt.amount)}</td>
          </tr>
        </tfoot>
      </table>

      {cancelled ? null : (
        <Badge className="absolute end-4 top-4 hidden rotate-6 sm:inline-flex" variant="secondary">
          {t("paidStamp")}
        </Badge>
      )}
    </div>
  );
}
