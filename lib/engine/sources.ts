import { getAddress, type Address } from "viem";
import type { EngineSource } from "./types.ts";

/** Official UNI MerkleDistributor. Do not use the mistyped catalog address. */
export const UNI_DISTRIBUTOR = "0x090D4613473dEE047c3f27026eC4D8bd3C4F1aca" as const;
/** Official vCOW (docs.cow.fi). Catalog previously used a mistyped address with no code. */
export const COW_VCOW = "0xD057B63f5E69CF1B929b356b579Cba08D7688048" as const;
export const ARB_TOKEN_DISTRIBUTOR = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9" as const;
export const ENS_TOKEN = "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72" as const;
export const INCH_DISTRIBUTOR = "0xE295aD71242373C37C5FdA7B57F26f9eA00b0ab0" as const;
export const GTC_TOKEN = "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F" as const;
export const OP_TOKEN = "0x4200000000000000000000000000000000000042" as const;
export const HOP_TOKEN = "0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC" as const;
export const SAFE_TOKEN = "0x5aFE3855358E112B5647B952709E6165E1c1eEEe" as const;
export const LOOKS_TOKEN = "0xf4d2888d29D722226FafA5d9B24F9164c8907b75" as const;
export const DYDX_DISTRIBUTOR = "0x01d3348601968aB85b4bb028979006eac235a588" as const;
/** Compound v2 Unitroller / Comptroller. `compAccrued(address)` is the unclaimed COMP view. */
export const COMPOUND_COMPTROLLER = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B" as const;
export const COMP_TOKEN = "0xc00e94Cb662C3520282E6f5717214004A7f26888" as const;
/** Official Uniswap V3 NonfungiblePositionManager on Ethereum. */
export const UNI_V3_NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
export const BLUR_TOKEN = "0x5283D291DBCF85356A289A370318194756430d89" as const;
export const ZRO_TOKEN = "0x6985884C4392D348587B19cb9eAAf157F0539DD4" as const;
/** Aave Safety Module stkAAVE. Unclaimed staking rewards via getTotalRewardsBalance. */
export const STK_AAVE = "0x4da27a545c0c5B758a6BA100e3a049001de870f5" as const;
/** Official Unisocks ERC-20. Remaining inventory is totalSupply; wallet check is balanceOf. */
export const SOCKS_TOKEN = "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5" as const;
/** Maker Pot — Dai Savings Rate. `pie(usr) * chi() / RAY` is DAI in DSR. */
export const MAKER_POT = "0x197E90f9FAD81970BA7976f22Cb5d243c738eC19" as const;
export const DAI_TOKEN = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
/** Curve VotingEscrow (veCRV). leftover locked CRV via `locked(address)`. */
export const VE_CRV = "0x5f3b5DfEb7B28CDbD4CADCA380AEF238a288C7db" as const;
export const CRV_TOKEN = "0xD533a949740bb3306d119CC777fa900bA034cd52" as const;
/** Lido wstETH (wrapped stETH). Wallet leftover is balanceOf, not protocol rewards. */
export const WSTETH_TOKEN = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as const;
/** Curve 3pool LP token (3Crv). Dedicated leftover LP check is balanceOf. */
export const CURVE_3CRV = "0x6c3F90f043a72FA612cbac8115AE7e577E6B5d7b" as const;
/** Lido WithdrawalQueue ERC-721. Finalized and unclaimed requests are leftover ETH. */
export const LIDO_WITHDRAWAL_QUEUE = getAddress("0x889edc2edab5f40e902b864ad4d7ade8e412f9b1");
/** Aave v3 Pool on Ethereum. getUserAccountData is leftover collateral/debt, not an airdrop. */
export const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as const;
/** Compound v2 cUSDC. Leftover supply is the cToken balance, not distributor inventory. */
export const CUSDC_TOKEN = "0x39AA39c021dfbaE8faC545936693aC917d5E7563" as const;
/** Uniswap V2 USDC/WETH pair. Dedicated leftover LP check is balanceOf. */
export const UNI_V2_USDC_ETH = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc" as const;
/** Compound v2 cDAI. Leftover supply is the cToken balance. */
export const CDAI_TOKEN = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643" as const;
/** Aave v2 aUSDC. Leftover supply is the interest-bearing token balance. */
export const AAVE_V2_AUSDC = "0xBcca60bB61934080951369a648Fb03DF4F96263C" as const;
/** Yearn USDC v2 vault. Leftover is vault share balanceOf. */
export const YVUSDC_TOKEN = "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE" as const;
/** Curve stETH/ETH LP (steCRV). Dedicated leftover LP check is balanceOf. */
export const CURVE_STECRV = "0x06325440D014e39736583c165C2963BA99fAf14C" as const;

