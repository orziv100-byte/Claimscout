import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export const SSRF_CODE = "SSRF_BLOCKED" as const;

export class SsrfError extends Error {
  readonly code = SSRF_CODE;
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

export type LookupFn = (hostname: string) => Promise<string[]>;
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_REDIRECTS = 5;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "metadata.internal",
  "instance-data",
  "internal",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".localnet",
];

export type AssertSafeUrlOptions = {
  lookup?: LookupFn;
};

export async function defaultLookup(hostname: string): Promise<string[]> {
  const rows = await dns.lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isBlockedIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  const asV4 = tryParseIPv4(address);
  if (asV4) return isBlockedIPv4(asV4);
  return true;
}

export async function assertSafeUrl(raw: string, opts: AssertSafeUrlOptions = {}): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SsrfError("URL could not be parsed.");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SsrfError("Only http and https URLs can be fetched.");
  }
  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) throw new SsrfError("URL host is missing.");
  if (isBlockedHostname(hostname)) {
    throw new SsrfError("Local and internal hostnames are blocked.");
  }

  const literal = literalAddresses(hostname);
  if (literal.length) {
    for (const address of literal) {
      if (isBlockedIp(address)) {
        throw new SsrfError("Private, loopback, link-local, and reserved addresses are blocked.");
      }
    }
    return parsed;
  }

  const lookup = opts.lookup ?? defaultLookup;
  let resolved: string[];
  try {
    resolved = await lookup(hostname);
  } catch {
    throw new SsrfError("DNS lookup failed; the host was not fetched.");
  }
  if (!resolved.length) {
    throw new SsrfError("DNS lookup returned no addresses.");
  }
  for (const address of resolved) {
    if (isBlockedIp(address)) {
      throw new SsrfError("Resolved address is private, loopback, link-local, or reserved.");
    }
  }
  return parsed;
}

/** Second DNS check immediately before connect. First hop already passed assertSafeUrl. */
export async function assertNoDnsRebinding(
  hostname: string,
  lookup: LookupFn,
): Promise<void> {
  if (literalAddresses(hostname).length) return;
  let resolved: string[];
  try {
    resolved = await lookup(hostname);
  } catch {
    throw new SsrfError("DNS lookup failed; the host was not fetched.");
  }
  if (!resolved.length) throw new SsrfError("DNS lookup returned no addresses.");
  for (const address of resolved) {
    if (isBlockedIp(address)) {
      throw new SsrfError(
        "DNS rebinding blocked: second resolve returned a private, loopback, link-local, or reserved address.",
      );
    }
  }
}

export async function fetchSafe(
  url: string,
  init: RequestInit = {},
  opts: {
    lookup?: LookupFn;
    fetchImpl?: FetchImpl;
    maxRedirects?: number;
  } = {},
): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  const mode = init.redirect ?? "follow";
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const safe = await assertSafeUrl(current, { lookup: opts.lookup });
    const hostname = normalizeHostname(safe.hostname);
    if (!literalAddresses(hostname).length) {
      await assertNoDnsRebinding(hostname, opts.lookup ?? defaultLookup);
    }
    const requestInit: RequestInit = {
      ...init,
      redirect: "manual",
    };
    if (hop > 0) {
      requestInit.method = "GET";
      delete requestInit.body;
    }
    const response = await fetchImpl(safe.toString(), requestInit);
    const location = response.headers.get("location");
    const redirected = response.status >= 300 && response.status < 400 && location;
    if (!redirected) return response;
    if (mode === "error") {
      throw new SsrfError("Redirects are not allowed for this request.");
    }
    if (mode === "manual") return response;
    if (hop === maxRedirects) {
      throw new SsrfError("Too many redirects.");
    }
    current = new URL(location, safe).toString();
  }
  throw new SsrfError("Too many redirects.");
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().replace(/\.+$/, "").toLowerCase();
}

function literalAddresses(hostname: string): string[] {
  if (isIP(hostname)) return [hostname];
  const v4 = tryParseIPv4(hostname);
  return v4 ? [v4] : [];
}

