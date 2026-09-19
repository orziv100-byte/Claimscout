import { createPublicClient, formatUnits, http, type Address, type Hex } from "viem";
import { arbitrum, mainnet } from "viem/chains";
import { CATALOG } from "./catalog";
import { readResourceSnapshot } from "./resource-guard";
import type { EligibilityResult } from "./types";

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

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
  const client = clientFor(spec.chainId);
  if (!client) return { claimId, error: "No public RPC for this chain" };

  const holder = (spec.distributor || spec.token) as Address;
  const token = spec.token as Address;

  try {
    const [raw, decimals, symbol] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [holder] }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    ]);
    return {
      claimId,
      remaining: formatUnits(raw, decimals),
      symbol,
    };
  } catch (err) {
    return { claimId, error: err instanceof Error ? err.message : "RPC read failed" };
  }
}

export async function checkEligibility(claimId: string, address: Address): Promise<EligibilityResult> {
  const claim = CATALOG.find((c) => c.id === claimId);
  if (!claim) {
    return {
      claimId,
      address,
      status: "unknown",
      detail: "Unknown claim id.",
    };
  }

  const officialCheckerUrl = claim.officialUrl;

  if (claim.status === "expired") {
    return {
      claimId,
      address,
      status: "window_closed",
      detail: claim.action.type === "none" ? claim.action.reason : "The official claim window is closed.",
      officialCheckerUrl,
    };
  }

  if (claim.status === "archived") {
    return {
      claimId,
      address,
      status: "ineligible",
      detail: "This is an archive reference, not a live claim.",
      officialCheckerUrl,
    };
  }

  if (claim.kind === "puzzle") {
    return {
      claimId,
      address,
      status: "unknown",
      detail:
        "Public puzzle documented only. Poolindex will not check keys or attempt a solve. Eligibility is whoever first produces a valid solution — not this wallet check.",
      officialCheckerUrl,
    };
  }

  const spec = claim.onChain;
  if (!spec) {
    return {
      claimId,
      address,
      status: "unknown",
      detail:
        "No address-level on-chain checker is wired for this offer. Use the official claim page; this app stays read-only.",
      officialCheckerUrl,
    };
  }

  const client = clientFor(spec.chainId);
  let remainingPool: string | undefined;
  let remainingSymbol: string | undefined;
  if (client && spec.token) {
    const pool = await readRemainingPool(claimId);
    remainingPool = pool.remaining;
    remainingSymbol = pool.symbol;
  }

  if (spec.claimDeadline) {
    const deadline = Date.parse(spec.claimDeadline);
    if (!Number.isNaN(deadline) && Date.now() > deadline) {
      return {
        claimId,
        address,
        status: "window_closed",
        detail: `On-chain deadline ${spec.claimDeadline} has passed.`,
        remainingPool,
        remainingSymbol,
        officialCheckerUrl,
      };
    }
  }

  if (!client || !spec.distributor || !spec.claimedFn) {
    return {
      claimId,
      address,
      status: "unknown",
      detail:
        remainingPool && remainingSymbol
          ? `Distributor still holds ${trimAmount(remainingPool)} ${remainingSymbol}. Individual eligibility needs the official merkle/snapshot checker.`
          : "Connect the official checker to see if this address is in the snapshot. Poolindex does not reconstruct merkle proofs.",
      remainingPool,
      remainingSymbol,
      officialCheckerUrl,
    };
  }

  try {
    if (spec.claimedFn === "claimableTokens") {
      const amount = (await client.readContract({
        address: spec.distributor,
        abi: claimableTokensAbi,
        functionName: "claimableTokens",
        args: [address],
      })) as bigint;
      if (amount > BigInt(0)) {
        return {
          claimId,
          address,
          status: "eligible",
          detail: `Distributor reports ${amount.toString()} claimable raw units for this address.`,
          remainingPool,
          remainingSymbol,
          officialCheckerUrl,
        };
      }
      return {
        claimId,
        address,
        status: "ineligible",
        detail: "Distributor reports 0 claimable tokens for this address (never eligible, already claimed, or window closed).",
        remainingPool,
        remainingSymbol,
        officialCheckerUrl,
      };
    }

    const abi = spec.claimedFn === "hasClaimed" ? hasClaimedAbi : claimedAbi;
    const fn = spec.claimedFn === "hasClaimed" ? "hasClaimed" : "claimed";
    const already = (await client.readContract({
      address: spec.distributor,
      abi,
      functionName: fn,
      args: [address],
    })) as boolean;

    if (already) {
      return {
        claimId,
        address,
        status: "already_claimed",
        detail: "On-chain mapping says this address has already claimed.",
        remainingPool,
        remainingSymbol,
        officialCheckerUrl,
      };
    }

    return {
      claimId,
      address,
      status: "unknown",
      detail:
        remainingPool && remainingSymbol
          ? `Not marked claimed. Remaining pool ≈ ${trimAmount(remainingPool)} ${remainingSymbol}. Confirm snapshot inclusion on the official site before signing anything.`
          : "Not marked claimed. Confirm snapshot inclusion on the official site — absence of a claimed flag is not proof of eligibility.",
      remainingPool,
      remainingSymbol,
      officialCheckerUrl,
    };
  } catch (err) {
    return {
      claimId,
      address,
      status: "unknown",
      detail: `Read-only RPC call failed: ${err instanceof Error ? err.message : "error"}. Try the official checker.`,
      remainingPool,
      remainingSymbol,
      officialCheckerUrl,
    };
  }
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

function trimAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}
