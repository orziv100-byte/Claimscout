import { createPublicClient, getAddress, http, type Address } from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { isRetriableRpcError, withRpcRetry } from "./rpc-retry.ts";

const RPC: Record<number, string> = {
  1: process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
  10: process.env.OP_RPC_URL || "https://optimism-rpc.publicnode.com",
  42161: process.env.ARB_RPC_URL || "https://arbitrum-one-rpc.publicnode.com",
  8453: process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com",
  137: process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
};

function checksumAddress(address: Address): Address {
  return getAddress(address.toLowerCase() as Address);
}

const CHAINS = {
  1: mainnet,
  10: optimism,
  42161: arbitrum,
  8453: base,
  137: polygon,
} as const;

export function engineClient(chainId: number) {
  const url = RPC[chainId];
  const chain = CHAINS[chainId as keyof typeof CHAINS];
  if (!url || !chain) return null;
  return createPublicClient({
    chain,
    transport: http(url, { timeout: 20_000 }),
  });
}

export const ERC20_ABI = [
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

export const ERC20_SYMBOL_BYTES32_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const ERC20_TOTAL_SUPPLY_ABI = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const IS_CLAIMED_ABI = [
  {
    type: "function",
    name: "isClaimed",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export async function nativeBalance(chainId: number, address: Address): Promise<bigint> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    return client.getBalance({ address });
  }, `nativeBalance(chain=${chainId})`);
}

export async function contractCode(chainId: number, address: Address): Promise<string> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    const code = await client.getCode({ address: checksumAddress(address) });
    return code && code !== "0x" ? code : "";
  }, `contractCode(chain=${chainId})`);
}

function decodeSymbol(value: unknown): string | null {
  if (typeof value === "string" && value && !value.startsWith("0x")) return value;
  if (typeof value === "string" && value.startsWith("0x") && value.length >= 4) {
    try {
      const hex = value.slice(2).replace(/(00)+$/g, "");
      const text = Buffer.from(hex, "hex").toString("utf8").replace(/\0/g, "").trim();
      return text || null;
    } catch {
      return null;
    }
  }
  return null;
}

async function erc20Meta(
  chainId: number,
  token: Address,
  expected?: { symbol?: string; decimals?: number },
): Promise<{ decimals: number; symbol: string }> {
  const client = engineClient(chainId);
  if (!client) throw new Error(`No RPC for chain ${chainId}`);
  let decimals = expected?.decimals;
  let decimalsError: string | undefined;
  try {
    const rawDecimals = Number(
      await client.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }),
    );
    if (Number.isFinite(rawDecimals) && rawDecimals >= 0 && rawDecimals <= 36) decimals = rawDecimals;
    else decimalsError = `decimals() returned ${rawDecimals}`;
  } catch (err) {
    decimalsError = err instanceof Error ? err.message : "decimals() failed";
  }
  if (decimals == null) {
    throw new Error(`Token ${token} decimals unavailable (${decimalsError ?? "no fallback"})`);
  }
  let symbol = expected?.symbol;
  let symbolError: string | undefined;
  try {
    symbol =
      decodeSymbol(await client.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })) ?? symbol;
  } catch (err) {
    symbolError = err instanceof Error ? err.message : "symbol() failed";
    try {
      symbol =
        decodeSymbol(
          await client.readContract({
            address: token,
            abi: ERC20_SYMBOL_BYTES32_ABI,
            functionName: "symbol",
          }),
        ) ?? symbol;
      symbolError = undefined;
    } catch (bytesErr) {
      symbolError = `${symbolError}; bytes32 symbol() ${bytesErr instanceof Error ? bytesErr.message : "failed"}`;
    }
  }
  if (!symbol) {
    throw new Error(`Token ${token} symbol unavailable (${symbolError ?? "no fallback"})`);
  }
  return { decimals, symbol };
}

