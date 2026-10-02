import { formatRupees } from "@/lib/format";
import { describeMonths } from "@/lib/months";
import { whatsappLink } from "@/lib/whatsapp";

// WhatsApp texts for residents, in Roman Urdu (works on every phone keyboard).

export type ReceiptMessageInput = {
  organisation: string;
  name: string;
  amount: number;
  months: string[];
  receiptNumber: string;
  receiptUrl: string;
};

export function receiptMessage(input: ReceiptMessageInput): string {
  return [
    `Assalam-o-Alaikum ${input.name}!`,
    `Aap ki safai fee ${formatRupees(input.amount)} wusool ho gayi hai (${describeMonths(input.months)}).`,
    `Receipt number: ${input.receiptNumber}`,
    `Receipt dekhne ke liye: ${input.receiptUrl}`,
    `Shukriya - ${input.organisation}`,
  ].join("\n");
}

export type ReminderMessageInput = {
  organisation: string;
  name: string;
  houseNumber: string;
  street: string;
  amount: number;
  months: string[];
};

export function reminderMessage(input: ReminderMessageInput): string {
  return [
    `Assalam-o-Alaikum ${input.name},`,
    `Ghar number ${input.houseNumber}, ${input.street} ki safai fee ${formatRupees(input.amount)} (${describeMonths(input.months)}) abhi baqi hai.`,
    "Meharbani farma kar jald ada kar dein. Agar ada kar chuke hain to is message ko nazar andaz kar dein.",
    `Shukriya - ${input.organisation}`,
  ].join("\n");
}

export function receiptWhatsappLink(input: ReceiptMessageInput, mobile: string | null): string {
  return whatsappLink(receiptMessage(input), mobile ?? undefined);
}

export function reminderWhatsappLink(input: ReminderMessageInput, mobile: string | null): string {
  return whatsappLink(reminderMessage(input), mobile ?? undefined);
}
