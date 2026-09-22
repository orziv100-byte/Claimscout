import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveFallbackUrl, inspectPath, officialLinkSet } from "./official-source.ts";

test("every official URL gets an archive hint and an inspect path", () => {
  const set = officialLinkSet({ officialUrl: "https://app.uniswap.org/" });
  assert.equal(set.officialUrl, "https://app.uniswap.org/");
  assert.equal(set.archiveUrl, archiveFallbackUrl("https://app.uniswap.org/"));
  assert.equal(set.inspectHref, inspectPath("https://app.uniswap.org/"));
});

test("an existing archive URL is kept", () => {
  const set = officialLinkSet({
    officialUrl: "https://claim.example",
    archiveUrl: "https://web.archive.org/web/2020/https://claim.example",
  });
  assert.equal(set.archiveUrl, "https://web.archive.org/web/2020/https://claim.example");
});
