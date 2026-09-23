"use client";

import { StatusBadge } from "@/components/claim-card";
import { OfficialSourceLinks } from "@/components/official-source-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWallet } from "@/components/wallet-provider";
import { CATALOG } from "@/lib/catalog";
import { catalogCheckKind, walletEligibilityLabel } from "@/lib/eligibility-status";
import { isAddressHoldingFinding, isAddressOfferFinding, relatedProgramHints } from "@/lib/engine/profile";
import { scanHeadline, userCheckLabel, evidenceLabel, scanCompleteness, scanCompletenessSentence } from "@/lib/engine/result-summary";
import { catalogIsRelevantToWallet, findingIsRelevantToWallet, walletActivity } from "@/lib/engine/relevance";
import { useAuth } from "@/components/auth-provider";
import { usePlan } from "@/components/plan-provider";
import { formatIsraelDateTime, formatTokenAmount, shortAddress } from "@/lib/labels";
import { formatWalletCap, monitoringActive } from "@/lib/plan";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CatalogClaim, EligibilityResult } from "@/lib/types";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { notifyWalletScanChange, requestWalletNotifications } from "@/lib/browser-notify";

type EngineFindingView = {
  id: string;
  sourceId?: string;
  title: string;
  verification?: string;
  eligibility?: string;
  amount?: string;
  symbol?: string;
  category?: string;
  catalogId?: string;
  detail?: string;
  sourceStatus?: string;
  sourceConfidence?: string;
  officialUrl?: string;
  deadlineLabel?: string;
  estimatedValueUsd?: number;
  estimatedFeesUsd?: number;
  estimatedNetUsd?: number;
  roiConfidence?: string;
  chainLabel?: string;
  safetyFlags?: { severity: string; code: string; message: string }[];
};

type EngineView = {
  scannedAt?: string;
  previousScannedAt?: string;
  nextScanAt?: string;
  durationMs?: number;
  counters?: {
    sourcesChecked: number;
    chainsChecked: number;
    relevantSources: number;
    potentialFindings: number;
    verifiedFindings: number;
  };
  summary?: {
    adaptersChecked: number;
    adaptersSucceeded: number;
    adaptersFailed: number;
    failures?: { sourceId: string; reason: string }[];
    verified: number;
    uncertain: number;
    rejected: number;
  };
  profile?: {
    chains?: { chainId: number; chainLabel: string; native: string; symbol: string; txCount?: number }[];
    tokens?: { chainId: number; symbol: string; amount: string; contract: string }[];
    protocols?: string[];
    contracts?: string[];
  };
  changes?: { kind: string; summary: string }[];
  findings?: EngineFindingView[];
  sources?: {
    id: string;
    protocol: string;
    chainLabel: string;
    category: string;
    scanMethod: string;
    adapterVersion: string;
    frequency: string;
    status?: string;
    lastError?: string;
    consecutiveFailures?: number;
    important?: boolean;
    paused?: boolean;
  }[];
  history?: {
    scannedAt: string;
    sourcesChecked: number;
    sourcesFailed: number;
    potentialFindings: number;
    verifiedFindings: number;
  }[];
};

type ScanStageView = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  count?: number;
  total?: number;
  detail?: string;
};

type ScanProgressView = {
  stage?: string;
  stages?: ScanStageView[];
  elapsedMs?: number;
  sourcesChecked?: number;
  sourcesTotal?: number;
  sourcesFailed?: number;
  sourcesTimedOut?: number;
  currentSource?: string;
  checkingLabel?: string;
  chainLabels?: string[];
  verifiedFindings?: number;
  uncertainFindings?: number;
  potentialFindings?: number;
  findings?: EngineFindingView[];
};

