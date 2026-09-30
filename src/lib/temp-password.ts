// No 0/O or 1/l/I, so it can be read out over the phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomIndex(max: number): number {
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

/** Readable temporary password for admins to hand out, e.g. "k7Qm-4xTa". Works in the browser and on the server. */
export function generateTemporaryPassword(): string {
  const pick = (length: number) => Array.from({ length }, () => ALPHABET[randomIndex(ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}
