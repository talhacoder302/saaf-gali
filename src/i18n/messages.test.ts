import { describe, expect, it } from "vitest";

import en from "./en.json";
import ur from "./ur.json";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const [k, v] of flatten(value, path)) result.set(k, v);
  }
  return result;
}

// Simple {name} placeholders; plural blocks like {total, plural, ...} count by their variable.
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1] ?? "").sort();
}

describe("translations", () => {
  const english = flatten(en);
  const urdu = flatten(ur);

  it("has the same keys in English and Urdu", () => {
    expect([...urdu.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("uses the same placeholders in both languages", () => {
    for (const [key, message] of english) {
      expect(placeholders(urdu.get(key) ?? ""), key).toEqual(placeholders(message));
    }
  });

  it("has no empty messages", () => {
    for (const [key, message] of [...english, ...urdu]) {
      expect(message.trim(), key).not.toBe("");
    }
  });
});
