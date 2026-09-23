const BIP39_COUNTS = new Set([12, 15, 18, 21, 24]);
const HEX64 = /(?:^|[^0-9a-f])([0-9a-f]{64})(?:[^0-9a-f]|$)/i;
const WIF_LIKE = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,52}\b/;
const SECRET_WORDS =
  /\b(seed phrase|secret phrase|recovery phrase|mnemonic(?:\s+phrase)?|private key|privkey|wallet dump|paypal[_-]?client[_-]?(id|secret)|PAYPAL_CLIENT_(ID|SECRET))\b/i;

export function looksLikeSecretMaterial(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (SECRET_WORDS.test(text)) return true;
  if (HEX64.test(text.replace(/^0x/i, ""))) return true;
  if (WIF_LIKE.test(text)) return true;
  const words = text.toLowerCase().split(/[\s,]+/).filter((word) => /^[a-z]+$/.test(word));
  if (BIP39_COUNTS.has(words.length) && words.every((word) => word.length >= 3 && word.length <= 8)) {
    return true;
  }
  return false;
}

export function assertNoSecretMaterial(value: string, field = "input"): void {
  if (looksLikeSecretMaterial(value)) {
    throw new SecretMaterialError(
      `PoolIndex does not accept seed phrases, private keys, or recovery secrets in ${field}.`,
    );
  }
}

export class SecretMaterialError extends Error {
  readonly code = "SECRET_MATERIAL_REJECTED" as const;
  constructor(message: string) {
    super(message);
    this.name = "SecretMaterialError";
  }
}
