import { formatEther, formatUnits, getAddress, type Address } from "viem";
import { readResourceSnapshot } from "../resource-guard.ts";
import { lookupCowAllocation } from "./cow-allocation.ts";
import {
  contractCode,
  distributorIsClaimed,
  erc20Balance,
  nativeBalance,
  readAaveV3Account,
  readClaimPeriodEnds,
  readCompAccrued,
  readMakerDsrDai,
  readStkAaveRewards,
  readVeCrvLocked,
  uniV3PositionScan,
  lidoWithdrawalScan,
} from "./rpc.ts";
import {
  AAVE_V3_POOL,
  ARB_TOKEN_DISTRIBUTOR,
  COMPOUND_COMPTROLLER,
  COW_VCOW,
  CURVE_3CRV,
  CURVE_STECRV,
  ENS_TOKEN,
  HOP_TOKEN,
  LIDO_WITHDRAWAL_QUEUE,
  MAKER_POT,
  STK_AAVE,
  UNI_DISTRIBUTOR,
  UNI_V2_USDC_ETH,
  UNI_V3_NPM,
  VE_CRV,
} from "./sources.ts";
import type { EngineFinding, EngineSource } from "./types.ts";
import { getClaimById } from "../catalog.ts";
import { liveReadUnavailable } from "./profile.ts";
import { lookupEnsClaim } from "./ens-claim.ts";
import { loadUniClaim } from "./uni-merkle.ts";

function publicAdapterError(sourceId: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : "error";
  if (/checksum|invalid address/i.test(raw)) {
    return `${sourceId} could not read the official contract (address format). No Eligible invented.`;
  }
  if (/timed out|timeout|fetch/i.test(raw)) {
    return `${sourceId} timed out talking to the chain. No Eligible invented.`;
  }
  return `${sourceId} could not complete this check. No Eligible invented.`;
}

function failed(source: EngineSource, err: unknown): EngineFinding {
  return {
    id: `${source.id}:error`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: source.category,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "uncertain",
    title: source.catalogId?.replaceAll("-", " ") ?? source.id,
    detail: publicAdapterError(source.id, err),
    officialUrl: source.officialUrl,
    sourceStatus: "failed",
  };
}

function pressureStop(source: EngineSource, message: string): EngineFinding {
  return {
    id: `${source.id}:stopped`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: source.category,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "uncertain",
    title: source.id,
    detail: `Scan stopped to protect this machine: ${message}`,
    sourceStatus: "skipped",
  };
}

function nativeSymbol(chainId: number): string {
  if (chainId === 137) return "POL";
  return "ETH";
}

async function nativeFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const raw = await nativeBalance(source.chainId, address);
  const amount = formatEther(raw);
  const symbol = nativeSymbol(source.chainId);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "native_balance",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: `${source.chainLabel} native balance`,
    detail: has
      ? `This address holds ${amount} native ${source.chainLabel} currency. This is a wallet balance, not an airdrop claim.`
      : `No native ${source.chainLabel} balance.`,
    amount,
    symbol,
    sourceStatus: "ok",
  };
}

async function tokenFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  if (!source.tokenAddress) throw new Error("token adapter missing tokenAddress");
  const { raw, decimals, symbol } = await erc20Balance(
    source.chainId,
    getAddress(source.tokenAddress),
    address,
    { symbol: source.tokenSymbol, decimals: source.tokenDecimals },
  );
  const amount = formatUnits(raw, decimals);
  const has = raw > BigInt(0);
  if (source.catalogId === "uniswap-socks") {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      catalogId: source.catalogId,
      category: "forgotten_token",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      verification: "verified",
      title: "Uniswap SOCKS redemption holding",
      detail: has
        ? `This address holds ${amount} ${symbol}. Physical sock redemption depends on Uniswap inventory. Catalog remaining is token totalSupply, not this wallet's balance.`
        : `No ${symbol} token balance. Unisocks redemption requires holding the official ERC-20.`,
      amount,
      symbol,
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
    };
  }
  const leftover: Record<string, { title: string; kind: string }> = {
    "token-eth-cusdc": { title: "Compound v2 leftover cUSDC", kind: "cToken supply" },
    "token-eth-cdai": { title: "Compound v2 leftover cDAI", kind: "cToken supply" },
    "token-eth-ausdc-v2": { title: "Aave v2 leftover aUSDC", kind: "interest-bearing supply" },
    "token-eth-yvusdc": { title: "Yearn leftover yvUSDC", kind: "vault shares" },
  };
  const special = leftover[source.id];
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "forgotten_token",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: special ? special.title : `${symbol} token balance`,
    detail: special
      ? has
        ? `This address holds ${amount} ${symbol} leftover ${special.kind}. This is a wallet holding, not an airdrop Eligible verdict.`
        : `No ${symbol} leftover ${special.kind} for this address.`
      : has
        ? `This address holds ${amount} ${symbol} on ${source.chainLabel}. Remaining distributor inventory is not used.`
        : `No ${symbol} token balance on ${source.chainLabel}.`,
    amount,
    symbol,
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
  };
}

