export function archiveFallbackUrl(url: string): string {
  return `https://web.archive.org/web/${url}`;
}

export function inspectPath(url: string): string {
  return `/discover?inspect=${encodeURIComponent(url)}`;
}

export function officialLinkSet(input: {
  officialUrl?: string;
  archiveUrl?: string;
}): { officialUrl?: string; archiveUrl?: string; inspectHref?: string } {
  const officialUrl = input.officialUrl?.trim() || undefined;
  const archiveUrl = input.archiveUrl?.trim() || (officialUrl ? archiveFallbackUrl(officialUrl) : undefined);
  return {
    officialUrl,
    archiveUrl,
    inspectHref: officialUrl ? inspectPath(officialUrl) : undefined,
  };
}
