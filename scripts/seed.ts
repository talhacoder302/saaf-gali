/**
 * Seeds the database with demo data. Safe to run more than once.
 *
 *   npm run seed
 *
 * Each module adds its own demo data here (areas, households, workers...).
 */
import { connectDB, disconnectDB } from "@/lib/db";
import { env } from "@/lib/env";
import { Settings } from "@/models/Settings";

async function seedSettings() {
  await Settings.updateOne(
    { key: "singleton" },
    {
      $setOnInsert: {
        organisationName: "Saaf Gali Rawalpindi & Islamabad",
        receiptPrefix: "SG",
        feeDueDay: 10,
        expenseApprovalLimit: 5000,
        currency: "PKR",
      },
    },
    { upsert: true },
  );
  console.log("  settings ready");
}

async function main() {
  console.log(`Seeding database "${env.MONGODB_DB_NAME}"...`);
  const mongoose = await connectDB();

  await seedSettings();

  const collections = await mongoose.connection.db?.listCollections().toArray();
  console.log(`Done. Collections: ${collections?.map((c) => c.name).join(", ") ?? "none"}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