export async function erc20Balance(
  chainId: number,
  token: Address,
  address: Address,
  expected?: { symbol?: string; decimals?: number },
): Promise<{ raw: bigint; decimals: number; symbol: string }> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    const code = await client.getCode({ address: token });
    if (!code || code === "0x") {
      throw new Error(`Token ${token} has no contract code on chain ${chainId}`);
    }
    let raw: bigint;
    try {
      raw = await client.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
    } catch (err) {
      throw new Error(
        `RPC balanceOf failed for ${token} on chain ${chainId}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
    const meta = await erc20Meta(chainId, token, expected);
    return { raw, ...meta };
  }, `erc20Balance(chain=${chainId},token=${token})`);
}

export async function erc20TotalSupply(
  chainId: number,
  token: Address,
  expected?: { symbol?: string; decimals?: number },
): Promise<{ raw: bigint; decimals: number; symbol: string }> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    const code = await client.getCode({ address: token });
    if (!code || code === "0x") {
      throw new Error(`Token ${token} has no contract code on chain ${chainId}`);
    }
    let raw: bigint;
    try {
      raw = await client.readContract({
        address: token,
        abi: ERC20_TOTAL_SUPPLY_ABI,
        functionName: "totalSupply",
      });
    } catch (err) {
      throw new Error(
        `RPC totalSupply failed for ${token} on chain ${chainId}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
    const meta = await erc20Meta(chainId, token, expected);
    return { raw, ...meta };
  }, `erc20TotalSupply(chain=${chainId},token=${token})`);
}

const CLAIM_PERIOD_ENDS_ABI = [
  {
    type: "function",
    name: "claimPeriodEnds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function readClaimPeriodEnds(chainId: number, token: Address): Promise<bigint> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    const code = await client.getCode({ address: token });
    if (!code || code === "0x") throw new Error(`Token ${token} has no contract code on chain ${chainId}`);
    return client.readContract({ address: token, abi: CLAIM_PERIOD_ENDS_ABI, functionName: "claimPeriodEnds" });
  }, `readClaimPeriodEnds(chain=${chainId},token=${token})`);
}

export async function distributorIsClaimed(chainId: number, distributor: Address, index: bigint): Promise<boolean> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    const code = await client.getCode({ address: distributor });
    if (!code || code === "0x") throw new Error(`Distributor ${distributor} has no contract code on chain ${chainId}`);
    return client.readContract({
      address: distributor,
      abi: IS_CLAIMED_ABI,
      functionName: "isClaimed",
      args: [index],
    });
  }, `distributorIsClaimed(chain=${chainId},distributor=${distributor})`);
}

export async function transactionCount(chainId: number, address: Address): Promise<number> {
  return withRpcRetry(async () => {
    const client = engineClient(chainId);
    if (!client) throw new Error(`No RPC for chain ${chainId}`);
    return client.getTransactionCount({ address });
  }, `transactionCount(chain=${chainId})`);
}

