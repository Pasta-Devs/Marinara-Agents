// ── The offline content pack (schema v1) ──────────────────────────────────────
// The SECOND sealed artifact a generated world owns, and the sibling of the brief
// (18-brief): the brief says who lives here and where, the pack says what they SAY
// and what they will ask the player to DO. One generation call at creation writes
// it, seal-time validation is the only contract it has, and after that it never
// changes — regenerating it on load would quietly rewrite dialogue and quest text
// the player has already read, which is a worse loss than not having it at all
// (docs/ROADMAP.md E1, P4, and open question 10's "authored once and persisted as
// a sealed input, exactly as the brief already is").
//
// WHY THIS FILE LOADS HERE, after the save layer that stores it and the economy
// whose words it borrows. The boot assertion at the foot validates the DEFAULT
// pack against vocabularies this module does not own — the stock cast (18-brief,
// read through `defaults()` exactly as 20-world's name book is), the catch roles
// and each theme's variant slugs (59-economy), the theme ids (10-art). An
// assertion that has to write `PF.economy?.` to run at all is not an assertion,
// it is a skip with a question mark on it. Everything that reads this module
// reaches it at RUNTIME through `PF.pack`, so nothing needs it any earlier.
//
// THE CONTENT FENCE (plan §2.2c). The pack references cast by SEALED NAME only.
// Its fields are dialogue strings, template rows and index keys — there are no
// per-NPC machine fields in it, ever. The brief is the sole authority on people;
// a pack that could say who somebody IS would be a second brief, disagreeing with
// the first the moment either was repaired.
//
// THE SCHEMA IS SEALED FOREVER, so every axis ships or is recorded absent. What
// comes back from the call may be shaped like anything: the route's schema is
// 8,000 serialized chars and ADVISORY on Anthropic and the sidecar (#5135), and
// `strictSchema` STAYS FALSE here — it is unavailable to additionalProperties
// schemas, which this one is. The tolerant parser is the contract. So seal time
// REPAIRS and DROPS (validate below, the brief's own idiom), and read time only
// FOLDS (fold below): a template this build cannot resolve leaves the selectable
// set for this world instead of being deleted from the artifact.
PF.pack = (() => {
  const VERSION = 1;

  // ── The index axes (plan §2.2c) ─────────────────────────────────────────────
  // A dialogue line is keyed (location × daypart × weather × register) and the
  // pool it lands in is SHARED BY PLACE, not owned by a person: who is speaking
  // resolves at read from who is standing there (25-schedule answers that), which
  // is what keeps a matrix affordable for a cast of ten and a mint of a hundred
  // and twenty (ROADMAP open question 11).
  //
  // LOCATION HANDLES are the brief's own place-kind vocabulary plus the root, and
  // that choice is the one that makes this artifact portable. Zone ids (`z3`) mean
  // nothing outside the brief that minted them, and zone NAMES mean nothing after
  // a demotion — but "the gathering place" is a thing every compiled world and the
  // legacy layout both have. Resolving a handle to a zone is the READING surface's
  // job (E1/E7's press site, not 0.13's), and it is a lookup, never a guess.
  const LOCATIONS = ["settlement", "gathering", "workshop", "hall", "sanctuary", "dwelling", "wilds"];
  // The four daypart words are the sim's, and 59-economy already writes them down
  // for the same reason (the sim exports no list). Read from there rather than
  // copied: a fifth daypart must not be able to mean one thing to a catch table
  // and another to a line index.
  const DAYPARTS = PF.economy.DAYPARTS;
  // TWO REGISTERS, stranger and friend — the ROADMAP's own words for E1 (iii),
  // and what P2's disposition ladder will switch between.
  const REGISTERS = ["stranger", "friend"];
  // THE WEATHER AXIS, built and empty. L2 owns the rest of this list; until then
  // "fair" is the only value there is, and it is OPTIONAL on a line precisely so
  // the seam costs nothing: a generation that had to spell one constant word on
  // every line would spend a tenth of its budget saying "fair" (plan §2.2b's byte
  // diet). Absent reads as fair, here and forever.
  const WEATHERS = ["fair"];
  const WEATHER_DEFAULT = "fair";
  // THE E7 TOPIC SEAM (plan §2.2c). Optional per line, defaulting to NONE, and it
  // exists so the Ask tree has branches to hang lines off when it arrives: rumor
  // and work are the two E7 is load-bearing for, place and smalltalk are the ones
  // a tree opens with. Guidance confines tags to rumor/work (slice 2) — the seam
  // is wider than the diet on purpose, because the schema seals and the guidance
  // does not.
  const TOPICS = ["rumor", "work", "place", "smalltalk"];

  // ── The quest template vocabulary (plan §2.2c) ──────────────────────────────
  // FOUR WORDS, THREE MECHANICS. `gather` is accepted and FOLDS to `catch` at seal
  // with a repair logged: a model asked for chores writes "gather" for the thing
  // this package does by fishing, and refusing the word would drop a good row over
  // a synonym. Combat-shaped verbs are refused BY THIS ENUM and not by a policy
  // sentence somewhere (plan §Q5) — the enum and the hook list agree by
  // construction, and a verb with no site to progress at can never be sealed.
  const VERBS = ["gather", "catch", "deliver", "visit"];
  const VERB_FOLD = { gather: "catch" };
  const MECHANICS = ["catch", "deliver", "visit"];
  // THE TARGET IS GRAIN-TAGGED, one key naming which kind of thing it is:
  //   { role }    — a catch ROLE: any variant of it counts (catch-common …)
  //   { variant } — one catch VARIANT slug exactly ("carp")
  //   { npc }     — a sealed cast NAME, for deliver (an errand, no item moves)
  //   { place }   — a location handle, for visit
  // The plan states the grain rule for the CATCH family ({role} XOR {variant});
  // deliver and visit need a slot of their own or the enum ships two verbs no row
  // can express, so the tag names the grain for all four and validate() binds each
  // grain to the verb that can use it.
  const TARGET_GRAINS = ["role", "variant", "npc", "place"];
  const GRAINS_FOR_VERB = { catch: ["role", "variant"], deliver: ["npc"], visit: ["place"] };

  // ONE SETTLEMENT, ONE BOARD (multi-board is W1's). The constant is the board's
  // identity in every hash and every instance id, so it is written once.
  const BOARD = "b1";

  // ── Seal-time caps (plan §2.2g) ─────────────────────────────────────────────
  // THERE IS NO STORAGE BUDGET — the maintainer abolished it, and the only real
  // budget is the generation FIT (slice 2's arithmetic). These are hygiene caps
  // applied at seal: a sealed blob never grows, so what they bound is what one
  // call is allowed to hand us, not what a save is allowed to hold.
  const CAPS = {
    templates: 24,
    lines: 320,
    escalation: 12, // one per NPC, and the sealed cast maxes at 10 (18-brief CAPS)
    overheard: 24,
    title: 48, // clip-safe: a board row is one line of plain text
    text: 200,
    slug: 32,
    n: 20, // the biggest count a template may ask for
  };

  // ── The quest layer's tuning table ──────────────────────────────────────────
  // The economy's TUNING idiom (59-economy): every number the layer spends is
  // written HERE with its own reason, so a retune is one file. Slice 2 adds the
  // reward derivation rows beside these; slice 3 spends K.
  const TUNING = {
    // How many of the day's surviving templates the board offers. Four against the
    // ten-quest cap means a player who takes everything and finishes nothing is at
    // the cap on day three — their own equilibrium, not a forced one: offers cost
    // nothing to ignore and never expire, and the at-cap refusal names the two
    // reliefs (finish one, set one aside).
    K: 4,
    // THE SUBSTANCE FLOOR, and it is a SEAL/FAIL boundary rather than a warning:
    // a salvaged pack that clears it seals thin, and one that does not is a
    // FAILURE — the gate holds, the retry screen says so, and nothing is stored.
    // Backfill covers small gaps in an otherwise-substantive pack; it may never
    // cover the load-bearing half. The two numbers are starters chosen so that a
    // 2,048-token emission that kept templates first still clears them; slice 2
    // confirms them against the tagged-floor arithmetic.
    floorTemplates: 3,
    floorLines: 12,
  };

  // ── Text hygiene ────────────────────────────────────────────────────────────
  // The brief's, not a second copy: `capText` sanitizes, strips markdown and tag
  // fragments and cuts on a grapheme boundary, and `foldEnum` is the same
  // Unicode-aware enum fold every axis below wants. Pack content comes off the
  // same untrusted channel a brief does and has no business being cleaned twice
  // in two ways.
  const capText = (value, max) => PF.brief.capText(value, max);
  const foldEnum = (value, list, fallback) => PF.brief.foldEnum(value, list, fallback);
  const str = (value) => (typeof value === "string" ? value : "");
  /** Arrays may arrive as objects keyed by id, which is a common shape without
   *  provider json_schema — 18-brief's own reading, and the pack meets the same
   *  channel. Object.values() BEFORE the array check saves the whole list. */
  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  };
  /** A slug the id space can hold: lowercase, dashed, no colon. The colon is the
   *  counter key's own separator (`p:<pack>:<slug>`) and 59-economy closes the
   *  same door on catch variants for the ledger's separator — a slug carrying one
   *  is content nobody needs and an encoding that never has to survive one is a
   *  line shorter. */
  const slugify = (value, max) =>
    capText(value, max)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  /** The counter class a template id declares, and the two classes are the whole
   *  of §2.2e. `p:<pack>:<slug>` is WORLD-BOUND — generated content belongs to the
   *  world it was written for and is severed with it. `b:<slug>` is WORLD-FREE —
   *  the default pack's generic work means the same thing anywhere, which is true
   *  BY CONSTRUCTION because those rows target catch ROLES (shared by every theme)
   *  rather than variants, and their titles are worded per theme at render.
   *  58-player's quest() already routes on exactly this prefix. */
  const packTemplateId = (packId, slug) => `p:${packId}:${slug}`;
  const boardTemplateId = (slug) => `b:${slug}`;

  /** The pack's own short identity, minted from the brief it sealed against — one
   *  pack per brief, so the brief's hash names it. It rides the template ids so a
   *  regenerated pack's counters cannot land on the old pack's rows. */
  const idOf = (briefHash) => (briefHash >>> 0).toString(36);

  return {
    VERSION,
    BOARD,
    LOCATIONS,
    DAYPARTS,
    REGISTERS,
    WEATHERS,
    TOPICS,
    VERBS,
    MECHANICS,
    TARGET_GRAINS,
    CAPS,
    TUNING,
    idOf,

    // ── The shared matcher predicate (plan §2.2d, round-3 dryness D4) ─────────
    /** Does this yield answer that quest row's target? ONE implementation, three
     *  callers: the seal validator (through the grain check), the default-pack
     *  boot lane, and — when the lifecycle slice lands it — fish()'s granted
     *  region. Three copies of this is how a role-grain quest comes to count a
     *  variant-grain catch in one place and not another.
     *
     *  `target` is the quest ROW's own target string, because that is all the
     *  progress site ever has: the row is a closed 8-field literal and `target`
     *  is a plain string in it. The grain is recoverable from the string alone
     *  because the two namespaces are ASSERTED DISJOINT at the foot of this file
     *  — no catch role is ever also a variant slug, in any theme this build
     *  ships. Role grain matches ANY yield of that role; variant grain matches the
     *  exact (t, k) pair, which is what stops a bait row whose slug collided with
     *  a fish from paying a fishing quest. */
    matches(target, item) {
      const want = str(target);
      if (!want) return false;
      const t = str(item?.t);
      const k = str(item?.k);
      if (!t) return false;
      if (PF.economy.CATCH_ROLES.includes(want)) return t === want;
      return k === want && PF.economy.CATCH_ROLES.includes(t);
    },

    /** The string a template's grain-tagged target becomes when a row is minted
     *  from it. Role and variant flatten to the bare word the matcher reads; npc
     *  and place flatten to the name the deliver/visit sites compare. */
    targetString(template) {
      const target = template?.target;
      if (!target || typeof target !== "object") return "";
      for (const grain of TARGET_GRAINS) {
        const value = str(target[grain]);
        if (value) return value;
      }
      return "";
    },

    // ── Instance identity (plan §2.2c) ───────────────────────────────────────
    /** `b1.d<day>.<templateId>` — deterministic per (board, day, template), so a
     *  rewind that replays the same day mints the same id and the same-day dup
     *  accept refuses by id inside the mutator. The template rides IN the id
     *  because the completion counter is keyed by template and the row does not
     *  carry one. */
    instanceId(day, templateId) {
      const id = str(templateId);
      if (!id) return "";
      return `${BOARD}.d${Math.max(0, Math.trunc(Number(day) || 0))}.${id}`;
    },

    /** The template half of a board instance id, or null when the id is not one.
     *  Used by the template-grain dedupe (58-player `_dedupeActive`) and by any
     *  reader that has a row and wants its title. */
    templateOf(instanceId) {
      const match = /^b1\.d\d+\.(.+)$/.exec(str(instanceId));
      return match ? match[1] : null;
    },

    // ── validate(): the seal (the brief's repair-pass idiom) ─────────────────
    /** Runs ONCE, on the way in from the generation call, and seals. Item-level
     *  repair: a row this build cannot make sense of is DROPPED with a line in
     *  `_repairs` rather than poisoning the artifact, exactly as an unknown
     *  feature tag drops a whole feature at 18-brief's seal.
     *
     *  Returns null when the result is under the substance floor — that is a
     *  FAILURE and not a thin success: the gate holds, the retry screen says the
     *  world is safe, and nothing is written. A pack is the one artifact whose
     *  absence is survivable (the default pack reads in its place), so sealing a
     *  hollow one would trade a free retry for a permanent nothing. */
    validate(raw, { theme: rawTheme, seed, brief }) {
      const repairs = [];
      const themeIds = PF.art?.themeIds?.() ?? ["cozy-village"];
      const theme = themeIds.includes(rawTheme) ? rawTheme : "cozy-village";
      const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      if (src !== raw) repairs.push("transport: non-object root replaced");
      const briefHash = PF.player.briefHashOf(brief);
      const packId = idOf(briefHash);
      // The cast is the fence: a giver has to be somebody the brief SEALED, by
      // name, or the board can offer work from a person who does not exist. This
      // is what makes a mint-parked board row structurally impossible.
      const cast = new Set(
        (Array.isArray(brief?.cast) ? brief.cast : []).map((member) => str(member?.name)).filter(Boolean),
      );
      const pack = {
        packVersion: VERSION,
        theme,
        briefHash,
        templates: [],
        lines: [],
        escalation: [],
        overheard: [],
      };
      const usedSlugs = new Set();

      for (const item of asArray(src.templates)) {
        if (pack.templates.length >= CAPS.templates) {
          repairs.push(`templates: over ${CAPS.templates}, dropped the rest`);
          break;
        }
        const row = this.foldTemplate(item, { cast, theme, packId, usedSlugs, repairs, index: pack.templates.length });
        if (row) pack.templates.push(row);
      }

      for (const item of asArray(src.lines)) {
        if (pack.lines.length >= CAPS.lines) {
          repairs.push(`lines: over ${CAPS.lines}, dropped the rest`);
          break;
        }
        const text = capText(item?.text, CAPS.text);
        if (!text) continue;
        const at = foldEnum(item?.at, LOCATIONS, null);
        const when = foldEnum(item?.when, DAYPARTS, null);
        const register = foldEnum(item?.r ?? item?.register, REGISTERS, null);
        if (!at || !when || !register) {
          repairs.push(`lines[${pack.lines.length}]: dropped, unusable index key`);
          continue;
        }
        const line = { at, when, r: register, text };
        // The weather word is optional and the topic tag is optional, and an
        // ABSENT one stays absent: writing the default in would spend bytes
        // saying what the reader already reads, and it would make a line that
        // never chose a topic indistinguishable from one that chose "none".
        const weather = foldEnum(item?.w ?? item?.weather, WEATHERS, null);
        if (weather) line.w = weather;
        const topic = foldEnum(item?.topic, TOPICS, null);
        if (topic) line.topic = topic;
        pack.lines.push(line);
      }

      for (const item of asArray(src.escalation)) {
        if (pack.escalation.length >= CAPS.escalation) break;
        const npc = capText(item?.npc ?? item?.name, 24);
        const text = capText(item?.text, CAPS.text);
        if (!text) continue;
        if (!cast.has(npc)) {
          repairs.push(`escalation: dropped a line for ${JSON.stringify(npc || null)}, who is not in the cast`);
          continue;
        }
        pack.escalation.push({ npc, text });
      }

      for (const item of asArray(src.overheard)) {
        if (pack.overheard.length >= CAPS.overheard) break;
        const text = capText(item?.text, CAPS.text);
        if (!text) continue;
        const at = foldEnum(item?.at, LOCATIONS, null);
        if (!at) continue;
        const row = { at, text };
        const topic = foldEnum(item?.topic, TOPICS, null);
        if (topic) row.topic = topic;
        pack.overheard.push(row);
      }

      // THE FLOOR, and nothing below it seals. Stated in numbers from TUNING so a
      // retune moves the boundary in one place (and so the failure line says which
      // half was thin, which is the difference between a bug report and a shrug).
      if (pack.templates.length < TUNING.floorTemplates || pack.lines.length < TUNING.floorLines) {
        console.warn(
          `[pixelforge] the content pack came back under its floor (${pack.templates.length}/${TUNING.floorTemplates} templates, ` +
            `${pack.lines.length}/${TUNING.floorLines} lines); nothing sealed`,
        );
        return null;
      }
      pack._repairs = repairs;
      void seed; // reserved: the backfill pass (slice 2) draws from it
      return pack;
    },

    /** One template row, repaired or dropped. Split out of validate() because the
     *  default-pack lane drives it too — the hand-authored artifact goes through
     *  the same door the model's does, which is the only way "written to the same
     *  schema" can be a fact rather than an intention. */
    foldTemplate(item, { cast, theme, packId, usedSlugs, repairs, index }) {
      const say = (text) => repairs?.push(`templates[${index}]: ${text}`);
      const giver = capText(item?.giver, 24);
      // GIVER ∈ THE SEALED CAST, for `p:` rows without exception (round-3 fresh
      // M2a). A giver the brief never named is a row that can only ever be
      // mint-parked or repair-dropped the first time the world is rebuilt, which
      // is a quest that exists to be lost.
      if (!giver || !cast.has(giver)) {
        say(`dropped, giver ${JSON.stringify(giver || null)} is not in the sealed cast`);
        return null;
      }
      const asked = foldEnum(item?.verb, VERBS, null);
      if (!asked) {
        say(`dropped, verb ${JSON.stringify(str(item?.verb) || null)} is not one this build can verify`);
        return null;
      }
      const verb = VERB_FOLD[asked] ?? asked;
      if (verb !== asked) say(`verb ${asked} -> ${verb}`);
      const target = this.foldTarget(item?.target, verb, { cast, theme });
      if (!target) {
        say(`dropped, ${verb} has no target this world can resolve`);
        return null;
      }
      const slugSource = str(item?.slug) || str(item?.id) || `${verb}-${this.targetString({ target })}`;
      let slug = slugify(slugSource, CAPS.slug) || `${verb}-${index}`;
      // The id space is the counter's key space, so a duplicate slug is two rows
      // sharing one completion count. Ordinal-suffixed rather than dropped: the
      // row is otherwise good and the player never sees the slug.
      let attempt = 2;
      while (usedSlugs.has(slug)) slug = `${slugify(slugSource, CAPS.slug) || verb}-${attempt++}`;
      usedSlugs.add(slug);
      const n = verb === "catch" ? PF.clamp(Math.round(Number(item?.n) || 1), 1, CAPS.n) : 1;
      return {
        id: packTemplateId(packId, slug),
        giver,
        verb,
        target,
        n,
        // A TITLE IS PLAIN TEXT AND CLIPS SAFE. It renders in a board row and in
        // the quest tab through the same shared renderer, so anything that could
        // reflow a row is stripped at the seal rather than at every read.
        title: capText(item?.title, CAPS.title) || `${verb} ${this.targetString({ target })}`,
      };
    },

    /** The grain-tagged target, bound to the verb that can use it. Returns null
     *  when nothing resolves — the caller drops the row. */
    foldTarget(raw, verb, { cast, theme }) {
      const allowed = GRAINS_FOR_VERB[verb] ?? [];
      const source = raw && typeof raw === "object" ? raw : null;
      const bare = str(raw);
      for (const grain of allowed) {
        const value = capText(source ? source[grain] : grain === allowed[0] ? bare : "", CAPS.slug);
        if (!value) continue;
        if (grain === "role" && !PF.economy.CATCH_ROLES.includes(value)) continue;
        if (grain === "variant" && !this.variantsOf(theme).has(value)) continue;
        if (grain === "npc" && !cast.has(value)) continue;
        if (grain === "place" && !LOCATIONS.includes(value)) continue;
        return { [grain]: value };
      }
      // A bare string against the catch family: the grain is recoverable because
      // the namespaces are disjoint, so a model that wrote `target: "carp"` is
      // answered rather than dropped over a wrapper it did not know to write.
      if (verb === "catch" && bare) {
        const word = capText(bare, CAPS.slug);
        if (PF.economy.CATCH_ROLES.includes(word)) return { role: word };
        if (this.variantsOf(theme).has(word)) return { variant: word };
      }
      return null;
    },

    /** Every variant slug a theme's catch tables name. Cheap enough to recompute
     *  and deliberately not cached: the tables are a module constant, and a cache
     *  keyed by theme is one more thing to invalidate for nothing. */
    variantsOf(theme) {
      const byTag = PF.own(PF.economy.CATCH_TABLES, theme) ?? PF.economy.CATCH_TABLES["cozy-village"];
      const slugs = new Set();
      for (const table of Object.values(byTag ?? {})) for (const entry of table) slugs.add(entry.variant);
      return slugs;
    },

    // ── fold(): the READ side (plan §2.2d) ───────────────────────────────────
    /** What THIS world can actually offer, derived once per install or rebuild and
     *  never saved. Three things happen here and nothing else does:
     *
     *  1. DEMOTION. The pack carries the briefHash it sealed against; a mismatch
     *     means the world under it changed, and the SELECTABLE SET falls back to
     *     the default pack. It touches nothing else: live quest rows stay, render
     *     through the shared fallback, complete and abandon normally, and sever
     *     and repair exactly as before. A demotion is a content fact, not a save
     *     event.
     *  2. THE SELECTABLE SET. A template whose giver is in no zone's `npcs`, or
     *     whose target this world cannot resolve, folds OUT — never offered,
     *     therefore never accepted, therefore never repair-dropped. The dangling
     *     row the repair pass exists to catch is one this set can no longer mint.
     *  3. THE SORTED IDS. The daily selection hashes over the SORTED SET of
     *     surviving ids and never over post-fold ordinals, so a template folding
     *     out changes which rows survive and not which day the survivors land on.
     */
    fold(stored, { brief, world }) {
      const theme = str(world?.theme) || "cozy-village";
      const briefHash = PF.player.briefHashOf(brief);
      const sealed =
        stored && typeof stored === "object" && Array.isArray(stored.templates) && stored.briefHash === briefHash
          ? stored
          : null;
      const demoted = !!stored && !sealed;
      const pack = sealed ?? this.defaults(theme);
      const known = new Set();
      for (const zoneId of Object.keys(world?.zones ?? {})) {
        for (const npc of world.zones[zoneId]?.npcs ?? []) if (npc?.name) known.add(npc.name);
      }
      const variants = this.variantsOf(theme);
      const byId = new Map();
      for (const template of pack.templates) {
        if (!template?.id || !known.has(str(template.giver))) continue;
        const target = template.target ?? {};
        if (target.role !== undefined && !PF.economy.CATCH_ROLES.includes(target.role)) continue;
        if (target.variant !== undefined && !variants.has(target.variant)) continue;
        if (target.npc !== undefined && !known.has(target.npc)) continue;
        if (target.place !== undefined && !LOCATIONS.includes(target.place)) continue;
        byId.set(template.id, template);
      }
      return {
        pack,
        source: sealed ? "sealed" : "default",
        demoted,
        byId,
        ids: [...byId.keys()].sort(),
        // Memo slot for the daily selection, keyed by day (see selection()).
        _day: -1,
        _offers: [],
      };
    },

    // ── The daily selection (plan §2.2d) ─────────────────────────────────────
    /** The K templates today's board offers: `hash(seed, day, "b1")` over the
     *  SORTED surviving ids, memoised by day. Deterministic across processes and
     *  across a rewind — the board a player saw on day 12 is the board day 12
     *  always had, whatever they have accepted since. */
    selection(folded, seed, day) {
      if (!folded || !folded.ids.length) return [];
      const at = Math.max(0, Math.trunc(Number(day) || 0));
      if (folded._day === at) return folded._offers;
      const rng = PF.rng(PF.hashStr(`${seed >>> 0}|${at}|${BOARD}`));
      const pool = [...folded.ids];
      // Fisher-Yates against the seeded stream, then take the first K: a shuffle
      // rather than K draws, so the same template cannot be offered twice on one
      // day however small the surviving set is.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        const swap = pool[i];
        pool[i] = pool[j];
        pool[j] = swap;
      }
      folded._day = at;
      folded._offers = pool.slice(0, Math.min(TUNING.K, pool.length)).map((id) => folded.byId.get(id));
      return folded._offers;
    },

    // ── defaults(): the pack a world with none reads instead ─────────────────
    /** A READ-TIME FALLBACK ONLY. It is never sealed, never stored, and never the
     *  answer to a failed generation — a failure holds the gate and offers a
     *  retry, exactly as 18-brief's ladder refuses to seal a themed default brief.
     *  What it serves is the two chats that legitimately have no pack of their
     *  own: one whose generation was declined ({skipped:true}) and one created
     *  before this release, plus the demotion case above.
     *
     *  A DEEP COPY per call, because the fold hands `pack` to readers and a shared
     *  literal would let one world's reader mutate every other world's fallback. */
    defaults(theme) {
      const book = PF.own(DEFAULT_PACKS, theme) ?? DEFAULT_PACKS["cozy-village"];
      return JSON.parse(JSON.stringify(book));
    },

    // ── generate(): the call seam ────────────────────────────────────────────
    /** THE SECOND GENERATION CALL, and SLICE 2 OWNS ITS BODY: the digest split,
     *  the guidance, the schema and the salvage ladder are that slice's, and this
     *  slice builds the whole state machine around this seam so the machine can be
     *  driven — and pinned — without one.
     *
     *  The contract is 18-brief `generate`'s, deliberately: a SEALED pack for the
     *  two outcomes that produce a real one (success and salvage), and NULL for
     *  every failure, so the caller holds the gate and the next visit tries again.
     *  Until slice 2 lands, that null is the honest answer — there is no call to
     *  make yet, and a chat that reaches here sits at the pack-stage retry screen
     *  with its world already sealed and safe. */
    async generate(chatId, { onFailure } = {}) {
      void chatId;
      onFailure?.("unavailable");
      return null;
    },
  };
})();

