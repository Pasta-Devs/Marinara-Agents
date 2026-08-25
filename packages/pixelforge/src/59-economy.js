// ── Things and money (S3), and the first thing to spend money ON (P1) ─────────
// The player block has held a pouch, a purse and a `home` field since S5 slice 3
// and nothing has ever put anything in them. This is the layer that does: the
// item VOCABULARY (what a `{t,k}` row is called and how it reads in this theme),
// the fixed PRICE list, and the one live transaction 0.11 ships — renting a berth
// at the settlement's inn, which is simultaneously S3's first money sink and the
// bed P5's day-ledger boundary will need (plan §2, Decisions #2).
//
// WHY A BERTH AND NOT A HOUSE. Maintainer ruling #2: there is NO automatic home.
// A modern setting probably houses its protagonist and a fantasy adventurer
// probably sleeps where they can, and only the setup/GM knows which — so the
// block ships the FIELD (booting null) and the player-driven path is renting a
// room. Home ASSIGNMENT channels (a setup flag, P6 building) are enumerated in
// the plan and deliberately not here.
//
// Everything below is CONTENT plus the game-facing entry points: the OFFERS
// (berthOffer, rodOffer) describe and never charge, so the HUD can call them
// every frame; the VERBS (rentBerth, buyRod, grantStartingPurse) mutate. The
// rest — _skin, currency, money, describe, price, the catch tables — is the
// vocabulary those read through. It holds no state of its own: what persists
// goes through the shipped mutators (award/grant/setHome/log/bump) and lives in
// the player block, which is what makes it rewind-safe.

// The catch table's TYPE vocabulary — the fixed shared roles a table entry can
// be, and the one non-catch yield water gives up. A table row carries a role and
// a VARIANT slug ("carp", "kelp", "vat-strain"), and the role is the half that
// means the same thing in every theme, which is why the xp table below is keyed
// by it.
const CATCH_ROLES = ["catch-common", "catch-uncommon", "catch-rare", "catch-prize"];
// Bait is a real water yield and not a catch (fishing is bait's own finder), so
// it sits outside the roles and still earns through the same table: the award
// keys on `role ?? BAIT_TYPE`, which is what stops a bait-first session from
// minting no skill row at all on a player who has plainly been fishing. A table
// entry with no `role` IS a bait entry — one field, read one way.
const BAIT_TYPE = "bait";
// The types whose `k` is a VARIANT SLUG rather than a tier or nothing. describe()
// keys their display name on `k`; PF.player.TOOL_TYPES is the other half of the
// same split and keys on the type's own name with `k` as an adjective in front.
const VARIANT_TYPES = new Set([...CATCH_ROLES, BAIT_TYPE]);

// The closed item vocabulary. A pouch row is keyed `(t, k)` — type and quality —
// and `t` has to mean the same thing in every theme or a save crossing a theme
// change would be renaming the player's belongings. So the TYPES are shared and
// only the SKIN (what it is called, and the glyph the purse shows) is per theme.
const ITEM_TYPES = ["lodging-key", "rod", BAIT_TYPE, ...CATCH_ROLES];

// The skill verbs this build ships a row for. A `skills.verbs` key is world-FREE
// and means the same thing everywhere, exactly as an item type does — so the
// verb is shared and only the SKIN is per theme, and the boot assertion below
// demands every theme name each of these and the two slots it equips.
const SKILL_VERBS = ["fishing"];

// The four daypart words, which is the axis a catch table's multipliers are keyed
// on. They mirror PF.Sim.daypart()'s own four and are written here because the sim
// exports no list; the boot assertion below refuses a table entry keyed on
// anything else, which is what stops a plausible-looking "evening" column from
// shipping as a multiplier that never applies.
const DAYPARTS = ["dawn", "day", "dusk", "night"];

// The two feature tags that hold fishable water — the closed brief vocabulary's
// own words (18-brief FEATURE_TAGS), and the second half of a catch table's key.
// A spot's kind is where it stands in the world's shape, not what it is called:
// still water and running water fish differently in any theme, so the table set
// is (theme × kind) and both halves are asserted complete at boot.
const SPOT_TAGS = ["water-feature", "water-crossing"];

// ── What comes out of the water (plan §2.2) ──────────────────────────────────
// One table per (theme, spot kind). An ENTRY is `{role, variant, weight,
// minLevel, daypart}`:
//   • `role`   — the shared TYPE, one of CATCH_ROLES. ABSENT means bait, which is
//                a yield in its own right and the only one that is also an input.
//   • `variant`— the entry's slug, and the pouch row's `k`. Row identity is
//                `(role, variant)`, so kelp never merges into carp and a stack of
//                one thing is a stack of one thing.
//   • `weight` — relative share of the successful casts this table answers for.
//   • `minLevel` — the level the entry becomes REACHABLE at; below it the entry
//                is not in the draw at all, which is what makes the ladder feel
//                like it opens water up rather than merely raising a percentage.
//   • `daypart`— per-daypart multipliers over `weight`, absent meaning 1. This is
//                0.12's ONLY live modifier (weather is L2, M9) and it is where a
//                night spot stops being the same spot as a noon one.
// NO PER-ENTRY XP: TUNING.catchXp is the single authority, keyed by TYPE, so a
// rebalance happens in one place and cannot half-happen.
//
// SCI-FI IS NOT FISH-FREE (M6 RULED). A colony that stocks a coolant pool eats
// carp out of it; what the theme adds is flavored variants beside the real fish
// and non-fish yields — kelp cultures, filter salvage — that are legitimate
// entries and not consolation prizes.
const CATCH_TABLES = {
  "cozy-village": {
    "water-feature": [
      { variant: "worms", weight: 24, minLevel: 1, daypart: { dawn: 1.2, night: 0.7 } },
      { role: "catch-common", variant: "carp", weight: 34, minLevel: 1, daypart: { night: 0.7 } },
      { role: "catch-uncommon", variant: "bream", weight: 18, minLevel: 3, daypart: { dusk: 1.3 } },
      { role: "catch-rare", variant: "mirror-pike", weight: 6, minLevel: 7, daypart: { day: 0.6, night: 1.6 } },
      { role: "catch-prize", variant: "old-tench", weight: 2, minLevel: 12, daypart: { dawn: 2, day: 0.5 } },
    ],
    "water-crossing": [
      { variant: "grubs", weight: 22, minLevel: 1 },
      { role: "catch-common", variant: "minnow", weight: 32, minLevel: 1 },
      { role: "catch-uncommon", variant: "trout", weight: 17, minLevel: 4, daypart: { dawn: 1.4, dusk: 1.3 } },
      { role: "catch-rare", variant: "silver-eel", weight: 6, minLevel: 8, daypart: { day: 0.5, night: 1.8 } },
      { role: "catch-prize", variant: "crown-salmon", weight: 2, minLevel: 13, daypart: { dawn: 1.6 } },
    ],
  },
  "sci-fi-colony": {
    "water-feature": [
      { variant: "chum", weight: 24, minLevel: 1 },
      { role: "catch-common", variant: "carp", weight: 28, minLevel: 1, daypart: { night: 0.7 } },
      { role: "catch-common", variant: "culture-kelp", weight: 14, minLevel: 1 },
      { role: "catch-uncommon", variant: "vat-strain", weight: 16, minLevel: 3, daypart: { dusk: 1.3 } },
      { role: "catch-rare", variant: "pressure-eel", weight: 6, minLevel: 7, daypart: { night: 1.6 } },
      { role: "catch-prize", variant: "heritage-koi", weight: 2, minLevel: 12, daypart: { dawn: 1.8, day: 0.5 } },
    ],
    "water-crossing": [
      { variant: "larvae", weight: 22, minLevel: 1 },
      { role: "catch-common", variant: "minnow", weight: 30, minLevel: 1 },
      { role: "catch-uncommon", variant: "filter-salvage", weight: 12, minLevel: 2 },
      { role: "catch-uncommon", variant: "trout", weight: 16, minLevel: 4, daypart: { dawn: 1.4 } },
      { role: "catch-rare", variant: "deepline-eel", weight: 6, minLevel: 8, daypart: { night: 1.8 } },
      { role: "catch-prize", variant: "ice-run-char", weight: 2, minLevel: 13, daypart: { dawn: 1.6 } },
    ],
  },
};

