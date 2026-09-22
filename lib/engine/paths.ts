import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function engineDataRoot(): string {
  return process.env.POOLINDEX_ENGINE_DIR || join(process.cwd(), "var/engine");
}

export function writeEngineAtomic(dest: string, body: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, dest);
}
