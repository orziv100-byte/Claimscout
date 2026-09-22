export const metadata = {
  title: "Windows client",
};

export default function DesktopPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Windows client</h1>
        <p className="mt-2 text-muted-foreground">
          The engine stays on the PoolIndex server. The Windows client only opens Wallet Check in your browser. It
          does not download adapters, does not ask for a seed, and does not sign.
        </p>
      </div>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">What it does</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Download the launcher if the file is published on this host.</li>
          <li>Open it. Windows may warn because Closed Beta builds are not code-signed.</li>
          <li>Sign in on poolindex.app with your invite, add a public 0x address, scan, and monitor.</li>
        </ol>
        <p>
          Auto-update, trial, and paid subscription are after Closed Beta. Telemetry on the server is scan success or
          failure, runtime, errors, sources checked, and finding counts. No seed or key.
        </p>
      </section>
      <p>
        <a className="text-foreground underline" href="/PoolIndex.exe">
          Download PoolIndex.exe
        </a>
        <span className="text-muted-foreground"> — if this 404s, the Linux host has no Windows compiler yet; use the website.</span>
      </p>
    </div>
  );
}
