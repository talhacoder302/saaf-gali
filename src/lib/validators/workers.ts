import { z } from "zod";

import { normalizeCnic, WORKER_STATUSES } from "@/lib/duties";
import { isValidDay } from "@/lib/expenses";
import { optionalMobileSchema } from "@/lib/mobile";
import { MONTH_REGEX } from "@/lib/months";
import { passwordSchema } from "@/lib/validators/auth";
import { objectIdSchema } from "@/lib/validators/users";

// Messages are keys under "errors" in the i18n files.

export const MAX_SALARY = 1_000_000;

/** Optional CNIC: "" means none; 13 digits with or without dashes become "12345-1234567-1". */
export const optionalCnicSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const cnic = normalizeCnic(value);
    if (!cnic) {
      ctx.addIssue({ code: "custom", message: "invalidCnic" });
      return z.NEVER;
    }
    return cnic;
  });

const workerFieldsSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  mobile: optionalMobileSchema,
  cnic: optionalCnicSchema,
  address: z.string().trim().max(200, "addressTooLong"),
  // Whole rupees.
  monthlySalary: z.number({ error: "salaryInvalid" }).int("salaryInvalid").min(0, "salaryInvalid").max(MAX_SALARY, "salaryInvalid"),
  // "YYYY-MM-DD"; not in the future (checked in the service against today).
  joiningDate: z.string().refine(isValidDay, "invalidDate"),
  areaIds: z.array(objectIdSchema).min(1, "areaRequired").max(20),
});

/**
 * Add / edit form. `createLogin` (add only) makes a worker account with the
 * worker's mobile and `password` as a temporary password.
 */
export const workerFormSchema = workerFieldsSchema
  .extend({ createLogin: z.boolean(), password: z.string() })
  .superRefine((data, ctx) => {
    if (!data.createLogin) return;
    if (!data.mobile) ctx.addIssue({ code: "custom", path: ["mobile"], message: "mobileNeededForLogin" });
    const password = passwordSchema.safeParse(data.password);
    if (!password.success) ctx.addIssue({ code: "custom", path: ["password"], message: password.error.issues[0]?.message ?? "invalid" });
  });

export const updateWorkerSchema = workerFieldsSchema.extend({ id: objectIdSchema });

export const setWorkerStatusSchema = z.object({ id: objectIdSchema, status: z.enum(WORKER_STATUSES) });

export const workerLoginSchema = z.object({ workerId: objectIdSchema, password: passwordSchema });

/** Search params on the Workers page. Bad values fall back to defaults. */
export const listWorkersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  areaId: objectIdSchema.optional().catch(undefined),
  status: z.enum(WORKER_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const attendanceQuerySchema = z.object({
  month: z.string().regex(MONTH_REGEX).optional().catch(undefined),
});

export type WorkerFormInput = z.input<typeof workerFormSchema>;
export type WorkerFormOutput = z.output<typeof workerFormSchema>;
export type UpdateWorkerInput = z.input<typeof updateWorkerSchema>;
export type WorkerLoginInput = z.input<typeof workerLoginSchema>;
export type ListWorkersInput = z.infer<typeof listWorkersSchema>;
