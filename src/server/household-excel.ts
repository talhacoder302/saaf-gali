import "server-only";

import { Types } from "mongoose";
import * as XLSX from "xlsx";

import { connectDB } from "@/lib/db";
import {
  houseKey,
  importRawRowsSchema,
  lookupKey,
  parseSheetRows,
  validateImportRows,
  type ImportIssue,
  type ImportRawRow,
  type LocationLookup,
} from "@/lib/household-import";
import { EXCEL_COLUMNS, MAX_IMPORT_ROWS, type ExcelColumn } from "@/lib/households";
import { requireRole } from "@/lib/permissions";
import { ADMIN_ROLES } from "@/lib/roles";
import { listHouseholdsSchema, type ListHouseholdsInput } from "@/lib/validators/households";
import { Household } from "@/models/Household";
import { logActivity } from "@/server/activity";
import { ServiceError } from "@/server/errors";
import { findHouseholdRows, householdsFilter, type HouseholdRow } from "@/server/households";
import { loadLocationTree, toLocationLookup, type AreaNode } from "@/server/locations";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_EXPORT_ROWS = 20_000;
const COLUMN_WIDTHS: Record<ExcelColumn, number> = {
  Area: 20,
  Block: 14,
  Street: 22,
  "House number": 13,
  "Owner name": 24,
  "Occupant type": 14,
  "Contact name": 22,
  Mobile: 15,
  Email: 26,
  "Monthly fee": 12,
  Status: 10,
  Notes: 30,
};

function sheetFrom(rows: (string | number)[][], widths: number[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  return sheet;
}

function toBuffer(book: XLSX.WorkBook): Buffer {
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---------------------------------------------------------------------------
// Template and export
// ---------------------------------------------------------------------------

/** Blank import sheet with one example row, plus a list of valid streets and a help sheet. */
export async function buildImportTemplate(): Promise<Buffer> {
  const actor = await requireRole(...ADMIN_ROLES);
  const tree = await loadLocationTree(actor);

  const firstArea = tree.find((area) => area.blocks.some((block) => block.streets.length > 0));
  const firstBlock = firstArea?.blocks.find((block) => block.streets.length > 0);
  const example: Record<ExcelColumn, string | number> = {
    Area: firstArea?.name ?? "Satellite Town",
    Block: firstBlock?.name ?? "Block A",
    Street: firstBlock?.streets[0]?.name ?? "Street 1",
    "House number": "12-B",
    "Owner name": "Muhammad Tariq",
    "Occupant type": "owner",
    "Contact name": "",
    Mobile: "0300-1234567",
    Email: "",
    "Monthly fee": firstArea?.defaultMonthlyFee ?? 150,
    Status: "active",
    Notes: "Delete this example row",
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheetFrom([[...EXCEL_COLUMNS], EXCEL_COLUMNS.map((column) => example[column])], EXCEL_COLUMNS.map((c) => COLUMN_WIDTHS[c])),
    "Households",
  );
  XLSX.utils.book_append_sheet(book, sheetFrom(streetListRows(tree), [22, 16, 26, 14]), "Streets");
  XLSX.utils.book_append_sheet(
    book,
    sheetFrom(
      [
        ["How to fill the Households sheet"],
        ["Area, Block, Street", "Must match a row on the Streets sheet (spelling and capitals do not matter)."],
        ["House number", "Required. Unique within a street, e.g. 12, 12-B, 45/A."],
        ["Owner name", "Required."],
        ["Occupant type", "owner or tenant. Empty means owner."],
        ["Mobile", "Optional. Any Pakistani format: 0300-1234567, +92 300 1234567, 3001234567."],
        ["Monthly fee", "Optional, whole rupees. Empty means the area's default fee."],
        ["Status", "active, vacant or exempt. Empty means active. Vacant and exempt houses are not billed."],
      ],
      [22, 90],
    ),
    "Help",
  );
  return toBuffer(book);
}

function streetListRows(tree: AreaNode[]): (string | number)[][] {
  const rows: (string | number)[][] = [["Area", "Block", "Street", "Default fee"]];
  for (const area of tree) {
    for (const block of area.blocks) {
      for (const street of block.streets) rows.push([area.name, block.name, street.name, area.defaultMonthlyFee]);
    }
  }
  return rows;
}

function exportRow(row: HouseholdRow): (string | number)[] {
  const values: Record<ExcelColumn, string | number> = {
    Area: row.areaName,
    Block: row.blockName,
    Street: row.streetName,
    "House number": row.houseNumber,
    "Owner name": row.ownerName,
    "Occupant type": row.occupantType,
    "Contact name": row.contactName ?? "",
    Mobile: row.mobile ?? "",
    Email: row.email ?? "",
    "Monthly fee": row.monthlyFee,
    Status: row.status,
    Notes: row.notes ?? "",
  };
  return EXCEL_COLUMNS.map((column) => values[column]);
}

/** Every household matching the page's filters, in the same columns as the template. */
export async function buildHouseholdExport(input: Partial<ListHouseholdsInput>): Promise<Buffer> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listHouseholdsSchema.parse(input);
  await connectDB();

  const filter = householdsFilter(actor, params);
  const rows = await findHouseholdRows(actor, filter, MAX_EXPORT_ROWS);

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheetFrom(
      [
        [...EXCEL_COLUMNS],
        ...rows.map(exportRow),

      ],
      EXCEL_COLUMNS.map((c) => COLUMN_WIDTHS[c]),
    ),
    "Households",
  );
  return toBuffer(book);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportPreviewRow = { row: ImportRawRow; issues: ImportIssue[] };

export type ImportPreview = {
  rows: ImportPreviewRow[];
  validCount: number;
  invalidCount: number;
  missingColumns: ExcelColumn[];
};

/** Houses already saved in the areas the file mentions, as houseKey()s. */
async function existingHouseKeys(rows: ImportRawRow[], lookup: LocationLookup): Promise<Set<string>> {
  const areaIds = [
    ...new Set(rows.map((row) => lookup.get(lookupKey(row.Area))?.id).filter((id): id is string => Boolean(id))),
  ];
  const houses = await Household.find({ areaId: { $in: areaIds } }).select("streetId houseNumber").lean();
  return new Set(houses.map((house) => houseKey(house.streetId.toString(), house.houseNumber)));
}

function readWorkbook(buffer: ArrayBuffer): unknown[][] {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(new Uint8Array(buffer), { type: "array" });
  } catch {
    throw new ServiceError("import_unreadable");
  }
  // Prefer a sheet called "Households" (our template), else the first one.
  const name = book.SheetNames.find((sheet) => lookupKey(sheet) === "households") ?? book.SheetNames[0];
  const sheet = name ? book.Sheets[name] : undefined;
  if (!sheet) throw new ServiceError("import_unreadable");
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
}

