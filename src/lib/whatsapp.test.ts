import { describe, expect, it } from "vitest";

import { generateTemporaryPassword } from "./temp-password";
import { whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("opens a chat with a Pakistani number in international format", () => {
    expect(whatsappLink("Salam", "03001234567")).toBe("https://wa.me/923001234567?text=Salam");
  });

  it("encodes the message", () => {
    expect(whatsappLink("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("ignores numbers that are not normalised", () => {
    expect(whatsappLink("x", "0300-1234567")).toBe("https://wa.me/?text=x");
  });
});

describe("generateTemporaryPassword", () => {
  it("makes two groups of four readable characters", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateTemporaryPassword()).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("is long enough to pass the password rules", () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(8);
  });
});
