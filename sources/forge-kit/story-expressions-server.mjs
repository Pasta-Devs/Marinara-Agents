/* global forgeStoryExpressionNames, forgeLocalAvatarPath */
import { AsyncResource as ForgeStoryExpressionScope } from "node:async_hooks";

// Expression portraits. Each base image (what a story plate shows: a unit's worn outfit or default
// portrait, or the persona's Engine avatar) gets one set of four faces, painted as edits of that
// base: the base is the only reference and the prompt changes nothing but the face. Sets live on the
// unit document, keyed by the base URL:
//   unit.expressions[baseUrl] = { state: "pending"|"stopped"|"ready"|"failed", at, error?,
//     images: { anger|fear|sadness|joy: { url, ref } } }
// so wearing another outfit or switching back never pays twice, a redrawn portrait or outfit leaves
// its old set unused (pruned, gallery images deleted), and world delete finds every ref through the
// unit documents. Painting is background, low-lane work that only speakers of a written or opened
// scene trigger; the scene itself never waits for it.
// Cost safety: a set is marked pending before its first paid image and each image is filed as soon
// as it lands. A failed set, or a pending one this process is not painting (a crash, restart or
// package reload mid-set), is never repainted automatically: only a new base, or turning the setting
// off and on again after the failure (images.expressionsSince), allows one more attempt, and that
// attempt paints only the missing faces. Turning the setting off between paints parks the set as
// "stopped" before any further paid call; it resumes, without repainting filed faces, once it is on.
// A set whose base stops being used mid-paint is parked as "stopped" too, so a restored base resumes it.
// Each paid call first checks that this instance is still live (dispose() on package teardown) and that
// the set is still the pending record this attempt wrote, so a set another instance took over is not paid.
// Explicit repaint stages a replacement inside the record, leaving its usable images visible until all edits land.
// Superseded and incomplete replacement refs stay in the document for run deletion; a read never restarts that work.
// ponytail: a unit document removed by a roster merge takes its refs with it, so those gallery images
// are orphaned like history entries past the sixth; collect them before the remove if merges grow.
// Another game passes its own face names, their looks, avatar-path reader, log prefix and scope name;
// Gacha Forge passes none, so every default below is its own.

// Each face's edit look: [the sentence for natural-language prompts, the tags for tag prompts].
export const forgeExpressionLooks = {
  anger: ["an angry expression: furrowed brows, narrowed glaring eyes, a tense jaw", "angry, furrowed brows, glaring"],
  fear: ["a frightened expression: wide eyes, raised brows, tense parted lips", "scared, wide-eyed, raised eyebrows"],
  sadness: ["a sad expression: lowered brows, glistening teary eyes, a downturned mouth", "sad, teary eyes, frown"],
  joy: ["a joyful expression: a bright smile, smiling eyes, lifted cheeks", "happy, smile, smiling eyes"],
};
const forgeExpressionText = (value) => (typeof value === "string" ? value.trim() : "");
const forgeExpressionTags = (value) =>
  (Array.isArray(value) ? value : []).map(forgeExpressionText).filter(Boolean).join(", ");

export function forgeStoryExpressionsOn(images) {
  return !!images && !images.off && images.expressions === true;
}

export function forgeStoryExpressionBases(unit, extra = []) {
  const outfits = Array.isArray(unit?.outfits) ? unit.outfits.map((outfit) => outfit?.url) : [];
  return new Set([unit?.portrait, ...outfits, ...extra].filter((url) => typeof url === "string" && url));
}

// The cast entry's expression map for its current base: only a ready set, only while the setting is on.
export function forgeStoryExpressionCast(images, unit, base, names = forgeStoryExpressionNames) {
  const record = forgeStoryExpressionsOn(images) && base ? unit?.expressions?.[base] : null;
  if (record?.state !== "ready") return {};
  const expressions = {};
  for (const name of names) {
    const url = record.images?.[name]?.url;
    if (typeof url === "string" && url) expressions[name] = url;
  }
  return Object.keys(expressions).length ? { expressions } : {};
}

// The browser's speaker match (exact name, then a pronoun for the protagonist, then a unique first name).
const forgeExpressionSpeakerKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9 ]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
const forgeExpressionSpeakerPronouns = new Set(["you", "yourself", "me", "myself", "i", "player", "protagonist"]);

