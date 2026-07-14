const NOODLE_MENTION_PATTERN = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,40})(?![A-Za-z0-9_])/gu;
export function findNoodleTextMentions(text) {
    const mentions = [];
    for (const match of text.matchAll(NOODLE_MENTION_PATTERN)) {
        const prefix = match[1] ?? "";
        const handle = match[2];
        if (!handle || match.index === undefined)
            continue;
        const start = match.index + prefix.length;
        mentions.push({
            handle: handle.toLowerCase(),
            start,
            end: start + handle.length + 1,
        });
    }
    return mentions;
}
export function extractNoodleMentionHandles(text) {
    return Array.from(new Set(findNoodleTextMentions(text).map((mention) => mention.handle)));
}
export function noodleTextMentionsHandle(text, handle) {
    const normalizedHandle = handle.trim().replace(/^@+/u, "").toLowerCase();
    if (!text || !normalizedHandle)
        return false;
    return extractNoodleMentionHandles(text).includes(normalizedHandle);
}
//# sourceMappingURL=noodle-mentions.js.map