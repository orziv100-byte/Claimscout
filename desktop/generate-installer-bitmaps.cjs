"use strict";

const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

function bmp24(width, height, rgb) {
  const row = width * 3;
  const pad = (4 - (row % 4)) % 4;
  const pixelSize = (row + pad) * height;
  const buf = Buffer.alloc(54 + pixelSize);
  buf.writeUInt16LE(0x4d42, 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelSize, 34);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = 54 + (height - 1 - y) * (row + pad) + x * 3;
      buf[o] = rgb[2];
      buf[o + 1] = rgb[1];
      buf[o + 2] = rgb[0];
    }
  }
  return buf;
}

const dir = join(__dirname, "build");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "installerSidebar.bmp"), bmp24(164, 314, [11, 15, 20]));
writeFileSync(join(dir, "installerHeader.bmp"), bmp24(150, 57, [11, 15, 20]));
console.log("wrote installer bitmaps");
