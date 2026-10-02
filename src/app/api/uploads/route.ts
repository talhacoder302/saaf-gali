import { runAction } from "@/server/run-action";
import { createUploadUrl } from "@/server/storage";

const STATUS: Record<string, number> = {
  unauthenticated: 401,
  password_change_required: 403,
  forbidden: 403,
  expenses_not_allowed: 403,
  storage_not_configured: 503,
};

/**
 * POST { kind, contentType, size } -> a pre-signed URL the browser PUTs the
 * compressed photo to, plus the key to save with the record. Used by <PhotoUpload>.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const result = await runAction(() => createUploadUrl(body));
  const status = result.ok ? 200 : (STATUS[result.error] ?? (result.error === "unknown" ? 500 : 400));
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
