import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReceiptActions } from "@/components/shared/fees/receipt-actions";
import { ReceiptCard } from "@/components/shared/fees/receipt-card";
import { getAppOrigin } from "@/server/app-url";
import { getReceiptByToken } from "@/server/payments";

type ReceiptPageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: ReceiptPageProps): Promise<Metadata> {
  const { token } = await params;
  const receipt = await getReceiptByToken(token);
  const t = await getTranslations("receipt");
  // Receipts are shared by link; keep them out of search engines.
  return { title: receipt ? `${t("title")} ${receipt.receiptNumber}` : t("title"), robots: { index: false, follow: false } };
}

/** Public receipt page: opened from the WhatsApp link, no login needed. */
export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { token } = await params;
  const receipt = await getReceiptByToken(token);
  if (!receipt) notFound();

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-8">
      <ReceiptCard receipt={receipt} />
      <ReceiptActions
        token={receipt.publicToken}
        receiptUrl={`${await getAppOrigin()}/receipt/${receipt.publicToken}`}
        organisationName={receipt.organisationName}
        name={receipt.household.name}
        mobile={receipt.household.mobile}
        amount={receipt.amount}
        months={receipt.months}
        receiptNumber={receipt.receiptNumber}
        cancelled={receipt.status === "cancelled"}
      />
    </div>
  );
}
