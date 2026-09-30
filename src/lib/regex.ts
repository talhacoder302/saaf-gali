/** Escape user text so it can be used inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive whole-value match, for "is this name already taken?" checks. */
export function exactNameRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value.trim())}$`, "i");
}
