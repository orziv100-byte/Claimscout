import { AuthError } from "./auth.ts";
import { mutateBetaState, recordSecurity } from "./beta-store.ts";
import type { DeletionRequest, PrivacyRequest, PrivacyRequestType } from "./beta-types.ts";
import { PRIVACY_REQUEST_TYPES } from "./beta-types.ts";
import { PRIVACY_VERSION, TERMS_VERSION } from "./legal.ts";
import { hashPassword, newId, verifyPassword } from "./password.ts";
import { SecretMaterialError, assertNoSecretMaterial } from "./secrets-guard.ts";

function nowIso() {
  return new Date().toISOString();
}

export async function requestAccountDeletion(input: {
  userId: string;
  password: string;
  confirm: string;
}): Promise<DeletionRequest> {
  if (input.confirm !== "DELETE") {
    throw new AuthError(400, "CONFIRM_REQUIRED", "Type DELETE to confirm account closure.");
  }
  if (input.password.length < 10) {
    throw new AuthError(400, "INVALID_PASSWORD", "Re-enter your password to confirm.");
  }
  try {
    assertNoSecretMaterial(input.password, "password");
  } catch (err) {
    if (err instanceof SecretMaterialError) throw new AuthError(400, err.code, err.message);
    throw err;
  }

  const snapshot = mutateBetaState((state) => state.users.find((row) => row.id === input.userId) ?? null);
  if (!snapshot) throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
  const passwordOk = await verifyPassword(input.password, snapshot.passwordHash);
  if (!passwordOk) throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid password.");
  if (snapshot.deletionStatus === "completed") {
    throw new AuthError(409, "ALREADY_DELETED", "This account is already closed.");
  }

  return mutateBetaState((state) => {
    const live = state.users.find((row) => row.id === input.userId);
    if (!live) throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
    live.deletionRequestedAt = nowIso();
    live.deletionStatus = "requested";
    const existing = state.deletionRequests.find((row) => row.userId === live.id && row.status === "requested");
    if (existing) return existing;
    const request: DeletionRequest = {
      id: newId(),
      userId: live.id,
      requestedAt: live.deletionRequestedAt,
      status: "requested",
      processedAt: null,
      processedBy: null,
      note: "",
    };
    state.deletionRequests.push(request);
    recordSecurity({ type: "deletion_requested", userId: live.id, email: live.email });
    return request;
  });
}

export function listDeletionRequests(): DeletionRequest[] {
  return mutateBetaState((state) => [...state.deletionRequests]);
}

export async function processDeletionRequest(input: {
  requestId: string;
  actorId: string;
  decision: "complete" | "reject";
  note?: string;
}): Promise<DeletionRequest> {
  const burned = await hashPassword(`deleted-${newId(16)}`);
  return mutateBetaState((state) => {
    const request = state.deletionRequests.find((row) => row.id === input.requestId);
    if (!request) throw new AuthError(404, "REQUEST_NOT_FOUND", "Deletion request not found.");
    const user = state.users.find((row) => row.id === request.userId);
    if (!user) throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
    if (input.decision === "reject") {
      request.status = "rejected";
      request.processedAt = nowIso();
      request.processedBy = input.actorId;
      request.note = (input.note ?? "").slice(0, 300);
      if (user.deletionStatus !== "completed") user.deletionStatus = "none";
      recordSecurity({ type: "deletion_rejected", userId: input.actorId, detail: request.userId });
      return request;
    }
    user.status = "disabled";
    user.displayName = "Deleted account";
    user.email = `deleted-${user.id.slice(0, 8)}@closed.invalid`;
    user.wallets = [];
    user.passwordHash = burned;
    user.deletionStatus = "completed";
    user.deletionRequestedAt = user.deletionRequestedAt ?? nowIso();
    for (const session of state.sessions) {
      if (session.userId === user.id && !session.revokedAt) session.revokedAt = nowIso();
    }
    request.status = "completed";
    request.processedAt = nowIso();
    request.processedBy = input.actorId;
    request.note = (input.note ?? "Account disabled and identifiers removed. Security logs retained.").slice(0, 300);
    recordSecurity({ type: "deletion_completed", userId: input.actorId, detail: request.userId });
    return request;
  });
}

export function createPrivacyRequest(input: {
  userId: string;
  type: string;
  message: string;
}): PrivacyRequest {
  if (!(PRIVACY_REQUEST_TYPES as readonly string[]).includes(input.type)) {
    throw new AuthError(400, "INVALID_TYPE", "Unknown privacy request type.");
  }
  const message = input.message.trim().slice(0, 1000);
  try {
    assertNoSecretMaterial(message || "ok", "privacy request");
  } catch (err) {
    if (err instanceof SecretMaterialError) throw new AuthError(400, err.code, err.message);
    throw err;
  }
  return mutateBetaState((state) => {
    if (!state.users.some((row) => row.id === input.userId)) {
      throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
    }
    const row: PrivacyRequest = {
      id: newId(),
      userId: input.userId,
      type: input.type as PrivacyRequestType,
      message,
      createdAt: nowIso(),
      status: "open",
    };
    state.privacyRequests.push(row);
    recordSecurity({ type: "privacy_request", userId: input.userId, detail: input.type });
    return row;
  });
}

export function listPrivacyRequests(): PrivacyRequest[] {
  return mutateBetaState((state) => [...state.privacyRequests]);
}

export function acceptCurrentLegal(userId: string): { termsVersion: string; privacyVersion: string; acceptedAt: string } {
  return mutateBetaState((state) => {
    const user = state.users.find((row) => row.id === userId);
    if (!user) throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
    user.termsVersion = TERMS_VERSION;
    user.privacyVersion = PRIVACY_VERSION;
    user.acceptedAt = nowIso();
    recordSecurity({ type: "legal_reaccepted", userId });
    return { termsVersion: user.termsVersion, privacyVersion: user.privacyVersion, acceptedAt: user.acceptedAt };
  });
}
