export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertSafeToStart, ProductionEnvError } = await import("./lib/env.ts");
  try {
    assertSafeToStart();
  } catch (err) {
    const missing = err instanceof ProductionEnvError ? err.missing.join(", ") : "unknown";
    console.error("[poolindex] refused to start: production secrets missing or well-known.", missing);
    process.exit(1);
  }
}
