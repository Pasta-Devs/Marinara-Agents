export type SlurpPageCursor = { createdAt: string; id: string };
export function cursorQuery(cursor: SlurpPageCursor | null): string {
  return cursor ? `&cursorAt=${encodeURIComponent(cursor.createdAt)}&cursorId=${encodeURIComponent(cursor.id)}` : "";
}
