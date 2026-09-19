import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeAutomation, scanTextFlags, shouldBlockDiscovery } from "./safety.ts";

const UNICH = {
  title: "Tunzankies/Unich_Airdrop",
  summary: "auto mining, auto task, auto ref, get token",
  url: "https://github.com/Tunzankies/Unich_Airdrop",
};

test("looksLikeAutomation matches auto mining / auto task / auto ref", () => {
  assert.equal(looksLikeAutomation(UNICH.summary), true);
  assert.equal(looksLikeAutomation("auto-claim faucet script"), true);
  assert.equal(looksLikeAutomation("merkle distributor for UNI token airdrop"), false);
  assert.equal(looksLikeAutomation("Official public claim portal"), false);
});

test("shouldBlockDiscovery blocks the Unich_Airdrop automation repo", () => {
  const decision = shouldBlockDiscovery(UNICH);
  assert.equal(decision.blocked, true);
  if (decision.blocked) assert.equal(decision.reason, "automation");
});

test("shouldBlockDiscovery keeps a documented public airdrop", () => {
  const decision = shouldBlockDiscovery({
    title: "Uniswap UNI airdrop",
    summary: "Official merkle distributor for UNI token holders.",
    url: "https://app.uniswap.org/claim",
  });
  assert.equal(decision.blocked, false);
});

test("shouldBlockDiscovery still blocks secrets and dump hosts", () => {
  const secret = shouldBlockDiscovery({
    title: "wallet dump",
    summary: "paste of a private key for a faucet",
    url: "https://example.com/notes",
  });
  assert.equal(secret.blocked, true);

  const host = shouldBlockDiscovery({
    title: "key list",
    summary: "public claim checker",
    url: "https://privatekeys.pw/keys",
  });
  assert.equal(host.blocked, true);
  if (host.blocked) assert.equal(host.reason, "blocked_host");
});

test("scanTextFlags marks automation as danger", () => {
  const flags = scanTextFlags(UNICH.summary);
  assert.ok(flags.some((flag) => flag.code === "automation" && flag.severity === "danger"));
});
