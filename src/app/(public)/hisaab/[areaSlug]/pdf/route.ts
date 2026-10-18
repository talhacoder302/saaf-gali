import { hisaabPdfResponse } from "@/app/hisaab-pdf";
import { getPublicHisaab } from "@/server/hisaab";

type Context = { params: Promise<{ areaSlug: string }> };

/** The public hisaab as a PDF. Public like the page, and off whenever the link is off. */
export async function GET(request: Request, { params }: Context) {
  const { areaSlug } = await params;
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const hisaab = await getPublicHisaab(areaSlug, { month });
  if (!hisaab) return new Response("Hisaab not found", { status: 404 });
  return hisaabPdfResponse(hisaab);
}
