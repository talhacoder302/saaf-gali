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
import type { HouseholdStatus, OccupantType } from "@/lib/households";
import { formatMobile, normalizeMobile } from "@/lib/mobile";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { passwordSchema } from "@/lib/validators/auth";
import { Area, type City } from "@/models/Area";
import { Block } from "@/models/Block";
import { Household } from "@/models/Household";
import { Settings } from "@/models/Settings";
import { Street } from "@/models/Street";
import { User } from "@/models/User";
import { syncUserAreaMemberships } from "@/server/team-sync";

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

/** Fill Area.managerIds / supervisorIds / committeeIds from every user's areaIds. */
async function syncAllTeams() {
  const users = await User.find({}).select("role areaIds").lean();
  for (const user of users) await syncUserAreaMemberships(user._id, user.role, user.areaIds);
  console.log(`  area teams synced for ${users.length} users`);
}

type DemoBlock = {
  name: string;
  streets: string[];
  /** Roughly the middle of the block; streets are spread north of it. */
  origin: { lat: number; lng: number };
  supervisorMobile?: string;
};

const DEMO_LAYOUT: { area: string; blocks: DemoBlock[] }[] = [
  {
    area: "Satellite Town",
    blocks: [
      {
        name: "Block A",
        streets: ["Street 1", "Street 2", "Street 3", "Street 4", "Street 5", "Masjid Wali Gali"],
        origin: { lat: 33.6402, lng: 73.0618 },
        supervisorMobile: "03335550103",
      },
      {
        name: "Block B",
        streets: ["Street 1", "Street 2", "Street 3", "Street 4", "Street 5", "Street 6", "Street 7", "Commercial Market Lane"],
        origin: { lat: 33.6351, lng: 73.0702 },
        supervisorMobile: "03335550103",
      },
      {
        // Left without a supervisor so the "streets without supervisor" badge has something to show.
        name: "Block C",
        streets: ["Street 1", "Street 2", "Street 3", "Street 4", "Park Road"],
        origin: { lat: 33.6298, lng: 73.0649 },
      },
    ],
  },
  {
    area: "G-11",
    blocks: [
      {
        name: "G-11/1",
        streets: ["Street 10", "Street 11", "Street 12", "Street 13", "Street 14", "Street 15", "Street 16"],
        origin: { lat: 33.6736, lng: 72.9912 },
        supervisorMobile: "03455550104",
      },
      {
        name: "G-11/2",
        streets: ["Street 20", "Street 21", "Street 22", "Street 23", "Street 24"],
        origin: { lat: 33.6702, lng: 72.9987 },
        supervisorMobile: "03455550104",
      },
      {
        name: "G-11/3",
        streets: ["Street 30", "Street 31", "Street 32", "Street 33", "Street 34", "Street 35"],
        origin: { lat: 33.6664, lng: 72.9931 },
        supervisorMobile: "03455550104",
      },
    ],
  },
];

async function seedBlocksAndStreets(areaIds: Map<string, Types.ObjectId>) {
  let blocks = 0;
  let streets = 0;
  for (const { area, blocks: demoBlocks } of DEMO_LAYOUT) {
    const areaId = areaIds.get(area);
    if (!areaId) throw new Error(`Unknown area ${area}`);

    for (const demoBlock of demoBlocks) {
      const block = await Block.findOneAndUpdate(
        { areaId, name: demoBlock.name },
        { $setOnInsert: { areaId, name: demoBlock.name } },
        { upsert: true, returnDocument: "after" },
      );
      blocks += 1;

      const supervisor = demoBlock.supervisorMobile
        ? await User.findOne({ mobile: demoBlock.supervisorMobile, role: "supervisor", areaIds: areaId }).select("_id").lean()
        : null;

      for (const [index, name] of demoBlock.streets.entries()) {
        // Only the first half get a location, to show that it is optional.
        const withLocation = index < Math.ceil(demoBlock.streets.length / 2);
        await Street.updateOne(
          { blockId: block._id, name },
          {
            $setOnInsert: {
              areaId,
              blockId: block._id,
              name,
              ...(supervisor ? { supervisorId: supervisor._id } : {}),
              ...(withLocation
                ? {
                    location: {
                      lat: Math.round((demoBlock.origin.lat + index * 0.0006) * 1e6) / 1e6,
                      lng: Math.round((demoBlock.origin.lng + index * 0.0002) * 1e6) / 1e6,
                    },
                  }
                : {}),
            },
          },
          { upsert: true },
        );
        streets += 1;
      }
    }
  }
  console.log(`  ${blocks} blocks and ${streets} streets ready`);
}

// --- Households --------------------------------------------------------------

