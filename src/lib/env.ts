import { z } from "zod";

// Treat empty strings (e.g. "R2_BUCKET=" in .env.local) as missing.
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  NEXT_PUBLIC_APP_URL: optionalUrl,

  MONGODB_URI: optionalString.refine(
    (value) => value === undefined || /^mongodb(\+srv)?:\/\//.test(value),
    "MONGODB_URI must start with mongodb:// or mongodb+srv://",
  ),
  MONGODB_DB_NAME: optionalString.transform((value) => value ?? "saaf_gali"),

  AUTH_SECRET: optionalString,
  AUTH_URL: optionalUrl,
  AUTH_TRUST_HOST: optionalString,

  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_PUBLIC_URL: optionalUrl,

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,

  SEED_ADMIN_MOBILE: optionalString.refine(
    (value) => value === undefined || /^03\d{9}$/.test(value),
    "SEED_ADMIN_MOBILE must look like 03XXXXXXXXX",
  ),
  SEED_ADMIN_PASSWORD: optionalString,
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

export const env = parseEnv();

type EnvKey = keyof Env;

const featureKeys = {
  storage: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"],
  email: ["RESEND_API_KEY", "EMAIL_FROM"],
  push: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
} satisfies Record<string, EnvKey[]>;

export type Feature = keyof typeof featureKeys;

function isFeatureOn(feature: Feature): boolean {
  const keys: EnvKey[] = featureKeys[feature];
  const present = keys.filter((key) => env[key] !== undefined);
  if (present.length > 0 && present.length < keys.length) {
    const missing = keys.filter((key) => env[key] === undefined);
    console.warn(`[env] ${feature} is switched off, missing: ${missing.join(", ")}`);
  }
  return present.length === keys.length;
}

/**
 * Optional features. When their keys are missing the app keeps working and
 * the feature is simply switched off (uploads hidden, emails/pushes skipped).
 */
export const features: Record<Feature, boolean> = {
  storage: isFeatureOn("storage"),
  email: isFeatureOn("email"),
  push: isFeatureOn("push"),
};

/** Read a variable the app cannot work without. Throws a clear error if it is missing. */
export function requireEnv<K extends EnvKey>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null) {
    throw new Error(`${key} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}
