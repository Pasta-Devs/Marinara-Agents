// ──────────────────────────────────────────────
// Otome Forge: the Engine's own art in a story that paints nothing (#2147)
// ──────────────────────────────────────────────
// In a world with no image connection, a love interest from a character card stands in the card's Engine sprites, else
// its avatar, and the protagonist in her persona's avatar. Only an owner with no look yet adopts it (POST /runs, and GET
// /runs/:run for stories in progress and a card linked later): `portrait` is the Engine file, with no `portraitRef`, and
// `art` is ready with its url, so the forge's paint step for that owner is done (setup/forge.ts withEngineSteps). With an
// image connection, an owner with no look is painted instead (setup/forge.ts), and one already in Engine art keeps it,
// which is how stories made before 0.22.0 or before their connection stay. A painted look is never replaced, and a
// Repaint (the art route) still paints over Engine art by the player's choice; only `global-gallery:` refs are ever
// deleted, so no Engine file is.
// A sprite base brings the faces its sprites already have (ENGINE_FACE_LABELS) as the kit's face set for that base: ready
// when all five are found, or whenever Ask before painting is on, so no face is ever paid for without a tap; otherwise
// `stopped` with the found ones (no record with none), so with a connection and Expressions on the kit pays only for the
// missing ones the next time he speaks. An avatar base gets an empty ready set: no face is ever painted by itself as an
// edit of a square avatar. Repaint expressions still paints all five on either. schemas/state.ts readyFaces shows
// Engine faces whatever the set's state or the Expressions switch, since they cost nothing.
// A look that is still the avatar adopted here, with no face painted on it, is read again once per process, so a new
// card or persona avatar shows (and an avatar-only card that gained sprites stands in them); Home's "Me" reads her
// persona avatar live, as before she had a look.
// ponytail: a sprite base is resolved once: a sprite re-uploaded under the same filename or new sprites are not picked
// up in that story, and unlinking the card keeps it until a Repaint. Its URL stays stable on purpose, as a changed base
// would prune its paid faces. A ready set seeded under Ask before painting stays ready when Ask is turned off later, and
// its missing faces are painted only by Repaint expressions, which repaints all five. The upgrade path is an explicit
// "Use my Engine art" beside Repaint, and a "Paint the missing faces" beside Repaint expressions.
// ponytail: sprites stand on stage through the free cut-out queue (art/cutout.ts). A transparent sprite comes back as it
// is, but an opaque one with scenery may get a poor matte, a GIF or AVIF sprite stays uncut (so its faces never stand on
// stage), and each sprite costs one free gallery copy, deleted with the run. The upgrade path is the Engine reporting
// `alreadyTransparent`, or Otome sending `engine: "auto"` for Engine-owned art.
import { forgeLocalAvatarPath } from "@forge-kit/image-avatar-references.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { Paint, Player, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isEngineAvatar } from "../../../../../client/src/features/otome-forge/shared/engine-art.js";
import { FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { playerId, runDocTarget, unitId } from "../ids.js";
import { field } from "../schemas/common.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { DocTarget, Normalize } from "../store.js";
import { galleryRefIds, type ImageClient } from "./image-client.js";
import { imagesOf, startPaint, updateIfChanged, type ArtDeps, type LookOwner } from "./paint.js";

/**
 * Each face, from the Engine's sprite labels (shared/types/avatars.ts SPRITE_EXPRESSION_LABELS) and Otome's own names:
 * the first label an owner has wins. Nothing stands for neutral, the base itself.
 */
const ENGINE_FACE_LABELS: Record<Face, readonly string[]> = {
  tender: ["tender", "love", "happy"],
  flustered: ["flustered", "blushing", "embarrassed"],
  cold: ["cold", "disgusted", "smirk"],
  hurt: ["hurt", "sad", "crying", "worried"],
  angry: ["angry", "determined"],
};

export interface EngineLook {
  url: string;
  faces: Partial<Record<Face, string>>;
  /** A card or persona avatar: never cut out, and no face is painted on it by itself. */
  avatar?: true;
}

const SPRITE_FILE = /^\/api\/sprites\/([^/?#]+)\/file\/([^/?#]+)$/u;

/** A path the loopback may read as a face's edit base: the kit's avatar and gallery paths, or an Engine sprite file. */
export function engineArtPath(value: unknown): string {
  const avatar = forgeLocalAvatarPath(value);
  if (avatar) return avatar;
  const match = typeof value === "string" ? SPRITE_FILE.exec(value) : null;
  if (!match) return "";
  try {
    const parts = [match[1]!, match[2]!].map(decodeURIComponent);
    return parts.every((part) => part !== "." && part !== ".." && !/[\\/?#\u0000-\u001f\u007f]/u.test(part))
      ? match[0]
      : "";
  } catch {
    return "";
  }
}

/**
 * The Engine look of a card: its `full_neutral` sprite with the full-body faces, else its `neutral` bust with the bust
 * faces, else its avatar, or null for none (a card that is gone has none). Throws when the card cannot be read.
 */
export async function engineLook(
  images: Pick<ImageClient, "sprites" | "characterCard">,
  cardId: string,
): Promise<EngineLook | null> {
  const sprites = (await images.sprites?.(cardId)) ?? [];
  for (const full of [true, false]) {
    const family = new Map<string, string>();
    for (const { expression, url } of sprites) {
      const stem = full ? (expression.startsWith("full_") ? expression.slice(5) : "") : expression;
      if (stem && (full || !expression.startsWith("full_")) && !family.has(stem)) family.set(stem, url);
    }
    const base = family.get("neutral");
    if (!base) continue;
    const faces: Partial<Record<Face, string>> = {};
    for (const face of FACES) {
      const label = ENGINE_FACE_LABELS[face].find((name) => family.has(name));
      if (label) faces[face] = family.get(label)!;
    }
    return { url: base, faces };
  }
  // Only a card that is gone (404) has no avatar; any other failure is tried again on a later read.
  const card = await images.characterCard(cardId).catch((error: unknown) => {
    if ((error as { status?: unknown } | null)?.status === 404) return null;
    throw error;
  });
  const avatar = forgeLocalAvatarPath(card?.avatarPath);
  return avatar ? { url: avatar, faces: {}, avatar: true } : null;
}

/**
 * The persona's Engine avatar as a path the Engine serves, or "" for none, from the Engine's own records (the image
 * client's read says "" on a failure too). Throws when they cannot be read.
 */
export async function personaAvatarPath(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  personaId: string,
): Promise<string> {
  if (!personaId) return "";
  const [record] = await runtime.resources.listPersonas([personaId]);
  const data = typeof record?.data === "string" ? JSON.parse(record.data) : record?.data;
  return forgeLocalAvatarPath(field(data, "avatarPath"));
}

/**
 * The kit's face set for a look's base (art/expressions.ts), or undefined for none: ready under Ask before painting, so
 * nothing is painted untapped, and on an avatar.
 */
function faceSet(look: EngineLook, at: string, ask: boolean) {
  const images = Object.fromEntries(Object.entries(look.faces).map(([face, url]) => [face, { url }]));
  const found = Object.keys(images).length;
  if (look.avatar || ask || found === FACES.length) return { state: "ready", at, images };
  return found ? { state: "stopped", at, images } : undefined;
}

/** A look that is still the avatar adopted here, with no face painted on it: it is read again (see the header). */
const adoptedAvatar = (doc: { portrait?: string; portraitRef?: string; art?: Paint; expressions?: object }) =>
  !doc.portraitRef &&
  isEngineAvatar(doc.portrait) &&
  doc.art?.state === "ready" &&
  doc.art.url === doc.portrait &&
  !galleryRefIds((doc.expressions as Record<string, unknown> | undefined)?.[doc.portrait]).length;

/** Owners already resolved in this process, `${runId}|${owner}`, so polls never read the Engine again. */
const resolved = new Set<string>();

/** A card linked to a love interest later (POST lis/:li/card) is resolved again on the next read. */
export const forgetEngineLook = (runId: string, owner: LookOwner) => void resolved.delete(`${runId}|${owner}`);

/**
 * The owner's Engine look adopted when it has no look yet (or a new avatar for an adopted one), as its paint's claim (a
 * live paint goes first and is never raced), once per process: `portrait` and a ready `art` with its url, and whatever
 * `more` adds. Never throws: a failure is logged and the owner is tried again on a later read.
 */
async function adopt<T extends { portrait?: string; portraitRef?: string; art?: Paint }>(
  deps: ArtDeps,
  runId: string,
  owner: LookOwner,
  doc: T,
  find: () => Promise<EngineLook | null>,
  [target, normalize]: [DocTarget, Normalize<T>],
  more: (current: T, look: EngineLook, at: string) => Partial<T> = () => ({}),
): Promise<T> {
  const key = `${runId}|${owner}`;
  if ((doc.portrait && !adoptedAvatar(doc)) || resolved.has(key)) return doc;
  const release = startPaint(runId, owner);
  if (!release) return doc;
  try {
    const look = await find();
    const at = new Date().toISOString();
    const saved =
      look &&
      (await updateIfChanged(deps.store, target, normalize, (current) =>
        current.portrait && !(adoptedAvatar(current) && current.portrait !== look.url)
          ? undefined
          : { ...current, portrait: look.url, art: { state: "ready", at, url: look.url }, ...more(current, look, at) },
      ));
    resolved.add(key);
    return saved?.value ?? doc;
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] Engine art for %s not read: %s",
      owner,
      error instanceof Error ? error.message : String(error),
    );
    return doc;
  } finally {
    release();
  }
}

/**
 * The run's card love interests and protagonist with no look yet, each in their Engine look when they have one; the
 * documents as saved. Archetype love interests and owners with a look are returned as they are, and so is anyone with no
 * look when `paints` (the world has an image connection: they are painted). `ask` is the world's Ask before painting.
 */
export async function ensureEngineLooks<T extends { player: Player; units: Unit[] }>(
  deps: ArtDeps,
  runId: string,
  run: T,
  ask: boolean,
  paints = false,
): Promise<T> {
  const images = imagesOf(deps);
  const painted = (doc: { portrait?: string }) => paints && !doc.portrait;
  const units = await Promise.all(
    run.units.map((unit) =>
      unit.cardId && !painted(unit)
        ? adopt(
            deps,
            runId,
            `li:${unit.id}`,
            unit,
            () => engineLook(images, unit.cardId!),
            [runDocTarget("unit", unitId(runId, unit.id)), normalizeUnit],
            (current, look, at) => {
              const faces = current.expressions[look.url] ? undefined : faceSet(look, at, ask);
              return faces ? { expressions: { ...current.expressions, [look.url]: faces } } : {};
            },
          )
        : unit,
    ),
  );
  const player = painted(run.player)
    ? run.player
    : await adopt(
        deps,
        runId,
        "player",
        run.player,
        async () => {
          const url = await personaAvatarPath(deps.runtime, run.player.personaId);
          return url ? { url, faces: {}, avatar: true } : null;
        },
        [runDocTarget("player", playerId(runId)), normalizePlayer],
      );
  return { ...run, units, player };
}
