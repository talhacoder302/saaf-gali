import "server-only";

import { z } from "zod";

import { features } from "@/lib/env";

export const NOTIFICATION_CHANNELS = ["in_app", "email", "push", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// Later modules add their own types here.
export const NOTIFICATION_TYPES = [
  "general",
  "duty_assigned",
  "work_reviewed",
  "complaint_update",
  "fee_due",
  "payment_received",
  "expense_approval",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notifySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000),
  link: z.string().trim().optional(),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).default(["in_app"]),
});

export type NotifyInput = z.input<typeof notifySchema>;

export type NotifyResult = {
  sent: NotificationChannel[];
  skipped: NotificationChannel[];
};

function isChannelAvailable(channel: NotificationChannel): boolean {
  switch (channel) {
    case "email":
      return features.email;
    case "push":
      return features.push;
    case "in_app":
    case "whatsapp":
      return true;
  }
}

/**
 * The single entry point for every notification in the app.
 * Pages and services never call email or push directly; they call notify().
 *
 * For now this only logs. Later modules add the in-app, email (Resend),
 * web push and WhatsApp share link channels here.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const data = notifySchema.parse(input);

  const skipped = data.channels.filter((channel) => !isChannelAvailable(channel));
  const wanted = data.channels.filter((channel) => isChannelAvailable(channel));

  console.info("[notify]", {
    type: data.type,
    userIds: data.userIds,
    title: data.title,
    body: data.body,
    link: data.link,
    channels: wanted,
    skipped,
  });

  // Nothing is delivered yet, so every channel counts as skipped.
  return { sent: [], skipped: data.channels };
}