async function uniMerkleFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const claim = await loadUniClaim(address);
  const base = {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "airdrop" as const,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    officialUrl: source.officialUrl,
    symbol: "UNI",
    sourceStatus: "ok" as const,
  };
  if (!claim) {
    return {
      ...base,
      verification: "verified",
      eligibility: "ineligible",
      title: "Uniswap UNI airdrop",
      detail: "Address is not in the official Uniswap merkle chunks, so it is not eligible for that distribution.",
    };
  }
  const index = BigInt(claim.index);
  let amount = claim.amount;
  try {
    amount = formatUnits(BigInt(claim.amount), 18);
  } catch {
    /* keep published string */
  }
  const code = await contractCode(1, UNI_DISTRIBUTOR);
  if (!code) {
    return {
      ...base,
      verification: "verified",
      eligibility: "window_closed",
      title: "Uniswap UNI airdrop",
      detail: `Official merkle data includes this address (index ${index.toString()}). MerkleDistributor ${UNI_DISTRIBUTOR} currently has no contract code, so isClaimed(index) cannot be read and a live claim cannot be submitted.`,
      amount,
    };
  }
  const claimed = await distributorIsClaimed(1, UNI_DISTRIBUTOR, index);
  if (claimed) {
    return {
      ...base,
      verification: "verified",
      eligibility: "already_claimed",
      title: "Uniswap UNI airdrop",
      detail: `Official merkle data includes this address (index ${index.toString()}). isClaimed(index) is true.`,
      amount,
    };
  }
  return {
    ...base,
    verification: "verified",
    eligibility: "eligible",
    title: "Uniswap UNI airdrop",
    detail: `Official merkle data includes this address (index ${index.toString()}) and isClaimed(index) is false. Claim only through the official Uniswap app. PoolIndex does not submit claims.`,
    amount,
  };
}

async function cowFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, COW_VCOW);
  if (!code) {
    throw new Error(`Official vCOW ${COW_VCOW} has no contract code on Ethereum`);
  }
  const allocation = await lookupCowAllocation(address);
  const { raw, decimals, symbol } = await erc20Balance(1, COW_VCOW, address, { symbol: "vCOW", decimals: 18 });
  const amount = formatUnits(raw, decimals);
  const base = {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "airdrop" as const,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    officialUrl: source.officialUrl,
    symbol,
    sourceStatus: "ok" as const,
    title: "CoW Protocol vCOW airdrop",
  };
  if (!allocation || allocation.total === "0") {
    return {
      ...base,
      verification: "verified",
      eligibility: "ineligible",
      detail: `Address is not in the official CoW mainnet allocation CSV, so it was not part of that distribution. Current ${symbol} balance is ${amount}.`,
      amount,
    };
  }
  if (raw > BigInt(0)) {
    return {
      ...base,
      verification: "verified",
      eligibility: "already_claimed",
      detail: `Official CoW allocation includes this address. vCOW contract ${COW_VCOW} reports balance ${amount} ${symbol}.`,
      amount,
    };
  }
  return {
    ...base,
    verification: "verified",
    eligibility: "window_closed",
    detail: `Official CoW allocation includes this address. The claim window closed six weeks after the March 2022 deployment. ${COW_VCOW} reports 0 ${symbol}, which does not reconstruct merkle isClaimed(index). Live claim is closed.`,
    amount,
  };
}

