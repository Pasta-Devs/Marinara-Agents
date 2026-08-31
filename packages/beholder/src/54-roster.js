// ── The roster: who the panel shows, and in what order ──────────────────────
//
// A long scene accumulates people — a barman named once, a guard, someone's horse —
// and the panel gives each of them a tab whether or not anyone cares. The reference
// extension answers that with a characters view: hide the ones you are not tracking,
// drag the ones you are into the order you think in, and merge the duplicates the
// extractor spelled two ways.
//
// Scope worth being explicit about: this is presentation. Hiding someone does not stop
// the extractor tracking them, and merging two names here does not teach it they are
// the same person — it just stops the panel showing them twice. The view says so,
// because a control that looks like it changes extraction and does not is worse than
// no control.
//
// Stored per chat in localStorage, next to the locks, for the same reason: it is a
// per-operator display choice, not part of the state the next prompt is built from.

BH.roster = {
  key(chatId) {
    return `marinara.beholder.roster.${chatId}`;
  },

  all(chatId = BH.dock.chatId) {
    if (!chatId) return { hidden: [], order: [], aliases: {} };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.key(chatId)) || "{}") || {};
      return {
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        order: Array.isArray(parsed.order) ? parsed.order : [],
        aliases: parsed.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {},
      };
    } catch {
      return { hidden: [], order: [], aliases: {} };
    }
  },

  save(next, chatId = BH.dock.chatId) {
    if (!chatId) return;
    try {
      window.localStorage.setItem(this.key(chatId), JSON.stringify(next));
    } catch {
      // A full or blocked store costs the preference, not the panel.
    }
  },

  setHidden(name, hidden) {
    const data = this.all();
    const set = new Set(data.hidden);
    if (hidden) set.add(name);
    else set.delete(name);
    data.hidden = [...set];
    this.save(data);
  },

  setOrder(order) {
    const data = this.all();
    data.order = order;
    this.save(data);
  },

  /** Merge `variant` into `canonical` for display. */
  addAlias(variant, canonical) {
    if (!variant || !canonical || variant.toLowerCase() === canonical.toLowerCase()) return;
    const data = this.all();
    data.aliases[variant] = canonical;
    this.save(data);
  },

  removeAlias(variant) {
    const data = this.all();
    delete data.aliases[variant];
    this.save(data);
  },

  /**
   * Names merged into this one.
   *
   * Compared without case, because the target can be typed by hand: someone merging a
   * stray "the guard" into "Rhys" may well type "rhys", and a case-sensitive match left
   * the alias recorded but invisible — the row stayed on screen and the merge looked
   * like it had failed.
   */
  variantsOf(name, data = this.all()) {
    const wanted = String(name).toLowerCase();
    return Object.entries(data.aliases)
      .filter(([, canonical]) => String(canonical).toLowerCase() === wanted)
      .map(([variant]) => variant);
  },

  /**
   * The names to show, in the operator's order, with hidden ones separated.
   *
   * Applied by the dock when it builds its character tabs, so every surface agrees on
   * who is on screen.
   */
  arrange(names) {
    const data = this.all();
    const hidden = new Set(data.hidden);
    // A merged variant is not its own row; it belongs to the name it was merged into.
    // Matched without case for the same reason variantsOf is: the canonical name may
    // have been typed rather than picked from the list.
    const tracked = new Map(names.map((name) => [name.toLowerCase(), name]));
    // Both ends folded. The canonical name was compared without case but the variant key
    // was not, so an alias recorded as "The Guard" never matched a tracked "the guard"
    // and the row it should have removed stayed on screen.
    const merged = new Set(
      Object.keys(data.aliases)
        .filter((variant) => tracked.has(String(data.aliases[variant]).toLowerCase()))
        .map((variant) => variant.toLowerCase()),
    );
    const remaining = names.filter((name) => !merged.has(name.toLowerCase()));
    const ordered = [
      ...data.order.filter((name) => remaining.includes(name)),
      ...remaining.filter((name) => !data.order.includes(name)),
    ];
    return {
      visible: ordered.filter((name) => !hidden.has(name)),
      hidden: ordered.filter((name) => hidden.has(name)),
    };
  },
};
