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
// AND THE BOARD READS FROM HERE (0.13 §2.1). The fixture 20-world stands up in
// every settlement is this artifact's surface: `boardOffers` says what today's
// board is showing, `accept` takes a row and `turnIn` hands one in, and
// `rowText` is the one function that turns a quest row into words anywhere in
// the package (the quest tab reuses it verbatim). They live beside the schema
// rather than beside the economy's verbs because every number and identity they
// spend — K, the reward derivation, the instance id, the daily selection, the
// board constant — is written in this file, and a surface one module along would
// have to reach across for all of it. The MUTATION SHAPE is 59-economy's, though:
// describe first, re-read at the press, and put every effect through a shipped
// mutator in an order that cannot half-pay anybody.
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
  // THE WEATHER AXIS, and 17-weather is its authority — the DAYPARTS idiom one
  // line up, and legal here for the same reason: 17 loads before 61, so this is
  // a forward read and a backward one would be a TypeError at load rather than a
  // second list quietly disagreeing with the sky.
  //
  // AN ABSENT `w` READS AS ANY WEATHER, which is the generalization of the
  // "absent reads as fair" this line used to say while fair was the only value
  // there was. The first reader defines read semantics, and §2.6's is: a line
  // with no `w` is served under every sky, a line tagged `rain` is served under
  // any rain — the axis is the five WORDS and an intensity never enters it.
  // Optional on purpose, and that is still a byte argument: a generation made to
  // spell a word on every line would spend a tenth of its budget on it.
  const WEATHERS = PF.weather.WORDS;
  // THE SKY WORDS THE GUIDANCE ASKS FOR: the five, less the one an untagged line
  // already covers. An absent `w` is served under every sky, so a line tagged
  // `fair` spends four characters buying the generalization it had for free. The
  // SCHEMA still seals all five — a model that writes one is honoured rather than
  // repaired — and the foot of this file pairs the two lists so dropping a second
  // word here is a throw at load and not a vocabulary quietly narrowing.
  const WEATHERS_ASKED = WEATHERS.filter((word) => word !== "fair");
  // THE E7 TOPIC SEAM (plan §2.2c). Optional per line, defaulting to NONE, and it
  // is the tree's four branches: rumor and work are the two the window is
  // load-bearing for, place and smalltalk are the ones it opens with. 0.13's
  // guidance asked for two of them and the schema sealed four; 0.14 is the
  // release that ends that diet, because every release it waited was a cohort of
  // worlds sealed thin on exactly the tags the window renders.
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
  // budget is the generation FIT (`TUNING.floorBasis` and the digest split, both
  // below). These are hygiene caps applied at seal: a sealed blob never grows, so
  // what they bound is what one call is allowed to hand us, not what a save is
  // allowed to hold. `templates` is load-bearing in the floor arithmetic too — it
  // is the cap a templates-first truncation may have filled before the cut.
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
  // written HERE with its own reason, so a retune is one file. Slice 3 spends K;
  // the reward rows below are what slice 3 copies into a row at accept.
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
    // cover the load-bearing half.
    //
    // WHERE THE TWO NUMBERS COME FROM (plan §2.2b). The binding case is the
    // #5135 output floor: a connection that gives us the minimum cuts the
    // emission's TAIL at 2,048 tokens, `salvageText` closes what is open, and
    // whatever templates-first order the model actually honoured is what
    // survives. Every line is costed TAGGED — and from 0.14 that means costed
    // with the SKY term too, which is where the extra ten characters a row went:
    //
    //   the truncation wall (#5135, connections may undercut) ....  2,048 tokens
    //   dense punctuation-heavy JSON, at three chars to the token .  6,144 chars
    //   the envelope (`{"templates":[`, `],"lines":[`, the close) .    -40 chars
    //   templates emit FIRST and may fill their own cap: 24 × 150 . -3,600 chars
    //   …so the index is left with ...............................   2,504 chars
    //   a TAGGED line row costs about 140, which buys ............      17 lines
    //   less the trailing partial row the salvage trims ..........      16 lines
    //
    // THE TWO ROW COSTS ARE MEASURED DENSITY, NOT THE SCHEMA'S MAXIMUM, and
    // that distinction is the whole standing of the sum. Serialized, the default
    // pack's own rows run 112-137 chars a template (mean 121) and 97-151 chars a
    // line with every one costed tagged (mean 126), across both themes — so 150
    // sits above even the widest template measured, and 140 sits above the MEAN
    // line and under the widest, which is what a density figure is: what a
    // typical row costs, and not a ceiling. What the schema ALLOWS is far bigger: a
    // 32-char slug, a 24-char giver, a 32-char variant and a 48-char title make
    // a 217-char template, and a 200-char line carrying BOTH tags — the topic and
    // the 0.14 sky term — is 294 serialized on the widest handle LOCATIONS names
    // ("settlement", ten characters), measured and pinned. So what the
    // sum shows is that the floors CLEAR A TYPICAL TEMPLATES-FIRST CUT, and it
    // is not a worst-case guarantee. It cannot be one and keep these floors:
    // 24 × 217 leaves 896 chars of index, which is two rows, and a floor sized
    // from that would have to be M ≤ 2.
    //
    // SO THE RESIDUAL IS WRITTEN DOWN RATHER THAN ROUNDED OFF. A floor
    // connection (2,048 effective tokens) whose model writes near the schema's
    // cap on every row — a full template block and 200-character dialogue —
    // comes back with an index this floor refuses, on every attempt, and the
    // retry screen is that player's honest state rather than a bug in the
    // arithmetic. That is the degrade ladder's own posture (plan §2.2b): floor
    // connections get a thin pack BY DESIGN, an accepted limitation with the
    // ladder as their normal path, and the sizing TARGET is the typical ~4K
    // ceiling, where the same emission clears with room to spare. The max-shape
    // lane in the harness pins it, so it stays a known cost rather than
    // something the next reader rediscovers against a comment that denied it.
    //
    // Sixteen lines and twenty-four templates against floors of ten and three:
    // a typical cut at this wall still seals, and a pack that came back with a
    // quarter of an index still fails. `floorBasis` carries the inputs so the
    // lane that re-runs the sum cannot drift from the table.
    //
    // ── WHY TEN AND NOT TWELVE (ruled, and irreversible in one direction) ─────
    // The floor was twelve, and the live measurement is the reason it moved: a
    // real floor-connection emission landed ON twelve, and 0.14 makes every line
    // about eight percent costlier — four topic values instead of two, the sky
    // term, a wider digest ahead of it. Held at twelve, that eight percent is the
    // difference between a thin pack and a retry screen the player cannot get
    // past, on the connections least able to try again.
    //
    // IT IS AN ACCEPTANCE BOUNDARY AND NOT A TUNING KNOB, which is why it is
    // stated here rather than moved quietly. This number decides which
    // generations become PERMANENT ARTIFACTS: lowering it seals packs that would
    // have failed, and those packs are stored forever. Nothing already sealed
    // moves; what moves is the next cohort.
    //
    // AND THE INVERSION IT ACCEPTS, said where it bites. A ten-line pack under
    // the live distribution renders one topic branch at the talk window, maybe
    // two. The enrichment that gives a legacy world all four cannot reach it —
    // `fold()` is `sealed ?? defaults`, so a world with its own pack reads its own
    // pack — so this floor is also the line under which a paid generation talks
    // less than a world that never generated at all. The trade was taken with
    // that stated: a thin pack written for THIS settlement beats a rich one
    // written for nobody, and the way out is a wider generation rather than a
    // blend.
    floorTemplates: 3,
    floorLines: 10,
    floorBasis: { truncTokens: 2_048, charsPerToken: 3, envelopeChars: 40, templateChars: 150, lineChars: 140 },
    // ── The reward derivation (plan §2.6, RULED) ──────────────────────────────
    // MONEY IS DERIVED FROM (verb, n) AND THE PACK NEVER AUTHORS IT — the schema
    // excludes money and xp, the seal drops both, and `rewardFor` below is the
    // one place a number is minted. Single authority, the economy's own rule:
    // a retune moves future accepts and leaves accepted deals honored, because
    // slice 3 copies `r` into the row at accept.
    //
    // Priced against the two things 0.11 sells, since quest income is the only
    // income there is (59-economy PRICES: a 12-coin berth, a 6-coin fantasy entry
    // rod, a 40-coin decent rod, a 40-coin starting purse):
    //   visit   6 flat — one walk, no call, and exactly the entry rod: the first
    //                    errand a player runs pays for the thing that starts
    //                    fishing.
    //   deliver 10 flat — a walk plus the handover, and the handover is the one
    //                    quest verb that spends a GM call (plan §2.3).
    //   catch   5 + 4n — n is the only lever the ruling leaves (a rare fish and a
    //                    common one pay the same per fish; the RARITY already
    //                    pays, in the skill the catching raises). n=3 is 17, which
    //                    covers a berth with change; n=20, the cap, is 85, which
    //                    is about a full day at the water (59-economy's pacing
    //                    note: ~22 yields in a ten-hour day).
    // THERE IS NO xp ROW HERE AND THERE NEVER WILL BE. Quests do not grant skill
    // experience — the TASK raises the skill, through the site that does the work
    // — so `rewardFor` returns xp 0 structurally rather than reading a number
    // somebody could retune off zero.
    reward: {
      catch: { base: 5, per: 4 },
      deliver: { base: 10, per: 0 },
      visit: { base: 6, per: 0 },
    },
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

  // ── The #5135 walls this call is composed against (FROZEN) ──────────────────
  // Not tuning and not ours: they are the route's, they are the same three the
  // brief call is written to, and they are written down here because the digest
  // split below is arithmetic ON them. `userContent` is capped at 8,000 chars and
  // the route 400s past it; `instructions` at 16,000; the schema at 8,000
  // SERIALIZED and it is ADVISORY on Anthropic and the sidecar — the tolerant
  // parser is the contract, which is why seal-time validate() is the only one.
  const USER_CONTENT_CAP = 8_000;
  const INSTRUCTIONS_CAP = 16_000;
  const SCHEMA_CAP = 8_000;
  // What the split holds back from the cap for its own joiner and ellipsis, and
  // for a route that counts a byte we do not. 18-brief clips preferences at 7,800
  // against the same 8,000 for the same 200-char reason; this is that margin,
  // named rather than spelled, because here it is subtracted from a running total
  // instead of from a constant.
  const USER_CONTENT_MARGIN = 200;

  /** THE DIGEST — the world this pack is being written FOR, in the model's own
   *  reading order (plan §2.2b). It goes FIRST in `userContent` and the player's
   *  preferences clip against what is left, and that order is the whole design:
   *  the pack's job is to sound like THIS settlement's people, so the facts it
   *  must not contradict are the ones that may never be the half that gets cut.
   *
   *  PERSONA IS IN IT BECAUSE PERSONA IS THE VOICE SOURCE. A cast list of names
   *  and roles produces dialogue that could be anyone's; "wants the ford rebuilt
   *  and is hiding who let it go" is what makes a line sound like Wren Ash. It is
   *  also the single biggest field here (100 chars × a cast of ten), which is why
   *  the worst case is measured rather than hoped at:
   *
   *    the settlement's name row and the two section headers ............    201
   *    the situation, with its lead-in (18-brief caps the field at 240) .    270
   *    the two climate rows, at their widest (temperate/moderate) ......    136
   *    the zone list: the root plus 4 places × (name 24 + kind + dashes) .    189
   *    the cast: 10 × (name 24 + role 24 + home 24 + persona 100 + 18) ..  1,900
   *    the newlines joining the twenty-three rows ......................     22
   *                                                                       ------
   *                                                                        2,718
   *
   *  …which is the plan's ~2.5K, and it leaves better than 5,000 chars of the cap
   *  for the player's own words. 2,718 is MEASURED and not estimated: the harness
   *  searches for the biggest digest a legal brief can produce — every field at
   *  its cap, in tokens with no space near the cut so `capText` clips at the cap
   *  exactly rather than at a word boundary short of it — and pins the number, so
   *  this table cannot drift away from the code beneath it.
   *
   *  AND THOSE CAPS ARE APPLIED HERE, WHICH IS WHAT MAKES THE TABLE A BOUND
   *  RATHER THAN AN EXPECTATION. Every field above is read back through the
   *  brief's OWN `capText` at the brief's OWN number — 24 for a name, a role, a
   *  home or a place, 100 for a persona, 240 for the situation — because this is
   *  a read door over a stored artifact and `foldStoredTemplate`'s header already
   *  says what that means: the brief this composes from is round-tripped chat
   *  metadata, and 18-brief's byte budget bounds what IT wrote, not what a
   *  hand-edited save or a forward build with a wider cap hands back. Read time
   *  may only FOLD (#566's seam posture), so oversize CLIPS here rather than
   *  costing the row the way the seal would drop it.
   *
   *  It is not only a length guard. `capText` sanitizes on the way through, so a
   *  round-tripped persona carrying a tag fragment, a control byte or an EMBEDDED
   *  NEWLINE cannot ride into `userContent` — and the newline is the one that
   *  matters structurally rather than cosmetically, because the section below
   *  promises the model one row per person and a raw newline in a persona is a
   *  second row with nobody's name on it.
   *
   *  IT NAMES THE PLACE KINDS OUT LOUD, and that is not decoration: a place's
   *  `kind` IS the location handle the index is keyed by (LOCATIONS above), so
   *  the list teaches the mapping from "The Amber Hearth Inn" to `gathering` in
   *  the same breath that it teaches the inn exists. Without it the model has to
   *  guess which of seven handles a name belongs under, and a guessed handle is a
   *  line that never renders anywhere.
   *
   *  ── THE CLIMATE, AND WHY IT IS A SECOND ARGUMENT ─────────────────────────
   *  `axes` is `{latitude, precipitation}` and the two rows it renders exist so a
   *  generation does not solicit snow lines for a jungle. It is an ARGUMENT and
   *  not a field on the brief because this function receives only the brief, and
   *  a world's climate is a derivation off (brief hint, seed, theme) that lives in
   *  17-weather — computing a theme default here would be a second authority for
   *  the sky, disagreeing with the first on every world whose brief named nothing.
   *
   *  ABSENT MEANS OMITTED, both rows, and that is a legal call: it is 0.13's own
   *  shape, and a caller with no climate to state should say nothing rather than
   *  make one up. The shipped compose site always resolves one.
   *
   *  THE SECOND ROW IS DERIVED AND NOT A TABLE. `wordsFor` walks the same weight
   *  rows `at()` draws from, so the sentence describes the sky this world will
   *  actually have — including the honest cases nobody would write down by hand,
   *  like both two-season structures having no snow at any precipitation.
   *
   *  AND THE ROWS ARE A BELT, NOT A FOLD. Everything rendered here goes through
   *  `capText` exactly as every other row does, because the object handed in is
   *  the same untrusted channel the brief came off: a nine-thousand-character
   *  latitude clips to 24 and cannot eat the cast list, and no value can inject a
   *  second row. What guarantees the words are a REAL climate is the fold at the
   *  compose site (`axesFor`), one screen up — the belt only guarantees that a
   *  hostile one cannot damage the request. */
  function digest(brief, axes) {
    const cast = Array.isArray(brief?.cast) ? brief.cast : [];
    const places = Array.isArray(brief?.places) ? brief.places : [];
    const name = capText(brief?.name, 24) || "the settlement";
    const out = [`The settlement is ${name}.`];
    const situation = capText(brief?.situation, 240);
    if (situation) out.push(`What is unresolved right now: ${situation}`);
    // THE OPENING BLOCK IS WHERE THEY LAND. It takes plain pushes and has no
    // separator convention to violate, and — the reason it is not a tail append —
    // a row parked under the PEOPLE header reads as an eleventh cast member, which
    // is the mistake this file's own section comment warns about.
    const latitude = capText(axes?.latitude, 24);
    const precipitation = capText(axes?.precipitation, 24);
    if (latitude && precipitation) {
      out.push(`Climate: ${latitude} latitude, ${precipitation}.`);
      out.push(
        `Weather runs to: ${PF.weather.wordsFor(latitude, precipitation).join(", ")}` +
          ` — write no line for a sky this world never has.`,
      );
    }
    out.push("", "PLACES — the second word is the location handle a line is keyed by:", `- ${name} — settlement`);
    for (const place of places) {
      const placeName = capText(place?.name, 24);
      if (!placeName) continue;
      out.push(`- ${placeName} — ${foldEnum(place?.kind, LOCATIONS, "dwelling")}`);
    }
    out.push("", "PEOPLE — use these names EXACTLY; givers and speakers come from this list and nowhere else:");
    for (const member of cast) {
      const who = capText(member?.name, 24);
      if (!who) continue;
      const role = capText(member?.role, 24);
      const home = capText(member?.home, 24);
      const persona = capText(member?.persona, 100);
      out.push(
        `- ${who}${role ? `, ${role}` : ""}${home ? `, lives at ${home}` : ""}${persona ? ` — ${persona}` : ""}`,
      );
    }
    return out.join("\n");
  }

  /** The digest first, then whatever room is left for the player's own setting
   *  text. The route 400s past 8,000 chars, so this is a hard clip and not a
   *  preference: an unbounded wizard Setting must cost the player the tail of
   *  their own description rather than the whole request.
   *
   *  The brief call clips at a CONSTANT 7,800 because it sends nothing else; this
   *  one subtracts the digest first, so the same margin is arithmetic here. The
   *  preferences are what lose their tail: the digest is the half the pack must
   *  not contradict, so it is cut only when it is the thing that does not fit.
   *
   *  AND IT CAN BE. The brief this composes from is the STORED one on the
   *  pack-only arm — 60-save hands `_configBrief`'s answer straight through, and
   *  that is a round-tripped object off chat metadata, not the one the seal
   *  produced. 18-brief's own byte budget bounds what IT writes; it bounds
   *  nothing about a hand-edited save or a forward build whose cast cap is
   *  wider. A digest over the cap would 400 the route on every attempt and hand
   *  that chat a retry button that can never work, so it clips like everything
   *  else here and the request stays legal. */
  function composeUserContent(digestText, preferences) {
    const headRoom = USER_CONTENT_CAP - USER_CONTENT_MARGIN;
    const head = digestText.length > headRoom ? digestText.slice(0, headRoom) : digestText;
    const room = USER_CONTENT_CAP - head.length - USER_CONTENT_MARGIN;
    const prefs = typeof preferences === "string" ? preferences : "";
    if (!prefs.trim() || room <= 0) return head;
    const clipped = prefs.length > room ? `${prefs.slice(0, room)}…` : prefs;
    return `${head}\n\nWHAT THE PLAYER ASKED FOR:\n${clipped}`;
  }

  // ── guidance(): the exact text that ships in the second call ────────────────
  /** 18-brief's `guidance` one call later, and written to the same three rules:
   *  the vocabularies are INTERPOLATED from the constants above so the enum and
   *  the teaching can never drift, every limit is stated as hard, and the reply is
   *  a bare JSON object.
   *
   *  EMISSION ORDER IS BEST-EFFORT AND SAID SO. Templates first, then the index,
   *  then the two smaller sections — because the truncation wall eats the TAIL,
   *  and the floor arithmetic (TUNING.floorBasis) is computed against a cut that
   *  honoured this order. Nothing enforces it: `schema()` lists its properties in
   *  the same order and the sentence below asks for it out loud, and both are
   *  hints a provider is free to ignore (the schema is ADVISORY — #5135). What
   *  makes a disordered emission survivable is not this paragraph, it is that the
   *  floor is a seal/fail boundary: a cut that lost the templates fails, holds
   *  the gate, and the retry is free.
   *
   *  TITLES NAME THE WORK AND NOT ONE ADDRESS, and that line is here rather than
   *  in the schema because it is a WORDING rule and nothing can validate it. A
   *  `visit` target is a location HANDLE — the KIND of place — and `visited()`
   *  settles the row on arrival at ANY zone carrying it, which is the design and
   *  not a slip: the mechanical fallback line ("travel to wilds") is honest about
   *  it. A generated title that named one of them instead ("Walk out to North
   *  Wood") would be the only surface in the package promising an address the row
   *  never asked for, and the player would fill it somewhere else and be right.
   *  The default pack already writes titles this way; this is the sentence that
   *  asks a generated one to.
   *
   *  THE BYTE DIET IS OVER, AND THIS IS THE RELEASE THAT ENDED IT (plan §2.7).
   *  0.13 confined the topic tags it asked for to rumor|work while the schema
   *  sealed all four, on the argument that `place` and `smalltalk` bought nothing
   *  a release could read yet — with the note that the schema seals forever and
   *  the guidance can be rewritten next release. The window is here, it renders
   *  all four branches, and every release the diet ran was a cohort of worlds
   *  sealed thin on the two tags the tree opens with. So the guidance now asks for
   *  the whole vocabulary, and the four characters a tag costs are the cheapest
   *  thing in this request.
   *
   *  THE SKY TAG IS THE ONE THAT STAYS OPTIONAL AND SAYS SO OUT LOUD. `w` is asked
   *  for as an exception rather than as a field: a town's dialogue is mostly what
   *  it says whatever the weather, and a generation that tagged every line would
   *  hand back a pack whose topic branches vanish on the first fair day. The
   *  guidance asks for a handful; the coverage the window depends on is untagged.
   *
   *  AND THE REGISTER ASK IS LEVEL AGAIN (0.15). The ask has swung twice with
   *  the read side — 0.13 asked friend-heavy for a register nothing served,
   *  0.14 inverted to stranger-heavy because stranger was all it read — and
   *  0.15 is where both finally serve: stranger to everyone, friend to anyone
   *  the ladder has reached friendly with (58-player §13). So the ask leans
   *  stranger still — most of a town does not know the player, and the stranger
   *  register is every speaker's floor — but the friend lines are now bought
   *  for a reader that exists, and the guidance says who reads them instead of
   *  promising a later release. */
  function guidance(theme) {
    return [
      "You are writing an OFFLINE CONTENT PACK for a settlement that already exists: what its people say,",
      "and the work they post on the board. Reply with ONLY a JSON object.",
      "",
      `The visual theme is "${theme}" and it is AUTHORITATIVE: everything you write is dressed to fit it.`,
      "The settlement, its places and its people are given below and are FIXED. Do not invent a person, a",
      "place or an event that contradicts them; you are writing what is already there, not deciding it.",
      "",
      "Write the sections IN THIS ORDER — templates, then lines, then escalation, then overheard. If you",
      "run out of room, it is the LAST section that should be short.",
      "",
      "- templates: the work the board posts. Each is {slug, giver, verb, target, n, title}.",
      "    giver: the NAME of one of the people listed below, spelled exactly. Nobody else can post work.",
      `    verb: one of ${VERBS.join(" | ")}. Nothing else exists — there is no combat and no crafting.`,
      "    target: ONE of these four shapes, and it must match the verb:",
      `      {"role": …}    for gather/catch — one of ${PF.economy.CATCH_ROLES.join(" | ")} (any catch of that kind counts)`,
      '      {"variant": …} for gather/catch — one exact species this theme has',
      '      {"npc": …}     for deliver — the NAME of another person on the list (an errand: a word carried, not an object)',
      `      {"place": …}   for visit — one of ${LOCATIONS.join(" | ")}`,
      "    n: how many to catch, 1-20. Always 1 for deliver and visit.",
      "    title: what the board row reads, <=48 characters of plain text. Name the WORK, not ONE address —",
      "      any place of the kind named finishes a visit, so a title promising a particular one can mislead.",
      "    NEVER write money, pay, a price, a reward or experience. The game decides what work is worth.",
      "- lines: what somebody standing in a place says, keyed so the right line reaches the right moment.",
      "    Each is {at, when, r, text} plus an optional topic and w.",
      `    at: one of ${LOCATIONS.join(" | ")} — the handle beside each place below.`,
      `    when: one of ${DAYPARTS.join(" | ")}.`,
      `    r: ${REGISTERS[0]} (they barely know you) or ${REGISTERS[1]} (they do).`,
      `    topic (optional): one of ${TOPICS.join(" | ")} — tag every line that fits one; rumor and work matter most.`,
      `    w (optional): one of ${WEATHERS_ASKED.join(" | ")} — ONLY for a line that needs that sky;`,
      "      most lines should work any day, so leave it off unless the weather is what the line is about.",
      "    text: ONE spoken line, <=200 characters. No name tags, no quotation marks, no stage directions.",
      `    Cover the places and hours somebody would actually be there. Lean ${REGISTERS[0]} — most of the`,
      `    town does not know the player — but write real ${REGISTERS[1]} lines too: they are served the`,
      "    moment somebody counts the player a friend, and they are where this place stops sounding like a signpost.",
      "- escalation: ONE line per person, {npc, text}: the thing they say when the player asks properly",
      "    about the unresolved situation above — the door, not what is behind it. Keep it withholding.",
      "- overheard: {at, text} — half of somebody else's conversation, heard in passing. Nobody answers it.",
      "",
      "Everything is in the player's language. Write people who want things and are inconvenient about it.",
    ].join("\n");
  }

  /** The advisory schema. Property order is the emission order the guidance asks
   *  for out loud, for the same reason and with the same standing: a hint, not a
   *  guarantee. `strictSchema` is NEVER SET on this call and stays false — it is
   *  unavailable to additionalProperties schemas and this is one, so the tolerant
   *  parser is the contract and validate() is the enforcement. */
  function schema() {
    const text = (maxLength) => ({ type: "string", maxLength });
    return {
      type: "object",
      properties: {
        templates: {
          type: "array",
          maxItems: CAPS.templates,
          items: {
            type: "object",
            properties: {
              slug: text(CAPS.slug),
              giver: text(24),
              verb: { type: "string", enum: VERBS },
              target: {
                type: "object",
                properties: {
                  role: { type: "string", enum: PF.economy.CATCH_ROLES },
                  variant: text(CAPS.slug),
                  npc: text(24),
                  place: { type: "string", enum: LOCATIONS },
                },
              },
              n: { type: "integer", minimum: 1, maximum: CAPS.n },
              title: text(CAPS.title),
            },
            required: ["giver", "verb", "target", "title"],
          },
        },
        lines: {
          type: "array",
          maxItems: CAPS.lines,
          items: {
            type: "object",
            properties: {
              at: { type: "string", enum: LOCATIONS },
              when: { type: "string", enum: DAYPARTS },
              r: { type: "string", enum: REGISTERS },
              text: text(CAPS.text),
              topic: { type: "string", enum: TOPICS },
              // THE SKY TERM, SEALED FROM 0.14 ON. Legal for NEW packs only — a
              // 0.13 pack carries none and reads as any-weather, which is the
              // read door's own semantics and why nothing had to migrate. Beside
              // `topic` because property order is the emission order the guidance
              // asks for out loud, and these are the two optional tags a line
              // carries. `required` is untouched: both stay optional forever.
              w: { type: "string", enum: WEATHERS },
            },
            required: ["at", "when", "r", "text"],
          },
        },
        escalation: {
          type: "array",
          maxItems: CAPS.escalation,
          items: {
            type: "object",
            properties: { npc: text(24), text: text(CAPS.text) },
            required: ["npc", "text"],
          },
        },
        overheard: {
          type: "array",
          maxItems: CAPS.overheard,
          items: {
            type: "object",
            properties: { at: { type: "string", enum: LOCATIONS }, text: text(CAPS.text) },
            required: ["at", "text"],
          },
        },
      },
      required: ["templates", "lines"],
    };
  }

  return {
    VERSION,
    BOARD,
    LOCATIONS,
    DAYPARTS,
    REGISTERS,
    WEATHERS,
    WEATHERS_ASKED,
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

    // ── The reward, derived (plan §2.6, RULED) ───────────────────────────────
    /** What a template's (verb, n) is worth, and the ONLY place in the package a
     *  quest reward number is minted. The pack never authors one — the schema
     *  excludes money and xp and the seal drops both — so a row's `r` is a
     *  function of two fields this build already trusts.
     *
     *  xp IS ZERO BY CONSTRUCTION AND NOT BY A ZERO IN A TABLE. Quests never
     *  grant skill experience (the maintainer's reward ruling): a catch quest
     *  levels fishing because the CATCHING does, through fish()'s own award, and
     *  the quest's reward is money and the giver's rapport. The wire field stays
     *  — the row is a closed eight-field literal and dropping `xp` would be a
     *  format change for nothing — but there is no reward row to read it from and
     *  no path here that can write it non-zero. The completion site passes no
     *  verb to award(), which drops a hostile row's planted xp at the gate; this
     *  is the half that makes an honest row's xp zero in the first place.
     *
     *  A verb with no row — one this build cannot mint anyway — is worth nothing
     *  rather than a default, and the lookup is an own-key one because `verb` is
     *  a string off a stored artifact (00-prelude says why once). */
    rewardFor(verb, n) {
      const row = PF.own(TUNING.reward, str(verb));
      if (!row) return { money: 0, xp: 0 };
      const count = PF.clamp(Math.round(Number(n) || 1), 1, CAPS.n);
      return { money: row.base + row.per * count, xp: 0 };
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
      // ── BACKFILL, AFTER THE FLOOR AND NEVER BEFORE IT (plan §2.2b) ──────────
      // The rule is that backfill may cover a small gap in a pack that is already
      // substantive and may never be the thing that got a pack over the line. A
      // pack that needed topping up to pass would be a hollow one sealed forever
      // with our own words in it, which is exactly the trade the floor exists to
      // refuse.
      //
      // WHAT MAKES THAT TRUE IS FIELD DISJOINTNESS, NOT THIS ORDERING. The floor
      // above reads `templates` and `lines`; the backfill below writes `overheard`
      // and nothing else, so moving these two blocks past each other would not
      // change a verdict — the sections do not overlap. The order still belongs
      // here because it states the rule where a reader meets it, and because the
      // day somebody widens the backfill is the day the order becomes the only
      // thing standing between a hollow pack and a permanent seal.
      //
      // AND IT IS SCOPED TO `overheard`, WHICH IS THE ONLY SECTION THAT CAN
      // HONESTLY TAKE IT. Templates and the line index are the floor's own two
      // halves — the load-bearing ones — and topping either up would be stock
      // content pretending to be this world's. `escalation` cannot take it
      // either, for the content fence's reason: those rows name a PERSON, and
      // the only names the fallback has are the four stock residents this world
      // has never heard of. Overheard is the one pool with no speaker in it —
      // half a conversation, keyed to a place and attributed to nobody — so the
      // fallback's rows are as true in a generated settlement as in a default
      // one, and a world with none of them has a real hole where E1's ambience
      // goes.
      if (pack.overheard.length === 0) {
        pack.overheard = this.defaults(theme).overheard;
        repairs.push("overheard: empty, backfilled from the default pack");
      }
      pack._repairs = repairs;
      // `seed` stays reserved. The backfill that came did not need entropy — it
      // copies a fixed pool wholesale rather than choosing from one — and a seed
      // spent to shuffle rows a later reader will hash over anyway would be
      // determinism theatre.
      void seed;
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
     *  when nothing resolves — the caller drops the row.
     *
     *  THE VERB IS A KEY OFF AN UNTRUSTED STRING, so the lookup goes through
     *  `PF.own` (00-prelude says why once for the whole package). A bare
     *  `GRAINS_FOR_VERB[verb]` handed back Object.prototype for "__proto__" and a
     *  function for "constructor" or "toString" — all of them non-nullish, so the
     *  `??` could not fire and the `for…of` under it threw "allowed is not
     *  iterable" instead of refusing the row. An unknown verb and a hostile one
     *  are the same answer here: no allowed grain, nothing resolves, null. */
    foldTarget(raw, verb, { cast, theme }) {
      const allowed = PF.own(GRAINS_FOR_VERB, verb) ?? [];
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
     *  2. THE SELECTABLE SET, through `foldStoredTemplate` — the row-level door
     *     where a stored template is answered for in full. Never offered is never
     *     accepted is never repair-dropped, so the dangling row the repair pass
     *     exists to catch is one this set can no longer mint.
     *  3. THE SORTED IDS. The daily selection hashes over the SORTED SET of
     *     surviving ids and never over post-fold ordinals, so what a given day
     *     offers is a function of the surviving SET and not of the order the
     *     artifact happens to list it in: two builds that fold the same templates
     *     out of the same pack post the same board on day 12, whatever order the
     *     stored array or a re-serialization put them in.
     *
     *     What it deliberately does NOT buy is stability across a CHANGE of that
     *     set. The selection is a Fisher-Yates shuffle of the whole pool, so a
     *     template folding out shortens the pool and reshuffles it — every day's
     *     offers move, not just the ones that template was on. That is benign and
     *     of a piece with a demotion: both are content facts, neither touches a
     *     live row, and a board the player has not walked up to yet owes them no
     *     particular day.
     */
    fold(stored, { brief, world }) {
      const theme = str(world?.theme) || "cozy-village";
      const briefHash = PF.player.briefHashOf(brief);
      // A PACK IS SEALED AGAINST A BRIEF, AND HASH ZERO IS NOT A BRIEF. It is what
      // `briefHashOf` answers for a world that has none, and it is the DEFAULT
      // pack's own sentinel (below) — so on a brief-less world the equality would
      // hold for any artifact carrying the sentinel, and a foreign or hand-written
      // pack would adopt as that world's own sealed content. Never-sealed is the
      // only honest reading of a hash that means "there was nothing to hash".
      const sealed =
        briefHash !== 0 &&
        stored &&
        typeof stored === "object" &&
        Array.isArray(stored.templates) &&
        stored.briefHash === briefHash
          ? stored
          : null;
      const demoted = !!stored && !sealed;
      // `sealed ?? defaults` IS AN INVERSION AND IT IS ACCEPTED, said here because
      // this line is where it happens. The default packs carry the 0.14 coverage
      // floor — two stranger lines per (handle × topic), so all four talk-window
      // branches render — and a world that SUCCEEDED at generation reads none of
      // it: a thin sealed pack that only cleared the line floor renders one or two
      // branches, and no enrichment written here can reach it. So a legacy world
      // and a declined generation are the RICHER conversation this release, and
      // the world that paid for a pack is the poorer one. The fix is a wider
      // generation, not a merge — a fallback blended into sealed content would
      // put the stock cast's sentences in a stranger town's mouths.
      const pack = sealed ?? this.defaults(theme);
      const known = new Set();
      for (const zoneId of Object.keys(world?.zones ?? {})) {
        for (const npc of world.zones[zoneId]?.npcs ?? []) if (npc?.name) known.add(npc.name);
      }
      const byId = new Map();
      for (const template of pack.templates) {
        const row = this.foldStoredTemplate(template, { known, theme });
        if (row) byId.set(row.id, row);
      }
      return {
        pack,
        source: sealed ? "sealed" : "default",
        demoted,
        // WHO STANDS IN THIS WORLD, kept rather than thrown away. It is built
        // here anyway (the giver fence above spends it once per template), it is
        // rebuilt exactly when the world is, and the completion path needs the
        // same answer for one name: is there anybody left to file this under and
        // to thank. 58-player's repair pass builds its own copy on purpose — that
        // one runs BEFORE there is a sim to hang a fold on.
        known,
        byId,
        ids: [...byId.keys()].sort(),
        // Memo slot for the daily selection, keyed by day (see selection()).
        _day: -1,
        _offers: [],
      };
    },

    /** ONE STORED TEMPLATE, ANSWERED FOR AT THE READ DOOR — the pack's twin of
     *  18-brief `foldStored` (#566), and it exists for that seam's exact reason:
     *  validate()'s guarantees are SEAL-TIME and do not survive the round trip
     *  through chat metadata. THE STORED PACK IS UNTRUSTED HERE. It reaches this
     *  door from a forward-build client (the schema widens — L2's weather word,
     *  pack-v2 — and an older client keeps carrying the key by design), from
     *  another device, and from a hand-edited or foreign chatMeta; and every field
     *  below is one this build then SPENDS: `verb` picks which progress site
     *  advances the row, `target` flattens to the bare string the matcher reads,
     *  `n` is a number a player is asked to reach, `title` renders into a board
     *  row and the quest tab.
     *
     *  THE SEAM POSTURE IS #566'S, unchanged: seal time may DROP, read time may
     *  only FOLD. So a STRUCTURAL failure — a verb with no site, no single
     *  resolvable grain, a giver nobody stands up — folds the row OUT of the
     *  selectable set, which costs this world an offer and costs the artifact
     *  nothing; and SCALAR excess CLAMPS and CLIPS rather than costing the row.
     *
     *  `gather` FOLDS TO `catch` HERE TOO, and that is a deliberate call rather
     *  than an oversight: the word is a synonym for the mechanic, the seal already
     *  answers it that way, and the fold is one own-key lookup. A row that reached
     *  storage unfolded — sealed by a build whose table read differently, or
     *  hand-written — is answered rather than dropped over a word.
     *
     *  AND IT ALWAYS RETURNS A COPY, never the stored object. The row it hands
     *  back is the closed six-field shape validate() emits, so a stored `r` (the
     *  reward the schema excludes and TUNING derives) or any other key a hostile
     *  save invented is UNREACHABLE from everything downstream, rather than riding
     *  into the offer layer on an object nobody re-read. */
    foldStoredTemplate(stored, { known, theme }) {
      if (!stored || typeof stored !== "object") return null;
      const id = str(stored.id);
      if (!id) return null;
      // The giver fence, and it is the same one the seal applies one release
      // earlier: work is offered by somebody standing in this world or by nobody.
      const giver = str(stored.giver);
      if (!known.has(giver)) return null;
      const asked = str(stored.verb);
      const verb = PF.own(VERB_FOLD, asked) ?? asked;
      // THE MECHANICS ENUM, NOT THE WIDER SEAL-ACCEPT ONE. `VERBS` is what a
      // generation call may WRITE; MECHANICS is what this build can VERIFY, and a
      // row it cannot verify could only ever be accepted and then never completed.
      //
      // It is a LIST MEMBERSHIP TEST and not a table lookup, and that is the point
      // of the pattern rather than an accident of it: `verb` here is a string off a
      // hand-edited or foreign artifact, and this door's own header calls the stored
      // pack untrusted. `foldTarget` below refuses the same rows a step later — an
      // unknown verb has no grain bound to it either, hostile ones included now that
      // its lookup is an own-key one — so this line is the statement of the rule and
      // that one is the enforcement. Both are wanted: the day GRAINS_FOR_VERB gains
      // an entry MECHANICS has not is the day the pair stops agreeing, and until
      // then a verb naming an inherited property is refused twice rather than once.
      if (!MECHANICS.includes(verb)) return null;
      // THE GRAIN RULE IS THE SEAL'S OWN, CALLED HERE — not a second copy written
      // to look like it. Same grain-to-verb binding, same role/variant/place
      // vocabularies, same first-allowed-grain-that-resolves answer for a row that
      // tagged two, and the same CAPS.slug clip on the value. A private copy of
      // this is exactly how a row comes to resolve one way at the seal and another
      // at the read; the only argument it takes differently is the cast, and that
      // difference IS the read side — the seal asks who the brief named, this asks
      // who is standing in the world about to offer the work.
      const target = this.foldTarget(stored.target, verb, { cast: known, theme });
      if (!target) return null;
      return {
        id,
        giver,
        verb,
        // A fresh one-grain object out of foldTarget, so a second key beside the
        // grain — a forward build's, a hostile save's — cannot ride into the row.
        target,
        // THE SEAL'S OWN ARITHMETIC, not a second one written to look like it: a
        // counting verb clamps into [1, CAPS.n] and a non-counting one is always
        // one. Two doors doing different sums is how a stored row comes to ask for
        // a number this build's own seal could never have written.
        n: verb === "catch" ? PF.clamp(Math.round(Number(stored.n) || 1), 1, CAPS.n) : 1,
        // …and the seal's own text hygiene, through the SAME helper rather than a
        // fork of it: a title is plain text that clips safe, because it renders in
        // a board row and anything that could reflow one is stripped at a door
        // rather than at every read.
        title: capText(stored.title, CAPS.title) || `${verb} ${this.targetString({ target })}`,
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

    // ── THE SHARED ROW RENDERER (plan §2.4) ──────────────────────────────────
    /** ONE quest row as one line of plain text, and the ONE function that turns a
     *  row into words anywhere in the package. The board's jobs section renders
     *  through it and the quest tab renders through it VERBATIM — §2.4's own
     *  sentence, and the reason there is no board-shaped branch anywhere below.
     *
     *  THE TITLE IS A LOOKUP AND THE FALLBACK IS A SYNTHESIS. A board instance id
     *  carries its template (`b1.d<day>.<id>`), so the pack that is folded right
     *  now can be asked what it called the work; and when it cannot answer — a
     *  demoted world, a row minted from a template that has since folded out, a
     *  save carried in from somewhere else — the row's own eight fields say the
     *  same thing mechanically: "Catch 5 carp — 3/5 — for Alder Vance". A missing
     *  title is a plainer line, never a blank one, because the row is a live
     *  object the player is carrying and it has to be legible without its pack.
     *
     *  THE MIDDLE CLAUSE IS VERB-AWARE, and the fraction is the COUNTING verb's
     *  alone. `deliver` and `visit` are n = 1 by construction (the seal and the
     *  read door both write it), so "0/1" would be a progress bar for a thing
     *  that has no progress — it is either done or it is a walk you have not
     *  taken yet, and the words say which.
     *
     *  `folded` is optional: a caller with no fold in its hand (a band notice, a
     *  test) still gets the mechanical line rather than an exception. */
    rowText(row, folded) {
      const verb = str(row?.verb);
      const target = str(row?.target);
      const counting = verb === "catch";
      const n = PF.clamp(Math.round(Number(row?.n) || 1), 1, CAPS.n);
      const have = PF.clamp(Math.round(Number(row?.have) || 0), 0, n);
      const template = this.templateOf(row?.id);
      const titled = template ? capText(folded?.byId?.get(template)?.title, CAPS.title) : "";
      // The mechanical shape, per verb: what the row IS, and what is outstanding
      // on it. Read as a table rather than as a chain of ternaries in the join,
      // because the fourth arm is the one that matters and a chain hides it.
      const named = target || "something";
      const shape = counting
        ? { lead: `Catch ${n} ${named}`, middle: `${have}/${n}` }
        : verb === "deliver"
          ? { lead: `Take word to ${named}`, middle: `waiting on the handover to ${named}` }
          : verb === "visit"
            ? { lead: `Go to ${named}`, middle: `travel to ${named}` }
            : // A VERB NO SITE IN THIS BUILD ADVANCES. Nothing here can mint one
              // — the seal's enum and the read door both refuse it — but a
              // hostile save or a forward build's row carries whatever it likes
              // and `quest("accept")` stores the word as given. So the line says
              // the two things it can stand behind, who and what, and claims
              // neither progress nor a mechanic it cannot name. Falling through
              // to the visit arm instead would print "travel to" over a row
              // nothing will ever complete.
              { lead: named, middle: "" };
      const giver = PF.player.giverOf(row?.g);
      return [titled || shape.lead, shape.middle, giver ? `for ${giver}` : ""].filter(Boolean).join(" — ");
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

    // ── THE BOARD (plan §2.1) ────────────────────────────────────────────────
    // The pack's own reading surface, and it lives HERE rather than beside the
    // economy's verbs for one reason: every number and every identity it spends
    // is in this file. K, the reward derivation, the instance id, the daily
    // selection, the template caps and the board constant are all above, and a
    // board written one module along would reach across for the lot of them.
    //
    // The SHAPE is 59-economy's, exactly: an OFFER that describes and never
    // mutates, and VERBS that go through the shipped mutators in an order that
    // cannot half-pay anybody. What is different is the cadence — a board is read
    // at menu-open and at each press, never per frame, so `boardOffers` is free to
    // walk the day's selection and the active list rather than having to be cheap
    // enough for sixty calls a second.

    /** THE DAY'S RECEIPT: which templates have already been FILLED today.
     *
     *  ONE COMPLETION PER TEMPLATE PER DAY, uniformly. The board posts a day's
     *  work and filling it fills it — without the rule, accept → complete →
     *  re-accept is legal on the same day, because a completed row leaves
     *  `quests.active` and the dup check has nothing left to see while the
     *  deterministic instance id re-mints unchanged. For a catch that is merely
     *  odd (the work really does repeat); for `visit`, which completes on ENTRY,
     *  it is a walk-in-circles coin loop, and a rule that held for one verb and
     *  not the others would be a rule the player has to learn per row.
     *
     *  KEYED BY TEMPLATE AND NOT BY INSTANCE. An instance id carries its own day,
     *  so a set of them would be day-scoped for free — and would miss the case
     *  that matters most: a job taken on day 3 and handed in on day 9 is
     *  `b1.d3.X`, while today's board is offering `b1.d9.X`. The work is the
     *  template; the instance is one day's copy of it.
     *
     *  SIM-RESIDENT AND NOT SERIALIZED, deliberately, and the cost is stated
     *  rather than hidden: a reload forgets the day's receipts, so a player who
     *  reloads mid-day can fill the same template twice. That seam is acceptable
     *  under the rolling-compat posture — the alternative is a new persisted
     *  field on the save wire for a rule about one day — and it self-heals at
     *  midnight. A rewind clears it too, which is the honest answer there: a
     *  rewind that un-completes the quest should un-file its receipt with it, and
     *  `_rebuild` replacing the sim wholesale does exactly that. */
    filledToday(core) {
      const sim = core?.sim;
      if (!sim) return null;
      const day = Math.max(0, Math.trunc(Number(sim.day) || 0));
      // Rebuilt on the first read of a new day rather than cleared on a clock
      // tick: the sim has no hook the pack could hang a midnight callback off,
      // and a set that is rebuilt when it is asked for cannot be stale when it
      // is read.
      if (!sim._filled || sim._filled.day !== day) sim._filled = { day, templates: new Set() };
      return sim._filled;
    },

    /** What this board is offering and what it is holding for you. Describes
     *  only. Returns { available, reason, board, folded, day, offers, jobs }.
     *
     *  `offers` is one row per template in today's selection, each carrying the
     *  STATE the menu renders it in: `open`, `taken` (accepted today — the day's
     *  receipt, still on the board beside the live job), `filled` (completed
     *  today — see filledToday), `dup` (a live row for the same template from an
     *  earlier day), `at-cap` (nothing can be taken at all). The states are
     *  answered here so the menu never has to work anything out, and re-answered
     *  on every press so a two-press race cannot accept twice. */
    boardOffers(core) {
      const sim = core?.sim;
      const no = (reason) => ({ available: false, reason, board: null, folded: null, day: 0, offers: [], jobs: [] });
      if (!sim?.world) return no("no-world");
      if (sim.mode !== "walk") return no("wrong-mode");
      // The gate's own answer, on fishOffer's cadence: a world still being
      // written has no work in it to read and no player block to write to.
      if (PF.save?.gateHolds?.(core)) return no("gate-held");
      if (!sim.nearBoard) return no("not-at-board");
      const folded = PF.save.packFold(core);
      if (!folded) return no("no-world");
      const player = PF.player.get(core);
      const jobs = Array.isArray(player?.quests?.active) ? player.quests.active : [];
      const day = Math.max(0, Math.trunc(Number(sim.day) || 0));
      const atCap = jobs.length >= PF.player.CAPS.activeQuests;
      const live = new Set(jobs.map((q) => str(q.id)));
      const liveTemplates = new Set(jobs.map((q) => this.templateOf(q.id)).filter(Boolean));
      const filled = this.filledToday(core);
      const offers = this.selection(folded, sim.world.seed, day).map((template) => {
        const id = this.instanceId(day, template.id);
        // TAKEN BEFORE FILLED BEFORE DUP BEFORE AT-CAP, and the order is the
        // honest one: a row you took an hour ago should say so rather than
        // blaming a full list, a row you FINISHED an hour ago should say that
        // rather than that you are on it, and a full list is only the reason you
        // cannot take work you have not already got.
        const state = live.has(id)
          ? "taken"
          : filled.templates.has(template.id)
            ? "filled"
            : liveTemplates.has(template.id)
              ? "dup"
              : atCap
                ? "at-cap"
                : "open";
        return { template, id, state, reward: this.rewardFor(template.verb, template.n) };
      });
      return { available: true, reason: null, board: sim.nearBoard, folded, day, offers, jobs };
    },

    /** Take one of today's offers. Every effect goes through a shipped mutator,
     *  in an order that cannot leave a half-taken job:
     *    1. RE-READ the board (the menu's copy is a press old — the player may
     *       have walked away, filled their list, or taken this very row on the
     *       button beside it);
     *    2. `quest("accept")` — the row. Its `r` is copied in HERE, off TUNING's
     *       derivation, so a later retune moves future accepts only and the deal
     *       the player took is the deal they are paid (§2.6);
     *    3. `log()` — the day-ledger line, event-side and at the event's day.
     *  No bump: taking work is not yet a favour done.
     *  Returns { ok, reason, id, title, reward }. */
    accept(core, templateId, gen) {
      const view = this.boardOffers(core);
      if (!view.available) return { ok: false, reason: view.reason, id: "", title: "", reward: null };
      const offer = view.offers.find((row) => row.template.id === str(templateId));
      if (!offer) return { ok: false, reason: "not-offered", id: "", title: "", reward: null };
      if (offer.state !== "open")
        return { ok: false, reason: offer.state, id: offer.id, title: offer.template.title, reward: null };
      const sim = core.sim;
      const template = offer.template;
      const taken = PF.player.quest(
        core,
        "accept",
        {
          id: offer.id,
          // The row's `g` is `zoneId|Name` and the zone is the SETTLEMENT root —
          // the key every rel row in the package already uses, so one person is
          // one row wherever in the world you meet them.
          g: `${sim.world.startZone}|${template.giver}`,
          verb: template.verb,
          target: this.targetString(template),
          n: template.n,
          r: offer.reward,
          day: view.day,
        },
        gen,
      );
      // The fence, the gate, or a chat switch under us. The mutator is the first
      // thing here that can refuse and nothing after it has run.
      if (!taken) return { ok: false, reason: "refused", id: offer.id, title: template.title, reward: null };
      PF.player.log(core, `Took work from ${template.giver}: ${template.title}.`, view.day, gen);
      return { ok: true, reason: null, id: offer.id, title: template.title, reward: offer.reward };
    },

    // ── THE LINE DIET (plan §2.3), and this is where its writers live ────────
    // ONE LINE PER ACCEPT (accept, above), ONE PER COMPLETION (settle, below),
    // ONE PER ABANDON (`abandon`, below — the quest tab presses it) and ZERO PER
    // PROGRESS. The last of those is the one worth stating: an increment is not an event the
    // wrap-up should read out, and a session of fishing would otherwise file
    // forty of them and evict the day it happened on.
    //
    // AND THE DAY CAN STILL OVERFLOW, which is accepted rather than solved. The
    // honest sum on a board-heavy day is accepts (up to K) + carryover
    // completions (up to the ten-quest cap) + abandons + the fishing verb's own
    // lines + purchases, and that clears `CAPS.ledgerPerDay` (15) without being
    // an unusual day at all. What the compaction then does is drop the day's
    // EARLIEST lines, which is the right end to lose: the wrap-up is a story
    // told at bedtime and the morning is what the player is furthest from
    // remembering. Raising the cap would buy a longer tell out of the same
    // #5135 budget the tell is already truncated against — so the cap stays and
    // the loss is written down here instead of discovered in a playtest.
    //
    // EVERY ONE OF THEM IS FILED EVENT-SIDE, AT THE EVENT'S DAY. A job taken on
    // day 3 and finished on day 9 is two lines under two days, and neither of
    // them moves because the other happened.

    /** THE COMPLETION ITSELF, and it is ONE function because there are now three
     *  places a quest can finish: the board's hand-in press, the zone the `visit`
     *  row named, and the handover a `deliver` errand ends at. Three copies of
     *  this is how a completion comes to pay at one site and not bump at another,
     *  or to file its line under the wrong day at the third.
     *
     *  The order is §2.1's press flow and cannot half-pay anybody:
     *    1. CAPTURE the reward, the giver and the template BEFORE the splice.
     *       The honest reason: `quest("complete")` splices the row out of
     *       `quests.active`, and `row` here is an OBJECT REFERENCE, so reading
     *       `r` off it afterwards still reads the reward — what is gone is the
     *       row's place in the list, not its fields. What the order buys is that
     *       nothing below has to go looking for it again: a re-find by id after
     *       the splice finds nothing, and `template` is an argument to the call
     *       itself and so could not be read later at all. The lane pins the
     *       consequence rather than the ordering — the money and giver handed
     *       back are the vanished row's fields, and a re-find would hand back
     *       neither;
     *    2. `quest("complete")` — the splice, the counter and the pay. NO VERB
     *       reaches award() from here (§2.6, RULED): a quest pays money and
     *       rapport and nothing else;
     *    3. the DAY'S RECEIPT, so the same work cannot be filled twice today;
     *    4. `log()` at the sim's day — EVENT-SIDE and at the EVENT's day, which
     *       is what makes a job taken on day 3 and finished on day 9 read as two
     *       lines in the right two places. The giver's name rides only when this
     *       world still stands them up (the fold's `known` set), because a line
     *       naming somebody the world cannot resolve is a line the wrap-up would
     *       read out as fact;
     *    5. `bump({t:3, s, meaningful})` — the giver remembers, on the same
     *       settlement-scoped key every other bump uses, and SKIPPED SILENTLY on
     *       the same miss. THREE, not one (0.15, plan §13): a finished job
     *       outweighs a greeting on the disposition ladder, which is the reward
     *       ruling's "money and the giver's rapport" finally paying out as
     *       MOVEMENT — one hand-in makes a stranger acquainted, and the harness
     *       pins exactly that. And it is MEANINGFUL, which is the half the weight
     *       cannot say: doing a job for somebody is what carries a row past
     *       acquaintance at all, where a hundred greetings never could. The `s`
     *       line is the giver's own memory of it, in the voice the economy lines
     *       already use (you = the player).
     *
     *  `say` is the caller's own sentence, and it is a CALLBACK rather than a
     *  string so the guard can decide the shape: it is handed the giver's name or
     *  null and the money already worded by the theme, and hands back the line.
     *  Returns { money, giver, template, rose } — `rose` is the rung the giver's
     *  bump EARNED on this call and 0 otherwise, so the caller with a receipt to
     *  print folds the rise into it rather than saying it in a second toast that
     *  erases the first (70-hud `_said`) — or null when the mutator refused. */
    settle(core, row, gen, say) {
      const sim = core?.sim;
      const world = sim?.world;
      if (!world || !row) return null;
      const money = Math.max(0, Math.round(Number(row.r?.money) || 0));
      const giver = PF.player.giverOf(row.g);
      const template = this.templateOf(row.id) ?? str(row.id);
      if (!PF.player.quest(core, "complete", { id: str(row.id), template }, gen)) return null;
      const folded = PF.save.packFold(core);
      const stands = !!giver && !!folded?.known?.has(giver);
      this.filledToday(core)?.templates.add(template);
      PF.player.log(core, say(stands ? giver : null, PF.economy.money(world, money)), sim.day, gen);
      // WHICH JOB, not merely that one happened. A constant here was a line-cap
      // flood: `s` lines are capped at 30 across the whole block and evicted
      // oldest-first (58-player CAPS.relLines), so thirty completions filled
      // every slot with one sentence and pushed out the berth line and the
      // purchase line — the two writers that carried anything a player could
      // tell apart. The board row's own title is the most specific thing this
      // path knows; the plain sentence stays as the fallback for a row with no
      // template standing behind it, which is where there is nothing to name.
      const titled = capText(folded?.byId?.get(template)?.title, CAPS.title);
      const bumped = stands
        ? PF.player.bump(
            core,
            world.startZone,
            giver,
            { t: 3, s: titled ? `Ran ${titled} for me.` : "You ran a job for me.", meaningful: true },
            gen,
          )
        : null;
      return { money, giver: stands ? giver : null, template, rose: bumped?.rose ?? 0 };
    },

    /** Hand one finished job in. Two things happen here that `settle` cannot do
     *  for itself, and they are the reason the press has a function of its own:
     *    1. RE-FIND the live row by id (buyRod's offer-re-read: the menu drew this
     *       row a press ago and the row is what pays);
     *    2. REFUSE unless `have >= n` at THIS read. The mutator pays with no such
     *       check by design — it trusts its caller — so this line is the check,
     *       and it is why the lane pins the press side rather than the mutator.
     *  Returns { ok, reason, money, giver, have, n }. */
    turnIn(core, id, gen) {
      const sim = core?.sim;
      const fail = (reason, extra) => ({ ok: false, reason, money: 0, giver: null, have: 0, n: 0, ...extra });
      if (!sim?.world) return fail("no-world");
      if (sim.mode !== "walk") return fail("wrong-mode");
      if (PF.save?.gateHolds?.(core)) return fail("gate-held");
      if (!sim.nearBoard) return fail("not-at-board");
      const player = PF.player.get(core);
      const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];
      const row = rows.find((q) => str(q.id) === str(id));
      if (!row) return fail("unknown-id");
      const n = Math.max(1, Math.round(Number(row.n) || 1));
      const have = Math.max(0, Math.round(Number(row.have) || 0));
      if (have < n) return fail("not-done", { have, n });
      const done = this.settle(core, row, gen, (giver, paid) =>
        giver ? `Filled ${giver}'s board order — ${paid}.` : `Filled the board order — ${paid}.`,
      );
      if (!done) return fail("refused", { have, n });
      return { ok: true, reason: null, money: done.money, giver: done.giver, have, n, rose: done.rose ?? 0 };
    },

    /** LET ONE JOB GO (plan §2.3). Free, player-initiated, and pressed from the
     *  quest tab and nowhere else — the board can take work on and take it back
     *  finished, but giving up is not a thing you do by standing in front of a
     *  board, and an abandon offered there would be an abandon offered at the one
     *  moment the player is most likely to mis-press.
     *
     *  NO BOARD GATE AND NO MODE GATE, and both absences are deliberate. This is
     *  reached from a panel that is only open in walk mode (`_panelsAllowed`) and
     *  is closed under the loading gate, and the mutator's own `_live` refuses
     *  under the gate and under a generation mismatch — so a second copy of those
     *  guards here would be unreachable code standing where a real one used to.
     *
     *  THE GIVER IS READ BEFORE THE SPLICE, on `settle`'s discipline, and the
     *  MUTATOR IS THE AUTHORITY on whether there is anything to let go: a row that
     *  left the list between the tab's paint and the press — a severance parking
     *  it, the repair pass dropping it, a rebuild landing under an open panel — is
     *  refused by id and comes back as `abandon-unknown`, which is the sentence
     *  the refusal map has been carrying since the slice before this one. A
     *  generation fence refusal answers with the same value on purpose: from the
     *  player's side, a block that moved under them and a row that was never there
     *  are the same fact.
     *
     *  ONE LEDGER LINE, event-side and at the event's day (§2.3's diet), and the
     *  giver's name rides it only while this world still stands them up — the same
     *  known-cast guard every other line in this file is written through.
     *  Returns { ok, reason, giver }. */
    abandon(core, id, gen) {
      const sim = core?.sim;
      if (!sim?.world) return { ok: false, reason: "no-world", giver: null };
      const player = PF.player.get(core);
      const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];
      const row = rows.find((q) => str(q.id) === str(id)) ?? null;
      const giver = row ? PF.player.giverOf(row.g) : "";
      if (!PF.player.quest(core, "abandon", { id: str(id) }, gen))
        return { ok: false, reason: "abandon-unknown", giver: null };
      const folded = PF.save.packFold(core);
      const stands = !!giver && !!folded?.known?.has(giver);
      PF.player.log(core, stands ? `Set aside ${giver}'s board order.` : "Set aside a board order.", sim.day, gen);
      return { ok: true, reason: null, giver: stands ? giver : null };
    },

    // ── THE TWO VERB SITES THAT ARE NOT A PRESS (plan §2.3) ──────────────────
    // `catch` advances at 59-economy's fish() and hands in at the board, because
    // counting is what it does. The other two mechanics have nothing to count:
    // they are done the moment they happen, and the moment they happen is not a
    // moment the player is standing at a board. So they COMPLETE where they
    // happen, through the same `settle` the press uses.

    /** THE VISIT VERB, completed on ENTRY: the walk WAS the quest. Called by the
     *  two real zone-change callers — the frame loop's `zoneChanged` branch (a
     *  portal under the player's feet) and 50-spatial's drift arm (the GM moved
     *  the party) — because the sim holds no core and no generation of its own
     *  and cannot call anything itself.
     *
     *  IT MATCHES ON THE LOCATION HANDLE, which is what a `visit` row's target is
     *  (the schema binds the `place` grain to this verb and nothing else). The
     *  handle is stamped on the zone by the compiler, which is the only site that
     *  knows which ordinal id a brief's place got — a lookup, never a guess.
     *
     *  A FILTER AND NOT A FIND, for the catch site's reason: two rows asking for
     *  the same walk are both answered by taking it once.
     *
     *  NO MODE TEST, deliberately, and it is the one place this layer does not
     *  copy the board's guards. A drift arrival lands while the player is reading
     *  narration — that IS the mode a narrated arrival happens in — and refusing
     *  it would leave a row that can never complete, because nothing walks into a
     *  zone it is already standing in. The gate is still honoured: a world still
     *  being written has no arrivals in it to answer.
     *
     *  ACCEPTING WHILE STANDING IN Y DOES NOT COMPLETE, and that falls out rather
     *  than being tested for: this runs on a zone CHANGE and the board is not in
     *  the wilds. Re-entry is idempotent the same way — the row is spliced by the
     *  first arrival, so the second finds nothing to settle.
     *
     *  Returns the settled rows (possibly none), for the surface to say so. */
    visited(core, zoneId, gen) {
      const sim = core?.sim;
      const world = sim?.world;
      if (!world) return [];
      if (PF.save?.gateHolds?.(core)) return [];
      const id = str(zoneId);
      const zone = PF.own(world.zones, id) ? world.zones[id] : null;
      const handle = str(zone?.place);
      if (!handle) return [];
      const player = PF.player.get(core);
      const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];
      const due = rows.filter((row) => str(row.verb) === "visit" && str(row.target) === handle);
      const filled = [];
      for (const row of due) {
        // THE ZONE'S NAME AND NOT THE HANDLE. "wilds" is an index key; the line
        // is history a wrap-up reads out, and "walked out to the wilds" is a
        // sentence about a vocabulary rather than about a place the player went.
        const done = this.settle(core, row, gen, (giver, paid) =>
          giver ? `Walked out to ${zone.name} for ${giver} — ${paid}.` : `Walked out to ${zone.name} — ${paid}.`,
        );
        if (done) filled.push(done);
      }
      return filled;
    },

    /** THE DELIVER VERB, and it is an ERRAND rather than a courier job: no item
     *  moves, because no quest-item type exists and inventing one for a word
     *  would be a format change nothing else asks for. What is delivered is word,
     *  and word is delivered by TALKING — so this completes in the one place the
     *  package can be sure a conversation actually started: 90-element's accepted
     *  `.then`, after the host has taken the turn.
     *
     *  THE ONE NON-GM-FREE QUEST VERB, stated rather than discovered (Ruling 1 is
     *  "lean", not "zero"): the handover costs exactly one GM call — and 0.14 says
     *  WHICH call rather than leaving it implicit in the greeting. The talk window
     *  draws one LABELLED branch per outstanding errand ("Hand over: <title>"), and
     *  that press settles that row; the free-talk door still settles every row to
     *  the name, exactly as 0.13's bare greeting did. So the honest claim is narrow
     *  and worth making narrowly: no press that is not handover-shaped can settle
     *  an errand, and every settling press says on its face what it settles. A bare
     *  `interact()` — which now only OPENS the window — settles nothing at all.
     *
     *  BOTH FENCES ARE THE CALLER'S and both are needed. `gen` is the generation
     *  the turn was composed under — a chat switch under the await would otherwise
     *  credit the arriving chat's block with the departing chat's errand — and the
     *  SIM IDENTITY is the second, because `_rebuild` replaces core.sim wholesale
     *  (a rewind, a checkpoint load) WITHOUT moving `_gen`, so the fence alone
     *  cannot see it. The caller refuses on a mismatch by simply not calling: the
     *  quest stays active, the player talks to them again, and the honest cost is
     *  one extra GM call in a race nobody will ever notice.
     *
     *  `name` is captured AT SEND for the same reason: the person the player
     *  walked up to is the person the errand was run to, whoever is standing
     *  there by the time the host answers. */
    delivered(core, name, gen, rowId) {
      const sim = core?.sim;
      const world = sim?.world;
      if (!world) return [];
      if (PF.save?.gateHolds?.(core)) return [];
      const to = str(name);
      if (!to) return [];
      const player = PF.player.get(core);
      const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];
      // THE OPTIONAL ROW ID, and it is an ID rather than the row OBJECT for
      // `turnIn`'s stated reason one screen up: the window drew its "Hand over"
      // branch when it opened and settles it after an await, so it is strictly
      // staler than the board menu that comment already guards — and `settle`
      // reads the reward off the object it is handed, so a stale one pays a stale
      // reward against a live row. Named, the branch RE-FINDS the row here, at
      // settle time, in the live list; a miss filters to nothing and settles
      // nothing, which is the refusal. Unnamed, every row to the name settles —
      // 0.13's implicit handover, preserved verbatim for the "Just talk" door.
      const wanted = str(rowId);
      const due = rows.filter(
        (row) => str(row.verb) === "deliver" && str(row.target) === to && (!wanted || str(row.id) === wanted),
      );
      const filled = [];
      for (const row of due) {
        // THE GIVER == TARGET CASE IS RECORDED HARMLESS, not defended against: a
        // template whose giver is also its target bumps the same person twice in
        // one turn (once for the conversation in 90-element, once for the errand
        // here), which reads as two encounters on a turn that was two things.
        //
        // 0.14 WIDENS THE COUNT AND NOT THE ARGUMENT. The talk window's paid set
        // is four presses deep — free talk, say something, press them about it,
        // and one per errand — so one conversation can now bump the same person
        // up to four times, once per ACCEPTED turn. That is still what the count
        // says it is: `t` counts encounters, four accepted turns are four of
        // them — and the reader EXISTS now: the disposition ladder promotes on
        // the crossings (58-player §13), whose lines sit far enough apart that
        // a four-press conversation cannot vault a rung on its own. Restated
        // rather than left saying "twice", because a number in a comment that
        // has stopped being the number is how the next reader concludes a fifth
        // bump is a bug.
        const done = this.settle(core, row, gen, (giver, paid) =>
          giver && giver !== to ? `Took ${giver}'s word to ${to} — ${paid}.` : `Took word to ${to} — ${paid}.`,
        );
        if (done) filled.push(done);
      }
      return filled;
    },

    // ── The Ask ladder: what a person says when you ask (plan §2.6) ──────────
    // The talk window's free half reads lines out of the folded pack. Four
    // branches — rumor, work, place, and "Pass the time" — and NONE of them costs
    // a GM call: this is a lookup over an artifact that is already in memory.
    //
    // BOTH REGISTERS SERVE, AND THE LADDER DECIDES WHICH LEADS (0.15). Ruling 4
    // shipped 0.14 stranger-only because a stopgap that GUESSED at friendship
    // would be a promotion the player never earned — its own words, and its own
    // sunset clause: the promotion is earned now (58-player §13 — the crossing),
    // so a speaker the ladder has reached FRIENDLY with serves the friend half
    // that sat sealed through 0.13 and 0.14, friend-first at every relaxation.
    // Everyone else still meets exactly 0.14's stranger-only window, byte for
    // byte, seeded order and all.
    //
    // THE WEATHER TERM: a line with no `w` is served under any sky, and a line
    // tagged `rain` is served under any RAIN — the axis is the five words and an
    // intensity never enters it (§2.2's consumer rule, spent here).
    /** The at-key for a zone: its stamped place handle, or the legacy reading —
     *  an interior is a dwelling, everything else is the settlement. Stamped
     *  handles win; legacy zones carry both stamps. */
    askAt(zone) {
      const stamped = str(zone?.place);
      if (stamped) return stamped;
      return zone?.mapKind === "building" ? "dwelling" : "settlement";
    },

    /** Every line this sky can serve TO THIS SPEAKER, as {line, index} — the
     *  index is the line's identity for the served set, stable for a session
     *  because the fold is rebuilt exactly when the world is.
     *
     *  `befriended` is the 0.15 door: a speaker the ladder has reached FRIENDLY
     *  with (rung 2 — 58-player §13) serves both registers, everybody else
     *  serves stranger lines exactly as 0.14 did. The index space is the whole
     *  pack either way, so a rung earned mid-day changes which lines are
     *  reachable and not what any already-served index meant. */
    askUniverse(folded, word, befriended) {
      const out = [];
      const lines = Array.isArray(folded?.pack?.lines) ? folded.pack.lines : [];
      lines.forEach((line, index) => {
        if (line?.r !== "stranger" && !(befriended && line?.r === "friend")) return;
        if (line.w && line.w !== word) return;
        out.push({ line, index });
      });
      return out;
    },

    /** The ladder for one branch, as an ordered list of rungs. Each rung is a
     *  membership predicate plus the SIGNATURE its seeded order hashes over —
     *  `at` rides the signature only for at-pinned rungs and `part` only for
     *  when-pinned ones, so two rungs that select the same set key the same
     *  order.
     *
     *  TOPIC BRANCHES RELAX `at` AND NEVER TOPIC: R3/R4 widen from this place to
     *  anywhere, because a rumor branch that answered with a work line would be
     *  a button that lied about what it asks. "Pass the time" is the branch that
     *  has somewhere to fall — smalltalk first, then the untagged pool, which is
     *  where most of a hand-written pack lives. */
    askRungs(branch, at, part, befriended) {
      const has = (topic) => (row) => row.line.topic === topic;
      const untagged = (row) => row.line.topic === undefined;
      const here = (row) => row.line.at === at;
      const now = (row) => row.line.when === part;
      const rung = (test, pins) => ({ test, pins });
      const base =
        branch === "smalltalk"
          ? [
              rung((r) => here(r) && now(r) && has("smalltalk")(r), "s1|at|part"),
              rung((r) => here(r) && has("smalltalk")(r), "s2|at"),
              rung((r) => here(r) && now(r) && untagged(r), "s3|at|part"),
              rung((r) => here(r) && untagged(r), "s4|at"),
              rung((r) => has("smalltalk")(r), "s5"),
              rung(untagged, "s6"),
            ]
          : [
              rung((r) => here(r) && now(r) && has(branch)(r), "r1|at|part"),
              rung((r) => here(r) && has(branch)(r), "r2|at"),
              rung((r) => now(r) && has(branch)(r), "r3|part"),
              rung(has(branch), "r4"),
            ];
      if (!befriended) return base;
      // THE FRIEND REGISTER LEADS AT EVERY RELAXATION (0.15). Each rung splits
      // in two — the friend subset first, the stranger subset second — so a
      // friendly speaker answers in the register the pack wrote for exactly this
      // moment and falls back to the signpost voice only where the friend pool
      // at that tier is spent or was never written. Mixing the two in one rung
      // would have served a 5:7 shuffle in which a friend mostly still talks to
      // you like a stranger, which is the ratio the register exists to escape.
      //
      // The pin suffixes keep the seeded orders apart per register; the `|at`
      // and `|part` substring reads the signature builder does are unaffected.
      const split = [];
      for (const { test, pins } of base) {
        split.push(rung((r) => r.line.r === "friend" && test(r), `${pins}|rf`));
        split.push(rung((r) => r.line.r === "stranger" && test(r), `${pins}|rs`));
      }
      return split;
    },

    /** CIRCULAR DAYPART ADJACENCY, measured over the START MINUTES of the four
     *  dayparts and not over their order in the table. The two readings disagree:
     *  by start minute, night→dusk is 180 minutes and night→dawn is 480, so dusk
     *  is genuinely nearer the hour; by ordinal position the two are a tie. A
     *  when-relaxed rung ranks rather than pretends — a dawn line at midday is
     *  served only when nothing nearer the hour exists. */
    askDistance(when, part) {
      const starts = PF.DAYPART_STARTS;
      const a = PF.own(starts, when) ? starts[when] : null;
      const b = PF.own(starts, part) ? starts[part] : null;
      if (a === null || b === null) return 24 * 60;
      const raw = Math.abs(a - b);
      return Math.min(raw, 24 * 60 - raw);
    },

    /** Does this branch have anything at all to say here, right now? The window
     *  asks before it renders, because a topic branch with no servable line DOES
     *  NOT RENDER — honest suppression, and the reason a thin generated pack shows
     *  one or two topic buttons rather than four dead ones. Peeks: it walks the
     *  same rungs the serve does and consumes nothing. */
    askHas(core, npc, branch) {
      return !!this.askPeek(core, npc, branch);
    },

    /** The shared walk. `consume` false answers "is there a rung with anything in
     *  it"; `consume` true also picks, records the pick in the branch's served set
     *  and hands back the line.
     *
     *  AN EXHAUSTED RUNG FALLS THROUGH TO THE NEXT ONE rather than starting over
     *  inside itself, and that one sentence is the whole reason this walk has two
     *  passes: the default pack's coverage floor counts TWO lines per (at, topic)
     *  while R1 pins (at, WHEN, topic), so R1 holds exactly one line wherever it
     *  holds any — and a wrap that restarted inside R1 would answer every press
     *  after the first with the same sentence, forever, in half the cells the
     *  enrichment was written for (48 of the 96 (theme, at, daypart, branch) cells
     *  whose reachable pool has two or more lines, measured on the shipped
     *  defaults). Falling through costs nothing and stays inside the branch: R2-R4
     *  are supersets of R1 with the same topic, and the smalltalk rungs are the
     *  fall the branch is named for.
     *
     *  THE SECOND PASS IS THE WRAP, and it only runs when the WHOLE ladder is
     *  exhausted — every line this branch can reach under this sky has been served
     *  today. Then the set clears and the walk restarts from the top rung, because
     *  after exhaustion repeats are the honest state and a branch that went silent
     *  would be a button that stopped working halfway through an evening. */
    askPeek(core, npc, branch, consume) {
      const sim = core?.sim;
      if (!sim || !npc) return null;
      const folded = PF.save?.packFold?.(core);
      if (!folded) return null;
      const word = sim.weather().word;
      // The rung is the SPEAKER'S — the ladder is per person even though the
      // lines are per place, so the same bench answers a friend and a stranger
      // differently in the same hour.
      const befriended = PF.player.rung(core, sim.world?.startZone, str(npc?.name ?? npc)).d >= 2;
      const universe = this.askUniverse(folded, word, befriended);
      if (!universe.length) return null;
      const at = this.askAt(sim.zone());
      const part = sim.daypart();
      // THE MEMO'S PURGE, and the day is what rotates it. `_askDay` is the purge
      // field alone — the day also rides every signature, so a new day both keys
      // fresh orders and starts fresh served sets.
      if (folded._askDay !== sim.day) {
        folded._askDay = sim.day;
        folded._askServed = new Map();
      }
      folded._askServed ??= new Map();
      const rungs = this.askRungs(branch, at, part, befriended);
      if (!consume) {
        for (const { test } of rungs) {
          const members = universe.filter(test);
          if (members.length) return members[0].line.text;
        }
        return null;
      }
      // THE SERVED SET IS PER (day, BRANCH) and never per rung. The ladder walks
      // the rungs in order, so a when-pinned rung going empty across a daypart
      // boundary drops service onto a when-relaxed rung whose pool CONTAINS the
      // line just served — and a per-rung cursor would serve it straight back.
      // One set per branch, read by every rung of that branch, closes the
      // fall-through by construction.
      const served = folded._askServed.get(branch) ?? new Set();
      // Pass 0 honours the set; pass 1 is the wrap, and it is reached only when
      // no rung of the ladder had an unserved member left.
      for (let pass = 0; pass < 2; pass++) {
        for (const { test, pins } of rungs) {
          const members = universe.filter(test);
          if (!members.length) continue;
          const pool = members.filter((row) => !served.has(row.index));
          // The fall-through: this rung has nothing new, so the next rung — the
          // same branch, one relaxation wider — gets asked instead.
          if (!pool.length) continue;
          // The rung's canonical order: a seeded Fisher-Yates over its members in
          // index order, keyed by the MEMBERSHIP SIGNATURE rather than by anything
          // positional — deterministic across processes and across a rewind.
          const signature =
            `${sim.world.seed >>> 0}|ask|${branch}|${pins}|${sim.day}|${word}` +
            `${pins.includes("|at") ? `|${at}` : ""}${pins.includes("|part") ? `|${part}` : ""}`;
          const order = members.slice();
          const rnd = PF.rng(PF.hashStr(signature));
          for (let i = order.length - 1; i > 0; i--) {
            const j = (rnd() * (i + 1)) | 0;
            [order[i], order[j]] = [order[j], order[i]];
          }
          const rank = new Map(order.map((row, position) => [row.index, position]));
          // The pick: nearest the hour first (D-M9's ranking), a w-tagged line
          // ahead of an untagged one at equal distance, then the seeded order.
          let best = null;
          for (const row of pool) {
            const key = [this.askDistance(row.line.when, part), row.line.w ? 0 : 1, rank.get(row.index) ?? 0];
            if (
              !best ||
              key[0] < best.key[0] ||
              (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))
            )
              best = { row, key };
          }
          served.add(best.row.index);
          folded._askServed.set(branch, served);
          return best.row.line.text;
        }
        // Every rung walked with nothing unserved in any of them: the branch has
        // said everything it can say today, so the set clears and pass 1 serves
        // from the top rung again.
        served.clear();
      }
      return null;
    },

    /** Serve one line for a branch, or null when nothing in the pack answers it.
     *  Zero GM calls, no ledger line, no trace in anybody's context. */
    ask(core, npc, branch) {
      return this.askPeek(core, npc, branch, true);
    },

    /** THE COMPILED RECORD, ANSWERED MECHANICALLY (plan §2.5 item 2). Two of the
     *  window's branches read the WORLD rather than the pack, and what they hand
     *  back is PACKAGE TEXT built out of compiled facts — never invented prose and
     *  never the persona, which is the GM's to voice. Either half is null when the
     *  record does not carry it, and the window suppresses the branch: a legacy
     *  world has a role and no schedule, so it answers "what do you do" and stays
     *  honestly quiet about where anybody lives.
     *
     *  Returns { work, home }. */
    askRecord(core, npc) {
      const out = { work: null, home: null };
      const sim = core?.sim;
      if (!sim?.world || !npc) return out;
      const sched = npc._sched && typeof npc._sched === "object" ? npc._sched : null;
      const role = str(npc.role);
      if (role) {
        const standing = str(sched?.standing) || "resident";
        out.work =
          standing === "transient"
            ? `I'm a ${role}. Passing through, mostly.`
            : standing === "fringe"
              ? `I'm a ${role}, when anyone asks. I keep to the edge of the place.`
              : standing === "destitute"
                ? `I'm a ${role}. Such work as there is.`
                : `I'm the ${role} here.`;
      }
      const homeId = str(sched?.home?.zoneId);
      const zone = homeId && PF.own(sim.world.zones, homeId) ? sim.world.zones[homeId] : null;
      if (zone?.name) out.home = `${zone.name}. That's where you'll find me when the light goes.`;
      return out;
    },

    /** The escalation door: the sealed line this person has, if the pack wrote
     *  one for them. Cast-only by the seal's own fence, so a legacy or default
     *  world answers for its four stock residents and nobody else. */
    askEscalation(core, npc) {
      const folded = PF.save?.packFold?.(core);
      const name = str(npc?.name);
      if (!folded || !name) return null;
      const rows = Array.isArray(folded.pack?.escalation) ? folded.pack.escalation : [];
      const row = rows.find((entry) => str(entry?.npc) === name);
      return row ? str(row.text) : null;
    },

    /** Has this person's paid follow-up already been spent this session? A
     *  RATCHET rather than a cooldown: once pressed it does not come back until
     *  the fold is rebuilt (a reload, a rewind, a chat switch), which is the
     *  `_filled` class of recorded cost. */
    askBurned(core, npc) {
      const folded = PF.save?.packFold?.(core);
      const name = str(npc?.name);
      return !!(folded?._askBurns && name && folded._askBurns.has(name));
    },

    askBurn(core, npc) {
      const folded = PF.save?.packFold?.(core);
      const name = str(npc?.name);
      if (!folded || !name) return;
      folded._askBurns ??= new Set();
      folded._askBurns.add(name);
    },

    // ── generate(): the second generation call ───────────────────────────────
    /** THE SECOND #5135 CALL, and it is 18-brief `generate`'s TWIN rather than its
     *  cousin: same bounded wait, same one wait-out on the documented-transient
     *  409, same single same-base re-roll on truncation, same salvage of the
     *  LONGEST truncated raw seen across attempts, same `onFailure(kind)` reported
     *  once. The ladder is FROZEN at one re-roll and a salvage (#5135) — there is
     *  no degrade-the-ask rung, because the only thing left to degrade would be
     *  the digest, and a pack written against a world we described less accurately
     *  is worse than no pack at all.
     *
     *  It returns a SEALED pack for the two outcomes that produce a real one and
     *  NULL for every failure, so the caller holds the gate and the retry is free.
     *  NOTHING HERE STORES OR CACHES: 60-save owns both, in that order, and owns
     *  the gate stamping around them.
     *
     *  THE ONE ROW THE BRIEF'S LADDER DOES NOT HAVE is `"thin"`, and it is the
     *  substance floor arriving as a failure kind. A brief's validate() always
     *  produces a brief — the floors top it up from stock — but a pack under the
     *  floor is a FAILURE by design (see validate): sealing a hollow pack trades a
     *  free retry for a permanent nothing. So a 200 that seals to null is reported
     *  as its own kind rather than folded into "refused", which would tell the
     *  player their request was turned down when it was answered thinly.
     *
     *  `strictSchema` is NOT SENT and stays false — see schema(). */
    async generate(
      chatId,
      {
        theme,
        seed,
        brief,
        preferences,
        onProgress,
        onFailure,
        budgetMs = 90_000,
        busyWaitMs = Math.min(15_000, budgetMs / 6),
      } = {},
    ) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), budgetMs);
      try {
        const base = {
          instructions: guidance(theme),
          // THE DIGEST FIRST, the player's own words after (plan §2.2b).
          //
          // THE CLIMATE COMES OFF THE SEALED BRIEF AND NEVER OFF THE STANDING
          // WORLD, and that is the whole of the digest door (plan §2.1). On the
          // creation path both calls happen before the real world compiles — the
          // world standing here is boot's placeholder — so reading `world.latitude`
          // would describe a climate this settlement is not going to have, on
          // exactly the worlds that pay for a pack. `axesFor` is pure and it is
          // the same derivation the compile will run: same brief, same seed, same
          // theme, same answer, whichever of them happens first.
          userContent: composeUserContent(digest(brief, PF.weather.axesFor(brief, seed, theme)), preferences),
          schema: schema(),
        };
        // ONE DOOR. Everything the route hands back that is an object at all goes
        // through validate(), array roots included — that is the case validate's
        // own "transport: non-object root replaced" repair is written for, and a
        // pre-check here that answered it first would be a second reading of the
        // same shape, one screen from the first.
        const seal = (data) => (data && typeof data === "object" ? this.validate(data, { theme, seed, brief }) : null);
        let response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
        if (response.status === 409) {
          // chat_busy ships Retry-After: 15 — wait it out once inside the budget
          // (busyWaitMs is a timer seam so the harness never sleeps for real).
          await new Promise((resolve) => setTimeout(resolve, busyWaitMs));
          if (!controller.signal.aborted)
            response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
        }
        const rawOf = (r) =>
          r.status === 422 && r.body?.truncated && typeof r.body.raw === "string" ? r.body.raw : null;
        let bestRaw = rawOf(response);
        if (response.status === 422 && response.body?.truncated) {
          onProgress?.("Writing what your world has to say… (one more try)");
          response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
          const retryRaw = rawOf(response);
          if (retryRaw && (!bestRaw || retryRaw.length > bestRaw.length)) bestRaw = retryRaw;
        }
        // `thin` is remembered rather than returned from, because a whole
        // response can still come back after a truncated one: a 200 that seals to
        // null must not stop the salvage of a longer raw from an earlier attempt.
        let thin = false;
        if (response.status === 200 && response.body?.ok) {
          const sealed = seal(response.body.data);
          if (sealed) return sealed;
          thin = true;
        }
        if (bestRaw) {
          const salvaged = PF.brief.salvageText(bestRaw);
          if (salvaged) {
            // THE SALVAGE SEALS THIN, AND THAT IS THE POINT OF THE FLOOR. What
            // came back is a templates-first emission with its tail cut off, so
            // the pack is smaller than the one that was asked for — and a smaller
            // pack is a real one. validate() is what decides whether it is small
            // or hollow, and it is the same validate() a whole response goes
            // through: one door, one set of guarantees.
            const sealed = seal(salvaged);
            if (sealed) {
              sealed._repairs.push("transport: salvaged from a truncated response");
              return sealed;
            }
            thin = true;
          }
        }
        if (thin) {
          console.warn("[pixelforge] the content pack came back under its floor; nothing sealed, the retry is free");
          onFailure?.("thin");
          return null;
        }
        if (response.status === 404 || response.status === 409 || response.status === 429 || response.status >= 500) {
          console.warn("[pixelforge] content pack unavailable (transient); the world stays packless", response.status);
          onFailure?.("unavailable");
          return null;
        }
        console.warn(
          "[pixelforge] the content pack was refused; the world stays packless",
          response.status,
          response.body?.error ?? null,
        );
        onFailure?.("refused");
        return null;
      } catch (err) {
        // The brief's two verdicts, and the same reading of them: neither seals
        // anything, and the world under this call is already written and safe.
        if (!controller.signal.aborted) {
          console.warn("[pixelforge] the content pack call failed (network); the world stays packless", err);
          onFailure?.("network");
        } else {
          console.warn("[pixelforge] the content pack call timed out; the world stays packless");
          onFailure?.("timeout");
        }
        return null;
      } finally {
        clearTimeout(timer);
      }
    },

    // The three composition halves, exported for the same reason 18-brief exports
    // its own: the walls they are written against (#5135) are the kind of contract
    // that is only ever checked by measuring, and a lane that re-implemented the
    // split would be measuring itself.
    digest,
    composeUserContent,
    guidance,
    schema,
    USER_CONTENT_CAP,
    INSTRUCTIONS_CAP,
    SCHEMA_CAP,
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
  // what keeps a hundred-odd lines of dialogue readable in a source file.
  //
  // `w` IS NOW A PARAMETER AND STILL OMITTED FROM ALMOST EVERY LINE. An absent
  // `w` reads as ANY weather, so the bulk of this artifact is the lines a town
  // always has to say, whatever the sky is doing — and the coverage floor below
  // is asserted over THOSE, because a topic whose only lines were weather-tagged
  // would be a branch that vanished on a fair day. The handful that do carry one
  // are extras: a wet square, a wet river, a first fall.
  const line = (at, when, r, text, topic, w) => {
    const row = { at, when, r, text };
    if (topic) row.topic = topic;
    if (w) row.w = w;
    return row;
  };
  // THE WEATHER-TAGGED EXTRAS GET THEIR OWN WRITER, and the reason is a lane
  // rather than readability. `w` is a 0.14 word: a synthetic 0.13 stack — which
  // the byte-stability case builds by narrowing this file's enum to one word —
  // cannot boot on a built-in artifact tagged with a sky it does not have, and a
  // real 0.13 client never sees these defaults at all (they are compiled in, not
  // stored). One writer means that case narrows the pack the way it narrows the
  // enum, in one replace, instead of grepping a literal.
  const sky = (at, when, text, topic, w) => line(at, when, "stranger", text, topic, w);
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
        // ── THE 0.14 ENRICHMENT (plan §2.7) ──────────────────────────────────
        // Every line below is STRANGER, and that is the whole design of it. The
        // talk window serves the stranger register and only that one this
        // release, so a pack whose topics live in friend lines has topic buttons
        // that never render — and the default pack is the artifact a legacy world
        // and a declined generation both read. The floor is TWO per (handle ×
        // topic) rather than one: a rung of size one leaves the ladder's first
        // rung holding a single line, which is why `askPeek` falls through to the
        // next rung rather than restarting inside an exhausted one. Asserted at
        // boot, below.
        //
        // WHAT IT COST, MEASURED: 24 lines a theme, 32 rows to 56, and the
        // serialized artifact grows +3,230 chars for the village and +3,286 for
        // the colony — against `CAPS.lines` of 320, nowhere near anything. It is
        // COMPILED IN rather than stored, so not one byte of it reaches a save.
        //
        // AND IT IS AN INVERSION, said here as well as at the read door: a world
        // that succeeded at generation gets its own sealed pack and reads none of
        // this (`fold`'s `sealed ?? defaults`), so the towns with no generation
        // behind them are the ones that talk best this release.
        //
        // THE INTERIOR HANDLES GET NO FLOOR — workshop, hall, sanctuary and
        // dwelling. The ladder's third and fourth rungs relax the PLACE rather
        // than the topic, so a smith with nothing workshop-shaped to say answers
        // with something the town says, which is honest, where answering with
        // another topic's line would not be.
        line("settlement", "day", "stranger", "There's talk the miller's shorting people. Talk, mind.", "rumor"),
        line("settlement", "dusk", "stranger", "You'll hear about the field before you've been here a week.", "rumor"),
        line(
          "settlement",
          "dusk",
          "stranger",
          "Anything wants doing, it wants doing before dark. Ask at the board.",
          "work",
        ),
        line("settlement", "day", "stranger", "Well's in the middle, board's by the well. That's most of it.", "place"),
        line("settlement", "dawn", "stranger", "Cold one. It'll turn by noon. It usually turns by noon.", "smalltalk"),
        line(
          "settlement",
          "night",
          "stranger",
          "Quiet, isn't it. I like it better this way, if I'm honest.",
          "smalltalk",
        ),
        line(
          "gathering",
          "dusk",
          "stranger",
          "Half of what gets said in here is worth hearing. The other half's worth more.",
          "rumor",
        ),
        line(
          "gathering",
          "night",
          "stranger",
          "Somebody was asking after you. Or after somebody. I wasn't listening.",
          "rumor",
        ),
        line("gathering", "day", "stranger", "If you want paying work, the board outside is the honest list.", "work"),
        line(
          "gathering",
          "dawn",
          "stranger",
          "Kitchen always wants hands. Say I sent you; it'll count for nothing.",
          "work",
        ),
        line(
          "gathering",
          "night",
          "stranger",
          "Fire's the warmest corner. Everything else in here is a draught.",
          "place",
        ),
        line("gathering", "dusk", "stranger", "Long day for everybody, by the look of it.", "smalltalk"),
        line("gathering", "dawn", "stranger", "Too early to be sensible. Sit down anyway.", "smalltalk"),
        line(
          "wilds",
          "day",
          "stranger",
          "People say things about out here. Mostly people who don't come out here.",
          "rumor",
        ),
        line(
          "wilds",
          "night",
          "stranger",
          "There's a story about the far marker. I'd rather tell it indoors.",
          "rumor",
        ),
        line("wilds", "dawn", "stranger", "Good water down that way, if you've a line and the patience.", "work"),
        line("wilds", "day", "stranger", "Anything you gather out here, somebody in town will take off you.", "work"),
        line(
          "wilds",
          "dusk",
          "stranger",
          "Path forks past the old stone. Left goes home, right goes further.",
          "place",
        ),
        line("wilds", "day", "stranger", "It's bigger than it looks from the gate. Everything out here is.", "place"),
        line("wilds", "dawn", "stranger", "Nobody out but us and the birds, then.", "smalltalk"),
        line("wilds", "night", "stranger", "Walking it after dark, are you. Well. So am I.", "smalltalk"),
        // The weather axis, spent on three lines rather than sprinkled: they are
        // EXTRAS over the floor, so a fair day loses nothing by not serving them.
        sky("settlement", "day", "Rain like this and the square turns to soup. Mind the low end.", "place", "rain"),
        sky("wilds", "day", "Wet day's a good day for the water, if you don't mind being wet.", "work", "rain"),
        sky("settlement", "day", "First snow always catches somebody out. Usually me.", "smalltalk", "snow"),
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
        // ── THE 0.14 ENRICHMENT (plan §2.7) ──────────────────────────────────
        // The cozy pack's twin, line for line and floor for floor. See the note
        // over there: stranger register only, two per (handle × topic) across
        // settlement / gathering / wilds, no floor on the interior handles.
        line(
          "settlement",
          "day",
          "stranger",
          "There's talk the recyclers are being run past spec. Talk, mind.",
          "rumor",
        ),
        line("settlement", "dusk", "stranger", "You'll hear about the seals before you've been here a week.", "rumor"),
        line(
          "settlement",
          "dusk",
          "stranger",
          "Anything wants doing, it wants doing before amber. Check the terminal.",
          "work",
        ),
        line(
          "settlement",
          "day",
          "stranger",
          "Recycler's in the middle, terminal's beside it. That's most of it.",
          "place",
        ),
        line(
          "settlement",
          "dawn",
          "stranger",
          "Cold start. It evens out by mid-cycle. It usually evens out.",
          "smalltalk",
        ),
        line(
          "settlement",
          "night",
          "stranger",
          "Quiet, isn't it. I like it better this way, if I'm honest.",
          "smalltalk",
        ),
        line(
          "gathering",
          "dusk",
          "stranger",
          "Half of what gets said in here is worth hearing. The other half's worth more.",
          "rumor",
        ),
        line(
          "gathering",
          "night",
          "stranger",
          "Somebody was asking after you. Or after somebody. I wasn't listening.",
          "rumor",
        ),
        line("gathering", "day", "stranger", "If you want paid work, the terminal outside is the honest list.", "work"),
        line(
          "gathering",
          "dawn",
          "stranger",
          "Galley always wants hands. Say I sent you; it'll count for nothing.",
          "work",
        ),
        line("gathering", "night", "stranger", "Heater's the warmest corner. The rest of it is vent draught.", "place"),
        line("gathering", "dusk", "stranger", "Long shift for everybody, by the look of it.", "smalltalk"),
        line("gathering", "dawn", "stranger", "Too early in the cycle to be sensible. Sit down anyway.", "smalltalk"),
        line(
          "wilds",
          "day",
          "stranger",
          "People say things about out here. Mostly people who don't come out here.",
          "rumor",
        ),
        line("wilds", "night", "stranger", "There's a story about the far beacon. I'd rather tell it inside.", "rumor"),
        line("wilds", "dawn", "stranger", "Good pools down that way, if you've a line and the patience.", "work"),
        line(
          "wilds",
          "day",
          "stranger",
          "Anything you bring back off the flats, somebody in the base will take.",
          "work",
        ),
        line("wilds", "dusk", "stranger", "Line forks past mast nine. Left goes back, right goes further.", "place"),
        line("wilds", "day", "stranger", "It's bigger than it looks from the lock. Everything out here is.", "place"),
        line("wilds", "dawn", "stranger", "Nobody out but us and the dust, then.", "smalltalk"),
        line(
          "wilds",
          "night",
          "stranger",
          "Walking the flats on the night cycle, are you. Well. So am I.",
          "smalltalk",
        ),
        sky(
          "settlement",
          "day",
          "Rain on the deck plates and the yard turns slick. Mind the low end.",
          "place",
          "rain",
        ),
        sky("wilds", "day", "Wet cycle's a good cycle for the pools, if you don't mind being wet.", "work", "rain"),
        sky("settlement", "day", "First fall always catches somebody out. Usually me.", "smalltalk", "snow"),
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
  // THE GUIDANCE'S SKY LIST IS THE AXIS LESS EXACTLY ONE WORD, paired here for
  // the reason every other table in this package is paired at load: the list the
  // model is TAUGHT and the list the schema SEALS are allowed to differ by the
  // one word an untagged line already covers, and by nothing else. A rename or a
  // second exclusion is a throw at the desk rather than a vocabulary that quietly
  // stopped asking for snow.
  if (PF.pack.WEATHERS.length - PF.pack.WEATHERS_ASKED.length !== 1)
    throw new Error(
      `pixelforge: the guidance asks for ${PF.pack.WEATHERS_ASKED.length} of ${PF.pack.WEATHERS.length} sky words; exactly one is covered by an absent tag`,
    );
  for (const word of PF.pack.WEATHERS_ASKED)
    if (!PF.pack.WEATHERS.includes(word))
      throw new Error(`pixelforge: the guidance asks for a "${word}" sky, which the schema does not seal`);

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
    // THE DEFAULT PACK IS HELD TO THE SAME FLOOR A GENERATED ONE IS, and it
    // clears it with room that is worth naming rather than leaving to be
    // discovered: the enriched literal carries 56 lines against a floor of 10, so
    // the floor moving between 10 and 12 does not touch this assert either way.
    // What it protects against is somebody thinning the literal.
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
    // ── THE COVERAGE FLOOR (plan §2.7, owned by slice 4) ────────────────────
    // The talk window renders a topic branch only when it has a line to serve,
    // so this is the assertion that makes "a legacy world gets all four branches
    // on day one" a fact rather than a hope. Three handles because those are the
    // three a legacy layout actually stands up; TWO because a rung of one makes
    // the cycle meaningless; and ANY-WEATHER because a topic whose only lines
    // were sky-tagged would be a branch that disappeared on a fair day, which is
    // most days in most worlds.
    for (const at of ["settlement", "gathering", "wilds"]) {
      for (const topic of PF.pack.TOPICS) {
        const servable = pack.lines.filter(
          (row) => row.r === "stranger" && row.at === at && row.topic === topic && row.w === undefined,
        ).length;
        if (servable < 2)
          throw new Error(
            `pixelforge: the default pack for "${theme}" has ${servable} any-weather stranger line(s) for ${at}/${topic}; the talk window needs two`,
          );
      }
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
