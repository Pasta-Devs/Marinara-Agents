const NPC_AVATAR_REVISION_PARAM = "mariAvatarRevision";
let npcAvatarRevision = 0;

function splitHash(value: string): { base: string; hash: string } {
  const hashIndex = value.indexOf("#");
  return hashIndex === -1
    ? { base: value, hash: "" }
    : { base: value.slice(0, hashIndex), hash: value.slice(hashIndex) };
}

export function withoutNpcAvatarRevision(value: string): string {
  const { base, hash } = splitHash(value);
  const [pathname, query = ""] = base.split("?", 2);
  const params = new URLSearchParams(query);
  params.delete(NPC_AVATAR_REVISION_PARAM);
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

export function isSameNpcAvatarResource(left: string, right: string): boolean {
  return withoutNpcAvatarRevision(left) === withoutNpcAvatarRevision(right);
}

/**
 * Force browsers to refetch an NPC portrait after the server replaces the
 * image at a stable path. The persisted resource identity remains intact.
 */
export function withFreshNpcAvatarRevision(value: string): string {
  const { base, hash } = splitHash(withoutNpcAvatarRevision(value));
  const separator = base.includes("?") ? "&" : "?";
  npcAvatarRevision += 1;
  return `${base}${separator}${NPC_AVATAR_REVISION_PARAM}=${Date.now()}-${npcAvatarRevision}${hash}`;
}
