"use server";

import type { ActionResult } from "@/lib/action-result";
import type { RecordPaymentInput } from "@/lib/validators/fees";
import {
  getPaymentContext,
  recordPayment,
  searchHouseholdsForPayment,
  type PaymentContext,
  type PaymentSearchRow,
  type RecordedPayment,
} from "@/server/payments";
import { runAction, runMutation } from "@/server/run-action";

// Collect-payment actions, shared by the admin and supervisor screens.
// Every permission and area check lives in src/server/payments.ts.

export async function searchHouseholdsAction(query: string): Promise<ActionResult<PaymentSearchRow[]>> {
  return runAction(() => searchHouseholdsForPayment(query));
}

export async function paymentContextAction(householdId: string): Promise<ActionResult<PaymentContext>> {
  return runAction(() => getPaymentContext(householdId));
}

export async function recordPaymentAction(input: RecordPaymentInput): Promise<ActionResult<RecordedPayment>> {
  return runMutation(() => recordPayment(input));
}
