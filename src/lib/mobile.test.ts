import { describe, expect, it } from "vitest";

import { formatMobile, mobileSchema, normalizeMobile } from "./mobile";

describe("normalizeMobile", () => {
  it.each([
    ["03001234567", "03001234567"],
    ["0300-1234567", "03001234567"],
    ["0300 1234567", "03001234567"],
    ["(0300) 123-4567", "03001234567"],
    ["3001234567", "03001234567"],
    ["+923001234567", "03001234567"],
    ["+92 300 1234567", "03001234567"],
    ["+92-300-1234567", "03001234567"],
    ["923001234567", "03001234567"],
    ["00923001234567", "03001234567"],
    ["  0345-9876543  ", "03459876543"],
    ["۰۳۰۰۱۲۳۴۵۶۷", "03001234567"],
    ["٠٣٠٠١٢٣٤٥٦٧", "03001234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  it.each([
    [""],
    ["   "],
    ["0300123456"], // too short
    ["030012345678"], // too long
    ["05112345678"], // landline
    ["+14155552671"], // not Pakistani
    ["92300123456"], // 92 prefix but too short
    ["0300-123456a"],
    ["0300+1234567"],
    ["abc"],
  ])("rejects %s", (input) => {
    expect(normalizeMobile(input)).toBeNull();
  });
});

describe("formatMobile", () => {
  it("adds a dash after the network code", () => {
    expect(formatMobile("03001234567")).toBe("0300-1234567");
  });

  it("leaves anything else alone", () => {
    expect(formatMobile("12345")).toBe("12345");
  });
});

describe("mobileSchema", () => {
  it("outputs the normalised number", () => {
    expect(mobileSchema.parse("+92 321 7654321")).toBe("03217654321");
  });

  it("fails with invalidMobile for bad numbers", () => {
    const result = mobileSchema.safeParse("12345");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("invalidMobile");
  });
});