const DAILY = { frequency: "daily" as const, rateLimit: "sequential" as const, adapterVersion: "1" as const, walletLevel: true };

function native(
  id: string,
  chainId: number,
  chainLabel: string,
  protocol: string,
): EngineSource {
  return {
    id,
    protocol,
    chainId,
    chainLabel,
    category: "native_balance",
    scanMethod: "eth_getBalance",
    ...DAILY,
  };
}

function token(
  id: string,
  chainId: number,
  chainLabel: string,
  protocol: string,
  tokenAddress: Address,
  tokenSymbol: string,
  tokenDecimals: number,
  officialUrl?: string,
): EngineSource {
  return {
    id,
    protocol,
    chainId,
    chainLabel,
    category: "forgotten_token",
    tokenAddress,
    tokenSymbol,
    tokenDecimals,
    officialUrl,
    scanMethod: "erc20.balanceOf",
    ...DAILY,
  };
}

const NATIVES: EngineSource[] = [
  native("native-ethereum", 1, "Ethereum", "ethereum"),
  native("native-arbitrum", 42161, "Arbitrum One", "arbitrum"),
  native("native-optimism", 10, "Optimism", "optimism"),
  native("native-base", 8453, "Base", "base"),
  native("native-polygon", 137, "Polygon", "polygon"),
];

