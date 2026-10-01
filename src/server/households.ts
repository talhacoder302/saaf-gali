import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { HOUSEHOLDS_PAGE_SIZE, type HouseholdStatus, type OccupantType } from "@/lib/households";
import { hashPassword } from "@/lib/password";
import { requireRole, scopeQueryToUserAreas, type Actor, type MongoFilter } from "@/lib/permissions";
import { escapeRegex, exactNameRegex } from "@/lib/regex";
import { ADMIN_ROLES } from "@/lib/roles";
import {
  householdFormSchema,
  listHouseholdsSchema,
  residentLoginSchema,
  updateHouseholdSchema,
  type HouseholdFormInput,
  type ListHouseholdsInput,
  type ResidentLoginInput,
  type UpdateHouseholdInput,
} from "@/lib/validators/households";
import { Area } from "@/models/Area";
import { Block } from "@/models/Block";
import { Household, type HouseholdDoc } from "@/models/Household";
import { Street } from "@/models/Street";
import { User, type UserStatus } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { ServiceError } from "@/server/errors";

export type HouseholdRow = {
  id: string;
  houseNumber: string;
  ownerName: string;
  contactName: string | null;
  occupantType: OccupantType;
  mobile: string | null;
  email: string | null;
  notes: string | null;
  monthlyFee: number;
  status: HouseholdStatus;
  areaId: string;
  areaName: string;
  blockName: string;
  streetId: string;
  streetName: string;
};

export type HouseholdList = { rows: HouseholdRow[]; total: number; page: number; pageCount: number };

export type LinkedResident = { id: string; name: string; mobile: string; status: UserStatus };

export type HouseholdDetail = HouseholdRow & {
  blockId: string;
  areaDefaultFee: number;
  areaArchived: boolean;
  createdAt: string;
  updatedAt: string;
  residents: LinkedResident[];
};

// ---------------------------------------------------------------------------
// Filters and row mapping (shared with the Excel export)
// ---------------------------------------------------------------------------

/** Build the scoped Mongo filter for the list and the export. */
export function householdsFilter(actor: Actor, params: Omit<ListHouseholdsInput, "page">): MongoFilter {
  const filter: MongoFilter = {};
  if (params.areaId) filter.areaId = new Types.ObjectId(params.areaId);
  if (params.blockId) filter.blockId = new Types.ObjectId(params.blockId);
  if (params.streetId) filter.streetId = new Types.ObjectId(params.streetId);
  if (params.status) filter.status = params.status;
  if (params.q) {
    const text = new RegExp(escapeRegex(params.q), "i");
    const or: MongoFilter[] = [{ houseNumber: text }, { ownerName: text }, { contactName: text }];
    const digits = params.q.replace(/\D/g, "");
    if (digits.length >= 4) {
      const local = digits.startsWith("92") ? `0${digits.slice(2)}` : digits;
      or.push({ mobile: new RegExp(escapeRegex(local)) });
    }
    filter.$or = or;
  }
  return scopeQueryToUserAreas(actor, filter);
}

type NameMaps = { areas: Map<string, string>; blocks: Map<string, string>; streets: Map<string, string> };

async function loadNames(docs: Pick<HouseholdDoc, "areaId" | "blockId" | "streetId">[]): Promise<NameMaps> {
  const unique = (ids: Types.ObjectId[]) => [...new Set(ids.map((id) => id.toString()))];
  const [areas, blocks, streets] = await Promise.all([
    Area.find({ _id: { $in: unique(docs.map((d) => d.areaId)) } }).select("name").lean(),
    Block.find({ _id: { $in: unique(docs.map((d) => d.blockId)) } }).select("name").lean(),
    Street.find({ _id: { $in: unique(docs.map((d) => d.streetId)) } }).select("name").lean(),
  ]);
  const toMap = (items: { _id: Types.ObjectId; name: string }[]) => new Map(items.map((i) => [i._id.toString(), i.name]));
  return { areas: toMap(areas), blocks: toMap(blocks), streets: toMap(streets) };
}

function toRow(doc: HouseholdDoc, names: NameMaps): HouseholdRow {
  return {
    id: doc._id.toString(),
    houseNumber: doc.houseNumber,
    ownerName: doc.ownerName,
    contactName: doc.contactName ?? null,
    occupantType: doc.occupantType,
    mobile: doc.mobile ?? null,
    email: doc.email ?? null,
    notes: doc.notes ?? null,
    monthlyFee: doc.monthlyFee,
    status: doc.status,
    areaId: doc.areaId.toString(),
    areaName: names.areas.get(doc.areaId.toString()) ?? "",
    blockName: names.blocks.get(doc.blockId.toString()) ?? "",
    streetId: doc.streetId.toString(),
    streetName: names.streets.get(doc.streetId.toString()) ?? "",
  };
}

