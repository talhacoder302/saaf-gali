"use server";

import type { ActionResult } from "@/lib/action-result";
import type { CancelPaymentInput, GenerateBillsInput } from "@/lib/validators/fees";
import { generateBills } from "@/server/billing";
import type { GenerateResult } from "@/server/billing-core";
import { cancelPayment } from "@/server/payments";
import { runMutation } from "@/server/run-action";

export async function generateBillsAction(input: GenerateBillsInput): Promise<ActionResult<GenerateResult>> {
  return runMutation(() => generateBills(input));
}

export async function cancelPaymentAction(input: CancelPaymentInput): Promise<ActionResult<null>> {
  return runMutation(async () => {
    await cancelPayment(input);
    return null;
  });
}
