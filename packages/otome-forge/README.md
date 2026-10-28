# Otome Forge

Otome Forge will be a single-player otome game made from your own characters: love interests who remember what you chose, their texts on your phone, dates and mini-games, and wishes for outfits and memories paid for only with Starlight you earn. There is no real money in it.

This is an early development build. It opens the game's portrait stage, with its Midnight and Pearl looks, its fonts and its menus, and every screen still says it arrives in a later build. The plan is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

## Install and open it

It is not listed in any catalog yet, so **Agents → Download Agents** does not offer it. To try a development build, build a catalog with `MARINARA_CATALOG_INCLUDE_INCOMPLETE=1` and serve it to a development Engine through `MARINARA_AGENT_CATALOG_URL` (see `scripts/catalog-incomplete.mjs`). Never commit a catalog built that way.

1. Install **Otome Forge** from that catalog.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Otome Forge**.

It needs an Engine with Capability API 1.386. Its routes need admin access, so playing from another device needs `ADMIN_SECRET` set on the server and the same value in **Settings → Advanced → Admin Access**.

## Your data

Otome Forge keeps its saves in Marinara Engine's package storage, in documents whose ids start with `otome-forge:`, so it works alongside Gacha Forge. They travel with your backups and profile exports. The look you pick (Midnight, Pearl or Follow system) is kept only in this browser.
