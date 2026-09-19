import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "New password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Choose a new password</h1>
      {token ? <ResetForm token={token} /> : <p className="text-sm text-destructive">Missing reset token.</p>}
    </div>
  );
}
