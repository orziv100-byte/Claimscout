import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WatchSnapshot } from "./watch";

function watchRoot(): string {
  return process.env.POOLINDEX_WATCH_DIR || join(process.cwd(), "var/results/watch");
}

export function watchPaths(root = watchRoot()) {
  return {
    root,
    latest: join(root, "latest.json"),
    digest: join(root, "digest-latest.md"),
    history: join(root, "history"),
  };
}

export function readLatestWatchSnapshot(root = watchRoot()): WatchSnapshot | null {
  const file = watchPaths(root).latest;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as WatchSnapshot;
  } catch {
    return null;
  }
}

export function writeWatchSnapshot(snapshot: WatchSnapshot, digest: string, root = watchRoot()): void {
  const paths = watchPaths(root);
  mkdirSync(paths.history, { recursive: true });
  const stamp = snapshot.capturedAt.replace(/[:.]/g, "").replace(/Z$/, "Z");
  writeFileSync(join(paths.history, `${stamp}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  writeFileSync(paths.latest, `${JSON.stringify(snapshot, null, 2)}\n`);
  writeFileSync(paths.digest, digest);
  pruneHistory(paths.history, 60);
}

function pruneHistory(dir: string, keep: number) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const extra = files.slice(0, Math.max(0, files.length - keep));
  for (const name of extra) {
    rmSync(join(dir, name));
  }
}
