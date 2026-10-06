# Roleplay scenes from a DM thread

The player takes a DM conversation with a Creator into a real Engine roleplay scene, and the scene
comes back into Slurp when it ends. Built on Engine Capability API 1.66 (Engine PR #7119,
`api.registerSceneOrigin`, `scenes` permission).

## Release gate

Slurp 0.3.15 declares Capability API 1.66 and the `scenes` permission. It requires the
Engine host contract from #7119; an older Engine that does not support API 1.66 rejects the
package instead of installing an unusable scene feature. The minimum Engine version matches
the 2.4.6 staging baseline, with exact build provenance pinned in the builder.

## Flow

1. **Start.** "Start a scene" in a thread's ⋮ menu, or Accept on a Creator's invite card, opens the
   start sheet. The player may type an idea; Slurp plans the scene (`POST
   /messages/threads/:threadId/scene/plan`) with one model call on the player's connection.
2. **Plan.** `features/messages/scenes/slp-roleplay-scene-planner.ts` reads the thread (paid content
   named, never quoted), the stage persona, content menu, flavour brief (limits and how far a chat
   with this fan goes), rapport and the thread's continuity notes. The model returns the Engine's
   scene plan fields plus this scene's settings.
3. **Settings, per scene** (the Engine's `packageData`, handed back to claim and release):
   - `lock`: true locks the thread and makes the Creator busy everywhere; false leaves both alone.
   - `reach`: `none` (kept out of Slurp), `private` (this thread only), `hint` (she may allude to it,
     no details), `public` (she may post about it).
   The planner proposes them; the sheet shows them as cards the player can change.
4. **Engine.** The sheet calls the host's `startScene` with the plan and settings. The Engine claims
   the thread (`claim`), creates the scene chat and opens it.
5. **While it runs** (locking scenes): the thread shows a lock bar with "Go to scene" instead of the
   composer; every thread write answers 409 (`slp-roleplay-scene-lock.ts`); replies (status
   `in_scene`), follow-ups, due posts and comment replies of the Creator wait.
6. **End.** End Scene, Discard, Convert or deleting the chat calls `release`. Slurp writes the line
   first and opens the lock last:
   - concluded with a reach other than `none`: a recap card (title, summary, reach picker), a
     `scene_played` continuity event (`roleplay` reality) and one fact at the reach's audience
     (`slurp` reality: choosing a reach is the explicit promotion);
   - otherwise a short "scene ended" line.
   Back in the Engine, **Back to Slurp** opens the thread (`focusSceneOriginId`).
7. **Missed releases.** If Slurp was off when a scene ended, the next read of the thread, the message
   scheduler or a busy check reads the scene chat: a concluded scene brings its recap
   (`sceneSummary`), a missing or discarded one just unlocks.

## Invites

A reply to the player may carry `sceneInvite` (offered only when scenes run, the thread is free, no
invite is open and the last is at least three days old). It is stored as a card under her reply.
Starting any scene in the thread marks an open invite accepted; "Not now" declines it.

## Not in scope

- Scenes with Slurp Support, with AI fans, or with persona-backed Creators (the Engine casts Engine
  characters only).
- The Engine also stores the recap as character memory on conclude, as for any Engine scene.
