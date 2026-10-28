# Otome Forge

Otome Forge will be a single-player otome game made from your own characters: love interests who remember what you chose, their texts on your phone, dates and mini-games, and wishes for outfits and memories paid for only with Starlight you earn. There is no real money in it.

This is an early development build. You can set up a story: a premise, your protagonist from one of your personas, and two to five love interests from your character cards or from original archetypes. The forge then plans the story's mystery and writes a hidden character bible for each love interest, and can paint the cast's base looks. The story itself, Home, the phone, dates and wishes arrive in later builds. The plan is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

## Install and open it

It is not listed in any catalog yet, so **Agents → Download Agents** does not offer it. To try a development build, build a catalog with `MARINARA_CATALOG_INCLUDE_INCOMPLETE=1` and serve it to a development Engine through `MARINARA_AGENT_CATALOG_URL` (see `scripts/catalog-incomplete.mjs`). Never commit a catalog built that way.

1. Install **Otome Forge** from that catalog.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Otome Forge**.

It needs an Engine with Capability API 1.386. Its routes need admin access, so playing from another device needs `ADMIN_SECRET` set on the server and the same value in **Settings → Advanced → Admin Access**.

## Content settings and the 18+ gate

Each story has its own Heat (SFW, NSFW: Fade or NSFW: Explicit; SFW by default), Darkness (Gentle, Angst or Dark romance; Angst by default), Lines & Veils (a Line is never written; a Veil happens only off the page), and image rating (SFW, Suggestive or Explicit; SFW by default). NSFW Heat, Dark romance and the image ratings above SFW unlock only after a one-time confirmation: "I am 18 or older. Love interests are always adults. This is fiction." The confirmation is self-reported, stored with its time, and checked by the server on every change. Turning a setting down never asks, and withdrawing the confirmation turns every story back to SFW, Angst and SFW images. Love interests are always adults, and non-consent and pregnancy start as Lines.

## Your data

Otome Forge keeps its saves in Marinara Engine's package storage, in documents whose ids start with `otome-forge:`, so it works alongside Gacha Forge. They travel with your backups and profile exports, and they are not isolated from other packages in the Engine's storage. Painted looks are saved in the Global Gallery, and deleting a story deletes them too. The look you pick (Midnight, Pearl or Follow system) and an unfinished setup are kept only in this browser, in storage the Engine's page shares with other installed packages.
