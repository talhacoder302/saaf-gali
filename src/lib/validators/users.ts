import { z } from "zod";

import { LOCALES } from "@/i18n/config";
import { mobileSchema } from "@/lib/mobile";
import { ROLES, roleAllowsManyAreas, roleNeedsArea, type Role } from "@/lib/roles";
import { passwordSchema } from "@/lib/validators/auth";

// Messages are keys under "errors" in the i18n files.

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "invalid");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "invalidEmail")
  .refine((value) => value === "" || z.email().safeParse(value).success, "invalidEmail");

const userBaseSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  mobile: mobileSchema,
  email: emailSchema,
  role: z.enum(ROLES),
  areaIds: z.array(objectIdSchema).max(50),
  language: z.enum(LOCALES),
});

function checkAreas(data: { role: Role; areaIds: string[] }, ctx: z.RefinementCtx) {
  if (roleNeedsArea(data.role) && data.areaIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["areaIds"], message: "areaRequired" });
  }
  if (!roleAllowsManyAreas(data.role) && data.areaIds.length > 1) {
    ctx.addIssue({ code: "custom", path: ["areaIds"], message: "oneAreaOnly" });
  }
}

export const createUserSchema = userBaseSchema.extend({ password: passwordSchema }).superRefine(checkAreas);

/**
 * The edit form. Same shape as the create form so one form component serves
 * both; the password field is simply ignored when editing.
 */
export const editUserFormSchema = userBaseSchema.extend({ password: z.string() }).superRefine(checkAreas);

export const updateUserSchema = userBaseSchema.extend({ id: objectIdSchema }).superRefine(checkAreas);

export const resetPasswordSchema = z.object({
  id: objectIdSchema,
  password: passwordSchema,
});

export const USER_STATUSES = ["active", "disabled"] as const;

export const setUserStatusSchema = z.object({
  id: objectIdSchema,
  status: z.enum(USER_STATUSES),
});

export const USERS_PAGE_SIZE = 20;

/** Search params on the Users page. Bad values fall back to defaults. */
export const listUsersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(ROLES).optional().catch(undefined),
  status: z.enum(USER_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
