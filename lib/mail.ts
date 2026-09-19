import { recordMail } from "./beta-store.ts";
import type { MailMessage } from "./beta-types.ts";

export type MailPurpose = "verify_email" | "reset_password";

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

export class OutboxMailProvider implements MailProvider {
  readonly name = "outbox";
  async send(message: MailPayload): Promise<MailSendResult> {
    recordOutbox(message);
    return { delivered: false, provider: this.name };
  }
}

let currentProvider: MailProvider = new OutboxMailProvider();

export function getMailProvider(): MailProvider {
  return currentProvider;
}

export function setMailProvider(provider: MailProvider): void {
  currentProvider = provider;
}

export function resetMailProvider(): void {
  currentProvider = mailProviderFromEnv();
}

export function mailProviderFromEnv(env: NodeJS.ProcessEnv = process.env): MailProvider {
  const name = env.POOLINDEX_MAIL_PROVIDER?.trim().toLowerCase();
  if (!name || name === "outbox") return new OutboxMailProvider();
  return new OutboxMailProvider();
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
