import { describe, expect, it } from "vitest";

import {
  balanceFor,
  chartSeries,
  collectionSummary,
  hisaabMessage,
  hisaabMonths,
  HISAAB_MAX_MONTHS,
  makeAreaSlug,
  pickHisaabMonth,
  publicHisaabPath,
  slugify,
  SLUG_REGEX,
  type MonthTotals,
} from "@/lib/hisaab";
import { hisaabQuerySchema, publicHisaabQuerySchema } from "@/lib/validators/hisaab";

const totals: MonthTotals[] = [
  { month: "2026-07", collected: 10_000, spent: 4_000 },
  { month: "2026-08", collected: 12_000, spent: 15_000 },
  { month: "2026-10", collected: 9_000, spent: 1_000 },
];

describe("balanceFor", () => {
  it("starts the first month at zero", () => {
    expect(balanceFor("2026-07", totals)).toEqual({ opening: 0, collected: 10_000, spent: 4_000, closing: 6_000 });
  });

  it("opens each month with the previous month's closing balance", () => {
    const july = balanceFor("2026-07", totals);
    const august = balanceFor("2026-08", totals);
    const september = balanceFor("2026-09", totals);
    const october = balanceFor("2026-10", totals);
    expect(august.opening).toBe(july.closing);
    expect(august.closing).toBe(3_000);
    // A month with no money in or out carries the balance over unchanged.
    expect(september).toEqual({ opening: 3_000, collected: 0, spent: 0, closing: 3_000 });
    expect(october.opening).toBe(september.closing);
    expect(october.closing).toBe(11_000);
  });

  it("can go negative when more was spent than collected", () => {
    expect(balanceFor("2026-08", [{ month: "2026-08", collected: 1_000, spent: 3_000 }]).closing).toBe(-2_000);
  });

  it("ignores later months and adds up repeated entries", () => {
    const repeated = [...totals, { month: "2026-07", collected: 500, spent: 0 }];
    expect(balanceFor("2026-07", repeated)).toEqual({ opening: 0, collected: 10_500, spent: 4_000, closing: 6_500 });
  });
});

describe("chartSeries", () => {
  it("gives six months ending with the selected one, zero-filled", () => {
    const series = chartSeries("2026-10", totals);
    expect(series.map((entry) => entry.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(series[0]).toEqual({ month: "2026-05", collected: 0, spent: 0 });
    expect(series[3]).toEqual({ month: "2026-08", collected: 12_000, spent: 15_000 });
  });

  it("crosses the year boundary", () => {
    expect(chartSeries("2027-02", [], 4).map((entry) => entry.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});

describe("hisaabMonths", () => {
  it("runs from the first record to now, newest first", () => {
    expect(hisaabMonths("2026-08", "2026-10")).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("offers only the current month when there is no data", () => {
    expect(hisaabMonths(null, "2026-10")).toEqual(["2026-10"]);
  });

  it("never offers future months (advance bills)", () => {
    expect(hisaabMonths("2026-12", "2026-10")).toEqual(["2026-10"]);
  });

  it("is capped", () => {
    expect(hisaabMonths("2010-01", "2026-10")).toHaveLength(HISAAB_MAX_MONTHS);
  });

  it("picks the requested month only when offered", () => {
    const months = hisaabMonths("2026-08", "2026-10");
    expect(pickHisaabMonth("2026-09", months)).toBe("2026-09");
    expect(pickHisaabMonth("2025-01", months)).toBe("2026-10");
    expect(pickHisaabMonth(undefined, months)).toBe("2026-10");
  });
});

describe("collectionSummary", () => {
  it("counts households and rounds the percent down", () => {
    const summary = collectionSummary([
      { amount: 150, paidAmount: 150 },
      { amount: 150, paidAmount: 200 },
      { amount: 200, paidAmount: 100 },
      { amount: 100, paidAmount: 0 },
      { amount: 0, paidAmount: 0 },
    ]);
    expect(summary).toEqual({ households: 4, paid: 2, partial: 1, unpaid: 1, billed: 600, collected: 400, percent: 66 });
  });

  it("never shows 100% until everything is paid", () => {
    const bills = Array.from({ length: 300 }, (_, index) => ({ amount: 100, paidAmount: index === 0 ? 99 : 100 }));
    expect(collectionSummary(bills)?.percent).toBe(99);
  });

  it("is null without bills", () => {
    expect(collectionSummary([])).toBeNull();
    expect(collectionSummary([{ amount: 0, paidAmount: 0 }])).toBeNull();
  });
});

describe("slugs", () => {
  it("turns area names into URL-safe slugs", () => {
    expect(slugify("Satellite Town")).toBe("satellite-town");
    expect(slugify("Bahria Town Phase 4")).toBe("bahria-town-phase-4");
    expect(slugify("G-11")).toBe("g-11");
    expect(slugify("  I-8 / Markaz  ")).toBe("i-8-markaz");
    expect(slugify("سیٹلائٹ ٹاؤن")).toBe("area");
    expect(SLUG_REGEX.test(slugify("Café  Block -- 7"))).toBe(true);
  });

  it("adds the city, then a number, when the name is taken", () => {
    expect(makeAreaSlug("G-11", "Islamabad", new Set())).toBe("g-11");
    expect(makeAreaSlug("Saddar", "Rawalpindi", new Set(["saddar"]))).toBe("saddar-rawalpindi");
    expect(makeAreaSlug("Saddar", "Rawalpindi", new Set(["saddar", "saddar-rawalpindi"]))).toBe("saddar-2");
    expect(makeAreaSlug("Saddar", "Rawalpindi", new Set(["saddar", "saddar-rawalpindi", "saddar-2"]))).toBe("saddar-3");
  });

  it("builds the public path", () => {
    expect(publicHisaabPath("g-11")).toBe("/hisaab/g-11");
    expect(publicHisaabPath("g-11", "2026-10")).toBe("/hisaab/g-11?month=2026-10");
  });
});

describe("hisaab validators", () => {
  it("drops bad search params instead of failing", () => {
    expect(hisaabQuerySchema.parse({ area: "nope", month: "2026-13" })).toEqual({ area: undefined, month: undefined });
    expect(hisaabQuerySchema.parse({ area: "665f00000000000000000001", month: "2026-10" })).toEqual({
      area: "665f00000000000000000001",
      month: "2026-10",
    });
    expect(publicHisaabQuerySchema.parse({ month: ["2026-10", "2026-09"] })).toEqual({ month: undefined });
  });
});

describe("hisaabMessage", () => {
  it("summarises the month in Roman Urdu with the link", () => {
    const text = hisaabMessage({
      organisation: "Saaf Gali",
      area: "G-11",
      month: "2026-10",
      collected: 45_000,
      spent: 30_500,
      closing: 14_500,
      url: "https://saafgali.pk/hisaab/g-11?month=2026-10",
    });
    expect(text).toContain("G-11 ka Oct 2026 ka hisaab");
    expect(text).toContain("Wusooli: Rs. 45,000");
    expect(text).toContain("Baqi raqam: Rs. 14,500");
    expect(text).toContain("https://saafgali.pk/hisaab/g-11?month=2026-10");
  });
});
