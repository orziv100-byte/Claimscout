import { RegisterForm } from "@/components/auth-forms";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Create your account</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Register with email, username, and password. After you confirm your email, you can download PoolIndex.
      </p>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
