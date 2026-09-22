import { ConnectAgentDocs, ConnectAgentPanel } from "@/components/connect-agent-panel";

export const metadata = {
  title: "Connect your agent",
};

export default function ConnectAgentPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Connect your agent</h1>
        <p className="mt-2 text-muted-foreground">
          Read-only MCP for a client you already pay for. No signing. No seed. No PoolIndex LLM.
        </p>
      </div>
      <ConnectAgentDocs />
      <ConnectAgentPanel />
    </div>
  );
}