const ITEM_SKINS = {
  "cozy-village": {
    currency: { one: "coin", many: "coins", glyph: "◍" },
    items: {
      "lodging-key": { name: "room key", glyph: "🔑" },
      rod: { name: "fishing rod", glyph: "🎣" },
      [BAIT_TYPE]: { name: "hook bait", glyph: "🪱" },
      "catch-common": { name: "catch", glyph: "🐟" },
      "catch-uncommon": { name: "good catch", glyph: "🐟" },
      "catch-rare": { name: "rare catch", glyph: "🐠" },
      "catch-prize": { name: "prize catch", glyph: "🏆" },
    },
    // EVERY VARIANT ANY SHIPPED TABLE NAMES, in every theme — asserted at boot.
    // The pouch is world-free, so a carp caught in a valley is still in the bag
    // when the same chat's next world is a colony, and the row has to have a word
    // there too. Which is also why the shared ones read the same in both maps: a
    // carp is a carp in any world, and the entries that earn their keep are the
    // ones a theme only ever sees in a traveller's pouch — this map's rendering
    // of the colony's kelp and vat stock, and the colony's of a mirror pike.
    variants: {
      worms: "worms",
      grubs: "grubs",
      chum: "chum",
      larvae: "wrigglers",
      carp: "carp",
      bream: "bream",
      minnow: "minnow",
      trout: "trout",
      "mirror-pike": "mirror pike",
      "silver-eel": "silver eel",
      "old-tench": "old tench",
      "crown-salmon": "crown salmon",
      "culture-kelp": "strange kelp",
      "vat-strain": "pale fish",
      "pressure-eel": "deep eel",
      "heritage-koi": "painted carp",
      "filter-salvage": "odd scrap",
      "deepline-eel": "black eel",
      "ice-run-char": "ice char",
    },
    // The seeded flourish's word pools, keyed by the row's TYPE. A pool is a
    // DISPLAY override and nothing else — no row, no byte and no roll depends on
    // it — so a theme that ships none simply reads its plain names.
    flourishes: {
      "catch-common": ["plump", "muddy", "silver-sided"],
      "catch-uncommon": ["bright-finned", "deep-water", "speckled"],
      "catch-rare": ["scarred", "moon-pale", "grandfather"],
      "catch-prize": ["storied", "long-hunted", "river-king's"],
    },
    // The refusals a player is meant to ACT on, in this theme's words. `{role}`
    // is filled from the keeper's COMPILED role and never hardcoded: a sci-fi
    // colony has no innkeeper, and only the brief knows what it does have.
    hints: { noRod: "You need a rod — the {role} sells one." },
    // WHAT THIS WORLD CALLS THE PERSON PLAYING IT. The package has no player
    // name and the host props expose none, so the character sheet says what KIND
    // of person is standing there rather than inventing a name for them (plan
    // §2.8). An engine persona name + avatar is an enumerated Engine FR.
    player: "Traveler",
    // A VERB'S OWN WORD BOOK: what the skill is called here, and what its two
    // equipment slots hold. The slot names are the closed `tool`/`mod` pair the
    // block stores; a player should never be shown either of those words.
    verbs: { fishing: { name: "Fishing", tool: "rod", mod: "bait" } },
  },
  "sci-fi-colony": {
    currency: { one: "credit", many: "credits", glyph: "◈" },
    items: {
      "lodging-key": { name: "berth chit", glyph: "🔑" },
      rod: { name: "angling rig", glyph: "🎣" },
      [BAIT_TYPE]: { name: "lure stock", glyph: "🪱" },
      "catch-common": { name: "haul", glyph: "🐟" },
      "catch-uncommon": { name: "good haul", glyph: "🐟" },
      "catch-rare": { name: "rare haul", glyph: "🐠" },
      "catch-prize": { name: "record haul", glyph: "🏆" },
    },
    variants: {
      worms: "worms",
      grubs: "grubs",
      chum: "chum",
      larvae: "tank larvae",
      carp: "carp",
      bream: "bream",
      minnow: "minnow",
      trout: "trout",
      "mirror-pike": "mirror pike",
      "silver-eel": "silver eel",
      "old-tench": "old tench",
      "crown-salmon": "crown salmon",
      "culture-kelp": "culture kelp",
      "vat-strain": "vat strain",
      "pressure-eel": "pressure eel",
      "heritage-koi": "heritage koi",
      "filter-salvage": "filter salvage",
      "deepline-eel": "deepline eel",
      "ice-run-char": "ice-run char",
    },
    flourishes: {
      "catch-common": ["tank-bred", "pale", "filter-fed"],
      "catch-uncommon": ["odd-scaled", "cold-run", "gene-drifted"],
      "catch-rare": ["unlogged", "pressure-marked", "off-manifest"],
      "catch-prize": ["record", "founder-stock", "hand-listed"],
    },
    hints: { noRod: "You need an angling rig — the {role} stocks one." },
    player: "Drifter",
    verbs: { fishing: { name: "Angling", tool: "rig", mod: "lure" } },
  },
};

// The rungs the rod ladder can quote (plan §2.4). 0.12 sells two: a rodless
// player is offered `crude`, a crude owner is offered `decent`, and a
// decent-or-better owner is offered nothing at all. The upper QUALITY tiers are
// content for a later release and are deliberately absent — the boot assertion
// at the foot of this file demands a price row for every rung this list names,
// in every theme, so adding one here is what makes the build insist on pricing
// it rather than letting a keeper refuse the sale at play as "not for sale".
const ROD_TIERS = ["crude", "decent"];

/** The price key a rod tier is quoted under. One helper rather than two format
 *  strings in two files, so the assertion and the offer cannot drift apart. */
const rodPriceKey = (tier) => `rod:${tier}`;

// Fixed price lists, per theme (plan §2: "0.11 can ship fixed price lists first").
// The weekly deterministic stock tables the plan describes need L2's calendar and
// arrive with it; nothing here blocks that and nothing here has to be unpicked for
// it — a table lookup replaces the constant and the verbs do not move.
//
// THE ROD ROWS ARE PER (THEME, TIER) BECAUSE ACQUISITION IS PER THEME, which is
// the whole of the maintainer's amended ruling: no rod is ever free, and what
// differs between worlds is what buying one COSTS you. Fantasy fishing is a
// common thing to do, so its entry rod is cheap — half a night's berth, which is
// "easily obtainable" made concrete. A sci-fi colony fishes as a niche hobby, so
// its keeper quotes the same entry rod at FOUR TIMES the fantasy price (24
// against 6 — the stated multiple), standing in until the hobby-store and
// online-shopping mechanic lands and takes sci-fi rod acquisition off the keeper
// entirely. The premium sits on the ENTRY rung because acquisition is what the
// ruling is about; `decent` is a deliberate upgrade in either world and is
// priced the same in both.
//
// Every number here is retunable DATA and nothing asserts a relationship between
// them — see TUNING's price-interplay note for what a tuner should watch while
// moving them.
const PRICES = {
  "cozy-village": { berth: 12, "rod:crude": 6, "rod:decent": 40 },
  "sci-fi-colony": { berth: 12, "rod:crude": 24, "rod:decent": 40 },
};

// What a new game starts with. It exists because a sink with no source is not a
// feature: the real income is the quest layer (P4, roadmap 0.13), so without this
// the one transaction 0.11 ships would be unreachable in a shipped game and only
// ever exercised by a test that minted its own money. Granted ONCE, on the first
// sealed world to come up on a block nothing has touched — see grantStartingPurse
// for why that condition and not a default value.
const STARTING_PURSE = 40;

// "Line and tackle included" — the stack of bait that rides the FIRST rod
// purchase. Its slug is the theme's own first bait variant (see starterBait), so
// it merges with the bait the player then fishes up rather than orphaning a
// second row beside it. A purchase quantity and not a fishing number, which is
// why it sits beside the starting purse and not in TUNING.
const STARTER_BAIT = 8;

