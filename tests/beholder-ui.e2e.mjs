// Beholder UI: exercise every control the panel offers, against a real Engine.
//
// Reusable on purpose — it takes the Engine URL and the chat to open from the
// environment and asserts behaviour rather than pixels, so it survives restyling and
// can be pointed at any instance with the package installed.
//
//   BEHOLDER_UI_BASE=http://127.0.0.1:7861 \
//   BEHOLDER_UI_CHAT="Beholder rig" \
//   node tests/beholder-ui.e2e.mjs
//
// Plain JavaScript, so no type-stripping flag is needed, and @playwright/test resolves
// from this repository's own devDependencies.
import { chromium } from "@playwright/test";

const BASE = process.env.BEHOLDER_UI_BASE ?? "http://127.0.0.1:7861";
const CHAT_NAME = process.env.BEHOLDER_UI_CHAT ?? "Beholder rig";
const HEADLESS = process.env.BEHOLDER_UI_HEADED !== "1";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: HEADLESS });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 160)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(message.text().slice(0, 160));
});

async function openChat() {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const rp = page.locator('button:has-text("RP")').first();
  if (await rp.count()) {
    await rp.click();
    await page.waitForTimeout(1200);
  }
  await page.locator(`text=${CHAT_NAME}`).first().click();
  await page.waitForTimeout(7000);
}

/** Click the visible toolbar toggle; the compact duplicate is hidden. */
async function openPanel() {
  const opened = await page.evaluate(() => {
    const button = [...document.querySelectorAll(".bh-hud-toggle, marinara-capability-beholder button")].find(
      (candidate) => candidate.getBoundingClientRect().width > 0,
    );
    if (!button) return false;
    button.click();
    return true;
  });
  await page.waitForTimeout(2500);
  return opened;
}

await openChat();

// ── the toggle and the panel ────────────────────────────────────────────────
check("toolbar toggle is mounted and visible", await openPanel());
check(
  "panel opens with the doll rendered",
  await page.evaluate(() => {
    const panel = document.querySelector("#beholder_panel, .beholder-panel");
    return !!panel && panel.querySelectorAll("svg").length > 0;
  }),
);

// ── header buttons ──────────────────────────────────────────────────────────
for (const [view, title] of [
  ["help", "Help"],
  ["doctor", "Doctor"],
  ["prompt", "Prompt"],
]) {
  await page.evaluate((v) => document.querySelector(`.beholder-tool-btn[data-view="${v}"]`)?.click(), view);
  await page.waitForTimeout(1200);
  const shown = await page.evaluate((t) => document.querySelector(".bh-view-title")?.textContent?.trim() === t, title);
  check(`${view} button opens the ${title} view`, shown);
  // Doctor must report the state it read, not just a shell.
  if (view === "doctor") {
    check(
      "doctor reports the stored state",
      await page.evaluate(
        () => !!document.querySelector(".bh-doctor-facts") && !!document.querySelector(".bh-doctor-json"),
      ),
    );
  }
  if (view === "prompt") {
    check(
      "prompt view offers both prompt sets and marks one active",
      await page.evaluate(
        () =>
          document.querySelectorAll('input[name="bh-prompt"]').length === 2 &&
          !!document.querySelector(".bh-prompt-option.bh-prompt-active"),
      ),
    );
  }
  await page.evaluate(() => document.querySelector(".bh-view-close")?.click());
  await page.waitForTimeout(500);
  check(`${title} view closes`, await page.evaluate(() => !document.querySelector(".bh-view")));
}

// ── prompt selection persists ───────────────────────────────────────────────
await page.evaluate(() => document.querySelector('.beholder-tool-btn[data-view="prompt"]')?.click());
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const fivePass = [...document.querySelectorAll('input[name="bh-prompt"]')].find((i) => i.value);
  fivePass.checked = true;
  fivePass.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(2000);
const savedTemplate = await page.evaluate(async () => {
  const chatId = document.querySelector("marinara-capability-beholder")?.capabilityProps?.chatId;
  const res = await fetch(`/api/chats/${chatId}`, { credentials: "same-origin" });
  const chat = await res.json();
  return chat?.metadata?.agentPromptTemplateIds?.beholder ?? null;
});
check(
  "choosing the five-pass prompt persists to the chat",
  savedTemplate === "beholder-local-five-pass",
  String(savedTemplate),
);

