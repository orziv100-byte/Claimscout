export const DEV_PLAN_SECRET = "dev-only-poolindex-plan-secret";
export const DEV_SESSION_SECRET = "dev-only-poolindex-session-secret";
export const DEV_PAID_LICENSE = "poolindex-pro-demo";

const PRODUCTION_REQUIRED = [
  "POOLINDEX_SESSION_SECRET",
  "POOLINDEX_PLAN_SECRET",
  "POOLINDEX_ADMIN_EMAILS",
] as const;

export type SecretName = (typeof PRODUCTION_REQUIRED)[number];

export type EnvReport = {
  ok: boolean;
  production: boolean;
  publicRuntime: boolean;
  missing: string[];
  usingDevDefaults: string[];
};

export class ProductionEnvError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super("PoolIndex refused to start: production secrets missing or well-known.");
    this.name = "ProductionEnvError";
    this.missing = missing;
  }
}

/** Local `next dev` / unit tests only. Preview, staging, and unset NODE_ENV are treated as public. */
export function isLocalDevRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}

export function isPublicRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.POOLINDEX_PUBLIC_DEPLOY === "1") return true;
  if (env.NODE_ENV === "production") return true;
  return !isLocalDevRuntime(env);
}

function paidKeyList(env: NodeJS.ProcessEnv): string[] {
  return (env.POOLINDEX_PAID_KEYS || "")
    .split(/[,\s]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

export function inspectEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const production = env.NODE_ENV === "production";
  const publicRuntime = isPublicRuntime(env);
  const missing: string[] = [];
  const usingDevDefaults: string[] = [];
  for (const key of PRODUCTION_REQUIRED) {
    if (!env[key]?.trim()) {
      if (publicRuntime) missing.push(key);
      else usingDevDefaults.push(key);
    }
  }
  if (publicRuntime && (env.POOLINDEX_PLAN_SECRET === DEV_PLAN_SECRET || !env.POOLINDEX_PLAN_SECRET?.trim())) {
    if (!missing.includes("POOLINDEX_PLAN_SECRET")) missing.push("POOLINDEX_PLAN_SECRET");
  }
  if (publicRuntime && (env.POOLINDEX_SESSION_SECRET === DEV_SESSION_SECRET || !env.POOLINDEX_SESSION_SECRET?.trim())) {
    if (!missing.includes("POOLINDEX_SESSION_SECRET")) missing.push("POOLINDEX_SESSION_SECRET");
  }
  if (publicRuntime && paidKeyList(env).includes(DEV_PAID_LICENSE)) {
    if (!missing.includes("POOLINDEX_PAID_KEYS")) missing.push("POOLINDEX_PAID_KEYS");
  }
  return { ok: missing.length === 0, production, publicRuntime, missing, usingDevDefaults };
}

/** Throws in public runtime if secrets are missing or GitHub-known. Never logs secret values. */
export function assertSafeToStart(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const report = inspectEnv(env);
  if (isPublicRuntime(env) && !report.ok) {
    throw new ProductionEnvError(report.missing);
  }
  return report;
}

export function requireSecret(name: SecretName, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim() ?? "";
  if (!isPublicRuntime(env)) {
    if (name === "POOLINDEX_PLAN_SECRET") return value || DEV_PLAN_SECRET;
    if (name === "POOLINDEX_SESSION_SECRET") return value || DEV_SESSION_SECRET;
    return value;
  }
  if (!value) throw new ProductionEnvError([name]);
  if (name === "POOLINDEX_PLAN_SECRET" && value === DEV_PLAN_SECRET) throw new ProductionEnvError([name]);
  if (name === "POOLINDEX_SESSION_SECRET" && value === DEV_SESSION_SECRET) throw new ProductionEnvError([name]);
  return value;
}

export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.POOLINDEX_ADMIN_EMAILS || "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
