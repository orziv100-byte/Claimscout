"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OfficialSourceLinks } from "@/components/official-source-links";
import { useWallet } from "@/components/wallet-provider";
import { walletEligibilityLabel } from "@/lib/eligibility-status";
import type { CatalogClaim, EligibilityResult } from "@/lib/types";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

export function EligibilityPanel({ claim }: { claim: CatalogClaim }) {
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/eligibility?claimId=${encodeURIComponent(claim.id)}&address=${encodeURIComponent(address)}`,
      );
      const json = await res.json();
      if (res.status === 429) {
        throw new Error(json.error || "Too many eligibility checks. Wait, then try once — do not retry in a loop.");
      }
      if (!res.ok) throw new Error(json.error || "Eligibility check failed");
      setResult(json as EligibilityResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eligibility check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet eligibility</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Checks are read-only <code className="font-mono text-xs">eth_call</code> queries against public RPCs. PoolIndex
          does not claim tokens for you. Connecting a wallet is optional and only needed if you later sign in your own
          wallet.
        </p>
        {!address ? (
          <p className="text-sm">Paste or connect an address in the header to check this offer.</p>
        ) : (
          <Button onClick={() => void run()} disabled={loading} aria-busy={loading}>
            {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {loading ? "Checking…" : `Check ${address.slice(0, 6)}…`}
          </Button>
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <Alert>
            <AlertTitle>{walletEligibilityLabel(result.status)}</AlertTitle>
            <AlertDescription>{result.detail}</AlertDescription>
          </Alert>
        ) : null}
        <ClaimAction claim={claim} eligible={result?.status === "eligible"} />
      </CardContent>
    </Card>
  );
}

function ClaimAction({ claim, eligible }: { claim: CatalogClaim; eligible: boolean }) {
  const { mode, requestClaimTransaction } = useWallet();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (claim.action.type === "none") {
    return (
      <div className="flex flex-col gap-2">
        <OfficialSourceLinks officialUrl={claim.officialUrl} archiveUrl={claim.archiveUrl} />
        <p className="text-sm text-muted-foreground">{claim.action.reason}</p>
      </div>
    );
  }

  if (claim.action.type === "official_ui") {
    return (
      <div className="flex flex-col gap-2">
        <OfficialSourceLinks officialUrl={claim.action.url} archiveUrl={claim.archiveUrl} />
      </div>
    );
  }

  const action = claim.action;

  return (
    <>
      <OfficialSourceLinks officialUrl={claim.officialUrl} archiveUrl={claim.archiveUrl} />
      <Button
        disabled={!eligible}
        onClick={() => {
          setError(null);
          setTxHash(null);
          setOpen(true);
        }}
      >
        Review on-chain claim
      </Button>
      {!eligible ? (
        <p className="text-xs text-muted-foreground">
          Prefer the official source and archive above. On-chain submit stays disabled until a read-only check reports
          this address eligible.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Advanced: you can still sign in your own wallet. PoolIndex does not send the transaction for you.
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit public claim?</DialogTitle>
            <DialogDescription>
              This will ask your wallet to sign a transaction. PoolIndex never stores keys and will not send a
              transaction until you approve it in the wallet prompt. Blockchain transactions are irreversible. Network
              fees are charged by the chain, not by PoolIndex. PoolIndex does not execute the transaction for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Contract: <code className="font-mono text-xs">{action.contract}</code>
            </p>
            <p>
              Function: <code className="font-mono text-xs">{action.functionName}</code>
            </p>
            <p className="text-muted-foreground">{action.notes}</p>
            {mode !== "injected" ? (
              <p className="text-destructive">
                Paste-only mode cannot sign. Connect an injected wallet first.
              </p>
            ) : null}
            {error ? (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {txHash ? (
              <p>
                Submitted: <code className="font-mono text-xs">{txHash}</code>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || mode !== "injected"}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const hash = await requestClaimTransaction({
                    to: action.contract,
                    chainId: action.chainId,
                  });
                  setTxHash(hash);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Wallet rejected or failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {busy ? "Waiting for wallet…" : "Approve in wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
