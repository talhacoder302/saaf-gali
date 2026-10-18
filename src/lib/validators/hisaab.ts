import { z } from "zod";

import { MAX_SLUG_LENGTH, SLUG_REGEX } from "@/lib/hisaab";
import { MONTH_REGEX } from "@/lib/months";
import { objectIdSchema } from "@/lib/validators/users";

// Search params on the hisaab pages. Bad values fall back to defaults
// (newest month, first area) instead of failing.

const monthParam = z.string().regex(MONTH_REGEX).optional().catch(undefined);

export const hisaabQuerySchema = z.object({
  area: objectIdSchema.optional().catch(undefined),
  month: monthParam,
});

export const publicHisaabQuerySchema = z.object({ month: monthParam });

export const areaSlugSchema = z.string().max(MAX_SLUG_LENGTH).regex(SLUG_REGEX);

export type HisaabQuery = z.infer<typeof hisaabQuerySchema>;