async function ensFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, ENS_TOKEN);
  const lookup = await lookupEnsClaim(address);
  const base = {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "airdrop" as const,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    officialUrl: source.officialUrl,
    title: "ENS token airdrop",
    symbol: "ENS",
    sourceStatus: "ok" as const,
  };
  const codeNote = code
    ? `Official ENS token ${ENS_TOKEN} has bytecode.`
    : `Official ENS token ${ENS_TOKEN} currently has no bytecode.`;
  if (lookup.kind === "claim") {
    const amount = (() => {
      try {
        return formatUnits(BigInt(lookup.claim.amount), 18);
      } catch {
        return lookup.claim.amount;
      }
    })();
    try {
      const claimed = await distributorIsClaimed(1, ENS_TOKEN, BigInt(lookup.claim.index));
      return {
        ...base,
        verification: "verified",
        eligibility: claimed ? "already_claimed" : "eligible",
        amount,
        detail: claimed
          ? `${codeNote} Address is in the official ENS claim JSON and isClaimed(${lookup.claim.index}) is true.`
          : `${codeNote} Address is in the official ENS claim JSON and isClaimed(${lookup.claim.index}) is false.`,
      };
    } catch (err) {
      return {
        ...base,
        verification: "uncertain",
        amount,
        detail: `${codeNote} Address appears in official ENS claim JSON, but isClaimed could not be read (${err instanceof Error ? err.message : "error"}). Eligible is not invented.`,
      };
    }
  }
  if (lookup.kind === "not_json") {
    return {
      ...base,
      verification: "uncertain",
      detail: `${codeNote} Official claim.ens.domains returned HTML, not a merkle JSON record. No Eligible/Not eligible invented.`,
    };
  }
  return {
    ...base,
    verification: "uncertain",
    detail: `${codeNote} Official ENS claim JSON did not include an index/amount for this address. That is not treated as Not eligible without a hosted merkle snapshot.`,
  };
}

async function arbFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(42161, ARB_TOKEN_DISTRIBUTOR);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "airdrop",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    eligibility: "window_closed",
    title: "Arbitrum ARB airdrop",
    detail: code
      ? `TokenDistributor ${ARB_TOKEN_DISTRIBUTOR} still has contract code. The official claim deadline was 2023-09-24; this adapter does not invent Eligible from remaining inventory.`
      : `TokenDistributor ${ARB_TOKEN_DISTRIBUTOR} has no contract code. Arbitrum Foundation documents that it was self-destructed after the 2023-09-24 claim deadline. Live claimableTokens(address) cannot be read.`,
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
  };
}

async function documentedAirdropFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const target = source.distributorAddress ?? source.tokenAddress;
  if (!target) throw new Error(`Airdrop adapter ${source.id} missing official contract`);
  const code = await contractCode(source.chainId, target);
  let deadline = source.claimDeadline;
  let closed = Boolean(source.windowClosed);
  if (source.id === "airdrop-hop-hop") {
    try {
      const ends = await readClaimPeriodEnds(1, HOP_TOKEN);
      const iso = new Date(Number(ends) * 1000).toISOString();
      deadline = iso.slice(0, 10);
      if (Date.now() > Number(ends) * 1000) closed = true;
    } catch {
      closed = true;
      deadline = source.claimDeadline ?? "2022-12-09";
    }
  } else if (deadline && Date.parse(`${deadline}T00:00:00.000Z`) < Date.now()) {
    closed = true;
  }
  const title = (source.catalogId && getClaimById(source.catalogId)?.title) || source.catalogId?.replaceAll("-", " ") || source.id;
  const base = {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: "airdrop" as const,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    officialUrl: source.officialUrl,
    title,
    sourceStatus: "ok" as const,
  };
  const codeNote = code
    ? `Official contract ${target} has bytecode.`
    : `Official contract ${target} currently has no bytecode.`;
  if (closed) {
    return {
      ...base,
      verification: "verified",
      eligibility: "window_closed",
      deadline,
      deadlineStatus: "expired",
      detail: `${codeNote} The official claim window is closed${deadline ? ` (${deadline})` : ""}. Remaining inventory is not wallet eligibility. Merkle proofs are not invented.`,
    };
  }
  if (!code) {
    return {
      ...base,
      ...liveReadUnavailable(),
      detail: `${codeNote} Live eligibility cannot be read. PoolIndex does not invent Eligible.`,
    };
  }
  return {
    ...base,
    ...liveReadUnavailable(),
    detail: `${codeNote} Wallet eligibility requires this project's official merkle/API, which PoolIndex does not host. No Eligible/Not eligible invented.`,
  };
}