// ── Fishing's tuning table (plan §2.2, §2.4) ─────────────────────────────────
// Exported and retunable, and it is the ONLY place a number the fishing verb
// uses is written: a tuner changes how fishing plays by editing this object and
// touching nothing else. Every field carries its own comment because "no
// unstated numbers" is the rule the plan set for this table specifically.
//
// PACING, stated so a retune can be checked against an intent instead of a
// feeling. The FIXED side is the ladder: leaving level `l` costs 10l xp
// (PF.player.xpPerLevel) against a ceiling of CAPS.skillLevel 20, so the cap is
// Σ 10l for l = 1…19 = 1,900 xp and nothing below can move it. The target is
// that a player who fishes as their day's work gets there in a few dozen of
// those days. At `castMinutes` 15 a ten-hour day is 40 windows; mid-curve
// (decent rod, BAITLESS, halfway up the ladder) lands p = 0.48 × 1.15 ≈ 0.55, so
// ≈ 22 of them yield; a common-heavy table pays ≈ 1.8 xp a yield. Call it 40 xp
// a day, and the cap is ≈ 48 days of nothing but fishing. A day fished BAITED
// throughout is the same chain times `baitMult`: p ≈ 0.69, ≈ 50 xp, ≈ 38 days —
// which is the honest range, since no real session stays on one side of it.
//
// THE CATCH TABLE MOVES THAT AS MUCH AS THIS OBJECT DOES, and the BAIT SHARE is
// the sharpest lever in it: bait pays `catchXp[BAIT_TYPE]`, the floor, and it
// also refills the stack the bait multiplier rides on — so a high bait weight is
// a self-sustaining, slow-earning table, and a low one drains toward baitless
// casting at the lower multiplier. Recompose the table and the arithmetic above
// has to be redone.
//
// PRICE INTERPLAY — A NOTE FOR TUNERS, NOT AN INVARIANT (maintainer override,
// 2026-08-24). Nothing in this build asserts that a starting purse can afford a
// rod, a berth, or both, and that is deliberate: 0.12 ships no income mechanic,
// nobody is required to sleep in a rented berth, and income arrives in later
// releases. The rod-against-berth fork is a PLAYER's choice and the build
// declines to have an opinion about it. What a tuner should know while moving
// numbers: STARTING_PURSE 40 against a 12-coin berth and the 6-coin fantasy
// entry rod leaves room for both several times over, while the 24-credit sci-fi
// rod turns the same purse into a real decision — and a player who spends the
// purse down before buying is priced out of fishing until income lands, which is
// an accepted limitation and not a bug.
const TUNING = {
  // THE SUCCESS CURVE, one family for every cast:
  //     p = base(level) * toolMult[toolTier] * modMult[modTier]
  // where base(level) = min(baseCeil, baseAt1 + basePerLevel * (level - 1)) and
  // every tier is a RESOLVED index (PF.player.resolvedToolTier /
  // resolvedModTier), never a string off the save.
  baseAt1: 0.3, // chance at level 1 with a crude rod and no bait: a third of casts
  basePerLevel: 0.02, // added per level climbed, so level 20 sits at 0.68
  baseCeil: 0.8, // the curve's own ceiling, so no retune of the two above can promise every cast
  // One multiplier per QUALITY rung, in ladder order — crude is 1.0 because a
  // rod is the price of ENTRY and not a bonus, and the two upper rungs are live
  // numbers waiting on the content that sells them. Its length is asserted
  // against QUALITY's at boot: a ladder and a multiplier list that can disagree
  // is a silently mis-tiered curve.
  toolMult: [1, 1.15, 1.3, 1.45],
  // The modifier list is `[1, baitMult]` and only the second entry is tunable:
  // tier 0 is a BAITLESS cast, which is the baseline by definition rather than a
  // number anybody chose. Presence-based, so this is what bait is worth — not
  // what a grade of bait is worth (graded mods are L2 content).
  baitMult: 1.25,
  castMinutes: 15, // one cast = one window = this many minutes of clock, and 1440 divides by it
  // XP per successful window, keyed by the yield's TYPE — the four roles and
  // bait — and this table is the single xp authority: table entries carry no xp
  // of their own, so a rebalance happens in one place. Asserted complete at boot.
  catchXp: { "catch-common": 1, "catch-uncommon": 2, "catch-rare": 5, "catch-prize": 10, [BAIT_TYPE]: 1 },
  // The wrap-up tell's size budget, in graphemes. It renders WHOLE DAYS or none,
  // so this is floor-asserted at boot against one maximum-shape day
  // (CAPS.ledgerPerDay × CAPS.ledgerChars = 3,000) — under that floor the tell
  // renders zero days, the burn advances through nothing, and the flush stalls
  // forever. It is set AT the floor on purpose: one max-shape day is guaranteed
  // to render, an ordinary day is a small fraction of it so several fit, and a
  // prompt part is not a place to spend more than it has to.
  ledgerTellChars: 3000,
};

