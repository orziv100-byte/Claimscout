import { searchCatalog } from "../catalog.ts";
import type { UserRecord } from "../beta-types.ts";
import { verifyUrl } from "../verify.ts";
import { belowAlertNet } from "./monitor.ts";
import { publicEngineScan } from "./scan.ts";
import { ENGINE_SOURCES } from "./sources.ts";
import { loadPreviousScan, loadScanHistory } from "./state.ts";
import { listMcpEvents } from "./mcp-events.ts";
import { countFindings, toMcpFinding, type McpFinding } from "./mcp-findings.ts";
import { McpToolError, rejectSecretInput, requireBoundWallet } from "./mcp-access.ts";
import { isMcpTool, MCP_TOOL_SCOPES, mcpToolHelp, type McpToolName } from "./mcp-tools.ts";
import { untrustedExternal } from "./mcp-untrusted.ts";
import type { McpScope } from "./agent-token.ts";

const NOT_IN_V1 = [
  "Solana wallet scan",
  "Cosmos / IBC",
  "Bitcoin L1 wallet scan",
  "points / quest / Galxe farming",
  "claim signing or transaction send",
];

function lastScan(address: ReturnType<typeof requireBoundWallet>) {
  const previous = loadPreviousScan(address);
  if (!previous) {
    throw new McpToolError(
      404,
      "NO_SCAN",
      "No stored scan for this address. Run Wallet check in the PoolIndex UI first. MCP does not start scans.",
    );
  }
  return previous;
}

function findingsFor(address: ReturnType<typeof requireBoundWallet>): { checked_at: string; findings: McpFinding[] } {
  const scan = lastScan(address);
  const publicScan = publicEngineScan(scan);
  return {
    checked_at: scan.scannedAt,
    findings: publicScan.findings.map((row) => toMcpFinding(row, scan.scannedAt)),
  };
}

function getWalletScan(address: ReturnType<typeof requireBoundWallet>) {
  const scan = lastScan(address);
  const view = publicEngineScan(scan);
  const mapped = view.findings.map((row) => toMcpFinding(row, scan.scannedAt));
  return {
    address: scan.address,
    scannedAt: scan.scannedAt,
    previousScannedAt: scan.previousScannedAt,
    adapters: view.sources.map((source) => ({
      id: source.id,
      protocol: source.protocol,
      chain: source.chainLabel,
      status: source.paused ? "paused" : source.status === "failed" ? "failed" : source.status === "ok" ? "ok" : "unknown",
      reason: untrustedExternal(source.lastError),
    })),
    findings: countFindings(mapped),
  };
}

function getDiff(address: ReturnType<typeof requireBoundWallet>) {
  const scan = lastScan(address);
  const byId = new Map(scan.findings.map((row) => [row.id, row]));
  const changes = scan.changes.filter((change) => {
    if (change.kind === "amount_changed") {
      const finding = byId.get(change.findingId);
      if (finding && belowAlertNet(finding)) return false;
    }
    return change.kind !== "baseline";
  });
  return {
    address: scan.address,
    scannedAt: scan.scannedAt,
    previousScannedAt: scan.previousScannedAt,
    changes: changes.map((change) => ({
      kind: change.kind,
      finding_id: change.findingId,
      summary: change.summary,
    })),
  };
}

function coverage() {
  const chains = [...new Set(ENGINE_SOURCES.map((row) => row.chainLabel))].sort();
  const protocols = [...new Set(ENGINE_SOURCES.map((row) => row.protocol))].sort();
  const adapters = ENGINE_SOURCES.map((row) => ({
    id: row.id,
    protocol: row.protocol,
    chain: row.chainLabel,
    category: row.category,
    scanMethod: row.scanMethod,
  }));
  return {
    checked: { chains, protocols, adapters },
    not_checked: NOT_IN_V1,
  };
}

async function checkUrl(raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new McpToolError(400, "INVALID_URL", "Provide a public http(s) URL.");
  }
  rejectSecretInput(raw, "url");
  const report = await verifyUrl(raw.trim());
  return {
    url: report.url,
    decision: report.verdict,
    reason: report.verdictReason,
    live: report.live,
    catalog: report.catalogMatch
      ? { id: report.catalogMatch.id, title: report.catalogMatch.title }
      : null,
    wayback: report.archive.available
      ? { snapshotUrl: report.archive.snapshotUrl, timestamp: report.archive.timestamp }
      : null,
    title: untrustedExternal(report.title),
    flags: report.flags.map((flag) => ({
      severity: flag.severity,
      code: flag.code,
      message: untrustedExternal(flag.message),
    })),
  };
}

function search(query: unknown) {
  if (typeof query !== "string") {
    throw new McpToolError(400, "INVALID_QUERY", "Provide a search query.");
  }
  rejectSecretInput(query, "query");
  return searchCatalog(query).slice(0, 25).map((claim) => ({
    id: claim.id,
    title: claim.title,
    kind: claim.kind,
    status: claim.status,
    chain: claim.chain,
    asset: claim.asset,
    officialUrl: claim.officialUrl,
    summary: untrustedExternal(claim.summary),
  }));
}

export async function executeMcpTool(input: {
  name: string;
  args: Record<string, unknown>;
  user: UserRecord;
  scopes: readonly McpScope[];
}): Promise<unknown> {
  if (!isMcpTool(input.name)) {
    throw new McpToolError(400, "UNKNOWN_TOOL", `Unknown tool “${input.name}”. ${mcpToolHelp()}`);
  }
  const needed = MCP_TOOL_SCOPES[input.name];
  if (!input.scopes.includes(needed)) {
    throw new McpToolError(
      403,
      "SCOPE_DENIED",
      `This token does not include ${needed}. PoolIndex MCP tokens are read-only (${needed} required for ${input.name}).`,
    );
  }
  return runTool(input.name, input.args, input.user);
}

async function runTool(name: McpToolName, args: Record<string, unknown>, user: UserRecord): Promise<unknown> {
  switch (name) {
    case "get_wallet_scan":
      return getWalletScan(requireBoundWallet(user, args.address));
    case "get_findings": {
      const packed = findingsFor(requireBoundWallet(user, args.address));
      const filter = typeof args.filter === "string" ? args.filter.trim().toLowerCase() : "";
      const findings = filter
        ? packed.findings.filter((row) => row.type === filter || row.status === filter)
        : packed.findings;
      return { checked_at: packed.checked_at, findings };
    }
    case "get_diff":
      return getDiff(requireBoundWallet(user, args.address));
    case "get_history": {
      const address = requireBoundWallet(user, args.address);
      lastScan(address);
      const limit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.min(30, Math.max(1, Math.floor(args.limit))) : 10;
      return { address, history: loadScanHistory(address, limit) };
    }
    case "check_url":
      return checkUrl(args.url);
    case "search_catalog":
      return { results: search(args.query) };
    case "get_coverage":
      return coverage();
    case "get_events": {
      const since = typeof args.since === "string" ? args.since : undefined;
      if (since) rejectSecretInput(since, "since");
      return { events: listMcpEvents(user.id, since) };
    }
  }
}
