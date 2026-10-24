// Choice graphs stay beside the beat they belong to. The graph is reusable during replay;
// only the first-play selection map belongs to the story's permanent continuity.
export function forgeChoicesEnabled(run) {
  return run?.story?.choices !== false;
}

export function forgeChoicePlanMessages(messages, enabled) {
  if (!enabled) return messages;
  const result = messages.map((message) => ({ ...message }));
  result[0].content += `

PLAYER AGENCY: the narrator may offer short, reconverging protagonist dialogue/action choices within a story beat. Plan a common plot that allows those local variations. The FINAL story beat MAY optionally end just BEFORE one lasting protagonist decision (who to help, sacrifice, romance, or where to go next). When the story earns such a decision, its final guide must leave that decision and its outcome OPEN for the player, instead of deciding their fate for them. Never require a later node in this chapter after that decision. A lasting choice is optional, at most one per chapter. Every player choice explicitly recorded in the story so far is settled canon; never undo or replay it.`;
  return result;
}

export function forgeChoiceMessages(messages, { enabled, terminal }) {
  if (!enabled) return messages;
  const result = messages.map((message) => ({ ...message }));
  result[0].content = result[0].content.replace(
    "NEVER offer choices; the player only advances. Do not ask the player to pick anything.",
    "The player may choose their own dialogue or actions at the choice points described below.",
  );
  result[0].content += `

PLAYER CHOICES (extend the JSON shape above with an optional "choices" array):
- Offer choices where the scene earns them, not a choice on every line. Use at most three choice points in this beat.
- Each choice has exactly 2, 3 or 4 distinct options. Each option's text is a short intent label or paraphrase, such as "Apologize", "Say that you trust them" or "Pull your hoodie up". For dialogue, NEVER use the exact spoken line as the button label. Do not forecast a result.
- Shape: "choices":[{"kind":"small","at":0,"options":[{"text":"Apologize","selection":{"kind":"dialogue","text":"I am sorry I kept you waiting."},"segments":[{"speaker":"","text":"...","place":"..."}]},{"text":"Pull your hoodie up","selection":{"kind":"action","text":"You pull your hoodie up against the cold."},"segments":[...]}]}].
- Every option has one "selection": {"kind":"dialogue"|"action","text":"..."}. It is the beat performed AFTER the player chooses. Use "dialogue" only for the protagonist's actual spoken words. Use "action" for physical actions, decisions or nonverbal responses; write these as narration in the story's normal voice, NEVER as spoken dialogue. Do not assign a character speaker to an action.
- "at" is the ZERO-BASED index of the MAINLINE segment after which the options appear. Never put two choices at the same index.
- A SMALL choice has kind "small". Generate ALL its alternative paths together in this one response: 1 to 8 short segments in EVERY option, in the same segment format as the mainline. Do not merely describe what you would write later.
- After the chosen option and its branch, the story returns to the next mainline segment. Every branch MUST arrive at that same continuation naturally; its local dialogue or route may differ, but it may not change the chapter's required plot, future fights, or settled fate.
- The selection text is the protagonist's performed line/action, separate from the button label. Do not repeat it as the first branch segment. Do not place unselected alternatives in mainline prose. Do not nest choices inside branches.
- All branch places must also be listed in "places"; use no more than four places across the mainline and ALL alternatives combined.
- Mainline and branches together must remain concise. Both the intent label and selection text are at most 280 characters each.
${
  terminal
    ? '- This is the LAST story beat of the chapter. You MAY end it with ONE BIG choice instead of a settled ending when there is a meaningful lasting decision. A big choice has kind "big", must be attached to the VERY LAST mainline segment, and offers 2–4 protagonist dialogue/action intents with their performed "selection" and EMPTY "segments" arrays. The selection contains only the chosen words/action, NEVER its consequences or another character response. STOP before the decision or any result of it. Generate NOTHING after this choice: not an outcome, an epilogue, or a guessed selection. The next chapter will be generated only after the player commits. A big choice is optional, never compulsory.'
    : "- This is NOT the last story beat. NEVER produce a big choice or a lasting decision that requires the player to determine the following plot. Only small, reconverging choices are allowed here."
}
- Omit "choices" or use [] when this beat has no appropriate choice. IDs are assigned by the game; do not invent them.`;
  return result;
}

