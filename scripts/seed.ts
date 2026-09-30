/**
 * Seeds the database with demo data. Safe to run more than once: existing
 * records are left alone, so passwords you changed are not overwritten.
 *
 *   npm run seed
 *
 * Needs MONGODB_URI, SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD in .env.local.
 * Each module adds its own demo data here.
 */
import type { Types } from "mongoose";

import type { Locale } from "@/i18n/config";
import { connectDB, disconnectDB } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMobile, normalizeMobile } from "@/lib/mobile";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { passwordSchema } from "@/lib/validators/auth";
import { Area, type City } from "@/models/Area";
import { Settings } from "@/models/Settings";
import { User } from "@/models/User";

/**
 * Password for every demo user. Demo users skip the forced password change so
 * the app is quick to try; real users added from the Users page do not.
 */
const DEMO_PASSWORD = "Safai@1234";

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

const AREAS: { name: string; city: City; description: string; defaultMonthlyFee: number }[] = [
  {
    name: "Satellite Town",
    city: "Rawalpindi",
    description: "Blocks A to F around Commercial Market.",
    defaultMonthlyFee: 150,
  },
  {
    name: "Bahria Town Phase 4",
    city: "Rawalpindi",
    description: "Civic Centre and surrounding streets.",
    defaultMonthlyFee: 200,
  },
  { name: "G-11", city: "Islamabad", description: "Sectors G-11/1 to G-11/4.", defaultMonthlyFee: 150 },
  { name: "I-8", city: "Islamabad", description: "Sectors I-8/1 to I-8/4.", defaultMonthlyFee: 100 },
];

async function seedAreas(): Promise<Map<string, Types.ObjectId>> {
  const ids = new Map<string, Types.ObjectId>();
  for (const area of AREAS) {
    const doc = await Area.findOneAndUpdate(
      { city: area.city, name: area.name },
      { $setOnInsert: area },
      { upsert: true, returnDocument: "after" },
    );
    ids.set(area.name, doc._id);
  }
  console.log(`  ${AREAS.length} areas ready`);
  return ids;
}

async function seedSuperAdmin() {
  const mobile = env.SEED_ADMIN_MOBILE ? normalizeMobile(env.SEED_ADMIN_MOBILE) : null;
  const password = env.SEED_ADMIN_PASSWORD;
  if (!mobile || !password) {
    console.warn("  ! SEED_ADMIN_MOBILE / SEED_ADMIN_PASSWORD not set, skipping the super admin");
    return;
  }
  if (!passwordSchema.safeParse(password).success) {
    throw new Error("SEED_ADMIN_PASSWORD must be 8 to 72 characters.");
  }

  const existing = await User.findOne({ mobile });
  if (existing) {
    // Never overwrite a password someone may have changed; just make sure they can get in.
    await User.updateOne({ _id: existing._id }, { $set: { role: "super_admin", status: "active" } });
    console.log(`  super admin ${formatMobile(mobile)} already exists (password unchanged)`);
    return;
  }

  await User.create({
    name: "Super Admin",
    mobile,
    passwordHash: await hashPassword(password),
    role: "super_admin",
    areaIds: [],
    language: "en",
  });
  console.log(`  super admin created: ${formatMobile(mobile)}`);
}

type DemoUser = { name: string; mobile: string; role: Role; areas: string[]; language: Locale };

const DEMO_USERS: DemoUser[] = [
  { name: "Imran Qureshi", mobile: "03005550101", role: "area_manager", areas: ["Satellite Town", "Bahria Town Phase 4"], language: "en" },
  { name: "Sadia Malik", mobile: "03215550102", role: "area_manager", areas: ["G-11", "I-8"], language: "en" },
  { name: "Tariq Mehmood", mobile: "03335550103", role: "supervisor", areas: ["Satellite Town"], language: "ur" },
  { name: "Naveed Akhtar", mobile: "03455550104", role: "supervisor", areas: ["G-11"], language: "ur" },
  { name: "Muhammad Aslam", mobile: "03015550105", role: "worker", areas: ["Satellite Town"], language: "ur" },
  { name: "Rashid Masih", mobile: "03025550106", role: "worker", areas: ["Satellite Town"], language: "ur" },
  { name: "Shahid Iqbal", mobile: "03115550107", role: "worker", areas: ["Bahria Town Phase 4"], language: "ur" },
  { name: "Javed Gill", mobile: "03125550108", role: "worker", areas: ["G-11"], language: "ur" },
  { name: "Ayesha Siddiqui", mobile: "03225550109", role: "resident", areas: ["Satellite Town"], language: "en" },
  { name: "Farhan Butt", mobile: "03235550110", role: "resident", areas: ["G-11"], language: "ur" },
  { name: "Nasreen Akhtar", mobile: "03465550111", role: "resident", areas: ["I-8"], language: "ur" },
  { name: "Col. (R) Khalid Mahmood", mobile: "03005550112", role: "committee", areas: ["Satellite Town"], language: "en" },
];

async function seedDemoUsers(areaIds: Map<string, Types.ObjectId>) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  let created = 0;
  for (const demo of DEMO_USERS) {
    if (await User.exists({ mobile: demo.mobile })) continue;
    await User.create({
      name: demo.name,
      mobile: demo.mobile,
      passwordHash,
      role: demo.role,
      areaIds: demo.areas.map((name) => {
        const id = areaIds.get(name);
        if (!id) throw new Error(`Unknown area ${name}`);
        return id;
      }),
      language: demo.language,
      mustChangePassword: false,
    });
    created += 1;
  }
  console.log(`  demo users: ${created} created, ${DEMO_USERS.length - created} already there`);
}

async function main() {
  console.log(`Seeding database "${env.MONGODB_DB_NAME}"...`);
  const mongoose = await connectDB();

  await seedSettings();
  const areaIds = await seedAreas();
  await seedSuperAdmin();
  await seedDemoUsers(areaIds);

  const collections = await mongoose.connection.db?.listCollections().toArray();
  console.log(`Done. Collections: ${collections?.map((c) => c.name).sort().join(", ") ?? "none"}`);
  console.log(`Demo users log in with their mobile and the password "${DEMO_PASSWORD}".`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
