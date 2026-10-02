/**
 * Seeds the database with demo data. Safe to run more than once: existing
 * records are left alone, so passwords you changed are not overwritten.
 *
 *   npm run seed
 *
 * Needs MONGODB_URI, SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD in .env.local.
 * Each module adds its own demo data here.
 */
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";

import type { Locale } from "@/i18n/config";
import { connectDB, disconnectDB } from "@/lib/db";
import { env } from "@/lib/env";
import type { HouseholdStatus, OccupantType } from "@/lib/households";
import { formatMobile, normalizeMobile } from "@/lib/mobile";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { passwordSchema } from "@/lib/validators/auth";
import { Area, type City } from "@/models/Area";
import { billStatus, formatReceiptNumber, planPayment } from "@/lib/fees";
import { approvalStatusFor, DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { dayKey, formatDate, karachiDayStart, monthKey } from "@/lib/format";
import { addMonths } from "@/lib/months";
import { Block } from "@/models/Block";
import { Counter } from "@/models/Counter";
import { Expense } from "@/models/Expense";
import { FeeBill } from "@/models/FeeBill";
import { Household } from "@/models/Household";
import { Payment } from "@/models/Payment";
import { ensureAreaCode, generateBillsForAreas } from "@/server/billing-core";
import { loadSettings } from "@/server/settings";
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
        expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        supervisorsCanAddExpenses: true,
        currency: "PKR",
      },
    },
    { upsert: true },
  );
  // Fields added in later modules, for databases seeded before them.
  await Settings.updateOne(
    { key: "singleton", expenseCategories: { $exists: false } },
    { $set: { expenseCategories: DEFAULT_EXPENSE_CATEGORIES } },
  );
  await Settings.updateOne(
    { key: "singleton", supervisorsCanAddExpenses: { $exists: false } },
    { $set: { supervisorsCanAddExpenses: true } },
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
  { name: "Dr. Shahnaz Parveen", mobile: "03005550113", role: "committee", areas: ["G-11"], language: "ur" },
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

// --- Fees ----------------------------------------------------------------------

/** "2026-10" + day 12 -> 12 Oct 2026, 11:00 in Pakistan. */
function karachiDate(month: string, day: number): Date {
  return new Date(`${month}-${String(day).padStart(2, "0")}T11:00:00+05:00`);
}

/**
 * Bills for the last three months and a realistic payment history. Payments
 * are planned in memory with the same planPayment() the app uses, then saved
 * in bulk (one by one would take minutes on Atlas). Skipped once any payment
 * exists, so running the seed again never duplicates money.
 */
async function seedFees() {
  const currentMonth = monthKey();
  const months = [addMonths(currentMonth, -2), addMonths(currentMonth, -1), currentMonth] as const;
  const areas = await Area.find({}).select("name managerIds").lean();

  let billsCreated = 0;
  for (const month of months) {
    billsCreated += (await generateBillsForAreas(areas.map((a) => a._id), month)).created;
  }
  console.log(`  bills for ${months.join(", ")}: ${billsCreated} created`);

  if (await Payment.exists({})) {
    console.log("  payments already exist, history not re-seeded");
    return;
  }

  const settings = await loadSettings();
  const superAdmin = await User.findOne({ role: "super_admin" }).select("_id").lean();
  const streets = new Map((await Street.find({}).select("supervisorId").lean()).map((s) => [s._id.toString(), s]));
  const areaById = new Map(areas.map((a) => [a._id.toString(), a]));
  const households = await Household.find({ status: "active", monthlyFee: { $gt: 0 } })
    .collation({ locale: "en", numericOrdering: true })
    .sort({ areaId: 1, streetId: 1, houseNumber: 1 })
    .lean();
  const allBills = await FeeBill.find({ householdId: { $in: households.map((h) => h._id) } }).lean();
  const billsByHousehold = new Map<string, typeof allBills>();
  for (const bill of allBills) {
    const key = bill.householdId.toString();
    billsByHousehold.set(key, [...(billsByHousehold.get(key) ?? []), bill]);
  }

  const today = Number(formatDate(Date.now(), "d"));
  const sequences = new Map<string, number>();
  const codes = new Map<string, string>();
  const changedBills = new Map<string, { amount: number; paidAmount: number }>();
  const newBills: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];

  for (const household of households) {
    const random = randomFor(`fees:${household.ownerName}:${household.houseNumber}:${household.monthlyFee}`);
    const fee = household.monthlyFee;
    const roll = random();
    const day = (month: string) => {
      const pick = 3 + Math.floor(random() * 22);
      return month === currentMonth ? Math.max(1, Math.min(pick, today)) : pick;
    };
    // [amount, month paid in]
    const plan: [number, string][] =
      roll < 0.55
        ? [[fee * 2, months[1]], [fee, months[2]]]
        : roll < 0.7
          ? [[fee * 2, months[1]]]
          : roll < 0.8
            ? [[fee + Math.floor(fee / 2), months[1]]]
            : roll < 0.88
              ? [[fee * 6, months[1]]]
              : [];

    const areaKey = household.areaId.toString();
    if (!codes.has(areaKey)) codes.set(areaKey, await ensureAreaCode(household.areaId));
    const receiver =
      streets.get(household.streetId.toString())?.supervisorId ?? areaById.get(areaKey)?.managerIds[0] ?? superAdmin?._id;
    if (!receiver) continue;

    const state = (billsByHousehold.get(household._id.toString()) ?? []).map((bill) => ({
      id: bill._id.toString(),
      month: bill.month,
      amount: bill.amount,
      paidAmount: bill.paidAmount,
    }));

    for (const [amount, month] of plan) {
      const paymentId = new Types.ObjectId();
      const result = planPayment({
        openBills: state.filter((bill) => bill.paidAmount < bill.amount),
        amount,
        monthlyFee: fee,
        billedMonths: new Set(state.map((bill) => bill.month)),
        advanceFrom: month,
        allowAdvance: true,
      });
      if (!result.ok) continue;

      const allocations = result.allocations.map((allocation) => {
        if (allocation.billId) {
          const bill = state.find((b) => b.id === allocation.billId);
          if (bill) {
            bill.paidAmount += allocation.amount;
            changedBills.set(bill.id, { amount: bill.amount, paidAmount: bill.paidAmount });
          }
          return { billId: new Types.ObjectId(allocation.billId), month: allocation.month, amount: allocation.amount };
        }
        const billId = new Types.ObjectId();
        state.push({ id: billId.toString(), month: allocation.month, amount: allocation.billAmount, paidAmount: allocation.amount });
        newBills.push({
          _id: billId,
          householdId: household._id,
          areaId: household.areaId,
          blockId: household.blockId,
          streetId: household.streetId,
          month: allocation.month,
          amount: allocation.billAmount,
          paidAmount: allocation.amount,
          status: billStatus(allocation.billAmount, allocation.amount),
          createdByPaymentId: paymentId,
        });
        return { billId, month: allocation.month, amount: allocation.amount };
      });

      const sequence = (sequences.get(areaKey) ?? 0) + 1;
      sequences.set(areaKey, sequence);
      const methodRoll = random();
      payments.push({
        _id: paymentId,
        householdId: household._id,
        areaId: household.areaId,
        streetId: household.streetId,
        billIds: allocations.map((a) => a.billId),
        allocations,
        monthsCovered: [...new Set(allocations.map((a) => a.month))].sort(),
        amount,
        method: methodRoll < 0.7 ? "cash" : methodRoll < 0.85 ? "jazzcash" : methodRoll < 0.95 ? "easypaisa" : "bank",
        receivedBy: receiver,
        receiptNumber: formatReceiptNumber(settings.receiptPrefix, codes.get(areaKey) ?? "AREA", sequence),
        publicToken: randomBytes(16).toString("base64url"),
        paidAt: karachiDate(month, day(month)),
        status: "active",
      });
    }
  }

  if (changedBills.size > 0) {
    await FeeBill.bulkWrite(
      [...changedBills].map(([id, bill]) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $set: { paidAmount: bill.paidAmount, status: billStatus(bill.amount, bill.paidAmount) } },
        },
      })),
    );
  }
  if (newBills.length > 0) await FeeBill.insertMany(newBills);
  if (payments.length > 0) await Payment.insertMany(payments);
  for (const [areaId, seq] of sequences) {
    await Counter.updateOne({ _id: `receipt:${areaId}` }, { $max: { seq } }, { upsert: true });
  }
  console.log(`  ${payments.length} payments, ${newBills.length} advance bills`);
}

