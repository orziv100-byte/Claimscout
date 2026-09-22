import type { CatalogClaim, Claimability } from "./types";

export const CONTRACT_BALANCE_NOT_CLAIMABLE =
  "Remaining tokens in a distributor contract do not prove this is claimable. Eligibility, a valid proof, and an open claim path must be confirmed independently.";

const OPEN_CLAIMABILITY: Record<string, Claimability> = {
  "freebitco-in": "confirmed_live_claim",
  "sepolia-pow-faucet": "confirmed_live_claim",
  "alchemy-sepolia-faucet": "confirmed_live_claim",
  "google-cloud-web3-faucet": "confirmed_live_claim",
  "chainlink-faucets": "confirmed_live_claim",
  "base-sepolia-faucet": "confirmed_live_claim",
  "bitcoin-puzzle-2015": "eligibility_unknown",
  "ethereum-foundation-testnet-notes": "eligibility_unknown",
  "uniswap-socks": "eligibility_unknown",
};

function attachClaimability(claim: Omit<CatalogClaim, "claimability">): CatalogClaim {
  let claimability: Claimability;
  if (claim.onChain?.remainingMethod === "unsupported") {
    claimability = "unsupported";
  } else if (claim.status === "unclaimed_remaining") {
    claimability = "unclaimed_contract_balance_only";
  } else if (claim.status === "expired" || claim.status === "archived") {
    claimability = "expired";
  } else if (claim.status === "open") {
    const mapped = OPEN_CLAIMABILITY[claim.id];
    if (!mapped) {
      throw new Error(`Open catalog entry ${claim.id} is missing a claimability audit.`);
    }
    claimability = mapped;
  } else {
    claimability = "eligibility_unknown";
  }
  const warnings =
    claimability === "unclaimed_contract_balance_only" && !claim.warnings.includes(CONTRACT_BALANCE_NOT_CLAIMABLE)
      ? [...claim.warnings, CONTRACT_BALANCE_NOT_CLAIMABLE]
      : claim.warnings;
  return { ...claim, claimability, warnings };
}

