import { z } from "zod";

import { HOUSEHOLD_STATUSES, OCCUPANT_TYPES } from "@/lib/households";
import { optionalMobileSchema } from "@/lib/mobile";
import { MAX_MONTHLY_FEE } from "@/lib/validators/areas";
import { passwordSchema } from "@/lib/validators/auth";
import { emailSchema, objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

export const houseNumberSchema = z.string().trim().min(1, "required").max(20, "houseNumberTooLong");

export const monthlyFeeSchema = z
  .number({ error: "feeInvalid" })
  .int("feeWholeRupees")
  .min(0, "feeInvalid")
  .max(MAX_MONTHLY_FEE, "feeInvalid");

export const householdFormSchema = z.object({
  streetId: z.string().regex(/^[a-f\d]{24}$/i, "chooseStreet"),
  houseNumber: houseNumberSchema,
  ownerName: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  occupantType: z.enum(OCCUPANT_TYPES),
  contactName: z.string().trim().max(80, "nameTooLong"),
  mobile: optionalMobileSchema,
  email: emailSchema,
  monthlyFee: monthlyFeeSchema,
  status: z.enum(HOUSEHOLD_STATUSES),
  notes: z.string().trim().max(500, "notesTooLong"),
});

export const updateHouseholdSchema = householdFormSchema.extend({ id: objectIdSchema });

/** Search params on the Households page. Bad values fall back to defaults. */
export const listHouseholdsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  areaId: objectIdSchema.optional().catch(undefined),
  blockId: objectIdSchema.optional().catch(undefined),
  streetId: objectIdSchema.optional().catch(undefined),
  status: z.enum(HOUSEHOLD_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const residentLoginSchema = z.object({
  householdId: objectIdSchema,
  password: passwordSchema,
});

export type HouseholdFormInput = z.input<typeof householdFormSchema>;
export type HouseholdFormOutput = z.output<typeof householdFormSchema>;
export type UpdateHouseholdInput = z.input<typeof updateHouseholdSchema>;
export type ListHouseholdsInput = z.infer<typeof listHouseholdsSchema>;
export type ResidentLoginInput = z.input<typeof residentLoginSchema>;
