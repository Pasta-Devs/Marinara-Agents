// ── The GM's event verbs, consumed (Capability API 1.16) ─────────────────────
// The engine scans the finished narration for the tags THIS package declares in
// `gm-verbs.json`, validates their arguments against that same table, strips
// them out of the prose, and delivers each one as a single SSE frame the client
// re-dispatches as one synchronous DOM event. An EVENT verb writes nothing
// engine-side before it gets here — which is what makes a refusal below BINDING
// rather than advisory, and it is the one thing this half has that the state
// half (the weather row, written to chat metadata) does not.
//
// THE SIX WAYS A DELIVERY IS LOST, stated once because none of them is a bug
// waiting to be found. FIVE ARE THE CHANNEL'S: an aborted turn (the stream is
// already gone), a tab reloaded or closed mid-stream, a dispatch that lands
// before this package's first mount of the page's life (the listener binds in
// `_bindKeys`), a chat the player has switched away from (that listener's own
// chatId guard), and the loading gate (`_live` refuses every mutator while it
// holds, 58-player).
//
// THE SIXTH IS THIS FILE'S OWN BELT, and it is the one that is not obvious: the
// engine RE-PACKS swipe indices when a swipe is deleted (`removeSwipe` slides
// every higher swipe down one; `addSwipe` mints `existing.length`). So DELETE A
// SWIPE, THEN REGENERATE and the new turn arrives under an index the dedupe set
// below already holds, and this file drops it. It costs ONE UPDATE: silent, and
// self-healing on the very next verb, because what is dropped is an absolute row
// rather than an increment. Nothing re-delivers any of the six, and the only
// trace a lost one leaves is a server-side warning the player never sees.
//
// WHY THAT IS SURVIVABLE, and it is NOT the dedupe set below: `standing` writes
// ABSOLUTE fields. `bump`'s `d` is a clamped set, `h` is a set-or-delete, `s` is
// a clipped set, and an explicit `t: 0` adds nothing (58-player). Applying one
// delivery twice writes the same row twice. Regenerating the turn ORDINARILY
// mints a fresh swipe under a NEW key, so the newest narration's standing simply
// overwrites the previous one — self-healing, where a relative verb ("+25 coins")
// would compound once per re-roll. That is why the first event verb is an
// absolute one, and why a relative verb cannot live on this channel at all: the
// sixth loss costs an absolute verb one stale row until the next delivery, and
// would cost a relative one a total that is permanently short.

/** The `npc` argument's declared `maxLength` in `gm-verbs.json`. Re-stated here
 *  because the engine's validation of a string argument is SHAPE-ONLY and the
 *  package's own check is the load-bearing one: the refusal below puts the GM's
 *  spelling on a player-visible surface, and a surface does not take a name it
 *  did not measure on trust. */
const GM_NPC_CHARS = 40;

/** How many deliveries the session remembers. A session that reaches this has
 *  regenerated well past the keys being dropped, and re-admitting one writes the
 *  same absolute row again — so the cap costs nothing that was not already free. */
const GM_SEEN_CAP = 64;

