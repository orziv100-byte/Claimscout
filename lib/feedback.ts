import { APP_VERSION } from "./app-info.ts";
import { mutateBetaState, readBetaState, recordSecurity } from "./beta-store.ts";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
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
  url?: string;
};

function hostOf(url: string): string {
  if (!url.trim()) return "";
  try {
    return new URL(url).host.slice(0, 200);
  } catch {
    return "";
  }
}

export function submitFeedback(input: FeedbackInput): FeedbackRecord {
  if (!(FEEDBACK_TYPES as readonly string[]).includes(input.type)) {
    throw new AuthError(400, "INVALID_FEEDBACK", "Choose a valid feedback type.");
  }
  const note = (input.note ?? "").trim().slice(0, 500);
  if (note) assertNoSecretMaterial(note, "feedback");
  return mutateBetaState((state) => {
    const row: FeedbackRecord = {
      id: newId(),
      userId: input.userId,
      type: input.type as FeedbackType,
      note,
      source: (input.source ?? "").trim().slice(0, 80),
      claimId: (input.claimId ?? "").trim().slice(0, 80),
      urlHost: hostOf(input.url ?? ""),
      appVersion: APP_VERSION,
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.feedback.push(row);
    recordSecurity({ type: "feedback_submitted", userId: input.userId, detail: row.type });
    return row;
  });
}

export function listFeedback(filter: {
  userId?: string;
  type?: string;
  source?: string;
  status?: string;
  version?: string;
  after?: string;
  before?: string;
} = {}): FeedbackRecord[] {
  return readBetaState().feedback.filter((row) => {
    if (filter.userId && row.userId !== filter.userId) return false;
    if (filter.type && row.type !== filter.type) return false;
    if (filter.source && row.source !== filter.source) return false;
    if (filter.status && row.status !== filter.status) return false;
    if (filter.version && row.appVersion !== filter.version) return false;
    if (filter.after && row.createdAt < filter.after) return false;
    if (filter.before && row.createdAt > filter.before) return false;
    return true;
  });
}

export function updateFeedbackStatus(id: string, status: string, actorId: string): FeedbackRecord {
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    throw new AuthError(400, "INVALID_STATUS", "Unknown feedback status.");
  }
  return mutateBetaState((state) => {
    const row = state.feedback.find((item) => item.id === id);
    if (!row) throw new AuthError(404, "FEEDBACK_NOT_FOUND", "Feedback not found.");
    row.status = status as FeedbackStatus;
    row.updatedAt = new Date().toISOString();
    recordSecurity({ type: "feedback_status", userId: actorId, detail: `${id}:${status}` });
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
    urlHost: row.urlHost,
    appVersion: row.appVersion,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
