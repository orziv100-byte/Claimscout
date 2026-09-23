"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyInner() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") || "";
  const [message, setMessage] = useState("Verifying…");

  useEffect(() => {
    if (!token) {
      setMessage("Missing verification token.");
      return;
    }
    void fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Verification failed");
        setMessage("Email verified. Sign in with your registration password to open the download portal.");
        setTimeout(() => router.push("/login?next=/download"), 1200);
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token, router]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-heading text-3xl">Verify email</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/login?next=/download" className="text-sm text-primary hover:underline">
        Sign in
      </Link>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
