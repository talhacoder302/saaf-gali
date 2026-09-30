import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { PermissionError } from "@/lib/permissions";
import { ServiceError } from "@/server/errors";

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Run a Server Action body and turn known errors into an ActionResult the
 * client can display. Unknown errors are logged and shown as "unknown".
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    // Let Next.js redirects and notFound() through.
    unstable_rethrow(error);

    if (error instanceof PermissionError) return { ok: false, error: error.code };
    if (error instanceof ServiceError) {
      return { ok: false, error: error.code, fieldErrors: error.fieldErrors };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: "invalid_input", fieldErrors: zodFieldErrors(error) };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: "unknown" };
  }
}
