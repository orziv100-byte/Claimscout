"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlan } from "@/components/plan-provider";
import { PLANS } from "@/lib/plan";
import { useState } from "react";

export function UpgradeForm() {
  const { plan, activateLicense, error, maxWallets, wallets } = usePlan();
  const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await activateLicense(license);
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Free and PoolIndex Pro</h1>
        <p className="mt-3 text-muted-foreground">
          Offer names and honest statuses stay free. PoolIndex Pro is a planned ${PLANS.paid.priceUsd}/month or $
          {PLANS.paid.yearlyUsd}/year plan for more wallets, claim-window email alerts, and Wayback/archive scanning.
          Payment processing is unavailable in this Closed Beta. Reddit and Bitcointalk stay reserved.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="text-2xl font-heading text-foreground">$0</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>One public wallet</li>
              <li>Named offers and four honest statuses</li>
              <li>Catalog + GitHub research scan</li>
              <li>URL inspect, official source, and archive hints</li>
              <li>Connect your own agent (read-only MCP; you pay for the LLM)</li>
            </ul>
            {plan === "free" ? (
              <p className="text-xs">You are on Free. Slot {wallets.length}/{maxWallets}.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>PoolIndex Pro (planned)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="text-2xl font-heading text-foreground">
              ${PLANS.paid.priceUsd}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
            </p>
            <p className="text-xs">or ${PLANS.paid.yearlyUsd}/year. Not billed in this Beta.</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Up to {PLANS.paid.maxWallets} wallets</li>
              <li>Email alerts for claim windows and verified findings</li>
              <li>Wayback and Archive.org scanning</li>
              <li>Same named results — nothing extra is hidden behind payment</li>
            </ul>
            {plan === "paid" ? (
              <p className="text-xs text-foreground">PoolIndex Pro is active. {wallets.length}/{maxWallets} wallets bound.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activate PoolIndex Pro (planned)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            After a planned ${PLANS.paid.priceUsd}/month purchase — payment processing is not available yet — an operator
            can issue a license key. Paste it here. The server stores a signed cookie, not the key.
          </p>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => void submit(e)}>
            <label htmlFor="pro-license" className="sr-only">
              PoolIndex Pro license key
            </label>
            <Input
              id="pro-license"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="PoolIndex Pro license key"
              className="font-mono"
              autoComplete="off"
            />
            <Button type="submit" disabled={busy || plan === "paid"}>
              {plan === "paid" ? "Activated" : "Activate"}
            </Button>
          </form>
          {error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
