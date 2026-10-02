"use client";

import { ArrowLeft, Banknote, CheckCircle2, ExternalLink, House, Loader2, MessageCircle, Search } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { paymentContextAction, recordPaymentAction, searchHouseholdsAction } from "@/app/actions/payments";
import { EmptyState } from "@/components/shared/empty-state";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { receiptWhatsappLink } from "@/lib/fee-messages";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees";
import { formatRupees } from "@/lib/format";
import { formatMobile } from "@/lib/mobile";
import { compareMonths } from "@/lib/months";
import { cn } from "@/lib/utils";
import type { PaymentContext, PaymentSearchRow, RecordedPayment } from "@/server/payments";

type CollectViewProps = {
  organisationName: string;
  /** Public origin for receipt links, e.g. https://saafgali.pk */
  appOrigin: string;
  /** The supervisor screens have a bottom nav; keep the total bar above it. */
  withBottomNav?: boolean;
  /** Open this household straight away (link from the household page). */
  initialHouseholdId?: string | null;
};

function useMonthLabel() {
  const format = useFormatter();
  return (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year ?? 2000, (mon ?? 1) - 1, 15)), { month: "long", year: "numeric", timeZone: "UTC" });
  };
}

export function CollectView({ organisationName, appOrigin, withBottomNav = false, initialHouseholdId = null }: CollectViewProps) {
  const t = useTranslations("collect");
  const errorMessage = useErrorMessage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaymentSearchRow[] | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [recorded, setRecorded] = useState<(RecordedPayment & { household: PaymentContext["household"] }) | null>(null);

  // Search as the collector types.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    const timer = setTimeout(() => {
      startSearching(async () => {
        const result = await searchHouseholdsAction(q);
        if (result.ok) setResults(result.data);
        else toast.error(errorMessage(result.error));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, errorMessage]);

  function open(householdId: string) {
    startLoading(async () => {
      const result = await paymentContextAction(householdId);
      if (result.ok) setContext(result.data);
      else toast.error(errorMessage(result.error));
    });
  }

  // Opened from a household page: load that house once.
  const initialOpened = useRef(false);
  useEffect(() => {
    if (!initialHouseholdId || initialOpened.current) return;
    initialOpened.current = true;
    startLoading(async () => {
      const result = await paymentContextAction(initialHouseholdId);
      if (result.ok) setContext(result.data);
      else toast.error(errorMessage(result.error));
    });
  }, [initialHouseholdId, errorMessage]);

  if (recorded) {
    return (
      <Success
        recorded={recorded}
        organisationName={organisationName}
        appOrigin={appOrigin}
        onAnother={() => {
          setRecorded(null);
          setContext(null);
          setQuery("");
          setResults(null);
        }}
      />
    );
  }

  if (context) {
    return (
      <PaymentForm
        key={context.household.id}
        context={context}
        withBottomNav={withBottomNav}
        onBack={() => setContext(null)}
        onRecorded={(payment) => setRecorded({ ...payment, household: context.household })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim() === "") setResults(null);
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-12 ps-10 text-base"
        />
        {isSearching ? (
          <Loader2 className="absolute end-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {results === null ? (
        <p className="text-sm text-muted-foreground">{t("searchHint")}</p>
      ) : results.length === 0 ? (
        <EmptyState icon={House} title={t("noResults")} description={t("noResultsHint")} />
      ) : (
        <ul className={cn("space-y-2", isLoading && "pointer-events-none opacity-60")}>
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => open(row.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {t("house", { number: row.houseNumber })} · {row.name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.streetName}, {row.blockName}, {row.areaName}
                  </p>
                </div>
                {row.dueNow > 0 ? (
                  <Badge variant="destructive" className="shrink-0 tabular-nums">
                    {formatRupees(row.dueNow)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    {t("nothingDue")}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentForm({
  context,
  withBottomNav,
  onBack,
  onRecorded,
}: {
  context: PaymentContext;
  withBottomNav: boolean;
  onBack: () => void;
  onRecorded: (payment: RecordedPayment) => void;
}) {
  const t = useTranslations("collect");
  const tMethods = useTranslations("fees.methods");
  const errorMessage = useErrorMessage();
  const monthLabel = useMonthLabel();
  const { household, choices, currentMonth } = context;

  // Months are always a run from the oldest: ticking a month ticks every earlier
  // one, unticking clears every later one. That matches "oldest first" exactly.
  const defaultCount = choices.filter((c) => c.kind === "open" && compareMonths(c.month, currentMonth) <= 0).length;
  const [count, setCount] = useState(defaultCount);
  const [mode, setMode] = useState<"months" | "amount">("months");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [isSaving, startSaving] = useTransition();

  const selected = choices.slice(0, count);
  const monthsTotal = selected.reduce((sum, c) => sum + c.due, 0);
  const amount = mode === "months" ? monthsTotal : Number(amountText);
  const amountValid = Number.isSafeInteger(amount) && amount > 0;

  function save() {
    if (!amountValid) {
      toast.error(errorMessage(mode === "months" ? "chooseMonths" : "amountInvalid"));
      return;
    }
    startSaving(async () => {
      const result = await recordPaymentAction({
        householdId: household.id,
        mode,
        months: mode === "months" ? selected.map((c) => c.month) : [],
        amount: mode === "amount" ? amount : 0,
        method,
        note,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved", { receipt: result.data.receiptNumber }));
      onRecorded(result.data);
    });
  }

  return (
    <div className={cn("space-y-4", withBottomNav && "pb-28")}>
      <Button variant="ghost" size="sm" className="-ms-2" onClick={onBack}>
        <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
        {t("back")}
      </Button>

      <Card>
        <CardContent className="space-y-1">
          <p className="text-lg font-semibold">
            {t("house", { number: household.houseNumber })} · {household.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {household.streetName}, {household.blockName}, {household.areaName}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
            <span>
              {t("monthlyFee")}: <strong className="tabular-nums">{formatRupees(household.monthlyFee)}</strong>
            </span>
            <span>
              {t("dueNow")}: <strong className={cn("tabular-nums", context.dueNow > 0 && "text-destructive")}>{formatRupees(context.dueNow)}</strong>
            </span>
            {household.mobile ? (
              <span dir="ltr" className="text-muted-foreground">
                {formatMobile(household.mobile)}
              </span>
            ) : null}
          </div>
          {household.status !== "active" ? (
            <p className="pt-2 text-sm text-muted-foreground">{t("notActive")}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("howMuch")}>
        {(["months", "amount"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => setMode(option)}
            className={cn(
              "h-12 rounded-xl border text-sm font-medium",
              mode === option ? "border-primary bg-accent text-accent-foreground" : "bg-card",
            )}
          >
            {t(`mode.${option}`)}
          </button>
        ))}
      </div>

      {mode === "months" ? (
        choices.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("nothingToSelect")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {choices.map((choice, index) => {
              const checked = index < count;
              const id = `month-${choice.month}`;
              return (
                <li key={choice.month}>
                  <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => setCount(value === true ? index + 1 : index)}
                      className="size-5"
                    />
                    <span className="flex-1">
                      <span className="font-medium">{monthLabel(choice.month)}</span>
                      {choice.kind === "advance" ? (
                        <Badge variant="outline" className="ms-2">
                          {t("advance")}
                        </Badge>
                      ) : choice.paidAmount > 0 ? (
                        <span className="ms-2 text-xs text-muted-foreground">
                          {t("partlyPaid", { paid: formatRupees(choice.paidAmount) })}
                        </span>
                      ) : compareMonths(choice.month, currentMonth) < 0 ? (
                        <Badge variant="destructive" className="ms-2">
                          {t("overdue")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{formatRupees(choice.due)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="space-y-2">
          <Label htmlFor="pay-amount">{t("amount")}</Label>
          <div className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center text-muted-foreground">Rs.</span>
            <Input
              id="pay-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              dir="ltr"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              className="h-12 ps-11 text-lg"
            />
          </div>
          <p className="text-sm text-muted-foreground">{context.allowAdvance ? t("amountHint") : t("amountHintNoAdvance")}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("method")}</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("method")}>
          {PAYMENT_METHODS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={method === option}
              onClick={() => setMethod(option)}
              className={cn(
                "h-12 rounded-xl border text-sm font-medium",
                method === option ? "border-primary bg-accent text-accent-foreground" : "bg-card",
              )}
            >
              {tMethods(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pay-note">{t("note")}</Label>
        <Textarea id="pay-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("notePlaceholder")} />
      </div>

      <div
        className={cn(
          "z-30 border-t bg-background p-3",
          withBottomNav ? "fixed inset-x-0 bottom-16" : "sticky bottom-0 -mx-4 lg:-mx-8",
        )}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{t("total")}</p>
            <p className="text-xl font-semibold tabular-nums">{amountValid ? formatRupees(amount) : "—"}</p>
          </div>
          <Button size="lg" className="h-12 px-6 text-base" disabled={!amountValid || isSaving} onClick={save}>
            <Banknote aria-hidden />
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Success({
  recorded,
  organisationName,
  appOrigin,
  onAnother,
}: {
  recorded: RecordedPayment & { household: PaymentContext["household"] };
  organisationName: string;
  appOrigin: string;
  onAnother: () => void;
}) {
  const t = useTranslations("collect");
  const receiptPath = `/receipt/${recorded.publicToken}`;
  const receiptUrl = `${appOrigin}${receiptPath}`;
  const whatsapp = receiptWhatsappLink(
    {
      organisation: organisationName,
      name: recorded.household.name,
      amount: recorded.amount,
      months: recorded.months,
      receiptNumber: recorded.receiptNumber,
      receiptUrl,
    },
    recorded.household.mobile,
  );

  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="mx-auto size-14 text-primary" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("successTitle", { amount: formatRupees(recorded.amount) })}</h1>
        <p className="text-muted-foreground">
          {t("successBody", { number: recorded.household.houseNumber, name: recorded.household.name })}
        </p>
        <p dir="ltr" className="font-mono text-lg">
          {recorded.receiptNumber}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="h-12 text-base">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            {t("sendWhatsapp")}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 text-base">
          <a href={receiptPath} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t("viewReceipt")}
          </a>
        </Button>
        <Button size="lg" variant="ghost" className="h-12 text-base" onClick={onAnother}>
          {t("collectAnother")}
        </Button>
      </div>
    </div>
  );
}
