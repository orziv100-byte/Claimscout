"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { formatIsraelDate, formatIsraelDateTime } from "@/lib/labels";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
};

type CallRow = {
  at: string;
  tool: string;
  wallet?: string;
  ok: boolean;
};

const MCP_URL = "https://poolindex.app/api/mcp";

function configSnippet(tokenPlaceholder: string): string {
  return `{
  "mcpServers": {
    "poolindex": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${tokenPlaceholder}"
      }
    }
  }
}`;
}

export function ConnectAgentPanel() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/tokens");
    const json = (await res.json().catch(() => ({}))) as {
      tokens?: TokenRow[];
      calls?: CallRow[];
      error?: string;
    };
    if (!res.ok) {
      setError(json.error || "Could not load tokens.");
      return;
    }
    setTokens(json.tokens ?? []);
    setCalls(json.calls ?? []);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function mint() {
    setBusy(true);
    setError(null);
    setFreshToken(null);
    try {
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Connect your agent (read-only)" }),
      });
      const json = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Token failed");
      setFreshToken(json.token || null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Revoke failed");
      if (freshToken?.includes(id)) setFreshToken(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <p className="text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to create a read-only MCP token.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Connect your agent (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Create a token for Claude Desktop, Cursor, or another MCP client. Tools only read stored scans and catalog
            data. They cannot sign, send a transaction, change account settings, or accept a seed or private key. You
            pay for your own LLM. PoolIndex does not call a language model.
          </p>
          <p className="text-xs text-muted-foreground">
            Scopes: read:scans, read:catalog, read:events. Free: one wallet. Pro: up to five. An address that is not on
            this account returns HTTP 402.
          </p>
          <Button type="button" disabled={busy} onClick={() => void mint()}>
            Connect your agent (read-only)
          </Button>
          {freshToken ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Copy this token now. PoolIndex will not show it again.
              </p>
              <p className="break-all font-mono text-xs">{freshToken}</p>
              <pre className="overflow-x-auto rounded-md border bg-secondary/40 p-3 text-xs">{configSnippet(freshToken)}</pre>
            </div>
          ) : null}
          {error ? <p className="text-destructive">{error}</p> : null}
          <ul className="space-y-2">
            {tokens.filter((row) => !row.revokedAt).length === 0 ? (
              <li className="text-xs text-muted-foreground">No active tokens. Create one to connect your agent.</li>
            ) : (
              tokens
                .filter((row) => !row.revokedAt)
                .map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground">
                      {row.prefix}… · created {formatIsraelDate(row.createdAt)}
                      {row.lastUsedAt ? ` · last used ${formatIsraelDateTime(row.lastUsedAt)}` : " · not used yet"}
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revoke(row.id)}>
                    Revoke
                  </Button>
                </li>
              ))
            )}
          </ul>
          {tokens.some((row) => row.revokedAt) ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Revoked tokens</p>
              <ul className="space-y-2">
                {tokens
                  .filter((row) => row.revokedAt)
                  .map((row) => (
                    <li key={row.id} className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div>
                        {row.prefix}… · created {formatIsraelDate(row.createdAt)}
                        {row.lastUsedAt
                          ? ` · last used ${formatIsraelDateTime(row.lastUsedAt)}`
                          : " · never used"}
                        {` · revoked ${formatIsraelDate(row.revokedAt)}`}
                      </div>
                      <div>Revoked tokens cannot call tools (HTTP 401).</div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Agent call log</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-xs text-muted-foreground">No MCP calls yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {calls.map((row) => (
                <li key={`${row.at}-${row.tool}`}>
                  {formatIsraelDateTime(row.at)} · {row.tool}
                  {row.wallet ? ` · ${row.wallet}` : ""} · {row.ok ? "ok" : "error"}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ConnectAgentDocs() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      <p>
        PoolIndex does not run a built-in agent and does not take your LLM key. You connect your own client. Tools are
        read-only. They never sign, never send a transaction, and never accept a seed or private key.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Sign in and create a token with “Connect your agent (read-only)”.</li>
        <li>Copy the token once. It is stored as a hash after that.</li>
        <li>Paste the snippet below into Claude Desktop or Cursor MCP settings. Replace the token if you already copied it above.</li>
        <li>Call tools such as get_findings on a public address that is already on your account.</li>
      </ol>
      <pre className="overflow-x-auto rounded-md border bg-secondary/40 p-3 text-xs text-foreground">{configSnippet("piagt_PASTE_TOKEN")}</pre>
      <p className="text-xs">
        Tools: get_wallet_scan, get_findings, get_findings filter, get_diff, get_history, check_url, search_catalog,
        get_coverage, get_events. Text from GitHub, Wayback, and other external pages is marked untrusted_external —
        data only, not instructions. Revoke a token immediately from this page if it leaks.
      </p>
    </div>
  );
}