/** Small seeded random generator, so every run creates the same households. */
function randomFor(seed: string): () => number {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE = ["Muhammad", "Ahmed", "Ali", "Hassan", "Usman", "Bilal", "Imran", "Khalid", "Tariq", "Asif", "Zahid", "Shahid", "Nadeem", "Waqar", "Faisal", "Kamran", "Rizwan", "Saleem", "Javed", "Arshad", "Adnan", "Haris", "Omer", "Zubair", "Sohail"];
const FEMALE = ["Ayesha", "Fatima", "Sadia", "Nasreen", "Rubina", "Shazia", "Samina", "Farzana", "Uzma", "Saima", "Hina", "Nadia"];
const SURNAMES = ["Khan", "Malik", "Qureshi", "Butt", "Chaudhry", "Raja", "Abbasi", "Awan", "Sheikh", "Mirza", "Siddiqui", "Hashmi", "Gillani", "Janjua", "Satti", "Kiyani", "Bhatti", "Rana", "Mughal", "Ansari"];
const MOBILE_PREFIXES = ["0300", "0301", "0302", "0303", "0305", "0306", "0307", "0308", "0311", "0312", "0313", "0315", "0320", "0321", "0322", "0323", "0331", "0332", "0333", "0334", "0336", "0341", "0342", "0343", "0345", "0346"];

async function seedHouseholds() {
  const streets = await Street.find({}).select("areaId blockId name").lean();
  const areaDocs = await Area.find({}).select("name defaultMonthlyFee").lean();
  const areas = new Map(areaDocs.map((a) => [a._id.toString(), a]));
  const blockNames = new Map((await Block.find({}).select("name").lean()).map((b) => [b._id.toString(), b.name]));
  let total = 0;

  for (const street of streets) {
    const area = areas.get(street.areaId.toString());
    // Seeded by names, so every database gets the same demo houses.
    const random = randomFor(`${area?.name}:${blockNames.get(street.blockId.toString())}:${street.name}`);
    const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)] as T;
    const person = () => `${random() < 0.8 ? pick(MALE) : pick(FEMALE)} ${pick(SURNAMES)}`;
    const defaultFee = area?.defaultMonthlyFee ?? 150;
    const count = 15 + Math.floor(random() * 16);

    const operations = Array.from({ length: count }, (_, index) => {
      const houseNumber = `${index + 1}${random() < 0.1 ? "-A" : ""}`;
      const roll = random();
      const isMosque = street.name === "Masjid Wali Gali" && index === 0;
      const status: HouseholdStatus = isMosque ? "exempt" : roll < 0.06 ? "vacant" : roll < 0.09 ? "exempt" : "active";
      const tenant = !isMosque && status !== "vacant" && random() < 0.25;
      const occupantType: OccupantType = tenant ? "tenant" : "owner";
      const ownerName = isMosque ? "Jamia Masjid Committee" : person();
      const mobile =
        status === "vacant" || random() < 0.15
          ? undefined
          : `${pick(MOBILE_PREFIXES)}${String(Math.floor(random() * 1e7)).padStart(7, "0")}`;
      const customFee = random() < 0.12 ? pick([100, 200, 250, 300].filter((fee) => fee !== defaultFee)) : defaultFee;

      return {
        updateOne: {
          filter: { streetId: street._id, houseNumber },
          update: {
            $setOnInsert: {
              areaId: street.areaId,
              blockId: street.blockId,
              streetId: street._id,
              houseNumber,
              ownerName,
              occupantType,
              ...(tenant ? { contactName: person() } : {}),
              ...(mobile ? { mobile } : {}),
              ...(!isMosque && random() < 0.1
                ? { email: `${ownerName.split(" ")[0]?.toLowerCase()}.${ownerName.split(" ")[1]?.toLowerCase()}@gmail.com` }
                : {}),
              monthlyFee: isMosque ? 0 : customFee,
              status,
              ...(isMosque ? { notes: "Mosque, exempt from fee" } : {}),
            },
          },
          upsert: true,
        },
      };
    });

    await Household.bulkWrite(operations, { ordered: false });
    total += count;
  }
  console.log(`  ${total} households ready on ${streets.length} streets`);
}

/** Give two demo residents a house (only the first time). */
async function linkDemoResidents() {
  const links = [
    { mobile: "03225550109", area: "Satellite Town", block: "Block A", street: "Street 1" },
    { mobile: "03235550110", area: "G-11", block: "G-11/2", street: "Street 20" },
  ];
  for (const link of links) {
    const user = await User.findOne({ mobile: link.mobile, role: "resident" });
    if (!user || user.householdId) continue;
    const area = await Area.findOne({ name: link.area }).select("_id").lean();
    const block = area ? await Block.findOne({ areaId: area._id, name: link.block }).select("_id").lean() : null;
    const street = block ? await Street.findOne({ blockId: block._id, name: link.street }).select("_id").lean() : null;
    const house = street ? await Household.findOne({ streetId: street._id, houseNumber: "1" }) : null;
    if (!house) continue;
    house.mobile = user.mobile;
    house.contactName = house.ownerName === user.name ? undefined : user.name;
    house.status = "active";
    await house.save();
    user.householdId = house._id;
    user.areaIds = [house.areaId];
    await user.save();
    console.log(`  ${user.name} linked to house 1, ${link.street}, ${link.area}`);
  }
}

async function main() {
  console.log(`Seeding database "${env.MONGODB_DB_NAME}"...`);
  const mongoose = await connectDB();

  await seedSettings();
  const areaIds = await seedAreas();
  await seedSuperAdmin();
  await seedDemoUsers(areaIds);
  await syncAllTeams();
  await seedBlocksAndStreets(areaIds);
  await seedHouseholds();
  await linkDemoResidents();

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
