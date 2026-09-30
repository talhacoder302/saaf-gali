import { describe, expect, it } from "vitest";

import { isInPakistan, isTeamRole, mapLink } from "./areas";
import { compareNames, sortByName } from "./sort";
import { areaFormSchema, locationSchema, streetFormSchema } from "./validators/areas";

const OBJECT_ID = "665f00000000000000000001";

describe("isInPakistan", () => {
  it("accepts Rawalpindi and Islamabad", () => {
    expect(isInPakistan(33.634, 73.068)).toBe(true); // Satellite Town
    expect(isInPakistan(33.67, 72.99)).toBe(true); // G-11
  });

  it("rejects swapped coordinates and far-away points", () => {
    expect(isInPakistan(73.068, 33.634)).toBe(false);
    expect(isInPakistan(51.5, -0.12)).toBe(false);
  });
});

describe("mapLink", () => {
  it("points at OpenStreetMap with the marker", () => {
    expect(mapLink(33.634, 73.068)).toBe("https://www.openstreetmap.org/?mlat=33.634&mlon=73.068#map=18/33.634/73.068");
  });
});

describe("isTeamRole", () => {
  it("covers managers, supervisors and committee only", () => {
    expect(isTeamRole("area_manager")).toBe(true);
    expect(isTeamRole("supervisor")).toBe(true);
    expect(isTeamRole("committee")).toBe(true);
    expect(isTeamRole("worker")).toBe(false);
    expect(isTeamRole("super_admin")).toBe(false);
  });
});

describe("natural sorting", () => {
  it("puts Street 2 before Street 10", () => {
    expect(compareNames("Street 2", "Street 10")).toBeLessThan(0);
    expect(sortByName([{ name: "Street 10" }, { name: "street 2" }, { name: "Street 1" }]).map((s) => s.name)).toEqual([
      "Street 1",
      "street 2",
      "Street 10",
    ]);
  });
});

describe("areaFormSchema", () => {
  const valid = { name: "Satellite Town", city: "Rawalpindi", description: "", defaultMonthlyFee: 150 };

  it("accepts a normal area", () => {
    expect(areaFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    [Number.NaN, "feeInvalid"],
    [-1, "feeInvalid"],
    [150.5, "feeWholeRupees"],
    [100_001, "feeInvalid"],
  ])("rejects fee %s", (fee, message) => {
    const result = areaFormSchema.safeParse({ ...valid, defaultMonthlyFee: fee });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects unknown cities", () => {
    expect(areaFormSchema.safeParse({ ...valid, city: "Lahore" }).success).toBe(false);
  });
});

describe("locationSchema", () => {
  it("accepts a point in Pakistan", () => {
    expect(locationSchema.safeParse({ lat: 33.634, lng: 73.068 }).success).toBe(true);
  });

  it("rejects a half-filled pair", () => {
    const result = locationSchema.safeParse({ lat: 33.634, lng: Number.NaN });
    expect(result.error?.issues[0]?.message).toBe("invalidLocation");
  });

  it("catches swapped coordinates with the Pakistan check", () => {
    const result = locationSchema.safeParse({ lat: 73.068, lng: 33.634 });
    expect(result.error?.issues[0]?.message).toBe("locationOutsidePakistan");
  });

  it("rejects points outside Pakistan", () => {
    const result = locationSchema.safeParse({ lat: 51.5, lng: -0.12 });
    expect(result.error?.issues[0]?.message).toBe("locationOutsidePakistan");
  });
});

describe("streetFormSchema", () => {
  it("allows no supervisor and no location", () => {
    const result = streetFormSchema.safeParse({ blockId: OBJECT_ID, name: "Street 5", supervisorId: null, location: null });
    expect(result.success).toBe(true);
  });

  it("needs a name", () => {
    const result = streetFormSchema.safeParse({ blockId: OBJECT_ID, name: "  ", supervisorId: null, location: null });
    expect(result.error?.issues[0]?.message).toBe("required");
  });
});
