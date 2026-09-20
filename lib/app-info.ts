export const APP_NAME = "Poolindex";
export const APP_VERSION = "0.1.0";

/** Natural-person rights holder for original Poolindex work. */
export const COPYRIGHT_OWNER_NAME = "Lior Elbaz";
export const COPYRIGHT_OWNER_COUNTRY = "Israel";
export const COPYRIGHT_YEAR = 2026;

export const COPYRIGHT = `© ${COPYRIGHT_YEAR} ${COPYRIGHT_OWNER_NAME}, ${COPYRIGHT_OWNER_COUNTRY}. All rights reserved.`;

export const COPYRIGHT_RIGHTS_HOLDER = `${COPYRIGHT_OWNER_NAME}, ${COPYRIGHT_OWNER_COUNTRY}`;

export const COPYRIGHT_RESTRICTION =
  "Copying, sale, distribution, sublicensing, or commercial use of Poolindex — including the product, source code, operations, user interface, visual design, documentation, and related materials — is prohibited without prior written permission from Lior Elbaz.";

export const COPYRIGHT_NOTICE = `${COPYRIGHT} ${APP_NAME} original product, source code, operations, user interface, visual design, documentation, and related materials are the exclusive property of ${COPYRIGHT_RIGHTS_HOLDER}. ${COPYRIGHT_RESTRICTION} Third-party packages remain under their own licenses. This notice covers original expression and materials, not abstract ideas.`;

export const BETA_STAGES = {
  1: { name: "Stage 1", cap: 10, summary: "First 10 invited testers." },
  2: { name: "Stage 2", cap: 20, summary: "Expand after Stage 1 issues are reviewed." },
  3: { name: "Stage 3", cap: 50, summary: "Expand after stability is confirmed." },
} as const;

export type BetaStage = keyof typeof BETA_STAGES;

export function stageCap(stage: BetaStage): number {
  const override = Number(process.env.POOLINDEX_BETA_STAGE_CAP);
  if (Number.isFinite(override) && override > 0) return override;
  return BETA_STAGES[stage].cap;
}
