export type NoodlerPostSortKey = {
  createdAt: string;
  id: string;
};

/** Match the file-native store's deterministic createdAt DESC, id DESC ordering. */
export function compareNoodlerPostSortKeysDescending(left: NoodlerPostSortKey, right: NoodlerPostSortKey): number {
  const createdAt = right.createdAt.localeCompare(left.createdAt);
  return createdAt || right.id.localeCompare(left.id);
}

/** True when a row belongs strictly after this keyset cursor. */
export function isNoodlerPostAfterCursor(row: NoodlerPostSortKey, cursor: NoodlerPostSortKey): boolean {
  const createdAt = row.createdAt.localeCompare(cursor.createdAt);
  return createdAt < 0 || (createdAt === 0 && row.id.localeCompare(cursor.id) < 0);
}