export function tryParseIPv4(hostname: string): string | null {
  const host = hostname.trim();
  if (!host) return null;
  if (isIP(host) === 4) return host;
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return null;
    return intToIPv4(n >>> 0);
  }
  const parts = host.split(".");
  if (parts.length < 2 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    const value = parseIpv4Part(part);
    if (value == null) return null;
    nums.push(value);
  }
  if (nums.length === 4) {
    if (nums.some((n) => n > 255)) return null;
    return nums.join(".");
  }
  if (nums.length === 3) {
    if (nums[0]! > 255 || nums[1]! > 255 || nums[2]! > 0xffff) return null;
    return [nums[0], nums[1], (nums[2]! >> 8) & 255, nums[2]! & 255].join(".");
  }
  if (nums.length === 2) {
    if (nums[0]! > 255 || nums[1]! > 0xffffff) return null;
    const rest = nums[1]!;
    return [nums[0], (rest >> 16) & 255, (rest >> 8) & 255, rest & 255].join(".");
  }
  return null;
}

function parseIpv4Part(part: string): number | null {
  if (!part) return null;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    const n = Number.parseInt(part, 16);
    return Number.isFinite(n) ? n : null;
  }
  if (/^0[0-7]+$/.test(part)) {
    const n = Number.parseInt(part, 8);
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+$/.test(part)) {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function intToIPv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function inRange(n: number, start: number, end: number): boolean {
  return n >= start && n <= end;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n == null) return true;
  return (
    inRange(n, 0x00000000, 0x00ffffff) || // 0.0.0.0/8
    inRange(n, 0x0a000000, 0x0affffff) || // 10.0.0.0/8
    inRange(n, 0x64400000, 0x647fffff) || // 100.64.0.0/10
    inRange(n, 0x7f000000, 0x7fffffff) || // 127.0.0.0/8
    inRange(n, 0xa9fe0000, 0xa9feffff) || // 169.254.0.0/16
    inRange(n, 0xac100000, 0xac1fffff) || // 172.16.0.0/12
    inRange(n, 0xc0000000, 0xc00000ff) || // 192.0.0.0/24
    inRange(n, 0xc0000200, 0xc00002ff) || // 192.0.2.0/24
    inRange(n, 0xc0a80000, 0xc0a8ffff) || // 192.168.0.0/16
    inRange(n, 0xc6120000, 0xc613ffff) || // 198.18.0.0/15
    inRange(n, 0xc6336400, 0xc63364ff) || // 198.51.100.0/24
    inRange(n, 0xcb007100, 0xcb0071ff) || // 203.0.113.0/24
    inRange(n, 0xe0000000, 0xffffffff) // 224.0.0.0/4 through 255.255.255.255
  );
}

function isBlockedIPv6(ip: string): boolean {
  const expanded = expandIPv6(ip);
  if (!expanded) return true;
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return true; // ::1
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0000") return true; // ::
  const first = Number.parseInt(expanded.slice(0, 4), 16);
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && Number.parseInt(expanded.slice(5, 9), 16) === 0x0db8) return true; // documentation
  if (expanded.startsWith("0000:0000:0000:0000:0000:ffff:")) {
    const mapped = ipv4FromMappedTail(expanded);
    return mapped ? isBlockedIPv4(mapped) : true;
  }
  if (expanded.startsWith("0064:ff9b:0000:0000:0000:0000:")) {
    const mapped = ipv4FromMappedTail(expanded);
    return mapped ? isBlockedIPv4(mapped) : true;
  }
  if (first === 0x2002) {
    const hi = Number.parseInt(expanded.slice(5, 9), 16);
    const lo = Number.parseInt(expanded.slice(10, 14), 16);
    const v4 = intToIPv4(((hi << 16) | lo) >>> 0);
    return isBlockedIPv4(v4);
  }
  return false;
}

function ipv4FromMappedTail(expanded: string): string | null {
  const parts = expanded.split(":");
  if (parts.length !== 8) return null;
  const hi = Number.parseInt(parts[6]!, 16);
  const lo = Number.parseInt(parts[7]!, 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join(".");
}

function expandIPv6(ip: string): string | null {
  const [raw] = ip.split("%");
  if (!raw) return null;
  if (raw.includes(".")) {
    const lastColon = raw.lastIndexOf(":");
    const v6 = raw.slice(0, lastColon);
    const v4 = tryParseIPv4(raw.slice(lastColon + 1));
    if (!v4) return null;
    const [a, b, c, d] = v4.split(".").map(Number);
    const mapped = `${v6}:${(((a! << 8) | b!) >>> 0).toString(16)}:${(((c! << 8) | d!) >>> 0).toString(16)}`;
    return expandIPv6(mapped);
  }
  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(":").filter(Boolean) : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing === 0 && raw !== "::")) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8) return null;
  return groups.map((group) => group.padStart(4, "0").toLowerCase()).join(":");
}
