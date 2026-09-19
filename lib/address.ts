import type { Address } from "viem";

export function isHexAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