export function forgeStorySpeaker(cast, speaker) {
  const key = forgeExpressionSpeakerKey(speaker);
  if (!key || !Array.isArray(cast) || !cast.length) return null;
  const exact = cast.find((character) => character && forgeExpressionSpeakerKey(character.name) === key);
  if (exact) return exact;
  if (forgeExpressionSpeakerPronouns.has(key)) {
    const protagonist = cast.find((character) => character?.prota);
    if (protagonist) return protagonist;
  }
  const single = !key.includes(" ");
  let match = null;
  for (const character of cast) {
    if (!character) continue;
    const words = forgeExpressionSpeakerKey(character.name).split(" ");
    if (single ? words.includes(key) : words[0] === key.split(" ")[0]) {
      if (match) return null;
      match = character;
    }
  }
  return match;
}

// Cast entries that speak or think a line in this beat, its choice branches or a spoken choice.
export function forgeStoryExpressionSpeakers(cast, beat) {
  const options = (Array.isArray(beat?.choices) ? beat.choices : []).flatMap((choice) =>
    Array.isArray(choice?.options) ? choice.options : [],
  );
  const lines = [
    ...(Array.isArray(beat?.segments) ? beat.segments : []),
    ...options.flatMap((option) => (Array.isArray(option?.segments) ? option.segments : [])),
  ];
  const speakers = new Set(lines.map((line) => line?.speaker && forgeStorySpeaker(cast, line.speaker)));
  if (options.some((option) => option?.selection?.kind === "dialogue"))
    speakers.add(cast.find((character) => character?.prota));
  speakers.delete(null);
  speakers.delete(undefined);
  speakers.delete("");
  return [...speakers];
}

// The edit prompt: identity and the base's outfit come from the unit's own art fields when known.
export function forgeStoryExpressionPrompt(
  unit,
  base,
  expression,
  profile = {},
  { tagged = false, negative = "", looks = forgeExpressionLooks } = {},
) {
  const [look, lookTags] = looks[expression];
  const outfit = (Array.isArray(unit?.outfits) ? unit.outfits : []).find((item) => item?.url && item.url === base);
  const wearing = outfit
    ? forgeExpressionText(outfit.outfitLine) || forgeExpressionTags(outfit.outfitTags)
    : base === unit?.portrait
      ? forgeExpressionText(unit?.outfitLine) || forgeExpressionTags(unit?.outfitTags)
      : "";
  const identity = forgeExpressionText(unit?.identityLine) || forgeExpressionTags(unit?.identityTags);
  const keep = "same character, same outfit, same pose, same framing, same background, same lighting";
  const prompt = tagged
    ? [forgeExpressionText(profile.positiveTags), identity, wearing, lookTags, keep].filter(Boolean).join(", ")
    : [
        `Edit the reference image of ${forgeExpressionText(unit?.name) || "this character"}: change ONLY the facial expression, to ${look}.`,
        "Keep everything else exactly as in the reference: the same character, face, hair, body, outfit, pose, framing, background, lighting and art style.",
        identity ? `Permanent features: ${identity}.` : "",
        wearing ? `Outfit: ${wearing}.` : "",
        forgeExpressionText(profile.styleText),
        forgeExpressionText(profile.positiveTags),
      ]
        .filter(Boolean)
        .join(" ");
  return { prompt, negativePrompt: negative };
}

