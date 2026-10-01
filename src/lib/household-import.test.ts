import { describe, expect, it } from "vitest";

import {
  houseKey,
  lookupKey,
  parseSheetRows,
  validateImportRows,
  type ImportRawRow,
  type LocationLookup,
} from "./household-import";
import { EXCEL_COLUMNS, isBillable } from "./households";

const lookup: LocationLookup = new Map([
  [
    lookupKey("Satellite Town"),
    {
      id: "area1",
      defaultMonthlyFee: 150,
      blocks: new Map([
        [
          lookupKey("Block A"),
          { id: "blockA", streets: new Map([[lookupKey("Street 1"), { id: "street1" }], [lookupKey("Masjid Wali Gali"), { id: "street2" }]]) },
        ],
      ]),
    },
  ],
  [
    lookupKey("G-11"),
    {
      id: "area2",
      defaultMonthlyFee: 100,
      blocks: new Map([[lookupKey("G-11/2"), { id: "blockG", streets: new Map([[lookupKey("Street 20"), { id: "street20" }]]) }]]),
    },
  ],
]);

function row(values: Partial<Record<(typeof EXCEL_COLUMNS)[number], string>>, rowNumber = 2): ImportRawRow {
  const empty = Object.fromEntries(EXCEL_COLUMNS.map((column) => [column, ""])) as Record<(typeof EXCEL_COLUMNS)[number], string>;
  return {
    rowNumber,
    ...empty,
    Area: "Satellite Town",
    Block: "Block A",
    Street: "Street 1",
    "House number": "12",
    "Owner name": "Muhammad Tariq",
    ...values,
  };
}

const codes = (result: { issues: { code: string }[] }) => result.issues.map((issue) => issue.code);

describe("parseSheetRows", () => {
  it("maps headers in any case and order, including aliases", () => {
    const parsed = parseSheetRows([
      ["House No.", "street", "BLOCK", "Area", "Owner", "Phone", "Fee"],
      ["7", "Street 1", "Block A", "Satellite Town", "Ali Raza", "3001234567", "200"],
    ]);
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      "House number": "7",
      Street: "Street 1",
      Mobile: "3001234567",
      "Monthly fee": "200",
    });
  });

  it("skips blank rows but keeps Excel row numbers", () => {
    const parsed = parseSheetRows([[...EXCEL_COLUMNS], [], ["", "", ""], ["Satellite Town", "Block A", "Street 1", "3", "Ali"]]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.rowNumber).toBe(4);
  });

  it("reports missing required columns", () => {
    expect(parseSheetRows([["Area", "Street", "Owner name"]]).missingColumns).toEqual(["Block", "House number"]);
  });
});

describe("validateImportRows", () => {
  it("accepts a good row and applies defaults", () => {
    const [result] = validateImportRows([row({ Mobile: "+92 300 1234567" })], lookup, new Set());
    expect(result?.issues).toEqual([]);
    expect(result?.value).toMatchObject({
      areaId: "area1",
      blockId: "blockA",
      streetId: "street1",
      mobile: "03001234567",
      monthlyFee: 150,
      occupantType: "owner",
      status: "active",
    });
  });

  it("matches names loosely", () => {
    const [result] = validateImportRows(
      [row({ Area: "g-11", Block: "G 11/2", Street: "street 20", "Monthly fee": "Rs. 1,200" })],
      lookup,
      new Set(),
    );
    expect(result?.value).toMatchObject({ streetId: "street20", monthlyFee: 1200 });
  });

  it("understands Urdu occupant and status words", () => {
    const [result] = validateImportRows([row({ "Occupant type": "کرایہ دار", Status: "خالی" })], lookup, new Set());
    expect(result?.value).toMatchObject({ occupantType: "tenant", status: "vacant" });
  });

  it("flags a missing street", () => {
    const [result] = validateImportRows([row({ Street: "Street 99" })], lookup, new Set());
    expect(codes(result!)).toEqual(["importStreetNotFound"]);
    expect(result?.value).toBeNull();
  });

  it("flags unknown areas without piling on block and street errors", () => {
    const [result] = validateImportRows([row({ Area: "Lahore Cantt" })], lookup, new Set());
    expect(codes(result!)).toEqual(["importAreaNotFound"]);
  });

  it("flags a bad mobile", () => {
    const [result] = validateImportRows([row({ Mobile: "12345" })], lookup, new Set());
    expect(result?.issues).toEqual([{ column: "Mobile", code: "invalidMobile" }]);
  });

  it("flags houses already in the database", () => {
    const [result] = validateImportRows([row({ "House number": "12" })], lookup, new Set([houseKey("street1", "12")]));
    expect(codes(result!)).toEqual(["importHouseExists"]);
  });

  it("flags the second copy of a house in the same file", () => {
    const results = validateImportRows([row({}, 2), row({ "House number": " 12 " }, 3), row({ "House number": "13" }, 4)], lookup, new Set());
    expect(results.map(codes)).toEqual([[], ["importDuplicateInFile"], []]);
  });

  it("flags missing required fields, bad fee, occupant and status", () => {
    const [result] = validateImportRows(
      [row({ "House number": "", "Owner name": "", "Monthly fee": "150.5", "Occupant type": "landlord", Status: "closed" })],
      lookup,
      new Set(),
    );
    expect(codes(result!).sort()).toEqual(
      ["feeInvalid", "importInvalidOccupant", "importInvalidStatus", "required", "required"].sort(),
    );
  });
});

describe("isBillable", () => {
  it("bills only active households", () => {
    expect(isBillable("active")).toBe(true);
    expect(isBillable("vacant")).toBe(false);
    expect(isBillable("exempt")).toBe(false);
  });
});