export function forgeNormalizeChoiceBeat(raw, options, normalizeBeat, { enabled, terminal }) {
  const beat = normalizeBeat(raw, options);
  if (!beat || !enabled || raw?.choices == null) return beat;
  if (!Array.isArray(raw.choices) || raw.choices.length > 3) return null;
  if (raw.choices.length && beat.segments.length !== raw.segments.length) return null;
  const choices = [];
  const positions = new Set();
  const places = new Map(beat.places.map((place) => [place.name, place]));
  let big = false;
  for (const [index, choice] of raw.choices.entries()) {
    if (!choice || !["small", "big"].includes(choice.kind)) return null;
    if (!Number.isInteger(choice.at) || choice.at < 0 || choice.at >= beat.segments.length) return null;
    if (positions.has(choice.at)) return null;
    positions.add(choice.at);
    if (!Array.isArray(choice.options) || choice.options.length < 2 || choice.options.length > 4) return null;
    if (choice.kind === "big") {
      if (big || !terminal || choice.at !== beat.segments.length - 1) return null;
      big = true;
    }
    const labels = new Set();
    const selections = new Set();
    const normalizedOptions = [];
    for (const [optionIndex, option] of choice.options.entries()) {
      const text = typeof option?.text === "string" ? option.text.trim() : "";
      if (!text || text.length > 280 || labels.has(text)) return null;
      labels.add(text);
      const selection = option.selection;
      const selectedText = typeof selection?.text === "string" ? selection.text.trim() : "";
      if (!selection || !["dialogue", "action"].includes(selection.kind) || !selectedText || selectedText.length > 280)
        return null;
      if (selection.kind === "dialogue" && selectedText === text) return null;
      const selectionKey = `${selection.kind}:${selectedText}`;
      if (selections.has(selectionKey)) return null;
      selections.add(selectionKey);
      if (!Array.isArray(option.segments)) return null;
      if (choice.kind === "big" && option.segments.length) return null;
      if (choice.kind === "small" && (!option.segments.length || option.segments.length > 8)) return null;
      if (option.segments.some((segment) => !segment || segment.choices != null || segment.choice != null)) return null;
      const branch =
        choice.kind === "small"
          ? normalizeBeat(
              { segments: option.segments, places: raw.places },
              { ...options, start: beat.segments[choice.at].place || options.start, cgOpen: false },
            )
          : { segments: [], places: [] };
      if (!branch || branch.segments.length !== option.segments.length) return null;
      for (const place of branch.places) places.set(place.name, place);
      normalizedOptions.push({
        id: `option-${optionIndex + 1}`,
        text,
        selection: { kind: selection.kind, text: selectedText },
        segments: branch.segments,
      });
    }
    choices.push({ id: `choice-${index + 1}`, kind: choice.kind, at: choice.at, options: normalizedOptions });
  }
  if (places.size > 4) return null;
  choices.sort((left, right) => left.at - right.at);
  return { ...beat, places: [...places.values()], choices };
}

export function forgeChoiceResponse(data) {
  return { choices: data?.choices || [], choiceCanon: { ...data?.choiceCanon } };
}

export function forgePendingChoice(data) {
  return (data?.choices || []).find(
    (choice) => !choice.options.some((option) => option.id === data.choiceCanon?.[choice.id]),
  );
}

export function forgeCanonicalSegments(data) {
  if (!Array.isArray(data?.segments)) return null;
  if (forgePendingChoice(data)) return null;
  const result = [];
  for (const [index, segment] of data.segments.entries()) {
    result.push(segment);
    for (const choice of data.choices || []) {
      if (choice.at !== index) continue;
      const selected = choice.options.find((option) => option.id === data.choiceCanon[choice.id]);
      result.push({
        speaker: "",
        text: `[Canonical player choice${data.choiceProtagonist ? ` by ${data.choiceProtagonist}` : ""}: ${selected.text}]`,
        ...(segment.place ? { place: segment.place } : {}),
      });
      if (selected.selection) {
        result.push({
          speaker: selected.selection.kind === "dialogue" ? data.choiceProtagonist || "" : "",
          text: selected.selection.text,
          ...(segment.place ? { place: segment.place } : {}),
        });
      }
      result.push(...selected.segments);
    }
  }
  return result;
}

