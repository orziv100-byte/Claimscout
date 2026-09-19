import { HuntList } from "@/components/deep-hunt-list";

export const metadata = {
  title: "Hunts",
};

export default function HuntsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Deep Hunts</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Server-persisted investigations. Refresh, close the browser, or sign back in — findings already discovered stay
          on your account.
        </p>
      </div>
      <HuntList />
    </div>
  );
}
