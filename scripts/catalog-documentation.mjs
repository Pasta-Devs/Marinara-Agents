import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import {
  assertPortableFilenameComponent,
  assertPortableRelativePath,
  resolveContainedPortablePath,
} from "./catalog-path-safety.mjs";

export const MAX_DOCUMENTATION_BYTES = 256 * 1024;
export const MAX_DOCUMENTATION_GUIDES = 32;
const MAX_CONFIG_BYTES = 32 * 1024;

const heading = z.string().trim().min(1).max(200).optional();
const markdownPath = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => {
    try {
      assertPortableRelativePath(value);
      return value.endsWith(".md") && !/[%?#]/u.test(value);
    } catch {
      return false;
    }
  }, "Use a portable Markdown path without URL encoding, query or fragment");

const guideId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/u)
  .refine((id) => id !== "overview", "overview is reserved");
const guideIdentity = { id: guideId, title: z.string().trim().min(1).max(120) };
const packageReference = (extra = {}) =>
  z
    .object({ ...extra, source: z.literal("package"), path: markdownPath, heading })
    .strict()
    .refine(
      ({ path }) => path === "README.md" || (path.startsWith("docs/") && !/^docs\/development(?:\/|$)/iu.test(path)),
      "Package guides must be README.md or user documentation under docs/",
    );
const engineReference = (extra = {}) =>
  z
    .object({ ...extra, source: z.literal("engine"), path: markdownPath, heading })
    .strict()
    .refine(({ path }) => !/^development(?:\/|$)/iu.test(path), "Engine references must select user documentation");
const sourceReference = z.union([packageReference(), engineReference()]);
const sourceGuide = z.union([packageReference(guideIdentity), engineReference(guideIdentity)]);

function uniqueGuides(guides, context) {
  const ids = new Set();
  for (const guide of guides) {
    if (ids.has(guide.id)) context.addIssue({ code: "custom", message: `Duplicate guide id: ${guide.id}` });
    ids.add(guide.id);
  }
}

// Authoring metadata is separate from manifests and downloadable package payloads.
export const packageDocumentationSchema = z
  .object({
    schemaVersion: z.literal(1),
    overview: sourceReference,
    guides: z.array(sourceGuide).max(MAX_DOCUMENTATION_GUIDES).default([]).superRefine(uniqueGuides),
  })
  .strict();

const catalogReference = (extra = {}) =>
  z
    .object({
      ...extra,
      source: z.literal("catalog"),
      // Generated URL path relative to docs.json, like the existing store sidecar.
      path: z
        .string()
        .min(1)
        .max(500)
        .regex(/^(?:\.\.\/)+packages\/[a-z0-9-]+\/(?:README\.md|docs\/(?:[^/%?#\\:]+\/)*[^/%?#\\:]+\.md)$/u),
      heading,
      sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      bytes: z.number().int().positive().max(MAX_DOCUMENTATION_BYTES),
    })
    .strict();
const publishedReference = z.union([engineReference(), catalogReference()]);
const publishedGuide = z.union([engineReference(guideIdentity), catalogReference(guideIdentity)]);
export const capabilityDocumentationSchema = z
  .object({
    schemaVersion: z.literal(1),
    packages: z
      .record(
        z.string().min(1).max(80),
        z
          .object({
            version: z.string().min(1).max(80),
            overview: publishedReference,
            guides: z.array(publishedGuide).max(MAX_DOCUMENTATION_GUIDES).superRefine(uniqueGuides),
          })
          .strict(),
      )
      .refine((packages) => Object.keys(packages).length <= 500, "At most 500 documented packages"),
  })
  .strict();

async function readBoundedFile(path, maximum) {
  const info = await stat(path);
  if (!info.isFile() || info.size === 0 || info.size > maximum)
    throw new Error(`${path} must be a file of 1-${maximum} bytes`);
  const bytes = await readFile(path);
  if (bytes.length === 0 || bytes.length > maximum) throw new Error(`${path} must be a file of 1-${maximum} bytes`);
  return bytes;
}

/** Build an optional index for exactly one catalog lane. No Markdown is copied. */
export async function buildDocumentationDocument(repoRoot, directory, entries) {
  const packages = {};
  const sorted = [...entries].sort((left, right) =>
    left.manifest.id < right.manifest.id ? -1 : left.manifest.id > right.manifest.id ? 1 : 0,
  );
  for (const { manifest } of sorted) {
    const id = assertPortableFilenameComponent(manifest.id, "Documentation package id");
    let raw;
    let packageRoot;
    try {
      packageRoot = await resolveContainedPortablePath(repoRoot, `packages/${id}`, "Documentation package", {
        allowMissing: true,
      });
      const configPath = await resolveContainedPortablePath(packageRoot, "documentation.json", "Documentation index", {
        allowMissing: true,
      });
      raw = await readBoundedFile(configPath, MAX_CONFIG_BYTES);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const config = packageDocumentationSchema.parse(JSON.parse(raw.toString("utf8")));
    const compile = async (reference) => {
      const selectedHeading = reference.heading ? { heading: reference.heading } : {};
      if (reference.source === "engine") return { source: "engine", path: reference.path, ...selectedHeading };
      const path = await resolveContainedPortablePath(packageRoot, reference.path, "Package user guide");
      const content = await readBoundedFile(path, MAX_DOCUMENTATION_BYTES);
      return {
        source: "catalog",
        path: relative(join(repoRoot, directory), path).split("\\").join("/"),
        ...selectedHeading,
        sha256: createHash("sha256").update(content).digest("hex"),
        bytes: content.length,
      };
    };
    const guides = [];
    for (const guide of config.guides) guides.push({ id: guide.id, title: guide.title, ...(await compile(guide)) });
    packages[id] = { version: manifest.version, overview: await compile(config.overview), guides };
  }
  return capabilityDocumentationSchema.parse({ schemaVersion: 1, packages });
}
