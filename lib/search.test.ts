import assert from "node:assert/strict";
import { test } from "node:test";
import { runSearch } from "./search.ts";

test("catalog-only search does not hit live sources and reports blocked 0", async () => {
  const result = await runSearch({ query: "uniswap", sources: ["catalog"] });
  assert.equal(result.blocked, 0);
  assert.equal(result.discovered.length, 0);
  assert.equal(result.sourceErrors.length, 0);
  assert.ok(result.catalog.length > 0);
});
