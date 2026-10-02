import { renderToBuffer } from "@react-pdf/renderer";

import { buildReceiptDocument } from "@/components/pdf/receipt-document";
import { getReceiptByToken } from "@/server/payments";

type Context = { params: Promise<{ token: string }> };

/** The receipt as a PDF download. Public, like the receipt page. */
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const receipt = await getReceiptByToken(token);
  if (!receipt) return new Response("Receipt not found", { status: 404 });

  const buffer = await renderToBuffer(buildReceiptDocument(receipt));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
