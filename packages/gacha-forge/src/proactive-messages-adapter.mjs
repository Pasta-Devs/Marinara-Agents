/* global forgeProactiveMessages:writable, createForgeProactiveMessages, n, r, Os, gr, Ea, withForgeChatSend, forgeDayKey, forgeResetIn, forgeHydrateStoryCharacters, Le, Ti, K0, ss, _r, Nr, l, $g, go, Hp, Ei, forgeComposeMemoryPrompt, forgeProactiveChatMessages, cv, _t, It, ov, s, forgeStoryCancellation */
forgeProactiveMessages = createForgeProactiveMessages({
  packageId: n.id,
  persistence: r.persistence,
  isUnlocked: (unit, own) => Os(unit) && gr(own.bondFights) >= Ea,
  withChatSend: withForgeChatSend,
  dayKey: forgeDayKey,
  resetIn: forgeResetIn,
  readContext: async ({ runId, run, session, unitId, unit, chat, signal }) => {
    signal.throwIfAborted();
    const hydrated = (await forgeHydrateStoryCharacters([unit], (id) => Le().characterCard(id), r.logger))[0];
    signal.throwIfAborted();
    const history = (Array.isArray(chat.messages) ? chat.messages : []).slice(Ti(chat)).slice(-K0);
    const channel = ss(run, session) || "";
    const context = await _r(runId, (await Nr(runId)) + 1, 0, {
      query: [l(unit.name), l(history.at(-1)?.text)].filter(Boolean).join(" "),
      job: "chat",
      current: true,
    });
    signal.throwIfAborted();
    const story = context.length > $g ? context.slice(-$g) : context;
    const fields = {
      unit: hydrated,
      scenario: l(run.scenario),
      channel: go(channel),
      channelBlurb: Hp(channel),
      protagonist: run.protagonist,
      bond: gr(session.roster?.[unitId]?.bondFights),
      story,
      history,
      memories: await Ei(runId, { only: [l(unit.name)] }),
      photos: false,
      asked: false,
    };
    signal.throwIfAborted();
    return {
      cardCanon: hydrated?.forgeCardCanon || null,
      messages: forgeComposeMemoryPrompt(forgeProactiveChatMessages, [cv, fields]),
    };
  },
  contextStillCurrent: async ({ unit, context, signal }) => {
    signal.throwIfAborted();
    const hydrated = (await forgeHydrateStoryCharacters([unit], (id) => Le().characterCard(id), r.logger))[0];
    signal.throwIfAborted();
    return JSON.stringify(hydrated?.forgeCardCanon || null) === JSON.stringify(context.cardCanon);
  },
  generate: async ({ runId, run, unit, messages, debugMode, signal }) => {
    const name = l(unit.name);
    return _t({
      runtime: r,
      runId,
      run,
      job: "chat",
      label: `proactive-chat ${name}`,
      messages,
      options: { temperature: 0.95, maxTokens: It(700), debugMode, signal },
      parse: (answer) => {
        let text = l(answer).trim(),
          prefix = name + ":";
        if (name && text.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase())
          text = text.slice(prefix.length).trim();
        text = l(ov(text).text).trim();
        return text ? { value: text } : { error: "empty-answer" };
      },
    });
  },
});

// Register on the already-forgeTimeZoneRoutes-wrapped `s`, not the raw router.
// Story admission also fences chapter reset/cancel and joins actual provider work.
s.post("/chat/proactive/due", (request) => {
  const body = request?.body || {};
  return forgeStoryCancellation.run(l(body.runId), () => forgeProactiveMessages.due(body));
});
