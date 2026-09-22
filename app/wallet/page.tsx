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
          Paste a public 0x address. The table of named offers is the product. Holdings stay separate so leftover
          balances are not mistaken for Eligible. Connecting a wallet is optional. PoolIndex does not claim tokens for
          you and does not hide offer names behind payment.
        </p>
      </div>
      <WalletDashboard />
      <WatchPanel />
    </div>
  );
}
