const PRODUCTION_REQUIRED = [
  "CLAIM_SCOUT_SESSION_SECRET",
  "CLAIM_SCOUT_PLAN_SECRET",
  "CLAIM_SCOUT_ADMIN_EMAILS",
] as const;

export type EnvReport = {
  ok: boolean;
  production: boolean;
  missing: string[];
  usingDevDefaults: string[];
};

export function inspectEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const production = env.NODE_ENV === "production";
  const missing: string[] = [];
  const usingDevDefaults: string[] = [];
  for (const key of PRODUCTION_REQUIRED) {
    if (!env[key]?.trim()) {
      if (production) missing.push(key);
      else usingDevDefaults.push(key);
    }
  }
  if (production && env.CLAIM_SCOUT_PLAN_SECRET === "dev-only-claimscout-plan-secret") {
    missing.push("CLAIM_SCOUT_PLAN_SECRET");
  }
  if (production && env.CLAIM_SCOUT_SESSION_SECRET === "dev-only-claimscout-session-secret") {
    missing.push("CLAIM_SCOUT_SESSION_SECRET");
  }
  return { ok: missing.length === 0, production, missing, usingDevDefaults };
}

export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.CLAIM_SCOUT_ADMIN_EMAILS || "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
