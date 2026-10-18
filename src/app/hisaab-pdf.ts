import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { buildHisaabDocument } from "@/components/pdf/hisaab-document";
import { slugify } from "@/lib/hisaab";
import { PermissionError } from "@/lib/permissions";
import { getHisaab, type HisaabView } from "@/server/hisaab";

/** The monthly hisaab as a PDF download (admin, resident and public routes). */
export async function hisaabPdfResponse(hisaab: HisaabView): Promise<Response> {
  const buffer = await renderToBuffer(buildHisaabDocument(hisaab));
  const filename = `hisaab-${hisaab.area.slug ?? slugify(hisaab.area.name)}-${hisaab.month}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * GET handler body for the signed-in PDF routes (?area=&month=). The service
 * checks the role and area scope; an area out of scope is a 404 like a missing one.
 */
export async function signedInHisaabPdf(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  try {
    const { hisaab } = await getHisaab({ area: params.get("area") ?? undefined, month: params.get("month") ?? undefined });
    if (!hisaab) return new Response("Hisaab not found", { status: 404 });
    return await hisaabPdfResponse(hisaab);
  } catch (error) {
    if (error instanceof PermissionError) return new Response(error.code, { status: error.code === "unauthenticated" ? 401 : 403 });
    throw error;
  }
}
