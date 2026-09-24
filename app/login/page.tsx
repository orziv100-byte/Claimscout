import { LoginForm } from "@/components/auth-forms";
import { Suspense } from "react";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Closed Beta accounts only. After you sign in, download the Windows app. PoolIndex never asks for a seed phrase.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
