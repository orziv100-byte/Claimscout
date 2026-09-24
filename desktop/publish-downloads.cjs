"use strict";

const { copyFileSync, existsSync, mkdirSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const dist = join(__dirname, "dist");
const dest = join(__dirname, "..", "public", "downloads");
mkdirSync(dest, { recursive: true });
if (!existsSync(dist)) throw new Error("desktop/dist missing — run npm run dist first");

const keep = readdirSync(dist).filter(
  (name) =>
    /^PoolIndex-.+-win\.exe(\.blockmap)?$/.test(name) ||
    /^PoolIndex-.+-mac-.*\.(zip|dmg)$/.test(name) ||
    name === "latest.yml" ||
    name === "latest-mac.yml",
);
if (!keep.some((name) => name.endsWith(".exe") || name.endsWith(".zip") || name.endsWith(".dmg"))) {
  throw new Error("No PoolIndex Windows or macOS installer in desktop/dist");
}
for (const name of keep) {
  copyFileSync(join(dist, name), join(dest, name));
  console.log(`copied ${name}`);
}
