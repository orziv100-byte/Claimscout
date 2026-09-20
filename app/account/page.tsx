"use client";

import { AccountPrivacyControls } from "@/components/account-privacy-controls";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { WALLET_DISCLOSURE } from "@/lib/disclosures";
import Link from "next/link";

export default function AccountPage() {
  const { user, logout, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Loading account…</p>;
  if (!user) {
    return (
      <p className="text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to view your account.
      </p>
    );
  }
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="font-heading text-3xl">Account</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.displayName}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{user.status}</dd>
        <dt className="text-muted-foreground">Plan</dt>
        <dd>{user.plan === "paid" ? "Poolindex Pro (operator-issued test license; purchase unavailable)" : "Free"}</dd>
        <dt className="text-muted-foreground">Public wallets on account</dt>
        <dd className="font-mono text-xs">{user.wallets.join(", ") || "none stored on this account"}</dd>
        <dt className="text-muted-foreground">Terms</dt>
        <dd>
          {user.termsVersion} / {user.privacyVersion} · {user.acceptedAt}
        </dd>
        <dt className="text-muted-foreground">Scans</dt>
        <dd>
          {user.scanCounts.completed} completed · {user.scanCounts.failed} failed
        </dd>
      </dl>
      {user.status === "pending_verification" ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">Verify your email before running scans.</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{WALLET_DISCLOSURE}</p>
      <AccountPrivacyControls deletionStatus={user.deletionStatus} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
        {user.role === "admin" ? (
          <Link href="/admin" className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground">
            Admin
          </Link>
        ) : null}
      </div>
    </div>
  );
}
