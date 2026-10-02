import { describe, expect, it } from "vitest";

import { isOwnUploadKey, MAX_UPLOAD_BYTES, uploadKey, uploadRequestSchema } from "@/lib/uploads";

const USER = "6abc6492a4579d8000bdf44f";
const OTHER_USER = "6abc6492a4579d8000bdf450";
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("upload keys", () => {
  it("puts the kind's folder and the uploader's id in the key", () => {
    expect(uploadKey("expense_receipt", USER, ID, "image/jpeg")).toBe(`expenses/${USER}/${ID}.jpg`);
    expect(uploadKey("logo", USER, ID, "image/png")).toBe(`settings/${USER}/${ID}.png`);
  });

  it("accepts only keys handed out to the same user for the same kind", () => {
    const key = uploadKey("expense_receipt", USER, ID, "image/jpeg");
    expect(isOwnUploadKey("expense_receipt", USER, key)).toBe(true);
    expect(isOwnUploadKey("expense_receipt", OTHER_USER, key)).toBe(false);
    expect(isOwnUploadKey("logo", USER, key)).toBe(false);
  });

  it("rejects keys that try to escape the folder", () => {
    expect(isOwnUploadKey("expense_receipt", USER, `expenses/${USER}/../${OTHER_USER}/${ID}.jpg`)).toBe(false);
    expect(isOwnUploadKey("expense_receipt", USER, `expenses/${USER}/${ID}.exe`)).toBe(false);
    expect(isOwnUploadKey("expense_receipt", USER, `expenses/${USER}/`)).toBe(false);
  });
});

describe("upload request", () => {
  it("accepts small images", () => {
    expect(uploadRequestSchema.safeParse({ kind: "expense_receipt", contentType: "image/jpeg", size: 150_000 }).success).toBe(true);
  });

  it("refuses other file types, unknown kinds and big files", () => {
    expect(uploadRequestSchema.safeParse({ kind: "expense_receipt", contentType: "application/pdf", size: 10 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ kind: "avatar", contentType: "image/jpeg", size: 10 }).success).toBe(false);
    expect(
      uploadRequestSchema.safeParse({ kind: "logo", contentType: "image/png", size: MAX_UPLOAD_BYTES + 1 }).error?.issues[0]?.message,
    ).toBe("photoTooLarge");
  });
});