const COMP_ACCRUED_ABI = [
  {
    type: "function",
    name: "compAccrued",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function readCompAccrued(comptroller: Address, account: Address): Promise<bigint> {
  return withRpcRetry(async () => {
    const client = engineClient(1);
    if (!client) throw new Error("No RPC for chain 1");
    const code = await client.getCode({ address: comptroller });
    if (!code || code === "0x") throw new Error(`Comptroller ${comptroller} has no contract code`);
    return client.readContract({
      address: comptroller,
      abi: COMP_ACCRUED_ABI,
      functionName: "compAccrued",
      args: [account],
    });
  }, `readCompAccrued(comptroller=${comptroller})`);
}

const STK_REWARDS_ABI = [
  {
    type: "function",
    name: "getTotalRewardsBalance",
    stateMutability: "view",
    inputs: [{ name: "staker", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function readStkAaveRewards(stkAave: Address, staker: Address): Promise<bigint> {
  return withRpcRetry(async () => {
    const client = engineClient(1);
    if (!client) throw new Error("No RPC for chain 1");
    const code = await client.getCode({ address: stkAave });
    if (!code || code === "0x") throw new Error(`stkAAVE ${stkAave} has no contract code`);
    return client.readContract({
      address: stkAave,
      abi: STK_REWARDS_ABI,
      functionName: "getTotalRewardsBalance",
      args: [staker],
    });
  }, `readStkAaveRewards(stkAave=${stkAave})`);
}

const RAY = 10n ** 27n;

const MAKER_POT_ABI = [
  {
    type: "function",
    name: "pie",
    stateMutability: "view",
    inputs: [{ name: "usr", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "chi",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** DAI in the Maker DSR: pie(usr) * chi() / RAY. */
export async function readMakerDsrDai(pot: Address, account: Address): Promise<bigint> {
  return withRpcRetry(async () => {
    const client = engineClient(1);
    if (!client) throw new Error("No RPC for chain 1");
    const code = await client.getCode({ address: pot });
    if (!code || code === "0x") throw new Error(`Maker Pot ${pot} has no contract code`);
    const pie = await client.readContract({
      address: pot,
      abi: MAKER_POT_ABI,
      functionName: "pie",
      args: [account],
    });
    if (pie === 0n) return 0n;
    const chi = await client.readContract({
      address: pot,
      abi: MAKER_POT_ABI,
      functionName: "chi",
    });
    return (pie * chi) / RAY;
  }, `readMakerDsrDai(pot=${pot})`);
}

const VECRV_LOCKED_ABI = [
  {
    type: "function",
    name: "locked",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "amount", type: "int128" },
      { name: "end", type: "uint256" },
    ],
  },
] as const;

/** Curve VotingEscrow leftover lock. amount is CRV (18 decimals); end is unix expiry. */
export async function readVeCrvLocked(
  escrow: Address,
  account: Address,
): Promise<{ amount: bigint; end: bigint }> {
  return withRpcRetry(async () => {
    const client = engineClient(1);
    if (!client) throw new Error("No RPC for chain 1");
    const code = await client.getCode({ address: escrow });
    if (!code || code === "0x") throw new Error(`veCRV ${escrow} has no contract code`);
    const locked = await client.readContract({
      address: escrow,
      abi: VECRV_LOCKED_ABI,
      functionName: "locked",
      args: [account],
    });
    const raw = locked[0];
    return { amount: raw < 0n ? 0n : raw, end: locked[1] };
  }, `readVeCrvLocked(escrow=${escrow})`);
}

const AAVE_V3_ACCOUNT_ABI = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

/** Aave v3 account leftover. Base units are USD with 8 decimals. */
export async function readAaveV3Account(
  pool: Address,
  account: Address,
): Promise<{ collateralBase: bigint; debtBase: bigint }> {
  return withRpcRetry(async () => {
    const client = engineClient(1);
    if (!client) throw new Error("No RPC for chain 1");
    const code = await client.getCode({ address: pool });
    if (!code || code === "0x") throw new Error(`Aave v3 Pool ${pool} has no contract code`);
    const data = await client.readContract({
      address: pool,
      abi: AAVE_V3_ACCOUNT_ABI,
      functionName: "getUserAccountData",
      args: [account],
    });
    return { collateralBase: data[0], debtBase: data[1] };
  }, `readAaveV3Account(pool=${pool})`);
}

const LIDO_QUEUE_ABI = [
  {
    type: "function",
    name: "getWithdrawalRequests",
    stateMutability: "view",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getWithdrawalStatus",
    stateMutability: "view",
    inputs: [{ name: "_requestIds", type: "uint256[]" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "amountOfStETH", type: "uint256" },
          { name: "amountOfShares", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "isFinalized", type: "bool" },
          { name: "isClaimed", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const MAX_LIDO_WITHDRAWALS = 20;

export async function lidoWithdrawalScan(
  queue: Address,
  owner: Address,
): Promise<{ requestCount: number; checked: number; leftover: number; amountStEth: bigint }> {
  const client = engineClient(1);
  if (!client) throw new Error("No RPC for chain 1");
  const queueAddress = checksumAddress(queue);
  const ownerAddress = checksumAddress(owner);
  const code = await withRpcRetry(
    () => client.getCode({ address: queueAddress }),
    `lidoWithdrawalScan.getCode(queue=${queue})`,
  );
  if (!code || code === "0x") throw new Error(`Lido WithdrawalQueue ${queueAddress} has no contract code`);
  const ids = await withRpcRetry(
    () =>
      client.readContract({
        address: queueAddress,
        abi: LIDO_QUEUE_ABI,
        functionName: "getWithdrawalRequests",
        args: [ownerAddress],
      }),
    `lidoWithdrawalScan.getWithdrawalRequests(queue=${queue})`,
  );
  const requestCount = ids.length;
  const checkedIds = ids.slice(0, MAX_LIDO_WITHDRAWALS);
  if (checkedIds.length === 0) return { requestCount, checked: 0, leftover: 0, amountStEth: 0n };
  const statuses = await withRpcRetry(
    () =>
      client.readContract({
        address: queueAddress,
        abi: LIDO_QUEUE_ABI,
        functionName: "getWithdrawalStatus",
        args: [checkedIds],
      }),
    `lidoWithdrawalScan.getWithdrawalStatus(queue=${queue})`,
  );
  let leftover = 0;
  let amountStEth = 0n;
  for (const row of statuses) {
    if (row.isFinalized && !row.isClaimed) {
      leftover += 1;
      amountStEth += row.amountOfStETH;
    }
  }
  return { requestCount, checked: checkedIds.length, leftover, amountStEth };
}

const ERC721_ENUM_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const UNI_V3_POSITIONS_ABI = [
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

const UNI_V3_COLLECT_ABI = [
  {
    type: "function",
    name: "collect",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount0Max", type: "uint128" },
          { name: "amount1Max", type: "uint128" },
        ],
      },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
] as const;

export const MAX_UNI_V3_POSITIONS = 20;
const MAX_UINT128 = (1n << 128n) - 1n;

export type UniV3PositionScan = {
  nftCount: number;
  checked: number;
  leftover: number;
  withLiquidity: number;
  withFees: number;
};

export async function uniV3PositionScan(
  npm: Address,
  owner: Address,
  maxPositions = MAX_UNI_V3_POSITIONS,
): Promise<UniV3PositionScan> {
  const client = engineClient(1);
  if (!client) throw new Error("No RPC for chain 1");
  const code = await withRpcRetry(
    () => client.getCode({ address: npm }),
    `uniV3PositionScan.getCode(npm=${npm})`,
  );
  if (!code || code === "0x") throw new Error(`Uniswap V3 NPM ${npm} has no contract code`);
  const nftCount = Number(
    await withRpcRetry(
      () =>
        client.readContract({
          address: npm,
          abi: ERC721_ENUM_ABI,
          functionName: "balanceOf",
          args: [owner],
        }),
      `uniV3PositionScan.balanceOf(npm=${npm})`,
    ),
  );
  if (!Number.isFinite(nftCount) || nftCount <= 0) {
    return { nftCount: 0, checked: 0, leftover: 0, withLiquidity: 0, withFees: 0 };
  }
  const checked = Math.min(nftCount, maxPositions);
  let leftover = 0;
  let withLiquidity = 0;
  let withFees = 0;
  for (let index = 0; index < checked; index += 1) {
    const tokenId = await withRpcRetry(
      () =>
        client.readContract({
          address: npm,
          abi: ERC721_ENUM_ABI,
          functionName: "tokenOfOwnerByIndex",
          args: [owner, BigInt(index)],
        }),
      `uniV3PositionScan.tokenOfOwnerByIndex(npm=${npm},index=${index})`,
    );
    const position = await withRpcRetry(
      () =>
        client.readContract({
          address: npm,
          abi: UNI_V3_POSITIONS_ABI,
          functionName: "positions",
          args: [tokenId],
        }),
      `uniV3PositionScan.positions(npm=${npm},tokenId=${tokenId})`,
    );
    const liquidity = position[7];
    const tokensOwed0 = position[10];
    const tokensOwed1 = position[11];
    let fees = tokensOwed0 > 0n || tokensOwed1 > 0n;
    try {
      const simulated = await withRpcRetry(
        () =>
          client.simulateContract({
            address: npm,
            abi: UNI_V3_COLLECT_ABI,
            functionName: "collect",
            args: [
              {
                tokenId,
                recipient: owner,
                amount0Max: MAX_UINT128,
                amount1Max: MAX_UINT128,
              },
            ],
            account: owner,
          }),
        `uniV3PositionScan.collect(npm=${npm},tokenId=${tokenId})`,
      );
      fees = simulated.result[0] > 0n || simulated.result[1] > 0n || fees;
    } catch (err) {
      if (isRetriableRpcError(err)) throw err;
      // collect() is not view; a revert is not leftover proof. Keep tokensOwed.
    }
    const hasLiquidity = liquidity > 0n;
    if (hasLiquidity) withLiquidity += 1;
    if (fees) withFees += 1;
    if (hasLiquidity || fees) leftover += 1;
  }
  return { nftCount, checked, leftover, withLiquidity, withFees };
}
