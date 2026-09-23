import { HttpRequestError, TimeoutError } from "viem";

/** Bounded retry for transient RPC/network failures only. Never retries a deterministic
 * revert, an invalid-input error, or a "no contract code" guard — those will fail the
 * same way every time, so retrying would just waste requests and delay the real answer. */
export const MAX_RPC_RETRIES = 2; // up to 3 total attempts
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 4_000;

export function isRetriableRpcError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  if (err instanceof HttpRequestError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("socket hang up") ||
      msg.includes("429") ||
      msg.includes("too many requests") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504")
    ) {
      return true;
    }
  }
  return false;
}

export function rpcRetryDelayMs(attempt: number): number {
  const base = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * base * 0.3);
  return base + jitter;
}

/** Runs `fn`, retrying only retriable failures with bounded exponential backoff + jitter.
 * `context` is included in the final thrown error so callers keep source/chain context. */
export async function withRpcRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = MAX_RPC_RETRIES,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetriableRpcError(err) || attempt === maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, rpcRetryDelayMs(attempt)));
    }
  }
  throw new Error(`${context}: retry loop exited without a result or error`, { cause: lastErr });
}
