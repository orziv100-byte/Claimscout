import assert from "node:assert/strict";
import { test } from "node:test";
import { isHexAddress, parsePublicAddress, walletSubmitIntent } from "./address.ts";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const LOWER = VITALIK.toLowerCase();

test("parsePublicAddress accepts checksum, lowercase, and mixed-case public hex", () => {
  assert.equal(isHexAddress(VITALIK), true);
  const checksum = parsePublicAddress(VITALIK);
  assert.equal(checksum.ok, true);
  if (checksum.ok) assert.equal(checksum.address, VITALIK);

  const lower = parsePublicAddress(`  ${LOWER}  `);
  assert.equal(lower.ok, true);
  if (lower.ok) assert.equal(lower.address, VITALIK);

  const mixed = `0x${VITALIK.slice(2).toUpperCase()}`;
  const parsedMixed = parsePublicAddress(mixed);
  assert.equal(parsedMixed.ok, true);
  if (parsedMixed.ok) assert.equal(parsedMixed.address, VITALIK);
});

test("parsePublicAddress rejects keys, seeds, and non-addresses", () => {
  assert.equal(parsePublicAddress("").ok, false);
  assert.equal(parsePublicAddress("not-an-address").ok, false);
  assert.equal(parsePublicAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about").ok, false);
  const key = parsePublicAddress("0x1111111111111111111111111111111111111111111111111111111111111111");
  assert.equal(key.ok, false);
});

test("walletSubmitIntent uses pasted public addresses as read-only even if Connect is clicked", () => {
  assert.equal(walletSubmitIntent(VITALIK, "connect"), "readonly");
  assert.equal(walletSubmitIntent(LOWER, "check"), "readonly");
  assert.equal(walletSubmitIntent("", "connect"), "injected");
  assert.equal(walletSubmitIntent("", "check"), "empty");
  assert.equal(walletSubmitIntent("hello", "check"), "invalid");
  assert.equal(walletSubmitIntent("hello", "connect"), "invalid");
});