const TOKENS: EngineSource[] = [
  token("token-eth-uni", 1, "Ethereum", "uniswap", "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "UNI", 18, "https://app.uniswap.org/"),
  token("token-eth-usdc", 1, "Ethereum", "circle", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", 6),
  token("token-eth-usdt", 1, "Ethereum", "tether", "0xdAC17F958D2ee523a2206206994597C13D831ec7", "USDT", 6),
  token("token-eth-dai", 1, "Ethereum", "maker", "0x6B175474E89094C44Da98b954EedeAC495271d0F", "DAI", 18),
  token("token-eth-weth", 1, "Ethereum", "weth", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "WETH", 18),
  token("token-eth-wbtc", 1, "Ethereum", "wbtc", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", "WBTC", 8),
  token("token-eth-link", 1, "Ethereum", "chainlink", "0x514910771AF9Ca656af840dff83E8264EcF986CA", "LINK", 18),
  token("token-eth-ens", 1, "Ethereum", "ens", "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72", "ENS", 18, "https://ens.domains/"),
  token("token-eth-aave", 1, "Ethereum", "aave", "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "AAVE", 18),
  token("token-eth-ldo", 1, "Ethereum", "lido", "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "LDO", 18),
  token("token-eth-crv", 1, "Ethereum", "curve", "0xD533a949740bb3306d119CC777fa900bA034cd52", "CRV", 18),
  token("token-eth-mkr", 1, "Ethereum", "maker", "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", "MKR", 18),
  token("token-eth-steth", 1, "Ethereum", "lido", "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", "stETH", 18),
  token("token-eth-wsteth", 1, "Ethereum", "lido", WSTETH_TOKEN, "wstETH", 18, "https://stake.lido.fi/"),
  token("token-eth-reth", 1, "Ethereum", "rocketpool", "0xae78736Cd615f374D3085123A210448E74Fc6393", "rETH", 18),
  token("token-eth-comp", 1, "Ethereum", "compound", "0xc00e94Cb662C3520282E6f5717214004A7f26888", "COMP", 18),
  token("token-eth-cusdc", 1, "Ethereum", "compound", CUSDC_TOKEN, "cUSDC", 8, "https://app.compound.finance/"),
  token("token-eth-cdai", 1, "Ethereum", "compound", CDAI_TOKEN, "cDAI", 8, "https://app.compound.finance/"),
  token("token-eth-ausdc-v2", 1, "Ethereum", "aave", AAVE_V2_AUSDC, "aUSDC", 6, "https://app.aave.com/"),
  token("token-eth-yvusdc", 1, "Ethereum", "yearn", YVUSDC_TOKEN, "yvUSDC", 6, "https://yearn.fi/"),
  token("token-eth-grt", 1, "Ethereum", "thegraph", "0xc944E90C64B2c07662A292be6244BDf05Cda44a7", "GRT", 18),
  token("token-eth-snx", 1, "Ethereum", "synthetix", "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", "SNX", 18),
  token("token-eth-1inch", 1, "Ethereum", "1inch", "0x111111111117dC0aa78b770fA6A738034120C302", "1INCH", 18),
  token("token-eth-bal", 1, "Ethereum", "balancer", "0xba100000625a3754423978a60c9317c58a424e3D", "BAL", 18),
  token("token-eth-rpl", 1, "Ethereum", "rocketpool", "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", "RPL", 18),
  {
    ...token("token-eth-socks", 1, "Ethereum", "uniswap", SOCKS_TOKEN, "SOCKS", 18, "https://unisocks.exchange/"),
    catalogId: "uniswap-socks",
  },
  token("token-arb-arb", 42161, "Arbitrum One", "arbitrum", "0x912CE59144191C1204E64559FE8253a0e49E6548", "ARB", 18, "https://arbitrum.foundation/"),
  token("token-arb-usdc", 42161, "Arbitrum One", "circle", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USDC", 6),
  token("token-arb-weth", 42161, "Arbitrum One", "weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "WETH", 18),
  token("token-arb-usdt", 42161, "Arbitrum One", "tether", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "USDT", 6),
  token("token-op-op", 10, "Optimism", "optimism", "0x4200000000000000000000000000000000000042", "OP", 18, "https://app.optimism.io/"),
  token("token-op-usdc", 10, "Optimism", "circle", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "USDC", 6),
  token("token-op-weth", 10, "Optimism", "weth", "0x4200000000000000000000000000000000000006", "WETH", 18),
  token("token-op-dai", 10, "Optimism", "maker", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", "DAI", 18),
  token("token-base-usdc", 8453, "Base", "circle", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
  token("token-base-weth", 8453, "Base", "weth", "0x4200000000000000000000000000000000000006", "WETH", 18),
  token("token-base-dai", 8453, "Base", "maker", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", "DAI", 18),
  token("token-pol-usdc", 137, "Polygon", "circle", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "USDC", 6),
  token("token-pol-weth", 137, "Polygon", "weth", "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", "WETH", 18),
  token("token-pol-usdt", 137, "Polygon", "tether", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "USDT", 6),
];

const AIRDROPS: EngineSource[] = [
  {
    id: "airdrop-uni-merkle",
    protocol: "uniswap",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "uniswap-uni-airdrop",
    officialUrl: "https://app.uniswap.org/",
    scanMethod: "official_merkle_chunk+isClaimed",
    ...DAILY,
  },
  {
    id: "airdrop-cow-vcow",
    protocol: "cow",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "cow-protocol-airdrop",
    officialUrl: "https://claim.cow.fi/",
    scanMethod: "official_allocation_csv+vcow.balanceOf",
    ...DAILY,
  },
  {
    id: "airdrop-arbitrum-arb",
    protocol: "arbitrum",
    chainId: 42161,
    chainLabel: "Arbitrum One",
    category: "airdrop",
    catalogId: "arbitrum-airdrop",
    officialUrl: "https://arbitrum.foundation/",
    scanMethod: "distributor_getCode+documented_selfdestruct",
    ...DAILY,
  },
  {
    id: "airdrop-ens-merkle",
    protocol: "ens",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "ens-airdrop",
    officialUrl: "https://claim.ens.domains/",
    tokenAddress: ENS_TOKEN,
    scanMethod: "official_claim_json+isClaimed",
    ...DAILY,
  },
  {
    id: "airdrop-1inch-merkle",
    protocol: "1inch",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "1inch-airdrop",
    officialUrl: "https://1inch.io/airdrop/",
    distributorAddress: INCH_DISTRIBUTOR,
    scanMethod: "distributor_getCode+unhosted_merkle",
    ...DAILY,
  },
  {
    id: "airdrop-gitcoin-gtc",
    protocol: "gitcoin",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "gitcoin-gtc-airdrop",
    officialUrl: "https://www.gitcoin.co/",
    tokenAddress: GTC_TOKEN,
    scanMethod: "token_getCode+unhosted_distribution",
    ...DAILY,
  },
  {
    id: "airdrop-optimism-1",
    protocol: "optimism",
    chainId: 10,
    chainLabel: "Optimism",
    category: "airdrop",
    catalogId: "optimism-airdrop-1",
    officialUrl: "https://www.optimism.io/",
    tokenAddress: OP_TOKEN,
    windowClosed: true,
    scanMethod: "documented_closed_window+token_getCode",
    ...DAILY,
  },
  {
    id: "airdrop-hop-hop",
    protocol: "hop",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "hop-protocol-airdrop",
    officialUrl: "https://hop.exchange/",
    tokenAddress: HOP_TOKEN,
    claimDeadline: "2022-12-09",
    windowClosed: true,
    scanMethod: "hop_claimPeriodEnds+token_getCode",
    ...DAILY,
  },
  {
    id: "airdrop-safe-safe",
    protocol: "safe",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "safe-token-airdrop",
    officialUrl: "https://safe.global/",
    tokenAddress: SAFE_TOKEN,
    scanMethod: "token_getCode+unhosted_allocation",
    ...DAILY,
  },
  {
    id: "airdrop-looksrare-looks",
    protocol: "looksrare",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "looksrare-airdrop",
    officialUrl: "https://looksrare.org/",
    tokenAddress: LOOKS_TOKEN,
    windowClosed: true,
    scanMethod: "documented_closed_window+token_getCode",
    ...DAILY,
  },
  {
    id: "airdrop-dydx-merkle",
    protocol: "dydx",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "dydx-airdrop",
    officialUrl: "https://www.dydx.foundation/",
    distributorAddress: DYDX_DISTRIBUTOR,
    scanMethod: "distributor_getCode+unhosted_epoch_merkle",
    ...DAILY,
  },
  {
    id: "airdrop-blur-blur",
    protocol: "blur",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "blur-airdrop",
    officialUrl: "https://blur.io/",
    tokenAddress: BLUR_TOKEN,
    scanMethod: "token_getCode+unhosted_season_merkle",
    ...DAILY,
  },
  {
    id: "airdrop-layerzero-zro",
    protocol: "layerzero",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "airdrop",
    catalogId: "layerzero-airdrop",
    officialUrl: "https://layerzero.network/",
    tokenAddress: ZRO_TOKEN,
    scanMethod: "token_getCode+unhosted_sybil_snapshot",
    ...DAILY,
  },
];

const PROTOCOL_CLAIMS: EngineSource[] = [
  {
    id: "protocol-compound-comp",
    protocol: "compound",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://app.compound.finance/",
    tokenAddress: COMP_TOKEN,
    tokenSymbol: "COMP",
    tokenDecimals: 18,
    distributorAddress: COMPOUND_COMPTROLLER,
    scanMethod: "comptroller.compAccrued",
    ...DAILY,
  },
  {
    id: "protocol-uniswap-v3-lp",
    protocol: "uniswap",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://app.uniswap.org/positions",
    distributorAddress: UNI_V3_NPM,
    scanMethod: "npm.positions+collect_staticcall",
    ...DAILY,
  },
  {
    id: "protocol-aave-stkaave",
    protocol: "aave",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://app.aave.com/staking/",
    tokenAddress: STK_AAVE,
    tokenSymbol: "stkAAVE",
    tokenDecimals: 18,
    distributorAddress: STK_AAVE,
    scanMethod: "stkAAVE.getTotalRewardsBalance+balanceOf",
    ...DAILY,
  },
  {
    id: "protocol-maker-dsr",
    protocol: "maker",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://makerdao.com/",
    tokenAddress: DAI_TOKEN,
    tokenSymbol: "DAI",
    tokenDecimals: 18,
    distributorAddress: MAKER_POT,
    scanMethod: "pot.pie+chi",
    ...DAILY,
  },
  {
    id: "protocol-curve-vecrv",
    protocol: "curve",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://curve.fi/",
    tokenAddress: CRV_TOKEN,
    tokenSymbol: "CRV",
    tokenDecimals: 18,
    distributorAddress: VE_CRV,
    scanMethod: "votingEscrow.locked",
    ...DAILY,
  },
  {
    id: "protocol-curve-3pool-lp",
    protocol: "curve",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://curve.fi/",
    tokenAddress: CURVE_3CRV,
    tokenSymbol: "3Crv",
    tokenDecimals: 18,
    distributorAddress: CURVE_3CRV,
    scanMethod: "curve.3pool.balanceOf",
    ...DAILY,
  },
  {
    id: "protocol-lido-withdrawals",
    protocol: "lido",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://stake.lido.fi/withdrawals",
    tokenAddress: WSTETH_TOKEN,
    tokenSymbol: "stETH",
    tokenDecimals: 18,
    distributorAddress: LIDO_WITHDRAWAL_QUEUE,
    scanMethod: "withdrawalQueue.getWithdrawalStatus",
    ...DAILY,
  },
  {
    id: "protocol-aave-v3-account",
    protocol: "aave",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://app.aave.com/",
    distributorAddress: AAVE_V3_POOL,
    scanMethod: "pool.getUserAccountData",
    ...DAILY,
  },
  {
    id: "protocol-uniswap-v2-usdc-eth",
    protocol: "uniswap",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://app.uniswap.org/positions",
    tokenAddress: UNI_V2_USDC_ETH,
    tokenSymbol: "UNI-V2",
    tokenDecimals: 18,
    distributorAddress: UNI_V2_USDC_ETH,
    scanMethod: "uniswapv2.usdc_eth.balanceOf",
    ...DAILY,
  },
  {
    id: "protocol-curve-steth-lp",
    protocol: "curve",
    chainId: 1,
    chainLabel: "Ethereum",
    category: "protocol_claim",
    officialUrl: "https://curve.fi/",
    tokenAddress: CURVE_STECRV,
    tokenSymbol: "steCRV",
    tokenDecimals: 18,
    distributorAddress: CURVE_STECRV,
    scanMethod: "curve.steth.balanceOf",
    ...DAILY,
  },
];

export const ENGINE_SOURCES: readonly EngineSource[] = [...NATIVES, ...TOKENS, ...AIRDROPS, ...PROTOCOL_CLAIMS];

export const ENGINE_WALLET_LEVEL_CATALOG_IDS = new Set(
  ENGINE_SOURCES.filter((source) => source.catalogId && source.walletLevel).map((source) => source.catalogId as string),
);

export function getEngineSource(id: string): EngineSource | undefined {
  return ENGINE_SOURCES.find((source) => source.id === id);
}

/** Always check natives, Ethereum tokens, airdrops, and protocol claims. Other-chain tokens only if that chain has native balance. */
export function selectEngineSources(activeChainIds: Iterable<number>): EngineSource[] {
  const active = new Set(activeChainIds);
  return ENGINE_SOURCES.filter((source) => {
    if (source.category === "native_balance" || source.category === "airdrop" || source.category === "protocol_claim") {
      return true;
    }
    if (source.chainId === 1) return true;
    return active.has(source.chainId);
  });
}
