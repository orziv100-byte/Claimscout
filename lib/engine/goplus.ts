import { cached, fetchWithTimeout, readJsonLimited } from "../http.ts";

const GOPLUS_CHAINS = new Set([1, 10, 137, 42161, 8453]);

export type ContractSecurity = {
  source: "goplus";
  available: boolean;
  chainId: number;
  contract?: string;
  honeypot?: boolean;
  mintable?: boolean;
  ownerRenounced?: boolean;
  canTakeBackOwnership?: boolean;
  blacklist?: boolean;
  detail: string;
};

function flag(value: unknown): boolean | undefined {
  if (value === "1" || value === 1 || value === true) return true;
  if (value === "0" || value === 0 || value === false) return false;
  return undefined;
}

function isZeroAddress(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  return /^0x0+$/i.test(value.trim());
}

export function parseGoPlusToken(chainId: number, contract: string, raw: unknown): ContractSecurity {
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = payload.result;
  const rows = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const row = rows[contract.toLowerCase()];
  if (!row || typeof row !== "object") {
    return {
      source: "goplus",
      available: false,
      chainId,
      contract,
      detail: "GoPlus did not return a token-security row. No safety verdict was invented.",
    };
  }
  const token = row as Record<string, unknown>;
  return {
    source: "goplus",
    available: true,
    chainId,
    contract,
    honeypot: flag(token.is_honeypot),
    mintable: flag(token.is_mintable),
    ownerRenounced: isZeroAddress(token.owner_address) ? true : undefined,
    canTakeBackOwnership: flag(token.can_take_back_ownership),
    blacklist: flag(token.is_blacklisted) ?? flag(token.can_blacklist),
    detail:
      "GoPlus Labs token-security snapshot. Third-party signals only — not a PoolIndex guarantee that a contract is safe or unsafe.",
  };
}

export async function loadGoPlusTokenSecurity(chainId: number, contract: string): Promise<ContractSecurity> {
  if (!GOPLUS_CHAINS.has(chainId)) {
    return {
      source: "goplus",
      available: false,
      chainId,
      contract,
      detail: `GoPlus token security is not mapped for chain ${chainId}. No verdict invented.`,
    };
  }
  const address = contract.toLowerCase();
  const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
  return cached(`goplus:${chainId}:${address}`, 24 * 60 * 60 * 1000, async () => {
    try {
      const res = await fetchWithTimeout(url, 8_000, { headers: { accept: "application/json" } });
      if (!res.ok) {
        return {
          source: "goplus",
          available: false,
          chainId,
          contract: address,
          detail: `GoPlus HTTP ${res.status}. Missing flags omitted, not shown as safe.`,
        };
      }
      const json = await readJsonLimited(res, 80_000);
      return parseGoPlusToken(chainId, address, json);
    } catch {
      return {
        source: "goplus",
        available: false,
        chainId,
        contract: address,
        detail: "GoPlus request failed. No safety verdict was invented.",
      };
    }
  });
}
