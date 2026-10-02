"use client";

import { Ban, ExternalLink, ReceiptText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelPaymentAction } from "@/app/admin/fees/actions";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { BillStatus } from "@/lib/fees";
import { formatRupees } from "@/lib/format";
import { cancelPaymentSchema } from "@/lib/validators/fees";
import { cn } from "@/lib/utils";
import type { FeeHistory, PaymentHistoryRow } from "@/server/payments";

const STATUS_VARIANT: Record<BillStatus, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "destructive",
  exempt: "outline",
};

type FeeHistoryViewProps = {
  history: FeeHistory;
  /** Super admins can cancel payments. */
  canCancel?: boolean;
  /** Limit rows (resident home); undefined shows everything. */
  limit?: number;
};

export function useMonthName() {
  const format = useFormatter();
  return (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15)), { month: "short", year: "numeric", timeZone: "UTC" });
  };
}

export function BillsTable({ history, limit }: FeeHistoryViewProps) {
  const t = useTranslations("feeHistory");
  const tStatus = useTranslations("fees.billStatus");
  const monthName = useMonthName();
  const bills = limit ? history.bills.slice(0, limit) : history.bills;

  if (bills.length === 0) return <p className="text-sm text-muted-foreground">{t("noBills")}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t("month")}</TableHead>
            <TableHead className="text-start">{t("amount")}</TableHead>
            <TableHead className="text-start">{t("paid")}</TableHead>
            <TableHead className="text-start">{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id}>
              <TableCell className="font-medium">
                {monthName(bill.month)}
                {bill.month > history.currentMonth ? (
                  <Badge variant="outline" className="ms-2">
                    {t("advance")}
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="tabular-nums">{formatRupees(bill.amount)}</TableCell>
              <TableCell className="tabular-nums">{formatRupees(bill.paidAmount)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[bill.status]}>{tStatus(bill.status)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PaymentsList({ history, canCancel = false, limit }: FeeHistoryViewProps) {
  const t = useTranslations("feeHistory");
  const tMethods = useTranslations("fees.methods");
  const format = useFormatter();
  const monthName = useMonthName();
  const [cancelling, setCancelling] = useState<PaymentHistoryRow | null>(null);
  const payments = limit ? history.payments.slice(0, limit) : history.payments;

  if (payments.length === 0) return <p className="text-sm text-muted-foreground">{t("noPayments")}</p>;
  return (
    <>
      <ul className="divide-y rounded-xl border">
        {payments.map((payment) => {
          const cancelled = payment.status === "cancelled";
          return (
            <li key={payment.id} className={cn("flex flex-wrap items-center justify-between gap-3 p-3", cancelled && "opacity-70")}>
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className={cn("tabular-nums", cancelled && "line-through")}>{formatRupees(payment.amount)}</span>
                  <span className="text-sm font-normal text-muted-foreground">{tMethods(payment.method)}</span>
                  {cancelled ? <Badge variant="destructive">{t("cancelled")}</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span dir="ltr" className="font-mono">
                    {payment.receiptNumber}
                  </span>{" "}
                  · {format.dateTime(new Date(payment.paidAt), { dateStyle: "medium" })}
                  {payment.receivedBy ? ` · ${payment.receivedBy}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{payment.months.map(monthName).join(", ")}</p>
                {cancelled && payment.cancelReason ? (
                  <p className="text-xs text-destructive">{t("cancelReason", { reason: payment.cancelReason })}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild size="sm" variant="ghost">
                  <a href={`/receipt/${payment.publicToken}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden />
                    {t("receipt")}
                  </a>
                </Button>
                {canCancel && !cancelled ? (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(payment)}>
                    <Ban aria-hidden />
                    {t("cancel")}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {cancelling ? <CancelPaymentDialog payment={cancelling} onClose={() => setCancelling(null)} /> : null}
    </>
  );
}

function CancelPaymentDialog({ payment, onClose }: { payment: PaymentHistoryRow; onClose: () => void }) {
  const t = useTranslations("feeHistory.cancelDialog");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    const parsed = cancelPaymentSchema.safeParse({ paymentId: payment.id, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "invalid");
      return;
    }
    startTransition(async () => {
      const result = await cancelPaymentAction(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done"));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { receipt: payment.receiptNumber })}</DialogTitle>
          <DialogDescription>{t("description", { amount: formatRupees(payment.amount) })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{t("reason")}</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="text-sm text-destructive">{errorMessage(error)}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            <Ban aria-hidden />
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Both sections together, for the admin household page. */
export function FeeHistoryView({ history, canCancel }: FeeHistoryViewProps) {
  const t = useTranslations("feeHistory");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <ReceiptText className="size-4 text-muted-foreground" aria-hidden />
        <span>{t("dueNow")}</span>
        <strong className={cn("tabular-nums", history.dueNow > 0 && "text-destructive")}>{formatRupees(history.dueNow)}</strong>
      </div>
      <section className="space-y-2">
        <h3 className="font-medium">{t("billsTitle")}</h3>
        <BillsTable history={history} />
      </section>
      <section className="space-y-2">
        <h3 className="font-medium">{t("paymentsTitle")}</h3>
        <PaymentsList history={history} canCancel={canCancel} />
      </section>
    </div>
  );
}
