"use server";

import type { ExpenseStatus } from "@/lib/expenses";
import type { ActionResult } from "@/lib/action-result";
import type { ExpenseFormInput, ReviewExpenseInput, UpdateExpenseInput } from "@/lib/validators/expenses";
import { createExpense, reviewExpense, updateExpense } from "@/server/expenses";
import { runMutation } from "@/server/run-action";

// Expense actions, shared by the admin, supervisor and committee screens.
// Every permission and area check lives in src/server/expenses.ts.

export async function createExpenseAction(input: ExpenseFormInput): Promise<ActionResult<{ id: string; status: ExpenseStatus }>> {
  return runMutation(() => createExpense(input));
}

export async function updateExpenseAction(input: UpdateExpenseInput): Promise<ActionResult<{ status: ExpenseStatus }>> {
  return runMutation(() => updateExpense(input));
}

export async function reviewExpenseAction(input: ReviewExpenseInput): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await reviewExpense(input);
    return null;
  });
}