// --- Expenses ----------------------------------------------------------------

type DemoExpense = { category: string; description: string; min: number; max: number; by: "manager" | "supervisor" };

const EXPENSE_CATALOGUE: DemoExpense[] = [
  { category: "supplies", description: "Jharoo (brooms), 12 pcs", min: 1800, max: 2600, by: "supervisor" },
  { category: "supplies", description: "Garbage bags, 3 bundles", min: 1200, max: 1800, by: "supervisor" },
  { category: "supplies", description: "Phenyl and bleach for nalis", min: 900, max: 1500, by: "supervisor" },
  { category: "supplies", description: "Gloves and masks for the team", min: 800, max: 1400, by: "supervisor" },
  { category: "fuel", description: "Petrol for loader rickshaw", min: 3000, max: 4800, by: "supervisor" },
  { category: "repair", description: "Wheelbarrow tyre and welding", min: 1500, max: 3500, by: "manager" },
  { category: "repair", description: "Hand cart repair", min: 2000, max: 4000, by: "manager" },
  { category: "transport", description: "Rickshaw hire for garbage lifting", min: 2500, max: 4000, by: "manager" },
  { category: "misc", description: "Tea and water for the team", min: 600, max: 1200, by: "supervisor" },
  { category: "misc", description: "Printing of fee slips", min: 1000, max: 2000, by: "manager" },
];

