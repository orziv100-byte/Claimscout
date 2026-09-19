import { AuthError } from "./auth.ts";
import { ACCOUNT_STATUSES, USER_ROLES, type AccountStatus, type UserRole } from "./beta-types.ts";
import type { PlanId } from "./plan.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rejectUnknownKeys(body: Record<string, unknown>, allowed: readonly string[], context: string) {
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) {
    throw new AuthError(400, "INVALID_FIELD", `Unknown ${context} field: ${extra[0]}.`);
  }
}

export function parseAdminUserPatch(body: Record<string, unknown>): {
  id: string;
  status?: AccountStatus;
  plan?: PlanId;
  role?: UserRole;
} {
  rejectUnknownKeys(body, ["id", "status", "plan", "role"], "user");
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) throw new AuthError(400, "INVALID_USER", "User id is required.");

  const patch: { id: string; status?: AccountStatus; plan?: PlanId; role?: UserRole } = { id };
  if ("status" in body) {
    if (typeof body.status !== "string" || !(ACCOUNT_STATUSES as readonly string[]).includes(body.status)) {
      throw new AuthError(400, "INVALID_STATUS", "Unknown account status.");
    }
    patch.status = body.status as AccountStatus;
  }
  if ("plan" in body) {
    if (body.plan !== "free" && body.plan !== "paid") {
      throw new AuthError(400, "INVALID_PLAN", "Unknown plan.");
    }
    patch.plan = body.plan;
  }
  if ("role" in body) {
    if (typeof body.role !== "string" || !(USER_ROLES as readonly string[]).includes(body.role)) {
      throw new AuthError(400, "INVALID_ROLE", "Unknown role.");
    }
    patch.role = body.role as UserRole;
  }
  return patch;
}

export function parseAdminOpsPatch(body: Record<string, unknown>): {
  scansEnabled?: boolean;
  maintenanceMode?: boolean;
  betaStage?: 1 | 2 | 3;
  reason?: string;
} {
  rejectUnknownKeys(body, ["scansEnabled", "maintenanceMode", "betaStage", "reason"], "ops");
  const patch: {
    scansEnabled?: boolean;
    maintenanceMode?: boolean;
    betaStage?: 1 | 2 | 3;
    reason?: string;
  } = {};
  if ("scansEnabled" in body) {
    if (typeof body.scansEnabled !== "boolean") {
      throw new AuthError(400, "INVALID_OPS", "scansEnabled must be a boolean.");
    }
    patch.scansEnabled = body.scansEnabled;
  }
  if ("maintenanceMode" in body) {
    if (typeof body.maintenanceMode !== "boolean") {
      throw new AuthError(400, "INVALID_OPS", "maintenanceMode must be a boolean.");
    }
    patch.maintenanceMode = body.maintenanceMode;
  }
  if ("betaStage" in body) {
    if (body.betaStage !== 1 && body.betaStage !== 2 && body.betaStage !== 3) {
      throw new AuthError(400, "INVALID_OPS", "Unknown beta stage.");
    }
    patch.betaStage = body.betaStage;
  }
  if ("reason" in body) {
    if (typeof body.reason !== "string") {
      throw new AuthError(400, "INVALID_OPS", "reason must be a string.");
    }
    patch.reason = body.reason;
  }
  return patch;
}

export function parseAdminInviteInput(body: Record<string, unknown>): {
  email?: string;
  stage?: 1 | 2 | 3;
  maxUses?: number;
  note?: string;
} {
  rejectUnknownKeys(body, ["email", "stage", "maxUses", "note"], "invite");
  const input: { email?: string; stage?: 1 | 2 | 3; maxUses?: number; note?: string } = {};
  if ("email" in body) {
    if (typeof body.email !== "string" || !EMAIL_RE.test(body.email.trim().toLowerCase())) {
      throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    input.email = body.email.trim().toLowerCase();
  }
  if ("stage" in body) {
    if (body.stage !== 1 && body.stage !== 2 && body.stage !== 3) {
      throw new AuthError(400, "INVALID_STAGE", "Unknown invite stage.");
    }
    input.stage = body.stage;
  }
  if ("maxUses" in body) {
    if (typeof body.maxUses !== "number" || !Number.isInteger(body.maxUses) || body.maxUses < 1) {
      throw new AuthError(400, "INVALID_MAX_USES", "maxUses must be a positive integer.");
    }
    input.maxUses = body.maxUses;
  }
  if ("note" in body) {
    if (typeof body.note !== "string") {
      throw new AuthError(400, "INVALID_NOTE", "note must be a string.");
    }
    input.note = body.note;
  }
  return input;
}

export function parseAdminFeedbackPatch(body: Record<string, unknown>): { id: string; status: string } {
  rejectUnknownKeys(body, ["id", "status"], "feedback");
  if (typeof body.id !== "string" || !body.id.trim()) {
    throw new AuthError(400, "INVALID_FEEDBACK", "Feedback id is required.");
  }
  if (typeof body.status !== "string") {
    throw new AuthError(400, "INVALID_FEEDBACK", "Unknown feedback status.");
  }
  return { id: body.id.trim(), status: body.status };
}
