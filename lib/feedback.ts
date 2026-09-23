import { APP_VERSION } from "./app-info.ts";
import { mutateBetaState, readBetaState, recordSecurity } from "./beta-store.ts";
import {
  BETA_FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackOperatorStatus,
  type FeedbackRecord,
  type FeedbackStatus,
  type FeedbackType,
} from "./beta-types.ts";
import { AuthError } from "./auth.ts";
import { newId } from "./password.ts";
import { assertNoSecretMaterial } from "./secrets-guard.ts";

export type FeedbackInput = {
  userId: string;
  type: string;
  note?: string;
  source?: string;
  claimId?: string;
  leadId?: string;
  url?: string;
  rating?: number | null;
  contactMe?: boolean;
};

function hostOf(url: string): string {
  if (!url.trim()) return "";
  try {
    return new URL(url).host.slice(0, 200);
  } catch {
    return "";
  }
}

export function isBetaFeedbackCategory(type: string): boolean {
  return (BETA_FEEDBACK_CATEGORIES as readonly string[]).includes(type);
}

export function coerceFeedbackStatus(status: string): string {
  if (status === "reviewing") return "investigating";
  return status;
}

export function normalizeFeedbackStatus(status: string): FeedbackOperatorStatus {
  if (status === "reviewed" || status === "investigating" || status === "reviewing") return "reviewed";
  if (status === "resolved" || status === "fixed" || status === "closed") return "resolved";
  return "new";
}

function statusMatches(rowStatus: string, filter?: string): boolean {
  if (!filter) return true;
  if (rowStatus === filter) return true;
  if (filter === "reviewed" || filter === "reviewing") return rowStatus === "reviewed" || rowStatus === "investigating";
  if (filter === "resolved") return rowStatus === "resolved" || rowStatus === "fixed" || rowStatus === "closed";
  return false;
}

function parseRating(value: unknown, required: boolean): number | null {
  if (value == null || value === "") {
    if (required) throw new AuthError(400, "INVALID_RATING", "Choose a rating from 1 to 5.");
    return null;
  }
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AuthError(400, "INVALID_RATING", "Choose a rating from 1 to 5.");
  }
  return rating;
}

export function submitFeedback(input: FeedbackInput): FeedbackRecord {
  if (!(FEEDBACK_TYPES as readonly string[]).includes(input.type)) {
    throw new AuthError(400, "INVALID_FEEDBACK", "Choose a valid feedback type.");
  }
  const beta = isBetaFeedbackCategory(input.type);
  const note = (input.note ?? "").trim().slice(0, 1000);
  if (beta && note.length < 3) {
    throw new AuthError(400, "INVALID_FEEDBACK", "Write a short note. Do not include seeds or keys.");
  }
  if (note) assertNoSecretMaterial(note, "feedback");
  const rating = parseRating(input.rating, beta);
  return mutateBetaState((state) => {
    const row: FeedbackRecord = {
      id: newId(),
      userId: input.userId,
      type: input.type as FeedbackType,
      note,
      source: (input.source ?? "").trim().slice(0, 80),
      claimId: (input.claimId ?? "").trim().slice(0, 80),
      leadId: (input.leadId ?? "").trim().slice(0, 80),
      urlHost: hostOf(input.url ?? ""),
      appVersion: APP_VERSION,
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rating,
      contactMe: Boolean(input.contactMe),
    };
    state.feedback.push(row);
    recordSecurity({ type: "feedback_submitted", userId: input.userId, detail: row.type });
    return row;
  });
}

export function listFeedback(
  filter: {
    userId?: string;
    type?: string;
    source?: string;
    status?: string;
    version?: string;
    after?: string;
    before?: string;
    rating?: number;
  } = {},
): FeedbackRecord[] {
  return readBetaState().feedback.filter((row) => {
    if (filter.userId && row.userId !== filter.userId) return false;
    if (filter.type && row.type !== filter.type) return false;
    if (filter.source && row.source !== filter.source) return false;
    if (!statusMatches(row.status, filter.status)) return false;
    if (filter.version && row.appVersion !== filter.version) return false;
    if (filter.after && row.createdAt < filter.after) return false;
    if (filter.before && row.createdAt > filter.before) return false;
    if (typeof filter.rating === "number" && row.rating !== filter.rating) return false;
    return true;
  });
}

export function updateFeedbackStatus(id: string, status: string, actorId: string, operatorNote?: string): FeedbackRecord {
  const nextStatus = coerceFeedbackStatus(status);
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(nextStatus)) {
    throw new AuthError(400, "INVALID_STATUS", "Unknown feedback status.");
  }
  return mutateBetaState((state) => {
    const row = state.feedback.find((item) => item.id === id);
    if (!row) throw new AuthError(404, "FEEDBACK_NOT_FOUND", "Feedback not found.");
    row.status = nextStatus as FeedbackStatus;
    row.updatedAt = new Date().toISOString();
    if (typeof operatorNote === "string") {
      const note = operatorNote.trim().slice(0, 1000);
      if (note) assertNoSecretMaterial(note, "operator note");
      row.operatorNote = note;
    }
    recordSecurity({ type: "feedback_status", userId: actorId, detail: `${id}:${nextStatus}` });
    return { ...row };
  });
}

export function publicFeedback(row: FeedbackRecord) {
  return {
    id: row.id,
    type: row.type,
    note: row.note,
    source: row.source,
    claimId: row.claimId,
    leadId: row.leadId ?? "",
    urlHost: row.urlHost,
    appVersion: row.appVersion,
    status: row.status,
    operatorStatus: normalizeFeedbackStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rating: row.rating,
    contactMe: Boolean(row.contactMe),
  };
}
