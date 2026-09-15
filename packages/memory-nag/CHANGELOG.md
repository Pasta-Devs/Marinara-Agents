# Memory-nag release notes

## 1.1.2 — 2026-09-13

Automatic scans wait while a manual message-range scan is active, avoiding duplicate model charges between batches. Finished, stopped, failed, and abandoned scans release the guard without losing checkpoint progress.

## 1.1.1 — 2026-09-11

Send the saved admin secret on plain-HTTP remote clients too, matching the Engine, so Create Memories no longer fails with an X-Admin-Secret error on LAN and Termux setups.

## 1.1.0 — 2026-09-09

Choose all unprocessed messages or a specific message range when creating vault memories, so long chats can skip stale history. Closing the progress or prompt window keeps the underlying chat settings open.