const CATALOG_ENTRIES: Array<Omit<CatalogClaim, "claimability">> = [
  {
    id: "uniswap-uni-airdrop",
    title: "Uniswap UNI retroactive airdrop",
    summary:
      "September 2020 public airdrop to early Uniswap users. The Merkle distributor has no expiry, and unclaimed UNI has remained in the contract for years.",
    kind: "airdrop",
    status: "unclaimed_remaining",
    legitimacy: "official",
    chain: "ethereum",
    asset: "UNI",
    announcedAt: "2020-09-16",
    eligibility:
      "Addresses that swapped or provided liquidity on Uniswap v1/v2 before 1 September 2020, or that held a SOCKS token. Proofs were published with the airdrop.",
    howToVerify:
      "Confirm your address in the published merkle data, then read UNI.balanceOf(distributor) on Ethereum to see whether unclaimed tokens remain. Remaining contract balance is not proof you can claim. Claim only through the official app or a verified distributor contract.",
    warnings: [
      "Third-party “UNI claim” sites are a common phishing vector.",
      "A merkle proof is required. This app will not invent or brute-force proofs.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "Uniswap blog",
        url: "https://blog.uniswap.org/uni",
        publishedAt: "2020-09-16",
      },
      {
        kind: "github",
        label: "uniswap-merkle-distributor",
        url: "https://github.com/Uniswap/merkle-distributor",
      },
      {
        kind: "explorer",
        label: "Distributor on Etherscan",
        url: "https://etherscan.io/address/0x090D4613473dEE047c3f27026eC4D8bd3C4F1aca",
      },
    ],
    officialUrl: "https://app.uniswap.org/",
    archiveUrl:
      "https://web.archive.org/web/20200917000000/https://uniswap.org/blog/uni/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      distributor: "0x090D4613473dEE047c3f27026eC4D8bd3C4F1aca",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      explorerDistributorUrl:
        "https://etherscan.io/address/0x090D4613473dEE047c3f27026eC4D8bd3C4F1aca",
    },
    action: {
      type: "official_ui",
      url: "https://app.uniswap.org/",
      label: "Open Uniswap app",
    },
    tags: ["merkle", "retroactive", "no-deadline"],
  },
  {
    id: "ens-airdrop",
    title: "ENS token airdrop",
    summary:
      "November 2021 public airdrop to accounts that held a .eth name for at least 90 days and still had it as of 31 October 2021.",
    kind: "airdrop",
    status: "unclaimed_remaining",
    legitimacy: "official",
    chain: "ethereum",
    asset: "ENS",
    announcedAt: "2021-11-08",
    eligibility:
      "Eligible .eth accounts from the published snapshot. Claims are submitted with a merkle proof against the ENS token contract.",
    howToVerify:
      "Use claim.ens.domains or read the token contract’s merkle root / claimed mapping. Remaining unclaimed ENS can be observed on-chain; a remaining balance is not proof of eligibility.",
    warnings: [
      "Only use claim.ens.domains or the verified ENS token contract.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "ENS claim portal",
        url: "https://claim.ens.domains/",
        publishedAt: "2021-11-08",
      },
      {
        kind: "blog",
        label: "ENS DAO launch post",
        url: "https://ens.mirror.xyz/",
      },
      {
        kind: "explorer",
        label: "ENS token",
        url: "https://etherscan.io/token/0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
      },
    ],
    officialUrl: "https://claim.ens.domains/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
      distributor: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    },
    action: {
      type: "official_ui",
      url: "https://claim.ens.domains/",
      label: "Open ENS claim portal",
    },
    tags: ["ens", "nft-holders", "merkle"],
  },
  {
    id: "1inch-airdrop",
    title: "1inch token airdrop",
    summary:
      "December 2020 public airdrop to early 1inch users. Distributed via a merkle contract. Leftover tokens may still sit in the distributor; that remaining balance does not prove a given address can claim.",
    kind: "airdrop",
    status: "unclaimed_remaining",
    legitimacy: "official",
    chain: "ethereum",
    asset: "1INCH",
    announcedAt: "2020-12-25",
    eligibility:
      "Early governance/swap users included in the published 1inch merkle tree.",
    howToVerify:
      "Check the official 1inch airdrop documentation and the merkle distributor token balance.",
    warnings: ["Impersonator airdrop domains are common around 1INCH."],
    sources: [
      {
        kind: "project_site",
        label: "1inch airdrop",
        url: "https://1inch.io/airdrop/",
        publishedAt: "2020-12-25",
      },
      {
        kind: "explorer",
        label: "1INCH token",
        url: "https://etherscan.io/token/0x111111111117dC0aa78b770fA6A738034120C302",
      },
    ],
    officialUrl: "https://1inch.io/airdrop/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0x111111111117dC0aa78b770fA6A738034120C302",
      distributor: "0xE295aD71242373C37C5FdA7B57F26f9eA00b0ab0",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0x111111111117dC0aa78b770fA6A738034120C302",
    },
    action: {
      type: "official_ui",
      url: "https://1inch.io/airdrop/",
      label: "Open 1inch airdrop page",
    },
    tags: ["aggregator", "merkle"],
  },
  {
    id: "gitcoin-gtc-airdrop",
    title: "Gitcoin GTC airdrop",
    summary:
      "May 2021 public airdrop to Gitcoin contributors, donors, and stewards as part of the GTC launch.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "ethereum",
    asset: "GTC",
    announcedAt: "2021-05-25",
    eligibility:
      "Users who donated, completed bounties, or were otherwise in the published GTC distribution lists.",
    howToVerify:
      "Confirm against Gitcoin governance docs and the GTC token distribution addresses.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "Gitcoin",
        url: "https://www.gitcoin.co/",
        publishedAt: "2021-05-25",
      },
      {
        kind: "explorer",
        label: "GTC token",
        url: "https://etherscan.io/token/0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",
      },
    ],
    officialUrl: "https://www.gitcoin.co/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",
      distributor: "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F",
    },
    action: {
      type: "official_ui",
      url: "https://www.gitcoin.co/",
      label: "Open Gitcoin",
    },
    tags: ["public-goods", "retroactive"],
  },
  {
    id: "dydx-airdrop",
    title: "dYdX retroactive airdrop",
    summary:
      "September 2021 public trader rewards / retroactive distribution via MerkleDistributorV1. Remaining inventory is not wallet eligibility.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "ethereum",
    asset: "DYDX",
    announcedAt: "2021-08-03",
    eligibility:
      "Users with historical trading activity on dYdX matching the published Merkle rewards tree for each epoch.",
    howToVerify:
      "Official path is MerkleDistributorV1.claimRewards(cumulativeAmount, merkleProof) at 0x01d3348601968aB85b4bb028979006eac235a588, with proofs from rewards-data.dydx.foundation. PoolIndex does not currently have a verifiable local copy of that tree. The historical DYDX ERC-20 currently has no bytecode, so remaining inventory cannot be read.",
    warnings: [
      "Claim portals other than official dYdX domains should be treated as hostile.",
      "Unverifiable: the DYDX token at 0x92D6C1e31e14520e676a3F12C6Bd4a44a5B4AB21 currently has no contract code, so PoolIndex will not invent a remaining-pool figure or a wallet verdict.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "dYdX blog",
        url: "https://www.dydx.foundation/",
        publishedAt: "2021-08-03",
      },
      {
        kind: "explorer",
        label: "MerkleDistributorV1",
        url: "https://etherscan.io/address/0x01d3348601968aB85b4bb028979006eac235a588",
      },
    ],
    officialUrl: "https://www.dydx.foundation/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0x92D6C1e31e14520e676a3F12C6Bd4a44a5B4AB21",
      distributor: "0x01d3348601968aB85b4bb028979006eac235a588",
      remainingMethod: "unsupported",
      remainingUnsupportedReason:
        "Unsupported: DYDX token 0x92D6C1e31e14520e676a3F12C6Bd4a44a5B4AB21 currently has no contract code, so remaining inventory cannot be read. MerkleDistributorV1.claimRewards(cumulativeAmount, bytes32[]) is the eligibility method and requires the official epoch merkle tree, which PoolIndex does not host.",
      explorerTokenUrl:
        "https://etherscan.io/token/0x92D6C1e31e14520e676a3F12C6Bd4a44a5B4AB21",
      explorerDistributorUrl:
        "https://etherscan.io/address/0x01d3348601968aB85b4bb028979006eac235a588",
    },
    action: {
      type: "official_ui",
      url: "https://www.dydx.foundation/",
      label: "Open dYdX Foundation",
    },
    tags: ["perpetuals", "merkle"],
  },
  {
    id: "optimism-airdrop-1",
    title: "Optimism airdrop #1",
    summary:
      "May 2022 public OP airdrop to DAO voters, Gitcoin donors, multisig signers, and early Optimism users. Later rounds followed; round 1’s claim window closed.",
    kind: "airdrop",
    status: "expired",
    legitimacy: "official",
    chain: "optimism",
    asset: "OP",
    announcedAt: "2022-05-31",
    eligibility:
      "Addresses matching Optimism’s published Airdrop #1 criteria. The claim window is closed; leftover tokens returned to governance.",
    howToVerify:
      "Read Optimism governance posts for the claim deadline. Do not use third-party “late claim” sites.",
    warnings: [
      "The official window closed. Sites offering a late OP claim are almost certainly phishing.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "Optimism airdrop",
        url: "https://app.optimism.io/retropgf",
        publishedAt: "2022-05-31",
      },
      {
        kind: "blog",
        label: "Airdrop #1 announcement",
        url: "https://optimism.mirror.xyz/",
      },
    ],
    officialUrl: "https://www.optimism.io/",
    action: {
      type: "none",
      reason: "Official claim window closed. Unclaimed OP was returned to the governance treasury.",
    },
    tags: ["l2", "closed-window"],
  },
  {
    id: "arbitrum-airdrop",
    title: "Arbitrum ARB airdrop",
    summary:
      "March 2023 public airdrop to Arbitrum users, DAOs, and community members. The TokenDistributor enforced a hard claim deadline.",
    kind: "airdrop",
    status: "expired",
    legitimacy: "official",
    chain: "arbitrum",
    asset: "ARB",
    announcedAt: "2023-03-16",
    eligibility:
      "Addresses in the Arbitrum Foundation snapshot. Claimable via TokenDistributor.claim() before the on-chain deadline.",
    howToVerify:
      "Read claimableTokens(address) on the distributor. After the deadline it should revert or return zero for everyone.",
    warnings: ["Post-deadline ARB claim sites are scams."],
    sources: [
      {
        kind: "project_site",
        label: "Arbitrum Foundation",
        url: "https://arbitrum.foundation/",
        publishedAt: "2023-03-16",
      },
      {
        kind: "explorer",
        label: "TokenDistributor",
        url: "https://arbiscan.io/address/0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      },
    ],
    officialUrl: "https://arbitrum.foundation/",
    onChain: {
      chainId: 42161,
      chainLabel: "Arbitrum One",
      token: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      claimedFn: "claimableTokens",
      remainingMethod: "token_balance_of_holder",
      claimDeadline: "2023-09-24",
      explorerTokenUrl:
        "https://arbiscan.io/token/0x912CE59144191C1204E64559FE8253a0e49E6548",
      explorerDistributorUrl:
        "https://arbiscan.io/address/0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
    },
    action: {
      type: "none",
      reason: "Arbitrum set an on-chain claim deadline. Residual tokens were not left for late claims.",
    },
    tags: ["l2", "closed-window"],
  },
  {
    id: "hop-protocol-airdrop",
    title: "Hop Protocol HOP airdrop",
    summary:
      "2022 public airdrop to early Hop bridge users. Claims were made on the HOP token itself via claimTokens; leftover inventory still sits on the token contract. The on-chain claimPeriodEnds is 2022-12-09.",
    kind: "airdrop",
    status: "expired",
    legitimacy: "official",
    chain: "ethereum",
    asset: "HOP",
    announcedAt: "2022-06-09",
    eligibility: "Early Hop users in the published merkle snapshot. The official claim window closed on 2022-12-09.",
    howToVerify:
      "Read HOPToken.claimPeriodEnds and HOP.balanceOf(HOP token). Remaining tokens in the token contract after the deadline are leftover inventory, not a live claim. Wallet eligibility requires the official merkle tree plus isClaimed(index); PoolIndex does not invent that verdict.",
    warnings: [
      "The official claimPeriodEnds is 2022-12-09. Remaining HOP in the token contract is not proof a late claim is open.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "Hop Protocol",
        url: "https://hop.exchange/",
        publishedAt: "2022-06-09",
      },
      {
        kind: "github",
        label: "Hop DAO",
        url: "https://github.com/hop-protocol",
      },
      {
        kind: "explorer",
        label: "HOP token",
        url: "https://etherscan.io/token/0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC",
      },
    ],
    officialUrl: "https://hop.exchange/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC",
      distributor: "0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC",
      remainingMethod: "token_balance_of_holder",
      claimDeadline: "2022-12-09",
      explorerTokenUrl:
        "https://etherscan.io/token/0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC",
    },
    action: {
      type: "none",
      reason: "HOPToken.claimPeriodEnds is 2022-12-09. Remaining tokens in the token contract are leftover inventory, not a late claim.",
    },
    tags: ["bridge", "merkle", "closed-window"],
  },
  {
    id: "cow-protocol-airdrop",
    title: "CoW Protocol vCOW airdrop",
    summary:
      "Public airdrop to Gnosis Protocol v2 / CowSwap traders, GNO holders, and GP v1 users. Claimed as vested vCOW.",
    kind: "airdrop",
    status: "unclaimed_remaining",
    legitimacy: "official",
    chain: "ethereum",
    asset: "vCOW",
    announcedAt: "2022-03-28",
    eligibility:
      "Traders, liquidity, GNO holders, and users matching the published CowDAO allocation.",
    howToVerify: "Use the official CoW claim UI; inspect vCOW claimed mapping on-chain.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "CoW Protocol claim",
        url: "https://claim.cow.fi/",
        publishedAt: "2022-03-28",
      },
      {
        kind: "explorer",
        label: "vCOW token",
        url: "https://etherscan.io/token/0xD057B63f5E69CF1B929b356b579Cba08D7688048",
      },
    ],
    officialUrl: "https://claim.cow.fi/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0xD057B63f5E69CF1B929b356b579Cba08D7688048",
      distributor: "0xD057B63f5E69CF1B929b356b579Cba08D7688048",
      claimedFn: "hasClaimed",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0xD057B63f5E69CF1B929b356b579Cba08D7688048",
    },
    action: {
      type: "official_ui",
      url: "https://claim.cow.fi/",
      label: "Open CoW claim",
    },
    tags: ["dex", "vested"],
  },
  {
    id: "safe-token-airdrop",
    title: "Safe (Gnosis Safe) token airdrop",
    summary:
      "Public allocation to Safe users and guardians. Claimed through the official Safe token portal.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "ethereum",
    asset: "SAFE",
    announcedAt: "2022-09-01",
    eligibility: "Historical Safe users and contributors in the published allocation.",
    howToVerify: "Only use app.safe.global / official Safe token claim documentation.",
    warnings: ["Safe-themed claim clones are a frequent phishing pattern."],
    sources: [
      {
        kind: "project_site",
        label: "Safe",
        url: "https://safe.global/",
        publishedAt: "2022-09-01",
      },
      {
        kind: "explorer",
        label: "SAFE token",
        url: "https://etherscan.io/token/0x5aFE3855358E112B5647B952709E6165E1c1eEEe",
      },
    ],
    officialUrl: "https://safe.global/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0x5aFE3855358E112B5647B952709E6165E1c1eEEe",
      distributor: "0x5aFE3855358E112B5647B952709E6165E1c1eEEe",
      remainingMethod: "token_balance_of_holder",
      explorerTokenUrl:
        "https://etherscan.io/token/0x5aFE3855358E112B5647B952709E6165E1c1eEEe",
    },
    action: {
      type: "official_ui",
      url: "https://safe.global/",
      label: "Open Safe",
    },
    tags: ["multisig"],
  },
  {
    id: "looksrare-airdrop",
    title: "LooksRare LOOKS airdrop",
    summary:
      "December 2021 public airdrop to OpenSea traders who met volume thresholds. Daily trading rewards followed.",
    kind: "airdrop",
    status: "expired",
    legitimacy: "official",
    chain: "ethereum",
    asset: "LOOKS",
    announcedAt: "2021-12-31",
    eligibility: "OpenSea traders in the LooksRare snapshot plus later trading rewards.",
    howToVerify: "LooksRare airdrop pages and LOOKS token distribution.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "LooksRare",
        url: "https://looksrare.org/",
        publishedAt: "2021-12-31",
      },
    ],
    officialUrl: "https://looksrare.org/",
    action: {
      type: "official_ui",
      url: "https://looksrare.org/",
      label: "Open LooksRare",
    },
    tags: ["nft", "snapshot"],
  },
  {
    id: "gavin-andresen-bitcoin-faucet",
    title: "Gavin Andresen Bitcoin faucet (2010)",
    summary:
      "The original public Bitcoin faucet ran at freebitcoins.appspot.com and paid out test coins / small BTC to anyone. It is long empty; the pages survive in the Wayback Machine as historical public-claim documentation.",
    kind: "faucet",
    status: "archived",
    legitimacy: "official",
    chain: "bitcoin",
    asset: "BTC",
    announcedAt: "2010-06-11",
    eligibility: "Anyone who completed the public captcha while coins remained.",
    howToVerify:
      "Use Internet Archive snapshots of freebitcoins.appspot.com. Do not send bitcoin to any revival of this URL.",
    warnings: [
      "The faucet is empty. Modern clones asking for a deposit are scams.",
    ],
    sources: [
      {
        kind: "wayback",
        label: "Archived faucet",
        url: "https://web.archive.org/web/20100715000000/http://freebitcoins.appspot.com/",
        publishedAt: "2010-06-11",
      },
      {
        kind: "bitcointalk",
        label: "Bitcointalk discussion",
        url: "https://bitcointalk.org/index.php?topic=1747.0",
      },
    ],
    archiveUrl:
      "https://web.archive.org/web/20100715000000/http://freebitcoins.appspot.com/",
    action: {
      type: "none",
      reason: "Historical faucet. Funds were depleted; kept here as an archive reference, not a live claim.",
    },
    tags: ["bitcoin", "history", "archive"],
  },
  {
    id: "moon-bitcoin-faucet",
    title: "Moon Bitcoin faucet",
    summary:
      "Long-running public BTC faucet (moonbit.co.in) that paid satoshis on a timer. Still referenced in old Reddit and Bitcointalk faucet lists.",
    kind: "faucet",
    status: "archived",
    legitimacy: "documented_public",
    chain: "bitcoin",
    asset: "BTC",
    eligibility: "Public captcha claims, historically via FaucetHub / similar wallets.",
    howToVerify:
      "Check live HTTP status and Wayback snapshots. Treat any “send BTC to activate” variant as a scam.",
    warnings: ["Faucet payouts are tiny; many successors are malware or drainers."],
    sources: [
      {
        kind: "project_site",
        label: "Moon Bitcoin",
        url: "https://moonbit.co.in/",
      },
      {
        kind: "wayback",
        label: "Archived faucet page",
        url: "https://web.archive.org/web/20160501000000/https://moonbit.co.in/",
      },
      {
        kind: "reddit",
        label: "r/freebitcoin",
        url: "https://www.reddit.com/r/freebitcoin/",
      },
    ],
    officialUrl: "https://moonbit.co.in/",
    archiveUrl: "https://web.archive.org/web/20160501000000/https://moonbit.co.in/",
    action: {
      type: "official_ui",
      url: "https://moonbit.co.in/",
      label: "Open Moon Bitcoin",
    },
    tags: ["satoshi-faucet", "reddit"],
  },
  {
    id: "freebitco-in",
    title: "FreeBitco.in",
    summary:
      "Public BTC faucet plus games, launched in 2013. Claims are first-come via the site’s own account system — not a wallet-connect airdrop.",
    kind: "faucet",
    status: "open",
    legitimacy: "documented_public",
    chain: "bitcoin",
    asset: "BTC",
    announcedAt: "2013-01-01",
    eligibility: "Anyone who creates an account and passes the faucet timer/captcha.",
    howToVerify: "Use the official domain only. Inspect archives for older promotional codes.",
    warnings: [
      "This is a gambling-adjacent faucet. PoolIndex does not endorse wagering.",
    ],
    sources: [
      {
        kind: "project_site",
        label: "freebitco.in",
        url: "https://freebitco.in/",
      },
      {
        kind: "wayback",
        label: "Early snapshots",
        url: "https://web.archive.org/web/*/https://freebitco.in/",
      },
    ],
    officialUrl: "https://freebitco.in/",
    action: {
      type: "official_ui",
      url: "https://freebitco.in/",
      label: "Open freebitco.in",
    },
    tags: ["bitcoin", "account-based"],
  },
  {
    id: "blockchain-info-faucet",
    title: "blockchain.info historical faucet",
    summary:
      "Early Blockchain.com (blockchain.info) ran a public faucet that credited satoshis to new wallets. Pages are preserved in the Wayback Machine.",
    kind: "faucet",
    status: "archived",
    legitimacy: "official",
    chain: "bitcoin",
    asset: "BTC",
    eligibility: "New blockchain.info wallet users while the faucet was funded.",
    howToVerify: "Wayback snapshots of blockchain.info/faucet. The live faucet is gone.",
    warnings: ["Do not trust search ads for a revived blockchain.info faucet."],
    sources: [
      {
        kind: "wayback",
        label: "Archived faucet",
        url: "https://web.archive.org/web/20130415000000/https://blockchain.info/faucet",
      },
      {
        kind: "project_site",
        label: "Blockchain.com",
        url: "https://www.blockchain.com/",
      },
    ],
    archiveUrl:
      "https://web.archive.org/web/20130415000000/https://blockchain.info/faucet",
    action: {
      type: "none",
      reason: "Faucet retired. Archive-only reference.",
    },
    tags: ["bitcoin", "archive"],
  },
  {
    id: "sepolia-pow-faucet",
    title: "Sepolia PoW faucet",
    summary:
      "Public proof-of-work faucet for Sepolia ETH. Anyone can mine a small drip; no private keys and no mainnet funds.",
    kind: "testnet",
    status: "open",
    legitimacy: "documented_public",
    chain: "testnet-sepolia",
    asset: "Sepolia ETH",
    eligibility: "Anyone willing to run the browser PoW challenge. Rate-limited per address/IP.",
    howToVerify:
      "Confirm you are on sepolia-faucet.pk910.de and that the network is Sepolia (chain ID 11155111).",
    warnings: ["Testnet ETH has no market value. Never pay mainnet ETH for testnet funds."],
    sources: [
      {
        kind: "project_site",
        label: "PoW faucet",
        url: "https://sepolia-faucet.pk910.de/",
      },
      {
        kind: "github",
        label: "pk910 faucet source",
        url: "https://github.com/pk910/PoWFaucet",
      },
    ],
    officialUrl: "https://sepolia-faucet.pk910.de/",
    action: {
      type: "official_ui",
      url: "https://sepolia-faucet.pk910.de/",
      label: "Open Sepolia PoW faucet",
    },
    tags: ["testnet", "developer", "first-come"],
  },
  {
    id: "alchemy-sepolia-faucet",
    title: "Alchemy Sepolia faucet",
    summary:
      "Public developer faucet for Sepolia, gated by an Alchemy account. Intended for builders, not speculation.",
    kind: "testnet",
    status: "open",
    legitimacy: "official",
    chain: "testnet-sepolia",
    asset: "Sepolia ETH",
    eligibility: "Alchemy-registered developers, subject to daily limits.",
    howToVerify: "Use alchemy.com/faucets only.",
    warnings: ["Ignore search-ad copies of Alchemy faucets."],
    sources: [
      {
        kind: "project_site",
        label: "Alchemy faucets",
        url: "https://www.alchemy.com/faucets",
      },
    ],
    officialUrl: "https://www.alchemy.com/faucets",
    action: {
      type: "official_ui",
      url: "https://www.alchemy.com/faucets",
      label: "Open Alchemy faucets",
    },
    tags: ["testnet", "developer"],
  },
  {
    id: "google-cloud-web3-faucet",
    title: "Google Cloud Web3 faucet",
    summary:
      "Public faucet for several EVM testnets, requiring a Google Cloud account. Community developer reward, not a token sale.",
    kind: "testnet",
    status: "open",
    legitimacy: "official",
    chain: "testnet-sepolia",
    asset: "Testnet ETH",
    eligibility: "Google Cloud users passing the faucet UI checks.",
    howToVerify: "cloud.google.com/web3/faucet (or the current Google Cloud faucet URL).",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "Google Cloud faucet",
        url: "https://cloud.google.com/application/web3/faucet",
      },
    ],
    officialUrl: "https://cloud.google.com/application/web3/faucet",
    action: {
      type: "official_ui",
      url: "https://cloud.google.com/application/web3/faucet",
      label: "Open Google Cloud faucet",
    },
    tags: ["testnet", "developer"],
  },
  {
    id: "chainlink-faucets",
    title: "Chainlink testnet faucets",
    summary:
      "Official Chainlink faucets dispense testnet LINK and native gas on several chains for developers.",
    kind: "testnet",
    status: "open",
    legitimacy: "official",
    chain: "multi",
    asset: "Testnet LINK",
    eligibility: "Developers using the official faucets.chain.link UI.",
    howToVerify: "Only faucets.chain.link.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "Chainlink faucets",
        url: "https://faucets.chain.link/",
      },
    ],
    officialUrl: "https://faucets.chain.link/",
    action: {
      type: "official_ui",
      url: "https://faucets.chain.link/",
      label: "Open Chainlink faucets",
    },
    tags: ["testnet", "oracle"],
  },
  {
    id: "base-sepolia-faucet",
    title: "Base Sepolia faucet",
    summary:
      "Official Base documentation points developers at public Base Sepolia faucets for L2 testnet gas.",
    kind: "testnet",
    status: "open",
    legitimacy: "official",
    chain: "testnet-base-sepolia",
    asset: "Base Sepolia ETH",
    eligibility: "Anyone building on Base testnet, via official docs links.",
    howToVerify: "Start from docs.base.org — do not google random Base faucets.",
    warnings: ["Unofficial Base faucet domains are a known phishing pattern."],
    sources: [
      {
        kind: "project_site",
        label: "Base docs",
        url: "https://docs.base.org/chain/network-faucets",
      },
    ],
    officialUrl: "https://docs.base.org/chain/network-faucets",
    action: {
      type: "official_ui",
      url: "https://docs.base.org/chain/network-faucets",
      label: "Open Base faucet docs",
    },
    tags: ["testnet", "base"],
  },
  {
    id: "bitcoin-puzzle-2015",
    title: "Bitcoin cryptographic puzzle (2015)",
    summary:
      "A public puzzle funded in 2015 with increasing-difficulty ranges. Remaining unsolved ranges are first-come-first-served by whoever finds the matching key. PoolIndex will not search keys, brute-force ranges, or display partial keys.",
    kind: "puzzle",
    status: "open",
    legitimacy: "documented_public",
    chain: "bitcoin",
    asset: "BTC",
    announcedAt: "2015-01-15",
    eligibility:
      "Anyone may attempt the public puzzle. This tool only documents that it exists; it provides no solvers.",
    howToVerify:
      "Inspect the original puzzle funding transaction on a Bitcoin explorer. Do not use key-hunter websites.",
    warnings: [
      "PoolIndex never brute-forces private keys or enumerates puzzle ranges.",
      "Sites that list unsolved ranges next to “auto scan” tooling are out of scope and blocked.",
    ],
    sources: [
      {
        kind: "explorer",
        label: "Puzzle funding transaction",
        url: "https://blockstream.info/tx/08389f34c98c606322740c0be6a7125d9860bb8d5cb182c02f98461e5dd1cd6d",
        publishedAt: "2015-01-15",
      },
      {
        kind: "bitcointalk",
        label: "Bitcointalk puzzle threads",
        url: "https://bitcointalk.org/index.php?board=20.0",
      },
    ],
    action: {
      type: "none",
      reason:
        "Public puzzle documented only. No key search, no range scanning, no claim transaction from this app.",
    },
    tags: ["puzzle", "first-come", "no-bruteforce"],
  },
  {
    id: "cicada-3301",
    title: "Cicada 3301 puzzles",
    summary:
      "Public cryptographic/steganographic puzzles (2012–) that sometimes included bitcoin addresses as drop boxes. Historical; not an ongoing airdrop.",
    kind: "puzzle",
    status: "archived",
    legitimacy: "documented_public",
    chain: "bitcoin",
    asset: "BTC",
    announcedAt: "2012-01-04",
    eligibility: "Public puzzle. Remaining addresses are not a “claim portal.”",
    howToVerify: "Use original image/posts and archive.org. Ignore copycat “Cicada airdrop” sites.",
    warnings: ["Modern Cicada airdrop pages are scams."],
    sources: [
      {
        kind: "blog",
        label: "Wikipedia overview",
        url: "https://en.wikipedia.org/wiki/Cicada_3301",
      },
      {
        kind: "wayback",
        label: "Archived references",
        url: "https://web.archive.org/web/*/cicada 3301 bitcoin",
      },
    ],
    action: {
      type: "none",
      reason: "Historical puzzle. This app does not host clues or claim any related coins.",
    },
    tags: ["puzzle", "archive"],
  },
  {
    id: "bitcointalk-signature-campaigns",
    title: "Bitcointalk signature campaigns & altcoin giveaways",
    summary:
      "From ~2011 onward, projects paid users in BTC/altcoins for forum signatures and ran first-come giveaways. Many threads still list redemption instructions that may or may not function.",
    kind: "giveaway",
    status: "unknown",
    legitimacy: "documented_public",
    chain: "bitcoin",
    asset: "Various",
    eligibility:
      "Forum users who followed the publicly posted rules. Eligibility is thread-specific; many campaigns are dead.",
    howToVerify:
      "Open the original Bitcointalk thread (and its Wayback copy). Never send coins to “verify” a giveaway.",
    warnings: [
      "Unsolicited “you won a Bitcointalk giveaway” DMs are scams.",
      "Live threads that ask for a seed phrase or private key are hostile — report and skip.",
    ],
    sources: [
      {
        kind: "bitcointalk",
        label: "Bitcointalk campaigns board",
        url: "https://bitcointalk.org/index.php?board=240.0",
      },
      {
        kind: "bitcointalk",
        label: "Alternate cryptocurrencies",
        url: "https://bitcointalk.org/index.php?board=67.0",
      },
    ],
    officialUrl: "https://bitcointalk.org/",
    action: {
      type: "official_ui",
      url: "https://bitcointalk.org/index.php?board=240.0",
      label: "Browse Bitcointalk campaigns",
    },
    tags: ["forum", "giveaway", "first-come"],
  },
  {
    id: "reddit-moontips-historic",
    title: "Reddit bitcoin / ethereum community tips & faucets",
    summary:
      "r/freebitcoin, r/Bitcoin, and r/ethereum historically hosted public faucet lists, tip bots, and promotional claim posts. Most individual links rot; archives remain.",
    kind: "community",
    status: "unknown",
    legitimacy: "documented_public",
    chain: "multi",
    asset: "Various",
    eligibility: "Public subreddit posts. Each link must be verified independently.",
    howToVerify:
      "Prefer old.reddit.com permalinks plus Wayback. Skip any post that asks you to connect a wallet to a random domain.",
    warnings: ["Subreddit faucet lists are heavily infested with scams; legitimacy defaults to unverified."],
    sources: [
      {
        kind: "reddit",
        label: "r/freebitcoin",
        url: "https://www.reddit.com/r/freebitcoin/",
      },
      {
        kind: "reddit",
        label: "r/CryptoAirdrops",
        url: "https://www.reddit.com/r/CryptoAirdrops/",
      },
      {
        kind: "reddit",
        label: "r/ethereum",
        url: "https://www.reddit.com/r/ethereum/",
      },
    ],
    action: {
      type: "official_ui",
      url: "https://www.reddit.com/r/CryptoAirdrops/",
      label: "Open r/CryptoAirdrops",
    },
    tags: ["reddit", "community"],
  },
  {
    id: "ethereum-foundation-testnet-notes",
    title: "Ethereum Foundation testnet / community notes",
    summary:
      "The Foundation and ethereum.org document public testnets and point to community faucets. These are developer rewards, not mainnet token claims.",
    kind: "testnet",
    status: "open",
    legitimacy: "official",
    chain: "testnet-sepolia",
    asset: "Testnet ETH",
    eligibility: "Anyone building against public Ethereum testnets.",
    howToVerify: "Start from ethereum.org developer faucet documentation.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "ethereum.org faucets",
        url: "https://ethereum.org/en/developers/docs/networks/#testnets",
      },
    ],
    officialUrl: "https://ethereum.org/en/developers/docs/networks/#testnets",
    action: {
      type: "official_ui",
      url: "https://ethereum.org/en/developers/docs/networks/#testnets",
      label: "Open ethereum.org testnet docs",
    },
    tags: ["testnet", "docs"],
  },
  {
    id: "uniswap-socks",
    title: "Uniswap SOCKS redemption",
    summary:
      "Unisocks (SOCKS) tokens redeem 1:1 for physical socks while inventory lasts — a public, first-come redemption, not a hidden wallet drain.",
    kind: "redemption",
    status: "open",
    legitimacy: "official",
    chain: "ethereum",
    asset: "SOCKS",
    announcedAt: "2019-05-09",
    eligibility:
      "Holders of the SOCKS ERC-20. Physical redemption depends on Uniswap still honoring the program and remaining inventory.",
    howToVerify:
      "Official Unisocks site / Uniswap documentation. Remaining unredeemed SOCKS is the ERC-20 totalSupply on 0x23B608675a2B2fB1890d3ABBd85c5775c51691d5, not a balance held by that contract. Physical stock is a separate off-chain fact.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "Unisocks",
        url: "https://unisocks.exchange/",
        publishedAt: "2019-05-09",
      },
      {
        kind: "explorer",
        label: "SOCKS token",
        url: "https://etherscan.io/token/0x23B608675a2B2fB1890d3ABBd85c5775c51691d5",
      },
    ],
    officialUrl: "https://unisocks.exchange/",
    onChain: {
      chainId: 1,
      chainLabel: "Ethereum",
      token: "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5",
      remainingMethod: "token_total_supply",
      explorerTokenUrl:
        "https://etherscan.io/token/0x23B608675a2B2fB1890d3ABBd85c5775c51691d5",
    },
    action: {
      type: "official_ui",
      url: "https://unisocks.exchange/",
      label: "Open Unisocks",
    },
    tags: ["redemption", "first-come"],
  },
  {
    id: "tornado-avoided",
    title: "Skipped: mixer / exploit / key-recovery listings",
    summary:
      "PoolIndex will not index mixer refunds, exploit bounties that require attacking a live system, stolen-fund recovery, or anything that needs someone else’s seed.",
    kind: "community",
    status: "expired",
    legitimacy: "suspicious",
    chain: "offchain",
    asset: "n/a",
    eligibility: "Out of scope.",
    howToVerify: "n/a",
    warnings: ["This catalog entry exists only to document the exclusion."],
    sources: [],
    action: {
      type: "none",
      reason: "Policy exclusion — not a public promotional claim.",
    },
    tags: ["policy", "excluded"],
  },
  {
    id: "jito-solana-airdrop",
    title: "Jito JTO airdrop",
    summary:
      "Public Solana airdrop to Jito SOL holders and MEV users. Claims went through the official Jito portal.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "solana",
    asset: "JTO",
    announcedAt: "2023-12-07",
    eligibility: "jitoSOL holders and Jito MEV users in the published snapshot.",
    howToVerify: "Official Jito network claim UI only.",
    warnings: ["Solana airdrop phishing sites are extremely common."],
    sources: [
      {
        kind: "project_site",
        label: "Jito Network",
        url: "https://www.jito.network/",
        publishedAt: "2023-12-07",
      },
    ],
    officialUrl: "https://www.jito.network/",
    action: {
      type: "official_ui",
      url: "https://www.jito.network/",
      label: "Open Jito",
    },
    tags: ["solana"],
  },
  {
    id: "jupiter-jup-airdrop",
    title: "Jupiter JUP airdrop",
    summary:
      "Public Solana airdrop to Jupiter aggregator users. Subsequent rounds were announced on official Jupiter channels.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "solana",
    asset: "JUP",
    announcedAt: "2024-01-31",
    eligibility: "Jupiter users matching published snapshot rules for each round.",
    howToVerify: "jup.ag official domains only.",
    warnings: ["Fake JUP claim sites are rampant."],
    sources: [
      {
        kind: "project_site",
        label: "Jupiter",
        url: "https://jup.ag/",
        publishedAt: "2024-01-31",
      },
    ],
    officialUrl: "https://jup.ag/",
    action: {
      type: "official_ui",
      url: "https://jup.ag/",
      label: "Open Jupiter",
    },
    tags: ["solana", "dex"],
  },
  {
    id: "blur-airdrop",
    title: "Blur seasonal airdrops",
    summary:
      "Public BLUR airdrops to NFT traders who used the Blur marketplace during published seasons.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "ethereum",
    asset: "BLUR",
    announcedAt: "2023-02-14",
    eligibility: "Blur traders meeting season-specific criteria.",
    howToVerify: "blur.io official claim UI.",
    warnings: [],
    sources: [
      {
        kind: "project_site",
        label: "Blur",
        url: "https://blur.io/",
        publishedAt: "2023-02-14",
      },
    ],
    officialUrl: "https://blur.io/",
    action: {
      type: "official_ui",
      url: "https://blur.io/",
      label: "Open Blur",
    },
    tags: ["nft"],
  },
  {
    id: "layerzero-airdrop",
    title: "LayerZero ZRO airdrop",
    summary:
      "Public airdrop to protocol users. Eligibility was published by LayerZero Labs; claims went through official UI with sybil checks.",
    kind: "airdrop",
    status: "unknown",
    legitimacy: "official",
    chain: "multi",
    asset: "ZRO",
    announcedAt: "2024-06-20",
    eligibility: "Users in the LayerZero snapshot who passed sybil filters.",
    howToVerify: "layerzero.network official claim flow only.",
    warnings: ["Numerous fake ZRO claim sites request seed phrases — never enter a seed."],
    sources: [
      {
        kind: "project_site",
        label: "LayerZero",
        url: "https://layerzero.network/",
        publishedAt: "2024-06-20",
      },
    ],
    officialUrl: "https://layerzero.network/",
    action: {
      type: "official_ui",
      url: "https://layerzero.network/",
      label: "Open LayerZero",
    },
    tags: ["interop"],
  },
];

export const CATALOG: CatalogClaim[] = CATALOG_ENTRIES.map(attachClaimability);

export function getClaimById(id: string): CatalogClaim | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function searchCatalog(query: string): CatalogClaim[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.filter((c) => c.id !== "tornado-avoided");
  const parts = q.split(/\s+/).filter(Boolean);
  return CATALOG.filter((c) => {
    if (c.id === "tornado-avoided") return false;
    const hay = [
      c.title,
      c.summary,
      c.asset,
      c.kind,
      c.chain,
      c.status,
      ...c.tags,
      ...c.sources.map((s) => s.label),
    ]
      .join(" ")
      .toLowerCase();
    return parts.every((p) => hay.includes(p));
  });
}

export function filterCatalog(opts: {
  query?: string;
  kinds?: string[];
  statuses?: string[];
  chain?: string;
}): CatalogClaim[] {
  let rows = searchCatalog(opts.query ?? "");
  if (opts.kinds?.length) rows = rows.filter((c) => opts.kinds!.includes(c.kind));
  if (opts.statuses?.length) rows = rows.filter((c) => opts.statuses!.includes(c.status));
  if (opts.chain && opts.chain !== "all") rows = rows.filter((c) => c.chain === opts.chain);
  return rows;
}