export function createForgeStoryExpressions({
  documents,
  packageId,
  logger,
  readRun,
  images,
  connection,
  client,
  slot,
  dedupe,
  background,
  update,
  base: currentBase,
  galleryRef,
  debug = () => false,
  names = forgeStoryExpressionNames,
  looks = forgeExpressionLooks,
  localAvatarPath = forgeLocalAvatarPath,
  logPrefix = "[gacha-forge]",
  scopeName = "gacha-forge-expressions",
}) {
  // Created at activation, outside every request: a job never inherits a scene's Cancel scope, so a
  // story reset never waits on (or aborts the bookkeeping of) a paint that was already paid for.
  const detached = new ForgeStoryExpressionScope(scopeName);
  const live = new Map();
  let disposed = false;
  const galleryId = (ref) => (typeof ref === "string" && ref.startsWith("global-gallery:") ? ref.slice(15) : "");
  const remove = async (refs) => {
    for (const id of refs.map(galleryId).filter(Boolean)) {
      if (!(await client().deleteGalleryImage(id)))
        logger.warn(`${logPrefix} could not delete expression image %s`, id);
    }
  };
  const refsOf = (record) => [
    ...Object.values(record?.images && typeof record.images === "object" ? record.images : {}).map(
      (image) => image?.ref,
    ),
    ...(Array.isArray(record?.previousRefs) ? record.previousRefs : []),
    ...(record?.replacement ? refsOf(record.replacement) : []),
  ];
  const retryable = (run, record) => {
    const since = Date.parse(images(run).expressionsSince || "");
    return Number.isFinite(since) && since > (Date.parse(record.at || "") || 0);
  };
  // The persona's live base, the cast's own lookup: its Engine avatar, else the saved avatar path.
  const personaArt = async (run) => {
    const protagonist = run?.protagonist;
    let art = "";
    if (forgeExpressionText(protagonist?.personaId))
      try {
        art = await client().personaAvatar(protagonist.personaId);
      } catch {
        art = "";
      }
    return forgeExpressionText(art) || forgeExpressionText(protagonist?.avatarPath);
  };

  async function paintSet(runId, unitId, { paint, extra = [], personaBase, repaint = false, expectedBase, prompts }) {
    // A torn-down instance never writes set state: the next instance may already own the set.
    if (disposed) return;
    const run = await readRun(runId);
    if (!run || !forgeStoryExpressionsOn(images(run))) return;
    const doc = await documents.getById(packageId, unitId);
    const unit = doc?.data;
    if (!unit || unit.kind !== "character") return;
    const persona = unit.isProtagonist === true;
    const bases = forgeStoryExpressionBases(unit, extra);
    // Prune sets whose base no unit art uses any more. The document drops the refs before the gallery
    // delete, which Engine refuses while a document still references the image.
    if (Object.keys(unit.expressions || {}).some((key) => !bases.has(key))) {
      let stale = [];
      const pruned = await update(unitId, (next) => {
        // Re-checked on every revision retry: a base restored meanwhile keeps its set.
        const kept = forgeStoryExpressionBases(next, extra);
        stale = Object.entries(next.expressions || {}).filter(([key]) => !kept.has(key));
        next.expressions = { ...next.expressions };
        for (const [key] of stale) delete next.expressions[key];
      });
      if (pruned) await remove(stale.flatMap(([, record]) => refsOf(record)));
    }
    if (!paint) return;
    const base = persona ? personaBase : currentBase(unit);
    if (repaint && expectedBase !== base) return;
    const reference = localAvatarPath(base);
    if (!reference) return;
    const record = unit.expressions?.[base];
    if (!repaint && record?.state === "ready") return;
    if (!repaint && (record?.state === "failed" || record?.state === "pending") && !retryable(run, record)) {
      // The pending set may be the next instance's, written after this one was torn down.
      if (disposed) return;
      if (record.state === "pending")
        await update(unitId, (next) => {
          const current = next.expressions?.[base];
          if (current?.state === "pending")
            next.expressions = { ...next.expressions, [base]: { ...current, state: "failed", error: "interrupted" } };
        });
      return;
    }
    let target;
    try {
      target = await connection(run);
    } catch (error) {
      return void logger.warn(`${logPrefix} expression portraits for %s: %s`, unitId, error?.message || String(error));
    }
    if (!target) return;
    const source = await client().cardAvatarImage(reference);
    if (!source?.base64 || !/^image\//u.test(source.mime))
      return void logger.warn(`${logPrefix} expression portraits for %s: the base image could not be read`, unitId);
    const at = new Date().toISOString();
    const owned = (current) => current?.state === "pending" && current.at === at;
    const attemptOf = (next) => (repaint ? next.expressions?.[base]?.replacement : next.expressions?.[base]);
    const writeAttempt = (next, attempt) => {
      next.expressions = {
        ...next.expressions,
        [base]: repaint ? { state: "failed", at, ...next.expressions?.[base], replacement: attempt } : attempt,
      };
    };
    if (disposed) return;
    const started = await update(unitId, (next) => {
      const current = next.expressions?.[base];
      if (repaint && currentBase(next) !== base) return;
      const previousRefs = [
        ...(repaint || !Array.isArray(current?.previousRefs) ? [] : current.previousRefs),
        ...refsOf(current?.replacement),
      ].filter(Boolean);
      writeAttempt(next, {
        state: "pending",
        at,
        images: repaint ? {} : { ...current?.images },
        ...(previousRefs.length ? { previousRefs: [...new Set(previousRefs)] } : {}),
      });
    });
    if (!started || !owned(attemptOf(started))) return;
    const size = images(run);
    const width = size.portraitWidth;
    const height = persona ? size.portraitWidth : size.portraitHeight; // a persona avatar is usually square
    let error = "";
    for (const expression of names) {
      if (attemptOf(started).images[expression]?.url) continue;
      let result;
      try {
        result = await slot(target, async () => {
          // Re-read right before the paid call: the package, the setting, the images or the base may be
          // gone, and another instance may have taken the set over.
          if (disposed) return { stopped: true };
          const latest = await readRun(runId);
          if (!latest || !forgeStoryExpressionsOn(images(latest))) return { stopped: true };
          if (persona && (await personaArt(latest)) !== base) return { stale: true };
          // Read last, so ownership is checked on the newest copy of the set.
          const fresh = (await documents.getById(packageId, unitId))?.data;
          if (!fresh || !forgeStoryExpressionBases(fresh, extra).has(base)) return { stale: true };
          if (repaint && currentBase(fresh) !== base) return { stale: true };
          if (!owned(attemptOf(fresh))) return { stopped: true };
          // Teardown during the awaited reads above still stops this face before it is paid for.
          if (disposed) return { stopped: true };
          const image = await client().generateExpression({
            connectionId: target.id,
            name: unit.name,
            unit: fresh,
            base,
            expression,
            // The client builds the edit prompt from these looks (forgeStoryExpressionPrompt's looks option).
            looks,
            referenceImage: `data:${source.mime};base64,${source.base64}`,
            styleProfileId: images(latest).styleProfileId,
            width,
            height,
            debugMode: debug(),
            ...(prompts?.[expression] ? { edited: prompts[expression] } : {}),
          });
          if (!image.overrideTook)
            logger.warn(
              `${logPrefix} expression prompt override did NOT take for %s (%s); Engine compiled its own. Sent: %s`,
              unit.name,
              expression,
              image.sentPrompt,
            );
          logger[debug() ? "info" : "debug"](
            `${logPrefix} expression %s for %s prompt: %s`,
            expression,
            unitId,
            image.sentPrompt,
          );
          const saved = await client().uploadToGallery({
            image,
            name: `${unit.name} ${expression}`,
            prompt: image.prompt,
            provider: target.provider,
            model: target.model,
          });
          return { url: saved.url, ref: galleryRef(saved.id) };
        });
      } catch (failure) {
        error = failure?.message || String(failure);
        break;
      }
      if (result.stopped || result.stale) {
        error = result.stopped ? "stopped" : "stale";
        break;
      }
      const inUse = !persona || (await personaArt(await readRun(runId))) === base;
      let written;
      try {
        written = await update(unitId, (next) => {
          const current = attemptOf(next);
          if (!inUse || !owned(current) || !forgeStoryExpressionBases(next, extra).has(base)) return;
          if (repaint && currentBase(next) !== base) return;
          writeAttempt(next, {
            ...current,
            images: { ...current.images, [expression]: { url: result.url, ref: result.ref } },
          });
        });
      } finally {
        if (!written || attemptOf(written)?.images?.[expression]?.ref !== result.ref) await remove([result.ref]);
      }
      // The base was redrawn, the set taken over or the world deleted while this face painted: discard it.
      // Read from the written copy, so a revision retry that skipped filing never keeps an unfiled image.
      if (!written || attemptOf(written)?.images?.[expression]?.ref !== result.ref) {
        error = "stale";
        break;
      }
    }
    const stopped = error === "stopped" || error === "stale";
    if (error && !stopped) logger.warn(`${logPrefix} expression portraits failed for %s: %s`, unitId, error);
    const result = {
      state: error ? (stopped ? "stopped" : "failed") : "ready",
      at: new Date().toISOString(),
      ...(error && !stopped ? { error } : {}),
    };
    const finished = await update(unitId, (next) => {
      const current = attemptOf(next);
      if (!owned(current)) return;
      if (repaint && !error) {
        // ponytail: keep superseded originals until run deletion; prune them together with their cut-outs if storage
        // pressure warrants it. Earlier incomplete replacements stay tracked too.
        const previousRefs = [
          ...new Set(
            [...refsOf({ ...next.expressions[base], replacement: undefined }), ...(current.previousRefs || [])].filter(
              Boolean,
            ),
          ),
        ];
        next.expressions = { ...next.expressions, [base]: { ...current, ...result, previousRefs } };
      } else {
        writeAttempt(
          next,
          repaint
            ? { ...current, ...result }
            : error
              ? { ...current, state: stopped ? "stopped" : "failed", ...(stopped ? {} : { error }) }
              : { ...current, state: "ready", at: result.at },
        );
        if (repaint && next.expressions[base].state !== "ready") {
          next.expressions[base].state = "failed";
          next.expressions[base].at = result.at;
        }
      }
    });
    if (repaint && !error && finished?.expressions?.[base]?.at !== result.at) return { ...result, state: "stopped" };
    return result;
  }

  const schedule = (runId, unitId, options) => {
    const key = `${unitId}:expressions`;
    const promptsKey =
      options.prompts === undefined
        ? null
        : JSON.stringify(
            names.map((name) => [options.prompts[name]?.prompt ?? null, options.prompts[name]?.negativePrompt ?? null]),
          );
    const current = live.get(key);
    if (current)
      return options.repaint &&
        current.repaint &&
        current.base === options.expectedBase &&
        current.promptsKey === promptsKey
        ? current.promise
        : null;
    const promise = detached.runInAsyncScope(() =>
      background(() => dedupe(key, () => paintSet(runId, unitId, options)))
        .catch((error) =>
          logger.warn(`${logPrefix} expression portraits for %s stopped: %s`, unitId, error?.message || String(error)),
        )
        .finally(() => live.delete(key)),
    );
    live.set(key, { promise, repaint: options.repaint === true, base: options.expectedBase, promptsKey });
    return promise;
  };

  return {
    // Explicit paid replacement only; ordinary queue calls never replace an existing ready set.
    repaint(runId, unitId, base, prompts) {
      if (disposed) return null;
      return schedule(runId, unitId, { paint: true, repaint: true, expectedBase: base, prompts });
    },
    // Called with the cast a scene is served or written with. Returns that cast unchanged at once.
    queue(runId, run, cast, beat) {
      try {
        if (disposed || !forgeStoryExpressionsOn(images(run)) || !Array.isArray(cast)) return cast;
        const speakers = new Set(forgeStoryExpressionSpeakers(cast, beat));
        const persona = cast.find((character) => character?.prota);
        const personaExtra = [persona?.art, run?.protagonist?.avatarPath].filter(Boolean);
        const pass = async () => {
          const units = await documents.list(packageId, "unit");
          for (const doc of units) {
            const unit = doc?.data;
            if (typeof doc?.id !== "string" || !doc.id.startsWith(`${runId}:unit:`) || unit?.kind !== "character")
              continue;
            const isPersona = unit.isProtagonist === true;
            const speaking = isPersona
              ? !!persona?.art && speakers.has(persona)
              : [...speakers].some((character) => !character.prota && character.name === unit.name);
            const extra = isPersona ? personaExtra : [];
            const bases = forgeStoryExpressionBases(unit, extra);
            const stale = Object.keys(unit.expressions || {}).some((key) => !bases.has(key));
            const personaBase = isPersona ? persona?.art : "";
            const record = unit.expressions?.[isPersona ? personaBase : currentBase(unit)];
            const paint =
              speaking && record?.state !== "ready" && !(record?.state === "failed" && !retryable(run, record));
            if (stale || paint) schedule(runId, doc.id, { paint, extra, personaBase });
          }
        };
        detached.runInAsyncScope(() =>
          pass().catch((error) =>
            logger.warn(`${logPrefix} expression portraits not queued: %s`, error?.message || String(error)),
          ),
        );
      } catch (error) {
        logger.warn(`${logPrefix} expression portraits not queued: %s`, error?.message || String(error));
      }
      return cast;
    },
    // Package teardown: queued faces of this instance stop before their paid call.
    dispose() {
      disposed = true;
    },
  };
}
