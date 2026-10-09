/** One part of a multipart upload, as @fastify/multipart's req.parts() yields it. */
export type CallUploadPart =
  | {
      type: "file";
      filename: string;
      mimetype: string;
      file: { resume(): unknown };
      toBuffer(): Promise<Buffer>;
    }
  | { type: "field"; fieldname: string; value: unknown };

export type CallUpload = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  /** Text fields in @fastify/multipart's own shape, so `fields.name?.value` reads them. */
  fields: Record<string, { value: string } | undefined>;
};

/**
 * Reads a whole upload: the first file and every text field, in whatever order the browser sent them.
 * req.file() returns at the file, so a field sent after it may not have been read yet; the Calls client
 * sends its fields after the file. toBuffer() still enforces the route's file size limit.
 */
export async function readCallUpload(parts: AsyncIterable<CallUploadPart>): Promise<CallUpload | null> {
  let upload: CallUpload | null = null;
  const fields: CallUpload["fields"] = Object.create(null);
  for await (const part of parts) {
    if (part.type === "field") {
      if (typeof part.value === "string") fields[part.fieldname] = { value: part.value };
    } else if (upload) {
      // Only the first file is used. Draining the others lets the remaining fields arrive.
      part.file.resume();
    } else {
      upload = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype, fields };
    }
  }
  return upload;
}
