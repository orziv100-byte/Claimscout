"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/components/wallet-provider";
import { walletSubmitIntent } from "@/lib/address";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HomeAddressHero() {
  const router = useRouter();
  const { address, setReadonlyAddress, connectInjected, error, errorUpgradeUrl } = useWallet();
  const [draft, setDraft] = useState("");

  async function goToWallet() {
    router.push("/wallet");
  }

  async function onPaste(e: React.FormEvent) {
    e.preventDefault();
    const intent = walletSubmitIntent(draft, "check");
    if (intent === "empty") return;
    const ok = await setReadonlyAddress(draft);
    if (ok) {
      setDraft("");
      await goToWallet();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {address ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void goToWallet()}>
            Check {address.slice(0, 6)}…{address.slice(-4)}
          </Button>
          <p className="text-sm text-muted-foreground">Paste-only. No seed phrase. No paywall on offer names.</p>
        </div>
      ) : (
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(e) => void onPaste(e)}>
          <label htmlFor="home-wallet-address" className="sr-only">
            Public 0x Ethereum address
          </label>
          <Input
            id="home-wallet-address"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste public 0x address"
            className="h-11 font-mono text-sm sm:max-w-md"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" className="h-11">
            Check this address
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => void connectInjected()}>
            Optional: connect browser wallet
          </Button>
        </form>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}{" "}
          {errorUpgradeUrl ? (
            <Link href={errorUpgradeUrl} className="underline">
              Upgrade to PoolIndex Pro
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