/** Big items above the approval limit: one per area each month, so the committee has work. */
const BIG_EXPENSES: DemoExpense[] = [
  { category: "transport", description: "Tractor trolley to Losar dump, 3 trips", min: 7000, max: 12000, by: "manager" },
  { category: "repair", description: "New iron cover for nala", min: 6000, max: 9000, by: "manager" },
];

/**
 * Three months of expenses for the areas that have streets: small ones that
 * pass automatically, and bigger ones the committee approved, rejected, or
 * (this month) still has to decide. Skipped once the demo expenses exist;
 * expenses added by hand don't count.
 */
async function seedExpenses() {
  const demoDescriptions = [...EXPENSE_CATALOGUE, ...BIG_EXPENSES].map((item) => item.description);
  if (await Expense.exists({ description: { $in: demoDescriptions } })) {
    console.log("  expenses already exist, not re-seeded");
    return;
  }
  const settings = await loadSettings();
  const today = dayKey();
  const currentMonth = monthKey();
  const months = [addMonths(currentMonth, -2), addMonths(currentMonth, -1), currentMonth];
  const areas = await Area.find({ name: { $in: ["Satellite Town", "G-11"] } }).select("name").lean();

  const docs: Record<string, unknown>[] = [];
  for (const area of areas) {
    const [manager, supervisor, committee] = await Promise.all([
      User.findOne({ role: "area_manager", areaIds: area._id }).select("_id").lean(),
      User.findOne({ role: "supervisor", areaIds: area._id }).select("_id").lean(),
      User.findOne({ role: "committee", areaIds: area._id }).select("_id").lean(),
    ]);
    if (!manager || !supervisor) continue;

    for (const [monthIndex, month] of months.entries()) {
      const random = randomFor(`expenses:${area.name}:${month}`);
      const isCurrent = month === currentMonth;
      const lastDay = isCurrent ? Number(today.slice(8, 10)) : 28;
      const picks = [...EXPENSE_CATALOGUE].sort(() => random() - 0.5).slice(0, 6);
      picks.push(BIG_EXPENSES[monthIndex % BIG_EXPENSES.length] ?? BIG_EXPENSES[0]!);

      for (const [index, item] of picks.entries()) {
        const amount = Math.round((item.min + random() * (item.max - item.min)) / 50) * 50;
        const day = `${month}-${String(1 + Math.floor(random() * lastDay)).padStart(2, "0")}`;
        const date = karachiDayStart(day);
        let status: string = approvalStatusFor(amount, settings.expenseApprovalLimit);
        const review: Record<string, unknown> = {};
        // Older big expenses were decided by the committee; one of them was turned down.
        if (status === "pending" && !isCurrent && committee) {
          const rejected = monthIndex === 0 && index === picks.length - 1 && area.name === "G-11";
          status = rejected ? "rejected" : "approved";
          review.reviewedBy = committee._id;
          review.reviewedAt = new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000);
          review.reviewNote = rejected
            ? "Rate is too high, get two more quotes first."
            : "Checked the receipt, approved.";
        }
        docs.push({
          areaId: area._id,
          category: item.category,
          description: item.description,
          amount,
          date,
          month,
          createdBy: item.by === "manager" ? manager._id : supervisor._id,
          approvalStatus: status,
          ...review,
        });
      }
    }
  }

  if (docs.length > 0) await Expense.insertMany(docs);
  const pending = docs.filter((doc) => doc.approvalStatus === "pending").length;
  console.log(`  ${docs.length} expenses (${pending} waiting for approval)`);
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
  await seedFees();
  await seedExpenses();

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
