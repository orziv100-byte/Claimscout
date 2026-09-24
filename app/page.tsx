import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = {
  title: "PoolIndex",
  description:
    "Closed Beta research tool for public crypto claim sources. Download the desktop app. Register with invite, verify email, then sign in.",
};

export default function PublicHomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Closed Beta</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">PoolIndex</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          PoolIndex is a research and safety-check tool for public claim sources. The desktop application is where you
          check wallets and scan. This website is for download, registration, and account access only. It does not claim
          tokens or hold funds. It does not guarantee funds or rewards.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className={cn(buttonVariants())} href="/download">
          Download PoolIndex
        </Link>
        <Link className={cn(buttonVariants({ variant: "outline" }))} href="/register">
          Register
        </Link>
        <Link className={cn(buttonVariants({ variant: "outline" }))} href="/login?next=/download">
          Sign in
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        After you confirm your email and sign in, you get a download portal — Windows installer, account, and planned
        payment. Scanning tools are in the desktop application.
      </p>
    </div>
  );
}
