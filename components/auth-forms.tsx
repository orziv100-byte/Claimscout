"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function nextPath(search: ReturnType<typeof useSearchParams>) {
  const raw = search.get("next") || "/discover";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/discover";
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not sign in");
      await refresh();
      router.push(nextPath(search));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        Email
        <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="text-sm">
        Password
        <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      <p className="text-xs text-muted-foreground">
        <Link href="/forgot" className="hover:text-foreground">Forgot password</Link>
        {" · "}
        <Link href="/register" className="hover:text-foreground">Register with invite</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, displayName, inviteCode, acceptTerms, acceptPrivacy }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; verifyUrl?: string };
      if (!res.ok) throw new Error(json.error || "Could not register");
      if (json.verifyUrl) {
        setNotice("Account created. Verify your email to start scanning.");
        router.push(json.verifyUrl);
        return;
      }
      setNotice("Account created. Check the verification email from your Beta operator, then sign in.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        Email
        <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="text-sm">
        Display name
        <Input className="mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="nickname" />
      </label>
      <label className="text-sm">
        Password
        <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" />
      </label>
      <label className="text-sm">
        Invitation code
        <Input className="mt-1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required autoComplete="off" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>
          I accept the <Link href="/terms" className="text-primary hover:underline">Terms of Use</Link> ({TERMS_VERSION}).
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
        <span>
          I accept the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> ({PRIVACY_VERSION}).
        </span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Beta account"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = (await res.json().catch(() => ({}))) as { resetUrl?: string };
    setNotice("If that account exists, a reset link was issued.");
    setResetUrl(json.resetUrl ?? null);
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        Email
        <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <Button type="submit">Send reset link</Button>
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {resetUrl ? (
        <p className="text-sm">
          Dev reset link: <Link className="text-primary hover:underline" href={resetUrl}>{resetUrl}</Link>
        </p>
      ) : null}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not reset password");
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        New password
        <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit">Reset password</Button>
    </form>
  );
}
