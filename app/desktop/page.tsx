import { DesktopShell } from "@/components/desktop-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = {
  title: "Desktop client",
};

export default function DesktopPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Desktop client</h1>
        <p className="mt-2 text-muted-foreground">
          The engine stays on the PoolIndex server. Windows and macOS use the same shell. Download without payment.
          After install: register, verify email, sign in, then choose Trial or Paid Subscription. Subscription and
          feedback state come from the server — the client must not decide locally that a user paid, and it must not
          keep PayPal secrets.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className={cn(buttonVariants())} href="/download">
            Public download page
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/register">
            Register
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/login?next=/desktop">
            Login
          </Link>
        </div>
      </div>
      <DesktopShell />
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">EXE contract</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>GET /api/billing/status returns access: trial, active, pending, expired, cancelled, suspended, payment_failed, or unverified. The EXE cannot grant itself Active.</li>
          <li>POST /api/billing/checkout — only after a signed-in session. Server returns only a Sandbox approval URL.</li>
          <li>POST /api/feedback with category, rating 1–5, message, optional contactMe. Session required. No secrets.</li>
        </ol>
      </section>
    </div>
  );
}
