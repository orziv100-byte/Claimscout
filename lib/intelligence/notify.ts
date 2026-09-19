import { getUserById } from "../auth.ts";
import { sendMail, type MailPurpose } from "../mail.ts";
import type { HuntRecord, LeadRecord } from "./types.ts";

const HUNT_MAIL: Record<string, { purpose: MailPurpose; subject: string }> = {
  NEW_LEAD: { purpose: "new_lead", subject: "Poolindex: new research lead" },
  NEW_STRONG_EVIDENCE: { purpose: "new_strong_evidence", subject: "Poolindex: stronger evidence found" },
  ELIGIBILITY_AVAILABLE: { purpose: "eligibility_available", subject: "Poolindex: eligibility evidence available" },
  CLAIM_STATUS_CHANGED: { purpose: "claim_status_changed", subject: "Poolindex: claim status changed" },
  CLAIM_WINDOW_OPENED: { purpose: "claim_window_opened", subject: "Poolindex: claim window opened" },
  CLAIM_WINDOW_CLOSING: { purpose: "claim_window_closing", subject: "Poolindex: claim window closing" },
  SECURITY_WARNING: { purpose: "security_warning", subject: "Poolindex: security warning" },
  DEEP_HUNT_COMPLETED: { purpose: "deep_hunt_completed", subject: "Poolindex: Deep Hunt completed" },
};

export type NotifyFn = typeof sendMail;

export async function notifyHuntEvent(
  hunt: HuntRecord,
  event: keyof typeof HUNT_MAIL,
  text: string,
  deps: { sendMail?: NotifyFn } = {},
): Promise<void> {
  if (hunt.notifications.includes(event)) {
    if (event === "DEEP_HUNT_COMPLETED" || event === "NEW_LEAD" || event === "NEW_STRONG_EVIDENCE") {
      /* allow repeats for per-lead events except completed */
      if (event === "DEEP_HUNT_COMPLETED") return;
    }
  }
  const spec = HUNT_MAIL[event];
  const user = getUserById(hunt.userId);
  if (!user?.email) return;
  const mail = deps.sendMail ?? sendMail;
  await mail({
    to: user.email,
    subject: spec.subject,
    text,
    purpose: spec.purpose,
  });
  if (!hunt.notifications.includes(event)) hunt.notifications.push(event);
}

export async function notifyNewLead(hunt: HuntRecord, lead: LeadRecord, deps: { sendMail?: NotifyFn } = {}): Promise<void> {
  await notifyHuntEvent(
    hunt,
    lead.historicalEvidence === "strong" || lead.onchainEvidence === "confirmed" ? "NEW_STRONG_EVIDENCE" : "NEW_LEAD",
    `A lead was recorded for ${lead.projectName}. Status: ${lead.status}. Eligibility is not assumed.`,
    deps,
  );
}

export async function notifyHuntCompleted(hunt: HuntRecord, deps: { sendMail?: NotifyFn } = {}): Promise<void> {
  await notifyHuntEvent(
    hunt,
    "DEEP_HUNT_COMPLETED",
    `Deep Hunt ${hunt.id} finished with ${hunt.leads.length} leads. Sources checked: ${hunt.progress.sourcesChecked}.`,
    deps,
  );
}
