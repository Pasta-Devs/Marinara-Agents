# Platform & cross-cutting — second-pass findings

The first pass only read the app shells. This pass read the platform, device, and system layers plus
the server routes. The findings here outrank most of the per-app work.

---

## 1. Every piece of generated content is truncated at 300 characters — `critical`

`platform/content.ts`:
```
const MAX_FIELDS = 8;
const MAX_STRING = 300;
const MAX_ITEMS = 10;
```

`parseBoundedContent` is the single funnel for **all** model output on the phone — it's called at 11
sites in `system/server-entry.ts`. Every generated string is hard-cut to 300 chars and every generated
list to 10 items:

| Content | Ceiling |
|---|---|
| Mail body | 300 chars, 10 emails max |
| Forum post / reply | 300 chars, 10 threads max |
| Goodle page section | 300 chars, 10 sections max |
| Noodle post | 300 chars, 10 posts max |
| Tindler profile | 300 chars, 10 profiles max |
| Camera shot description | 300 chars |
| Messages character reply | 300 chars |

**This is almost certainly why generated content feels thin.** A 300-character email is two sentences.
A 300-character web page section is a paragraph fragment, mid-thought.

**Decided: per-field limits.** Each `ContentSchema` declares its own caps instead of the three global
constants. A Messages reply genuinely should stay short; a Goodle page section, mail body, or forum
post should not. Same for `MAX_ITEMS` — a 10-post feed and a 10-email inbox are different problems.

**Do this first.** It raises quality across every app without touching any of them, and it changes
what the per-app content work is even aiming at.

## 2. ~160 lines of platform architecture have no production consumer — `delete`

These are imported **only by `tests/virtual-phone.regression.ts`** — nothing in the app ever constructs them:

- `platform/app-lifecycle.ts` → `AppLifecycleManager` (install/disable/remove/update/activate state machine)
- `platform/capabilities.ts` → `AppCapabilityGrants` (the whole capability enforcement system)
- `platform/notifications.ts` → `NotificationStore`
- `platform/app-manifest.ts` → `validateAppManifest` (only `InstalledAppRegistry.register` calls it, plus tests)

Plus `platform/bottom-navigation.ts` (54 lines) — **imported by nothing at all**.

The tests make them look alive. They're speculative scaffolding: an interface with one implementation
and no caller.

**Decided: delete it.** Remove `AppCapabilityGrants` and the unused lifecycle/notification scaffolding,
along with the tests that are their only consumers. Manifests keep their `capabilities` array as
documentation — nothing enforces it, and now nothing pretends to. `platform/bottom-navigation.ts` goes too.

Keep: `InstalledAppRegistry` and `AppRouteStackManager` (real consumers in `index.tsx`), and
`validateAppManifest` (called by `register`).

## 3. `PhoneStore.set` costs two round trips — makes the keystroke bug much worse — `bug`

`platform/phone-store.ts`:
```
async set(key, value) {
  const entries = await this.backend.list(...);   // full LIST of all app storage
  ...quota math...
  await this.backend.set(...);                    // then the PUT
}
```

Every single `set` fetches **all** of that app's storage to compute a 256KB quota, then writes.

So Notes writing on every keystroke isn't one request per character — it's **two HTTP round trips per
character typed**, one of them downloading the entire notes array. Same for Tindler's preferences field.
This upgrades the debounce in `12-notes.md` and `07-tindler.md` from polish to a real fix.

Cheaper option: track the size client-side, or let the server enforce the quota on write.

## 4. Only Messages ever produces a notification

`GET /phones/:phoneId/notifications` is hardcoded to unread message threads. Mail, Forum, Noodle,
NoodleR and Tindler all declare `notify` and never fire one. A phone that only buzzes for texts is a
quiet phone.

**Decided — these apps get notifications:**
- **Mail** — new mail arrives.
- **NoodleR** — a creator you subscribe to posted.
- **Noodle / Tindler** — feed activity and new matches.

~~**Not Forum.**~~ Forum has since been **scrapped** entirely — see [`06-forum.md`](06-forum.md). No
carve-out needed.

The route needs restructuring: it currently derives notifications inline from message threads. It
should collect from each app instead.

## 5. Duplication confirmed

- `hueFor` — 3 copies (goodle, noodler-r, tindler), identical.
- `initials` — 2 copies (tindler, noodler-r); the noodler-r one is dead.
- App icon/glyph map — duplicated in `apps/app-store/shell.tsx`.

All four belong in one place on the platform.

## 6. Image policy — one platform-wide answer, not per-app improvisation — `decided`

From the tester thread ([`20-tester-feedback.md`](20-tester-feedback.md)). Every image decision in the
plan (Camera, Tindler, Goodle, Marketplace, Noodle photo posts) assumed images just work. They mostly
won't: **many users never configure an image connection at all**, and those who do pay for it in
seconds — gunterlie measures ~15s per image on local Krea2, which would make a Goodle page with four
images a minute-long load.

Three rules, applied platform-wide:

**a. Per-app image toggles are mandatory.** Not one global switch. You should be able to run generated
photos in Tindler and never spend a token on Goodle page art. Goodle is the awkward one — a browser you
can't see images in is odd flavour-wise — so it gets the per-site button in
[`13-goodle.md`](13-goodle.md) rather than a plain off switch.

**b. No image connection ⇒ a designed empty state, not a broken one.** dsbwizzard supplied the
reference: a real Google Images result page with the network cut. The thing to copy from it is that
**every result keeps its title and its source** — *"HOT SHREK // #shrek… · TikTok"*, *"You're welcome :
r/Shrek · Reddit"*, *"Sexy Shrek Poster for Sale… · Redbubble"* — and only the picture is missing. The
page still tells you what's there and where it's from; it reads as a *list* rather than as damage.

So the phone's rule is **caption-and-source always render, image area collapses to empty space.** The
generated metadata is the content; the image was decoration. This also means a phone with no image
connection at all is a fully working phone, not a degraded one.

On top of that, **the model fills each empty slot with grey Unicode glyphs chosen to match what the
image would have been** — costs nothing, needs no image model, and marks the slot as deliberate. It's
the "friendlier version" of the broken-image icon dsbwizzard proposed as the alternative: same signal
that something was there, without looking like a bug.

**c. Failed generation ⇒ show the prompt plus a retry button.** Noodle already surfaces the image
prompt when a generation fails or the image is deleted, and it's the right call — you can read what it
tried to draw. The phone does the same **and adds retry**, which Noodle lacks.

Blocked with everything else image-shaped on the API contract extension in
[`16-engine-interop.md`](16-engine-interop.md) — but (b) and (c) are the *unblocked* half: they're
exactly what ships when the contract isn't there or the user has no connection, so build them first and
they carry the apps until images arrive.
