"use strict";

const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const ROOT = __dirname;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const BINARY_EXT = new Set([".png", ".ico", ".woff", ".woff2", ".7z", ".icns"]);
const PACKED_EXT = new Set([".exe", ".dll", ".asar", ".blockmap", ".zip", ".dmg"]);

const TEXT_FORBIDDEN = [
  /PAYPAL_CLIENT_SECRET\s*[:=]/i,
  /GOOGLE_CLIENT_SECRET\s*[:=]/i,
  /POOLINDEX_SESSION_SECRET\s*[:=]/i,
  /POOLINDEX_PLAN_SECRET\s*[:=]/i,
  /POOLINDEX_PAID_KEYS\s*[:=]/i,
  /RESEND_API_KEY\s*[:=]/i,
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/,
  /\bpiagt_[A-Za-z0-9_-]{16,}/,
  /\bsk_live_[A-Za-z0-9]{8,}/,
];

const PACKED_NEEDLES = [
  "PAYPAL_CLIENT_SECRET=",
  "GOOGLE_CLIENT_SECRET=",
  "POOLINDEX_SESSION_SECRET=",
  "POOLINDEX_PLAN_SECRET=",
  "POOLINDEX_PAID_KEYS=",
  "RESEND_API_KEY=",
  "BEGIN PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
];

const FORBIDDEN_FILENAMES = new Set([".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"]);

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.endsWith(".tmp")) continue;
    const full = join(dir, name);
    if (name === "win-unpacked" || name === "mac" || name === "mac-arm64" || name === "mac-x64" || name === "linux-unpacked") {
      const asar = join(full, "resources", "app.asar");
      if (existsSync(asar)) acc.push(asar);
      continue;
    }
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function scanText(label, buf) {
  const hits = [];
  const text = buf.toString("utf8");
  for (const re of TEXT_FORBIDDEN) {
    if (re.test(text)) hits.push(`${label}: ${re}`);
  }
  return hits;
}

function scanPacked(label, buf) {
  const hits = [];
  const latin = buf.toString("latin1");
  for (const needle of PACKED_NEEDLES) {
    if (latin.includes(needle)) hits.push(`${label}: packed needle ${needle}`);
  }
  return hits;
}

const hits = [];
for (const file of walk(ROOT)) {
  const name = file.split(/[/\\]/).pop() || "";
  if (name === "check-secrets.cjs") continue;
  if (FORBIDDEN_FILENAMES.has(name) || name.startsWith(".env")) {
    hits.push(`forbidden file ${relative(ROOT, file)}`);
    continue;
  }
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  if (BINARY_EXT.has(ext)) continue;
  const buf = readFileSync(file);
  if (PACKED_EXT.has(ext)) hits.push(...scanPacked(relative(ROOT, file), buf));
  else hits.push(...scanText(relative(ROOT, file), buf));
}

const dist = join(ROOT, "dist");
if (existsSync(dist)) {
  for (const file of walk(dist)) {
    const name = file.split(/[/\\]/).pop() || "";
    if (FORBIDDEN_FILENAMES.has(name) || name.startsWith(".env")) {
      hits.push(`forbidden packed file ${relative(ROOT, file)}`);
      continue;
    }
    const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
    const buf = readFileSync(file);
    if (PACKED_EXT.has(ext) || ext === ".exe") hits.push(...scanPacked(relative(ROOT, file), buf));
    else if (!BINARY_EXT.has(ext)) hits.push(...scanText(relative(ROOT, file), buf));
  }
}

if (hits.length) {
  console.error("SECRET_SCAN_FAIL");
  for (const hit of hits) console.error(hit);
  process.exit(1);
}
console.log("SECRET_SCAN_PASS");
console.log("scanned_desktop_source=yes");
console.log(`scanned_dist=${existsSync(dist) ? "yes" : "no"}`);
