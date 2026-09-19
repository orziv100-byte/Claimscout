import type { PlanId } from "./plan.ts";

export const ACCOUNT_STATUSES = ["pending_verification", "active", "disabled", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const FEEDBACK_TYPES = [
  "useful",
  "already_knew",
  "not_relevant",
  "expired",
  "broken_link",
  "suspicious",
  "potential_scam",
  "claimed_successfully",
  "report_problem",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ["new", "investigating", "fixed", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type ScanCounts = {
  started: number;
  completed: number;
  failed: number;
};

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: AccountStatus;
  role: UserRole;
  plan: PlanId;
  wallets: string[];
  inviteCode: string;
  emailVerifiedAt: string | null;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastScanAt: string | null;
  firstScanAt: string | null;
  scanCounts: ScanCounts;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type InviteRecord = {
  id: string;
  code: string;
  email: string | null;
  stage: 1 | 2 | 3;
  maxUses: number;
  usedBy: string[];
  disabled: boolean;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type TokenRecord = {
  id: string;
  type: "verify_email" | "reset_password";
  userId: string;
  hash: string;
  expiresAt: string;
  usedAt: string | null;
};

export type OpsState = {
  scansEnabled: boolean;
  maintenanceMode: boolean;
  betaStage: 1 | 2 | 3;
  reason: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type FeedbackRecord = {
  id: string;
  userId: string;
  type: FeedbackType;
  note: string;
  source: string;
  claimId: string;
  leadId: string;
  urlHost: string;
  appVersion: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
};

export type TelemetryEvent = {
  at: string;
  type: string;
  userId?: string;
  source?: string;
  durationMs?: number;
  code?: string;
  version: string;
  detail?: string;
};

export type SecurityEvent = {
  at: string;
  type: string;
  userId?: string;
  email?: string;
  ip?: string;
  detail?: string;
};

export type ScanRecord = {
  at: string;
  userId: string;
  query: string;
  sources: string[];
  status: "started" | "completed" | "failed";
  durationMs?: number;
  itemCount?: number;
  blocked?: number;
  error?: string;
  version: string;
};

export type MailMessage = {
  at: string;
  to: string;
  subject: string;
  text: string;
  url?: string;
};

export type BetaState = {
  users: UserRecord[];
  invites: InviteRecord[];
  sessions: SessionRecord[];
  tokens: TokenRecord[];
  ops: OpsState;
  feedback: FeedbackRecord[];
};
