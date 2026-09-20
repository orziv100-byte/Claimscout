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
          Read-only eligibility against the public catalog, plus a daily remaining-pool watch. PoolIndex will not sign
          for you, will not store keys, and will not scan other people&apos;s wallets beyond the public address you
          provide. That public address is stored on your account for plan limits, and also in browser session storage
          while you work.
        </p>
      </div>
      <WatchPanel />
      <WalletDashboard />
    </div>
  );
}
