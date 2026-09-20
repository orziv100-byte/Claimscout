import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldOff } from "lucide-react";

export const metadata = {
  title: "Safety rules",
};

export default function SafetyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">What PoolIndex will and will not do</h1>
        <p className="mt-3 text-muted-foreground">
          This is a discovery and inspection tool for rewards that were intentionally offered to the public, or that
          the connected wallet is demonstrably eligible to claim. It is not a wallet cracker, a mixer hunter, or a
          recovery service.
        </p>
      </div>

      <Alert>
        <ShieldOff />
        <AlertTitle>Hard refusals</AlertTitle>
        <AlertDescription>
          Private-key brute force, seed-phrase search or recovery, accessing wallets you do not control, exploiting
          contracts or sites, claim automation / airdrop hunters, and auto-signing transactions are all out of scope.
          Pasting a seed or 64-byte hex key is rejected.
        </AlertDescription>
      </Alert>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">Allowed surfaces</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Old giveaways, faucets, airdrops, and redemption links that were posted publicly.</li>
          <li>Public crypto puzzles — documented only; no solvers and no range scanning.</li>
          <li>First-come promotional claims and abandoned public campaign pages, via live web and Wayback.</li>
          <li>Testnet and community developer faucets.</li>
          <li>Forum posts (Bitcointalk, Reddit) that contain public claim instructions.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">Sources</h2>
        <p className="text-muted-foreground">
          Bitcointalk, Reddit, GitHub, Internet Archive / Wayback Machine, project websites, crypto blogs, public
          blockchain explorers, published airdrop announcements, and archived faucet pages. Each live hit is safety
          checked before display. A pass is not a guarantee that a URL is safe.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">Host protection</h2>
        <p className="text-muted-foreground">
          PoolIndex refuses to stack live scans, archive lookups, and on-chain checks when this machine is short on
          RAM, CPU, or disk. Overload returns HTTP 503 with a resource snapshot. Failed scans are not retried in a
          loop. Stability comes before speed.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">Wallet policy</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Connecting or pasting an address is read-only (balance / mapping calls).</li>
          <li>
            The address you are checking is kept in browser session storage. The same public address is also stored on
            your account for plan wallet limits — never a private key.
          </li>
          <li>On-chain submit is disabled until a read-only check says the address is eligible.</li>
          <li>Merkle airdrops open the official claim UI. This app does not forge merkle proofs.</li>
          <li>If a page asks for a seed phrase, PoolIndex flags it as blocked.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">How to read a result</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Official</strong> — published by the project on a domain or repo we can
            name.
          </li>
          <li>
            <strong className="text-foreground">Documented public offer</strong> — appeared in public archives or
            well-known community indexes.
          </li>
          <li>
            <strong className="text-foreground">Unverified</strong> — a live search hit. Inspect the URL before
            interacting.
          </li>
          <li>
            <strong className="text-foreground">Window closed / archive only</strong> — useful as history, not a live
            payout.
          </li>
        </ul>
      </section>
    </div>
  );
}
