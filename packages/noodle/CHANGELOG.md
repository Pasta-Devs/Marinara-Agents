# Noodle release notes

## 1.5.8 — 2026-10-20

- The sticker, emoji, picture and poll menus now open inside Noodle. That hides the chat emoji-selection settings, which 1.5.7 meant to hide but still showed, and the menus are no longer see-through.

## 1.5.7 — 2026-10-20

- Noodle now uses Marinara Engine's own settings, dialogs, notifications, Local Model and connection queue instead of carrying copies of them. It no longer resets your Engine settings or starts a second Local Model, its background refreshes wait while a chat on the same connection is replying, and its notifications appear where you put yours. The download is smaller. It needs a Marinara Engine release after 2.5.0. On 2.5.0 and older, the version you already have keeps working. (#1478, #1487)
- The sticker and emoji pickers no longer show the chat emoji-selection settings. Those belong to a chat, and Noodle has none.

## 1.5.6 — 2026-10-13

- With a Claude (Subscription) connection, Noodle no longer makes a hidden second request to name each session, and a request now stops with an error if Claude Code turns on claude.ai connectors. With a Marinara Engine release after 2.5.0, Claude Code also no longer adds your account email, the date or this computer's details to the prompt. Engine 2.5.0's Claude Code still adds them, and the server log warns about it until you update Marinara. (#1313)

## 1.5.5 — 2026-10-11

- Each character can now use their own image generation connection for Noodle images. Open the character's Noodle profile, choose Edit profile and pick it under Image connection. The choice saves right away. Use Noodle image connection keeps the connection from Noodle's settings. Noodle still needs an image connection in its settings or a default image connection before it makes images.

## 1.5.4 — 2026-10-11

- The switch that adds a character's image instructions to their Noodle images is now in Noodle. Open the character's Noodle profile, choose Edit profile and find it under the profile fields. Edit image instructions opens the character's Convo tab, where you write the instructions. Your current choice carries over. The link needs Marinara Engine with capability API 1.67; on an older Engine, the switch works without the link.

## 1.5.3 — 2026-10-09 [highlight]

- Interpret image prompts now works without an Agents default connection. When none is set under Settings → Connections → Defaults, Noodle's own text connection rewrites the image prompt. Before, the rewrite was skipped, so your image connection's Image Prompting Instructions had no effect and the style profile's Style text was pasted into the prompt.
- Include descriptions now gives the character's appearance notes to the AI that rewrites the image prompt instead of leaving them in the prompt it edits, where they reached ComfyUI as plain text. With Interpret image prompts off, the notes are still added as written.
- Style text you write into Auto or a copy of it now guides the rewrite too.
- If the rewrite copies a full sentence of your Image Prompting Instructions, the Style text or the character's image habits, Noodle removes it. Short phrases and tag lists such as "masterpiece, best quality" stay.
- The help texts now say what happens when Interpret image prompts is off.

## 1.5.2 — 2026-10-09 [highlight]

- Image prompts no longer include text meant for the AI that writes them. The poster's Personality and image habits and your image connection's Image Prompting Instructions now only guide the rewrite that Interpret image prompts runs. Before, Noodle pasted them word for word into the prompt sent to ComfyUI and other image services, which broke tag-only prompts. With Interpret image prompts off, or when the rewrite fails, the image service gets the prompt without them.
- A style profile's Style text now reaches the rewrite once, as guidance, instead of also sitting in the prompt it edits. The Auto profile's note "Infer a consistent visual style from the character, game, scene, and selected image model" never ends up in the image prompt. Style text from the other profiles still applies when no rewrite runs.

## 1.5.1 — 2026-10-04

- New Show images to the writer switch in Settings → Advanced → Image Understanding. Turn it off and Noodle never sends timeline images to the model that writes your timeline. Image captioning, when on, still sends them to the captioning connection, which is the Noodle generation connection unless you choose another. The switch is on by default, so nothing changes unless you turn it off.
- The Image captioning help now says what happens when it is off: the writer model gets up to 8 recent timeline images, if Show images to the writer is on and the model accepts them.

## 1.5.0 — 2026-10-03

- Noodle can now translate posts and comments for you. Turn on Translate posts automatically in Settings → General. It uses the translator defaults you saved in a chat's Translation settings and leaves what your personas wrote alone. Posts already in your language get no extra copy, and turning the switch off stops the translations still waiting.
- Translations now stay after you refresh the timeline, leave Noodle or reload the page, and a translation you hide stays hidden. This browser keeps them, so another device translates again.

## 1.4.1 — 2026-10-02 [highlight]

- Fixed timeline refreshes on local models that failed after a short, empty-looking answer. When the prompt plus the room Noodle keeps for its answer did not fit the connection's context window, Noodle cut your characters, chats and timeline out of the prompt before sending. It now keeps the whole prompt and lowers the answer limit instead. If too little room is left for an answer, the refresh stops and says what to turn down.

## 1.4.0 — 2026-10-01

- You can now translate posts and comments, your own included. Pick Translate in a post's menu or under a comment, and use the same button to hide it again. Noodle uses the translator defaults you saved in a chat's Translation settings, or Google Translate into English if you have not saved any.
- In Chrome on Android, adding a picture to a post or comment now offers the camera as well as your files. The Marinara Android app doesn't offer the camera yet.
- Noodle's description now says what it is in plain words.

## 1.3.1 — 2026-09-30

- When Noodle cannot load, it now says so instead of showing an empty timeline. If Marinara Engine blocked it because this device has no Admin Secret, it explains how to set one.

## 1.2.25 — 2026-09-24

- Widgets on Homescreen now available.

## 1.2.24 — 2026-09-15

- Search icons and post menus keep Noodle's selected accent when Engine Chroma animates.

## 1.2.23 — 2026-09-13

- Applying a saved prompt asks before replacing the current prompt, including edits already saved as the active prompt.
- Cancel works immediately in Delete All Noodle Data; only deletion requires typing DELETE.
- A running timeline refresh blocks duplicate refresh requests instead of queuing extra generations.
- GLM 5.3 on NanoGPT and Z.AI keeps its required reasoning enabled when the selected effort is None.

## 1.2.22 — 2026-09-13

- Maintenance: simplify the inline composer's visibility checks and remove unused code.

## 1.2.21 — 2026-09-07

- Fixed "Load more" on the timeline, which failed on every page after the first.
- Fixed a manually chosen profile avatar being replaced by the character card image.
- Applying a saved prompt now asks before it discards unsaved prompt changes.
- Ambient accounts no longer post images.
- Removed leftover NoodleR wording from the image generation settings.

## 1.2.20 — 2026-09-03

- Added independent image width and height settings to Noodle settings.

## 1.2.19 — 2026-09-03

- Fixed automatic timeline refresh when Marinara requires an admin secret on loopback.

## 1.2.18 — 2026-09-03 [highlight]

- Test the agent changelog feature with a highlighted patch release. No features were added.
