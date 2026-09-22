import type { DiscoveredClaim, VerificationFlag } from "./types";

const SECRET_PATTERNS: { code: string; re: RegExp; message: string }[] = [
  {
    code: "seed_phrase",
    re: /\b(seed phrase|secret phrase|recovery phrase|mnemonic(?:\s+phrase)?)\b/i,
    message: "Result mentions seed/recovery phrases. PoolIndex never surfaces or recovers secrets.",
  },
  {
    code: "private_key",
    re: /\b(private key|privkey|wif|wallet dump|key leak)\b/i,
    message: "Result mentions private keys or wallet dumps. Blocked.",
  },
  {
    code: "hex_key",
    re: /(?:^|[^0-9a-fA-F])[0-9a-fA-F]{64}(?:[^0-9a-fA-F]|$)/,
    message: "Result contains a 64-character hex string that could be key material. Blocked.",
  },
  {
    code: "brute_force",
    re: /\b(brute[- ]?force|crack(?:ed|ing)? (?:wallet|key)|brainwallet generator)\b/i,
    message: "Result describes brute-forcing or cracking wallets. Blocked.",
  },
  {
    code: "unauthorized",
    re: /\b(hack(?:ed|ing) wallet|stolen funds|drain(?:er)?|approve-all|unlimited approval scam)\b/i,
    message: "Result looks like theft, drainers, or unauthorized access. Blocked.",
  },
];

const SCAM_PATTERNS: { code: string; re: RegExp; message: string }[] = [
  {
    code: "send_first",
    re: /\b(send (?:eth|btc|usdt|crypto)|double your|guaranteed return|connect to validate)\b/i,
    message: "Asks you to send funds or 'validate' a wallet — classic giveaway scam.",
  },
  {
    code: "dm_claim",
    re: /\b(dm me|telegram admin|whatsapp support|connect wallet to receive)\b/i,
    message: "Claim path goes through DMs or a random connect-wallet page.",
  },
];

const BLOCKED_HOSTS = new Set([
  "privatekeys.pw",
  "keys.lol",
  "lbc.cryptoguru.org",
  "keyhunter",
  "pastebin.com",
  "paste.ee",
  "ghostbin.com",
]);

const TYPOSQUATS = [
  "uniswap",
  "ethereum",
  "opensea",
  "metamask",
  "coinbase",
  "binance",
  "arbitrurn",
  "claim-airdrop",
];

