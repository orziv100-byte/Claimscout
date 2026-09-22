export const metadata = {
  title: "Windows client",
};

export default function DesktopPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Windows client</h1>
        <p className="mt-2 text-muted-foreground">
          The engine stays on the PoolIndex server. Closed Beta uses the website. A Windows launcher is not published
          on this host yet.
        </p>
      </div>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">Use the website</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open{" "}
            <a className="text-foreground underline" href="/wallet">
              Wallet Check
            </a>{" "}
            in your browser.
          </li>
          <li>Sign in with your invite, paste a public 0x address, scan, and monitor.</li>
          <li>The site never asks for a seed and never signs.</li>
        </ol>
        <p>
          A downloadable PoolIndex.exe is not built on this Linux host. Auto-update, trial, and paid subscription come
          after Closed Beta. Do not wait for a 404 download link.
        </p>
      </section>
    </div>
  );
}
