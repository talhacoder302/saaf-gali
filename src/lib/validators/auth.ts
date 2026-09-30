import { z } from "zod";

import { LOCALES } from "@/i18n/config";
import { mobileSchema } from "@/lib/mobile";

// Messages are keys under "errors" in the i18n files.

export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "passwordTooShort")
  // bcrypt only looks at the first 72 bytes.
  .max(72, "passwordTooLong");

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "required").max(200, "passwordTooLong"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required").max(200, "passwordTooLong"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordsDontMatch",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "passwordSameAsOld",
  });

export const languageSchema = z.object({
  language: z.enum(LOCALES),
});

export type LoginInput = z.input<typeof loginSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type LanguageInput = z.input<typeof languageSchema>;
