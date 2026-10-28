/** A small, versioned envelope for handing story objects from one phone app to another. */
export interface PhoneLaunchIntent {
  version: 1;
  target?: string;
  draft?: string;
}

const MAX_TARGET_CHARS = 300;
const MAX_DRAFT_CHARS = 2_000;

export function encodeLaunchIntent(intent: Omit<PhoneLaunchIntent, "version">) {
  return JSON.stringify({ version: 1, ...intent } satisfies PhoneLaunchIntent);
}

/** Raw strings remain valid targets for older callers such as Contacts. */
export function decodeLaunchIntent(value: string): PhoneLaunchIntent {
  if (!value) return { version: 1 };
  if (!value.trimStart().startsWith("{")) return { version: 1, target: value.slice(0, MAX_TARGET_CHARS) };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.version !== 1) return { version: 1 };
    return {
      version: 1,
      ...(typeof parsed.target === "string" ? { target: parsed.target.slice(0, MAX_TARGET_CHARS) } : {}),
      ...(typeof parsed.draft === "string" ? { draft: parsed.draft.slice(0, MAX_DRAFT_CHARS) } : {}),
    };
  } catch {
    return { version: 1 };
  }
}
