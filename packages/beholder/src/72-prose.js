// ── Is this prose something Beholder can read? ──────────────────────────────
//
// Beholder is a small model that anchors on ONE focal character per passage. Give it a
// clear point of view — even third-person-limited — and it works. Give it a scene that
// narrates several co-equal characters at once, or a script, and it collapses. That is
// a property of the model, not a bug waiting to be fixed, and someone whose scenes are
// written that way deserves to be told rather than left concluding the thing is broken.
//
// Two checks, and only two, because only two can be made honestly:
//
//   1. Script form. Measured against the register corpus the model was evaluated on:
//      96% of script passages caught, and zero false alarms in 200 passages of ordinary
//      roleplay. Worth stating outright.
//
//   2. Yield. Whether prose has been read and produced nothing. This is an observation,
//      not a classification, which is the point: several attempts at detecting
//      omniscient narration by shape were tried and all of them landed at chance
//      against the same corpus — around one in five ordinary roleplay passages
//      false-flagged for the same catch rate. A warning that wrong is worse than none,
//      so it is not shipped. Low yield says the same thing without pretending to know
//      why, and it also catches registers nobody thought to look for.

/** Scene headings, camera directions and speaker cues — the shape of a script. */
const BH_SCRIPT_SLUG = /^[ \t]*(INT|EXT|INT\.\/EXT|I\/E)[.\s]/im;
const BH_SCRIPT_CAMERA =
  /\b(CLOSE ?UP|CUT TO|FADE (IN|OUT)|DISSOLVE TO|MONTAGE|ANGLE ON|PAN (TO|ACROSS)|V\.O\.|O\.S\.|SMASH CUT)\b/;
/** A speaker cue is a whole line in caps, optionally with a parenthetical. */
const BH_SCRIPT_CUE = /^[ \t]*[A-Z][A-Z0-9 .'\-]{2,28}(\([^)]{1,20}\))?[ \t]*$/gm;

BH.prose = {
  /** True when a passage is written as a script rather than as prose. */
  isScript(text) {
    const body = typeof text === "string" ? text : "";
    if (body.trim().length < 40) return false;
    if (BH_SCRIPT_SLUG.test(body) || BH_SCRIPT_CAMERA.test(body)) return true;
    // One stray shouted line is not a script; two cues is a pattern.
    return (body.match(BH_SCRIPT_CUE) ?? []).length >= 2;
  },

  /** Substantial enough to expect something from. */
  isSubstantial(text) {
    return typeof text === "string" && text.trim().split(/\s+/).length >= 40;
  },

  /**
   * Look at the recent turns and the state they produced.
   *
   * Returns null when there is nothing to say — the common case, and the panel should
   * stay quiet then rather than editorialise about someone's writing.
   */
  async assess(chatId, state) {
    if (!chatId) return null;
    let messages = [];
    try {
      // The chat record does not carry its messages; they have their own route. Reading
      // them off the chat looked fine and quietly returned nothing every time.
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=12`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (payload?.messages ?? []);
      messages = rows.filter((row) => row && !row.isUser && row.role !== "user").slice(-8);
    } catch {
      return null;
    }
    if (!messages.length) return null;

    const bodies = messages.map((row) => row.content ?? row.text ?? "").filter(Boolean);
    const scripted = bodies.filter((body) => this.isScript(body)).length;
    const substantial = bodies.filter((body) => this.isSubstantial(body)).length;

    if (scripted >= 2 || (scripted === 1 && bodies.length === 1)) {
      return {
        verdict: "script",
        copy:
          "These turns are written as a script — scene headings, camera directions or speaker cues. " +
          "Beholder will not do well with that, sorry. It reads prose with one focal character, and that " +
          "is a limit of the small local model rather than something waiting to be fixed.",
      };
    }

    const tracked = Object.keys(state ?? {}).length;
    const slots = Object.values(state ?? {}).reduce(
      (total, character) => total + Object.keys(character?.body ?? {}).length,
      0,
    );
    // Read several substantial turns and produced nothing worth showing.
    if (substantial >= 3 && (tracked === 0 || slots <= 1)) {
      return {
        verdict: "low-yield",
        copy:
          `Beholder has read ${substantial} substantial turns and found almost nothing. That usually means ` +
          "this prose sits outside what the small local model handles — several characters narrated at once, " +
          "or a register it was not trained on. It is a limit of the model, by design.",
        aside:
          "A large general model can do better on prose like this. You can point this agent at one, though " +
          "that setup is not supported.",
      };
    }
    return null;
  },
};
