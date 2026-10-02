"use client";

import { CheckCircle2, House, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { BillsTable, PaymentsList } from "@/components/shared/fees/fee-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyFees } from "@/server/payments";

type MyFeesViewProps = {
  fees: MyFees;
  /** Home shows the latest few; the bills page shows everything. */
  compact?: boolean;
};

export function MyFeesView({ fees, compact = false }: MyFeesViewProps) {
  const t = useTranslations("resident.fees");

  if (!fees.household) {
    return <EmptyState icon={House} title={t("notLinkedTitle")} description={t("notLinkedBody")} />;
  }

  const limit = compact ? 6 : undefined;
  return (
    <div className="space-y-4">
      <Card className={cn(fees.dueNow > 0 ? "border-destructive/40" : "border-primary/40")}>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("house", { number: fees.household.houseNumber, street: fees.household.streetName, area: fees.household.areaName })}
          </p>
          {fees.dueNow > 0 ? (
            <>
              <p className="text-sm">{t("dueNow")}</p>
              <p className="text-3xl font-semibold tabular-nums text-destructive">{formatRupees(fees.dueNow)}</p>
              <p className="text-sm text-muted-foreground">{t("howToPay")}</p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-lg font-medium text-primary">
              <CheckCircle2 className="size-6" aria-hidden />
              {t("allPaid")}
            </p>
          )}
          <p className="pt-1 text-sm text-muted-foreground">
            {t("monthlyFee", { fee: formatRupees(fees.household.monthlyFee) })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" aria-hidden />
            {t("billsTitle")}
          </CardTitle>
          {compact && fees.bills.length > 6 ? (
            <Button asChild variant="link" size="sm">
              <Link href="/resident/bills">{t("seeAll")}</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <BillsTable history={fees} limit={limit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("receiptsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentsList history={fees} limit={compact ? 5 : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