PF.economy = {
  ITEM_TYPES,
  PRICES,
  STARTING_PURSE,
  STARTER_BAIT,
  ROD_TIERS,
  CATCH_ROLES,
  BAIT_TYPE,
  SKILL_VERBS,
  CATCH_TABLES,
  SPOT_TAGS,
  DAYPARTS,
  TUNING,
  rodPriceKey,

  /** The theme's skin table, falling back to the default theme rather than
   *  throwing: a save can name a theme this build no longer ships.
   *
   *  OWN-PROPERTY ONLY, exactly as price() reads its own table and simFromSaved
   *  reads `world.zones`. `world.theme` comes off untrusted save JSON, and a
   *  nullish-coalescing lookup never reaches its fallback for "constructor" or
   *  "toString": the prototype answers with something non-nullish, and then every
   *  economy call for that save TypeErrors on `.currency` instead of quietly
   *  rendering in the default theme's words. */
  _skin(world) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    return Object.prototype.hasOwnProperty.call(ITEM_SKINS, theme) ? ITEM_SKINS[theme] : ITEM_SKINS["cozy-village"];
  },

  /** What this world calls its money. */
  currency(world) {
    return this._skin(world).currency;
  },

  /** What this world calls the person playing it — the character sheet's themed
   *  generic label (plan §2.8), standing in until the engine exposes a persona
   *  name and avatar. */
  playerLabel(world) {
    return this._skin(world).player;
  },

  /** A verb's word book: its display name and the words for its two equipment
   *  slots. An UNKNOWN verb still renders, slug-derived, exactly as describe()'s
   *  unknown type does one method down — a save can carry a skill row written by
   *  a newer build, and the sheet showing it as "flying" is a display fact
   *  rather than a hole. */
  verbSkin(world, verb) {
    const name = typeof verb === "string" ? verb : "";
    const book = this._skin(world).verbs;
    if (Object.prototype.hasOwnProperty.call(book, name)) return book[name];
    return { name: name.replace(/[-_]/g, " "), tool: "tool", mod: "modifier" };
  },

  /** `12 coins`, `1 coin`. The purse chip and every price string go through this
   *  so a sci-fi colony never charges anybody "coins". */
  money(world, amount) {
    const n = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
    const { one, many } = this.currency(world);
    return `${n} ${n === 1 ? one : many}`;
  },

  /** A pouch row's display name. An UNKNOWN type still renders — a newer build's
   *  item, or one a GM channel grants later, reads as its own tag rather than
   *  vanishing from the purse. The completeness assertion below is what keeps
   *  every type this build can actually produce out of that fallback.
   *
   *  `k` IS TWO VOCABULARIES AND THIS IS WHERE THAT SHOWS (plan §2.2). On a
   *  TOOL it is a tier and reads as an adjective — "crude rod". On a catch or a
   *  bait it is a VARIANT SLUG and it is the name: the type is "catch-common"
   *  and the thing in the bag is a carp, so the lookup keys on `k` and the
   *  type's own word is only the fallback for a row that carries none. The old
   *  path put the two together and would have rendered "worms bait", which is
   *  why it is now scoped rather than general — and why a row whose type is
   *  neither takes no prefix at all, `k` there being a slug nobody has claimed. */
  describe(world, item) {
    const t = typeof item === "string" ? item : typeof item?.t === "string" ? item.t : "";
    if (!t) return "";
    const skin = this._skin(world);
    // The items map takes an own-property read for the same reason the skin table
    // does one line up: `t` is a pouch row's type off untrusted save JSON, and
    // `items["constructor"]` resolves to a function whose `.name` is "Object".
    const typeSkin = Object.prototype.hasOwnProperty.call(skin.items, t) ? skin.items[t] : null;
    const typeName = typeSkin ? typeSkin.name : t.replace(/[-_]/g, " ");
    const k = typeof item === "object" && typeof item?.k === "string" ? item.k : "";
    let base = typeName;
    if (PF.player.TOOL_TYPES.has(t)) base = k ? `${k} ${typeName}` : typeName;
    else if (VARIANT_TYPES.has(t) && k) {
      // A VARIANT NO SKIN KNOWS still renders, slug-derived, exactly as an
      // unknown TYPE does one line up — a hostile save row or a newer build's
      // table is a display problem and never a throw.
      base = Object.prototype.hasOwnProperty.call(skin.variants, k) ? skin.variants[k] : k.replace(/[-_]/g, " ");
    }
    const flourish = this._flourish(world, t, k);
    return flourish ? `${flourish} ${base}` : base;
  },

  /** The seeded display override, keyed `(seed, t, k)` uniformly (plan §2.2).
   *
   *  Keyed on the WORLD's seed and not on the moment, because pouch rows MERGE:
   *  there is one carp row holding nine carp, so a per-catch epithet would have
   *  nothing to live on. Per world per variant is the shape the data can carry —
   *  this valley's carp are the muddy ones and the next world's are not — and it
   *  is computable wherever describe() runs, so the purse chip, the ledger and
   *  the sheet all say the same thing without anybody storing it.
   *
   *  Returns "" when the theme ships no pool for that type, which is the
   *  skin-name fallback: rods, bait and keys read plainly, and a pool added later
   *  is a content change and not a mechanism one. */
  _flourish(world, t, k) {
    const pools = this._skin(world).flourishes;
    if (!Object.prototype.hasOwnProperty.call(pools, t)) return "";
    const pool = pools[t];
    if (!Array.isArray(pool) || !pool.length) return "";
    const seed = Number.isFinite(world?.seed) ? world.seed >>> 0 : 0;
    return pool[PF.hashStr(`${seed}:${t}:${k}`) % pool.length];
  },

  /** The catch table for a world's theme and a spot's tag, or null when the tag
   *  is not one that holds water. Own-property both ways: `world.theme` and a
   *  registry row's `tag` are both strings this file did not write. */
  catchTable(world, tag) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    const byTheme = Object.prototype.hasOwnProperty.call(CATCH_TABLES, theme)
      ? CATCH_TABLES[theme]
      : CATCH_TABLES["cozy-village"];
    if (typeof tag !== "string" || !Object.prototype.hasOwnProperty.call(byTheme, tag)) return null;
    return byTheme[tag];
  },

  /** A table entry's pouch TYPE. `role ?? BAIT_TYPE` in one place, so the xp
   *  award, the row identity and the ledger line cannot disagree about what a
   *  roleless entry is. */
  entryType(entry) {
    return typeof entry?.role === "string" && entry.role ? entry.role : BAIT_TYPE;
  },

  /** The bait variant a theme's first rod purchase throws in. THE THEME'S FIRST
   *  bait entry, scanned in SPOT_TAGS order — so the starter stack merges with
   *  the bait the player then fishes out of that same water instead of sitting
   *  beside it as a second row of a thing they already have. Null for a theme
   *  whose tables carry no bait at all, which the boot assertion refuses. */
  starterBait(world) {
    for (const tag of SPOT_TAGS) {
      for (const entry of this.catchTable(world, tag) ?? []) {
        if (this.entryType(entry) === BAIT_TYPE) return entry.variant;
      }
    }
    return null;
  },

  /** The price of a named thing in this world, or null when it is not for sale
   *  here. Null rather than a default number: a caller that cannot find a price
   *  must refuse the sale, not invent one. */
  price(world, what) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    // Own-property BOTH ways. The inner read always was; the table read was not,
    // and `PRICES["constructor"]` resolving to a function meant a save naming a
    // prototype key priced nothing at all — every sale refused, with no way for
    // the player to tell that from a world that simply sells no rooms.
    const table = Object.prototype.hasOwnProperty.call(PRICES, theme) ? PRICES[theme] : PRICES["cozy-village"];
    const value = Object.prototype.hasOwnProperty.call(table, what) ? table[what] : null;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  },

  // ── The berth (S3's money sink, P1's bed) ──────────────────────────────────

  /** The keeper standing in the room the player is in, or null.
   *
   *  The offer's SECOND path, and the one the second live playtest was missing.
   *  `sim.nearNpc` is the single NEAREST NPC within 26px — a tile and a half — so
   *  keying the whole offer on it meant the room could be the settlement's only
   *  inn, the keeper could be standing in it, and the button was still hidden
   *  because the player was closer to the guard by the door. The maintainer stood
   *  inside The Amber Hearth with Mira a few tiles off and had Talk, Wait and
   *  Keyboard and nothing else.
   *
   *  ONLY EVER THROUGH THE ZONE MARK, which is what keeps this honest: the
   *  compiler puts that mark up only when somebody took the keeper's mark that
   *  pairs with it (20-world, both-marks-or-neither), so a hostless gathering has
   *  no mark and this path can never find one. And the keeper has to actually BE
   *  here — `zone.npcs` is where 30-sim's schedules splice people, so an inn the
   *  daypart emptied is an empty inn and quotes nothing.
   *
   *  Own-property, like every other read in this file: `sim.zoneId` comes off
   *  untrusted save JSON and `zones["constructor"]` is not a room. */
  _keeperInRoom(sim) {
    const zoneId = sim?.zoneId;
    const zones = sim?.world?.zones;
    if (typeof zoneId !== "string" || !zones || !Object.prototype.hasOwnProperty.call(zones, zoneId)) return null;
    const zone = zones[zoneId];
    if (zone?.lodging !== true) return null;
    for (const npc of zone.npcs ?? []) if (npc?.lodging === zoneId) return npc;
    return null;
  },

  /** THE KEEPER, whichever way you found them: reach first, then the room. Both
   *  halves of the rule, in one place, because the keeper now sells two things.
   *
   *  Reach first, so a keeper you are standing next to always answers for their
   *  own room even when you are both inside somebody else's; the room second,
   *  because being inside the inn is the other half of the same fact and it is
   *  the half a player actually discovers (see _keeperInRoom for the playtest
   *  that found it).
   *
   *  EXTRACTED RATHER THAN COPIED (plan §2.4). The berth and the rod are quoted
   *  by the same person and their resolutions must not drift: a second copy of
   *  this line would be a build where the innkeeper lets you a room from across
   *  the counter and refuses to sell you a rod from the same spot. */
  _keeper(sim) {
    const inReach = sim?.nearNpc;
    return typeof inReach?.lodging === "string" && inReach.lodging ? inReach : this._keeperInRoom(sim);
  },

  /** Is there a berth on offer where the player is standing, and what would it
   *  cost? Describes only — it never charges anything, so the HUD can call it
   *  every frame and a caller can render the refusal instead of hiding the
   *  button. Returns { available, reason, keeper, zoneId, price, home }.
   *
   *  The offer follows the PERSON: `npc.lodging` is stamped on the keeper of the
   *  settlement's gathering (20-world), so an innkeeper standing in the square at
   *  noon can still let you a room, which is what a keeper is.
   *
   *  …and it follows the ROOM as well (see _keeperInRoom). Being inside the inn
   *  is the other half of the same fact, and it is the half a player actually
   *  discovers: you walk in, and the room is offering. Reach first, so a keeper
   *  you are standing next to always answers for their own room even when you are
   *  both inside somebody else's. */
  berthOffer(core) {
    const sim = core?.sim;
    const world = sim?.world;
    const no = (reason) => ({ available: false, reason, keeper: null, zoneId: null, price: null, home: null });
    const npc = this._keeper(sim);
    if (!sim || !npc) return no("no-keeper");
    if (!world?.zones || !Object.prototype.hasOwnProperty.call(world.zones, npc.lodging)) return no("no-lodging");
    const price = this.price(world, "berth");
    if (price === null) return no("not-for-sale");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const offer = { available: true, reason: null, keeper: npc, zoneId: npc.lodging, price, home: player.home };
    // Already the player's room: refused rather than sold again. Renting the same
    // berth twice is not a second room, it is the same room and a lighter purse.
    if (player.home === npc.lodging) return { ...offer, available: false, reason: "already-yours" };
    if ((player.pouch?.money ?? 0) < price) return { ...offer, available: false, reason: "cannot-afford" };
    return offer;
  },

  /** Take the room. Every effect goes through a SHIPPED mutator, in an order that
   *  cannot half-charge anybody:
   *    1. re-read the offer (the HUD's copy is a frame old and the player may
   *       have walked away, or spent the money on something else since);
   *    2. `award({ money: -price })` — the purse pays. It is deliberately NOT
   *       `take()`, which is the ITEM verb; money has one mutator and this is it.
   *       award() FLOORS at zero rather than refusing, which is exactly why the
   *       affordability test is the caller's job and is made above, before a
   *       single field moves;
   *    3. `setHome(zoneId)` — the anchor. A sealed zone id ("z4") or the legacy
   *       "inn", never a minted `h{n}`, which setHome refuses on its own;
   *    4. `grant("lodging-key")` — the receipt, and the pouch's first real row;
   *    5. `log()` — the day-ledger line P5 will summarise;
   *    6. `bump()` — the keeper remembers. SETTLEMENT-scoped (plan §2: rel keys
   *       are per settlement, not per room), so renting twice does not create two
   *       people with one name.
   *  Returns { ok, reason, price, zoneId }. */
  rentBerth(core, gen) {
    const offer = this.berthOffer(core);
    if (!offer.available) return { ok: false, reason: offer.reason, price: offer.price, zoneId: offer.zoneId };
    const sim = core.sim;
    const world = sim.world;
    const paid = PF.player.award(core, { money: -offer.price }, gen);
    // The fence, the gate, or a chat switch under us: award() is the first verb
    // that could refuse, and nothing after it has run.
    if (!paid) return { ok: false, reason: "refused", price: offer.price, zoneId: offer.zoneId };
    PF.player.setHome(core, offer.zoneId, gen);
    PF.player.grant(core, { t: "lodging-key", k: "" }, 1, gen);
    const place = world.zones[offer.zoneId]?.name ?? "the inn";
    PF.player.log(core, `Took a berth at ${place} for ${this.money(world, offer.price)}.`, sim.day, gen);
    PF.player.bump(core, world.startZone, offer.keeper.name, { t: 1, s: `Let you a berth at ${place}.` }, gen);
    return { ok: true, reason: null, price: offer.price, zoneId: offer.zoneId };
  },

  // ── Sleep (what the berth is FOR) ──────────────────────────────────────────

  /** Is there a bed where the player is standing? Describes only, so the HUD can
   *  call it every frame. Returns { available, reason, bed, zoneId }.
   *
   *  BED-GATED ON THE HOME ANCHOR, which is the same fact rentBerth wrote: the
   *  anchor IS the lodging zone the player holds a berth in (`setHome(zoneId)`),
   *  so "in your home zone" and "in a lodging zone you have paid for" are one
   *  test and not two. A homeless player has nowhere to sleep — the §5
   *  never-flush class, accepted and stated — and a minted `{minted:true}` anchor
   *  names no zone to stand in, so it is not one either.
   *
   *  `bed` is the render test the button gates on, exactly as `spot` is the fish
   *  button's and `price !== null` is the berth's: a refusal that still says
   *  there is a bed here is about the MOMENT (mid-conversation, mid-stream) and
   *  belongs on screen saying so; one that says there is no bed is about the
   *  place, and there is nothing to show. */
  sleepOffer(core) {
    const sim = core?.sim;
    const no = (reason) => ({ available: false, reason, bed: false, zoneId: null });
    if (!sim) return no("no-sim");
    if (PF.save?.gateHolds?.(core)) return no("gate-held");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const home = typeof player.home === "string" ? player.home : "";
    if (!home || home !== sim.zoneId) return no("no-bed");
    const offer = { available: true, reason: null, bed: true, zoneId: home };
    // Walk only, like every other clock mover: sleeping through a conversation
    // would move the person being talked to.
    if (sim.mode !== "walk") return { ...offer, available: false, reason: "wrong-mode" };
    // …and never under a turn that is still being written. Sleep sends nothing,
    // so this is not about the pipeline: it is that the hours would pass under
    // narration the player has not read yet (the Talk verb's own rule).
    if (core.host?.isStreaming) return { ...offer, available: false, reason: "streaming" };
    return offer;
  },

  /** Sleep until the next occurrence of a daypart, and stage what that finished.
   *
   *  SENDS NOTHING, which is the whole shape of it: no turn, no narration, no
   *  await. What it leaves behind is `intro.ledgerOwed`, and the next turn the
   *  player sends for their OWN reasons carries the wrap-up (plan §2.6, ruling 1).
   *  That is why there is no `!PF.spatial.pending` guard here: sleeping under an
   *  in-flight send is safe, because staging only ever RAISES the marker and the
   *  in-flight burn's guard reads live and still passes for its smaller day.
   *
   *  The mover is `waitUntil` — the rest action's jump, which pre-rolls the day
   *  when the target is behind the clock and re-places everybody on arrival — and
   *  not `advanceMinutes`, which takes minutes rather than a time of day.
   *
   *  Staging reads the clock AFTER the advance and takes the max (30-sim
   *  `stageLedgerOwed`). Returns { ok, reason, day, clockMin, owed }.
   *
   *  EVERY REFUSAL IS THE SAME SHAPE, and it is the NOTHING-HAPPENED one that
   *  `fish()` uses beside it: `reason` carries which refusal it was and the
   *  numbers carry zero, because nothing moved. The reasons are distinct on
   *  purpose; the numbers must not be, or a caller reading `day` learns the KIND
   *  of refusal by accident and reads a live clock off a call that spent no
   *  minutes. */
  sleep(core, target) {
    const no = (reason) => ({ ok: false, reason, day: 0, clockMin: 0, owed: 0 });
    const offer = this.sleepOffer(core);
    if (!offer.available) return no(offer.reason);
    const sim = core.sim;
    if (!sim.waitUntil(target)) return no("unknown-target");
    const owed = sim.stageLedgerOwed();
    // The Wait precedent (70-hud): a clock mover that does not flag the save
    // loses its hours on reload, and this one also has a marker to lose.
    core.markDirty?.();
    return { ok: true, reason: null, day: sim.day, clockMin: sim.clockMin, owed };
  },

  // ── The rod (the keeper's second trade) ────────────────────────────────────

  /** The rung the player has already climbed: the MAX over pouch rows typed
   *  `rod` of `resolvedToolTier(k)`, or null when there is no rod row at all.
   *
   *  POUCH-ONLY, and derived — nothing anywhere writes a "rods bought" field
   *  (plan §2.4). Auto-equip guarantees an equipped rod has a pouch row behind
   *  it, and the pouch is world-free while rods are unremovable in 0.12, so a
   *  severance can never resurrect a rung already climbed.
   *
   *  Through the resolver and not `indexOf`: a hostile `k` ("legendary") clamps
   *  to 0 and the ladder goes on quoting `decent`, which is benign and is what
   *  the whole resolve-at-read discipline is for. NULL is a different answer from
   *  0 — no rod at all against a crude one — and the no-rod refusal is exactly
   *  that absence. */
  rodTier(player) {
    let best = null;
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t !== "rod") continue;
      const tier = PF.player.resolvedToolTier(row.k);
      if (best === null || tier > best) best = tier;
    }
    return best;
  },

  /** What the keeper would sell you next, and what it costs. Describes only, so
   *  the HUD can call it every frame. Returns { available, reason, keeper, tier,
   *  price }.
   *
   *  ONE BUTTON, ONE LADDER: the offer quotes the next rung the player LACKS —
   *  no rod quotes `crude`, a crude owner quotes `decent`, and a decent-or-better
   *  owner is quoted nothing and the button VANISHES. That last part is a stated
   *  divergence from the berth button's never-vanish rule: a berth is a thing you
   *  can want again tomorrow, while rod ownership is global and permanent, and a
   *  forever-dimmed chip saying "you already have one" is dead chrome.
   *
   *  Cannot-afford is the berth's own idiom instead — shown, dimmed, still
   *  quoting the price, because a control that disappears when the purse runs
   *  short teaches the player nothing about what to save for.
   *
   *  POUCH HEADROOM IS CHECKED HERE, with the arity the purchase actually needs:
   *  a crude rod arrives with a starter bait stack, so it is TWO new rows unless
   *  the player somehow already holds bait, and a decent rod is one. This
   *  pre-check is what makes buyRod's no-rollback shape sound — grant() cannot be
   *  allowed to refuse after award() has already charged. */
  rodOffer(core) {
    const sim = core?.sim;
    const world = sim?.world;
    const no = (reason) => ({ available: false, reason, keeper: null, tier: null, price: null });
    const npc = this._keeper(sim);
    if (!sim || !npc) return no("no-keeper");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const owned = this.rodTier(player);
    const tier = owned === null ? ROD_TIERS[0] : ROD_TIERS[owned + 1];
    if (!tier) return no("top-of-ladder");
    const price = this.price(world, rodPriceKey(tier));
    if (price === null) return no("not-for-sale");
    const offer = { available: true, reason: null, keeper: npc, tier, price };
    const items = player.pouch?.items ?? [];
    const rows = owned === null ? (items.some((row) => row?.t === BAIT_TYPE) ? 1 : 2) : 1;
    if (items.length + rows > PF.player.CAPS.items) return { ...offer, available: false, reason: "pouch-full" };
    if ((player.pouch?.money ?? 0) < price) return { ...offer, available: false, reason: "cannot-afford" };
    return offer;
  },

  /** Bind the best tool of a type to a verb after an acquisition (plan §2.4).
   *  Best = the highest QUALITY index the pouch holds. Bait NEVER auto-equips —
   *  the mod slot is the fishing verb's own per-session act, not a standing
   *  preference — and a catch never equips at all.
   *
   *  THE SCOPING IS ENFORCED HERE AND NOT BY THE MUTATOR. equip() validates by
   *  item TYPE and not by slot: it refuses a graded row whose `k` is off the
   *  ladder and is otherwise perfectly willing to put bait in a `tool` slot. So
   *  the call site is what keeps tools in tool slots, and this one refuses
   *  outright any type QUALITY does not grade rather than trusting a check that
   *  is not being made. A pouch holding only an ungradable rod equips nothing and
   *  fishes at the floor, which is the same answer from either end. */
  _autoEquipTool(core, verb, type, gen) {
    if (!PF.player.TOOL_TYPES.has(type)) return false;
    const player = PF.player.get(core);
    let best = null;
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t !== type || !PF.player.QUALITY.includes(row.k)) continue;
      if (best === null || PF.player.resolvedToolTier(row.k) > PF.player.resolvedToolTier(best)) best = row.k;
    }
    if (best === null) return false;
    return PF.player.equip(core, verb, "tool", { t: type, k: best }, gen);
  },

  /** Buy the rod the button is offering. rentBerth's shape, for rentBerth's
   *  reason — every effect goes through a shipped mutator in an order that cannot
   *  half-charge anybody:
   *    1. re-read the offer (the HUD's copy is a frame old);
   *    2. `award({ money: -price })` — the purse pays, and it is the ONLY thing
   *       that can refuse after the pre-checks, with nothing after it having run;
   *    3. `grant` the rod, plus the starter bait stack on the FIRST purchase
   *       ("line and tackle included"), at the theme's own first bait slug so it
   *       merges with what the player then fishes up;
   *    4. auto-equip, scoped to tools;
   *    5. `log()` — the day-ledger line the wrap-up will tell;
   *    6. `bump()` — the keeper remembers, settlement-scoped like every other.
   *  Nothing is written to `bought`: that map is world-bound shop DEPLETION and
   *  0.12 ships no shop stock, exactly as rentBerth writes none.
   *
   *  NEVER FORCED. This is a proximity button and nothing else — no modal, no
   *  quest gate, and nothing in the package depends on rod ownership. Skipping
   *  the first settlement's offer costs nothing: the ladder is a stateless
   *  derived read, so any keeper anywhere sells the same next rung later.
   *
   *  Returns { ok, reason, price, tier, bait }. */
  buyRod(core, gen) {
    const offer = this.rodOffer(core);
    // ONE SHAPE ON EVERY RETURN, `bait` included: this branch and the refusal
    // after award() below are the same verb refusing the same purchase, and a
    // caller asking what came with the rod should not get `undefined` from one
    // of them and `null` from the other.
    if (!offer.available) return { ok: false, reason: offer.reason, price: offer.price, tier: offer.tier, bait: null };
    const sim = core.sim;
    const world = sim.world;
    const paid = PF.player.award(core, { money: -offer.price }, gen);
    if (!paid) return { ok: false, reason: "refused", price: offer.price, tier: offer.tier, bait: null };
    PF.player.grant(core, { t: "rod", k: offer.tier }, 1, gen);
    let bait = null;
    if (offer.tier === ROD_TIERS[0]) {
      bait = this.starterBait(world);
      if (bait) PF.player.grant(core, { t: BAIT_TYPE, k: bait }, STARTER_BAIT, gen);
    }
    this._autoEquipTool(core, "fishing", "rod", gen);
    const named = this.describe(world, { t: "rod", k: offer.tier });
    PF.player.log(
      core,
      `Bought a ${named} from ${offer.keeper.name} for ${this.money(world, offer.price)}.`,
      sim.day,
      gen,
    );
    PF.player.bump(core, world.startZone, offer.keeper.name, { t: 1, s: `Sold you a ${named}.` }, gen);
    return { ok: true, reason: null, price: offer.price, tier: offer.tier, bait };
  },

  // ── Fishing (plan §2.1) ────────────────────────────────────────────────────
  // WHY THE VERB LIVES IN THIS FILE. It is the same shape as rentBerth: content
  // (the tables, TUNING, the words) plus an OFFER that describes and a VERB that
  // mutates, holding no state of its own and putting everything durable through
  // a shipped mutator. 58-player is the state BLOCK and deliberately ships no
  // verbs; 30-sim loads before both and could not see either. So it goes beside
  // the other transaction, and the file header names it.
  //
  // A CAST IS ONE WINDOW. `castWindow = floor(clockMin / castMinutes)`, and the
  // window's identity — its day and its index — is read BEFORE the clock moves,
  // so the roll belongs to the slice of time it was spent in.
  //
  // SYNCHRONOUS AND ATOMIC. Advance, roll, grant, award, accumulate, in one pass:
  // no await, no cutscene, nothing that can be interleaved with a chat switch
  // half-way through a cast. The GM hears about none of it here — outcomes reach
  // the prompt only through the sleep-recap flush (Ruling 1, M10).
  //
  // REFUSAL VALUES, each distinct, all of them read before a single minute is
  // spent:
  //   gate-held      — a world nobody has entered has no water in it yet.
  //   wrong-mode     — walk only, like every other clock mover.
  //   not-near-water — no registry row under the player's hand, or one whose tag
  //                    is not a kind that holds water.
  //   no-rod         — REACHABLE and deliberately so (M8's amendment): the
  //                    button stays visible for a rodless player and answers with
  //                    a themed hint pointing at the keeper who sells one, which
  //                    is what makes the mechanic discoverable instead of
  //                    invisible.
  //   pouch-full     — at the row cap only MERGES can land, so a session would
  //                    spend real hours to be told nothing new. Refused up front
  //                    rather than half-working. (Conservative on purpose: a
  //                    merge would still succeed. The mid-loop refusal below is
  //                    the other end of the same cap and does not refuse the
  //                    session.)
  //   unknown-target — a CALLER error and not a player-facing one; the menu can
  //                    only produce the four daypart words or none at all.
  //   no-player      — the same class, and listed rather than folded into one of
  //                    the five above: there is no player block on this sim at
  //                    all, which Sim's constructor and every restore path make
  //                    unreachable in play. Like unknown-target it is answered by
  //                    the HUD's GENERIC line (70-hud fishRefusal) instead of
  //                    copy of its own, because a control that spoke its own
  //                    sentence here would be writing player-facing words about a
  //                    state no player can be in.

  /** The bait stack a session would slot: the first live bait row in the pouch.
   *  The mod slot is a per-session SELECTION and not a standing preference, so
   *  there is nothing stored to consult and this is the whole of the choice. */
  _baitRow(player) {
    for (const row of player?.pouch?.items ?? []) {
      if (row?.t === BAIT_TYPE && (row.q ?? 0) > 0) return row;
    }
    return null;
  },

  /** Anybody in this world who lets rooms, near or not. The no-rod hint points at
   *  the vendor, and the vendor is worth naming even when the player is standing
   *  at a pond three zones away from them. */
  _anyKeeper(sim) {
    const near = this._keeper(sim);
    if (near) return near;
    for (const zoneId of Object.keys(sim?.world?.zones ?? {})) {
      for (const npc of sim.world.zones[zoneId].npcs ?? []) {
        if (typeof npc?.lodging === "string" && npc.lodging) return npc;
      }
    }
    return null;
  },

  /** "You need a rod — the innkeeper sells one." THEMED, and interpolating the
   *  keeper's COMPILED role rather than a hardcoded word, because a sci-fi colony
   *  has no innkeeper and the brief is what decides what it does have (the Talk
   *  sender's `npc.role` idiom, 90-element). A world with nobody letting rooms
   *  drops the clause rather than inventing a vendor. */
  rodHint(core) {
    const sim = core?.sim;
    const template = this._skin(sim?.world).hints.noRod;
    const role = this._anyKeeper(sim)?.role;
    if (typeof role !== "string" || !role) return template.replace(/ — .*$/, ".");
    return template.replace("{role}", role);
  },

  /** Is there water to fish where the player is standing, what would a session
   *  spend, and what is stopping it? Describes only — no clock moves, nothing is
   *  taken — so the HUD can call it every frame.
   *
   *  Returns { available, reason, spot, tag, bait, hint }. `spot` is the render
   *  test the button gates on, exactly as `price !== null` is the berth's: a
   *  refusal that still names a spot is one the player should SEE, because it is
   *  a refusal about them rather than about the place. */
  fishOffer(core) {
    const sim = core?.sim;
    const no = (reason) => ({ available: false, reason, spot: null, tag: null, bait: null, hint: "" });
    if (PF.save?.gateHolds?.(core)) return no("gate-held");
    if (!sim || sim.mode !== "walk") return no("wrong-mode");
    const spot = sim.nearFeature;
    if (!spot || !SPOT_TAGS.includes(spot.tag)) return no("not-near-water");
    const player = PF.player.get(core);
    if (!player) return no("no-player");
    const at = { available: true, reason: null, spot, tag: spot.tag, bait: this._baitRow(player), hint: "" };
    if (this.rodTier(player) === null) return { ...at, available: false, reason: "no-rod", hint: this.rodHint(core) };
    if ((player.pouch?.items ?? []).length >= PF.player.CAPS.items)
      return { ...at, available: false, reason: "pouch-full" };
    return at;
  },

  /** Slot the session's bait, or clear the slot. The verb's own per-session act
   *  (plan §2.4): there is no standing preference and no extra UI, so this is
   *  where the slot and the pouch are reconciled — a slot pointing at a stack
   *  that is gone is cleared, and a live stack with no slot is taken up.
   *
   *  ONLY EVER BAIT INTO THE MOD SLOT. equip() validates by item type and not by
   *  slot, so the scoping is this call site's job exactly as it is the auto-equip
   *  helper's. */
  _slotBait(core, gen) {
    const player = PF.player.get(core);
    if (!player) return null;
    const slot = player.skills?.equipped?.fishing?.mod;
    if (Array.isArray(slot) && slot[0] === BAIT_TYPE) {
      const held = player.pouch.items.find((row) => row.t === BAIT_TYPE && row.k === slot[1]);
      if (held && (held.q ?? 0) > 0) return held;
    }
    const row = this._baitRow(player);
    if (!row) {
      if (slot) PF.player.equip(core, "fishing", "mod", null, gen);
      return null;
    }
    PF.player.equip(core, "fishing", "mod", { t: BAIT_TYPE, k: row.k }, gen);
    return row;
  },

  /** Draw one entry: weight × this daypart's multiplier, over the entries the
   *  player's level has opened up. Null when the level has opened nothing, which
   *  a shipped table never does (every one of them holds a level-1 entry) and a
   *  hostile one might. */
  _draw(rnd, table, level, part) {
    let total = 0;
    for (const entry of table) {
      if (level < entry.minLevel) continue;
      total += entry.weight * (entry.daypart?.[part] ?? 1);
    }
    if (!(total > 0)) return null;
    let roll = rnd() * total;
    for (const entry of table) {
      if (level < entry.minLevel) continue;
      roll -= entry.weight * (entry.daypart?.[part] ?? 1);
      if (roll < 0) return entry;
    }
    return null;
  },

  /** One batched ledger line for one DAY of a session (plan §2.1). Written for
   *  the day that just ended once the window that ended it has fully resolved,
   *  and again after the loop for the day the session's last cast began in — so a
   *  post-midnight fisher's pre-midnight catch is filed under the day it happened
   *  and the 00:30 sleep can flush it.
   *
   *  THE ACCUMULATOR CARRIES ITS OWN DAY and this reads it rather than taking one
   *  from the caller. A tally is a day's tally: filing it under a day somebody
   *  else worked out is how the crossing window's cast came to be recorded on one
   *  day and the fish it landed on the next.
   *
   *  GATE-SAFE by construction: `log()` refuses a day the flush already covers,
   *  and mid-session `flushedDay ≤ D−1` always — telling day D would need
   *  `ledgerOwed ≥ D`, which needs a completed sleep after D's midnight, which
   *  cannot have happened while the player is still standing at the water. */
  _logDay(core, world, spot, tally, gen) {
    if (!tally.windows) return false;
    const day = tally.day;
    const counts = new Map();
    for (const entry of tally.caught) {
      const key = `${this.entryType(entry)}:${entry.variant}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const casts = `${tally.windows} cast${tally.windows === 1 ? "" : "s"}`;
    if (!counts.size) return PF.player.log(core, `Fished ${spot.name} — ${casts}, nothing biting.`, day, gen);
    const named = [...counts].map(([key, n]) => {
      const [t, k] = key.split(":");
      const name = this.describe(world, { t, k });
      return n > 1 ? `${name} ×${n}` : name;
    });
    return PF.player.log(core, `Fished ${spot.name} — ${casts}: ${named.join(", ")}.`, day, gen);
  },

  /** Fish. `target` is null for one cast, or a daypart word for a session that
   *  loops windows until the clock reaches that daypart's start (overshooting by
   *  at most one window, because a cast is a whole window and not a fraction).
   *
   *  DETERMINISM. Each window seeds its own stream from
   *  `hash(seed, day, castWindow, spotId, level, toolTier, modTier)` — every one
   *  of them RESOLVED (58-player's resolvers), never a raw string off the save,
   *  so two clients that disagree about what "legendary" means still pull the
   *  same fish out of the same water on the same minute. A failed window is a
   *  fixed point escaped only by spending different time, which IS the
   *  anti-save-scum property and is stated rather than discovered.
   *
   *  BAIT PRESENCE IS READ BEFORE IT IS SPENT. The window a bait was consumed on
   *  rolls BAITED; the slot-clear that follows the last one affects the NEXT
   *  window, which then re-keys the hash at tier 0 and goes on fishing at the
   *  lower rate. Exhaustion is a continuation, never a stop.
   *
   *  MID-LOOP GRANT REFUSAL. grant() refuses only a NEW `(t,k)` row at the pouch
   *  cap — merges never refuse — so a session can meet the cap on a variant it
   *  has not caught before. That window's grant AND its award are skipped and it
   *  logs nothing; the loop continues, because the cap bounds species DIVERSITY
   *  and not the session.
   *
   *  Returns { ok, reason, hint, windows, caught, leveled, days }. */
  fish(core, target, gen) {
    const opening = this.fishOffer(core);
    if (!opening.available)
      return { ok: false, reason: opening.reason, hint: opening.hint, windows: 0, caught: [], leveled: 0, days: [] };
    const sim = core.sim;
    const world = sim.world;
    const spot = opening.spot;
    const table = this.catchTable(world, spot.tag) ?? [];
    const W = TUNING.castMinutes;
    const modMult = [1, TUNING.baitMult];

    let windows = 1;
    if (target != null) {
      const at = Object.prototype.hasOwnProperty.call(PF.DAYPART_STARTS, target)
        ? PF.DAYPART_STARTS[target]
        : undefined;
      if (at === undefined)
        return { ok: false, reason: "unknown-target", hint: "", windows: 0, caught: [], leveled: 0, days: [] };
      // The NEXT occurrence, exactly as waitUntil reads the same table: asking to
      // fish until dusk from inside dusk is asking for a day of it.
      const delta = at > sim.clockMin ? at - sim.clockMin : at + 24 * 60 - sim.clockMin;
      windows = Math.max(1, Math.ceil(delta / W));
    }

    this._slotBait(core, gen);
    const caught = [];
    const days = [];
    let leveled = 0;
    let spent = 0;
    // THE ACCUMULATOR KNOWS WHICH DAY IT IS, and that is the whole of the
    // ordering: it belongs to the day the casts in it BEGAN, which stops being
    // `sim.day` the moment one of them crosses midnight.
    let tally = { day: sim.day, windows: 0, caught: [] };

    for (let i = 0; i < windows; i++) {
      // THE WRAP, FILED AT THE TOP OF THE WINDOW AFTER IT. The previous window
      // crossed midnight, so its day is over and everything that window resolved
      // — its cast AND its fish — is already in the accumulator. Filed here and
      // not between an advance and the roll that follows it: a flush taken inside
      // a window files that window's cast under the day it began and its catch
      // under the day after, and a session of ONE such window loses the catch
      // line altogether.
      if (tally.windows && sim.day !== tally.day) {
        if (this._logDay(core, world, spot, tally, gen)) days.push(tally.day);
        tally = { day: sim.day, windows: 0, caught: [] };
      }
      const live = PF.player.get(core);
      if (!live) break; // a chat switch landed under us; the mutators would refuse anyway
      const slots = live.skills?.equipped?.fishing ?? null;
      const modSlot = Array.isArray(slots?.mod) ? slots.mod : null;
      const stack = modSlot ? live.pouch.items.find((row) => row.t === modSlot[0] && row.k === modSlot[1]) : null;
      // READ BEFORE TAKE. This is the window the bait is being spent on.
      const modTier = PF.player.resolvedModTier(modSlot, stack);
      const toolTier = PF.player.resolvedToolTier(Array.isArray(slots?.tool) ? slots.tool[1] : "");
      const level = PF.player.resolvedLevel(live.skills?.verbs?.fishing);
      const day = sim.day;
      const castWindow = Math.floor(sim.clockMin / W);
      const part = sim.daypart();

      sim.advanceMinutes(W);
      spent += W;
      tally.windows += 1;
      // THE BAIT IS SPENT for the window that was read as holding it, and the
      // slot follows the stack out rather than being left pointing at a row the
      // pouch no longer has.
      if (modTier === 1) {
        PF.player.take(core, { t: modSlot[0], k: modSlot[1] }, 1, gen);
        if (!live.pouch.items.some((row) => row.t === modSlot[0] && row.k === modSlot[1]))
          PF.player.equip(core, "fishing", "mod", null, gen);
      }

      const rnd = PF.rng(PF.hashStr(`${world.seed}:${day}:${castWindow}:${spot.id}:${level}:${toolTier}:${modTier}`));
      const base = Math.min(TUNING.baseCeil, TUNING.baseAt1 + TUNING.basePerLevel * (level - 1));
      // Unclamped on purpose: the roll is `rnd() < p` and rnd() never reaches 1,
      // so a p at or over 1 simply always lands — which is what the top of a
      // fully-equipped ladder is supposed to feel like, and is unreachable in
      // 0.12 anyway (fine and masterwork are not sold).
      const p = base * TUNING.toolMult[toolTier] * modMult[modTier];
      if (rnd() >= p) continue;
      const entry = this._draw(rnd, table, level, part);
      if (!entry) continue;
      const type = this.entryType(entry);
      // The PRIOR level, read before the award, because award() returns the new
      // one and carries no "leveled" flag of its own.
      const before = PF.player.resolvedLevel(live.skills?.verbs?.fishing);
      if (!PF.player.grant(core, { t: type, k: entry.variant }, 1, gen)) continue;
      const paid = PF.player.award(core, { xp: TUNING.catchXp[type] ?? 0, verb: "fishing" }, gen);
      if (paid?.level > before) leveled = paid.level;
      tally.caught.push(entry);
      caught.push({ t: type, k: entry.variant });
    }

    // THE LAST DAY THE SESSION TOUCHED, which is the day its last cast began in
    // and not necessarily the one the clock is showing: a session whose final
    // window crossed midnight files that window under the day before.
    if (tally.windows && this._logDay(core, world, spot, tally, gen)) days.push(tally.day);
    // EVERY PATH THAT MOVED THE CLOCK, refusals-after-advance included (the Wait
    // precedent, 70-hud): the mutators self-dirty, but a session of failed casts
    // runs no mutator at all and would otherwise lose its hours on reload.
    if (spent) core.markDirty?.();
    return { ok: true, reason: null, hint: "", windows: spent / W, caught, leveled, days };
  },

  /** The starting purse, paid when a SEALED world comes up on a block nothing has
   *  ever been written into. That is the condition, not a moment — and the
   *  difference is the whole slice-6 correction. It used to be one instant (the
   *  tail of the generation that sealed the brief), and every ordinary way of not
   *  being there for that instant cost the purse permanently: leaving the chat
   *  while generation ran, reloading between the seal and the lift, or a throw
   *  that turned the lift into a retry screen. The predicate below is idempotent,
   *  so the callers can simply ask on every path a sealed world arrives by
   *  (60-save `_installSealedWorld` and `armGate`) and let it answer.
   *
   *  NOT a default on the block, and the reason is the wire: PF.player.serialize
   *  emits every field unconditionally, so a non-zero default money would move
   *  the bytes of every save in the wild and re-write every open chat on first
   *  load. NOT a rehydration step either — restore's repairs are deliberately
   *  non-mutations.
   *
   *  UNTOUCHED MEANS THE WHOLE BLOCK, not the purse. Four tests would do while
   *  the grant was a one-shot instant; as a condition asked on every arrival it
   *  has to tell a new game apart from a VETERAN who happens to be broke, and a
   *  player who has spent down to nothing still carries their skills, the boards
   *  they finished, the people they met, the places they found and the day
   *  boundary they flushed. This is also what keeps the pre-gate interim shim from
   *  being paid, which is the case the original four were written for: a block
   *  with a real session in it crosses that seam holding exactly these fields. */
  grantStartingPurse(core) {
    const player = PF.player.get(core);
    if (!player) return false;
    const empty = (value) => !Object.keys(value ?? {}).length;
    const untouched =
      (player.pouch?.money ?? 0) === 0 &&
      !(player.pouch?.items ?? []).length &&
      !(player.ledger?.lines ?? []).length &&
      player.home === null &&
      empty(player.skills?.verbs) &&
      empty(player.skills?.equipped) &&
      empty(player.quests_done_board) &&
      empty(player.rel) &&
      empty(player.quests?.done_pack) &&
      !(player.quests?.active ?? []).length &&
      !(player.found?.zones ?? []).length &&
      empty(player.bought) &&
      (player.flushedDay ?? 0) === 0 &&
      (player.game ?? 1) === 1;
    if (!untouched) return false;
    if (!PF.player.award(core, { money: STARTING_PURSE })) return false;
    PF.player.log(core, `Arrived with ${this.money(core.sim?.world, STARTING_PURSE)} to your name.`, core.sim?.day);
    return true;
  },
};

// Registry completeness, in the placers' idiom (20-world PLACERS): every theme
// this build ships must skin every item type this build can produce, and must
// name its own money. A theme added without a skin table would otherwise ship
// silently — the fallbacks in describe()/money() are there for a SAVE naming a
// theme this build dropped, not as a licence to leave a live theme unnamed, and
// a sci-fi colony charging "coins" is exactly the out-of-place-"Maud Thatch"
// failure the maintainer called out for name books.
{
  // EVERY VARIANT ANY SHIPPED TABLE NAMES, gathered across ALL themes before any
  // one theme is checked. The pouch is world-free: a carp caught in a valley is
  // still in the bag when the same chat's next world is a colony, and a row with
  // no word there would fall to the slug fallback that exists for a HOSTILE save,
  // not for content this build ships. So the demand is on the union, not on each
  // theme's own list.
  const shippedVariants = new Set();
  for (const byTag of Object.values(CATCH_TABLES))
    for (const table of Object.values(byTag)) for (const entry of table) shippedVariants.add(entry.variant);

  for (const theme of PF.art?.themeIds?.() ?? []) {
    const skin = ITEM_SKINS[theme];
    if (!skin) throw new Error(`pixelforge: theme "${theme}" ships no item vocabulary`);
    const currency = skin.currency;
    if (!currency?.one || !currency?.many) throw new Error(`pixelforge: theme "${theme}" does not name its money`);
    for (const type of ITEM_TYPES) {
      if (!skin.items?.[type]?.name) throw new Error(`pixelforge: theme "${theme}" has no name for item "${type}"`);
    }
    for (const variant of shippedVariants) {
      if (!skin.variants?.[variant]) throw new Error(`pixelforge: theme "${theme}" has no name for "${variant}"`);
    }
    // THE REFUSAL A PLAYER IS MEANT TO ACT ON. A theme without it answers a
    // pressed button with an empty toast, which reads as a broken control rather
    // than as a mechanic with a vendor behind it — and the `{role}` slot is what
    // keeps it out of hardcoding an innkeeper into a colony.
    if (!skin.hints?.noRod?.includes("{role}"))
      throw new Error(`pixelforge: theme "${theme}" has no no-rod hint naming a vendor`);
    // THE PERSON AND THEIR VERBS, which the character sheet renders and nothing
    // else does. A theme missing either would show an empty label under the
    // portrait, or the raw block key ("fishing") where the skill's name goes —
    // the same silently-unnamed failure the item vocabulary is asserted against.
    if (!skin.player) throw new Error(`pixelforge: theme "${theme}" has no word for the person playing it`);
    for (const verb of SKILL_VERBS) {
      const book = skin.verbs?.[verb];
      if (!book?.name || !book.tool || !book.mod)
        throw new Error(`pixelforge: theme "${theme}" does not name the "${verb}" skill and both of its slots`);
    }
    // THE 2×2, both halves. A theme with no table for a spot kind is water the
    // player can stand at and the verb cannot answer for; an EMPTY table is the
    // same hole with a shape, and it would divide by a zero weight rather than
    // refuse. The wilds `water-feature` never places today (slice-1 verify F1)
    // and its tables are still required — settlements and the legacy world reach
    // that kind, and the drop is a placement fact, not a vocabulary one.
    const byTag = CATCH_TABLES[theme];
    if (!byTag) throw new Error(`pixelforge: theme "${theme}" ships no catch tables`);
    for (const tag of SPOT_TAGS) {
      const table = byTag[tag];
      if (!Array.isArray(table) || !table.length)
        throw new Error(`pixelforge: theme "${theme}" has no catch table for "${tag}"`);
      for (const entry of table) {
        // A role has to be a ROLE. A typo mints a pouch row of a type nothing
        // skins, nothing prices and the xp table cannot pay for — and it would
        // look exactly like the deliberate roleless entry that means bait.
        if (entry.role !== undefined && !CATCH_ROLES.includes(entry.role))
          throw new Error(`pixelforge: ${theme}/${tag} has an entry with the role "${entry.role}"`);
        if (!entry.variant || typeof entry.variant !== "string")
          throw new Error(`pixelforge: ${theme}/${tag} has an entry with no variant slug`);
        // …AND NOT THE LEDGER'S OWN SEPARATOR IN IT. _logDay counts a session's
        // yields in a Map keyed `${type}:${variant}` and splits that key apart
        // again to name them, so a slug carrying a colon is truncated at it: a
        // "sea:bass" is rendered as "sea" and the wrap-up tells the player about
        // a thing that does not exist. Closed here rather than by escaping the
        // key, because a slug with punctuation in it is content nobody needs and
        // an encoding that never has to survive one is a line shorter.
        if (entry.variant.includes(":"))
          throw new Error(
            `pixelforge: ${theme}/${tag}'s "${entry.variant}" has a ":" in its slug, which is the ledger's own separator`,
          );
        if (!(typeof entry.weight === "number" && entry.weight > 0))
          throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" has no positive weight`);
        // A minLevel above the ceiling is an entry NOBODY can ever draw: the draw
        // is a level test and the level stops climbing at the cap, so the row is
        // written content that no save can reach.
        if (!Number.isInteger(entry.minLevel) || entry.minLevel < 1 || entry.minLevel > PF.player.CAPS.skillLevel)
          throw new Error(
            `pixelforge: ${theme}/${tag}'s "${entry.variant}" needs level ${entry.minLevel}, outside 1..${PF.player.CAPS.skillLevel}`,
          );
        for (const [part, mult] of Object.entries(entry.daypart ?? {})) {
          // A plausible word that is not one of the four is a column that never
          // applies — silently, forever, and looking exactly like a tuned one.
          if (!DAYPARTS.includes(part))
            throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" is tuned for a daypart "${part}"`);
          if (!(typeof mult === "number" && Number.isFinite(mult) && mult >= 0))
            throw new Error(`pixelforge: ${theme}/${tag}'s "${entry.variant}" has a ${part} multiplier of ${mult}`);
        }
      }
    }
    // …AND A BAIT ENTRY SOMEWHERE IN THE THEME, because the crude rod's purchase
    // throws in a starter stack whose slug is exactly this (see starterBait). A
    // theme with none would sell a rod and hand over an empty tin.
    if (!PF.economy.starterBait({ theme }))
      throw new Error(`pixelforge: theme "${theme}" ships no bait entry for a first rod to come with`);
    if (typeof PRICES[theme]?.berth !== "number")
      throw new Error(`pixelforge: theme "${theme}" has no price for a berth`);
    // EVERY RUNG THE LADDER CAN QUOTE, in every theme. A missing rod price would
    // otherwise reach the player as the keeper refusing the sale — price()
    // answers null for "not for sale here", and a rod the build means to sell
    // and forgot to price is indistinguishable from one it deliberately does
    // not stock. KEY EXISTENCE ONLY: no assertion couples these numbers to the
    // purse or to the berth (maintainer override, 2026-08-24 — income arrives
    // in later releases and berth-sleeping is optional), so what the build
    // insists on is that a quotable rung is quotable, never that it is cheap.
    for (const tier of ROD_TIERS) {
      // …and a rung has to be a rung. A tier that is not on the QUALITY ladder
      // resolves to crude at every read, so the ladder would quote a rod nobody
      // can be recorded as owning and would keep quoting it forever.
      if (!PF.player.QUALITY.includes(tier))
        throw new Error(`pixelforge: the rod ladder quotes "${tier}", which is not a quality tier`);
      if (typeof PRICES[theme]?.[rodPriceKey(tier)] !== "number")
        throw new Error(`pixelforge: theme "${theme}" has no price for a ${tier} rod`);
    }
  }
  // THE TELL'S FLOOR. The wrap-up tell renders whole days or none, so a budget
  // under one maximum-shape day renders zero days — the burn then advances
  // through nothing, `ledgerOwed` never falls, and every sleep for the rest of
  // the save tells the player the same nothing. Asserted here rather than
  // discovered there.
  const maxShapeDay = PF.player.CAPS.ledgerPerDay * PF.player.CAPS.ledgerChars;
  if (!(TUNING.ledgerTellChars >= maxShapeDay))
    throw new Error(
      `pixelforge: TUNING.ledgerTellChars (${TUNING.ledgerTellChars}) is under one max-shape ledger day (${maxShapeDay})`,
    );
  // The xp table is the single authority, so a type missing from it is a yield
  // that awards nothing — a silent hole rather than a loud one, and the one it
  // would most likely be is `bait`, which is the yield a fresh player meets
  // first.
  for (const type of [...CATCH_ROLES, BAIT_TYPE]) {
    if (typeof TUNING.catchXp[type] !== "number") throw new Error(`pixelforge: TUNING.catchXp has no xp for "${type}"`);
  }
  // The ladder and its multipliers, pinned to the same length. They are two
  // lists in two files indexed by the same resolved number, and a short one
  // hands `undefined` to the curve — NaN chance, on the best rod in the game.
  if (TUNING.toolMult.length !== PF.player.QUALITY.length)
    throw new Error(
      `pixelforge: TUNING.toolMult has ${TUNING.toolMult.length} multipliers for ${PF.player.QUALITY.length} quality tiers`,
    );
}
