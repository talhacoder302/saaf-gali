import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const MAX_FAILED_LOGINS = 5;

// One document per failed login. MongoDB deletes them automatically after the
// window, so counting the documents for a mobile gives the recent failures.
const loginAttemptSchema = new Schema({
  mobile: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: LOGIN_WINDOW_SECONDS },
});

export type LoginAttemptDoc = InferSchemaType<typeof loginAttemptSchema>;

export const LoginAttempt: Model<LoginAttemptDoc> =
  (models.LoginAttempt as Model<LoginAttemptDoc> | undefined) ??
  model<LoginAttemptDoc>("LoginAttempt", loginAttemptSchema);
