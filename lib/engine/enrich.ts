import { cached, fetchWithTimeout, readJsonLimited } from "../http.ts";
import { getClaimById } from "../catalog.ts";
import { engineClient } from "./rpc.ts";
import type { EngineFinding, EngineSource, SourceConfidence } from "./types.ts";
import { applyFindingSafety } from "./finding-safety.ts";
import { describeDeadline, estimateRoi } from "./deadline.ts";

const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,uniswap,wrapped-bitcoin,chainlink,aave,lido-dao,curve-dao-token,maker,compound-governance-token,the-graph,havven,1inch,ethereum-name-service,balancer,rocket-pool,rocket-pool-eth,lido-staked-ether,arbitrum,optimism,matic-network&vs_currencies=usd";

const CLAIM_GAS: Record<number, bigint> = {
  1: BigInt(120_000),
  10: BigInt(200_000),
  42161: BigInt(200_000),
  8453: BigInt(200_000),
  137: BigInt(200_000),
};

type PriceBook = Record<string, number | undefined>;

function confidenceFor(source: EngineSource): SourceConfidence {
  if (source.scanMethod.includes("merkle")) return "official_merkle";
  if (source.category === "native_balance" || source.category === "forgotten_token") return "official_onchain";
  if (source.officialUrl) return "official_project";
  return "needs_review";
}

export async function loadUsdPrices(): Promise<PriceBook> {
  return cached("engine-usd-prices", 10 * 60 * 1000, async () => {
    try {
      const res = await fetchWithTimeout(PRICE_URL, 8_000, { headers: { accept: "application/json" } });
      if (!res.ok) return {};
      const json = await readJsonLimited<Record<string, { usd?: number }>>(res, 40_000);
      return {
        ETH: json.ethereum?.usd,
        WETH: json.ethereum?.usd,
        UNI: json.uniswap?.usd,
        WBTC: json["wrapped-bitcoin"]?.usd,
        LINK: json.chainlink?.usd,
        AAVE: json.aave?.usd,
        LDO: json["lido-dao"]?.usd,
        CRV: json["curve-dao-token"]?.usd,
        MKR: json.maker?.usd,
        COMP: json["compound-governance-token"]?.usd,
        GRT: json["the-graph"]?.usd,
        SNX: json.havven?.usd,
        "1INCH": json["1inch"]?.usd,
        ENS: json["ethereum-name-service"]?.usd,
        BAL: json.balancer?.usd,
        RPL: json["rocket-pool"]?.usd,
        RETH: json["rocket-pool-eth"]?.usd,
        STETH: json["lido-staked-ether"]?.usd,
        ARB: json.arbitrum?.usd,
        OP: json.optimism?.usd,
        POL: json["matic-network"]?.usd,
        MATIC: json["matic-network"]?.usd,
      };
    } catch {
      return {};
    }
  });
}

export async function claimFeeUsd(chainId: number, ethUsd?: number): Promise<number | undefined> {
  if (ethUsd == null) return undefined;
  const client = engineClient(chainId);
  if (!client) return undefined;
  try {
    const gasPrice = await client.getGasPrice();
    const gas = CLAIM_GAS[chainId] ?? BigInt(120_000);
    const wei = gasPrice * gas;
    return (Number(wei) / 1e18) * ethUsd;
  } catch {
    return undefined;
  }
}

function priceForSymbol(symbol: string | undefined, prices: PriceBook): number | undefined {
  if (!symbol) return undefined;
  const key = symbol.toUpperCase();
  if (key === "USDC" || key === "USDT" || key === "DAI") return 1;
  return prices[key];
}

export async function enrichFindings(sources: readonly EngineSource[], findings: EngineFinding[]): Promise<EngineFinding[]> {
  const prices = await loadUsdPrices();
  const feeByChain = new Map<number, number | undefined>();
  const out: EngineFinding[] = [];
  for (const finding of findings) {
    const source = sources.find((row) => row.id === finding.sourceId);
    const catalog = finding.catalogId ? getClaimById(finding.catalogId) : undefined;
    const deadline = describeDeadline(catalog?.onChain?.claimDeadline);
    const sourceConfidence = source ? confidenceFor(source) : "needs_review";
    const includeFees = finding.category === "airdrop" && finding.eligibility === "eligible";
    let feeUsd: number | undefined;
    if (includeFees) {
      if (!feeByChain.has(finding.chainId)) {
        feeByChain.set(finding.chainId, await claimFeeUsd(finding.chainId, prices.ETH));
      }
      feeUsd = feeByChain.get(finding.chainId);
    }
    const roi = estimateRoi({
      amount: finding.amount,
      priceUsd: priceForSymbol(finding.symbol, prices),
      feeUsd,
      includeFees,
    });
    out.push(
      applyFindingSafety({
        ...finding,
        officialUrl: finding.officialUrl || source?.officialUrl || catalog?.officialUrl,
        sourceConfidence,
        deadline: deadline.deadlineStatus === "none" ? undefined : deadline.deadline,
        deadlineStatus: deadline.deadlineStatus,
        deadlineLabel: deadline.deadlineStatus === "none" ? undefined : deadline.deadlineLabel,
        estimatedValueUsd: roi.estimatedValueUsd,
        estimatedFeesUsd: roi.estimatedFeesUsd,
        estimatedNetUsd: roi.estimatedNetUsd,
        roiConfidence: roi.roiConfidence,
      }),
    );
  }
  return out;
}
