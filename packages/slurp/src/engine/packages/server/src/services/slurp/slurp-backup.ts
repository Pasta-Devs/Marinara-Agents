import { Buffer } from "node:buffer";
import type { Writable } from "node:stream";

type ZipEntry = { name: string; data: Buffer };
export type StoredZipEntry = { name: string; read: () => Promise<Buffer> };

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const result = Buffer.alloc(2);
  result.writeUInt16LE(value, 0);
  return result;
}

function u32(value: number): Buffer {
  const result = Buffer.alloc(4);
  result.writeUInt32LE(value >>> 0, 0);
  return result;
}

/** Creates a dependency-free ZIP archive using stored entries. */
export function createStoredZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const header = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      entry.data,
    ]);
    localParts.push(header);
    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += header.length;
  }
  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
}

export function jsonEntry(name: string, value: unknown): ZipEntry {
  return { name, data: Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8") };
}

async function writeChunk(stream: Writable, chunk: Buffer): Promise<void> {
  if (stream.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stream.off("drain", onDrain);
      stream.off("error", onError);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

/** Writes a stored ZIP incrementally so media does not need to fit in one archive buffer. */
export async function writeStoredZip(
  stream: Writable,
  entries: readonly StoredZipEntry[],
  onEntry?: (entry: { index: number; total: number; name: string; bytes: number }) => void,
): Promise<void> {
  if (entries.length > 0xffff) throw new Error("Slurp backup contains too many files for a ZIP archive.");
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    const data = await entry.read();
    const name = Buffer.from(entry.name, "utf8");
    if (name.length > 0xffff) throw new Error("Slurp backup contains a file name that is too long.");
    if (data.length > 0xffffffff || offset > 0xffffffff - data.length - 30 - name.length)
      throw new Error("Slurp backup is too large for a classic ZIP archive.");
    const crc = crc32(data);
    const header = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    await writeChunk(stream, header);
    await writeChunk(stream, data);
    onEntry?.({ index: index + 1, total: entries.length, name: entry.name, bytes: data.length });
    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += header.length + data.length;
  }
  const central = Buffer.concat(centralParts);
  await writeChunk(stream, central);
  await writeChunk(
    stream,
    Buffer.concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(entries.length),
      u16(entries.length),
      u32(central.length),
      u32(offset),
      u16(0),
    ]),
  );
  stream.end();
}