/** Read an uploaded file and check every row without saving anything. */
export async function previewHouseholdImport(file: unknown): Promise<ImportPreview> {
  const actor = await requireRole(...ADMIN_ROLES);
  if (!(file instanceof File) || file.size === 0) throw new ServiceError("import_no_file");
  if (file.size > MAX_FILE_BYTES) throw new ServiceError("import_file_too_big");
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new ServiceError("import_wrong_type");

  const parsed = parseSheetRows(readWorkbook(await file.arrayBuffer()));
  if (parsed.missingColumns.length > 0) {
    return { rows: [], validCount: 0, invalidCount: 0, missingColumns: parsed.missingColumns };
  }
  if (parsed.rows.length === 0) throw new ServiceError("import_empty");
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw new ServiceError("import_too_many_rows");

  const lookup = toLocationLookup(await loadLocationTree(actor));
  const results = validateImportRows(parsed.rows, lookup, await existingHouseKeys(parsed.rows, lookup));
  const validCount = results.filter((result) => result.value).length;

  return {
    rows: results.map(({ row, issues }) => ({ row, issues })),
    validCount,
    invalidCount: results.length - validCount,
    missingColumns: [],
  };
}

function insertedCountOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const direct = (error as { insertedCount?: unknown }).insertedCount;
  if (typeof direct === "number") return direct;
  const result = (error as { result?: { insertedCount?: unknown } }).result;
  return typeof result?.insertedCount === "number" ? result.insertedCount : null;
}

/**
 * Save the rows that pass validation. The rows come back from the browser, so
 * everything is checked again here; invalid rows are skipped, not trusted.
 */
export async function importHouseholds(rawRows: unknown): Promise<{ imported: number; skipped: number }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const rows = importRawRowsSchema.parse(rawRows);
  await connectDB();

  const lookup = toLocationLookup(await loadLocationTree(actor));
  const results = validateImportRows(rows, lookup, await existingHouseKeys(rows, lookup));
  const valid = results.flatMap((result) => (result.value ? [result.value] : []));
  if (valid.length === 0) throw new ServiceError("import_nothing_valid");

  const operations = valid.map((value) => ({
    insertOne: {
      document: {
        areaId: new Types.ObjectId(value.areaId),
        blockId: new Types.ObjectId(value.blockId),
        streetId: new Types.ObjectId(value.streetId),
        houseNumber: value.houseNumber,
        ownerName: value.ownerName,
        occupantType: value.occupantType,
        monthlyFee: value.monthlyFee,
        status: value.status,
        createdBy: new Types.ObjectId(actor.id),
        ...(value.contactName ? { contactName: value.contactName } : {}),
        ...(value.mobile ? { mobile: value.mobile } : {}),
        ...(value.email ? { email: value.email } : {}),
        ...(value.notes ? { notes: value.notes } : {}),
      },
    },
  }));

  let imported: number;
  try {
    imported = (await Household.bulkWrite(operations, { ordered: false })).insertedCount;
  } catch (error) {
    // Someone added the same house meanwhile: keep what was inserted.
    const partial = insertedCountOf(error);
    if (partial === null) throw error;
    imported = partial;
  }

  const perArea = new Map<string, number>();
  for (const value of valid) perArea.set(value.areaId, (perArea.get(value.areaId) ?? 0) + 1);
  for (const [areaId, count] of perArea) {
    await logActivity({ actorId: actor.id, action: "import", entity: "Household", areaId, meta: { rows: count } });
  }

  return { imported, skipped: rows.length - imported };
}
