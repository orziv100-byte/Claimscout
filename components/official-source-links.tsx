import { ExternalClaimWarning } from "@/components/external-claim-warning";
import { officialLinkSet } from "@/lib/official-source";
import { Archive, ArrowUpRight, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function OfficialSourceLinks({
  officialUrl,
  archiveUrl,
  flagged = false,
  showWarning = true,
  label,
}: {
  officialUrl?: string;
  archiveUrl?: string;
  flagged?: boolean;
  showWarning?: boolean;
  label?: string;
}) {
  const links = officialLinkSet({ officialUrl, archiveUrl });
  if (!links.officialUrl && !links.archiveUrl) {
    return <p className="text-xs text-muted-foreground">No official URL on file.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-3 text-sm">
        {links.officialUrl ? (
          <a
            href={links.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {flagged ? "Flagged URL" : label ?? "Official source"} <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
        {links.archiveUrl ? (
          <a
            href={links.archiveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Archive className="size-3.5" /> Archive
          </a>
        ) : null}
        {links.inspectHref ? (
          <Link href={links.inspectHref} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ShieldAlert className="size-3.5" /> Inspect before clicking
          </Link>
        ) : null}
      </div>
      {showWarning ? <ExternalClaimWarning compact /> : null}
    </div>
  );
}
