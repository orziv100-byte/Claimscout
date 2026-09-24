#!/usr/bin/env node
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "lib/engine/local-entry.ts");
const outfile = join(root, "desktop/engine.cjs");

const stubs = new Map([
  [
    "lib/auth.ts",
    `export class AuthError extends Error { constructor(message, code) { super(message); this.code = code; } }
export function getUserById() { return null; }
export function listUsers() { return []; }
export function updateUser() { return null; }
`,
  ],
  [
    "lib/beta-store.ts",
    `export function betaRoot() { return process.env.POOLINDEX_ENGINE_DIR || process.cwd(); }
export function withBetaLock(fn) { return fn(); }
export function recordSecurity() {}
export function mutateBetaState(fn) { return fn({ users: [] }); }
`,
  ],
  ["lib/telemetry.ts", `export function trackWalletScan() {}\nexport function trackWalletAlert() {}\n`],
  ["lib/mail.ts", `export async function sendMail() { return { ok: false }; }\n`],
  ["lib/ops.ts", `export function scansAreOpen() { return true; }\n`],
  [
    "lib/feedback.ts",
    `export function submitFeedback() { return { ok: false }; }
export function listFeedback() { return []; }
`,
  ],
]);

mkdirSync(dirname(outfile), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile,
  logLevel: "info",
  legalComments: "none",
  sourcemap: false,
  minify: false,
  banner: {
    js: '"use strict";\n/* PoolIndex local wallet engine. No operator secrets. */\n',
  },
  alias: {
    "@": root,
  },
  plugins: [
    {
      name: "poolindex-desktop-stubs",
      setup(buildApi) {
        buildApi.onLoad({ filter: /.*/ }, async (args) => {
          const relative = args.path.startsWith(root) ? args.path.slice(root.length + 1).replaceAll("\\", "/") : "";
          const stub = stubs.get(relative);
          if (!stub) return null;
          return { contents: stub, loader: "js" };
        });
      },
    },
  ],
});

console.log(`bundled ${outfile}`);
