import { ForgotForm } from "@/components/auth-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Forgot password</h1>
      <ForgotForm />
    </div>
  );
}
