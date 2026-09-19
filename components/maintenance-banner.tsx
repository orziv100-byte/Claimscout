"use client";

import { useAuth } from "@/components/auth-provider";
import Link from "next/link";

export function MaintenanceBanner() {
  const { ops, user } = useAuth();
  if (!ops?.maintenanceMode && ops?.scansEnabled !== false) return null;
  if (ops.scansEnabled && !ops.maintenanceMode) return null;
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm">
      {ops.maintenanceMode ? "Poolindex is in maintenance mode. " : "New scans are paused. "}
      Existing accounts and data are preserved.
      {ops.reason ? ` ${ops.reason}` : ""}
      {user?.role === "admin" ? (
        <>
          {" "}
          <Link href="/admin" className="underline">
            Admin
          </Link>
        </>
      ) : null}
    </div>
  );
}
