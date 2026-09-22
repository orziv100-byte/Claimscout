import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SEC = 30;
const DIGITS = 6;

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPH.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SEC);
}

export function totpCode(secretBase32: string, step = totpStep()): string {
  return hotp(base32Decode(secretBase32), step);
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { now?: number; lastStep?: number | null } = {},
): { ok: true; step: number } | { ok: false; reason: "invalid" | "reused" } {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return { ok: false, reason: "invalid" };
  const step = totpStep(opts.now ?? Date.now());
  const secret = base32Decode(secretBase32);
  for (const candidate of [step, step - 1, step + 1]) {
    const expected = hotp(secret, candidate);
    const a = Buffer.from(expected);
    const b = Buffer.from(trimmed);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      if (opts.lastStep != null && candidate === opts.lastStep) return { ok: false, reason: "reused" };
      return { ok: true, step: candidate };
    }
  }
  return { ok: false, reason: "invalid" };
}

export function otpauthUrl(email: string, secret: string, issuer = "PoolIndex"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SEC}`;
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}