/** Street order, then house numbers in natural order (2 before 10). */
const NATURAL = { locale: "en", numericOrdering: true } as const;
const LIST_SORT = { areaId: 1, blockId: 1, streetId: 1, houseNumber: 1 } as const;

/** All matching households as rows, for the Excel export. */
export async function findHouseholdRows(actor: Actor, filter: MongoFilter, limit: number): Promise<HouseholdRow[]> {
  const docs = await Household.find(filter).collation(NATURAL).sort(LIST_SORT).limit(limit).lean();
  const names = await loadNames(docs);
  return docs.map((doc) => toRow(doc, names));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listHouseholds(input: Partial<ListHouseholdsInput>): Promise<HouseholdList> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listHouseholdsSchema.parse(input);
  await connectDB();

  const filter = householdsFilter(actor, params);
  const [docs, total] = await Promise.all([
    Household.find(filter)
      .collation(NATURAL)
      .sort(LIST_SORT)
      .skip((params.page - 1) * HOUSEHOLDS_PAGE_SIZE)
      .limit(HOUSEHOLDS_PAGE_SIZE)
      .lean(),
    Household.countDocuments(filter),
  ]);
  const names = await loadNames(docs);

  return {
    rows: docs.map((doc) => toRow(doc, names)),
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / HOUSEHOLDS_PAGE_SIZE)),
  };
}

/** One household with its residents, or null when missing or out of scope. */
export async function getHousehold(householdId: string): Promise<HouseholdDetail | null> {
  const actor = await requireRole(...ADMIN_ROLES);
  if (!isValidObjectId(householdId)) return null;
  await connectDB();

  const doc = await Household.findOne(scopeQueryToUserAreas(actor, { _id: householdId })).lean();
  if (!doc) return null;

  const [names, area, residents] = await Promise.all([
    loadNames([doc]),
    Area.findById(doc.areaId).select("defaultMonthlyFee status").lean(),
    User.find({ householdId: doc._id }).select("name mobile status").sort({ createdAt: 1 }).lean(),
  ]);

  return {
    ...toRow(doc, names),
    blockId: doc.blockId.toString(),
    areaDefaultFee: area?.defaultMonthlyFee ?? 0,
    areaArchived: area?.status === "archived",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    residents: residents.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      mobile: user.mobile,
      status: user.status,
    })),
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** The street a household goes on: in scope, in an active area. */
async function loadStreetForHousehold(actor: Actor, streetId: string) {
  const street = await Street.findOne(scopeQueryToUserAreas(actor, { _id: streetId })).select("areaId blockId name").lean();
  if (!street) throw new ServiceError("invalid_input", { streetId: "chooseStreet" });
  await loadAreaInScope(actor, street.areaId.toString(), { forWrite: true });
  return street;
}

