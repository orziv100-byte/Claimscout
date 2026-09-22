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
          Paste a public 0x address. First you see activity on this wallet, then leftover holdings, then catalog names
          that are the same for everyone (folded). PoolIndex does not invent Eligible and does not hide names behind
          payment. Connecting a wallet is optional.
        </p>
      </div>
      <WalletDashboard />
      <WatchPanel />
    </div>
  );
}
