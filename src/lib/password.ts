import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the mobile number is unknown, so a wrong mobile takes
// as long as a wrong password and does not reveal which numbers exist.
let dummyHash: Promise<string> | null = null;

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("not-a-real-password", ROUNDS);
  await bcrypt.compare(password, await dummyHash);
}