// ── The default pack, both themes (plan §2.2f) ────────────────────────────────
// A FIRST-CLASS DELIVERABLE and the largest hand-authored content artifact this
// package ships. It is written to the same schema the generated one is, folds
// through the same fold(), and is held to it by the boot assertion at the foot of
// this file — the skins' idiom (59-economy), for the skins' reason: a fallback
// nobody validates is a fallback that is broken on the day it is first needed,
// which is by definition a day nothing else is working either.
//
// THE TEMPLATES ARE WORLD-FREE BY CONSTRUCTION (§2.2e): their ids are `b:` class,
// their catch targets are ROLES rather than variants (a role means the same thing
// in every theme; a variant does not), their givers are the four stock residents
// every default and legacy world stands up (Mira, Tam, Rook, Fen — 18-brief
// STOCK_CAST, 20-world buildLegacy), and only their TITLES are theme-worded. So a
// board completion counted here means the same thing in the next world, which is
// exactly what `quests_done_board` claims about itself.
const DEFAULT_PACKS = (() => {
  // Compact writers: the sealed shape is the object below, and the tuple form is
  // what keeps sixty-odd lines of dialogue readable in a source file. `w` is
  // omitted deliberately — absent reads as fair, and the axis costs nothing until
  // L2 fills it.
  const line = (at, when, r, text, topic) => (topic ? { at, when, r, text, topic } : { at, when, r, text });
  const cast = (name, text) => ({ npc: name, text });
  const heard = (at, text, topic) => (topic ? { at, text, topic } : { at, text });

  // The generic work, shared across themes: same ids, same givers, same role-grain
  // targets, per-theme titles supplied below.
  const WORK = [
    { slug: "catch-common-3", giver: "Tam", verb: "catch", target: { role: "catch-common" }, n: 3 },
    { slug: "catch-common-6", giver: "Mira", verb: "catch", target: { role: "catch-common" }, n: 6 },
    { slug: "catch-uncommon-2", giver: "Mira", verb: "catch", target: { role: "catch-uncommon" }, n: 2 },
    { slug: "catch-rare-1", giver: "Rook", verb: "catch", target: { role: "catch-rare" }, n: 1 },
    { slug: "deliver-fen", giver: "Mira", verb: "deliver", target: { npc: "Fen" }, n: 1 },
    { slug: "deliver-rook", giver: "Tam", verb: "deliver", target: { npc: "Rook" }, n: 1 },
    { slug: "visit-wilds", giver: "Fen", verb: "visit", target: { place: "wilds" }, n: 1 },
    { slug: "visit-gathering", giver: "Rook", verb: "visit", target: { place: "gathering" }, n: 1 },
  ];
  const templates = (titles) =>
    WORK.map((row) => ({
      id: `b:${row.slug}`,
      giver: row.giver,
      verb: row.verb,
      target: row.target,
      n: row.n,
      title: titles[row.slug],
    }));

  return {
    "cozy-village": {
      packVersion: 1,
      theme: "cozy-village",
      // ZERO IS THE DEFAULT PACK'S HASH and it is never anybody's brief hash in
      // practice; what matters is that it can never MATCH a sealed brief's, so
      // this artifact can never be mistaken for a sealed one on the read path.
      briefHash: 0,
      templates: templates({
        "catch-common-3": "Three for the pot",
        "catch-common-6": "A basket for the kitchen",
        "catch-uncommon-2": "Something better than usual",
        "catch-rare-1": "One good fish",
        "deliver-fen": "Word out to the wood",
        "deliver-rook": "A message for the guard",
        "visit-wilds": "Walk the old path",
        "visit-gathering": "Come by the inn",
      }),
      lines: [
        line("settlement", "dawn", "stranger", "Early, aren't you. Mind the wet stones by the gate."),
        line("settlement", "dawn", "friend", "You're up before the bread is. Come back at noon and I'll have some."),
        line("settlement", "day", "stranger", "Morning. If you're looking for work, there's a board up.", "work"),
        line("settlement", "day", "friend", "They're saying the north field is sinking again.", "rumor"),
        line("settlement", "dusk", "stranger", "Getting on. Most doors shut when the light goes."),
        line("settlement", "dusk", "friend", "Walk with me as far as the well? It's on your way."),
        line("settlement", "night", "stranger", "Late to be out. Nothing's open but the inn.", "place"),
        line("settlement", "night", "friend", "Couldn't sleep either, then. It's a good night for not sleeping."),
        line("gathering", "dawn", "stranger", "Kitchen's not lit yet. Sit if you like."),
        line("gathering", "dawn", "friend", "First cup's yours. Don't tell the others."),
        line("gathering", "day", "stranger", "Room's a fair price and the beds are dry.", "place"),
        line("gathering", "day", "friend", "There's a job on the board somebody ought to take.", "work"),
        line("gathering", "dusk", "stranger", "Busiest hour. Mind your elbows."),
        line("gathering", "dusk", "friend", "Sit down, you look like a day happened to you."),
        line("gathering", "night", "stranger", "Last of the fire. I'm not stoking it again."),
        line("gathering", "night", "friend", "Stay for one more. The walk home will still be there.", "smalltalk"),
        line("wilds", "dawn", "stranger", "Fog sits low out here till the sun finds it."),
        line("wilds", "dawn", "friend", "The fish bite better before anyone else is awake.", "work"),
        line("wilds", "day", "stranger", "Keep to the path. It knows where it's going."),
        line("wilds", "day", "friend", "Found a good stone last week. I'll show you sometime.", "place"),
        line("wilds", "dusk", "stranger", "I'd turn back if I were you. The light goes fast under trees."),
        line("wilds", "dusk", "friend", "One more cast and then we go. That's what you said last time."),
        line("wilds", "night", "stranger", "Something moved. Probably a deer. Probably."),
        line("wilds", "night", "friend", "Quiet out here, isn't it. Good quiet."),
        line("workshop", "day", "stranger", "Watch the sparks and don't touch the bench."),
        line("workshop", "day", "friend", "Hold this a moment — no, that end. Thank you."),
        line("hall", "day", "stranger", "You can wait, but the answer will be the same tomorrow."),
        line("hall", "day", "friend", "They'll hear you out. Whether they listen is another thing.", "rumor"),
        line("sanctuary", "day", "stranger", "Sit where you like. Nobody minds."),
        line("sanctuary", "day", "friend", "I come here to think and end up not thinking. It works."),
        line("dwelling", "day", "stranger", "This is somebody's house, you know."),
        line("dwelling", "day", "friend", "Door's open. Wipe your feet."),
      ],
      escalation: [
        cast("Mira", "You heard about the field, then? Ask me again when the room's empty."),
        cast("Tam", "It isn't the rain. I've farmed rain. Ask me properly and I'll tell you."),
        cast("Rook", "I'm not paid to have opinions about it. Off duty, I have several."),
        cast("Fen", "I've seen what the water's doing out past the trees. Nobody wants to hear it."),
      ],
      overheard: [
        heard("settlement", "…and he says the survey came back fine. Fine!", "rumor"),
        heard("settlement", "…if the plots go, we all go, is what I'm saying.", "rumor"),
        heard("gathering", "…third night running she's been up at that window.", "rumor"),
        heard("gathering", "…tell him yourself, then. I'm not doing it.", "smalltalk"),
        heard("wilds", "…swear the water's higher than it was.", "place"),
        heard("wilds", "…don't go past the marker after dark, that's all I'll say.", "place"),
      ],
      _repairs: [],
    },
    "sci-fi-colony": {
      packVersion: 1,
      theme: "sci-fi-colony",
      briefHash: 0,
      templates: templates({
        "catch-common-3": "Three for the galley",
        "catch-common-6": "A crate for the galley",
        "catch-uncommon-2": "Something off the usual list",
        "catch-rare-1": "One good specimen",
        "deliver-fen": "Word out to the flats",
        "deliver-rook": "A message for the marshal",
        "visit-wilds": "Walk the mast line",
        "visit-gathering": "Come by the cantina",
      }),
      lines: [
        line("settlement", "dawn", "stranger", "Shift change. Mind the deck plates, they sweat at this hour."),
        line("settlement", "dawn", "friend", "You beat the lights up. Come by later, I'll owe you a coffee."),
        line("settlement", "day", "stranger", "If you're after work, the terminal's posting.", "work"),
        line("settlement", "day", "friend", "They're saying the seal readings came back wrong again.", "rumor"),
        line("settlement", "dusk", "stranger", "Cycle's dimming. Most bays lock at amber."),
        line("settlement", "dusk", "friend", "Walk as far as the ring with me? It's on your route."),
        line("settlement", "night", "stranger", "Late cycle. Nothing's open but the cantina.", "place"),
        line("settlement", "night", "friend", "Couldn't sleep through the hum either. Nobody does at first."),
        line("gathering", "dawn", "stranger", "Galley's cold. Sit if you like."),
        line("gathering", "dawn", "friend", "First cup's yours. It's the real stuff, so don't advertise it."),
        line("gathering", "day", "stranger", "Bunk's a fair rate and the air's filtered twice.", "place"),
        line("gathering", "day", "friend", "There's a posting nobody's taken. Somebody ought to.", "work"),
        line("gathering", "dusk", "stranger", "Busiest hour on the ring. Mind your elbows."),
        line("gathering", "dusk", "friend", "Sit down, you look like a shift happened to you."),
        line("gathering", "night", "stranger", "Last of the pot. I'm not brewing again."),
        line("gathering", "night", "friend", "Stay for one more. The corridor will still be there.", "smalltalk"),
        line("wilds", "dawn", "stranger", "Dust hangs out here until the light burns it off."),
        line("wilds", "dawn", "friend", "The pools run better before the day crew is up.", "work"),
        line("wilds", "day", "stranger", "Keep to the marked line. It's marked for a reason."),
        line("wilds", "day", "friend", "Found a good spot past mast nine. I'll show you sometime.", "place"),
        line("wilds", "dusk", "stranger", "I'd turn back. Out here the light goes all at once."),
        line("wilds", "dusk", "friend", "One more run and we go. That's what you said last cycle."),
        line("wilds", "night", "stranger", "Something tripped a sensor. Probably grit. Probably."),
        line("wilds", "night", "friend", "Quiet out past the masts, isn't it. Good quiet."),
        line("workshop", "day", "stranger", "Watch the arc and keep off the bench."),
        line("workshop", "day", "friend", "Hold this — no, the other end. Thank you."),
        line("hall", "day", "stranger", "You can wait, but the answer will be the same next cycle."),
        line("hall", "day", "friend", "They'll log what you say. Whether they read it is another thing.", "rumor"),
        line("sanctuary", "day", "stranger", "Sit anywhere. Nobody's keeping the seats."),
        line("sanctuary", "day", "friend", "I come here to think and end up not thinking. It works."),
        line("dwelling", "day", "stranger", "These are somebody's quarters, you know."),
        line("dwelling", "day", "friend", "Hatch is open. Knock the dust off first."),
      ],
      escalation: [
        cast("Mira", "You heard about the readings, then? Ask me again when the galley's empty."),
        cast("Tam", "It isn't the filters. I've run filters. Ask me properly and I'll tell you."),
        cast("Rook", "I'm not paid to have opinions about it. Off shift, I have several."),
        cast("Fen", "I've seen what the dust is doing past the masts. Nobody logs that."),
      ],
      overheard: [
        heard("settlement", "…and command says the numbers came back nominal. Nominal!", "rumor"),
        heard("settlement", "…if the bay goes, we all go, is what I'm saying.", "rumor"),
        heard("gathering", "…third cycle running she's been up at that port.", "rumor"),
        heard("gathering", "…tell him yourself, then. I'm not filing it.", "smalltalk"),
        heard("wilds", "…swear the drift's deeper than it was.", "place"),
        heard("wilds", "…don't go past the beacon after dark, that's all I'll say.", "place"),
      ],
      _repairs: [],
    },
  };
})();

