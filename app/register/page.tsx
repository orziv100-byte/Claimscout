import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl">Join Closed Beta</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Registration requires a valid invitation. You must accept the Terms of Use and Privacy Notice. Poolindex never
        asks for a seed phrase or private key.
      </p>
      <RegisterForm />
    </div>
  );
}
