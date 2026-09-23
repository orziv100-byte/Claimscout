import type { PlanId } from "./plan.ts";

export const ACCOUNT_STATUSES = ["pending_verification", "active", "disabled", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RESULT_FEEDBACK_TYPES = [
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
export const BETA_FEEDBACK_CATEGORIES = ["bug", "idea", "scan_result", "payment", "other"] as const;
export const FEEDBACK_TYPES = [...RESULT_FEEDBACK_TYPES, ...BETA_FEEDBACK_CATEGORIES] as const;
export type ResultFeedbackType = (typeof RESULT_FEEDBACK_TYPES)[number];
export type BetaFeedbackCategory = (typeof BETA_FEEDBACK_CATEGORIES)[number];
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ["new", "investigating", "reviewed", "fixed", "resolved", "closed"] as const;
export const FEEDBACK_OPERATOR_STATUSES = ["new", "reviewed", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackOperatorStatus = (typeof FEEDBACK_OPERATOR_STATUSES)[number];

export type ScanCounts = {
  started: number;
  completed: number;
  failed: number;
};

export const BILLING_STATUSES = [
  "pending",
  "active",
  "cancelled",
  "suspended",
  "expired",
  "payment_failed",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export type BillingInterval = "month" | "year";

export type SubscriptionRecord = {
  id: string;
  userId: string;
  paypalSubscriptionId: string;
  paypalPlanId: string;
  plan: "paid";
  interval: BillingInterval;
  status: BillingStatus;
  createdAt: string;
  updatedAt: string;
  nextBillingAt: string | null;
  approvalUrl: string | null;
  lastPaypalEventId: string | null;
};

export type PaypalWebhookReceipt = {
  id: string;
  eventType: string;
  at: string;
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
  /** Free daily full-scan is off unless this is true. Paid accounts are always eligible. */
  monitorEnabled?: boolean;
  totpSecret?: string;
  totpEnabled?: boolean;
  totpRecoveryHashes?: string[];
  totpLastStep?: number;
  /** Google subject (sub). Omitted from public user JSON. */
  googleSub?: string;
  deletionRequestedAt: string | null;
  deletionStatus: DeletionStatus;
};

export type PublicUser = Omit<UserRecord, "passwordHash" | "totpSecret" | "totpRecoveryHashes" | "totpLastStep" | "googleSub"> & {
  googleLinked: boolean;
};

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
  type: "verify_email" | "reset_password" | "google_desktop";
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
  rating: number | null;
  contactMe: boolean;
  operatorNote?: string;
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
  kind?: "search" | "wallet";
  potentialFindings?: number;
  verifiedFindings?: number;
  alerted?: boolean;
};

export function isWalletScanRecord(row: ScanRecord): boolean {
  return row.kind === "wallet" || row.query === "wallet-engine";
}

export type MailMessage = {
  at: string;
  to: string;
  subject: string;
  text: string;
  url?: string;
};

export const DELETION_STATUSES = ["none", "requested", "completed"] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export const DELETION_REQUEST_STATUSES = ["requested", "processing", "completed", "rejected"] as const;
export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUSES)[number];

export type DeletionRequest = {
  id: string;
  userId: string;
  requestedAt: string;
  status: DeletionRequestStatus;
  processedAt: string | null;
  processedBy: string | null;
  note: string;
};

export const PRIVACY_REQUEST_TYPES = ["access", "correction", "deletion", "question"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export type PrivacyRequest = {
  id: string;
  userId: string;
  type: PrivacyRequestType;
  message: string;
  createdAt: string;
  status: "open" | "closed";
};

export type BetaState = {
  users: UserRecord[];
  invites: InviteRecord[];
  sessions: SessionRecord[];
  tokens: TokenRecord[];
  ops: OpsState;
  feedback: FeedbackRecord[];
  deletionRequests: DeletionRequest[];
  privacyRequests: PrivacyRequest[];
  subscriptions: SubscriptionRecord[];
  paypalWebhookReceipts: PaypalWebhookReceipt[];
};
