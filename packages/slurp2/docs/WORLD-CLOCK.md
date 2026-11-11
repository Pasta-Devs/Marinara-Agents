# World clock

Slurp has its own date. Simulation reads the world clock, and infrastructure reads the real clock.

## Rules

- World time is real time plus one stored offset (`slurp2.world.clockOffsetMs`). A new or existing install starts at offset zero, so nothing changes until someone skips.
- The date only moves forward, by whole days, with a **skip**. A skip keeps the time of day.
- The only way back is to restore a **checkpoint**.
- A skip simulates nothing. It creates no posts, messages or events, pays no stipend or income, and runs no autopurge or other lazy catch-up.
- The UI shows the world date only.

## What a skip does

1. It writes an automatic checkpoint. If that fails, the skip does not happen.
2. It adds the skipped days to the offset.
3. It sets the world marks (`slurp2.world.tick`, `.maintenance`, `.pulse`) to the new date, so the next tick sees no elapsed time.
4. It moves every pending due time by the skipped span, so a queued reply still waits the time it had left and nothing expires because the date jumped. The columns are listed in `slp-world-clock-storage.ts` (`SHIFTED_COLUMNS`), and due-style keys in settings JSON and Creator profiles move too (`shiftSlurpDueJson`). Content stamps such as `createdAt` keep their dates.
5. It keeps the newest five automatic checkpoints (1 to 50 in Backstage > World clock). Manual checkpoints are never deleted.

Purges (autopurge, deleted-post expiry, continuity and fan-plan retention, trend pruning) read the real clock. A skip therefore ages nothing out. Content written after a skip carries world dates ahead of the real clock, so it ages in real time from the moment the real clock reaches it.

## Checkpoints

A checkpoint is a normal Slurp backup archive (all tables, all `slurp2.*` settings, creator media) plus a JSON sidecar, in `slurp2-checkpoints/` next to the data. The index is the directory, not the database, so a restore never rolls the list back. Kinds: `manual`, `auto` (before a skip) and `safety` (before a restore, newest three kept). `garnish.ads.*` is not part of a backup by design.

## What a restore does

1. It reads the archive and checks its size, structure and media count. Nothing changes if that fails.
2. It writes a safety checkpoint of the current state.
3. It pauses Slurp and bumps the **epoch**. A model or image answer that started before the bump is refused when it returns (`assertSlurpWorldEpoch` in the provider and image retry wrappers), so no late write lands in the restored world.
4. It replaces the data, settings and media. If any step fails, it puts the safety checkpoint back.
5. It sets the world date back to the checkpoint's date and the paused flag back to what it was before the restore.

Restore needs the backup lock: it refuses while a write, an account operation or another backup is running.

## Real clock on purpose

Locks and claim leases, job and file ages, retry and backoff, scheduler poll spacing and request timing keep `Date.now()`. A skip must not trip a lease or fire a poll.

## Ceilings

- One offset and one epoch per process, as with the pause flag.
- Time-since fields that are not in `SHIFTED_COLUMNS` or in a due-style key do not move. Add a new due-style column to the list.
