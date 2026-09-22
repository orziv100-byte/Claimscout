#!/usr/bin/env node
/**
 * Operator helper: ensure poolindex.app exists in Resend and optionally send a test mail.
 * Reads RESEND_API_KEY from the environment or gitignored .env. Never prints the key.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteMailUrl, resetMailProvider, sendMail } from "../lib/mail.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAIL_DOMAIN = "poolindex.app";
const RESEND_API = "https://api.resend.com";

function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function apiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set. Put it in the gitignored .env file.");
  }
  return key;
}

async function resend(path: string, init: RequestInit = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

function printDns(records: unknown): void {
  if (!Array.isArray(records)) {
    console.log("No DNS records returned.");
    return;
  }
  console.log("DNS records for poolindex.app (add these at Cloudflare):");
  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    console.log(
      `- ${rec.type} ${rec.name} -> ${rec.value}${rec.priority != null ? ` (priority ${rec.priority})` : ""} [${rec.record || rec.status || ""}]`,
    );
  }
}

async function ensureDomain(): Promise<{ id: string; status: string }> {
  const listed = await resend("/domains");
  const data = listed.json.data;
  const existing = Array.isArray(data)
    ? data.find((row) => row && typeof row === "object" && (row as { name?: string }).name === MAIL_DOMAIN)
    : undefined;
  let id = existing && typeof existing === "object" ? String((existing as { id?: string }).id || "") : "";
  if (!id) {
    const created = await resend("/domains", {
      method: "POST",
      body: JSON.stringify({ name: MAIL_DOMAIN, region: "us-east-1" }),
    });
    if (created.status === 409) {
      const retry = await resend("/domains");
      const again = Array.isArray(retry.json.data)
        ? retry.json.data.find((row) => row && typeof row === "object" && (row as { name?: string }).name === MAIL_DOMAIN)
        : undefined;
      id = again && typeof again === "object" ? String((again as { id?: string }).id || "") : "";
    } else if (created.status >= 400) {
      throw new Error(`Could not create Resend domain (${created.status})`);
    } else {
      id = String(created.json.id || "");
      printDns(created.json.records);
    }
  }
  const details = await resend(`/domains/${id}`);
  printDns(details.json.records);
  if (details.json.status !== "verified") {
    await resend(`/domains/${id}/verify`, { method: "POST", body: "{}" });
  }
  const again = await resend(`/domains/${id}`);
  return { id, status: String(again.json.status || details.json.status || "unknown") };
}

async function sendTest(to: string): Promise<void> {
  resetMailProvider(process.env);
  const verifyDemo = absoluteMailUrl("/verify?token=test-not-a-real-token");
  const resetDemo = absoluteMailUrl("/reset?token=test-not-a-real-token");
  const result = await sendMail({
    to,
    subject: "PoolIndex mail test (verify + reset templates)",
    text: `This is a production mail test from PoolIndex.\n\nVerification link format:\n${verifyDemo}\n\nPassword reset link format:\n${resetDemo}\n\nThese sample tokens are not valid accounts.`,
    url: verifyDemo,
    purpose: "verify_email",
  });
  console.log(`test_send delivered=${result.delivered} provider=${result.provider} to_host=${to.split("@")[1] || "unknown"}`);
}

const args = process.argv.slice(2);
const toFlag = args.find((arg) => arg.startsWith("--to="))?.slice(5) || process.env.POOLINDEX_MAIL_TEST_TO?.trim();
const skipSend = args.includes("--dns-only");

loadDotEnv(resolve(ROOT, ".env"));
if (!process.env.POOLINDEX_PUBLIC_URL) process.env.POOLINDEX_PUBLIC_URL = "https://poolindex.app";
if (!process.env.POOLINDEX_MAIL_PROVIDER) process.env.POOLINDEX_MAIL_PROVIDER = "resend";
if (!process.env.POOLINDEX_MAIL_FROM) process.env.POOLINDEX_MAIL_FROM = "PoolIndex <noreply@poolindex.app>";

const domain = await ensureDomain();
console.log(`resend_domain=${MAIL_DOMAIN} status=${domain.status}`);
if (skipSend) process.exit(0);
if (!toFlag) {
  console.log("Pass --to=you@example.com to send a real test message.");
  process.exit(domain.status === "verified" ? 0 : 2);
}
await sendTest(toFlag);
