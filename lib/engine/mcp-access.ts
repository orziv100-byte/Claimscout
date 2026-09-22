import type { Address } from "viem";
import { parsePublicAddress } from "../address.ts";
import type { UserRecord } from "../beta-types.ts";
import { APP_VERSION } from "../app-info.ts";
import { looksLikeSecretMaterial, SecretMaterialError } from "../secrets-guard.ts";
import { maxWalletsFor, walletLimitMessage } from "../plan.ts";

export class McpToolError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "McpToolError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  toBody(): Record<string, unknown> {
    return { error: this.message, code: this.code, version: APP_VERSION, ...this.extra };
  }
}

export function rejectSecretInput(value: string, field: string): void {
  if (looksLikeSecretMaterial(value)) {
    throw new McpToolError(
      400,
      "SECRET_MATERIAL_REJECTED",
      `PoolIndex does not accept seed phrases, private keys, or recovery secrets in ${field}.`,
    );
  }
}

export function requireBoundWallet(user: UserRecord, raw: unknown): Address {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new McpToolError(400, "INVALID_ADDRESS", "Provide a public 0x Ethereum address already bound to this account.");
  }
  rejectSecretInput(raw, "address");
  const parsed = parsePublicAddress(raw);
  if (!parsed.ok) {
    throw new McpToolError(400, "INVALID_ADDRESS", parsed.error);
  }
  const bound = user.wallets.some((wallet) => wallet.toLowerCase() === parsed.address.toLowerCase());
  if (!bound) {
    throw new McpToolError(402, "WALLET_LIMIT", `This public address is not on your account. ${walletLimitMessage(user.plan, user.email)} Bind it in Wallet check first.`, {
      upgradeUrl: "/upgrade",
      maxWallets: maxWalletsFor(user.plan, user.email),
      wallets: user.wallets,
    });
  }
  return parsed.address;
}

export function asMcpToolError(err: unknown): McpToolError | null {
  if (err instanceof McpToolError) return err;
  if (err && typeof err === "object" && (err as { name?: string }).name === "McpToolError") {
    const status = Number((err as { status?: unknown }).status);
    const code = String((err as { code?: unknown }).code ?? "TOOL_FAILED");
    const message = String((err as { message?: unknown }).message ?? "Tool failed");
    const extra =
      "extra" in err && typeof (err as { extra?: unknown }).extra === "object" && (err as { extra: object }).extra
        ? ((err as { extra: Record<string, unknown> }).extra ?? {})
        : {};
    if (Number.isFinite(status)) return new McpToolError(status, code, message, extra);
  }
  return asSecretError(err);
}

export function asSecretError(err: unknown): McpToolError | null {
  if (err instanceof SecretMaterialError) {
    return new McpToolError(400, err.code, err.message);
  }
  return null;
}
