import { buildImportTemplate } from "@/server/household-excel";

import { excelResponse } from "../excel-response";

export async function GET() {
  return excelResponse("households-template", buildImportTemplate);
}
