// ── The first time you open it ──────────────────────────────────────────────
//
// A silhouette with coloured marks on it, a row of small buttons, and no explanation.
// Someone opening Beholder for the first time has no reason to know that the ring
// around an arm means the sleeve is torn rather than the arm, or that a slot can be
// clicked at all. The reference extension shows a short note beside the panel once, and
// this is the same note with this package's controls in it.
//
// Shown once per browser, then never again. It is the least intrusive thing that still
// answers "what is this?", and someone who dismissed it and wants it back has the Help
// view, which says all of this at length.
//
// The wording is deliberately plain: short sentences, common words, no idiom. A good
// share of the people reading it are not reading in their first language, and "the doll
// flips front-to-back" is a sentence you can only parse if you already know what it
// means.

BH.onboard = {
  KEY: "marinara.beholder.onboarded",

  seen() {
    try {
      return window.localStorage.getItem(this.KEY) === "true";
    } catch {
      // Storage blocked: better to skip it than to show it on every single open.
      return true;
    }
  },

  remember() {
    try {
      window.localStorage.setItem(this.KEY, "true");
    } catch {
      // Nothing to do; at worst it appears again next time.
    }
  },

  /** Show it beside the panel, once. */
  maybeShow() {
    if (this.seen()) return false;
    const panel = BH.dock.panel;
    if (!panel || panel.classList.contains("bh-collapsed")) return false;
    if (document.querySelector(".beholder-onboard")) return false;

    const tip = document.createElement("div");
    tip.className = "beholder-onboard";
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-label", "About Beholder");
    tip.innerHTML = `
      <div class="bh-onboard-arrow"></div>
      <div class="bh-onboard-head">
        <span class="bh-onboard-title">◉ Beholder</span>
        <button type="button" class="bh-onboard-close fa-solid fa-xmark" title="Close"
          aria-label="Close"></button>
      </div>
      <div class="bh-onboard-body">
        Beholder reads each turn of your story. It keeps track of what every character is
        <b>wearing</b>, what they are <b>holding</b>, and any <b>injuries</b>. It updates itself after each
        reply.
        <ul class="bh-onboard-tips">
          <li>Colour <b>around</b> a body part is the state of the clothing there. Colour <b>inside</b> it is
            the body itself.</li>
          <li><b>Click a body part</b> to change what it says, or to lock it so the story cannot change it.</li>
          <li>The box at the bottom sends Beholder a fact directly, such as
            <i>"Maggie takes off her boots"</i>.</li>
          <li>More than one character gets a row of names at the top.</li>
        </ul>
      </div>
      <div class="bh-onboard-foot">
        <button type="button" class="bh-btn bh-btn-primary bh-onboard-dismiss">Got it</button>
      </div>`;
    document.body.appendChild(tip);
    this.place(tip, panel);

    const dismiss = () => {
      tip.remove();
      this.remember();
      window.removeEventListener("resize", reposition);
    };
    // Follows the panel: it is a draggable, resizable window, and a note pinned to where
    // the panel used to be is worse than no note.
    const reposition = () => this.place(tip, panel);
    window.addEventListener("resize", reposition);
    for (const control of tip.querySelectorAll(".bh-onboard-close, .bh-onboard-dismiss")) {
      control.addEventListener("click", dismiss);
    }
    tip.querySelector(".bh-onboard-dismiss")?.focus?.();
    return true;
  },

  /**
   * Beside the panel when there is room, over it when there is not.
   *
   * The reference always places it outside the panel, which is safe on a desktop where
   * the panel is a small window in a corner. Here the panel can fill a phone screen,
   * and "beside" would be off the edge — so below a certain width it sits on top,
   * centred, and the arrow is hidden because it would be pointing at nothing.
   */
  place(tip, panel) {
    const box = panel.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    tip.style.width = `${width}px`;
    const roomLeft = box.left >= width + 20;
    const roomRight = window.innerWidth - box.right >= width + 20;

    if (!roomLeft && !roomRight) {
      tip.dataset.side = "over";
      tip.style.left = `${Math.max(12, box.left + (box.width - width) / 2)}px`;
      tip.style.right = "auto";
      tip.style.top = `${Math.max(12, box.top + 12)}px`;
      return;
    }
    tip.dataset.side = roomLeft ? "right" : "left";
    tip.style.top = `${Math.max(12, box.top)}px`;
    if (roomLeft) {
      tip.style.right = `${window.innerWidth - box.left + 12}px`;
      tip.style.left = "auto";
    } else {
      tip.style.left = `${box.right + 12}px`;
      tip.style.right = "auto";
    }
  },
};