type ScanJobView = {
  status?: "running" | "done" | "failed" | "idle";
  progress?: ScanProgressView;
  error?: string;
  eligibility?: EligibilityResult[];
  engine?: EngineView;
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function isOfferFinding(finding: EngineFindingView): boolean {
  return isAddressOfferFinding({
    category: (finding.category as "airdrop") ?? "airdrop",
    eligibility: finding.eligibility as "eligible" | "ineligible" | "already_claimed" | "window_closed" | undefined,
    sourceId: finding.sourceId ?? finding.id,
    sourceStatus: finding.sourceStatus === "failed" ? "failed" : "ok",
  });
}

function isHoldingFinding(finding: EngineFindingView): boolean {
  return isAddressHoldingFinding({
    category: (finding.category as "native_balance" | "forgotten_token" | "protocol_claim") ?? "forgotten_token",
    amount: finding.amount,
    sourceStatus: finding.sourceStatus === "failed" ? "failed" : "ok",
  });
}

function OfferTable({ findings, address }: { findings: EngineFindingView[]; address: string | null }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Program</TableHead>
          <TableHead>Network</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead>Next</TableHead>
          <TableHead>Estimate</TableHead>
          <TableHead>Deadline</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <FindingRows findings={findings} address={address} />
      </TableBody>
    </Table>
  );
}

function CatalogClaimRows({
  claims,
  rows,
  pools,
  loading,
  address,
  onScan,
}: {
  claims: CatalogClaim[];
  rows: EligibilityResult[] | null;
  pools: Record<string, { remaining?: string; symbol?: string; error?: string }>;
  loading: boolean;
  address: string | null;
  onScan: () => void;
}) {
  return claims.map((claim) => {
    const elig = rows?.find((r) => r.claimId === claim.id);
    const pool = pools[claim.id];
    const kind = elig?.checkKind ?? catalogCheckKind(claim);
    return (
      <TableRow key={claim.id}>
        <TableCell>
          <Link href={`/claims/${claim.id}`} className="hover:underline">
            {claim.title}
          </Link>
          <div className="text-xs text-muted-foreground">{claim.asset}</div>
        </TableCell>
        <TableCell>
          <StatusBadge status={claim.status} />
        </TableCell>
        <TableCell className="max-w-sm text-xs text-muted-foreground">
          {elig ? (
            <>
              <div className="font-medium text-foreground">{walletEligibilityLabel(elig.status)}</div>
              {elig.detail}
              <div className="mt-1 text-[11px] uppercase tracking-wide">
                {kind === "wallet_level" ? "Wallet-level check" : "Catalog only"}
              </div>
            </>
          ) : loading && address ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="size-3 animate-spin" />
              Checking this address…
            </span>
          ) : address ? (
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => onScan()}>
              Scan this address
            </Button>
          ) : (
            "No address"
          )}
        </TableCell>
        <TableCell>
          <OfficialSourceLinks
            officialUrl={claim.officialUrl || claim.sources[0]?.url}
            archiveUrl={claim.archiveUrl}
            showWarning={false}
          />
        </TableCell>
        <TableCell className="font-mono text-xs">
          {pool?.remaining && pool.symbol
            ? `${Number(pool.remaining).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}`
            : pool?.error
              ? pool.error.startsWith("Unsupported")
                ? "Unverifiable"
                : "n/a"
              : "—"}
        </TableCell>
      </TableRow>
    );
  });
}

