import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COPYRIGHT,
  COPYRIGHT_NOTICE,
  COPYRIGHT_OWNER_COUNTRY,
  COPYRIGHT_OWNER_NAME,
  COPYRIGHT_RESTRICTION,
  COPYRIGHT_RIGHTS_HOLDER,
} from "./app-info.ts";
import { TERMS_SECTIONS, TERMS_VERSION } from "./legal.ts";

test("copyright names Lior Elbaz, Israel and forbids copy, sale, and commercial use", () => {
  assert.equal(COPYRIGHT_OWNER_NAME, "Lior Elbaz");
  assert.equal(COPYRIGHT_OWNER_COUNTRY, "Israel");
  assert.equal(COPYRIGHT_RIGHTS_HOLDER, "Lior Elbaz, Israel");
  assert.match(COPYRIGHT, /© 2026 Lior Elbaz, Israel\. All rights reserved\./);
  assert.match(COPYRIGHT_RESTRICTION, /Copying, sale, distribution, sublicensing, or commercial use/);
  assert.match(COPYRIGHT_RESTRICTION, /prior written permission from Lior Elbaz/);
  assert.match(COPYRIGHT_RESTRICTION, /operations/);
  assert.match(COPYRIGHT_RESTRICTION, /visual design/);
  assert.match(COPYRIGHT_NOTICE, /exclusive property of Lior Elbaz, Israel/);
  assert.doesNotMatch(COPYRIGHT_NOTICE, /034486852|identity number/i);
});

test("terms include ownership and a new acceptance version", () => {
  assert.equal(TERMS_SECTIONS[0]?.heading, "Service operator");
  const ip = TERMS_SECTIONS.find((section) => section.heading === "Intellectual property");
  assert.ok(ip);
  assert.match(ip.body, /Lior Elbaz, Israel/);
  assert.match(ip.body, /may not copy, sell, distribute, sublicense, or make commercial use/);
  assert.equal(TERMS_VERSION, "beta-2026-09-20.2");
});

test("LICENSE and COPYRIGHT.md do not publish a national identity number", () => {
  const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8");
  const notice = readFileSync(new URL("../COPYRIGHT.md", import.meta.url), "utf8");
  assert.match(license, /Copyright \(c\) 2026 Lior Elbaz, Israel/);
  assert.match(license, /without prior\s+written permission from Lior Elbaz/s);
  assert.match(notice, /ליאור אלבז, ישראל/);
  assert.match(notice, /אין להעתיק, למכור/);
  assert.doesNotMatch(license, /034486852|identity number/i);
  assert.doesNotMatch(notice, /034486852|identity number/i);
});