async function assertHouseFree(streetId: Types.ObjectId, houseNumber: string, exceptId?: Types.ObjectId) {
  const clash = await Household.exists({
    streetId,
    houseNumber: exactNameRegex(houseNumber),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new ServiceError("house_exists", { houseNumber: "houseExists" });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

function optionalFields(data: { contactName: string; mobile: string | null; email: string; notes: string }) {
  const set: Record<string, string> = {};
  const unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries({
    contactName: data.contactName,
    mobile: data.mobile ?? "",
    email: data.email,
    notes: data.notes,
  })) {
    if (value) set[key] = value;
    else unset[key] = 1;
  }
  return { set, unset };
}

export async function createHousehold(input: HouseholdFormInput): Promise<{ id: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = householdFormSchema.parse(input);
  await connectDB();

  const street = await loadStreetForHousehold(actor, data.streetId);
  await assertHouseFree(street._id, data.houseNumber);
  const { set } = optionalFields(data);

  try {
    const household = await Household.create({
      areaId: street.areaId,
      blockId: street.blockId,
      streetId: street._id,
      houseNumber: data.houseNumber,
      ownerName: data.ownerName,
      occupantType: data.occupantType,
      monthlyFee: data.monthlyFee,
      status: data.status,
      createdBy: actor.id,
      ...set,
    });
    await logActivity({
      actorId: actor.id,
      action: "create",
      entity: "Household",
      entityId: household._id,
      areaId: street.areaId,
      meta: { houseNumber: data.houseNumber, street: street.name },
    });
    return { id: household._id.toString() };
  } catch (error) {
    if (isDuplicateKey(error)) throw new ServiceError("house_exists", { houseNumber: "houseExists" });
    throw error;
  }
}

export async function updateHousehold(input: UpdateHouseholdInput): Promise<void> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateHouseholdSchema.parse(input);
  await connectDB();

  const household = await Household.findOne(scopeQueryToUserAreas(actor, { _id: data.id })).lean();
  if (!household) throw new ServiceError("not_found");
  await loadAreaInScope(actor, household.areaId.toString(), { forWrite: true });
  const street = await loadStreetForHousehold(actor, data.streetId);
  await assertHouseFree(street._id, data.houseNumber, household._id);

  const changes = [
    !street._id.equals(household.streetId) && "street",
    data.houseNumber !== household.houseNumber && "houseNumber",
    data.ownerName !== household.ownerName && "ownerName",
    data.occupantType !== household.occupantType && "occupantType",
    data.contactName !== (household.contactName ?? "") && "contactName",
    (data.mobile ?? null) !== (household.mobile ?? null) && "mobile",
    data.email !== (household.email ?? "") && "email",
    data.monthlyFee !== household.monthlyFee && "monthlyFee",
    data.status !== household.status && "status",
    data.notes !== (household.notes ?? "") && "notes",
  ].filter((change): change is string => Boolean(change));
  if (changes.length === 0) return;

  const { set, unset } = optionalFields(data);
  try {
    await Household.updateOne(
      { _id: household._id },
      {
        $set: {
          areaId: street.areaId,
          blockId: street.blockId,
          streetId: street._id,
          houseNumber: data.houseNumber,
          ownerName: data.ownerName,
          occupantType: data.occupantType,
          monthlyFee: data.monthlyFee,
          status: data.status,
          ...set,
        },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
  } catch (error) {
    if (isDuplicateKey(error)) throw new ServiceError("house_exists", { houseNumber: "houseExists" });
    throw error;
  }

  // Residents follow their house if it moves to another area.
  if (!street.areaId.equals(household.areaId)) {
    await User.updateMany(
      { householdId: household._id, role: "resident" },
      { $set: { areaIds: [street.areaId] }, $inc: { sessionVersion: 1 } },
    );
  }

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Household",
    entityId: household._id,
    areaId: street.areaId,
    meta: {
      changes,
      ...(changes.includes("monthlyFee") ? { fromFee: household.monthlyFee, toFee: data.monthlyFee } : {}),
      ...(changes.includes("status") ? { fromStatus: household.status, toStatus: data.status } : {}),
    },
  });
}

/**
 * Create a resident login for a household using its mobile number. The admin
 * picks a temporary password; the resident must change it on first login.
 */
export async function createResidentLogin(input: ResidentLoginInput): Promise<{ name: string; mobile: string }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = residentLoginSchema.parse(input);
  await connectDB();

  const household = await Household.findOne(scopeQueryToUserAreas(actor, { _id: data.householdId })).lean();
  if (!household) throw new ServiceError("not_found");
  await loadAreaInScope(actor, household.areaId.toString(), { forWrite: true });
  if (!household.mobile) throw new ServiceError("household_has_no_mobile");

  const existing = await User.findOne({ mobile: household.mobile }).select("householdId").lean();
  if (existing) {
    throw new ServiceError(existing.householdId?.equals(household._id) ? "resident_exists" : "mobile_taken");
  }

  const name = household.contactName || household.ownerName;
  try {
    const user = await User.create({
      name,
      mobile: household.mobile,
      passwordHash: await hashPassword(data.password),
      role: "resident",
      areaIds: [household.areaId],
      householdId: household._id,
      language: "ur",
      mustChangePassword: true,
      createdBy: actor.id,
    });
    await logActivity({
      actorId: actor.id,
      action: "create",
      entity: "User",
      entityId: user._id,
      areaId: household.areaId,
      meta: { name, role: "resident", householdId: household._id.toString() },
    });
    return { name, mobile: household.mobile };
  } catch (error) {
    if (isDuplicateKey(error)) throw new ServiceError("mobile_taken");
    throw error;
  }
}
