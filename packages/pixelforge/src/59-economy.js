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
// Everything below is CONTENT plus three game-facing entry points: berthOffer
// describes and never charges, rentBerth and grantStartingPurse mutate. (The
// rest — _skin, currency, money, describe, price — are the vocabulary those
// three and the HUD read through.) It holds no state of its own: what persists
// goes through the shipped mutators (award/grant/setHome/log/bump) and lives in
// the player block, which is what makes it rewind-safe.

// The closed item vocabulary. A pouch row is keyed `(t, k)` — type and quality —
// and `t` has to mean the same thing in every theme or a save crossing a theme
// change would be renaming the player's belongings. So the TYPES are shared and
// only the SKIN (what it is called, and the glyph the purse shows) is per theme.
const ITEM_TYPES = ["lodging-key"];
const ITEM_SKINS = {
  "cozy-village": {
    currency: { one: "coin", many: "coins", glyph: "◍" },
    items: { "lodging-key": { name: "room key", glyph: "🔑" } },
  },
  "sci-fi-colony": {
    currency: { one: "credit", many: "credits", glyph: "◈" },
    items: { "lodging-key": { name: "berth chit", glyph: "🔑" } },
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

// The catch table's TYPE vocabulary — the fixed shared roles a table entry can
// be, and the one non-catch yield water gives up. A table row carries a role and
// a VARIANT slug ("carp", "kelp", "vat-strain"), and the role is the half that
// means the same thing in every theme, which is why the xp table below is keyed
// by it. The item types and their skins arrive with the tables themselves; what
// is needed here is the key set, so the xp table can be asserted complete
// against something rather than against a comment.
const CATCH_ROLES = ["catch-common", "catch-uncommon", "catch-rare", "catch-prize"];
// Bait is a real water yield and not a catch (fishing is bait's own finder), so
// it sits outside the roles and still earns through the same table: the award
// keys on `role ?? BAIT_TYPE`, which is what stops a bait-first session from
// minting no skill row at all on a player who has plainly been fishing.
const BAIT_TYPE = "bait";

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
// (decent rod, baited, halfway up the ladder) lands p ≈ 0.55, so ≈ 22 of them
// yield; a common-heavy table pays ≈ 1.8 xp a yield. Call it 40 xp a day, and
// the cap is ≈ 48 days of nothing but fishing.
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
  ROD_TIERS,
  CATCH_ROLES,
  BAIT_TYPE,
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
   *  every type this build can actually produce out of that fallback. */
  describe(world, item) {
    const t = typeof item === "string" ? item : typeof item?.t === "string" ? item.t : "";
    if (!t) return "";
    // The items map takes an own-property read for the same reason the skin table
    // does one line up: `t` is a pouch row's type off untrusted save JSON, and
    // `items["constructor"]` resolves to a function whose `.name` is "Object".
    const items = this._skin(world).items;
    const skin = Object.prototype.hasOwnProperty.call(items, t) ? items[t] : null;
    const name = skin ? skin.name : t.replace(/[-_]/g, " ");
    const quality = typeof item === "object" && typeof item?.k === "string" ? item.k : "";
    return quality ? `${quality} ${name}` : name;
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
    const inReach = sim?.nearNpc;
    const npc = typeof inReach?.lodging === "string" && inReach.lodging ? inReach : this._keeperInRoom(sim);
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
  for (const theme of PF.art?.themeIds?.() ?? []) {
    const skin = ITEM_SKINS[theme];
    if (!skin) throw new Error(`pixelforge: theme "${theme}" ships no item vocabulary`);
    const currency = skin.currency;
    if (!currency?.one || !currency?.many) throw new Error(`pixelforge: theme "${theme}" does not name its money`);
    for (const type of ITEM_TYPES) {
      if (!skin.items?.[type]?.name) throw new Error(`pixelforge: theme "${theme}" has no name for item "${type}"`);
    }
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
