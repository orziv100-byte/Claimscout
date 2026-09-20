import { EXTERNAL_CLAIM_WARNING } from "@/lib/disclosures";

export function ExternalClaimWarning({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"} role="note">
      {EXTERNAL_CLAIM_WARNING}
    </p>
  );
}