// ── The default pack's validation lane (plan §2.2f) ──────────────────────────
// Boot-asserted, in the skins' idiom (59-economy) and for the skins' reason: this
// artifact is only ever read on a day something else already went wrong — a
// declined generation, a chat older than the feature, a pack whose world moved
// under it — so a hole in it is a hole nobody meets until the worst moment. It is
// held to the same three facts the fold reads: both themes fold clean, every giver
// resolves, every target resolves.
{
  // THE DISJOINT NAMESPACES, first, because the shared matcher predicate rests on
  // them: a quest row carries its target as a bare STRING, and the grain is
  // recovered by asking whether the word is a catch role. A variant slug that was
  // also a role name would make that question unanswerable — every catch of that
  // role would pay a quest for one specific fish, silently and forever.
  const roles = new Set(PF.economy.CATCH_ROLES);
  for (const [theme, byTag] of Object.entries(PF.economy.CATCH_TABLES)) {
    for (const table of Object.values(byTag)) {
      for (const entry of table) {
        if (roles.has(entry.variant))
          throw new Error(
            `pixelforge: ${theme}'s "${entry.variant}" is both a catch variant and a catch role; the two namespaces must stay disjoint`,
          );
      }
    }
  }

  for (const theme of PF.art?.themeIds?.() ?? []) {
    const pack = PF.pack.defaults(theme);
    if (pack.theme !== theme)
      throw new Error(`pixelforge: the default pack for "${theme}" is written for "${pack.theme}"`);
    if (pack.briefHash !== 0)
      throw new Error(
        `pixelforge: the default pack for "${theme}" carries a brief hash, so a sealed world could adopt it`,
      );
    // The stock cast, read through defaults() rather than off a literal — the same
    // source of truth 20-world's legacy name book is held to, and for the same
    // reason: two tables in two files edited months apart is how a giver stops
    // existing in the world that is supposed to stand them up.
    const stock = new Set(PF.brief.defaults(theme, 1).cast.map((member) => member.name));
    if (pack.templates.length < PF.pack.TUNING.floorTemplates)
      throw new Error(`pixelforge: the default pack for "${theme}" is under its own template floor`);
    if (pack.lines.length < PF.pack.TUNING.floorLines)
      throw new Error(`pixelforge: the default pack for "${theme}" is under its own line floor`);
    for (const template of pack.templates) {
      if (!String(template.id).startsWith("b:"))
        throw new Error(`pixelforge: the default pack's "${template.id}" is not a world-free (b:) template`);
      if (!stock.has(template.giver))
        throw new Error(
          `pixelforge: the default pack's "${template.id}" is given by ${template.giver}, who is not in ${theme}'s stock cast`,
        );
      if (!PF.pack.MECHANICS.includes(template.verb))
        throw new Error(`pixelforge: the default pack's "${template.id}" asks for "${template.verb}"`);
      const grains = Object.keys(template.target ?? {});
      if (grains.length !== 1 || !PF.pack.TARGET_GRAINS.includes(grains[0]))
        throw new Error(`pixelforge: the default pack's "${template.id}" has no single grain-tagged target`);
      const [grain] = grains;
      const value = template.target[grain];
      // ROLE GRAIN, DELIBERATELY, for every catch row: a variant is a theme's own
      // word and a `b:` counter that means one thing in a valley and another in a
      // colony is not world-free at all.
      if (grain === "variant")
        throw new Error(`pixelforge: the default pack's "${template.id}" targets a variant, which is not theme-shared`);
      if (grain === "role" && !PF.economy.CATCH_ROLES.includes(value))
        throw new Error(`pixelforge: the default pack's "${template.id}" targets the role "${value}"`);
      if (grain === "npc" && !stock.has(value))
        throw new Error(`pixelforge: the default pack's "${template.id}" delivers to ${value}, who is not stock cast`);
      if (grain === "place" && !PF.pack.LOCATIONS.includes(value))
        throw new Error(`pixelforge: the default pack's "${template.id}" sends the player to "${value}"`);
      if (!template.title) throw new Error(`pixelforge: the default pack's "${template.id}" has no title`);
    }
    for (const row of pack.lines) {
      if (!PF.pack.LOCATIONS.includes(row.at) || !PF.pack.DAYPARTS.includes(row.when))
        throw new Error(
          `pixelforge: a default ${theme} line is keyed (${row.at}, ${row.when}), which is not an index cell`,
        );
      if (!PF.pack.REGISTERS.includes(row.r))
        throw new Error(`pixelforge: a default ${theme} line is written in the "${row.r}" register`);
      if (row.w !== undefined && !PF.pack.WEATHERS.includes(row.w))
        throw new Error(`pixelforge: a default ${theme} line is keyed for "${row.w}" weather`);
      if (row.topic !== undefined && !PF.pack.TOPICS.includes(row.topic))
        throw new Error(`pixelforge: a default ${theme} line is tagged "${row.topic}"`);
      if (!row.text) throw new Error(`pixelforge: a default ${theme} line has no text`);
    }
    for (const row of pack.escalation) {
      if (!stock.has(row.npc))
        throw new Error(
          `pixelforge: the default pack's escalation line for ${row.npc} names nobody ${theme} stands up`,
        );
    }
    for (const row of pack.overheard) {
      if (!PF.pack.LOCATIONS.includes(row.at))
        throw new Error(`pixelforge: a default ${theme} overheard line stands at "${row.at}"`);
    }
    // …AND IT FOLDS CLEAN AGAINST THE WORLD THAT WILL READ IT. The two chats this
    // artifact serves compile the LEGACY layout (a declined generation and a chat
    // older than the feature both reach `build(seed, theme, null)`), so that is
    // the world it is asserted against — every template surviving, because a
    // fallback that folds to nothing is the same empty board as no fallback.
    const folded = PF.pack.fold(null, { brief: null, world: PF.world.build(1, theme, null) });
    if (folded.ids.length !== pack.templates.length)
      throw new Error(
        `pixelforge: only ${folded.ids.length} of ${theme}'s ${pack.templates.length} default templates survive the fold into a default world`,
      );
  }
}