async function compoundCompFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const raw = await readCompAccrued(COMPOUND_COMPTROLLER, address);
  const amount = formatUnits(raw, 18);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Compound v2 unclaimed COMP",
    detail: has
      ? `Comptroller ${COMPOUND_COMPTROLLER} reports ${amount} COMP accrued and unclaimed for this address. This is a protocol reward view, not an airdrop Eligible verdict.`
      : `Comptroller ${COMPOUND_COMPTROLLER} reports 0 unclaimed COMP for this address.`,
    amount,
    symbol: "COMP",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function uniV3LpFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const scan = await uniV3PositionScan(UNI_V3_NPM, address);
  const leftover = scan.leftover > 0;
  const capNote =
    scan.nftCount > scan.checked ? ` Checked the first ${scan.checked} of ${scan.nftCount} NFTs.` : "";
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Uniswap V3 leftover LP",
    detail: leftover
      ? `Official NPM ${UNI_V3_NPM} holds ${scan.nftCount} position NFT(s). ${scan.leftover} of ${scan.checked} checked still have liquidity (${scan.withLiquidity}) or uncollected tokens (${scan.withFees}).${capNote} This is leftover LP, not an airdrop.`
      : scan.nftCount === 0
        ? `Official NPM ${UNI_V3_NPM} holds no Uniswap V3 position NFTs for this address.`
        : `Official NPM ${UNI_V3_NPM} holds ${scan.nftCount} position NFT(s); none of the ${scan.checked} checked still have liquidity or uncollected tokens.${capNote}`,
    amount: String(scan.leftover),
    symbol: "positions",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function aaveStkFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const staked = await erc20Balance(1, STK_AAVE, address, { symbol: "stkAAVE", decimals: 18 });
  const rewards = await readStkAaveRewards(STK_AAVE, address);
  const stakedAmt = formatUnits(staked.raw, staked.decimals);
  const rewardAmt = formatUnits(rewards, 18);
  const hasStake = staked.raw > BigInt(0);
  const hasRewards = rewards > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Aave Safety Module staking rewards",
    detail: hasRewards
      ? `stkAAVE ${STK_AAVE} reports ${rewardAmt} AAVE unclaimed staking rewards. Staked balance is ${stakedAmt} ${staked.symbol}. This is a protocol reward view, not an airdrop Eligible verdict.`
      : hasStake
        ? `This address holds ${stakedAmt} ${staked.symbol} in the Aave Safety Module. getTotalRewardsBalance is 0 AAVE.`
        : `stkAAVE ${STK_AAVE} reports 0 staked balance and 0 unclaimed AAVE rewards.`,
    amount: hasRewards ? rewardAmt : stakedAmt,
    symbol: hasRewards ? "AAVE" : "stkAAVE",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function makerDsrFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, MAKER_POT);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Maker DSR leftover DAI",
      detail: `Maker Pot ${MAKER_POT} currently has no bytecode on the configured Ethereum RPC. Live pie/chi cannot be read. No Eligible invented, and 0 DAI is not assumed.`,
      amount: "0",
      symbol: "DAI",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const raw = await readMakerDsrDai(MAKER_POT, address);
  const amount = formatUnits(raw, 18);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Maker DSR leftover DAI",
    detail: has
      ? `Maker Pot ${MAKER_POT} reports ${amount} DAI in the Dai Savings Rate for this address (pie * chi / RAY). This is a protocol deposit view, not an airdrop Eligible verdict.`
      : `Maker Pot ${MAKER_POT} reports 0 DAI in the Dai Savings Rate for this address.`,
    amount,
    symbol: "DAI",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function veCrvFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, VE_CRV);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Curve veCRV leftover lock",
      detail: `VotingEscrow ${VE_CRV} currently has no bytecode on the configured Ethereum RPC. Live locked(address) cannot be read. No Eligible invented, and 0 CRV locked is not assumed.`,
      amount: "0",
      symbol: "CRV",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const locked = await readVeCrvLocked(VE_CRV, address);
  const amount = formatUnits(locked.amount, 18);
  const has = locked.amount > BigInt(0);
  const endMs = Number(locked.end) * 1000;
  const expired = has && Number.isFinite(endMs) && endMs > 0 && endMs <= Date.now();
  const until = Number.isFinite(endMs) && endMs > 0 ? new Date(endMs).toISOString().slice(0, 10) : null;
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Curve veCRV leftover lock",
    detail: has
      ? `VotingEscrow ${VE_CRV} reports ${amount} CRV locked for this address${until ? ` until ${until}` : ""}${expired ? " (lock end has passed; leftover lock, not an airdrop)" : ""}. This is leftover lock, not an airdrop Eligible verdict.`
      : `VotingEscrow ${VE_CRV} reports no CRV locked for this address.`,
    amount,
    symbol: "CRV",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function curve3poolFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, CURVE_3CRV);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Curve 3pool leftover LP",
      detail: `Curve 3Crv ${CURVE_3CRV} currently has no bytecode on the configured Ethereum RPC. Live balanceOf cannot be read. No Eligible invented.`,
      amount: "0",
      symbol: "3Crv",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const { raw, decimals, symbol } = await erc20Balance(1, CURVE_3CRV, address, { symbol: "3Crv", decimals: 18 });
  const amount = formatUnits(raw, decimals);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Curve 3pool leftover LP",
    detail: has
      ? `This address holds ${amount} ${symbol} 3pool LP tokens. This is leftover LP, not an airdrop Eligible verdict.`
      : `No ${symbol} 3pool LP token balance for this address.`,
    amount,
    symbol,
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function lidoWithdrawalFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, LIDO_WITHDRAWAL_QUEUE);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Lido unclaimed withdrawals",
      detail: `Lido WithdrawalQueue ${LIDO_WITHDRAWAL_QUEUE} currently has no bytecode on the configured Ethereum RPC. Live withdrawal status cannot be read. No Eligible invented.`,
      amount: "0",
      symbol: "stETH",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const scan = await lidoWithdrawalScan(LIDO_WITHDRAWAL_QUEUE, address);
  const amount = formatUnits(scan.amountStEth, 18);
  const has = scan.leftover > 0;
  const capNote =
    scan.requestCount > scan.checked ? ` Checked the first ${scan.checked} of ${scan.requestCount} requests.` : "";
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Lido unclaimed withdrawals",
    detail: has
      ? `WithdrawalQueue ${LIDO_WITHDRAWAL_QUEUE} has ${scan.leftover} finalized unclaimed request(s) totaling ${amount} stETH.${capNote} This is leftover ETH from an official withdrawal, not an airdrop Eligible verdict.`
      : scan.requestCount === 0
        ? `WithdrawalQueue ${LIDO_WITHDRAWAL_QUEUE} has no withdrawal requests for this address.`
        : `WithdrawalQueue ${LIDO_WITHDRAWAL_QUEUE} has ${scan.requestCount} request(s); none of the ${scan.checked} checked are finalized and unclaimed.${capNote}`,
    amount,
    symbol: "stETH",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function aaveV3Finding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, AAVE_V3_POOL);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Aave v3 leftover account",
      detail: `Aave v3 Pool ${AAVE_V3_POOL} currently has no bytecode on the configured Ethereum RPC. Live getUserAccountData cannot be read. No Eligible invented.`,
      amount: "0",
      symbol: "USD",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const account = await readAaveV3Account(AAVE_V3_POOL, address);
  const collateral = formatUnits(account.collateralBase, 8);
  const debt = formatUnits(account.debtBase, 8);
  const has = account.collateralBase > 0n || account.debtBase > 0n;
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Aave v3 leftover account",
    detail: has
      ? `Aave v3 Pool ${AAVE_V3_POOL} reports leftover collateral ${collateral} USD and debt ${debt} USD (base-8). This is a protocol position view, not an airdrop Eligible verdict.`
      : `Aave v3 Pool ${AAVE_V3_POOL} reports 0 collateral and 0 debt for this address.`,
    amount: account.collateralBase > 0n ? collateral : debt,
    symbol: "USD",
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function uniV2UsdcEthFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, UNI_V2_USDC_ETH);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Uniswap V2 USDC/ETH leftover LP",
      detail: `Uniswap V2 pair ${UNI_V2_USDC_ETH} currently has no bytecode on the configured Ethereum RPC. Live balanceOf cannot be read. No Eligible invented.`,
      amount: "0",
      symbol: "UNI-V2",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const { raw, decimals, symbol } = await erc20Balance(1, UNI_V2_USDC_ETH, address, {
    symbol: "UNI-V2",
    decimals: 18,
  });
  const amount = formatUnits(raw, decimals);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Uniswap V2 USDC/ETH leftover LP",
    detail: has
      ? `This address holds ${amount} ${symbol} leftover Uniswap V2 USDC/ETH LP. This is leftover LP, not an airdrop Eligible verdict.`
      : `No Uniswap V2 USDC/ETH LP token balance for this address.`,
    amount,
    symbol,
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

