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

function forgeSavedPortraits(unit) {
  const outfit = Array.isArray(unit.outfits) && unit.outfits.find((item) => item?.id === unit.wornOutfit);
  return [outfit?.url, unit.portrait, unit.avatarPath];
}

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
  paths.push(...forgeSavedPortraits(unit));
  for (const path of new Set(paths.map(forgeLocalAvatarPath).filter(Boolean))) {
    const image = await client.cardAvatarImage(path);
    if (image?.base64 && /^image\//u.test(image.mime)) return `data:${image.mime};base64,${image.base64}`;
  }
  return null;
}

export function forgeWrapImageReferenceClient(client, logger) {
  for (const method of ["generateBannerArt", "generatePortrait", "generateOutfit"]) {
    const generate = client[method];
    client[method] = async function (options) {
      const subjects = (method === "generateBannerArt" ? (options.units ?? []) : [options.unit]).filter(
        (unit) => unit && typeof unit === "object" && unit.kind !== "weapon",
      );
      const references = [];
      let resolved = 0;
      for (const subject of subjects) {
        const reference = await forgeSubjectReference(client, subject);
        if (!reference) continue;
        resolved += 1;
        if (!references.includes(reference)) references.push(reference);
      }
      if (subjects.length) {
        const level = resolved === subjects.length ? "debug" : "warn";
        logger?.[level]?.(
          "[gacha-forge] %s: avatar references resolved for %d/%d subjects (%d distinct); Engine/provider reference limits still apply",
          method,
          resolved,
          subjects.length,
          references.length,
        );
      }
      return generate.call(this, { ...options, referenceImages: references.length ? references : undefined });
    };
  }
  return client;
}
