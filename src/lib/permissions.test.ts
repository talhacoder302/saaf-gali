import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/server/session";

import {
  canAccessArea,
  hasAllAreaAccess,
  PermissionError,
  requireAreaAccess,
  requireRole,
  requireUser,
  scopeQueryToUserAreas,
  type Actor,
} from "./permissions";

const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();

vi.mock("@/server/session", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const AREA_A = "665f00000000000000000001";
const AREA_B = "665f00000000000000000002";

const superAdmin: Actor = { id: "u1", role: "super_admin", areaIds: [] };
const manager: Actor = { id: "u2", role: "area_manager", areaIds: [AREA_A] };
const supervisor: Actor = { id: "u3", role: "supervisor", areaIds: [AREA_B] };
const noAreas: Actor = { id: "u4", role: "resident", areaIds: [] };

function currentUser(actor: Actor, overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: actor.id,
    name: "Test User",
    mobile: "03001234567",
    role: actor.role,
    areaIds: [...actor.areaIds],
    householdId: null,
    language: "en",
    mustChangePassword: false,
    ...overrides,
  };
}

async function expectPermissionError(promise: Promise<unknown>, code: PermissionError["code"]) {
  await expect(promise).rejects.toBeInstanceOf(PermissionError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("area access", () => {
  it("gives super admins every area", () => {
    expect(hasAllAreaAccess(superAdmin)).toBe(true);
    expect(canAccessArea(superAdmin, AREA_B)).toBe(true);
  });

  it("limits everyone else to their own areas", () => {
    expect(canAccessArea(manager, AREA_A)).toBe(true);
    expect(canAccessArea(manager, AREA_B)).toBe(false);
    expect(canAccessArea(noAreas, AREA_A)).toBe(false);
  });
});

describe("scopeQueryToUserAreas", () => {
  it("adds no area condition for super admins", () => {
    const filter = { status: "active" };
    expect(scopeQueryToUserAreas(superAdmin, filter)).toEqual({ $and: [filter] });
  });

  it("adds an $in on areaId by default", () => {
    expect(scopeQueryToUserAreas(manager, { status: "active" })).toEqual({
      $and: [{ status: "active" }, { areaId: { $in: [AREA_A] } }],
    });
  });

  it("uses the given field", () => {
    expect(scopeQueryToUserAreas(supervisor, {}, "areaIds")).toEqual({ $and: [{}, { areaIds: { $in: [AREA_B] } }] });
    expect(scopeQueryToUserAreas(supervisor, {}, "_id")).toEqual({ $and: [{}, { _id: { $in: [AREA_B] } }] });
  });

  it("cannot be widened by a condition on the same field", () => {
    // A supervisor asking for another area's data must still get nothing back.
    expect(scopeQueryToUserAreas(supervisor, { areaId: AREA_A })).toEqual({
      $and: [{ areaId: AREA_A }, { areaId: { $in: [AREA_B] } }],
    });
  });

  it("matches nothing for a user without areas", () => {
    expect(scopeQueryToUserAreas(noAreas, {})).toEqual({ $and: [{}, { areaId: { $in: [] } }] });
  });

  it("does not share the actor's array with the query", () => {
    const scoped = scopeQueryToUserAreas(manager, {});
    const condition = scoped.$and[1] as { areaId: { $in: string[] } };
    expect(condition.areaId.$in).not.toBe(manager.areaIds);
  });
});

describe("requireUser", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("throws unauthenticated without a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expectPermissionError(requireUser(), "unauthenticated");
  });

  it("blocks users who still have a temporary password", async () => {
    getCurrentUser.mockResolvedValue(currentUser(manager, { mustChangePassword: true }));
    await expectPermissionError(requireUser(), "password_change_required");
  });

  it("lets them through for the password change itself", async () => {
    getCurrentUser.mockResolvedValue(currentUser(manager, { mustChangePassword: true }));
    await expect(requireUser({ allowPendingPasswordChange: true })).resolves.toMatchObject({ id: "u2" });
  });
});

describe("requireRole", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("returns the user when the role matches", async () => {
    getCurrentUser.mockResolvedValue(currentUser(manager));
    await expect(requireRole("super_admin", "area_manager")).resolves.toMatchObject({ role: "area_manager" });
  });

  it("throws forbidden for other roles", async () => {
    getCurrentUser.mockResolvedValue(currentUser(supervisor));
    await expectPermissionError(requireRole("super_admin", "area_manager"), "forbidden");
  });
});

describe("requireAreaAccess", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("allows the user's own area", async () => {
    getCurrentUser.mockResolvedValue(currentUser(supervisor));
    await expect(requireAreaAccess(AREA_B)).resolves.toMatchObject({ id: "u3" });
  });

  it("refuses another area", async () => {
    getCurrentUser.mockResolvedValue(currentUser(supervisor));
    await expectPermissionError(requireAreaAccess(AREA_A), "forbidden");
  });

  it("allows super admins into any area", async () => {
    getCurrentUser.mockResolvedValue(currentUser(superAdmin));
    await expect(requireAreaAccess(AREA_A)).resolves.toMatchObject({ role: "super_admin" });
  });

  it("checks the role too when roles are given", async () => {
    getCurrentUser.mockResolvedValue(currentUser(supervisor));
    await expectPermissionError(requireAreaAccess(AREA_B, ["area_manager"]), "forbidden");
  });
});
