# Web Researcher changelog

## 1.0.0 — 2026-11-14

- First release: a pre-generation agent that looks up real-world references in the scene before the reply, so characters get games, films, music, history and other real details right instead of guessing.
- Uses the Engine's `web_search` tool to find sources and `web_fetch` to read the pages it picks, then adds a short verified-facts block with source URLs to the prompt.
- Covers lore and story as well as practical details, and adds a short Community views block when a source actually says what players or critics think.
- Stays quiet when the scene has no real-world references, and marks anything it could not confirm as unverified instead of filling the gap from memory.
- Needs the Engine release that adds the `web_fetch` tool. Until then it installs on staging builds only.
