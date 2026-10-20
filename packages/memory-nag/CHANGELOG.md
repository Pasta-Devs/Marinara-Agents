# Memory-nag release notes

## 1.2.1 — 2026-10-20

Memory Nag now uses Marinara Engine's own libraries and data cache for its screens instead of carrying copies of them, so the download is smaller. It needs a Marinara Engine release after 2.5.0. On 2.5.0 and older, the version you already have keeps working. (#1487)

## 1.2.0 — 2026-10-13

Scans now read Roleplay whispers the way the Engine's own agents do, marked private with who they were for, so a promise made in a whisper can become a memory. A message that is only a whisper is no longer read as empty. This needs a Marinara Engine that shares whispers with Agents; older versions keep reading public messages only.

## 1.1.3 — 2026-10-01

The description now says what it does in plain words.

## 1.1.2 — 2026-09-13

Automatic scans wait while a manual message-range scan is active, avoiding duplicate model charges between batches. Finished, stopped, failed, and abandoned scans release the guard without losing checkpoint progress.

## 1.1.1 — 2026-09-11

Send the saved admin secret on plain-HTTP remote clients too, matching the Engine, so Create Memories no longer fails with an X-Admin-Secret error on LAN and Termux setups.

## 1.1.0 — 2026-09-09

Choose all unprocessed messages or a specific message range when creating vault memories, so long chats can skip stale history. Closing the progress or prompt window keeps the underlying chat settings open.
