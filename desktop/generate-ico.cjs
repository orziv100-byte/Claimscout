"use strict";

const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const png = readFileSync(join(__dirname, "icon.png"));
if (png[0] !== 0x89 || png.toString("ascii", 1, 4) !== "PNG") {
  throw new Error("icon.png must be a PNG");
}
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);
entry.writeUInt8(0, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
writeFileSync(join(__dirname, "icon.ico"), Buffer.concat([dir, entry, png]));
