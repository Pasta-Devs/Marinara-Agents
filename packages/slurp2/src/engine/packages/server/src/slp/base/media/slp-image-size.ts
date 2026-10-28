/**
 * A picture's pixel size from its file header (V: adaptive post frames). The client reserves each
 * post's frame in its picture's own ratio before the picture loads, so nothing jumps; the size comes
 * from the stored file, so old posts get it too without a migration.
 *
 * Reads PNG, JPEG, WebP and GIF headers only (the formats image providers and uploads give us); any
 * other file is `null` and the client keeps its default frame and fits it to the picture once loaded.
 * ponytail: no EXIF orientation, so a rotated phone JPEG upload reads sideways (its frame takes the
 * swapped ratio and the picture is cut to it); read tag 0x0112 if player uploads show it.
 */
import { closeSync, openSync, readSync } from "node:fs";

export type SlpImageSize = { width: number; height: number };

const ok = (width: number, height: number): SlpImageSize | null =>
  width > 0 && height > 0 && width < 65_536 && height < 65_536 ? { width, height } : null;

/** The size from the first bytes of an image file, or null when the header is not one we read. */
export function readSlpImageSize(bytes: Uint8Array): SlpImageSize | null {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR")
    return ok(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF")
    return ok(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
  if (buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") return ok(1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3));
    if (chunk === "VP8L" && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return ok(1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
    }
    if (chunk === "VP8 ") return ok(buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
    return null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    // Walk the JPEG segments to the first frame header (SOF0-SOF15, not DHT/JPG/DAC).
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1]!;
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return ok(buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5));
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
}

// ponytail: the first 512 KB hold the JPEG frame header for any picture we store (EXIF comes first);
// read more if a camera upload ever misses it. Cached per path: a stored file never changes in place.
const HEAD_BYTES = 512 * 1024;
const cache = new Map<string, SlpImageSize | null>();

/** The size of a stored picture, read once per file. Null when unreadable. */
export function slpImageSizeOfFile(absolutePath: string): SlpImageSize | null {
  if (cache.has(absolutePath)) return cache.get(absolutePath)!;
  let size: SlpImageSize | null = null;
  try {
    const fd = openSync(absolutePath, "r");
    try {
      const head = Buffer.alloc(HEAD_BYTES);
      size = readSlpImageSize(head.subarray(0, readSync(fd, head, 0, HEAD_BYTES, 0)));
    } finally {
      closeSync(fd);
    }
  } catch {
    return null; // missing now: not cached, so a file that lands later is read then
  }
  if (cache.size > 5_000) cache.clear();
  cache.set(absolutePath, size);
  return size;
}
