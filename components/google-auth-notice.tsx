"use client";

import { LoginForm } from "@/components/auth-forms";
import { useSearchParams } from "next/navigation";

const GOOGLE_ERRORS: Record<string, string> = {
  denied: "Google sign-in was cancelled.",
  state: "Google sign-in expired. Try Continue with Google again.",
  failed: "Google sign-in failed.",
  GOOGLE_NOT_CONFIGURED: "Google Sign-In is not connected on this server yet. Use your email or username and password for now.",
  GOOGLE_EMAIL_UNVERIFIED: "Google did not verify that email address.",
  GOOGLE_ACCOUNT_NOT_FOUND: "No PoolIndex account for that Google email. Register with an invitation first.",
  GOOGLE_ACCOUNT_CONFLICT: "That Google account cannot be linked to this email.",
  LINK_REQUIRES_VERIFIED_EMAIL: "Verify this PoolIndex email first, then use Continue with Google to link.",
  INVITE_REQUIRED: "A valid Closed Beta invitation is required to register with Google.",
  INVALID_INVITE: "That invitation code is not valid.",
  invite: "Enter a valid invitation and accept the Terms and Privacy Notice before Continue with Google.",
  desktop: "Desktop Google sign-in expired. Try Continue with Google again.",
};

export function GoogleAuthNotice() {
  const search = useSearchParams();
  const code = search.get("google") || "";
  const message = GOOGLE_ERRORS[code];
  if (!message) return null;
  return (
    <p className="max-w-md text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function LoginFormWithGoogleNotice() {
  return (
    <>
      <GoogleAuthNotice />
      <LoginForm />
    </>
  );
}
