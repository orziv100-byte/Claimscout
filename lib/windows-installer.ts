import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION } from "./app-info.ts";

const CANDIDATES = [`PoolIndex-${APP_VERSION}-win.exe`, "PoolIndex-setup.exe", "PoolIndex.exe"];

export type WindowsInstaller = {
  version: string;
  published: boolean;
  href: string | null;
  filename: string | null;
  requirements: string[];
};

export function windowsInstaller(root = process.cwd()): WindowsInstaller {
  const dir = join(root, "public", "downloads");
  for (const filename of CANDIDATES) {
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

const MAC_CANDIDATES = [
  `PoolIndex-${APP_VERSION}-mac-arm64.zip`,
  `PoolIndex-${APP_VERSION}-mac-x64.zip`,
  `PoolIndex-${APP_VERSION}-mac.zip`,
  `PoolIndex-${APP_VERSION}-mac.dmg`,
];

export function macosInstaller(root = process.cwd()): WindowsInstaller {
  const dir = join(root, "public", "downloads");
  for (const filename of MAC_CANDIDATES) {
    if (existsSync(join(dir, filename))) {
      return {
        version: APP_VERSION,
        published: true,
        href: `/downloads/${filename}`,
        filename,
        requirements: MACOS_REQUIREMENTS,
      };
    }
  }
  return {
    version: APP_VERSION,
    published: false,
    href: null,
    filename: null,
    requirements: MACOS_REQUIREMENTS,
  };
}
