import { z } from "zod";

import { AREA_STATUSES, CITIES, isInPakistan } from "@/lib/areas";
import { objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

export const MAX_MONTHLY_FEE = 100_000;

export const areaFormSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  city: z.enum(CITIES),
  description: z.string().trim().max(500, "descriptionTooLong"),
  // Whole rupees.
  defaultMonthlyFee: z
    .number({ error: "feeInvalid" })
    .int("feeWholeRupees")
    .min(0, "feeInvalid")
    .max(MAX_MONTHLY_FEE, "feeInvalid"),
});

export const updateAreaSchema = areaFormSchema.extend({ id: objectIdSchema });

export const setAreaStatusSchema = z.object({
  id: objectIdSchema,
  status: z.enum(AREA_STATUSES),
});

/** Search params on the Areas page. Bad values fall back to defaults. */
export const listAreasSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(AREA_STATUSES).catch("active"),
});

export const blockFormSchema = z.object({
  name: z.string().trim().min(1, "required").max(60, "nameTooLong"),
});

export const createBlockSchema = blockFormSchema.extend({ areaId: objectIdSchema });
export const updateBlockSchema = blockFormSchema.extend({ id: objectIdSchema });

export const locationSchema = z
  .object({
    lat: z.number({ error: "invalidLocation" }).min(-90, "invalidLocation").max(90, "invalidLocation"),
    lng: z.number({ error: "invalidLocation" }).min(-180, "invalidLocation").max(180, "invalidLocation"),
  })
  .refine((point) => isInPakistan(point.lat, point.lng), "locationOutsidePakistan");

export const streetFormSchema = z.object({
  blockId: objectIdSchema,
  name: z.string().trim().min(1, "required").max(80, "nameTooLong"),
  supervisorId: objectIdSchema.nullable(),
  location: locationSchema.nullable(),
});

export const createStreetSchema = streetFormSchema;
export const updateStreetSchema = streetFormSchema.extend({ id: objectIdSchema });

export const teamMemberSchema = z.object({
  areaId: objectIdSchema,
  userId: objectIdSchema,
});

export type AreaFormInput = z.input<typeof areaFormSchema>;
export type UpdateAreaInput = z.input<typeof updateAreaSchema>;
export type ListAreasInput = z.infer<typeof listAreasSchema>;
export type BlockFormInput = z.input<typeof blockFormSchema>;
export type CreateBlockInput = z.input<typeof createBlockSchema>;
export type UpdateBlockInput = z.input<typeof updateBlockSchema>;
export type StreetFormInput = z.input<typeof streetFormSchema>;
export type UpdateStreetInput = z.input<typeof updateStreetSchema>;
export type TeamMemberInput = z.input<typeof teamMemberSchema>;
