"use client";

import { AccountPrivacyControls } from "@/components/account-privacy-controls";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AccountPage() {
  const { user, logout, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Loading account…</p>;
  if (!user) {
    return (
      <p className="text-sm">
        <Link href="/login?next=/account" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to view your account.
      </p>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="font-heading text-3xl">Account</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.displayName}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{user.status}</dd>
        <dt className="text-muted-foreground">Access</dt>
        <dd>{user.plan === "paid" ? "Paid Subscription" : "Trial"}</dd>
        <dt className="text-muted-foreground">Email verified</dt>
        <dd>{user.emailVerifiedAt ? "Yes" : "No"}</dd>
      </dl>
      {user.status === "pending_verification" ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">Verify your email, then you can download PoolIndex.</p>
      ) : null}
      <p className="text-sm">
        <Link href="/download" className="text-primary hover:underline">
          Download PoolIndex
        </Link>
        {" · "}
        <Link href="/upgrade" className="text-primary hover:underline">
          Subscription
        </Link>
      </p>
      <AccountPrivacyControls deletionStatus={user.deletionStatus} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
