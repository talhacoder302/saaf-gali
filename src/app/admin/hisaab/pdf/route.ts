import { signedInHisaabPdf } from "@/app/hisaab-pdf";

/** This month's hisaab as a PDF (?area=&month=); the service checks role and area. */
export async function GET(request: Request) {
  return signedInHisaabPdf(request);
}
