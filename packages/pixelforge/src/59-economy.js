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
// Everything below is CONTENT plus three verbs. It holds no state of its own:
// what persists goes through the shipped mutators (award/grant/setHome/log/bump)
// and lives in the player block, which is what makes it rewind-safe.

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

// Fixed price lists, per theme (plan §2: "0.11 can ship fixed price lists first").
// The weekly deterministic stock tables the plan describes need L2's calendar and
// arrive with it; nothing here blocks that and nothing here has to be unpicked for
// it — a table lookup replaces the constant and the verbs do not move.
const PRICES = {
  "cozy-village": { berth: 12 },
  "sci-fi-colony": { berth: 12 },
};

// What a new game starts with. It exists because a sink with no source is not a
// feature: quest rewards (P4) are the real income and they are 0.12, so without
// this the one transaction 0.11 ships would be unreachable in a shipped game and
// only ever exercised by a test that minted its own money. Granted ONCE, at the
// moment a world seals onto a block nothing has touched — see grantStartingPurse
// for why that moment and not a default value.
const STARTING_PURSE = 40;

PF.economy = {
  ITEM_TYPES,
  PRICES,
  STARTING_PURSE,

  /** The theme's skin table, falling back to the default theme rather than
   *  throwing: a save can name a theme this build no longer ships. */
  _skin(world) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    return ITEM_SKINS[theme] ?? ITEM_SKINS["cozy-village"];
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
    const skin = this._skin(world).items[t];
    const name = skin ? skin.name : t.replace(/[-_]/g, " ");
    const quality = typeof item === "object" && typeof item?.k === "string" ? item.k : "";
    return quality ? `${quality} ${name}` : name;
  },

  /** The price of a named thing in this world, or null when it is not for sale
   *  here. Null rather than a default number: a caller that cannot find a price
   *  must refuse the sale, not invent one. */
  price(world, what) {
    const theme = typeof world?.theme === "string" ? world.theme : "cozy-village";
    const table = PRICES[theme] ?? PRICES["cozy-village"];
    const value = Object.prototype.hasOwnProperty.call(table, what) ? table[what] : null;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  },

  // ── The berth (S3's money sink, P1's bed) ──────────────────────────────────

  /** Is there a berth on offer where the player is standing, and what would it
   *  cost? Describes only — it never charges anything, so the HUD can call it
   *  every frame and a caller can render the refusal instead of hiding the
   *  button. Returns { available, reason, keeper, zoneId, price, home }.
   *
   *  The offer follows the PERSON, not the room: `npc.lodging` is stamped on the
   *  keeper of the settlement's gathering (20-world), so an innkeeper standing in
   *  the square at noon can still let you a room, which is what a keeper is. */
  berthOffer(core) {
    const sim = core?.sim;
    const npc = sim?.nearNpc;
    const world = sim?.world;
    const no = (reason) => ({ available: false, reason, keeper: null, zoneId: null, price: null, home: null });
    if (!sim || !npc || typeof npc.lodging !== "string" || !npc.lodging) return no("no-keeper");
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

  /** The starting purse, granted at the one moment that is unambiguously "this
   *  world begins now": the brief has sealed and the block it seals onto has
   *  nothing in it.
   *
   *  NOT a default on the block, and the reason is the wire: PF.player.serialize
   *  emits every field unconditionally, so a non-zero default money would move
   *  the bytes of every save in the wild and re-write every open chat on first
   *  load. NOT a rehydration step either — restore's repairs are deliberately
   *  non-mutations. The seal is a one-shot by construction (the brief key is
   *  written once and maybeGenerateBrief is guarded by it), and the emptiness
   *  test is what keeps it from paying a player twice across the pre-gate interim
   *  shim, where a block with real play in it crosses the same seam. */
  grantStartingPurse(core) {
    const player = PF.player.get(core);
    if (!player) return false;
    const untouched =
      (player.pouch?.money ?? 0) === 0 &&
      !(player.pouch?.items ?? []).length &&
      !(player.ledger?.lines ?? []).length &&
      player.home === null;
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
  }
}
