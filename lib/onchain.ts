import { createPublicClient, formatUnits, getAddress, http, type Address, type Hex } from "viem";
import { arbitrum, mainnet } from "viem/chains";
import { CATALOG } from "./catalog";
import { catalogCheckKind } from "./eligibility-status";
import { erc20Balance, erc20TotalSupply } from "./engine/rpc";
import { readResourceSnapshot } from "./resource-guard";
import type { CatalogClaim, EligibilityResult } from "./types";

const claimedAbi = [
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const hasClaimedAbi = [
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const claimableTokensAbi = [
  {
    type: "function",
    name: "claimableTokens",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
  42161: process.env.ARB_RPC_URL || "https://arbitrum-one-rpc.publicnode.com",
};

function clientFor(chainId: number) {
  const url = RPC[chainId];
  if (!url) return null;
  const chain = chainId === 42161 ? arbitrum : mainnet;
  return createPublicClient({ chain, transport: http(url, { timeout: 10_000 }) });
}

function toAddress(value: string): Address {
  return getAddress(value.toLowerCase() as Address);
}

const WALLET_CHECK_CLAIMS = () => CATALOG.filter((claim) => claim.id !== "tornado-avoided");

function result(
  claimId: string,
  address: Address,
  status: EligibilityResult["status"],
  detail: string,
  extra: Partial<EligibilityResult> = {},
): EligibilityResult {
  return { claimId, address, status, detail, ...extra };
}

export type PoolSnapshot = {
  claimId: string;
  remaining?: string;
  symbol?: string;
  error?: string;
};

export async function readRemainingPool(claimId: string): Promise<PoolSnapshot> {
  const claim = CATALOG.find((c) => c.id === claimId);
  if (!claim?.onChain?.token) {
    return { claimId, error: "No token configured" };
  }
  const spec = claim.onChain;
  const tokenAddr = spec.token;
  if (!tokenAddr) return { claimId, error: "No token configured" };

  if (!spec.remainingMethod) {
    return {
      claimId,
      error: `Unsupported: ${claimId} has a token address but no declared remaining-pool method.`,
    };
  }
  if (spec.remainingMethod === "unsupported") {
    return {
      claimId,
      error:
        spec.remainingUnsupportedReason ||
        `Unsupported: no reliable remaining-pool method for ${claimId}.`,
    };
  }
  if (!RPC[spec.chainId]) {
    return { claimId, error: `No public RPC for this chain` };
  }

  try {
    if (spec.remainingMethod === "token_total_supply") {
      const { raw, decimals, symbol } = await erc20TotalSupply(spec.chainId, toAddress(tokenAddr), {
        symbol: claim.asset,
      });
      return { claimId, remaining: formatUnits(raw, decimals), symbol };
    }

    if (spec.remainingMethod === "token_balance_of_holder") {
      if (!spec.distributor) {
        return {
          claimId,
          error: `Unsupported: ${claimId} remaining method is token_balance_of_holder but no holder/distributor is declared.`,
        };
      }
      const { raw, decimals, symbol } = await erc20Balance(
        spec.chainId,
        toAddress(tokenAddr),
        toAddress(spec.distributor),
        { symbol: claim.asset },
      );
      return { claimId, remaining: formatUnits(raw, decimals), symbol };
    }

    return { claimId, error: `Unsupported: unknown remaining-pool method for ${claimId}.` };
  } catch (err) {
    return { claimId, error: err instanceof Error ? err.message.split("\n")[0] : "RPC read failed" };
  }
}

export async function checkEligibility(claimId: string, address: Address): Promise<EligibilityResult> {
  const claim = CATALOG.find((c) => c.id === claimId);
  if (!claim) {
    return result(claimId, address, "unable_to_verify", "Unknown claim id.", { checkKind: "catalog_only" });
  }

  const officialCheckerUrl = claim.officialUrl;
  const checkKind = catalogCheckKind(claim);
  const base = { officialCheckerUrl, checkKind };

  if (checkKind === "catalog_only") {
    return result(claimId, address, "unable_to_verify", catalogOnlyReason(claim), base);
  }

  const spec = claim.onChain;
  if (!spec?.distributor || !spec.claimedFn) {
    return result(claimId, address, "unable_to_verify", catalogOnlyReason(claim), base);
  }

  const client = clientFor(spec.chainId);
  if (!client) {
    return result(
      claimId,
      address,
      "unable_to_verify",
      `No public RPC is configured for ${spec.chainLabel}, so this address cannot be verified on-chain.`,
      base,
    );
  }

  const distributor = toAddress(spec.distributor);

  try {
    const code = await client.getCode({ address: distributor });
    if (!code || code === "0x") {
      return result(
        claimId,
        address,
        "unable_to_verify",
        "The configured distributor currently has no contract code, so this address cannot be verified on-chain.",
        base,
      );
    }

    if (spec.claimedFn === "claimableTokens") {
      const amount = (await client.readContract({
        address: distributor,
        abi: claimableTokensAbi,
        functionName: "claimableTokens",
        args: [address],
      })) as bigint;
      if (amount > BigInt(0)) {
        return result(
          claimId,
          address,
          "eligible",
          `Distributor reports ${amount.toString()} claimable raw units for this address. Remaining contract token balance is not used for this result.`,
          base,
        );
      }
      return result(
        claimId,
        address,
        "unable_to_verify",
        "Distributor reports 0 claimable tokens. That does not distinguish never-eligible from already claimed, so this app does not invent a verdict.",
        base,
      );
    }

    const abi = spec.claimedFn === "hasClaimed" ? hasClaimedAbi : claimedAbi;
    const fn = spec.claimedFn === "hasClaimed" ? "hasClaimed" : "claimed";
    const already = (await client.readContract({
      address: distributor,
      abi,
      functionName: fn,
      args: [address],
    })) as boolean;

    if (already) {
      return result(
        claimId,
        address,
        "already_claimed",
        "On-chain mapping says this address has already claimed.",
        base,
      );
    }

    return result(
      claimId,
      address,
      "unable_to_verify",
      "On-chain mapping is not marked claimed. That is not proof of snapshot inclusion, so eligibility is unverified.",
      base,
    );
  } catch (err) {
    return result(
      claimId,
      address,
      "unable_to_verify",
      `Read-only address check failed (${err instanceof Error ? err.message : "RPC error"}). No eligibility verdict was invented.`,
      base,
    );
  }
}

function catalogOnlyReason(claim: CatalogClaim): string {
  if (claim.kind === "puzzle") {
    return "Public puzzle documented only. PoolIndex will not check keys or attempt a solve, so wallet eligibility cannot be verified.";
  }
  if (claim.chain !== "ethereum" && claim.chain !== "arbitrum") {
    return `This offer is catalogued on ${claim.chain}, which has no address-level checker in Wallet Check.`;
  }
  if (claim.onChain?.token && !claim.onChain.claimedFn) {
    return "No address-level on-chain checker is available. Remaining distributor token balance is catalog information only and is not wallet eligibility.";
  }
  return "No address-level on-chain checker is wired for this offer. Use the official claim page; this app stays read-only.";
}

export async function scanCatalogEligibility(
  address: Address,
  overlay: EligibilityResult[] = [],
): Promise<EligibilityResult[]> {
  const claims = WALLET_CHECK_CLAIMS();
  const byId = new Map(overlay.map((row) => [row.claimId, row]));
  const eligibility: EligibilityResult[] = [];
  let stopped: string | null = null;
  for (const claim of claims) {
    const overlayRow = byId.get(claim.id);
    if (overlayRow) {
      eligibility.push(overlayRow);
      continue;
    }
    const snap = readResourceSnapshot();
    if (stopped || snap.level === "critical") {
      stopped = stopped || snap.message;
      eligibility.push(
        result(
          claim.id,
          address,
          "unable_to_verify",
          `Eligibility scan stopped to protect this machine: ${stopped}`,
          { checkKind: catalogCheckKind(claim) },
        ),
      );
      continue;
    }
    eligibility.push(await checkEligibility(claim.id, address));
  }
  return eligibility;
}

export async function scanCatalogPools(): Promise<PoolSnapshot[]> {
  const targets = CATALOG.filter((c) => c.onChain?.token);
  const out: PoolSnapshot[] = [];
  for (const claim of targets) {
    const snap = readResourceSnapshot();
    if (snap.level === "critical") {
      out.push({
        claimId: claim.id,
        error: `Pool scan stopped: ${snap.message}`,
      });
      break;
    }
    out.push(await readRemainingPool(claim.id));
  }
  return out;
}

export { isHexAddress } from "./address";

export function asHexData(data: string): Hex {
  return data as Hex;
}
