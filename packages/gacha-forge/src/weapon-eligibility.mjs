// Signature identity is shared by equipment eligibility and the granted skill.
export function forgeWeaponIsForCharacter(weapon, character, characterId) {
  if (weapon?.kind !== "weapon" || !character) return false;
  const ownerId = String(weapon.dedicatedToId || "").trim();
  if (ownerId) return ownerId === String(characterId || "").trim();
  const ownerName = String(weapon.dedicatedTo || "")
    .trim()
    .toLowerCase();
  return Boolean(
    ownerName &&
    ownerName ===
      String(character.name || "")
        .trim()
        .toLowerCase(),
  );
}
