import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SsrfError,
  assertSafeUrl,
  fetchSafe,
  isBlockedIp,
  isBlockedHostname,
  tryParseIPv4,
} from "./ssrf.ts";

const publicLookup = async () => ["93.184.216.34"];

test("blocks localhost hostnames and loopback literals", async () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("LOCALHOST."), true);
  await assert.rejects(() => assertSafeUrl("http://localhost/secret"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://127.0.0.1/secret"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[::1]/secret"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://2130706433/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://0177.0.0.1/"), SsrfError);
});

test("blocks private LAN, link-local, and reserved IPv4 ranges", async () => {
  for (const url of [
    "http://10.0.0.1/",
    "http://10.255.255.254/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.50/",
    "http://192.168.0.1/",
    "http://169.254.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://224.0.0.1/",
  ]) {
    await assert.rejects(() => assertSafeUrl(url), /private|loopback|link-local|reserved|blocked/i);
  }
  assert.equal(isBlockedIp("10.1.2.3"), true);
  assert.equal(isBlockedIp("172.16.4.4"), true);
  assert.equal(isBlockedIp("192.168.100.2"), true);
  assert.equal(isBlockedIp("169.254.9.9"), true);
  assert.equal(isBlockedIp("8.8.8.8"), false);
  assert.equal(isBlockedIp("172.32.0.1"), false);
});

test("blocks IPv6 loopback, ULA, link-local, and mapped private IPv4", async () => {
  await assert.rejects(() => assertSafeUrl("http://[::1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[fc00::1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[fd12:3456:789a::1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[fe80::1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[::ffff:127.0.0.1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[::ffff:10.0.0.1]/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("http://[::ffff:192.168.0.1]/"), SsrfError);
  assert.equal(isBlockedIp("2001:4860:4860::8888"), false);
});

test("allows only http and https and rejects file/ftp", async () => {
  await assert.rejects(() => assertSafeUrl("file:///etc/passwd"), SsrfError);
  await assert.rejects(() => assertSafeUrl("ftp://example.com/"), SsrfError);
  await assert.rejects(() => assertSafeUrl("gopher://example.com/"), SsrfError);
  const allowed = await assertSafeUrl("https://example.com/path", { lookup: publicLookup });
  assert.equal(allowed.protocol, "https:");
});

test("resolves DNS and rejects a public hostname that maps to a private address", async () => {
  await assert.rejects(
    () => assertSafeUrl("https://rebind.example", { lookup: async () => ["127.0.0.1"] }),
    SsrfError,
  );
  await assert.rejects(
    () => assertSafeUrl("https://rebind.example", { lookup: async () => ["10.0.0.8", "1.1.1.1"] }),
    SsrfError,
  );
  const ok = await assertSafeUrl("https://example.com", { lookup: publicLookup });
  assert.equal(ok.hostname, "example.com");
});

test("does not follow a redirect into a blocked address", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: string) => {
    calls.push(input);
    if (input.startsWith("https://example.com")) {
      return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/admin" } });
    }
    return new Response("leaked", { status: 200 });
  };
  await assert.rejects(
    () => fetchSafe("https://example.com/go", {}, { fetchImpl, lookup: publicLookup }),
    SsrfError,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.startsWith("https://example.com"), true);
});

test("validates every redirect hop including private LAN and link-local targets", async () => {
  const hops = [
    ["https://example.com/a", "https://cdn.example.com/b"],
    ["https://cdn.example.com/b", "http://192.168.1.20/"],
  ];
  const fetchImpl = async (input: string) => {
    const hop = hops.find(([from]) => input.startsWith(from));
    if (hop) return new Response(null, { status: 301, headers: { Location: hop[1] } });
    return new Response("ok", { status: 200 });
  };
  const lookup = async (hostname: string) => {
    if (hostname === "example.com" || hostname === "cdn.example.com") return ["93.184.216.34"];
    throw new Error("unexpected lookup");
  };
  await assert.rejects(() => fetchSafe("https://example.com/a", {}, { fetchImpl, lookup }), SsrfError);

  const linkLocal = async (input: string) => {
    if (input.startsWith("https://example.com")) {
      return new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } });
    }
    return new Response("ok", { status: 200 });
  };
  await assert.rejects(() => fetchSafe("https://example.com/meta", {}, { fetchImpl: linkLocal, lookup: publicLookup }), SsrfError);
});

test("follows a safe redirect hop and returns the final public response", async () => {
  const fetchImpl = async (input: string) => {
    if (input === "https://example.com/go") {
      return new Response(null, { status: 302, headers: { Location: "/next" } });
    }
    if (input === "https://example.com/next") {
      return new Response("ok", { status: 200 });
    }
    throw new Error(`unexpected ${input}`);
  };
  const res = await fetchSafe("https://example.com/go", {}, { fetchImpl, lookup: publicLookup });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

test("TOCTOU: public first resolve then metadata/private second resolve does not fetch", async () => {
  // Scenario: rebind.example A-record 93.184.216.34 on check #1, then 169.254.169.254 on check #2.
  let resolves = 0;
  const lookup = async () => {
    resolves += 1;
    if (resolves === 1) return ["93.184.216.34"];
    return ["169.254.169.254"];
  };
  const calls: string[] = [];
  const fetchImpl = async (input: string) => {
    calls.push(input);
    return new Response("leaked", { status: 200 });
  };
  await assert.rejects(
    () => fetchSafe("https://rebind.example/meta", {}, { fetchImpl, lookup }),
    /rebinding|private|link-local|reserved/i,
  );
  assert.equal(resolves >= 2, true);
  assert.deepEqual(calls, []);
});

test("parses decimal and short-form IPv4 used in SSRF bypasses", () => {
  assert.equal(tryParseIPv4("2130706433"), "127.0.0.1");
  assert.equal(tryParseIPv4("0177.0.0.1"), "127.0.0.1");
  assert.equal(tryParseIPv4("0x7f.0.0.1"), "127.0.0.1");
  assert.equal(tryParseIPv4("10.1"), "10.0.0.1");
});