// ── slot editor ─────────────────────────────────────────────────────────────
const slotOpened = await page.evaluate(() => {
  const card = document.querySelector(
    "#beholder_panel .bh-slot-card[data-slot], .beholder-panel .bh-slot-card[data-slot]",
  );
  if (!card) return null;
  card.click();
  return card.dataset.slot;
});
await page.waitForTimeout(900);
check(
  "clicking a slot opens the editor",
  !!slotOpened && (await page.evaluate(() => !!document.querySelector(".bh-editor"))),
  String(slotOpened),
);
check(
  "editor shows the worn / wounds / flags form",
  await page.evaluate(
    () =>
      !!document.querySelector(".bhe-worn-list") &&
      !!document.querySelector(".bhe-wound-list") &&
      !!document.querySelector(".bhe-bare") &&
      !!document.querySelector(".bhe-missing"),
  ),
);
check(
  "add worn item appends a row",
  await page.evaluate(() => {
    const before = document.querySelectorAll(".bhe-worn-list .bh-editor-row").length;
    document.querySelector(".bhe-add-worn")?.click();
    return document.querySelectorAll(".bhe-worn-list .bh-editor-row").length === before + 1;
  }),
);
check(
  "add wound appends a row",
  await page.evaluate(() => {
    const before = document.querySelectorAll(".bhe-wound-list .bh-editor-row").length;
    document.querySelector(".bhe-add-wound")?.click();
    return document.querySelectorAll(".bhe-wound-list .bh-editor-row").length === before + 1;
  }),
);
check(
  "removing a row does not close the editor",
  await page.evaluate(() => {
    document.querySelector(".bhe-worn-list .bh-editor-remove")?.click();
    return !!document.querySelector(".bh-editor");
  }),
);
check(
  "ticking missing greys the rest of the form",
  await page.evaluate(() => {
    const missing = document.querySelector(".bhe-missing");
    missing.checked = true;
    missing.dispatchEvent(new Event("change", { bubbles: true }));
    const greyed = !!document.querySelector(".bhe-missing-mode");
    missing.checked = false;
    missing.dispatchEvent(new Event("change", { bubbles: true }));
    return greyed;
  }),
);

// ── the edit actually persists ──────────────────────────────────────────────
const MARKER = `probe-garment-${Date.now()}`;
await page.evaluate((item) => {
  document.querySelector(".bhe-add-worn")?.click();
  const rows = [...document.querySelectorAll(".bhe-worn-list .bh-editor-row")];
  const input = rows[rows.length - 1].querySelector(".bhe-item");
  input.value = item;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector(".bh-editor-apply").click();
}, MARKER);
await page.waitForTimeout(3500);
check("apply closes the editor", await page.evaluate(() => !document.querySelector(".bh-editor")));
const persisted = await page.evaluate(async (item) => {
  const chatId = document.querySelector("marinara-capability-beholder")?.capabilityProps?.chatId;
  const res = await fetch(`/api/agents/beholder-state/${chatId}`, { credentials: "same-origin" });
  return JSON.stringify(await res.json()).includes(item);
}, MARKER);
check("the edit is written to the stored state (survives into the next turn)", persisted);
check(
  "the edited garment shows in the panel",
  // Case-insensitive: chips render the item capitalised.
  await page.evaluate(
    (item) =>
      (document.querySelector("#beholder_panel, .beholder-panel")?.innerText ?? "")
        .toLowerCase()
        .includes(item.toLowerCase()),
    MARKER,
  ),
);

// ── locks ───────────────────────────────────────────────────────────────────
await page.evaluate(() => document.querySelector(".bh-slot-card[data-slot]")?.click());
await page.waitForTimeout(800);
check(
  "lock toggle marks the slot",
  await page.evaluate(async () => {
    const lock = document.querySelector(".bhe-lock");
    lock.checked = true;
    lock.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    return !!document.querySelector(".bh-slot-card.bh-slot-locked");
  }),
);
check(
  "a lock survives a re-render",
  await page.evaluate(async () => {
    document.querySelector(".bh-editor-close")?.click();
    // Toggling a layer rebuilds the panel body, which is what would drop a lock
    // mark if it were not re-applied after every render.
    const box = document.querySelector('input[name="bh-view-layer"][value="color"]');
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    return !!document.querySelector(".bh-slot-card.bh-slot-locked");
  }),
);