function FindingRows({ findings, address }: { findings: EngineFindingView[]; address: string | null }) {
  return findings.map((finding) => {
    const evidence = evidenceLabel({
      verification: (finding.verification as "verified" | "uncertain" | "rejected") ?? "uncertain",
      sourceStatus: finding.sourceStatus === "failed" ? "failed" : "ok",
      eligibility: finding.eligibility as
        | "eligible"
        | "ineligible"
        | "already_claimed"
        | "window_closed"
        | "unable_to_verify"
        | undefined,
    });
    return (
        <TableRow key={finding.id}>
          <TableCell>
            {address && finding.sourceId ? (
              <Link
                href={`/wallet/asset?address=${encodeURIComponent(address)}&source=${encodeURIComponent(finding.sourceId)}`}
                className="font-medium hover:underline"
              >
                {finding.title}
              </Link>
            ) : (
              <div className="font-medium">{finding.title}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {finding.amount && finding.symbol
                ? `${formatTokenAmount(finding.amount)} ${finding.symbol}`
                : null}
              {finding.detail ? (
                <span className={finding.amount && finding.symbol ? "block" : undefined}>{finding.detail}</span>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{finding.chainLabel || "—"}</TableCell>
          <TableCell className="text-xs">
            <div className="font-medium text-foreground">
              {userCheckLabel({
                category: (finding.category as "airdrop") ?? "airdrop",
                eligibility: finding.eligibility as
                  | "eligible"
                  | "ineligible"
                  | "already_claimed"
                  | "window_closed"
                  | "unable_to_verify"
                  | undefined,
                sourceStatus: finding.sourceStatus === "failed" ? "failed" : "ok",
                amount: finding.amount,
              })}
            </div>
          </TableCell>
          <TableCell className="text-xs">
            <Tooltip>
              <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                {evidence}
              </TooltipTrigger>
              <TooltipContent>
                PoolIndex does not label something Verified or Eligible unless the checker ran with sufficient
                evidence. That is not a promise money is owed.
              </TooltipContent>
            </Tooltip>
          </TableCell>
          <TableCell className="text-xs">
            <OfficialSourceLinks
              officialUrl={finding.officialUrl}
              flagged={finding.verification === "rejected"}
              showWarning={false}
              label={finding.eligibility === "eligible" ? "View official claim instructions" : undefined}
            />
            {finding.safetyFlags?.length ? (
              <ul className="mt-1 space-y-0.5 text-amber-800 dark:text-amber-300">
                {finding.safetyFlags.map((flag) => (
                  <li key={`${flag.code}-${flag.message}`}>{flag.message}</li>
                ))}
              </ul>
            ) : null}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {finding.roiConfidence && finding.roiConfidence !== "none" ? (
              <>
                {finding.estimatedValueUsd != null ? `Est. $${finding.estimatedValueUsd}` : "No USD price"}
                {finding.estimatedFeesUsd != null ? ` · fees $${finding.estimatedFeesUsd}` : ""}
                {finding.estimatedNetUsd != null ? ` · net $${finding.estimatedNetUsd}` : ""}
                <div>Estimate only ({finding.roiConfidence} confidence)</div>
              </>
            ) : (
              "Not priced"
            )}
          </TableCell>
          <TableCell className="text-xs">{finding.deadlineLabel || "—"}</TableCell>
        </TableRow>
    );
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function WalletDashboard() {
  const { address, mode, connectInjected, setReadonlyAddress, error: walletError, errorUpgradeUrl } = useWallet();
  const { plan, name: planName, wallets, maxWallets } = usePlan();
  const { user } = useAuth();
  const monitorOn = monitoringActive(plan, user?.monitorEnabled);
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState<EligibilityResult[] | null>(null);
  const [engine, setEngine] = useState<EngineView | null>(null);
  const [progress, setProgress] = useState<ScanProgressView | null>(null);
  const [pools, setPools] = useState<Record<string, { remaining?: string; symbol?: string; error?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formHint, setFormHint] = useState<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const runAbort = useRef<AbortController | null>(null);

  const loadPools = useCallback(async () => {
    setPoolLoading(true);
    setPoolError(null);
    try {
      const res = await fetch("/api/onchain?pools=1");
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        pools?: { claimId: string; remaining?: string; symbol?: string; error?: string }[];
      };
      if (res.status === 429) {
        throw new Error(json.error || "Too many pool scans. Wait, then try once — do not retry in a loop.");
      }
      if (res.status === 503) {
        throw new Error(json.error || "Pool scan paused to protect this machine. Wait, then try once.");
      }
      if (!res.ok) throw new Error(json.error || "Pool scan failed");
      const map: Record<string, { remaining?: string; symbol?: string; error?: string }> = {};
      for (const pool of json.pools ?? []) {
        map[pool.claimId] = pool;
      }
      setPools(map);
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : "Pool scan failed");
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const run = useCallback(
    async (target = address) => {
      if (!target) return;
      runAbort.current?.abort();
      const ac = new AbortController();
      runAbort.current = ac;
      setLoading(true);
      setError(null);
      setProgress(null);
      try {
        const applyJob = (job: ScanJobView) => {
          if (job.progress) setProgress(job.progress);
          if (job.engine) setEngine(job.engine);
          else if (job.progress?.findings?.length) {
            setEngine((current) => ({
              ...(current ?? {}),
              findings: job.progress?.findings,
            }));
          }
          if (job.eligibility) setRows(job.eligibility);
        };

        const startRes = await fetch(`/api/onchain?address=${encodeURIComponent(target)}`, {
          signal: ac.signal,
        });
        const startJson = (await startRes.json().catch(() => ({}))) as ScanJobView & { error?: string };
        if (startRes.status === 429) {
          throw new Error(startJson.error || "Too many wallet checks. Wait, then try once — do not retry in a loop.");
        }
        if (startRes.status === 503) {
          throw new Error(startJson.error || "Wallet check paused to protect this machine. Wait, then try once.");
        }
        if (startJson.status === "failed") {
          throw new Error(startJson.error || "Check failed");
        }
        if (!startRes.ok && startRes.status !== 202) {
          throw new Error(startJson.error || "Check failed");
        }
        applyJob(startJson);
        let job = startJson;
        while (job.status === "running") {
          await sleep(1200, ac.signal);
          const pollRes = await fetch(`/api/onchain?address=${encodeURIComponent(target)}&poll=1`, {
            signal: ac.signal,
          });
          const pollJson = (await pollRes.json().catch(() => ({}))) as ScanJobView & { error?: string };
          if (pollRes.status === 429) {
            throw new Error(pollJson.error || "Too many wallet checks. Wait, then try once — do not retry in a loop.");
          }
          if (pollJson.status === "idle") {
            throw new Error("Scan job was lost. Start one scan and wait — do not retry in a loop.");
          }
          if (pollJson.status === "failed") {
            applyJob(pollJson);
            if (pollJson.engine || pollJson.progress?.findings?.length) {
              setError(pollJson.error || "Some checks did not finish.");
              break;
            }
            throw new Error(pollJson.error || "Check failed");
          }
          if (!pollRes.ok && pollRes.status !== 202) {
            throw new Error(pollJson.error || "Check failed");
          }
          applyJob(pollJson);
          job = pollJson;
        }
        if (job.status === "done" && job.engine) {
          notifyWalletScanChange(job.engine);
        }
        if (!job.eligibility && !job.engine) {
          throw new Error(job.error || "Check failed");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Check failed");
      } finally {
        setLoading(false);
      }
    },
    [address],
  );

  useEffect(() => {
    return () => {
      runAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!address) {
      setRows(null);
      setEngine(null);
      return;
    }
    void run(address);
  }, [address, run]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  async function onPasteScan(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) {
      setFormHint(address ? "Paste a new public 0x address to replace this one." : "Paste a public 0x address first.");
      return;
    }
    setFormHint(null);
    const ok = await setReadonlyAddress(draft);
    if (ok) setDraft("");
  }

  const visible = CATALOG.filter((c) => c.id !== "tornado-avoided");
  const walletCatalog = visible.filter(
    (claim) =>
      claim.kind !== "faucet" &&
      claim.kind !== "puzzle" &&
      claim.kind !== "testnet" &&
      claim.chain !== "bitcoin" &&
      claim.chain !== "solana",
  );
  const findings = engine?.findings ?? [];
  const offerFindings = findings.filter(isOfferFinding);
  const holdingFindings = findings.filter(isHoldingFinding);
  const offerCatalogIds = new Set(offerFindings.map((row) => row.catalogId).filter(Boolean) as string[]);
  const catalogLeftover = walletCatalog.filter((claim) => !offerCatalogIds.has(claim.id));
  const relatedHints = relatedProgramHints({
    tokens: (engine?.profile?.tokens ?? []).map((row) => ({
      chainId: row.chainId,
      symbol: row.symbol,
      amount: row.amount,
      contract: row.contract,
    })),
  });
  const activity = walletActivity({
    chains: engine?.profile?.chains ?? [],
    tokens: engine?.profile?.tokens ?? [],
    protocols: engine?.profile?.protocols ?? [],
  });
  const relevantOffers = offerFindings.filter((row) =>
    findingIsRelevantToWallet(
      {
        sourceId: row.sourceId ?? row.id,
        eligibility: row.eligibility as "eligible" | "ineligible" | "already_claimed" | "window_closed" | undefined,
        amount: row.amount,
      },
      activity,
    ),
  );
  const otherOffers = offerFindings.filter((row) => !relevantOffers.includes(row));
  const relatedCatalog = catalogLeftover.filter((claim) => catalogIsRelevantToWallet(claim, activity));
  const generalCatalog = catalogLeftover.filter((claim) => !relatedCatalog.includes(claim));
  const chainCount = engine?.profile?.chains?.length ?? engine?.counters?.chainsChecked ?? 0;
  const durationLabel =
    engine?.durationMs != null
      ? formatElapsed(engine.durationMs)
      : null;
  const headline = scanHeadline(
    findings.map((row) => ({
      category: (row.category as "airdrop") ?? "airdrop",
      eligibility: row.eligibility as "eligible" | undefined,
      amount: row.amount,
      sourceStatus: row.sourceStatus === "failed" ? "failed" : "ok",
    })),
  );
  const adaptersChecked = engine?.summary?.adaptersChecked ?? progress?.sourcesTotal ?? 0;
  const adaptersSucceeded = engine?.summary?.adaptersSucceeded ?? Math.max(0, (progress?.sourcesChecked ?? 0) - (progress?.sourcesFailed ?? 0));
  const adaptersFailed = engine?.summary?.adaptersFailed ?? progress?.sourcesFailed ?? 0;
  const completeness = scanCompleteness({
    jobFailed: Boolean(error) && adaptersSucceeded === 0 && !loading,
    adaptersChecked,
    adaptersSucceeded,
    adaptersFailed,
  });
  const completenessSentence = scanCompletenessSentence(completeness, adaptersChecked, adaptersSucceeded, adaptersFailed);
  const deadlineFindings = relevantOffers.filter((row) => row.deadlineLabel && row.deadlineLabel !== "—");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Paste a public address</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Paste a public 0x address. PoolIndex never asks for a seed phrase or private key. Connecting a browser
            wallet is optional. Offer names are never hidden behind payment.
          </p>
          {address ? (
            <p>
              Active address: <span className="font-mono">{address}</span> ({mode === "injected" ? "injected wallet" : "paste / read-only"})
            </p>
          ) : null}
          <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(e) => void onPasteScan(e)}>
              <label htmlFor="wallet-page-address" className="sr-only">
                Public 0x Ethereum address
              </label>
              <Input
                id="wallet-page-address"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste public 0x address"
                className="font-mono text-xs sm:max-w-md"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" disabled={loading}>
                Add and scan
              </Button>
              <Button type="button" variant="outline" onClick={() => void connectInjected()}>
                Optional: connect browser wallet
              </Button>
            </form>
          <p className="text-xs text-muted-foreground">
            {planName} · {wallets.length}/{formatWalletCap(maxWallets)} wallets on this account. Offer names stay
            visible on Free. PoolIndex Pro is planned; payment processing is unavailable in this Closed Beta.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run()} disabled={!address || loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : "Scan this address"}
            </Button>
            {adaptersFailed > 0 && !loading ? (
              <Button type="button" variant="outline" onClick={() => void run()} disabled={!address}>
                Retry scan
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void requestWalletNotifications()}>
              Enable desktop notifications
            </Button>
            <Button variant="outline" onClick={() => void loadPools()} disabled={poolLoading}>
              {poolLoading ? <LoaderCircle className="animate-spin" /> : "Refresh catalog pool balances"}
            </Button>
          </div>
          {formHint ? <p className="text-xs text-muted-foreground">{formHint}</p> : null}
          {walletError ? (
            <p className="text-destructive" role="alert">
              {walletError}{" "}
              {errorUpgradeUrl ? (
                <Link href={errorUpgradeUrl} className="underline">
                  Upgrade to PoolIndex Pro
                </Link>
              ) : null}
            </p>
          ) : null}
          {error && error !== walletError ? (
            <p className="text-destructive" role="alert">
              {error}{" "}
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => void run()} disabled={!address || loading}>
                Retry
              </Button>
              {" · "}
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              {!user ? (
                <>
                  {" · "}
                  <Link href="/login" className="underline">
                    Sign in again
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {poolError ? <p className="text-xs text-muted-foreground">{poolError} Remaining pool is separate from wallet eligibility.</p> : null}
          {loading ? (
            <div className="rounded-md border p-3 text-xs">
              <p className="font-medium text-foreground">Wallet scan progress</p>
              <p className="mt-1 text-muted-foreground">
                Scan time follows this wallet’s complexity. A stuck source times out after 30s and the rest continue.
                {progress?.elapsedMs != null ? ` Elapsed ${formatElapsed(progress.elapsedMs)}.` : ""}
              </p>
              {progress?.checkingLabel ? (
                <p className="mt-2 font-medium text-foreground">{progress.checkingLabel}</p>
              ) : null}
              <ol className="mt-3 space-y-2">
                {(progress?.stages ?? [
                  { id: "profile", label: "Profile", status: "active" as const },
                  { id: "chains", label: "Chains", status: "pending" as const },
                  { id: "protocols", label: "Protocols", status: "pending" as const },
                  { id: "relevant_sources", label: "Relevant Sources", status: "pending" as const },
                  { id: "verification", label: "Verification", status: "pending" as const },
                ]).map((stage) => (
                  <li key={stage.id} className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {stage.status === "done" ? "✓" : stage.status === "active" ? "→" : "·"} {stage.label}
                      {stage.total != null ? ` ${stage.count ?? 0}/${stage.total}` : ""}
                    </span>
                    {stage.detail ? <span className="text-muted-foreground">{stage.detail}</span> : null}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-muted-foreground">
                {progress?.sourcesChecked ?? 0}/{progress?.sourcesTotal ?? 0} sources
                {progress?.sourcesTimedOut ? ` · ${progress.sourcesTimedOut} timed out` : ""}
                {progress?.sourcesFailed ? ` · ${progress.sourcesFailed} failed` : ""}
              </p>
            </div>
          ) : engine?.summary || engine?.counters ? (
            <div className="rounded-md border p-3 text-xs">
              <p className="font-medium text-foreground">
                {completeness === "full_success"
                  ? "Scan complete"
                  : completeness === "partial_success"
                    ? "Partial success"
                    : "Scan did not finish"}
              </p>
              <p className="mt-1 text-muted-foreground">{completenessSentence}</p>
              <p className="mt-1 text-foreground">{headline.sentence}</p>
              {headline.claimNow === 0 && engine.scannedAt ? (
                <p className="mt-2 text-muted-foreground">
                  {adaptersSucceeded || adaptersChecked} checks completed
                  {chainCount ? ` · ${chainCount} networks checked` : ""}
                  {` · Last checked: ${formatIsraelDateTime(engine.scannedAt)}`}
                </p>
              ) : null}
              {engine.summary ? (
                <>
                  <p className="mt-2 text-muted-foreground">
                    Checked {engine.summary.adaptersChecked} adapters
                    {chainCount ? ` across ${chainCount} chains` : ""}
                    {durationLabel ? ` in ${durationLabel}` : ""}. {engine.summary.adaptersSucceeded} succeeded
                    {engine.summary.adaptersFailed ? ` · ${engine.summary.adaptersFailed} failed` : ""}.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Hand-written protocol checks, not a crawl of thousands of sources. Rows below are split into
                    activity on this wallet versus catalog names that are the same for every address.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Wallet-specific results: {relevantOffers.length} relevant · {otherOffers.length} no activity
                    evidence · {holdingFindings.length} holdings · {catalogLeftover.length} catalog-only.
                  </p>
                  {engine.summary.failures?.length ? (
                    <ul className="mt-2 space-y-1 text-destructive">
                      {engine.summary.failures.map((row) => (
                        <li key={row.sourceId}>
                          {row.sourceId}: {row.reason}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted-foreground">No adapter RPC/contract failures.</p>
                  )}
                </>
              ) : engine.counters ? (
                <p className="mt-1 text-muted-foreground">
                  {engine.counters.sourcesChecked} sources checked · {engine.counters.chainsChecked} chains
                </p>
              ) : null}
              <div className="mt-3 rounded-md border bg-muted/40 p-3">
                <p className="font-medium text-foreground">
                  {monitorOn ? "Monitoring is on for this account" : "This wallet is not on a daily monitor"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {monitorOn
                    ? "PoolIndex will continue monitoring this wallet and notify you when a verified finding or claim window changes."
                    : "Free does not run a daily monitor unless an operator enables opt-in. Scan again anytime. PoolIndex Pro (planned) includes daily monitoring and email alerts. Payment processing is unavailable in this Closed Beta."}
                </p>
                {monitorOn && engine.nextScanAt ? (
                  <p className="mt-1 text-muted-foreground">Next daily monitor window: {engine.nextScanAt}.</p>
                ) : null}
                {plan !== "paid" ? (
                  <p className="mt-1">
                    <Link href="/upgrade" className="underline">
                      See PoolIndex Pro
                    </Link>
                    {" "}for plan details. Nothing extra is hidden behind payment.
                  </p>
                ) : null}
              </div>
              {engine.scannedAt ? <p className="mt-2 text-muted-foreground">Last scan: {formatIsraelDateTime(engine.scannedAt)}</p> : null}
              {engine.previousScannedAt ? (
                <p className="mt-1 text-muted-foreground">Previous scan: {formatIsraelDateTime(engine.previousScannedAt)}</p>
              ) : null}
              {engine.history?.length ? (
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {engine.history.slice(0, 5).map((row) => (
                    <li key={row.scannedAt}>
                      {formatIsraelDateTime(row.scannedAt)} · {row.sourcesChecked} sources
                      {row.sourcesFailed ? ` · ${row.sourcesFailed} failed` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {engine.changes?.length ? (
                <p className="mt-1 text-muted-foreground">{engine.changes[0]?.summary}</p>
              ) : null}
              {engine.profile?.chains?.length || engine.profile?.tokens?.length || engine.profile?.protocols?.length ? (
                <div className="mt-3 space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground">Wallet profile</p>
                  {engine.profile.chains?.map((row) => (
                    <p key={row.chainId}>
                      {row.chainLabel}: {row.native} {row.symbol}
                      {row.txCount != null ? ` · ${row.txCount} txs` : ""}
                    </p>
                  ))}
                  {engine.profile.tokens?.length ? (
                    <p>
                      Tokens:{" "}
                      {engine.profile.tokens
                        .map((row) => `${row.symbol} ${formatTokenAmount(row.amount)}`)
                        .join(", ")}
                    </p>
                  ) : (
                    <p>No tracked token balances.</p>
                  )}
                  {engine.profile.protocols?.length ? (
                    <p>Protocols with holdings or leftover claims: {engine.profile.protocols.join(", ")}</p>
                  ) : null}
                  {relatedHints.length ? (
                    <p>
                      Related catalog programs from holdings:{" "}
                      {relatedHints
                        .map((row) =>
                          row.hasAddressLookup
                            ? `${row.symbol} → ${row.protocol} (address lookup)`
                            : `${row.symbol} → ${row.protocol} (no merkle for this token; not Eligible)`,
                        )
                        .join("; ")}
                    </p>
                  ) : (
                    <p>Holdings on this address did not match a catalog airdrop adapter.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {deadlineFindings.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Claim windows</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-2">
              {deadlineFindings.map((finding) => (
                <li key={finding.id}>
                  <span className="font-medium">{finding.title}</span>
                  <span className="text-muted-foreground"> · {finding.deadlineLabel}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Email alerts for closing windows are PoolIndex Pro. Free still shows the dates here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Relevant to this wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Programs this address actually holds, claimed, or has an official merkle/CSV result after we saw matching
            activity. Remaining contract balance is not eligibility.
          </p>
          {relevantOffers.length ? (
            <OfferTable findings={relevantOffers} address={address} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {address
                ? "No matching activity for a catalog airdrop on this address. Holdings below are separate. Catalog names that are the same for every wallet are folded under Catalog-only."
                : "Paste a public 0x address to fill this table."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holdings and leftover positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Token balances, leftover LP, and protocol positions actually held by this address. Zero balances are
            omitted. These are not airdrop Eligible verdicts.
          </p>
          {holdingFindings.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holding</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Next</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <FindingRows findings={holdingFindings} address={address} />
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No leftover holdings reported for this address.</p>
          )}
        </CardContent>
      </Card>

      {otherOffers.length ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-heading text-lg">
            Checked, no activity on this wallet ({otherOffers.length})
          </summary>
          <p className="mb-3 mt-2 text-xs text-muted-foreground">
            Official merkle/CSV still scored this address (usually Not eligible), but we have no token or protocol
            holding that ties the program to this wallet. Folded so an unused address does not look like a whale.
          </p>
          <OfferTable findings={otherOffers} address={address} />
        </details>
      ) : null}

      {engine?.sources?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Source manager</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Frequency, last failure, and adapter version for this scan. A failed important source does not invent a
              wallet verdict. Repairing an adapter that already existed is product maintenance, not a paid add-on.
              Programs whose merkle PoolIndex does not host are{" "}
              <a className="underline" href="/coverage">
                Request Coverage
              </a>
              .
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Adapter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engine.sources
                  .filter((source) => source.status === "failed" || source.important)
                  .map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div className="font-medium">{source.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {source.chainLabel} · {source.category.replaceAll("_", " ")} · {source.frequency}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{source.scanMethod}</TableCell>
                      <TableCell className="text-xs">
                        {source.paused ? "paused until Restore" : source.status ?? "unknown"}
                        {source.lastError ? (
                          <div className="text-muted-foreground">{source.lastError}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">v{source.adapterVersion}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Catalog-only programs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Named catalog ({catalogLeftover.length}). Not an automatic wallet scan. Catalog only means we did not invent
            Eligible. Remaining pool is not eligibility. Missing merkle lookups are queued on{" "}
            <a className="underline" href="/coverage">
              Request Coverage
            </a>
            ; that future payment would buy an adapter, not Eligible.
          </p>
          {relatedCatalog.length ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">Related to holdings on this wallet ({relatedCatalog.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>Official / archive</TableHead>
                    <TableHead>Remaining pool</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CatalogClaimRows
                    claims={relatedCatalog}
                    rows={rows}
                    pools={pools}
                    loading={loading}
                    address={address}
                    onScan={() => void run()}
                  />
                </TableBody>
              </Table>
            </div>
          ) : null}
          {generalCatalog.length ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Same catalog for every address ({generalCatalog.length}) — catalog only, not checked as Eligible
              </summary>
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>Official / archive</TableHead>
                    <TableHead>Remaining pool</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CatalogClaimRows
                    claims={generalCatalog}
                    rows={rows}
                    pools={pools}
                    loading={loading}
                    address={address}
                    onScan={() => void run()}
                  />
                </TableBody>
              </Table>
            </details>
          ) : null}
          {address ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Checking {shortAddress(address)} against published public offers only. Remaining contract balance is not
              wallet eligibility.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
