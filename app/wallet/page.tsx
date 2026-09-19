import { WatchPanel } from "@/components/watch-panel";
import { WalletDashboard } from "@/components/wallet-dashboard";

export const metadata = {
  title: "Wallet check",
};

export default function WalletPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Wallet check</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Read-only eligibility against the public catalog, plus a daily remaining-pool watch. Poolindex will not sign,
          will not store keys, and will not scan other people&apos;s wallets beyond the address you provide.
        </p>
      </div>
      <WatchPanel />
      <WalletDashboard />
    </div>
  );
}
