"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { needsLegalReacceptance, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import Link from "next/link";
import { useState } from "react";

export function LegalReacceptBanner() {
  const { user, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!needsLegalReacceptance(user)) return null;

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/reaccept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not record acceptance");
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  return (
    <div className="border-b border-border/80 bg-secondary/40 px-4 py-3 text-sm" role="region" aria-label="Updated terms">
      <p>
        Terms ({TERMS_VERSION}) or Privacy ({PRIVACY_VERSION}) changed since you last accepted. Review{" "}
        <Link href="/terms" className="text-primary underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary underline">
          Privacy
        </Link>{" "}
        then confirm.
      </p>
      {error ? (
        <p className="mt-1 text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-2" size="sm" onClick={() => void accept()} disabled={busy}>
        {busy ? "Saving…" : "I accept the current Terms and Privacy Notice"}
      </Button>
    </div>
  );
}
