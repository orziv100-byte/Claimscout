import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeAutomation, looksLikeDeveloperTooling, scanTextFlags, shouldBlockDiscovery } from "./safety.ts";

const UNICH = {
  title: "Tunzankies/Unich_Airdrop",
  summary: "auto mining, auto task, auto ref, get token",
  url: "https://github.com/Tunzankies/Unich_Airdrop",
};

test("looksLikeAutomation matches auto mining / auto task / auto ref", () => {
  assert.equal(looksLikeAutomation(UNICH.summary), true);
  assert.equal(looksLikeAutomation("auto-claim faucet script"), true);
  assert.equal(looksLikeAutomation("obryen/airdrop-hunter"), true);
  assert.equal(looksLikeAutomation("thomas613/crypto-airdrops-hunter"), true);
  assert.equal(looksLikeAutomation("MuzannDev/arbitrum-airdrop-claimer"), true);
  assert.equal(looksLikeAutomation("codeesura/layerzero-airdrop-rescue"), true);
  assert.equal(looksLikeAutomation("transfer all the tokens to one address"), true);
  assert.equal(looksLikeAutomation("merkle distributor for UNI token airdrop"), false);
  assert.equal(looksLikeAutomation("Official public claim portal"), false);
});

test("shouldBlockDiscovery blocks airdrop-hunter repos", () => {
  const hunter = shouldBlockDiscovery({
    title: "obryen/airdrop-hunter",
    summary: "Hunt and collect crypto airdrops.",
    url: "https://github.com/obryen/airdrop-hunter",
  });
  assert.equal(hunter.blocked, true);
  if (hunter.blocked) assert.equal(hunter.reason, "automation");
});

test("shouldBlockDiscovery blocks the Unich_Airdrop automation repo", () => {
  const decision = shouldBlockDiscovery(UNICH);
  assert.equal(decision.blocked, true);
  if (decision.blocked) assert.equal(decision.reason, "automation");
});

test("shouldBlockDiscovery drops claimer bots and developer tooling", () => {
  const claimer = shouldBlockDiscovery({
    title: "WizerZ/arbitrum-airdrop-claimer",
    summary: "claim several wallets at the same time and transfer all the tokens to one address",
    url: "https://github.com/WizerZ/arbitrum-airdrop-claimer",
  });
  assert.equal(claimer.blocked, true);
  const starter = shouldBlockDiscovery({
    title: "foo/merkle-airdrop-starter",
    summary: "Hardhat merkle drop",
    url: "https://github.com/foo/merkle-airdrop-starter",
  });
  assert.equal(starter.blocked, true);
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

test("developer tooling repos are tagged, not treated as claimable offers", () => {
  assert.equal(looksLikeDeveloperTooling("foo/merkle-airdrop-starter", "Hardhat merkle drop"), true);
  assert.equal(looksLikeDeveloperTooling("bar/multisender", "bulk token sender"), true);
  assert.equal(looksLikeDeveloperTooling("Uniswap UNI airdrop", "Official merkle distributor for UNI token holders."), false);
});
