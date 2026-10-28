const forgeMemoryDescriptor = Symbol("gacha-forge-memory-context");
const forgeMemoryPrompt = Symbol("gacha-forge-memory-prompt");

function renderForgeMemory(context, count, dropped = 0) {
  // A closing separator lets the last block of the prefix go like any other.
  let prefix = `${context.prefix}\n\n`;
  for (const block of context.optional.slice(0, dropped)) prefix = prefix.replace(`${block}\n\n`, "");
  return [
    context.renderMemory({ overview: context.overview, details: context.details.slice(0, count) }),
    prefix.slice(0, -2),
    context.fate,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function forgeMemoryContext(result, { prefix = "", fate = "", optional = [], renderMemory }) {
  const context = {
    [forgeMemoryDescriptor]: true,
    overview: result.overview || "",
    details: [...(result.details || [])],
    maxContext: result.maxContext,
    prefix,
    fate,
    optional,
    renderMemory,
  };
  return { ...context, text: renderForgeMemory(context, context.details.length) };
}

export function forgeComposeMemoryPrompt(builder, args) {
  const contexts = [];
  const visit = (value) => {
    if (value?.[forgeMemoryDescriptor]) {
      if (!contexts.includes(value)) contexts.push(value);
      return value.text;
    }
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) {
      const next = value.map(visit);
      return next.some((entry, index) => entry !== value[index]) ? next : value;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return value;
    const next = { ...value };
    let changed = false;
    for (const [key, entry] of Object.entries(value)) {
      next[key] = visit(entry);
      changed ||= next[key] !== entry;
    }
    return changed ? next : value;
  };
  const messages = builder(...args.map(visit));
  if (!contexts.length) return messages;
  if (!Array.isArray(messages) || !messages.length) throw new Error("memory-prompt-unavailable");
  return [
    {
      ...messages[0],
      [forgeMemoryPrompt]: contexts.map((context) => ({
        context,
        count: context.details.length,
        dropped: 0,
        text: context.text,
      })),
    },
    ...messages.slice(1),
  ];
}

export function fitForgeMemoryPrompt(
  messages,
  { maxContext, maxTokens, estimateMessages, safetyTokens = 512, minOutputTokens = 8192 },
) {
  const carrier = messages.findIndex((message) => message?.[forgeMemoryPrompt]);
  if (carrier < 0) return { messages, maxTokens, fits: true, droppedDetails: 0 };
  const states = messages[carrier][forgeMemoryPrompt].map((entry) => ({ ...entry }));
  const limits = [maxContext, ...states.map(({ context }) => context.maxContext)].filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  if (!limits.length) return { messages, maxTokens, fits: false, droppedDetails: 0, reason: "context-unknown" };
  const ceiling = Math.floor(Math.min(...limits));
  const reserve = Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : 0;
  let fitted = messages;
  let droppedDetails = 0;
  let droppedSummaries = 0;
  const shrink = (state, count, dropped) => {
    const matches = fitted.flatMap((message, index) => {
      if (typeof message.content !== "string" || !state.text) return [];
      const start = message.content.indexOf(state.text);
      return start < 0 ? [] : [{ index, start, duplicate: message.content.indexOf(state.text, start + 1) >= 0 }];
    });
    // Never rewrite a matching user-authored copy or a builder-transformed block.
    if (matches.length !== 1 || matches[0].duplicate) return false;
    const next = renderForgeMemory(state.context, count, dropped);
    const { index, start } = matches[0];
    fitted = fitted.map((message, at) =>
      at === index
        ? {
            ...message,
            content: message.content.slice(0, start) + next + message.content.slice(start + state.text.length),
          }
        : message,
    );
    Object.assign(state, { count, dropped, text: next });
    return true;
  };
  const ambiguous = { messages, maxTokens, fits: false, droppedDetails: 0, reason: "memory-context-ambiguous" };
  while (estimateMessages(fitted) + reserve + safetyTokens > ceiling) {
    const state = states.findLast((entry) => entry.count > 0);
    if (!state) break;
    if (!shrink(state, state.count - 1, state.dropped)) return ambiguous;
    droppedDetails += 1;
  }
  // Summaries standing in for an overview that is behind or set aside are canon, not recall: the oldest are left out
  // only while the writer would otherwise get less than the generation floor (_t's 8192), never the newest.
  const short = () => ceiling - safetyTokens - estimateMessages(fitted) < Math.min(minOutputTokens, reserve || 1);
  while (short()) {
    const state = states.find((entry) => entry.dropped < entry.context.optional.length);
    if (!state) break;
    // The fewest oldest blocks that restore the floor, found by halving: the estimate only falls as blocks go, so
    // a long legacy history costs a few re-estimates instead of one per block.
    const from = state.dropped;
    let low = from + 1,
      high = state.context.optional.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (!shrink(state, state.count, middle)) return ambiguous;
      if (short()) low = middle + 1;
      else high = middle;
    }
    if (state.dropped !== low && !shrink(state, state.count, low)) return ambiguous;
    droppedSummaries += low - from;
  }
  const remaining = Math.floor(ceiling - safetyTokens - estimateMessages(fitted));
  if (!(remaining > 0)) return { messages, maxTokens, fits: false, droppedDetails: 0, reason: "context-too-large" };
  if (fitted !== messages)
    fitted = fitted.map((message, index) =>
      index === carrier ? { ...message, [forgeMemoryPrompt]: states } : message,
    );
  return {
    messages: fitted,
    maxTokens: reserve ? Math.min(reserve, remaining) : maxTokens,
    fits: true,
    droppedDetails,
    droppedSummaries,
  };
}
