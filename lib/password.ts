import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

function scryptN(): number {
  const raw = Number(process.env.POOLINDEX_SCRYPT_N || 16384);
  if (!Number.isFinite(raw) || raw < 2) return 16384;
  return raw;
}

export async function hashPassword(password: string): Promise<string> {
  const n = scryptN();
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64, { N: n, r: 8, p: 1 })) as Buffer;
  return `scrypt$${n}$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![n, r, p].every((value) => Number.isFinite(value) && value > 0)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (!salt.length || expected.length < 16) return false;
  const actual = (await scrypt(password, salt, expected.length, { N: n, r, p })) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function newId(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
