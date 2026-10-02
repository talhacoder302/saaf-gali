"use client";

import { Download, MessageCircle, Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { receiptWhatsappLink } from "@/lib/fee-messages";

type ReceiptActionsProps = {
  token: string;
  /** Absolute link to this receipt, built on the server. */
  receiptUrl: string;
  organisationName: string;
  name: string;
  mobile: string | null;
  amount: number;
  months: string[];
  receiptNumber: string;
  cancelled: boolean;
};

export function ReceiptActions(props: ReceiptActionsProps) {
  const t = useTranslations("receipt");
  const path = `/receipt/${props.token}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row print:hidden">
      {props.cancelled ? null : (
        <Button asChild size="lg" className="h-12 flex-1 text-base">
          <a
            href={receiptWhatsappLink(
              {
                organisation: props.organisationName,
                name: props.name,
                amount: props.amount,
                months: props.months,
                receiptNumber: props.receiptNumber,
                receiptUrl: props.receiptUrl,
              },
              props.mobile,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden />
            {t("sendWhatsapp")}
          </a>
        </Button>
      )}
      <Button asChild size="lg" variant="outline" className="h-12 flex-1 text-base">
        <a href={`${path}/pdf`} download>
          <Download aria-hidden />
          {t("downloadPdf")}
        </a>
      </Button>
      <Button size="lg" variant="ghost" className="h-12 text-base" onClick={() => window.print()}>
        <Printer aria-hidden />
        {t("print")}
      </Button>
    </div>
  );
}
