import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION } from "./app-info.ts";

const WIN_VERSIONED_RE = /^PoolIndex-(\d+\.\d+\.\d+)-win\.exe$/;
const MAC_VERSIONED_RE = /^PoolIndex-(\d+\.\d+\.\d+)-mac(?:-arm64|-x64)?\.(?:zip|dmg)$/;
const WIN_LEGACY_CANDIDATES = ["PoolIndex-setup.exe", "PoolIndex.exe"];

export type WindowsInstaller = {
  version: string;
  published: boolean;
  href: string | null;
  filename: string | null;
  requirements: string[];
};

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Highest-semver file matching `pattern` in `dir`. Never throws on a missing/unreadable dir. */
function latestVersioned(dir: string, pattern: RegExp): { filename: string; version: string } | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  let best: { filename: string; version: string } | null = null;
  for (const filename of entries) {
    const match = filename.match(pattern);
    if (!match) continue;
    const version = match[1]!;
    if (!best || compareSemver(version, best.version) > 0) best = { filename, version };
  }
  return best;
}

export function windowsInstaller(root = process.cwd()): WindowsInstaller {
  const dir = join(root, "public", "downloads");
  const latest = latestVersioned(dir, WIN_VERSIONED_RE);
  if (latest) {
    return {
      version: latest.version,
      published: true,
      href: `/downloads/${latest.filename}`,
      filename: latest.filename,
      requirements: WINDOWS_REQUIREMENTS,
    };
  }
  for (const filename of WIN_LEGACY_CANDIDATES) {
    if (existsSync(join(dir, filename))) {
      return {
        version: APP_VERSION,
        published: true,
        href: `/downloads/${filename}`,
        filename,
        requirements: WINDOWS_REQUIREMENTS,
      };
    }
  }
  return {
    version: APP_VERSION,
    published: false,
    href: null,
    filename: null,
    requirements: WINDOWS_REQUIREMENTS,
  };
}

export const WINDOWS_REQUIREMENTS = [
  "Windows 10 or 11, 64-bit",
  "Internet connection to poolindex.app",
  "No seed phrase, private key, or PayPal secret in the installer or the app",
];

export const MACOS_REQUIREMENTS = [
  "macOS 12 or later, Intel or Apple Silicon",
  "Internet connection to poolindex.app",
  "No seed phrase, private key, or PayPal secret in the installer or the app",
];

export function macosInstaller(root = process.cwd()): WindowsInstaller {
  const dir = join(root, "public", "downloads");
  const latest = latestVersioned(dir, MAC_VERSIONED_RE);
  if (latest) {
    return {
      version: latest.version,
      published: true,
      href: `/downloads/${latest.filename}`,
      filename: latest.filename,
      requirements: MACOS_REQUIREMENTS,
    };
  }
  return {
    version: APP_VERSION,
    published: false,
    href: null,
    filename: null,
    requirements: MACOS_REQUIREMENTS,
  };
}