export function looksLikeSecret(text: string): { code: string; message: string } | null {
  for (const rule of SECRET_PATTERNS) {
    if (rule.re.test(text)) return { code: rule.code, message: rule.message };
  }
  return null;
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function reservedLookupHost(host: string): string | null {
  if (host === "example.com" || host === "example.org" || host === "example.net" || host.endsWith(".example")) {
    return "This is a documentation placeholder (example.com/org), not a real claim site.";
  }
  if (host.endsWith(".invalid") || host.endsWith(".test") || host.endsWith(".localhost")) {
    return "This hostname uses a reserved TLD and cannot exist on the public internet.";
  }
  return null;
}

export function isBlockedHost(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  if ([...BLOCKED_HOSTS].some((b) => host === b || host.endsWith(`.${b}`))) return true;
  return false;
}

const AUTOMATION_RE =
  /\b(auto-?claim|autoclaimer|automator|faucetware|auto-?booster|clicker|\w*bot|auto[- ]?(?:connect|farm|claim|mining|mine|task|ref|click)|airdrops?[- ]?hunter|airdrops?[- ]?claimer|airdrops?[- ]?rescue|claim[- ]?hunter|claim[- ]?bot|(?:mass|multi|bulk)[- ]?claimer|claimer|scraper|several wallets|transfer all the tokens)\b/i;

export function looksLikeAutomation(text: string): boolean {
  return AUTOMATION_RE.test(text);
}

export function scanTextFlags(text: string): VerificationFlag[] {
  const flags: VerificationFlag[] = [];
  const secret = looksLikeSecret(text);
  if (secret) {
    flags.push({ severity: "danger", code: secret.code, message: secret.message });
  }
  if (looksLikeAutomation(text)) {
    flags.push({
      severity: "danger",
      code: "automation",
      message: "Result describes claim automation, airdrop hunters, or bots. Out of scope.",
    });
  }
  for (const rule of SCAM_PATTERNS) {
    if (rule.re.test(text)) {
      flags.push({ severity: "danger", code: rule.code, message: rule.message });
    }
  }
  return flags;
}

export function scanUrlFlags(url: string): VerificationFlag[] {
  const flags: VerificationFlag[] = [];
  const host = hostOf(url);
  if (!host) {
    flags.push({
      severity: "danger",
      code: "invalid_url",
      message: "URL could not be parsed.",
    });
    return flags;
  }
  const reserved = reservedLookupHost(host);
  if (reserved) {
    flags.push({
      severity: "warning",
      code: "reserved_host",
      message: reserved,
    });
  }
  if (isBlockedHost(url)) {
    flags.push({
      severity: "danger",
      code: "blocked_host",
      message: "This host is associated with key scanning, dumps, or paste leaks — out of scope.",
    });
  }
  if (host.endsWith(".tk") || host.endsWith(".gq") || host.endsWith(".ml")) {
    flags.push({
      severity: "warning",
      code: "disposable_tld",
      message: "Disposable TLD often used in phishing campaigns.",
    });
  }
  const compact = host.replace(/[^a-z0-9]/g, "");
  for (const brand of TYPOSQUATS) {
    if (compact.includes(brand) && !host.includes(brand.replace("arbitrurn", "arbitrum"))) {
      if (
        !host.endsWith("uniswap.org") &&
        !host.endsWith("ethereum.org") &&
        !host.endsWith("coinbase.com") &&
        !host.endsWith("metamask.io")
      ) {
        flags.push({
          severity: "warning",
          code: "brand_lookalike",
          message: `Host resembles “${brand}” but is not an official domain.`,
        });
        break;
      }
    }
  }
  return flags;
}

export function shouldBlockDiscovery(input: {
  title: string;
  summary: string;
  url: string;
}): { blocked: true; reason: string } | { blocked: false } {
  if (isBlockedHost(input.url)) {
    return { blocked: true, reason: "blocked_host" };
  }
  const blob = `${input.title}\n${input.summary}\n${input.url}`;
  if (looksLikeDeveloperTooling(input.title, input.summary)) {
    return { blocked: true, reason: "developer_tooling" };
  }
  const danger = scanTextFlags(blob).find((flag) => flag.severity === "danger");
  if (danger) return { blocked: true, reason: danger.code };
  return { blocked: false };
}

export function inferKind(text: string): DiscoveredClaim["kind"] {
  const t = text.toLowerCase();
  if (/\bfaucet\b/.test(t)) return "faucet";
  if (/\bairdrop\b/.test(t)) return "airdrop";
  if (/\bgiveaway\b/.test(t)) return "giveaway";
  if (/\bpuzzle\b|\bcontest\b/.test(t)) return "puzzle";
  if (/\btestnet\b/.test(t)) return "testnet";
  if (/\bredeem|redemption|voucher\b/.test(t)) return "redemption";
  if (/\bcommunity reward|retroactive\b/.test(t)) return "community";
  if (/\bpromo|promotional\b/.test(t)) return "promotional";
  return "unknown";
}

export function publicOfferHint(text: string): boolean {
  return /\b(airdrop|faucet|giveaway|public claim|merkle distributor|testnet reward|redeem|first come)\b/i.test(
    text,
  );
}

const DEVELOPER_TOOLING =
  /\b(starter|boilerplate|template|scaffold|hardhat|foundry|forge-std|openzeppelin contracts|merkle-airdrop-starter|multisender|multi-?sender|airdrop-contract|nft-token-drop|erc20-airdrop|merkle-distributor-tutorial)\b/i;

export function looksLikeDeveloperTooling(title: string, summary = ""): boolean {
  return DEVELOPER_TOOLING.test(`${title} ${summary}`);
}

export const DEVELOPER_TOOLING_FLAG =
  "Developer tooling — a repo for building airdrops, not a claim you can redeem from this page.";
