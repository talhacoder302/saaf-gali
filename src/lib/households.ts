// Plain constants shared by the model, services and client forms (no mongoose here).

export const HOUSEHOLD_STATUSES = ["active", "vacant", "exempt"] as const;
export type HouseholdStatus = (typeof HOUSEHOLD_STATUSES)[number];

export const OCCUPANT_TYPES = ["owner", "tenant"] as const;
export type OccupantType = (typeof OCCUPANT_TYPES)[number];

/**
 * Only active households get monthly fee bills. Vacant houses and exempt ones
 * (mosque, imam's house, widow's house...) never do. The billing module must
 * use this, not its own check.
 */
export function isBillable(status: HouseholdStatus): boolean {
  return status === "active";
}

export const HOUSEHOLDS_PAGE_SIZE = 25;
export const MAX_IMPORT_ROWS = 5000;

/** Column headers of the import template and the export, in order. */
export const EXCEL_COLUMNS = [
  "Area",
  "Block",
  "Street",
  "House number",
  "Owner name",
  "Occupant type",
  "Contact name",
  "Mobile",
  "Email",
  "Monthly fee",
  "Status",
  "Notes",
] as const;
export type ExcelColumn = (typeof EXCEL_COLUMNS)[number];