async function curveStethLpFinding(source: EngineSource, address: Address): Promise<EngineFinding> {
  const code = await contractCode(1, CURVE_STECRV);
  if (!code) {
    return {
      id: `${source.id}:${address.toLowerCase()}`,
      sourceId: source.id,
      category: "protocol_claim",
      chainId: source.chainId,
      chainLabel: source.chainLabel,
      ...liveReadUnavailable(),
      title: "Curve stETH/ETH leftover LP",
      detail: `Curve steCRV ${CURVE_STECRV} currently has no bytecode on the configured Ethereum RPC. Live balanceOf cannot be read. No Eligible invented.`,
      amount: "0",
      symbol: "steCRV",
      officialUrl: source.officialUrl,
      sourceStatus: "ok",
      sourceConfidence: "official_onchain",
    };
  }
  const { raw, decimals, symbol } = await erc20Balance(1, CURVE_STECRV, address, { symbol: "steCRV", decimals: 18 });
  const amount = formatUnits(raw, decimals);
  const has = raw > BigInt(0);
  return {
    id: `${source.id}:${address.toLowerCase()}`,
    sourceId: source.id,
    category: "protocol_claim",
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "verified",
    title: "Curve stETH/ETH leftover LP",
    detail: has
      ? `This address holds ${amount} ${symbol} leftover Curve stETH/ETH LP. This is leftover LP, not an airdrop Eligible verdict.`
      : `No ${symbol} stETH/ETH LP token balance for this address.`,
    amount,
    symbol,
    officialUrl: source.officialUrl,
    sourceStatus: "ok",
    sourceConfidence: "official_onchain",
  };
}

