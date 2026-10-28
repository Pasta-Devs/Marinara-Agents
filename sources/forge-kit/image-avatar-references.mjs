const forgeImageText = (value) => (typeof value === "string" ? value.trim() : "");

export function forgeImageActorName(value) {
  return forgeImageText(value).normalize("NFC").toLowerCase();
}

// A partial name is not an identity: Ann must never borrow Anna's face.
export function forgeMatchImageActor(cast, name) {
  const key = forgeImageActorName(name);
  if (!key) return null;
  const matches = cast.filter((actor) => forgeImageActorName(actor?.data?.name ?? actor?.name) === key);
  return matches.length === 1 ? matches[0] : null;
}

export function forgeIsImageProtagonist(protagonist, cast, name) {
  const key = forgeImageActorName(name);
  return (
    !!key &&
    forgeImageActorName(protagonist?.name) === key &&
    !cast.some((actor) => forgeImageActorName(actor?.data?.name ?? actor?.name) === key)
  );
}

export function forgeLocalAvatarPath(value) {
  const path = forgeImageText(value);
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return "";
  }
  if (
    /[\\%?#]/u.test(decoded) ||
    [...decoded].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    decoded.split("/").some((part) => part === "." || part === "..")
  )
    return "";
  return /^\/api\/(?:avatars\/file\/[^/]+|global-gallery\/file\/[^/]+|characters\/(?:personas\/)?[^/]+\/gallery\/file\/[^/]+)$/u.test(
    decoded,
  )
    ? path
    : "";
}

// The Engine's avatar-generation route keeps the first four references (characters.routes.ts), and a provider
// may keep fewer: for example xAI and NanoGPT three; Stability, Together, Atlas Cloud, Automatic1111 and
// OpenRouter's image models other than GPT Image only the first; NovelAI models other than V4.5 none.
// ponytail: the package cannot see a connection's own limit, so it orders for the narrowest one (faces first);
// read the limit from the Engine once it exposes one per connection.
const FORGE_IMAGE_REFERENCES_MAX = 4;

// The outfit a subject has on. The caller keeps wornOutfit only on a subject its prompt dresses in that outfit and
// leaves it out when the picture paints other clothes, so the reference never contradicts the prompt.
function forgeWornOutfitPath(unit) {
  const id = forgeImageText(unit.wornOutfit);
  return id && Array.isArray(unit.outfits)
    ? unit.outfits.find((item) => forgeImageText(item?.id) === id)?.url
    : undefined;
}

async function forgeReferenceImage(client, paths) {
  for (const path of new Set(paths.map(forgeLocalAvatarPath).filter(Boolean))) {
    const image = await client.cardAvatarImage(path);
    if (image?.base64 && /^image\//u.test(image.mime)) return `data:${image.mime};base64,${image.base64}`;
  }
  return null;
}

// Who the subject is: never the outfit they have on, which would follow them into a new look or outfit.
async function forgeSubjectReference(client, unit) {
  const paths = [];
  // Only IDs already carried by the actual selected card/persona are used. Never
  // infer a card from a model-written name or attach a style profile's subject.
  try {
    if (forgeImageText(unit.cardId)) paths.push((await client.characterCard(unit.cardId))?.avatarPath);
    else if (forgeImageText(unit.personaId)) paths.push(await client.personaAvatar(unit.personaId));
  } catch {
    // A removed card must not break generation; try this same unit's saved art.
  }
  return forgeReferenceImage(client, [...paths, unit.portrait, unit.avatarPath]);
}

export function forgeWrapImageReferenceClient(client, logger, { logPrefix = "[gacha-forge]" } = {}) {
  for (const method of ["generateBannerArt", "generatePortrait", "generateOutfit"]) {
    const generate = client[method];
    // Only a scene or banner shows the subject in the outfit they have on; a base look or a new outfit paints them anew.
    const scene = method === "generateBannerArt";
    client[method] = async function (options) {
      const subjects = (scene ? (options.units ?? []) : [options.unit]).filter(
        (unit) => unit && typeof unit === "object" && unit.kind !== "weapon",
      );
      const identities = [],
        outfits = [];
      for (const subject of subjects) {
        const identity = await forgeSubjectReference(client, subject);
        if (identity) identities.push(identity);
        const outfit = scene && forgeWornOutfitPath(subject);
        if (outfit) {
          const image = await forgeReferenceImage(client, [outfit]);
          if (image) outfits.push(image);
        }
      }
      // Every subject's face before any outfit, so a provider that keeps fewer references still knows who is who.
      const distinct = [...new Set([...identities, ...outfits])];
      const references = distinct.slice(0, FORGE_IMAGE_REFERENCES_MAX);
      if (subjects.length) {
        const level = identities.length === subjects.length ? "debug" : "warn";
        logger?.[level]?.(
          `${logPrefix} %s: identity references resolved for %d/%d subjects, %d worn outfit(s); sending %d distinct of at most %d (a provider may keep fewer)`,
          method,
          identities.length,
          subjects.length,
          outfits.length,
          references.length,
          FORGE_IMAGE_REFERENCES_MAX,
        );
      }
      const left = distinct.slice(FORGE_IMAGE_REFERENCES_MAX);
      if (left.length) {
        const faces = left.filter((reference) => identities.includes(reference)).length;
        logger?.warn?.(
          `${logPrefix} %s: left out %d identity and %d worn outfit reference(s) past the Engine's limit of %d`,
          method,
          faces,
          left.length - faces,
          FORGE_IMAGE_REFERENCES_MAX,
        );
      }
      return generate.call(this, { ...options, referenceImages: references.length ? references : undefined });
    };
  }
  return client;
}
