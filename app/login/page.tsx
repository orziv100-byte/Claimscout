import { LoginFormWithGoogleNotice } from "@/components/google-auth-notice";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Closed Beta accounts only. Sign in with the exact email or username from registration — another Gmail inbox will
        not work. Continue with Google, or email/username and password. After sign-in you choose Trial or Paid
        Subscription. Public addresses, never seed phrases.
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        If the password is rejected after you verified email, use Forgot password on this same address. Type the
        password yourself; a saved browser password for another PoolIndex account will fail.
      </p>
      <Suspense>
        <LoginFormWithGoogleNotice />
      </Suspense>
    </div>
  );
}