export async function runSource(source: EngineSource, address: Address): Promise<EngineFinding> {
  const snap = readResourceSnapshot();
  if (snap.level === "critical") return pressureStop(source, snap.message);
  try {
    if (source.category === "native_balance") return nativeFinding(source, address);
    if (source.category === "forgotten_token") return tokenFinding(source, address);
    if (source.id === "airdrop-uni-merkle") return uniMerkleFinding(source, address);
    if (source.id === "airdrop-cow-vcow") return cowFinding(source, address);
    if (source.id === "airdrop-ens-merkle") return ensFinding(source, address);
    if (source.id === "airdrop-arbitrum-arb") return arbFinding(source, address);
    if (source.category === "airdrop") return documentedAirdropFinding(source, address);
    if (source.id === "protocol-compound-comp") return compoundCompFinding(source, address);
    if (source.id === "protocol-uniswap-v3-lp") return uniV3LpFinding(source, address);
    if (source.id === "protocol-aave-stkaave") return aaveStkFinding(source, address);
    if (source.id === "protocol-maker-dsr") return makerDsrFinding(source, address);
    if (source.id === "protocol-curve-vecrv") return veCrvFinding(source, address);
    if (source.id === "protocol-curve-3pool-lp") return curve3poolFinding(source, address);
    if (source.id === "protocol-lido-withdrawals") return lidoWithdrawalFinding(source, address);
    if (source.id === "protocol-aave-v3-account") return aaveV3Finding(source, address);
    if (source.id === "protocol-uniswap-v2-usdc-eth") return uniV2UsdcEthFinding(source, address);
    if (source.id === "protocol-curve-steth-lp") return curveStethLpFinding(source, address);
    return failed(source, new Error(`Unknown adapter ${source.id}`));
  } catch (err) {
    return failed(source, err);
  }
}
