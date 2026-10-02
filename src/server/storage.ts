import "server-only";

import { randomUUID } from "node:crypto";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, features, requireEnv } from "@/lib/env";
import { assertRole, requireUser, type Actor } from "@/lib/permissions";
import {
  isOwnUploadKey,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_KINDS,
  UPLOAD_URL_SECONDS,
  uploadKey,
  uploadRequestSchema,
  type UploadKind,
  type UploadTicket,
} from "@/lib/uploads";
import { ServiceError } from "@/server/errors";
import { loadSettings } from "@/server/settings";

// Photos live in Cloudflare R2 (S3 API). The browser uploads straight to R2
// with a short-lived pre-signed URL; the app stores only the object key and
// builds a viewing URL when the record is read.

/** Pre-signed viewing links last this long; pages are rendered on demand, so this is plenty. */
const VIEW_URL_SECONDS = 60 * 60;

let client: S3Client | null = null;

function s3(): S3Client {
  if (!features.storage) throw new ServiceError("storage_not_configured");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
    // Newer SDKs add CRC32 checksum parameters to every upload; a browser PUT
    // to a pre-signed URL cannot send them, and R2 would reject the upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function bucket(): string {
  return requireEnv("R2_BUCKET");
}

/**
 * Hand out a URL the browser can PUT one photo to. Only roles allowed for the
 * kind get one, and the key contains the user's id so a saved key can be
 * checked against whoever saves it.
 */
export async function createUploadUrl(input: unknown): Promise<UploadTicket> {
  const actor = await requireUser();
  const data = uploadRequestSchema.parse(input);
  assertRole(actor, UPLOAD_KINDS[data.kind].roles);
  if (data.kind === "expense_receipt" && actor.role === "supervisor") {
    const settings = await loadSettings();
    if (!settings.supervisorsCanAddExpenses) throw new ServiceError("expenses_not_allowed");
  }

  const key = uploadKey(data.kind, actor.id, randomUUID(), data.contentType);
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: data.contentType }),
    { expiresIn: UPLOAD_URL_SECONDS },
  );
  return { uploadUrl, key, contentType: data.contentType };
}

/**
 * Before saving a photo key on a record: it must be one this user uploaded
 * for this kind, and the object must really be in R2 as a small image.
 */
export async function assertUploadedPhoto(actor: Actor, kind: UploadKind, key: string): Promise<void> {
  if (!isOwnUploadKey(kind, actor.id, key)) throw new ServiceError("invalid_input", { photoKey: "photoInvalid" });

  let head;
  try {
    head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) throw new ServiceError("invalid_input", { photoKey: "photoMissing" });
    throw error;
  }
  const type = head.ContentType ?? "";
  if ((head.ContentLength ?? 0) > MAX_UPLOAD_BYTES || !(UPLOAD_CONTENT_TYPES as readonly string[]).includes(type)) {
    throw new ServiceError("invalid_input", { photoKey: "photoInvalid" });
  }
}

/**
 * A URL to show a stored photo: the public bucket URL when R2_PUBLIC_URL is
 * set, otherwise a pre-signed link valid for an hour. Null when there is no
 * photo or storage is switched off.
 */
export async function photoUrl(key: string | null | undefined): Promise<string | null> {
  if (!key || !features.storage) return null;
  if (env.R2_PUBLIC_URL) return `${env.R2_PUBLIC_URL.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: VIEW_URL_SECONDS });
}
