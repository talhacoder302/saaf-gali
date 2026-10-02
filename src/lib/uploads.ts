import { z } from "zod";

import type { Role } from "@/lib/roles";

// Rules for photo uploads to R2. Pure, so the route handler, services and
// tests share them. Later modules add their kinds (work photos, complaints).

export const UPLOAD_KINDS = {
  expense_receipt: { folder: "expenses", roles: ["super_admin", "area_manager", "supervisor"] },
  logo: { folder: "settings", roles: ["super_admin"] },
} as const satisfies Record<string, { folder: string; roles: readonly Role[] }>;

export type UploadKind = keyof typeof UPLOAD_KINDS;
export const UPLOAD_KIND_NAMES = Object.keys(UPLOAD_KINDS) as [UploadKind, ...UploadKind[]];

export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

const EXTENSIONS: Record<UploadContentType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Photos are compressed to about 150 KB in the browser; this is the hard ceiling. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

/** Target size for browser compression. */
export const PHOTO_TARGET_KB = 150;

/** How long a pre-signed upload URL stays valid. */
export const UPLOAD_URL_SECONDS = 5 * 60;

export const uploadRequestSchema = z.object({
  kind: z.enum(UPLOAD_KIND_NAMES),
  contentType: z.enum(UPLOAD_CONTENT_TYPES, { error: "photoWrongType" }),
  size: z.number().int().min(1, "photoWrongType").max(MAX_UPLOAD_BYTES, "photoTooLarge"),
});

export type UploadRequest = z.input<typeof uploadRequestSchema>;

/** What the upload route returns: where to PUT the file and the key to save. */
export type UploadTicket = { uploadUrl: string; key: string; contentType: UploadContentType };

/** "expenses/<userId>/<id>.jpg": the user id in the key proves who uploaded it. */
export function uploadKey(kind: UploadKind, userId: string, id: string, contentType: UploadContentType): string {
  return `${UPLOAD_KINDS[kind].folder}/${userId}/${id}.${EXTENSIONS[contentType]}`;
}

const KEY_TAIL = /^[A-Za-z0-9-]{8,64}\.(jpg|png|webp)$/;

/** True when the key was handed out to this user for this kind of upload. */
export function isOwnUploadKey(kind: UploadKind, userId: string, key: string): boolean {
  const prefix = `${UPLOAD_KINDS[kind].folder}/${userId}/`;
  return key.startsWith(prefix) && KEY_TAIL.test(key.slice(prefix.length));
}
