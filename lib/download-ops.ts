import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DOWNLOAD_OPS_DIR = "var/downloads";
export const DOWNLOAD_CONTROL_FILE = "control.json";
export const DOWNLOAD_EVENTS_FILE = "events.jsonl";
export const INTERNAL_ADMIN_BIND = "127.0.0.1";
export const INTERNAL_ADMIN_PORT = 43148;

export type DownloadControl = {
  paused: boolean;
  updatedAt: string | null;
  reason: string;
};

export type DownloadEvent = {
  at: string;
  kind: "page" | "file";
  path: string;
  file: string | null;
  ip: string;
};

const MAX_EVENTS_BYTES = 2 * 1024 * 1024;
const SAFE_FILE = /^PoolIndex[-.].+\.(exe|zip|dmg|blockmap|yml)$/i;

export function downloadOpsDir(root = process.cwd()): string {
  return join(root, DOWNLOAD_OPS_DIR);
}

export function defaultDownloadControl(): DownloadControl {
  return { paused: false, updatedAt: null, reason: "" };
}

export function readDownloadControl(root = process.cwd()): DownloadControl {
  try {
    const raw = readFileSync(join(downloadOpsDir(root), DOWNLOAD_CONTROL_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<DownloadControl>;
    return {
      paused: parsed.paused === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch {
    return defaultDownloadControl();
  }
}

export function downloadsPaused(root = process.cwd()): boolean {
  return readDownloadControl(root).paused;
}

export function writeDownloadControl(update: Partial<DownloadControl>, root = process.cwd()): DownloadControl {
  const dir = downloadOpsDir(root);
  mkdirSync(dir, { recursive: true });
  const next: DownloadControl = {
    ...readDownloadControl(root),
    ...update,
    paused: update.paused === true,
    updatedAt: new Date().toISOString(),
    reason: (update.reason || "").slice(0, 200),
  };
  writeFileSync(join(dir, DOWNLOAD_CONTROL_FILE), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function isInstallerDownloadPath(pathname: string): boolean {
  return pathname === "/downloads" || pathname.startsWith("/downloads/");
}

export function isDownloadPagePath(pathname: string): boolean {
  return pathname === "/download" || pathname.startsWith("/download/");
}

export function installerFilenameFromPath(pathname: string): string | null {
  if (!isInstallerDownloadPath(pathname)) return null;
  const name = pathname.slice("/downloads/".length).split("/")[0] || "";
  if (!name || name.includes("..") || !SAFE_FILE.test(name)) return null;
  return name;
}

export function recordDownloadEvent(input: {
  kind: "page" | "file";
  path: string;
  ip?: string;
}, root = process.cwd()): void {
  try {
    const dir = downloadOpsDir(root);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, DOWNLOAD_EVENTS_FILE);
    if (existsSync(file) && statSync(file).size > MAX_EVENTS_BYTES) {
      const lines = readFileSync(file, "utf8").trim().split("\n");
      writeFileSync(file, `${lines.slice(-1500).join("\n")}\n`, "utf8");
    }
    const event: DownloadEvent = {
      at: new Date().toISOString(),
      kind: input.kind,
      path: input.path.slice(0, 180),
      file: installerFilenameFromPath(input.path),
      ip: sanitizeLoggedIp(input.ip),
    };
    appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    /* fail open — never block a public download because logging failed */
  }
}

export function readDownloadEvents(limit = 50, root = process.cwd()): DownloadEvent[] {
  try {
    const raw = readFileSync(join(downloadOpsDir(root), DOWNLOAD_EVENTS_FILE), "utf8");
    const lines = raw.trim() ? raw.trim().split("\n") : [];
    return lines
      .slice(-Math.max(1, Math.min(limit, 200)))
      .map((line) => JSON.parse(line) as DownloadEvent)
      .reverse();
  } catch {
    return [];
  }
}

export function countDownloadEvents(root = process.cwd()): { total: number; files: Record<string, number>; pages: number } {
  const files: Record<string, number> = {};
  let total = 0;
  let pages = 0;
  try {
    const raw = readFileSync(join(downloadOpsDir(root), DOWNLOAD_EVENTS_FILE), "utf8");
    for (const line of raw.trim() ? raw.trim().split("\n") : []) {
      const event = JSON.parse(line) as DownloadEvent;
      total += 1;
      if (event.kind === "page") pages += 1;
      if (event.file) files[event.file] = (files[event.file] || 0) + 1;
    }
  } catch {
    /* empty */
  }
  return { total, files, pages };
}

export function listPublishedInstallers(root = process.cwd()): { name: string; bytes: number }[] {
  const dir = join(root, "public", "downloads");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => SAFE_FILE.test(name))
    .map((name) => ({ name, bytes: statSync(join(dir, name)).size }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sanitizeLoggedIp(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return value;
  if (value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value)) return value;
  return "unknown";
}

export function isLoopbackHost(host: string | null | undefined): boolean {
  const raw = (host || "").trim().toLowerCase();
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return (end === -1 ? raw : raw.slice(1, end)) === "::1";
  }
  const name = raw.split(":")[0];
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}
