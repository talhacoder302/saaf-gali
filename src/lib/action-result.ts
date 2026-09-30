/**
 * What every Server Action returns. `error` is a key under "errors" in the
 * i18n files, so the client can show it in the user's language.
 * `fieldErrors` maps form field names to error keys.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