// ── a hand slot offers the held item, and Drop clears it ────────────────────
{
  const opened = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".bh-slot-card[data-slot]")].find((c) =>
      ["left_hand", "right_hand"].includes(c.dataset.slot),
    );
    if (!card) return false;
    card.click();
    return true;
  });
  await page.waitForTimeout(900);
  check(
    "a hand slot offers the holding row",
    opened && (await page.evaluate(() => !!document.querySelector(".bhe-hitem"))),
  );
  check(
    "drop clears the held item",
    // Guarded: an absent element must fail this one check, not reject inside
    // page.evaluate and take the rest of the suite down with it.
    await page.evaluate(() => {
      const held = document.querySelector(".bhe-hitem");
      const drop = document.querySelector(".bhe-drop");
      if (!held || !drop) return false;
      held.value = "torch";
      drop.click();
      return held.value === "" && !!document.querySelector(".bh-editor");
    }),
  );
  await page.evaluate(() => document.querySelector(".bh-editor-close")?.click());
  await page.waitForTimeout(400);
}

// ── a locked slot is restored when the stored state disagrees ───────────────
{
  const restored = await page.evaluate(async () => {
    const element = document.querySelector("marinara-capability-beholder");
    const chatId = element?.capabilityProps?.chatId;
    const card = document.querySelector(".bh-slot-card[data-slot]");
    if (!card) return null;
    const slot = card.dataset.slot;
    card.click();
    await new Promise((r) => setTimeout(r, 700));
    const lock = document.querySelector(".bhe-lock");
    if (!lock) return null;
    lock.checked = true;
    lock.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector(".bh-editor-close")?.click();
    await new Promise((r) => setTimeout(r, 400));

    // Simulate an extraction overwriting the locked slot behind the panel's back.
    const before = await (await fetch(`/api/agents/beholder-state/${chatId}`, { credentials: "same-origin" })).json();
    const meddled = structuredClone(before.state);
    const character = meddled.characters?.[0];
    if (!character) return null;
    // What the lock pinned, so the check can require this exact value back rather
    // than merely the absence of the intruder — deleting the slot also removes the
    // intruder, and that is not restoration.
    const pinned = JSON.stringify(character.body[slot] ?? null);
    const characterName = character.name;
    character.body[slot] = { worn: [{ item: "intruder", damage: "pristine" }] };
    await fetch(`/api/agents/beholder-state/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ state: meddled }),
    });
    return { slot, chatId, pinned, characterName };
  });
  // A refresh is what triggers enforcement.
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll(".bh-hud-toggle")].find((b) => b.getBoundingClientRect().width > 0);
    toggle?.click();
    toggle?.click();
  });
  await page.waitForTimeout(3500);
  const lockOutcome = !restored
    ? { intruderGone: false, restored: false }
    : await page.evaluate(async (info) => {
        const state = await (
          await fetch(`/api/agents/beholder-state/${info.chatId}`, { credentials: "same-origin" })
        ).json();
        const character = (state?.state?.characters ?? []).find((row) => row?.name === info.characterName);
        return {
          intruderGone: !JSON.stringify(state).includes("intruder"),
          // The pinned value has to be back, byte for byte.
          restored: JSON.stringify(character?.body?.[info.slot] ?? null) === info.pinned,
        };
      }, restored);
  check("a locked slot loses the value that overwrote it", lockOutcome.intruderGone);
  check("a locked slot is restored to the pinned value, not merely cleared", lockOutcome.restored);
}

// ── with several characters, an edit lands on the one whose tab is open ─────
// Attribution is the failure that matters here: editing while looking at one
// character must not write to another.
{
  const names = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll("button[data-char]")].map((b) => b.dataset.char)),
  ]);
  if (names.length < 2) {
    check("multi-character editing", true, "skipped — chat has one character");
  } else {
    const other = names[1];
    const marker = `probe-other-${Date.now()}`;
    const outcome = await page.evaluate(
      async ([name, item]) => {
        document.querySelector(`button[data-char="${CSS.escape(name)}"]`)?.click();
        await new Promise((r) => setTimeout(r, 700));
        const card = document.querySelector(".bh-slot-card[data-slot]");
        card.click();
        await new Promise((r) => setTimeout(r, 700));
        document.querySelector(".bhe-add-worn").click();
        const rows = [...document.querySelectorAll(".bhe-worn-list .bh-editor-row")];
        rows[rows.length - 1].querySelector(".bhe-item").value = item;
        document.querySelector(".bh-editor-apply").click();
        await new Promise((r) => setTimeout(r, 3500));
        const chatId = document.querySelector("marinara-capability-beholder")?.capabilityProps?.chatId;
        const state = await (
          await fetch(`/api/agents/beholder-state/${chatId}`, { credentials: "same-origin" })
        ).json();
        const onTarget = state.state.characters.find((c) => c.name === name);
        const others = state.state.characters.filter((c) => c.name !== name);
        return {
          landed: JSON.stringify(onTarget ?? {}).includes(item),
          leaked: others.some((c) => JSON.stringify(c).includes(item)),
        };
      },
      [other, marker],
    );
    check(`an edit lands on the open character (${other})`, outcome.landed);
    check("and does not leak onto another character", !outcome.leaked);
  }
}

// ── layers, views, layouts ──────────────────────────────────────────────────
for (const layer of ["color", "damage", "wounds"]) {
  check(
    `${layer} layer toggle hides and restores that detail`,
    await page.evaluate((key) => {
      const panel = document.querySelector("#beholder_panel, .beholder-panel");
      const box = panel.querySelector(`input[name="bh-view-layer"][value="${key}"]`);
      box.checked = false;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      const hidden = panel.classList.contains(`bh-hide-${key}`);
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      return hidden && !panel.classList.contains(`bh-hide-${key}`);
    }, layer),
  );
}
check(
  "front/back toggle flips the view",
  await page.evaluate(async () => {
    const before = document.querySelector("#beholder_panel, .beholder-panel").innerHTML.length;
    document.querySelector(".bh-view-toggle")?.click();
    await new Promise((r) => setTimeout(r, 500));
    return document.querySelector("#beholder_panel, .beholder-panel").innerHTML.length !== before;
  }),
);
check(
  "layout switcher changes layout",
  await page.evaluate(async () => {
    const list = document.querySelector('[data-layout="list"]');
    if (!list) return false;
    list.click();
    await new Promise((r) => setTimeout(r, 500));
    return document.querySelector("#beholder_panel, .beholder-panel").classList.contains("bh-layout-compact");
  }),
);

// ── a brand-new chat, before any extraction ─────────────────────────────────
// The panel shows a placeholder doll then. Clicking a slot has to work anyway —
// that is how a scene gets set up by hand — and the Doctor has to say plainly
// that nothing has been tracked rather than looking broken.
{
  const chatId = await page.evaluate(async () => {
    const id = document.querySelector("marinara-capability-beholder")?.capabilityProps?.chatId;
    await fetch(`/api/agents/beholder-state/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ state: { characters: [] } }),
    });
    return id;
  });
  // reopen so the panel refetches the now-empty state
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll(".bh-hud-toggle")].find((b) => b.getBoundingClientRect().width > 0);
    toggle?.click();
    toggle?.click();
  });
  await page.waitForTimeout(3000);
  check(
    "an empty chat still draws the placeholder doll",
    await page.evaluate(() => {
      const panel = document.querySelector("#beholder_panel, .beholder-panel");
      return (
        panel?.getAttribute("data-empty") === "true" && panel.querySelectorAll(".bh-slot-card[data-slot]").length > 0
      );
    }),
  );
  const firstEdit = await page.evaluate(async () => {
    document.querySelector(".bh-slot-card[data-slot]")?.click();
    await new Promise((r) => setTimeout(r, 800));
    if (!document.querySelector(".bh-editor")) return { opened: false };
    document.querySelector(".bhe-add-worn").click();
    const rows = [...document.querySelectorAll(".bhe-worn-list .bh-editor-row")];
    rows[rows.length - 1].querySelector(".bhe-item").value = "firstitem";
    document.querySelector(".bh-editor-apply").click();
    await new Promise((r) => setTimeout(r, 3500));
    const id = document.querySelector("marinara-capability-beholder")?.capabilityProps?.chatId;
    const state = await (await fetch(`/api/agents/beholder-state/${id}`, { credentials: "same-origin" })).json();
    return { opened: true, saved: JSON.stringify(state).includes("firstitem") };
  });
  check("a slot is editable before any extraction has run", firstEdit.opened);
  check("that first edit is stored, creating the character", firstEdit.saved === true);
  void chatId;
}

// ── closing ─────────────────────────────────────────────────────────────────
check(
  "close button collapses the panel and releases the chat reflow",
  await page.evaluate(async () => {
    document.querySelector(".bh-dock-close")?.click();
    await new Promise((r) => setTimeout(r, 600));
    const panel = document.querySelector("#beholder_panel, .beholder-panel");
    return panel.classList.contains("bh-collapsed") && !document.body.classList.contains("bh-dock-open");
  }),
);

check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await page.screenshot({ path: "/tmp/parity/beholder-ui-final.png" });
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
