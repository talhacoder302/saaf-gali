import { z } from "zod";

import {
  EXCEL_COLUMNS,
  type ExcelColumn,
  type HouseholdStatus,
  type OccupantType,
} from "@/lib/households";
import { normalizeMobile } from "@/lib/mobile";
import { MAX_MONTHLY_FEE } from "@/lib/validators/areas";

// Pure parsing and validation for the Excel import, shared by the preview and
// the final import (which re-validates everything the browser sends back).

export type ImportRawRow = { rowNumber: number } & Record<ExcelColumn, string>;

/** `code` is a key under "errors" in the i18n files. */
export type ImportIssue = { column: ExcelColumn | null; code: string };

export type ValidImportRow = {
  areaId: string;
  blockId: string;
  streetId: string;
  houseNumber: string;
  ownerName: string;
  occupantType: OccupantType;
  contactName: string | null;
  mobile: string | null;
  email: string | null;
  monthlyFee: number;
  status: HouseholdStatus;
  notes: string | null;
};

export type ImportRowResult = {
  row: ImportRawRow;
  issues: ImportIssue[];
  value: ValidImportRow | null;
};

export type StreetLookup = { id: string };
export type BlockLookup = { id: string; streets: Map<string, StreetLookup> };
export type AreaLookup = { id: string; defaultMonthlyFee: number; blocks: Map<string, BlockLookup> };
/** Areas the importing user may write to, keyed by lookupKey(name). */
export type LocationLookup = Map<string, AreaLookup>;

/** Case, spacing and punctuation-insensitive key for matching names from a sheet. */
export function lookupKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-.#/]+/g, " ")
    .trim();
}

/** Accepted header spellings per column (compared with lookupKey). */
const HEADER_ALIASES: Record<ExcelColumn, string[]> = {
  Area: ["area", "area name", "علاقہ"],
  Block: ["block", "sector", "block name", "بلاک"],
  Street: ["street", "gali", "street name", "گلی"],
  "House number": ["house number", "house no", "house", "house #", "h no", "مکان نمبر", "گھر نمبر"],
  "Owner name": ["owner name", "owner", "مالک"],
  "Occupant type": ["occupant type", "occupant", "owner or tenant"],
  "Contact name": ["contact name", "contact"],
  Mobile: ["mobile", "mobile number", "phone", "cell", "موبائل"],
  Email: ["email", "e mail"],
  "Monthly fee": ["monthly fee", "fee", "فیس"],
  Status: ["status", "حالت"],
  Notes: ["notes", "note", "remarks"],
};

export const REQUIRED_COLUMNS: ExcelColumn[] = ["Area", "Block", "Street", "House number", "Owner name"];

export type ParsedSheet = { rows: ImportRawRow[]; missingColumns: ExcelColumn[] };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Turn sheet rows (first row = headers) into raw rows keyed by our column
 * names. Blank rows are skipped; row numbers match what Excel shows.
 */
export function parseSheetRows(grid: unknown[][]): ParsedSheet {
  const [header = [], ...body] = grid;
  const columnIndex = new Map<ExcelColumn, number>();

  header.forEach((cell, index) => {
    const key = lookupKey(cellText(cell));
    const column = EXCEL_COLUMNS.find((name) => HEADER_ALIASES[name].some((alias) => lookupKey(alias) === key));
    if (column && !columnIndex.has(column)) columnIndex.set(column, index);
  });

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column));
  const rows: ImportRawRow[] = [];

  body.forEach((cells, index) => {
    const values = Object.fromEntries(
      EXCEL_COLUMNS.map((column) => {
        const at = columnIndex.get(column);
        return [column, at === undefined ? "" : cellText(cells[at])];
      }),
    ) as Record<ExcelColumn, string>;
    if (EXCEL_COLUMNS.every((column) => values[column] === "")) return;
    rows.push({ rowNumber: index + 2, ...values });
  });

  return { rows, missingColumns };
}

const OCCUPANT_WORDS: Record<string, OccupantType> = {
  owner: "owner",
  malik: "owner",
  "مالک": "owner",
  tenant: "tenant",
  kirayedar: "tenant",
  "kiraya dar": "tenant",
  "کرایہ دار": "tenant",
  "کرایہدار": "tenant",
};

const STATUS_WORDS: Record<string, HouseholdStatus> = {
  active: "active",
  "فعال": "active",
  vacant: "vacant",
  empty: "vacant",
  khali: "vacant",
  "خالی": "vacant",
  exempt: "exempt",
  maaf: "exempt",
  "معاف": "exempt",
  "مستثنیٰ": "exempt",
  "مستثنی": "exempt",
};

