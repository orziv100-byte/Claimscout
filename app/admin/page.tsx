import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Control center</h1>
      <p className="text-sm text-muted-foreground">
        Admin access is separate from normal user authorization. Passwords, hashes, secrets, and private keys are never
        shown.
      </p>
      <AdminDashboard />
    </div>
  );
}
