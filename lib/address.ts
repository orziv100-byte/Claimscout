import { getAddress, type Address } from "viem";
import { looksLikeSecretMaterial } from "./secrets-guard.ts";

export function isHexAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export type PublicAddressResult =
  | { ok: true; address: Address }
  | { ok: false; error: string };

const INVALID_PUBLIC_ADDRESS =
  "Enter a 0x-prefixed Ethereum address. Seed phrases and private keys are rejected.";

export function parsePublicAddress(value: string): PublicAddressResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Enter a public 0x Ethereum address." };
  if (looksLikeSecretMaterial(trimmed) || !isHexAddress(trimmed)) {
    return { ok: false, error: INVALID_PUBLIC_ADDRESS };
  }
  try {
    return { ok: true, address: getAddress(trimmed) };
  } catch {
    return { ok: true, address: getAddress(trimmed.toLowerCase() as Address) };
  }
}

/** Pasting a public 0x address is always read-only. Injected connect is only for an empty field. */
export function walletSubmitIntent(input: string, action: "check" | "connect"): "readonly" | "injected" | "invalid" | "empty" {
  const trimmed = input.trim();
  if (!trimmed) return action === "connect" ? "injected" : "empty";
  return parsePublicAddress(trimmed).ok ? "readonly" : "invalid";
}
