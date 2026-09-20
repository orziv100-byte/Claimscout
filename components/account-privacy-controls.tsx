"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactLine } from "@/lib/contacts";
import { useState } from "react";

export function AccountPrivacyControls({
  deletionStatus,
}: {
  deletionStatus: string | null | undefined;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [privacyType, setPrivacyType] = useState("question");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestDeletion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) setError(json.error || "Could not submit closure request");
    else {
      setNotice("Closure request recorded. An operator will process it. Security logs may remain for a limited period.");
      setPassword("");
      setConfirm("");
    }
    setBusy(false);
  }

  async function sendPrivacy(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/account/privacy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: privacyType, message }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) setError(json.error || "Could not send request");
    else {
      setNotice("Privacy request recorded for the operator.");
      setMessage("");
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border/80 p-4">
      <h2 className="font-heading text-xl">Privacy and account closure</h2>
      <p className="text-sm text-muted-foreground">
        You can ask for a copy of your account record, a correction, a question, or closure. Email{" "}
        {contactLine("privacy")} if you prefer not to use this form. User A cannot request deletion of User B.
      </p>
      {deletionStatus && deletionStatus !== "none" ? (
        <p className="text-sm" role="status">
          Closure status: {deletionStatus}
        </p>
      ) : null}
      <form onSubmit={(e) => void sendPrivacy(e)} className="flex flex-col gap-2">
        <label className="text-sm">
          Request type
          <select
            className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            value={privacyType}
            onChange={(e) => setPrivacyType(e.target.value)}
          >
            <option value="access">Access my account information</option>
            <option value="correction">Correction</option>
            <option value="deletion">Deletion / privacy request</option>
            <option value="question">Privacy question</option>
          </select>
        </label>
        <label className="text-sm">
          Message
          <textarea
            className="mt-1 min-h-20 w-full rounded-lg border border-input bg-transparent p-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          Send privacy request
        </Button>
      </form>
      <form onSubmit={(e) => void requestDeletion(e)} className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <h3 className="text-sm font-medium">Request account closure</h3>
        <p className="text-xs text-muted-foreground">
          This is not one-click deletion. Re-enter your password and type DELETE. An operator then disables the
          account and removes identifiers. Security logs and backups may remain temporarily.
        </p>
        <label className="text-sm">
          Password
          <Input
            className="mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="text-sm">
          Type DELETE to confirm
          <Input className="mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <Button type="submit" variant="destructive" disabled={busy || confirm !== "DELETE"}>
          Request closure
        </Button>
      </form>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
