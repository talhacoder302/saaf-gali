// No "server-only" import: the seed and payment core use this too.
// Session-aware settings functions live in settings-admin.ts.

import { connectDB } from "@/lib/db";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { Settings, type SettingsDoc } from "@/models/Settings";

export type AppSettings = Pick<
  SettingsDoc,
  "organisationName" | "receiptPrefix" | "feeDueDay" | "expenseApprovalLimit" | "currency"
> & {
  logoKey: string | null;
  expenseCategories: string[];
  supervisorsCanAddExpenses: boolean;
};

/** The settings singleton, created with defaults the first time it is read. */
export async function loadSettings(): Promise<AppSettings> {
  await connectDB();
  const settings = await Settings.findOneAndUpdate(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  // Fallbacks cover documents saved before a field existed (lean() skips defaults).
  return {
    organisationName: settings?.organisationName ?? "Saaf Gali",
    logoKey: settings?.logoKey ?? null,
    receiptPrefix: settings?.receiptPrefix ?? "SG",
    feeDueDay: settings?.feeDueDay ?? 10,
    expenseApprovalLimit: settings?.expenseApprovalLimit ?? 5000,
    expenseCategories: settings?.expenseCategories?.length ? settings.expenseCategories : [...DEFAULT_EXPENSE_CATEGORIES],
    supervisorsCanAddExpenses: settings?.supervisorsCanAddExpenses ?? false,
    currency: settings?.currency ?? "PKR",
  };
}
