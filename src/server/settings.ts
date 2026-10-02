// No "server-only" import: the seed and payment core use this too.

import { connectDB } from "@/lib/db";
import { Settings, type SettingsDoc } from "@/models/Settings";

export type AppSettings = Pick<
  SettingsDoc,
  "organisationName" | "receiptPrefix" | "feeDueDay" | "expenseApprovalLimit" | "currency"
>;

/** The settings singleton, created with defaults the first time it is read. */
export async function loadSettings(): Promise<AppSettings> {
  await connectDB();
  const settings = await Settings.findOneAndUpdate(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return {
    organisationName: settings?.organisationName ?? "Saaf Gali",
    receiptPrefix: settings?.receiptPrefix ?? "SG",
    feeDueDay: settings?.feeDueDay ?? 10,
    expenseApprovalLimit: settings?.expenseApprovalLimit ?? 5000,
    currency: settings?.currency ?? "PKR",
  };
}
