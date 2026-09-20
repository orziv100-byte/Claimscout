export const CONTACT_ROLES = ["support", "privacy", "security", "accessibility", "legal"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

const ENV_KEYS: Record<ContactRole, string> = {
  support: "POOLINDEX_CONTACT_SUPPORT",
  privacy: "POOLINDEX_CONTACT_PRIVACY",
  security: "POOLINDEX_CONTACT_SECURITY",
  accessibility: "POOLINDEX_CONTACT_ACCESSIBILITY",
  legal: "POOLINDEX_CONTACT_LEGAL",
};

/** Placeholders. Replace with real addresses before Closed Beta launch. */
export const CONTACT_PLACEHOLDERS: Record<ContactRole, string> = {
  support: "support@POOLINDEX_DOMAIN",
  privacy: "privacy@POOLINDEX_DOMAIN",
  security: "security@POOLINDEX_DOMAIN",
  accessibility: "accessibility@POOLINDEX_DOMAIN",
  legal: "legal@POOLINDEX_DOMAIN",
};

export type ContactEntry = {
  role: ContactRole;
  envKey: string;
  address: string;
  configured: boolean;
};

export function contactEntry(role: ContactRole, env: NodeJS.ProcessEnv = process.env): ContactEntry {
  const envKey = ENV_KEYS[role];
  const raw = env[envKey]?.trim() ?? "";
  const configured = Boolean(raw) && !raw.includes("POOLINDEX_DOMAIN");
  return {
    role,
    envKey,
    address: configured ? raw : CONTACT_PLACEHOLDERS[role],
    configured,
  };
}

export function allContacts(env: NodeJS.ProcessEnv = process.env): ContactEntry[] {
  return CONTACT_ROLES.map((role) => contactEntry(role, env));
}

export function unconfiguredContacts(env: NodeJS.ProcessEnv = process.env): ContactEntry[] {
  return allContacts(env).filter((row) => !row.configured);
}

export function contactLine(role: ContactRole, env: NodeJS.ProcessEnv = process.env): string {
  const entry = contactEntry(role, env);
  if (entry.configured) return entry.address;
  return `${entry.address} (configuration required before Closed Beta launch)`;
}
