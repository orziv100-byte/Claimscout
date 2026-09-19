import { LoginForm } from "@/components/auth-forms";
import { Suspense } from "react";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Sign in</h1>
      <p className="text-sm text-muted-foreground">Closed Beta accounts only. Public addresses, never seed phrases.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