PF.gm = {
  /** The deliveries this session has already taken, keyed on the engine's own
   *  `chatId:messageId:swipeIndex` triple plus the verb name — the same triple
   *  the executor stamps its provenance claim with, so both halves agree about
   *  what one delivery is.
   *
   *  SESSION-SCOPED ON PURPOSE, and not a saved field: persisting it would mean
   *  opening the closed `PLAYER_KEYS` allowlist, `serialize()` and the load-time
   *  completeness assertion (58-player, 60-save) to buy a guarantee nothing
   *  needs — this channel has no replay, and a reload drops every undelivered
   *  event anyway. It is a belt. The mechanism is that the write is absolute.
   *
   *  NEITHER A CHAT SWITCH NOR A REWIND CLEARS IT, and neither needs to: the
   *  `chatId` rides the key, so the same messageId in a second chat is a distinct
   *  key and applies; and `_rebuild` replaces the player block wholesale while
   *  this Set survives it, so a same-triple re-delivery after a rewind is dropped
   *  — unreachable on its own, since nothing replays, and the same mechanism as
   *  the sixth loss above. */
  _seen: new Set(),

  /** Capability API 1.16 events, addressed to this package by the host. The
   *  element's window listener has already matched packageId and chatId — the
   *  same contract `PF.spatial.onHostEvent` documents one file over. */
  onVerb(core, detail) {
    const data = detail.data && typeof detail.data === "object" ? detail.data : {};
    const verb = String(data.verb ?? "");
    // THE DEDUPE TRIPLE, and it guards REDELIVERY — which this channel cannot do
    // — rather than REGENERATION, which it will. A regenerate ORDINARILY mints a
    // fresh swipeIndex, so the same sentence generated twice arrives under two
    // keys and applies twice; being absolute, the second apply lands on the row
    // the first one wrote. NOT ALWAYS FRESH, though, and the header's sixth loss
    // is exactly this: the engine re-packs indices when a swipe is deleted, so a
    // regenerate after a deletion can re-mint an index this Set already holds and
    // the delivery is dropped — one stale row until the next verb lands.
    // Skipped entirely when the messageId is missing (the engine emits
    // without one on a message it could not claim): two unidentified deliveries
    // would collide on one key, and swallowing a distinct event is worse than
    // re-applying an idempotent one.
    const chatId = typeof data.chatId === "string" && data.chatId ? data.chatId : detail.chatId;
    const messageId = typeof data.messageId === "string" ? data.messageId : "";
    const key = messageId ? `${chatId}:${messageId}:${String(data.swipeIndex)}:${verb}` : "";
    if (key) {
      if (this._seen.has(key)) return;
      // Marked on ARRIVAL rather than after a successful apply, because "already
      // delivered" is what this set answers and nothing ever retries: a refusal
      // below is one of the five losses above, not a delivery waiting to land.
      this._seen.add(key);
      // Oldest-first — a Set iterates in insertion order.
      if (this._seen.size > GM_SEEN_CAP) this._seen.delete(this._seen.values().next().value);
    }
    if (verb === "standing") {
      this.standing(core, data.args);
      return;
    }
    // A verb the engine validated against a table this build did not ship: the
    // package and the installed asset disagree, which is a build skew and not
    // something a player can act on. Logged, never toasted.
    console.warn("[pixelforge] unknown GM verb", verb);
  },

  /** `[standing:{"npc":"Mira","stance":"friendly","line":"…"}]` — the GM says
   *  where the player now stands with one person, and the package writes it into
   *  the shipped relationship row. This pays the same debt the weather verb pays:
   *  the hostile flag `h` is READ on three surfaces (the per-turn world header,
   *  the talk-window title, the Standing sheet's separate count) and written by
   *  none of `bump`'s four callers.
   *
   *  THE ROW IS SETTLEMENT-SCOPED, exactly as those four callers key it
   *  (`world.startZone`): one person is one row wherever in the world you meet
   *  them.
   *
   *  THROUGH `bump`, which means through `_live` — the generation fence and the
   *  loading gate, refused in the one place every other mutator is refused, so
   *  this verb needs no failure shape of its own. Nothing here awaits, so the
   *  OBJECT-IDENTITY fence the talk press needs (`sentSim`, 90-element) has
   *  nothing to catch: the dispatch is synchronous and `core.sim` cannot be
   *  replaced between the read and the write. The generation fence is the whole
   *  guard, as it is for every other synchronous caller.
   *
   *  ABSOLUTE IN EVERY FIELD, which is the safety story: `d` is set, `h` is set
   *  OR CLEARED, and `t: 0` leaves the encounter count alone. Clearing matters —
   *  `h` outranks the rung on both the header and the window title, so a row the
   *  story just made friendly must not still read "hostile" there. An explicit
   *  `d` also makes the promotion heuristic yield (58-player), so a named rung is
   *  not fought by CASUAL_CEILING or the one-rung-per-press rule. */
  standing(core, args) {
    // THE GATE, ASKED HERE TOO, and the only guard this verb repeats. `_live`
    // already refuses the WRITE while the gate holds — but it cannot reach the
    // refusal toast below, which fires before anything gets that far. And while
    // the gate holds, `core.sim.world` can be the interim world rather than the
    // one the narration was composed against (60-save), so a name the GM took
    // honestly from the story would be refused with a sentence that is false.
    // With this, all three of this verb's refusals are silent under the gate, the
    // way the header says they are.
    if (PF.save?.gateHolds?.(core)) return;
    const world = core?.sim?.world;
    if (!world) return;
    const stance = String(args?.stance ?? "");
    const hostile = stance === "hostile";
    // The ladder's own words, read FROM the ladder (58-player RUNGS) rather than
    // re-listed here: `gm-verbs.json`'s enum is those four plus "hostile", and a
    // fifth rung added there would otherwise arrive with no branch to catch it.
    const rung = PF.player.RUNGS.indexOf(stance);
    if (!hostile && rung < 0) {
      console.warn("[pixelforge] GM standing verb named an unknown stance", stance);
      return;
    }
    const npc = this.npcNamed(world, args?.npc);
    if (!npc) {
      // THE BINDING REFUSAL. Nothing was committed engine-side, so refusing here
      // is the end of it — and the player is told plainly rather than left with
      // prose describing a change that never happened. The GM's spelling is
      // measured before it is shown (see GM_NPC_CHARS).
      const named = PF.player.graphemes(args?.npc).slice(0, GM_NPC_CHARS).join("").trim();
      core.hud?.toast(
        named ? `${named} isn't anyone in this world — nothing changed.` : "The story named nobody this world has.",
      );
      console.warn("[pixelforge] GM standing verb named an unknown person", args?.npc);
      return;
    }
    const gen = PF.save?._gen ?? 0;
    // HOSTILITY IS A FLAG AND NOT A RUNG (70-hud `_standing` says so where it
    // counts them apart), so "hostile" says nothing about where the ladder sits —
    // and the row's CURRENT rung is re-passed rather than omitted. Omitting `d`
    // would hand the row to the promotion heuristic, which today cannot fire on a
    // `t: 0` patch but would be an implicit coupling to lean on; re-writing what
    // is already there keeps every field of this patch explicit and absolute.
    const patch = {
      d: hostile ? PF.player.rung(core, world.startZone, npc.name).d : rung,
      h: hostile ? 1 : 0,
      t: 0,
    };
    // The remembered line, clipped by `bump` itself against CAPS.lineChars — the
    // shipped clip, so a GM line and a line earned at a hand-in are measured the
    // same way. A blank one is treated as "the GM supplied none", NOT as an
    // instruction to erase what this person remembers.
    if (typeof args?.line === "string" && args.line.trim()) patch.s = args.line;
    // THE WORLD'S OWN SPELLING, not the GM's: the row key is the name every other
    // writer uses, so "mira" and "Mira" land on the row the talk press wrote
    // rather than beside it.
    const bumped = PF.player.bump(core, world.startZone, npc.name, patch, gen);
    // Refused: the fence, the gate, or the relationship row cap with no stranger
    // left to evict. Silent, like every other mutator refusal in the package —
    // there is nothing the player could do about any of the three.
    if (!bumped) return;
    // The line is handed over ONLY WHEN THIS DELIVERY SET IT: a row's older line
    // re-said here would read as something the story just did.
    core.hud?.standingSet(npc.name, stance, patch.s === undefined ? "" : (bumped.row.s ?? ""));
  },

  /** The person the GM named, resolved against the LIVE compiled world — every
   *  zone, because NPCs are spliced between zones as their schedules move them
   *  (30-sim `resolveSchedules`), and the person the story means is the person
   *  rather than wherever they happen to be standing this daypart.
   *
   *  Matched case- and space-insensitively, and the WORLD'S record is what comes
   *  back, so the caller writes the world's spelling into the row. */
  npcNamed(world, name) {
    const want = String(name ?? "")
      .trim()
      .toLowerCase();
    if (!want) return null;
    for (const zone of Object.values(world?.zones ?? {})) {
      for (const npc of Array.isArray(zone?.npcs) ? zone.npcs : []) {
        if (
          String(npc?.name ?? "")
            .trim()
            .toLowerCase() === want
        )
          return npc;
      }
    }
    return null;
  },
};
