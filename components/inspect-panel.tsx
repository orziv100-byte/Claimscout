"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { VerificationReport } from "@/lib/types";
import { Archive, LoaderCircle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function InspectPanel({ initialUrl = "" }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setReport(null);
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError("Enter a full http(s) URL to inspect.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/verify?url=${encodeURIComponent(parsed.toString())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verify failed");
      setReport(json as VerificationReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspect a claim URL</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://claim.example.org/airdrop"
            className="font-mono text-sm"
          />
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : "Verify"}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {report ? <VerificationView report={report} /> : null}
      </CardContent>
    </Card>
  );
}

export function VerificationView({ report }: { report: VerificationReport }) {
  const Icon =
    report.verdict === "blocked"
      ? ShieldAlert
      : report.verdict === "caution"
        ? ShieldQuestion
        : ShieldCheck;
  const tone =
    report.verdict === "blocked"
      ? "destructive"
      : "default";

  return (
    <div className="flex flex-col gap-3">
      <Alert variant={tone}>
        <Icon />
        <AlertTitle className="capitalize">{report.verdict.replaceAll("_", " ")}</AlertTitle>
        <AlertDescription>{report.verdictReason}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{report.live ? `Live · HTTP ${report.statusCode}` : "Not reachable"}</Badge>
        {report.title ? <Badge variant="secondary">{report.title}</Badge> : null}
        {report.catalogMatch ? (
          <Badge render={<Link href={`/claims/${report.catalogMatch.id}`} />}>
            Catalog: {report.catalogMatch.title}
          </Badge>
        ) : null}
      </div>
      {report.flags.length ? (
        <ul className="space-y-1.5 text-sm">
          {report.flags.map((flag) => (
            <li key={flag.code + flag.message} className="flex gap-2">
              <Badge variant={flag.severity === "danger" ? "destructive" : "outline"}>{flag.severity}</Badge>
              <span className={flag.severity === "danger" ? "text-destructive" : "text-muted-foreground"}>
                {flag.message}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No extra flags.</p>
      )}
      {report.archive.available && report.archive.snapshotUrl ? (
        <a
          href={report.archive.snapshotUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Archive className="size-3.5" /> Open Wayback snapshot
          {report.archive.timestamp ? ` (${report.archive.timestamp})` : ""}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No Wayback snapshot found for this exact URL.</p>
      )}
    </div>
  );
}
