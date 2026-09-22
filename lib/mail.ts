import { recordMail } from "./beta-store.ts";
import type { MailMessage } from "./beta-types.ts";

export type MailPurpose =
  | "verify_email"
  | "reset_password"
  | "new_lead"
  | "new_strong_evidence"
  | "eligibility_available"
  | "claim_status_changed"
  | "claim_window_opened"
  | "claim_window_closing"
  | "security_warning"
  | "deep_hunt_completed"
  | "wallet_scan_changed";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  url?: string;
  purpose: MailPurpose;
};

export type MailSendResult = {
  delivered: boolean;
  provider: string;
};

export interface MailProvider {
  readonly name: string;
  send(message: MailPayload): Promise<MailSendResult>;
}

export const MAIL_DOMAIN = "poolindex.app";
export const DEFAULT_MAIL_FROM = `PoolIndex <noreply@${MAIL_DOMAIN}>`;
export const DEFAULT_PUBLIC_ORIGIN = `https://${MAIL_DOMAIN}`;
const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export class OutboxMailProvider implements MailProvider {
  readonly name = "outbox";
  async send(message: MailPayload): Promise<MailSendResult> {
    recordOutbox(message);
    return { delivered: false, provider: this.name };
  }
}

export class ResendMailProvider implements MailProvider {
  readonly name = "resend";
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async send(message: MailPayload): Promise<MailSendResult> {
    const apiKey = this.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("RESEND_API_KEY missing");
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendSendBody(message, this.env)),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed (${response.status})`);
    }
    return { delivered: true, provider: this.name };
  }
}

let currentProvider: MailProvider = new OutboxMailProvider();

export function getMailProvider(): MailProvider {
  return currentProvider;
}

export function setMailProvider(provider: MailProvider): void {
  currentProvider = provider;
}

export function resetMailProvider(env: NodeJS.ProcessEnv = process.env): void {
  currentProvider = mailProviderFromEnv(env);
}

export function mailProviderFromEnv(env: NodeJS.ProcessEnv = process.env): MailProvider {
  const name = env.POOLINDEX_MAIL_PROVIDER?.trim().toLowerCase();
  if (name === "resend" && env.RESEND_API_KEY?.trim()) {
    return new ResendMailProvider(env);
  }
  return new OutboxMailProvider();
}

export function mailFromAddress(env: NodeJS.ProcessEnv = process.env): string {
  const from = env.POOLINDEX_MAIL_FROM?.trim();
  return from || DEFAULT_MAIL_FROM;
}

export function mailReplyTo(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const reply = env.POOLINDEX_MAIL_REPLY_TO?.trim() || env.POOLINDEX_CONTACT_SUPPORT?.trim();
  if (!reply || reply.includes("POOLINDEX_DOMAIN")) return undefined;
  return reply;
}

export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.POOLINDEX_PUBLIC_URL?.trim() || (env.NODE_ENV === "production" ? DEFAULT_PUBLIC_ORIGIN : "");
  return raw.replace(/\/$/, "");
}

export function absoluteMailUrl(path: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = publicOrigin(env);
  if (!origin) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendMail(message: MailPayload): Promise<MailSendResult> {
  const provider = getMailProvider();
  try {
    const result = await provider.send(message);
    if (provider.name !== "outbox") recordOutbox(message);
    return result;
  } catch {
    recordOutbox(message);
    return { delivered: false, provider: "outbox" };
  }
}

export function resendSendBody(message: MailPayload, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: mailFromAddress(env),
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: renderMailHtml(message),
    tags: [{ name: "purpose", value: sanitizeTag(message.purpose) }],
  };
  const replyTo = mailReplyTo(env);
  if (replyTo) body.reply_to = replyTo;
  return body;
}

function sanitizeTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 256) || "mail";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function renderMailHtml(message: MailPayload): string {
  const textHtml = escapeHtml(message.text).replace(/\n/g, "<br />");
  const link = message.url
    ? `<p><a href="${escapeHtml(message.url)}">${escapeHtml(message.url)}</a></p>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5">
<p><strong>PoolIndex</strong></p>
<p>${textHtml}</p>
${link}
<p style="color:#666;font-size:12px">This is an operational Closed Beta message, not marketing mail.</p>
</body></html>`;
}

function recordOutbox(message: MailPayload): MailMessage {
  const row = {
    to: message.to,
    subject: message.subject,
    text: message.text,
    url: message.url,
  };
  recordMail(row);
  return { at: new Date().toISOString(), ...row };
}

resetMailProvider();
