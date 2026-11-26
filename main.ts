// Entry for "Convince the AI Judge to Visit Your House: A Letter in One Image".
// Deterministically copies the invitation image (letter.jpg) to /output/entry.png.
// Node 22 standard library only; no network, no randomness, no wall-clock use.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const SRC_NAME = "letter.jpg";
const OUT_NAME = "entry.png";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// Reads width/height from the image header without decoding pixels:
// PNG IHDR (bytes 16..24) or the first JPEG SOF marker (0xC0/0xC1/0xC2).
function readDimensions(data, isJpeg) {
  if (!isJpeg) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  let off = 2;
  while (off + 9 < data.length) {
    if (data[off] !== 0xff) throw new Error("bad JPEG marker stream");
    const marker = data[off + 1];
    const len = data.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xc2) {
      return {
        height: data.readUInt16BE(off + 5),
        width: data.readUInt16BE(off + 7),
      };
    }
    off += 2 + len;
  }
  throw new Error("no JPEG SOF marker found");
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = join(here, SRC_NAME);
  if (!existsSync(src)) throw new Error(`missing source image: ${SRC_NAME}`);
  const st = statSync(src);
  if (!st.isFile()) throw new Error(`source is not a regular file: ${SRC_NAME}`);
  if (st.size === 0 || st.size > MAX_BYTES) {
    throw new Error(`source size ${st.size} bytes, must be 1..${MAX_BYTES}`);
  }
  const data = readFileSync(src);
  const isJpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng =
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  if (!isJpeg && !isPng) throw new Error("source is neither JPEG nor PNG");
  const dims = readDimensions(data, isJpeg);
  if (dims.width > 1024 || dims.height > 1024) {
    throw new Error(
      `source is ${dims.width}x${dims.height}, gate allows at most 1024x1024`,
    );
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, OUT_NAME);
  copyFileSync(src, out);
  const copied = readFileSync(out);
  if (sha256(copied) !== sha256(data)) {
    throw new Error("copied file hash does not match source");
  }
  console.log(`wrote ${copied.length} bytes to ${out} sha256=${sha256(copied)}`);
}

main();
