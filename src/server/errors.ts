/**
 * An expected failure in a service (duplicate mobile, wrong password...).
 * `code` is a key under "errors" in the i18n files.
 */
export class ServiceError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: string, fieldErrors?: Record<string, string>) {
    super(code);
    this.name = "ServiceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
