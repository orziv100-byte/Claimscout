"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Conn = "online" | "offline" | "problem";

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<Conn>("online");

  const probe = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline");
      return;
    }
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setState(res.ok ? "online" : "problem");
    } catch {
      setState("problem");
    }
  }, []);

  useEffect(() => {
    void probe();
    const onOffline = () => setState("offline");
    const onOnline = () => {
      void probe();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [probe]);

  if (state === "online") {
    return compact ? <span className="text-muted-foreground">Online</span> : null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-destructive" role="status">
      {state === "offline" ? "Offline" : "Connection problem"}
      <Button type="button" size="xs" variant="outline" onClick={() => void probe()}>
        Retry
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => window.location.reload()}>
        Refresh
      </Button>
    </span>
  );
}
