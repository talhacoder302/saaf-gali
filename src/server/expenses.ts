import "server-only";

import { isValidObjectId, Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { features } from "@/lib/env";
import {
  approvalStatusFor,
  canAddExpenses,
  canEditExpense,
  canReviewExpense,
  categoryKey,
  checkExpenseDay,
  EXPENSE_ADD_ROLES,
  EXPENSE_FILTER_MONTHS,
  EXPENSE_REVIEW_ROLES,
  EXPENSES_PAGE_SIZE,
  summariseExpenses,
  type ExpenseStatus,
  type ExpenseTotals,
} from "@/lib/expenses";
import { dayKey, formatDate, karachiDayStart, monthKey } from "@/lib/format";
import { addMonths, monthRange } from "@/lib/months";
import { hasAllAreaAccess, requireRole, scopeQueryToUserAreas, type Actor, type MongoFilter } from "@/lib/permissions";
import { ADMIN_ROLES } from "@/lib/roles";
import {
  ALL_MONTHS,
  expenseFormSchema,
  listExpensesSchema,
  reviewExpenseSchema,
  updateExpenseSchema,
  type ExpenseFormInput,
  type ListExpensesInput,
  type ReviewExpenseInput,
  type UpdateExpenseInput,
} from "@/lib/validators/expenses";
import { Area } from "@/models/Area";
import { Expense, type ExpenseDoc } from "@/models/Expense";
import { User } from "@/models/User";
import { logActivity } from "@/server/activity";
import { loadAreaInScope } from "@/server/area-access";
import { listAreaOptions } from "@/server/areas";
import { ServiceError } from "@/server/errors";
import { notify } from "@/server/notify";
import { loadSettings, type AppSettings } from "@/server/settings";
import { assertUploadedPhoto, photoUrl } from "@/server/storage";

export type ExpenseRow = {
  id: string;
  areaId: string;
  areaName: string;
  category: string;
  description: string;
  amount: number;
  /** "YYYY-MM-DD" in Pakistan time. */
  day: string;
  status: ExpenseStatus;
  photoKey: string | null;
  photoUrl: string | null;
  createdById: string;
  createdByName: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** What the signed-in user may do with this row. */
  canEdit: boolean;
  canReview: boolean;
};

export type ExpenseList = {
  rows: ExpenseRow[];
  totals: ExpenseTotals;
  total: number;
  page: number;
  pageCount: number;
  /** The month shown ("YYYY-MM") or "all". */
  month: string;
};

/** What the add/edit form needs. */
export type ExpenseFormOptions = {
  areas: { id: string; name: string }[];
  categories: string[];
  approvalLimit: number;
  storageEnabled: boolean;
  canAdd: boolean;
  today: string;
};

// ---------------------------------------------------------------------------
// Scope and row mapping
// ---------------------------------------------------------------------------

/**
 * Area scope as ObjectIds. Built by hand (not scopeQueryToUserAreas) because
 * the same filter feeds an aggregation, and aggregate() does not cast the
 * string ids that scopeQueryToUserAreas puts in.
 */
async function areaScope(actor: Actor, areaId?: string): Promise<MongoFilter> {
  if (areaId) return { areaId: (await loadAreaInScope(actor, areaId))._id };
  if (hasAllAreaAccess(actor)) return {};
  return { areaId: { $in: actor.areaIds.map((id) => new Types.ObjectId(id)) } };
}

async function listFilter(actor: Actor, params: Omit<ListExpensesInput, "page">): Promise<{ filter: MongoFilter; month: string }> {
  const month = params.month ?? monthKey();
  const filter: MongoFilter = { ...(await areaScope(actor, params.areaId)) };
  if (month !== ALL_MONTHS) filter.month = month;
  if (params.category) filter.category = params.category;
  if (params.status) filter.approvalStatus = params.status;
  return { filter, month };
}

type LeanExpense = ExpenseDoc;

async function toRows(actor: Actor, docs: LeanExpense[]): Promise<ExpenseRow[]> {
  const unique = (ids: (Types.ObjectId | null | undefined)[]) => [
    ...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map((id) => id.toString())),
  ];
  const [areas, users, urls] = await Promise.all([
    Area.find({ _id: { $in: unique(docs.map((d) => d.areaId)) } }).select("name").lean(),
    User.find({ _id: { $in: unique(docs.flatMap((d) => [d.createdBy, d.reviewedBy])) } }).select("name").lean(),
    Promise.all(docs.map((doc) => photoUrl(doc.receiptPhotoKey))),
  ]);
  const areaName = new Map(areas.map((a) => [a._id.toString(), a.name]));
  const userName = new Map(users.map((u) => [u._id.toString(), u.name]));

  return docs.map((doc, index) => {
    const areaId = doc.areaId.toString();
    const createdById = doc.createdBy.toString();
    return {
      id: doc._id.toString(),
      areaId,
      areaName: areaName.get(areaId) ?? "",
      category: doc.category,
      description: doc.description,
      amount: doc.amount,
      day: dayKey(doc.date),
      status: doc.approvalStatus,
      photoKey: doc.receiptPhotoKey ?? null,
      photoUrl: urls[index] ?? null,
      createdById,
      createdByName: userName.get(createdById) ?? "",
      reviewedByName: doc.reviewedBy ? (userName.get(doc.reviewedBy.toString()) ?? "") : null,
      reviewedAt: doc.reviewedAt?.toISOString() ?? null,
      reviewNote: doc.reviewNote ?? null,
      canEdit: canEditExpense(actor, areaId),
      canReview: canReviewExpense(actor, { status: doc.approvalStatus, createdById, areaId }),
    };
  });
}

