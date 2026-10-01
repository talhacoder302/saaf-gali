import type { NextRequest } from "next/server";

import { buildHouseholdExport } from "@/server/household-excel";

import { excelResponse } from "../excel-response";

/** Same filters as the Households page (?areaId=&blockId=&streetId=&status=&q=). */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return excelResponse("households", () => buildHouseholdExport(params));
}
