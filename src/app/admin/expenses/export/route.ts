import type { NextRequest } from "next/server";

import { buildExpenseExport } from "@/server/expense-excel";

import { excelResponse } from "../../excel-response";

/** Same filters as the Expenses page (?areaId=&month=&category=&status=). */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  return excelResponse("expenses", () => buildExpenseExport(params));
}
