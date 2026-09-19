"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultFeedback } from "@/components/result-feedback";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import type { LeadRecord } from "@/lib/intelligence/types";

export function LeadCard({ lead }: { lead: LeadRecord }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{LEAD_STATUS_LABEL[lead.status] ?? lead.status}</Badge>
          <Badge variant="secondary">{lead.opportunityType}</Badge>
          {lead.historicalLayer ? <Badge variant="outline">Historical</Badge> : null}
          {lead.status === "reviewable" ? <Badge>Safe to review</Badge> : null}
        </div>
        <CardTitle className="mt-2 text-base">{lead.projectName}</CardTitle>
        <CardDescription>
          {lead.chain ?? "chain unknown"} · {lead.token ?? "token unknown"} · source {lead.discoverySource}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>{lead.why}</p>
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Source confidence: {lead.sourceConfidence.replaceAll("_", " ")}</div>
          <div>Historical evidence: {lead.historicalEvidence}</div>
          <div>On-chain evidence: {lead.onchainEvidence}</div>
          <div>Wallet relevance: {lead.walletRelevance.replaceAll("_", " ")}</div>
          <div>Claim window: {lead.claimWindow}</div>
          <div>Eligibility: {lead.eligibility.replaceAll("_", " ")}</div>
          <div>Risk: {lead.risk.replaceAll("_", " ")}</div>
          <div>Last checked: {lead.lastChecked}</div>
        </dl>
        {lead.evidence.length ? (
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {lead.evidence.map((row) => (
              <li key={row.id}>
                {row.label}
                {row.url ? (
                  <>
                    {" "}
                    <a href={row.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                      source
                    </a>
                  </>
                ) : null}
                <span className="text-muted-foreground"> · {row.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No evidence recorded yet.</p>
        )}
        <ResultFeedback source={lead.discoverySource} claimId={lead.catalogId} leadId={lead.id} url={lead.officialDocumentation} />
      </CardContent>
    </Card>
  );
}
