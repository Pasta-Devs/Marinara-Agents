/**
 * Only OpenAI GPT-5.6 connections get a strict JSON schema (see noodleResponseFormat), so every
 * other model answers free-form and routinely renames or wraps the fields. The wizard used to
 * fail the whole creator on `displayName`/`stagePersonality` missing, which is a rename, not a
 * refusal — so unwrap the common containers and accept the obvious aliases before validating.
 */
const DRAFT_FIELD_ALIASES: Record<string, readonly string[]> = {
  displayName: ["display_name", "name", "stageName", "stage_name", "profileName"],
  handle: ["username", "user_name", "stageHandle", "stage_handle", "screenName"],
  bio: ["biography", "description", "about", "tagline", "summary"],
  stagePersonality: ["stage_personality", "personality", "stageVoice", "stage_voice", "voice", "persona", "tone"],
};

function unwrapDraftCandidate(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(current)) {
      if (current.length !== 1) return current;
      current = current[0];
      continue;
    }
    if (!current || typeof current !== "object") return current;
    const record = current as Record<string, unknown>;
    if ("displayName" in record || "name" in record) return record;
    const wrapper = ["profile", "profiles", "stageProfile", "stage_profile", "draft", "result"].find(
      (key) => key in record,
    );
    if (!wrapper) return record;
    current = record[wrapper];
  }
  return current;
}

/**
 * Normalize a model's stage-profile answer into the field names the schema expects. Pure and
 * dependency-free so the regression suite can exercise it directly.
 */
export function normalizeNoodlerStageProfileDraft(value: unknown): Record<string, unknown> | null {
  const candidate = unwrapDraftCandidate(value);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const normalized = { ...(candidate as Record<string, unknown>) };
  for (const [field, aliases] of Object.entries(DRAFT_FIELD_ALIASES)) {
    if (typeof normalized[field] === "string" && normalized[field] !== "") continue;
    const alias = aliases.find((key) => typeof normalized[key] === "string" && normalized[key] !== "");
    if (alias) normalized[field] = normalized[alias];
  }
  if (typeof normalized.handle === "string") {
    normalized.handle = normalized.handle.replace(/^@+/, "");
  }
  // A missing handle is derivable; the name is the only field worth failing over.
  if (!normalized.handle && typeof normalized.displayName === "string") {
    normalized.handle = normalized.displayName
      .toLocaleLowerCase()
      .replace(/[^a-z0-9_]+/gu, "_")
      .slice(0, 24);
  }
  if (!normalized.bio) normalized.bio = "";
  if (!normalized.stagePersonality) normalized.stagePersonality = "";
  return normalized;
}