export function forgeCreateChoiceRuntime({
  documents,
  packageId,
  readSession,
  beatId,
  planId,
  storyNodes,
  allNodes,
  bondHistory,
  readRun,
  resolveChapter,
}) {
  const generationQueues = new Map();

  function generate(runId, work) {
    const previous = generationQueues.get(runId) || Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    generationQueues.set(runId, current);
    return current.finally(() => {
      if (generationQueues.get(runId) === current) generationQueues.delete(runId);
    });
  }

  async function readOrGenerate(runId, work) {
    const cached = await work(true);
    return cached === null ? generate(runId, () => work(false)) : cached;
  }

  async function completed(runId, chapter, storyIndex, plan) {
    const { data: session } = await readSession(runId);
    if (plan?.bondUnitId) {
      const suffix = Number(plan.bondPart) > 1 ? String(plan.bondPart) : "";
      return Number(session?.bondChapters?.[plan.bondUnitId]?.[`beats${suffix}`] || 0) > storyIndex;
    }
    const node = storyNodes(plan)[storyIndex];
    const nodeIndex = allNodes(plan).indexOf(node);
    return nodeIndex >= 0 && Number(session?.progress?.[String(chapter)]?.normal || 0) > nodeIndex;
  }

  async function active(runId, chapter, storyIndex, plan) {
    const { data: session } = await readSession(runId);
    if (plan?.bondUnitId) {
      const suffix = Number(plan.bondPart) > 1 ? String(plan.bondPart) : "";
      return Number(session?.bondChapters?.[plan.bondUnitId]?.[`beats${suffix}`] || 0) === storyIndex;
    }
    const nodeIndex = allNodes(plan).indexOf(storyNodes(plan)[storyIndex]);
    return nodeIndex >= 0 && Number(session?.progress?.[String(chapter)]?.normal || 0) === nodeIndex;
  }

  async function pending(runId, { beforeChapter, chapter, throughStoryIndex } = {}) {
    const prefix = `${runId}:beat:`;
    const rows = await documents.list(packageId, "beat");
    for (const row of rows) {
      if (!row?.id?.startsWith(prefix) || !row.data) continue;
      const data = row.data;
      if (beforeChapter != null) {
        const numeric = Number(data.chapter);
        if (Number.isInteger(numeric)) {
          if (numeric >= beforeChapter) continue;
        } else {
          const plan = await documents.getById(packageId, planId(runId, data.chapter));
          if (!plan?.data || Number(plan.data.after) >= beforeChapter) continue;
        }
      }
      if (chapter != null && String(data.chapter) !== String(chapter)) continue;
      if (throughStoryIndex != null && Number(data.storyIndex) > throughStoryIndex) continue;
      const choice = forgePendingChoice(data);
      if (choice) return { chapter: data.chapter, storyIndex: data.storyIndex, choiceId: choice.id };
    }
    return null;
  }

  async function guard(runId, filter) {
    const waiting = await pending(runId, filter);
    return waiting ? { ok: false, error: "choice-required", ...waiting } : null;
  }

  async function planGuard(runId, chapter) {
    const waiting = await guard(runId, { beforeChapter: chapter });
    if (waiting || chapter <= 1) return waiting;
    const previous = await documents.getById(packageId, planId(runId, chapter - 1));
    const { data: session } = await readSession(runId);
    const required = allNodes(previous?.data).length;
    return !required || Number(session?.progress?.[String(chapter - 1)]?.normal || 0) < required
      ? { ok: false, error: "chapter-locked" }
      : null;
  }

  async function continuity(runId, chapter, storyIndex) {
    const numericTarget = Number.isInteger(chapter);
    const target = numericTarget ? null : await documents.getById(packageId, planId(runId, chapter));
    const targetAfter = Number(target?.data?.after) || 0;
    const { data: session } = await readSession(runId);
    const bondOrder = new Map(
      bondHistory(session).map((entry, index) => [
        resolveChapter({ runId, unitId: entry.unitId, part: entry.part }),
        index,
      ]),
    );
    const prefix = `${runId}:beat:`;
    const entries = [];
    for (const row of await documents.list(packageId, "beat")) {
      if (typeof row?.id !== "string" || !row.id.startsWith(prefix) || !row.data) continue;
      const data = row.data;
      const decisions = (data.choices || []).filter((choice) => choice.kind === "big");
      if (!decisions.length) continue;
      const numeric = Number.isInteger(data.chapter);
      const plan = numeric ? null : await documents.getById(packageId, planId(runId, data.chapter));
      const after = Number(plan?.data?.after) || 0;
      let earlier;
      if (String(data.chapter) === String(chapter)) {
        earlier = Number(data.storyIndex) < storyIndex;
      } else if (numericTarget) {
        earlier = numeric ? data.chapter < chapter : after < chapter;
      } else if (numeric) {
        earlier = data.chapter <= targetAfter;
      } else {
        const previousBond =
          bondOrder.has(data.chapter) && bondOrder.has(chapter)
            ? bondOrder.get(data.chapter) < bondOrder.get(chapter)
            : String(plan?.createdAt || "") < String(target?.createdAt || "");
        earlier = after < targetAfter || (after === targetAfter && previousBond);
      }
      if (!earlier) continue;
      for (const choice of decisions) {
        const selected = choice.options.find((option) => option.id === data.choiceCanon?.[choice.id]);
        if (!selected) continue;
        const identity = numeric
          ? `Chapter ${data.chapter}`
          : `Character Story ${data.chapter}: ${plan?.data?.title || "Untitled"}`;
        entries.push({
          order: numeric ? data.chapter : after + 0.5,
          created: numeric ? "" : String(plan?.createdAt || ""),
          bondOrder: numeric ? -1 : (bondOrder.get(data.chapter) ?? Number.MAX_SAFE_INTEGER),
          id: row.id,
          text: `${identity}, story beat ${Number(data.storyIndex) + 1}: ${selected.text}${selected.selection ? ` (${selected.selection.kind}: ${selected.selection.text})` : ""}`,
        });
      }
    }
    entries.sort(
      (left, right) =>
        left.order - right.order ||
        left.bondOrder - right.bondOrder ||
        left.created.localeCompare(right.created) ||
        left.id.localeCompare(right.id),
    );
    return entries.length
      ? `# Irrevocable player decisions (saved canon; preserve these even when a summary omits them)\n${entries.map((entry) => `- ${entry.text}`).join("\n")}`
      : "";
  }

  async function completeGuard(runId, chapter, { nodeIndex, storyIndex } = {}) {
    const plan = await documents.getById(packageId, planId(runId, chapter));
    if (!plan?.data) return { ok: false, error: "plan-missing" };
    const nodes = allNodes(plan.data);
    const stories = storyNodes(plan.data);
    const node = storyIndex == null ? nodes[nodeIndex] : stories[storyIndex];
    if (!node) return { ok: false, error: "bad-request" };
    const through =
      node.type === "story"
        ? stories.indexOf(node)
        : nodes.slice(0, nodeIndex).filter((entry) => entry.type === "story").length - 1;
    if (node.type === "story") {
      const beat = await documents.getById(packageId, beatId(runId, chapter, through));
      if (!Array.isArray(beat?.data?.segments)) return { ok: false, error: "beat-missing" };
    }
    return guard(runId, { chapter, throughStoryIndex: through });
  }

  async function select(body) {
    const runId = typeof body?.runId === "string" ? body.runId : "";
    const chapter = resolveChapter(body);
    const storyIndex = Number(body?.storyIndex);
    const choiceId = typeof body?.choiceId === "string" ? body.choiceId : "";
    const optionId = typeof body?.optionId === "string" ? body.optionId : "";
    if (!runId || chapter == null || !Number.isInteger(storyIndex) || storyIndex < 0 || !choiceId || !optionId) {
      return { ok: false, error: "bad-request" };
    }
    if (!(await readRun(runId))) return { ok: false, error: "not-found" };
    const plan = await documents.getById(packageId, planId(runId, chapter));
    if (!plan?.data || !storyNodes(plan.data)[storyIndex]) return { ok: false, error: "bad-request" };
    const closed = await completed(runId, chapter, storyIndex, plan.data);
    const id = beatId(runId, chapter, storyIndex);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const doc = await documents.getById(packageId, id);
      const data = doc?.data;
      const choice = data?.choices?.find((entry) => entry.id === choiceId);
      if (!choice || !choice.options.some((option) => option.id === optionId))
        return { ok: false, error: "choice-not-found" };
      const canon = { ...data.choiceCanon };
      const chosen = canon[choiceId];
      if (chosen) {
        if (choice.kind === "big" && chosen !== optionId)
          return { ok: false, error: "choice-locked", choiceCanon: canon };
        const selected = choice.kind === "small" && closed && body.replay === true ? optionId : chosen;
        return { ok: true, choiceId, optionId: selected, choiceCanon: canon, canonical: selected === chosen };
      }
      if (closed) {
        return choice.kind === "big"
          ? { ok: false, error: "choice-locked", choiceCanon: canon }
          : { ok: true, choiceId, optionId, choiceCanon: canon, canonical: false };
      }
      if (!(await active(runId, chapter, storyIndex, plan.data))) return { ok: false, error: "choice-unavailable" };
      // Only the first unresolved choice can be committed. A forged request cannot skip
      // an earlier decision and use a later branch to influence future generation.
      if (forgePendingChoice(data)?.id !== choiceId) return { ok: false, error: "choice-required" };
      canon[choiceId] = optionId;
      const saved = await documents.update({
        id,
        packageId,
        expectedRevision: doc.revision,
        name: doc.name,
        description: doc.description,
        data: { ...data, choiceCanon: canon },
        updatedAt: new Date().toISOString(),
      });
      if (saved) return { ok: true, choiceId, optionId, choiceCanon: canon, canonical: true };
    }
    return { ok: false, error: "write-conflict" };
  }

  return { completed, pending, guard, planGuard, continuity, completeGuard, select, generate, readOrGenerate };
}
