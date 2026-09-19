import { NextResponse } from "next/server";
import {
  publicSnapshot,
  ResourcePressureError,
  withJob,
  type JobKind,
} from "./resource-guard";

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && (err.name === "AbortError" || err.message === "Aborted")) ||
    (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "AbortError")
  );
}

export async function guardedJson(
  request: Request,
  name: string,
  kind: JobKind,
  handler: () => Promise<unknown>,
  coalesceKey?: string,
): Promise<NextResponse> {
  try {
    const body = await withJob(name, kind, handler, {
      signal: request.signal,
      coalesceKey,
    });
    return NextResponse.json(body);
  } catch (err) {
    if (request.signal.aborted || isAbortError(err)) {
      return NextResponse.json({ error: "aborted", code: "ABORTED" }, { status: 400 });
    }
    if (err instanceof ResourcePressureError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          cause: err.snapshot.cause,
          resource: publicSnapshot(err.snapshot),
        },
        {
          status: 503,
          headers: {
            "Retry-After": String(err.retryAfterSec),
            "Cache-Control": "no-store",
          },
        },
      );
    }
    throw err;
  }
}
