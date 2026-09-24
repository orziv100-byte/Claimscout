import { getLocalWalletScan, localScanHistory, startLocalWalletScan } from "./local-host.ts";

type EngineOp = {
  id?: unknown;
  op?: string;
  address?: string;
};

function reply(id: unknown, result: unknown, error?: string) {
  if (typeof process.send === "function") process.send({ id, result, error });
}

function handle(msg: EngineOp) {
  const address = typeof msg.address === "string" ? msg.address : "";
  try {
    if (msg.op === "scan") reply(msg.id, startLocalWalletScan(address));
    else if (msg.op === "poll") reply(msg.id, getLocalWalletScan(address));
    else if (msg.op === "history") reply(msg.id, localScanHistory(address));
    else reply(msg.id, null, "unknown op");
  } catch (err) {
    reply(msg.id, null, err instanceof Error ? err.message : "engine error");
  }
}

process.on("message", (msg) => {
  if (msg && typeof msg === "object") handle(msg as EngineOp);
});
