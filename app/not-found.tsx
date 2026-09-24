import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h1 className="font-heading text-3xl">Not found</h1>
      <p className="text-muted-foreground">That page does not exist.</p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="text-primary hover:underline">
          Home
        </Link>
        <Link href="/download" className="text-primary hover:underline">
          Download
        </Link>
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
