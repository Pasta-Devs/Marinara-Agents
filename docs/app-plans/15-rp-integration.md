# RP integration — making the phone part of the story

Status: **decided**, architecturally the largest item in the plan.

---

## Where things stand today

The phone is a sandbox parked next to the story. Concretely:

- `agents.json` declares the agent `"phase": "pre_generation"` but also **`"runtimeDisabled": true`,
  `"execution": "feature"`, and an empty `defaultPromptTemplate`** — it injects nothing into generation
  and never runs a turn.
- The phone writes to the story in **exactly one place**: the explicit "show my phone" action
  (`createMessageWithSwipe`, `server-entry.ts:334`). One touchpoint in 998 lines of server code.
- There are **no lifecycle hooks** — nothing fires when a message is sent or a turn completes.

Result: characters don't know the phone exists, nobody texts you unprompted, and nothing accumulates
while you play. Every piece of content is *pull* — open an app, hit refresh.

## Feasibility — confirmed

The Engine already has a per-turn agent execution model. `db/schema/agents.ts`:
- phases: **`pre_generation` | `parallel` | `post_processing`**
- `agentRuns` records results per `chatId` + `messageId`, with token and duration accounting.

So "advance the phone on chat turns" is supported infrastructure. **The enabling change is flipping the
virtual-phone agent from an opted-out feature into one that actually runs at a phase** —
`post_processing` is the natural fit for "the turn happened, now advance the phone".

---

## Decisions

### 1. Awareness — asymmetric
- **Your phone:** characters see it **only when you explicitly show it.** The existing
  `/chats/:chatId/phones/:phoneId/show` action stays the sole path. Nothing leaks; you stay in control.
- **Their phone:** a character gets **ambient awareness of their own phone** — their texts, their feed —
  injected into their prompt so they can reference it naturally ("saw your message", "that thread's
  still going").
- **Not** doing full ambient context of all phone state every turn. Too expensive for the payoff.

### 2. Background activity — two of three
- **Characters text you unprompted.** A character sends a message mid-scene driven by story events.
  The phone buzzes during RP. This is the headline feature.
- **Story events reach the phone.** What happens in the scene surfaces on the device — a website
  someone mentions becomes searchable in Goodle, a photo taken in-scene lands in Gallery.
- **Not** doing autonomous feed drift: Noodle, Forum, and Mail still fill on refresh, not on a clock.

### 3. Trigger — on chat turns
Phone state advances when a story message is generated. Tied to activity already being paid for.
No timers, nothing generates while you're away, no idle burn.

### 4. Character agency — yes, story-driven
Characters post, text each other, and browse based on scene events, and **you can find the traces**.
The phone becomes evidence: you can go look at what they did. This is what makes the whole device
worth having.

---

### 5. The phone controls other agents; it doesn't reimplement them

From the tester thread. If Music DJ is in the same chat, the phone should expose **simple transport
controls** — skip, volume — not a music app. Same principle for any other agent the phone touches:
gunterlie is wiring *control* of agents into the device, not their functionality, and it should stay
that way or the phone becomes a container for every other agent.

**Placement: lock screen.** Two clicks (open phone, skip) rather than one from a persistent top-bar
widget — deliberately, because a lock-screen now-playing card is what a real phone does and the
roleplay is the point. It also reuses the lock surface that already exists (see
[`18-device-shell.md`](18-device-shell.md) §2).

### 6. Reading someone else's phone is gated by the story

Access to another character's device is a model judgement plus a reaction, not a switcher — see
[`20-tester-feedback.md`](20-tester-feedback.md) §3. It belongs to this plan's "phone as RP element"
thesis more than to the shell.

## Risks and open implementation questions

1. **Cost per turn.** Every story turn now potentially triggers phone generation. Needs a budget:
   how often does a character actually text unprompted? Suggest a low probability gate plus a cooldown,
   not a generation every single turn.
2. **Which phase?** `post_processing` for advancing state; the ambient own-phone context needs
   `pre_generation` to reach the prompt. May need both.
3. **Flipping `runtimeDisabled`** changes the agent from opt-in-cosmetic to something that spends
   tokens. It must stay clearly optional and off by default.
4. **Notification surfacing.** "Characters text you unprompted" only lands if the user sees it while
   the phone is closed — depends on the notification work in `00-platform.md`, and probably a lock
   screen / buzz indicator that doesn't exist yet.
5. **Story events reaching the phone** requires parsing scene content for phone-relevant artefacts
   (URLs, photos, mentions). Start narrow: images to Gallery is the easiest concrete win, and Gallery
   already scans chat messages for image URLs — that mechanism can be reused.

> **Fourth pass — the unprompted-text feature is inert as built.** Notifications are only fetched
> while the phone is open *and* on the home screen (`index.tsx`, the `activeApp !== null` guard), so a
> character texting you mid-scene would never reach you. A lock screen with a notification list
> already exists — only the delivery is missing. See [`18-device-shell.md`](18-device-shell.md) §2.
