import "server-only";

import { connectDB } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import {
  changePasswordSchema,
  languageSchema,
  type ChangePasswordInput,
  type LanguageInput,
} from "@/lib/validators/auth";
import { User } from "@/models/User";
import { logActivity } from "@/server/activity";
import { ServiceError } from "@/server/errors";

/** The signed-in user changes their own password (also used for the forced change). */
export async function changeOwnPassword(input: ChangePasswordInput): Promise<{ role: Role }> {
  const actor = await requireUser({ allowPendingPasswordChange: true });
  const data = changePasswordSchema.parse(input);
  await connectDB();

  const user = await User.findById(actor.id).select("+passwordHash").lean();
  if (!user) throw new ServiceError("not_found");
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new ServiceError("wrong_password", { currentPassword: "wrongPassword" });
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: await hashPassword(data.newPassword), mustChangePassword: false },
      // Logs out every other device; the caller refreshes this session.
      $inc: { sessionVersion: 1 },
    },
  );

  await logActivity({ actorId: actor.id, action: "password_change", entity: "User", entityId: user._id });
  return { role: actor.role };
}

/** The signed-in user picks their language. */
export async function updateOwnLanguage(input: LanguageInput): Promise<void> {
  const actor = await requireUser({ allowPendingPasswordChange: true });
  const data = languageSchema.parse(input);
  if (data.language === actor.language) return;
  await connectDB();

  await User.updateOne({ _id: actor.id }, { $set: { language: data.language } });
  await logActivity({
    actorId: actor.id,
    action: "update",
    entity: "User",
    entityId: actor.id,
    meta: { changes: ["language"] },
  });
}