/** Key for "this house on this street", used for duplicate checks. */
export function houseKey(streetId: string, houseNumber: string): string {
  return `${streetId}|${lookupKey(houseNumber)}`;
}

function parseFee(text: string, fallback: number): number | null {
  if (text === "") return fallback;
  const cleaned = text.replace(/rs\.?|pkr|,|\s/gi, "");
  if (!/^\d+(\.0+)?$/.test(cleaned)) return null;
  const fee = Number(cleaned);
  return fee <= MAX_MONTHLY_FEE ? fee : null;
}

/**
 * Validate every row. `existing` holds houseKey()s already in the database;
 * duplicates inside the file are reported on the second and later copies.
 */
export function validateImportRows(
  rows: ImportRawRow[],
  lookup: LocationLookup,
  existing: ReadonlySet<string>,
): ImportRowResult[] {
  const seen = new Set<string>();

  return rows.map((row) => {
    const issues: ImportIssue[] = [];
    const issue = (column: ExcelColumn | null, code: string) => issues.push({ column, code });

    const area = row.Area ? lookup.get(lookupKey(row.Area)) : undefined;
    if (!row.Area) issue("Area", "required");
    else if (!area) issue("Area", "importAreaNotFound");

    const block = area && row.Block ? area.blocks.get(lookupKey(row.Block)) : undefined;
    if (!row.Block) issue("Block", "required");
    else if (area && !block) issue("Block", "importBlockNotFound");

    const street = block && row.Street ? block.streets.get(lookupKey(row.Street)) : undefined;
    if (!row.Street) issue("Street", "required");
    else if (block && !street) issue("Street", "importStreetNotFound");

    const houseNumber = row["House number"];
    if (!houseNumber) issue("House number", "required");
    else if (houseNumber.length > 20) issue("House number", "houseNumberTooLong");

    const ownerName = row["Owner name"];
    if (!ownerName) issue("Owner name", "required");
    else if (ownerName.length < 2) issue("Owner name", "nameTooShort");
    else if (ownerName.length > 80) issue("Owner name", "nameTooLong");

    const occupantText = lookupKey(row["Occupant type"]);
    const occupantType = occupantText === "" ? "owner" : OCCUPANT_WORDS[occupantText];
    if (!occupantType) issue("Occupant type", "importInvalidOccupant");

    const contactName = row["Contact name"];
    if (contactName.length > 80) issue("Contact name", "nameTooLong");

    const mobile = row.Mobile ? normalizeMobile(row.Mobile) : null;
    if (row.Mobile && !mobile) issue("Mobile", "invalidMobile");

    const email = row.Email.toLowerCase();
    if (email && !z.email().safeParse(email).success) issue("Email", "invalidEmail");

    const monthlyFee = area ? parseFee(row["Monthly fee"], area.defaultMonthlyFee) : 0;
    if (monthlyFee === null) issue("Monthly fee", "feeInvalid");

    const statusText = lookupKey(row.Status);
    const status = statusText === "" ? "active" : STATUS_WORDS[statusText];
    if (!status) issue("Status", "importInvalidStatus");

    if (row.Notes.length > 500) issue("Notes", "notesTooLong");

    if (street && houseNumber) {
      const key = houseKey(street.id, houseNumber);
      if (existing.has(key)) issue("House number", "importHouseExists");
      else if (seen.has(key)) issue("House number", "importDuplicateInFile");
      seen.add(key);
    }

    if (issues.length > 0 || !area || !block || !street || !occupantType || !status || monthlyFee === null) {
      return { row, issues, value: null };
    }

    return {
      row,
      issues,
      value: {
        areaId: area.id,
        blockId: block.id,
        streetId: street.id,
        houseNumber,
        ownerName,
        occupantType,
        contactName: contactName || null,
        mobile,
        email: email || null,
        monthlyFee,
        status,
        notes: row.Notes || null,
      },
    };
  });
}

/** What the browser sends back to import: raw rows, re-validated on the server. */
export const importRawRowsSchema = z
  .array(
    z
      .object({ rowNumber: z.number().int().min(2) })
      .extend(Object.fromEntries(EXCEL_COLUMNS.map((column) => [column, z.string().max(600)])) as Record<ExcelColumn, z.ZodString>),
  )
  .min(1)
  .max(5000);