const NEWEST_FIRST = { date: -1, createdAt: -1 } as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Month options for the list filter, newest first. */
export function expenseFilterMonths(today = monthKey()): string[] {
  return monthRange(addMonths(today, -(EXPENSE_FILTER_MONTHS - 1)), today).reverse();
}

export async function listExpenses(input: Partial<ListExpensesInput>): Promise<ExpenseList> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listExpensesSchema.parse(input);
  await connectDB();

  const { filter, month } = await listFilter(actor, params);
  const [docs, total, groups] = await Promise.all([
    Expense.find(filter)
      .sort(NEWEST_FIRST)
      .skip((params.page - 1) * EXPENSES_PAGE_SIZE)
      .limit(EXPENSES_PAGE_SIZE)
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate<{ _id: { status: ExpenseStatus; category: string }; amount: number; count: number }>([
      { $match: filter },
      { $group: { _id: { status: "$approvalStatus", category: "$category" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    rows: await toRows(actor, docs),
    totals: summariseExpenses(groups.map((g) => ({ ...g._id, amount: g.amount, count: g.count }))),
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE)),
    month,
  };
}

/** Rows for the Excel export: same filters as the list, every page. */
export async function findExpensesForExport(input: Partial<ListExpensesInput>, limit: number): Promise<ExpenseRow[]> {
  const actor = await requireRole(...ADMIN_ROLES);
  const params = listExpensesSchema.parse(input);
  await connectDB();
  const { filter } = await listFilter(actor, params);
  const docs = await Expense.find(filter).sort(NEWEST_FIRST).limit(limit).lean();
  return toRows(actor, docs);
}

export async function getExpenseFormOptions(): Promise<ExpenseFormOptions> {
  const actor = await requireRole(...EXPENSE_ADD_ROLES);
  const [settings, areas] = await Promise.all([loadSettings(), listAreaOptions()]);
  return {
    areas: areas.map((area) => ({ id: area.id, name: area.name })),
    categories: settings.expenseCategories,
    approvalLimit: settings.expenseApprovalLimit,
    storageEnabled: features.storage,
    canAdd: canAddExpenses(actor.role, settings.supervisorsCanAddExpenses),
    today: dayKey(),
  };
}

/** A supervisor's own recent expenses (the supervisor Expenses screen). */
export async function listMyExpenses(): Promise<ExpenseRow[]> {
  const actor = await requireRole(...EXPENSE_ADD_ROLES);
  await connectDB();
  const docs = await Expense.find(scopeQueryToUserAreas(actor, { createdBy: actor.id }))
    .sort(NEWEST_FIRST)
    .limit(30)
    .lean();
  return toRows(actor, docs);
}

export type ApprovalQueue = { pending: ExpenseRow[]; recent: ExpenseRow[]; approvalLimit: number };

/** Pending expenses a committee member or super admin can decide, plus the latest decisions. */
export async function getApprovalQueue(): Promise<ApprovalQueue> {
  const actor = await requireRole(...EXPENSE_REVIEW_ROLES);
  await connectDB();
  const [pending, recent, settings] = await Promise.all([
    Expense.find(scopeQueryToUserAreas(actor, { approvalStatus: "pending" })).sort({ createdAt: 1 }).limit(100).lean(),
    Expense.find(scopeQueryToUserAreas(actor, { approvalStatus: { $in: ["approved", "rejected"] } }))
      .sort({ reviewedAt: -1 })
      .limit(15)
      .lean(),
    loadSettings(),
  ]);
  const [pendingRows, recentRows] = await Promise.all([toRows(actor, pending), toRows(actor, recent)]);
  return { pending: pendingRows, recent: recentRows, approvalLimit: settings.expenseApprovalLimit };
}

/** How many expenses are waiting for this reviewer (home screen badge). */
export async function countPendingApprovals(): Promise<number> {
  const actor = await requireRole(...EXPENSE_REVIEW_ROLES);
  await connectDB();
  return Expense.countDocuments(
    scopeQueryToUserAreas(actor, { approvalStatus: "pending", createdBy: { $ne: actor.id } }),
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** The category as written in Settings, or a field error. */
function resolveCategory(settings: AppSettings, category: string): string {
  const match = settings.expenseCategories.find((name) => categoryKey(name) === categoryKey(category));
  if (!match) throw new ServiceError("invalid_input", { category: "chooseCategory" });
  return match;
}

function assertDay(day: string): void {
  const problem = checkExpenseDay(day, dayKey());
  if (problem) throw new ServiceError("invalid_input", { date: problem });
}

export async function createExpense(input: ExpenseFormInput): Promise<{ id: string; status: ExpenseStatus }> {
  const actor = await requireRole(...EXPENSE_ADD_ROLES);
  const data = expenseFormSchema.parse(input);
  const settings = await loadSettings();
  if (!canAddExpenses(actor.role, settings.supervisorsCanAddExpenses)) throw new ServiceError("expenses_not_allowed");
  await connectDB();

  const area = await loadAreaInScope(actor, data.areaId, { forWrite: true });
  const category = resolveCategory(settings, data.category);
  assertDay(data.date);
  if (data.photoKey) await assertUploadedPhoto(actor, "expense_receipt", data.photoKey);

  const status = approvalStatusFor(data.amount, settings.expenseApprovalLimit);
  const expense = await Expense.create({
    areaId: area._id,
    category,
    description: data.description,
    amount: data.amount,
    date: karachiDayStart(data.date),
    month: data.date.slice(0, 7),
    ...(data.photoKey ? { receiptPhotoKey: data.photoKey } : {}),
    createdBy: actor.id,
    approvalStatus: status,
  });

  await logActivity({
    actorId: actor.id,
    action: "create",
    entity: "Expense",
    entityId: expense._id,
    areaId: area._id,
    meta: { amount: data.amount, category, status },
  });
  if (status === "pending") await notifyReviewers(actor.id, area._id, area.name, data.amount, data.description);

  return { id: expense._id.toString(), status };
}

export async function updateExpense(input: UpdateExpenseInput): Promise<{ status: ExpenseStatus }> {
  const actor = await requireRole(...ADMIN_ROLES);
  const data = updateExpenseSchema.parse(input);
  await connectDB();

  const expense = await Expense.findOne(scopeQueryToUserAreas(actor, { _id: data.id })).lean();
  if (!expense) throw new ServiceError("not_found");
  if (!canEditExpense(actor, expense.areaId.toString())) throw new ServiceError("forbidden");
  await loadAreaInScope(actor, expense.areaId.toString(), { forWrite: true });
  const area = await loadAreaInScope(actor, data.areaId, { forWrite: true });

  const settings = await loadSettings();
  // An expense may keep a category that was later removed from Settings.
  const category = data.category === expense.category ? expense.category : resolveCategory(settings, data.category);
  assertDay(data.date);
  const photoChanged = (data.photoKey ?? null) !== (expense.receiptPhotoKey ?? null);
  if (data.photoKey && photoChanged) await assertUploadedPhoto(actor, "expense_receipt", data.photoKey);

  const changes = [
    !area._id.equals(expense.areaId) && "area",
    category !== expense.category && "category",
    data.description !== expense.description && "description",
    data.amount !== expense.amount && "amount",
    data.date !== dayKey(expense.date) && "date",
    photoChanged && "photo",
  ].filter((change): change is string => Boolean(change));
  if (changes.length === 0) return { status: expense.approvalStatus };

  // Money changes go through the approval rule again; so does fixing a rejected expense.
  const recheck =
    expense.approvalStatus === "rejected" || changes.some((change) => ["area", "category", "amount"].includes(change));
  const status = recheck ? approvalStatusFor(data.amount, settings.expenseApprovalLimit) : expense.approvalStatus;

  const unset: Record<string, 1> = {};
  if (!data.photoKey) unset.receiptPhotoKey = 1;
  if (recheck) Object.assign(unset, { reviewedBy: 1, reviewedAt: 1, reviewNote: 1 });

  await Expense.updateOne(
    { _id: expense._id },
    {
      $set: {
        areaId: area._id,
        category,
        description: data.description,
        amount: data.amount,
        date: karachiDayStart(data.date),
        month: data.date.slice(0, 7),
        approvalStatus: status,
        ...(data.photoKey ? { receiptPhotoKey: data.photoKey } : {}),
      },
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
  );

  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "Expense",
    entityId: expense._id,
    areaId: area._id,
    meta: {
      changes,
      ...(changes.includes("amount") ? { fromAmount: expense.amount, toAmount: data.amount } : {}),
      ...(status !== expense.approvalStatus ? { fromStatus: expense.approvalStatus, toStatus: status } : {}),
    },
  });
  if (recheck && status === "pending") {
    await notifyReviewers(actor.id, area._id, area.name, data.amount, data.description);
  }
  return { status };
}

export async function reviewExpense(input: ReviewExpenseInput): Promise<void> {
  const actor = await requireRole(...EXPENSE_REVIEW_ROLES);
  const data = reviewExpenseSchema.parse(input);
  if (!isValidObjectId(data.id)) throw new ServiceError("not_found");
  await connectDB();

  const expense = await Expense.findOne(scopeQueryToUserAreas(actor, { _id: data.id })).lean();
  if (!expense) throw new ServiceError("not_found");
  if (expense.approvalStatus !== "pending") throw new ServiceError("expense_already_reviewed");
  if (expense.createdBy.toString() === actor.id) throw new ServiceError("cannot_review_own_expense");
  const area = await loadAreaInScope(actor, expense.areaId.toString(), { forWrite: true });
  if (!canReviewExpense(actor, { status: expense.approvalStatus, createdById: expense.createdBy.toString(), areaId: area._id.toString() })) {
    throw new ServiceError("forbidden");
  }

  const status = data.decision === "approve" ? "approved" : "rejected";
  // Guarded on "pending": two reviewers clicking at once cannot both decide.
  const result = await Expense.updateOne(
    { _id: expense._id, approvalStatus: "pending" },
    {
      $set: { approvalStatus: status, reviewedBy: actor.id, reviewedAt: new Date(), ...(data.note ? { reviewNote: data.note } : {}) },
      ...(data.note ? {} : { $unset: { reviewNote: 1 } }),
    },
  );
  if (result.modifiedCount === 0) throw new ServiceError("expense_already_reviewed");

  await logActivity({
    actorId: actor.id,
    action: data.decision === "approve" ? "approve" : "reject",
    entity: "Expense",
    entityId: expense._id,
    areaId: area._id,
    meta: { amount: expense.amount, ...(data.note ? { note: data.note } : {}) },
  });

  const creator = await User.findById(expense.createdBy).select("role status").lean();
  if (creator?.status === "active") {
    await notify({
      userIds: [creator._id.toString()],
      type: "expense_approval",
      title: status === "approved" ? "Expense approved" : "Expense rejected",
      body: `${expense.description} (Rs. ${expense.amount}, ${area.name}, ${formatDate(expense.date)})${data.note ? `: ${data.note}` : ""}`,
      link: creator.role === "supervisor" ? "/supervisor/expenses" : "/admin/expenses",
    });
  }
}

/** Tell the area's committee and the super admins that an expense waits for them. */
async function notifyReviewers(
  creatorId: string,
  areaId: Types.ObjectId,
  areaName: string,
  amount: number,
  description: string,
): Promise<void> {
  const reviewers = await User.find({
    _id: { $ne: new Types.ObjectId(creatorId) },
    status: "active",
    $or: [{ role: "super_admin" }, { role: "committee", areaIds: areaId }],
  })
    .select("role")
    .lean();
  const message = { type: "expense_approval" as const, title: "Expense waiting for approval", body: `${description} (Rs. ${amount}, ${areaName})` };
  const committee = reviewers.filter((user) => user.role === "committee").map((user) => user._id.toString());
  const admins = reviewers.filter((user) => user.role === "super_admin").map((user) => user._id.toString());
  if (committee.length > 0) await notify({ ...message, userIds: committee, link: "/resident/approvals" });
  if (admins.length > 0) await notify({ ...message, userIds: admins, link: "/admin/expenses?status=pending&month=all" });
}
