const PRODUCTION_REQUIRED = [
  "POOLINDEX_SESSION_SECRET",
  "POOLINDEX_PLAN_SECRET",
  "POOLINDEX_ADMIN_EMAILS",
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
  if (production && env.POOLINDEX_PLAN_SECRET === "dev-only-poolindex-plan-secret") {
    missing.push("POOLINDEX_PLAN_SECRET");
  }
  if (production && env.POOLINDEX_SESSION_SECRET === "dev-only-poolindex-session-secret") {
    missing.push("POOLINDEX_SESSION_SECRET");
  }
  return { ok: missing.length === 0, production, missing, usingDevDefaults };
}

export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.POOLINDEX_ADMIN_EMAILS || "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
