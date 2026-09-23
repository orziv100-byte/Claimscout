"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { websitePostLoginPath } from "@/lib/site-surface";
import { useSearchParams } from "next/navigation";
import { Suspense, type MouseEvent } from "react";

type Props = {
  intent: "login" | "register";
  inviteCode?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
};

function googleStartHref(props: Props, next: string): string {
  const params = new URLSearchParams({ intent: props.intent, next });
  if (props.intent === "register") {
    if (props.inviteCode) params.set("inviteCode", props.inviteCode);
    if (props.acceptTerms) params.set("acceptTerms", "1");
    if (props.acceptPrivacy) params.set("acceptPrivacy", "1");
  }
  return `/api/auth/google/start?${params}`;
}

export function GoogleContinueButton(props: Props) {
  return (
    <Suspense fallback={<GoogleContinueFallback />}>
      <GoogleContinueButtonInner {...props} />
    </Suspense>
  );
}

function GoogleContinueFallback() {
  return (
    <span
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full max-w-md justify-center gap-2")}
      aria-disabled="true"
    >
      Continue with Google
    </span>
  );
}

function GoogleContinueButtonInner(props: Props) {
  const search = useSearchParams();
  const desktop = typeof window !== "undefined" && Boolean(window.poolindexDesktop);
  const next = websitePostLoginPath(search.get("next"), desktop);
  const href = googleStartHref(props, next);
  const registerReady = props.intent !== "register" || Boolean(props.inviteCode && props.acceptTerms && props.acceptPrivacy);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!registerReady) {
      event.preventDefault();
      return;
    }
    const desktop = typeof window !== "undefined" ? window.poolindexDesktop : undefined;
    if (!desktop?.startGoogleAuth) return;
    event.preventDefault();
    if (!registerReady) return;
    void desktop.startGoogleAuth({
      intent: props.intent,
      next,
      inviteCode: props.inviteCode || "",
      acceptTerms: Boolean(props.acceptTerms),
      acceptPrivacy: Boolean(props.acceptPrivacy),
    });
  }

  return (
    <a
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full max-w-md justify-center gap-2")}
      href={registerReady ? href : undefined}
      aria-disabled={!registerReady}
      onClick={onClick}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l6.3 5.2C40.1 35.9 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z" />
      </svg>
      Continue with Google
    </a>
  );
}

export function AuthOrDivider() {
  return (
    <div className="flex max-w-md items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

declare global {
  interface Window {
    poolindexDesktop?: {
      shell: string;
      platform: string;
      version: string;
      startGoogleAuth?: (payload: {
        intent: "login" | "register";
        next: string;
        inviteCode?: string;
        acceptTerms?: boolean;
        acceptPrivacy?: boolean;
      }) => Promise<unknown>;
    };
  }
}
