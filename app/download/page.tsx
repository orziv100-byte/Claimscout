import { Button, buttonVariants } from "@/components/ui/button";
import { APP_VERSION, COPYRIGHT, COPYRIGHT_NOTICE } from "@/lib/app-info";
import { contactLine } from "@/lib/contacts";
import { macosInstaller, windowsInstaller } from "@/lib/windows-installer";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = {
  title: "Download PoolIndex",
  description:
    "Download the PoolIndex desktop client for Windows. No payment required to download. Closed Beta research tool — not a guarantee of funds or rewards.",
};

export const dynamic = "force-dynamic";

export default function DownloadPage() {
  const installer = windowsInstaller();
  const mac = macosInstaller();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Closed Beta · Desktop</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Download PoolIndex EXE</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          PoolIndex is a research and safety-check tool for public claim sources. Register with email, confirm your
          email, then download the desktop client. Wallet checks run in the app on your computer. It does not claim
          tokens or hold funds. It does not guarantee that you will find money or rewards. Download does not require
          payment.
        </p>
      </div>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-2xl">Windows</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {installer.version}. Unsigned Closed Beta — Windows SmartScreen may warn. Register with email, confirm
          your email, then download.
        </p>
        <div className="mt-4">
          {installer.published && installer.href ? (
            <a className={cn(buttonVariants())} href={installer.href} download>
              Download PoolIndex EXE
            </a>
          ) : (
            <Button type="button" disabled>
              Windows installer not published yet (v{APP_VERSION})
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-2xl">macOS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Same desktop client idea as Windows. Unsigned Closed Beta. Download does not require payment.
        </p>
        <div className="mt-4">
          {mac.published && mac.href ? (
            <a className={cn(buttonVariants())} href={mac.href} download>
              Download PoolIndex for macOS
            </a>
          ) : (
            <Button type="button" disabled>
              macOS download not published yet (v{APP_VERSION})
            </Button>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-2xl">System requirements</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {installer.requirements.map((item) => (
            <li key={`win-${item}`}>{item}</li>
          ))}
          {mac.requirements
            .filter((item) => !installer.requirements.includes(item))
            .map((item) => (
              <li key={`mac-${item}`}>{item}</li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-2xl">Legal and contact</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <Link className="text-primary underline" href="/privacy">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link className="text-primary underline" href="/terms">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link className="text-primary underline" href="/accessibility">
              Accessibility
            </Link>
          </li>
          <li>
            <Link className="text-primary underline" href="/safety">
              Safety rules
            </Link>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{COPYRIGHT_NOTICE}</p>
        <p className="mt-2 text-sm text-muted-foreground">{COPYRIGHT}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Support:{" "}
          <a className="text-primary underline" href={`mailto:${contactLine("support")}`}>
            {contactLine("support")}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
