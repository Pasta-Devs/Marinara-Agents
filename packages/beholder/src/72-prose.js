// ── Is this prose something Beholder can read? ──────────────────────────────
//
// Beholder is a small model that anchors on a passage's POINT OF VIEW. Several
// characters in a scene is what it is for — keeping their things apart is trained and
// measured, at about 0.95 attribution across the supported registers. What costs it is
// narration with no anchor: the omniscient voice surveying four people's inner lives as
// equals, or a script. That is a property of the model, not a bug waiting to be fixed,
// and someone whose scenes read that way deserves to be told rather than left
// concluding the thing is broken.
//
// Two checks, and only two, because only two can be made honestly:
//
//   1. Script form. Measured against the register corpus the model was evaluated on:
//      96% of script passages caught, and zero false alarms in 200 passages of ordinary
//      roleplay. Worth stating outright.
//
//   2. Prose that describes bodies and yielded nothing anyway. Not a classification —
//      an observation, and a gated one.
//
//      The gate is vocabulary, because length is not: a long turn of pure dialogue has
//      nothing to extract, and warning that Beholder "found nothing" in it is noise. On
//      the register corpus a passage naming a garment or an injury has state to find
//      49% of the time against 15% for one that names neither, and across a window of
//      eight turns the gate is far sharper still: where three or more turns name
//      clothing or injuries, 97-100% of those windows genuinely contain something
//      extractable, on every in-scope register. So when the gate opens and the panel is
//      still empty, something really was missed — which is the only condition under
//      which saying so is fair.
//
// Detecting omniscient narration by shape was tried and abandoned: every feature —
// recurring names, attributed interiority, titles, sentence length — landed at chance
// against the same corpus, around one ordinary roleplay passage in five false-flagged
// for the same catch rate. A warning that wrong is worse than none.

/** Scene headings, camera directions and speaker cues — the shape of a script. */
const BH_SCRIPT_SLUG = /^[ \t]*(INT|EXT|INT\.\/EXT|I\/E)[.\s]/im;
const BH_SCRIPT_CAMERA =
  /\b(CLOSE ?UP|CUT TO|FADE (IN|OUT)|DISSOLVE TO|MONTAGE|ANGLE ON|PAN (TO|ACROSS)|V\.O\.|O\.S\.|SMASH CUT)\b/;
/** A speaker cue is a whole line in caps, optionally with a parenthetical. */
const BH_SCRIPT_CUE = /^[ \t]*[A-Z][A-Z0-9 .'-]{2,28}(\([^)]{1,20}\))?[ \t]*$/gm;

/** Injury words, the other half of "this passage describes a body". */
const BH_WOUND_RX =
  /\b(wound|cut|gash|bruise|burn|scar|blood|bleeding|broken|fracture|stab|slash|bite|graze|welt)\w*\b/i;
/** Built once from the generated vocabulary; 158 alternatives is not worth rebuilding. */
let BH_GARMENT_RX = null;

BH.prose = {
  /** True when a passage is written as a script rather than as prose. */
  isScript(text) {
    const body = typeof text === "string" ? text : "";
    if (body.trim().length < 40) return false;
    if (BH_SCRIPT_SLUG.test(body) || BH_SCRIPT_CAMERA.test(body)) return true;
    // One stray shouted line is not a script; two cues is a pattern.
    return (body.match(BH_SCRIPT_CUE) ?? []).length >= 2;
  },

  /**
   * Does this passage describe something Beholder could extract?
   *
   * Word count was the wrong gate — length says nothing about whether there is any
   * physical state in a passage, so it warned about dialogue-heavy turns that were
   * empty for the ordinary reason that nobody's clothes came up.
   */
  describesState(text) {
    const body = typeof text === "string" ? text : "";
    if (!BH_GARMENT_RX) {
      BH_GARMENT_RX = new RegExp(`\\b(?:${BH_GARMENT_WORDS.join("|")})s?\\b`, "i");
    }
    return BH_GARMENT_RX.test(body) || BH_WOUND_RX.test(body);
  },

  /**
   * Look at the recent turns and the state they produced.
   *
   * Returns null when there is nothing to say — the common case, and the panel should
   * stay quiet then rather than editorialise about someone's writing.
   */
  /** The recent assistant turns, as plain strings. Shared with the report. */
  async sample(chatId) {
    if (!chatId) return [];
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=12`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (payload?.messages ?? []);
      return rows
        .filter((row) => row && !row.isUser && row.role !== "user")
        .slice(-8)
        .map((row) => row.content ?? row.text ?? "")
        .filter(Boolean);
    } catch {
      return [];
    }
  },

  async assess(chatId, state) {
    if (!chatId) return null;
    // Through sample(), which already reads exactly these turns. This used to repeat
    // the same request with its own copy of the filtering, so opening Doctor fetched
    // the chat's messages twice and the two copies could drift apart.
    const bodies = await this.sample(chatId);
    if (!bodies.length) return null;
    const scripted = bodies.filter((body) => this.isScript(body)).length;
    const describing = bodies.filter((body) => this.describesState(body)).length;

    if (scripted >= 2 || (scripted === 1 && bodies.length === 1)) {
      return {
        verdict: "script",
        copy:
          "These turns are written as a script — scene headings, camera directions or speaker cues. " +
          "Beholder will not do well with that, sorry. It reads narrative prose told from someone's point " +
          "of view, and that is a limit of the small local model rather than something waiting to be fixed.",
      };
    }

    const tracked = Object.keys(state ?? {}).length;
    const slots = Object.values(state ?? {}).reduce(
      (total, character) => total + Object.keys(character?.body ?? {}).length,
      0,
    );
    // Three turns that describe clothing or injuries and still produced nothing. One
    // such turn proves little — roughly half of them have nothing to find even so — but
    // three in a row is unlikely to be the prose simply not mentioning anything.
    if (describing >= 3 && (tracked === 0 || slots <= 1)) {
      return {
        verdict: "described-but-unread",
        copy:
          `${describing} recent turns describe clothes or injuries, but Beholder found none of them. The ` +
          "checks above look fine, so this may be writing it cannot read well — for example, writing that " +
          "moves between many people's thoughts with no single person to follow. Having several characters " +
          "is fine. The problem is when there is no one person to follow.",
        aside:
          "A large model reads this kind of writing better. You can connect this agent to one, but we do " +
          "not support that, and your story would be sent to that model instead of staying on your computer.",
      };
    }
    return null;
  },
};
