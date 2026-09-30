import { describe, expect, it } from "vitest";

import { canManageRole } from "./roles";
import { postLoginRedirect, resolveRouteRedirect, type RouteUser } from "./route-access";

const admin: RouteUser = { role: "super_admin", mustChangePassword: false };
const manager: RouteUser = { role: "area_manager", mustChangePassword: false };
const supervisor: RouteUser = { role: "supervisor", mustChangePassword: false };
const worker: RouteUser = { role: "worker", mustChangePassword: false };
const resident: RouteUser = { role: "resident", mustChangePassword: false };
const committee: RouteUser = { role: "committee", mustChangePassword: false };
const tempPassword: RouteUser = { role: "worker", mustChangePassword: true };

describe("resolveRouteRedirect", () => {
  it("sends signed-out users to login with a callback", () => {
    expect(resolveRouteRedirect("/admin/users", "?role=worker", null)).toBe(
      "/login?callbackUrl=%2Fadmin%2Fusers%3Frole%3Dworker",
    );
  });

  it("leaves public pages alone", () => {
    expect(resolveRouteRedirect("/", "", null)).toBeNull();
    expect(resolveRouteRedirect("/administrator", "", null)).toBeNull();
  });

  it.each([
    ["/admin", admin],
    ["/admin/users", manager],
    ["/supervisor", supervisor],
    ["/worker/profile", worker],
    ["/resident", resident],
    ["/resident", committee],
  ])("lets the right role into %s", (path, user) => {
    expect(resolveRouteRedirect(path, "", user)).toBeNull();
  });

  it.each([
    ["/admin", supervisor, "/supervisor"],
    ["/admin/users", worker, "/worker"],
    ["/supervisor", manager, "/admin"],
    ["/worker", resident, "/resident"],
    ["/resident", admin, "/admin"],
  ])("sends the wrong role away from %s", (path, user, expected) => {
    expect(resolveRouteRedirect(path, "", user)).toBe(expected);
  });

  it("forces a password change before anything else", () => {
    expect(resolveRouteRedirect("/worker", "", tempPassword)).toBe("/change-password");
    expect(resolveRouteRedirect("/change-password", "", tempPassword)).toBeNull();
  });

  it("keeps signed-in users off the login page", () => {
    expect(resolveRouteRedirect("/login", "", worker)).toBe("/worker");
    expect(resolveRouteRedirect("/login", "", tempPassword)).toBe("/change-password");
    expect(resolveRouteRedirect("/login", "", null)).toBeNull();
  });

  it("only shows change-password to users who need it", () => {
    expect(resolveRouteRedirect("/change-password", "", null)).toBe("/login");
    expect(resolveRouteRedirect("/change-password", "", manager)).toBe("/admin");
  });
});

describe("postLoginRedirect", () => {
  it("uses the callback when the role may open it", () => {
    expect(postLoginRedirect(manager, "/admin/users?q=ali")).toBe("/admin/users?q=ali");
  });

  it("ignores callbacks into another role's section", () => {
    expect(postLoginRedirect(worker, "/admin/users")).toBe("/worker");
  });

  it("ignores external and protocol-relative urls", () => {
    expect(postLoginRedirect(manager, "https://evil.example/admin")).toBe("/admin");
    expect(postLoginRedirect(manager, "//evil.example/admin")).toBe("/admin");
    expect(postLoginRedirect(manager, "/\\evil.example")).toBe("/admin");
  });

  it("goes to the role home without a callback", () => {
    expect(postLoginRedirect(committee, null)).toBe("/resident");
  });

  it("goes to change-password when required", () => {
    expect(postLoginRedirect(tempPassword, "/worker")).toBe("/change-password");
  });
});

describe("canManageRole", () => {
  it("lets super admins manage everyone", () => {
    expect(canManageRole("super_admin", "super_admin")).toBe(true);
    expect(canManageRole("super_admin", "area_manager")).toBe(true);
  });

  it("stops area managers from creating admins", () => {
    expect(canManageRole("area_manager", "super_admin")).toBe(false);
    expect(canManageRole("area_manager", "area_manager")).toBe(false);
    expect(canManageRole("area_manager", "supervisor")).toBe(true);
  });

  it("gives other roles no user management", () => {
    expect(canManageRole("supervisor", "worker")).toBe(false);
  });
});
