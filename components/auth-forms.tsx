"use client";

import { GoogleContinueButton, AuthOrDivider } from "@/components/google-continue";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { cn } from "@/lib/utils";
import { websitePostLoginPath } from "@/lib/site-surface";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ComponentProps, type FormEvent } from "react";

function isDesktopBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (window.poolindexDesktop) return true;
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("PoolIndexDesktop")) return true;
  return document.cookie.split(";").some((part) => part.trim().startsWith("poolindex_desktop=1"));
}

function nextPath(search: ReturnType<typeof useSearchParams>) {
  return websitePostLoginPath(search.get("next"), isDesktopBrowser());
}

function loginErrorMessage(status: number, json: { error?: string; code?: string }): string {
  if (json.code === "CSRF") return "Could not authorize this sign-in window. Refresh the page and try again.";
  if (json.code === "GOOGLE_ONLY") return json.error || "This account uses Google Sign-In.";
  if (json.code === "PASSWORD_REQUIRED") return json.error || "Enter your password.";
  if (json.code === "INVALID_CREDENTIALS" || status === 401) {
    return "Invalid email, username, or password. Use the exact address this account was registered with.";
  }
  return json.error || "Could not sign in";
}

const AUTH_INPUT_CLASS =
  "mt-1 h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function AuthInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(AUTH_INPUT_CLASS, props.className)} />;
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) return el.value;
  if (el instanceof RadioNodeList) {
    for (const node of el) {
      if (node instanceof HTMLInputElement && node.value) return node.value;
    }
  }
  return "";
}

export function LoginForm() {
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const email = fieldValue(form, "email");
    const password = fieldValue(form, "password");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) throw new Error(loginErrorMessage(res.status, json));
      // Hard navigation on purpose: router.push() + an auth-context refresh can race
      // inside the Electron desktop webview, leaving the app stuck on the login screen
      // even though the server already issued a valid session cookie. A full document
      // load always re-reads that cookie fresh.
      window.location.assign(nextPath(search));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3" autoComplete="on">
      <GoogleContinueButton intent="login" />
      <AuthOrDivider />
      <label className="text-sm">
        Email or username
        <AuthInput type="text" name="email" required autoComplete="username" spellCheck={false} />
      </label>
      <label className="text-sm">
        Password
        <AuthInput type="password" name="password" required minLength={10} maxLength={200} autoComplete="current-password" />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} aria-busy={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const form = e.currentTarget;
    const email = fieldValue(form, "email");
    const password = fieldValue(form, "password");
    const displayName = fieldValue(form, "displayName");
    const inviteCode = fieldValue(form, "inviteCode");
    const acceptTerms = Boolean((form.elements.namedItem("acceptTerms") as HTMLInputElement | null)?.checked);
    const acceptPrivacy = Boolean((form.elements.namedItem("acceptPrivacy") as HTMLInputElement | null)?.checked);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, displayName, inviteCode, acceptTerms, acceptPrivacy }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; verifyUrl?: string };
      if (!res.ok) throw new Error(json.error || "Could not register");
      if (json.verifyUrl) {
        setNotice("Account created. Confirm your email, then you can download PoolIndex.");
        router.push(json.verifyUrl);
        return;
      }
      setNotice("Account created. Confirm the email sent to you, then you can download PoolIndex.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3" autoComplete="on">
      <label className="text-sm">
        Email
        <AuthInput type="email" name="email" required autoComplete="email" spellCheck={false} />
      </label>
      <label className="text-sm">
        Username
        <AuthInput name="displayName" required autoComplete="username" spellCheck={false} />
      </label>
      <label className="text-sm">
        Password
        <AuthInput type="password" name="password" required minLength={10} maxLength={200} autoComplete="new-password" />
      </label>
      <label className="text-sm">
        Invitation code
        <AuthInput name="inviteCode" required autoComplete="off" spellCheck={false} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          id="accept-terms"
          name="acceptTerms"
          type="checkbox"
          className="mt-1"
          required
        />
        <span>
          I accept the <Link href="/terms" className="text-primary underline">Terms of Use</Link> ({TERMS_VERSION}).
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          id="accept-privacy"
          name="acceptPrivacy"
          type="checkbox"
          className="mt-1"
          required
        />
        <span>
          I accept the <Link href="/privacy" className="text-primary hover:underline">Privacy Notice</Link> ({PRIVACY_VERSION}).
        </span>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Beta account"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = fieldValue(e.currentTarget, "email");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = (await res.json().catch(() => ({}))) as { resetUrl?: string };
    setNotice("If that account exists, a reset link was issued.");
    setResetUrl(json.resetUrl ?? null);
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3" autoComplete="on">
      <label className="text-sm">
        Email
        <AuthInput type="email" name="email" required autoComplete="email" spellCheck={false} />
      </label>
      <Button type="submit">Send reset link</Button>
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
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
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = fieldValue(e.currentTarget, "password");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not reset password");
      return;
    }
    await refresh();
    router.push("/download");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        New password
        <AuthInput type="password" name="password" required minLength={10} maxLength={200} autoComplete="new-password" />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit">Reset password</Button>
    </form>
  );
}
