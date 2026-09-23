import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetriableRpcError, withRpcRetry } from "./rpc-retry.ts";

test("transient failure followed by success: retries then returns the result", async () => {
  let calls = 0;
  const result = await withRpcRetry(async () => {
    calls += 1;
    if (calls < 2) throw new Error("fetch failed: network error");
    return "ok";
  }, "test-transient-then-success");
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});

test("persistent transient failure: retries up to the limit then throws", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRpcRetry(async () => {
        calls += 1;
        throw new Error("ETIMEDOUT: request timeout");
      }, "test-persistent-transient"),
    /timeout/i,
  );
  assert.equal(calls, 3);
});

test("deterministic/non-retriable failure: fails immediately without retrying", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRpcRetry(async () => {
        calls += 1;
        throw new Error("Token 0xdead has no contract code on chain 1");
      }, "test-deterministic"),
    /no contract code/i,
  );
  assert.equal(calls, 1);
});

test("retry limit is configurable and honored", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRpcRetry(
        async () => {
          calls += 1;
          throw new Error("socket hang up");
        },
        "test-retry-limit",
        0,
      ),
    /socket hang up/i,
  );
  assert.equal(calls, 1);
});

test("isRetriableRpcError classifies transient vs deterministic messages correctly", () => {
  assert.equal(isRetriableRpcError(new Error("fetch failed")), true);
  assert.equal(isRetriableRpcError(new Error("request timeout")), true);
  assert.equal(isRetriableRpcError(new Error("429 too many requests")), true);
  assert.equal(isRetriableRpcError(new Error("execution reverted: insufficient balance")), false);
  assert.equal(isRetriableRpcError(new Error("Token has no contract code on chain 1")), false);
  assert.equal(isRetriableRpcError("not an error object"), false);
});
