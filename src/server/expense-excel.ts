import "server-only";

import * as XLSX from "xlsx";

import en from "@/i18n/en.json";
import { EXPENSE_EXCEL_COLUMNS, isBuiltInCategory } from "@/lib/expenses";
import { formatDate, karachiDayStart } from "@/lib/format";
import type { ListExpensesInput } from "@/lib/validators/expenses";
import { findExpensesForExport, type ExpenseRow } from "@/server/expenses";

const MAX_EXPORT_ROWS = 20_000;
const WIDTHS: Record<(typeof EXPENSE_EXCEL_COLUMNS)[number], number> = {
  Date: 12,
  Area: 20,
  Category: 14,
  Description: 40,
  Amount: 12,
  Status: 22,
  "Added by": 22,
  "Reviewed by": 22,
  "Review note": 30,
  "Receipt photo": 13,
};

function exportRow(row: ExpenseRow): (string | number)[] {
  const values: Record<(typeof EXPENSE_EXCEL_COLUMNS)[number], string | number> = {
    Date: formatDate(karachiDayStart(row.day), "yyyy-MM-dd"),
    Area: row.areaName,
    Category: isBuiltInCategory(row.category) ? en.expenses.category[row.category] : row.category,
    Description: row.description,
    Amount: row.amount,
    Status: en.expenses.status[row.status],
    "Added by": row.createdByName,
    "Reviewed by": row.reviewedByName ?? "",
    "Review note": row.reviewNote ?? "",
    "Receipt photo": row.photoKey ? "Yes" : "No",
  };
  return EXPENSE_EXCEL_COLUMNS.map((column) => values[column]);
}

/** Every expense matching the page's filters, newest first, with a total row. */
export async function buildExpenseExport(input: Partial<ListExpensesInput>): Promise<Buffer> {
  const rows = await findExpensesForExport(input, MAX_EXPORT_ROWS);
  const spent = rows.filter((row) => row.status === "auto" || row.status === "approved").reduce((sum, row) => sum + row.amount, 0);

  const sheet = XLSX.utils.aoa_to_sheet([
    [...EXPENSE_EXCEL_COLUMNS],
    ...rows.map(exportRow),
    [],
    ["", "", "", "Total spent (approved only)", spent],
  ]);
  sheet["!cols"] = EXPENSE_EXCEL_COLUMNS.map((column) => ({ wch: WIDTHS[column] }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Expenses");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
