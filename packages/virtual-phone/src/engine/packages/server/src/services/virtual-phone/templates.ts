// ──────────────────────────────────────────────
// Virtual Phone — page templates
//
// Noodle and Noodler ship as templates so their look stays stable across a
// roleplay and the model only writes content, never chrome. Every other app uses
// route-aware baseline templates. Templates are inlined strings: the package bundles
// to a single server.mjs, so there is no asset directory to read at runtime.
//
// These are SIMULATED, scoped-to-the-chat versions of Noodle and Noodler. They
// never read or write the Engine's own Noodle tables, so one roleplay's feed can
// never leak into another chat.
// ──────────────────────────────────────────────

import { PHONE_APPS, type PhoneApp } from "./apps.js";

export type PhoneTemplate = {
  id: string;
  appId: string;
  /** Matches a URL path prefix. The first matching template wins, so order matters. */
  match: (path: string) => boolean;
  name: string;
  slots: string[];
  /** Instructions handed to the model describing what belongs in each slot. */
  slotDoc: string;
  html: string;
};

const NOODLE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0e0d12; color: #f2eff7; font-size: 15px; line-height: 1.45;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  a { color: #ffb347; text-decoration: none; }
  .nd-app { display: flex; flex-direction: column; min-height: 100vh; padding-bottom: 58px; }
  .nd-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: rgba(14,13,18,.85); backdrop-filter: blur(12px); border-bottom: 1px solid #2c2836; }
  .nd-wordmark { display: flex; align-items: center; gap: 7px; font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
  .nd-compose { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 8px solid #17151d; }
  .nd-compose input { flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #2c2836; border-radius: 20px;
    background: #17151d; color: #f2eff7; font-size: 14px; }
  .nd-compose button { padding: 0 16px; border: 0; border-radius: 20px; background: #ffb347; color: #17151d; font-weight: 700; font-size: 13px; }
  .nd-trends { padding: 12px 16px; border-bottom: 8px solid #17151d; }
  .nd-trends h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #948da3; margin-bottom: 8px; }
  .nd-trend { display: block; padding: 6px 0; }
  .nd-trend-name { display: block; font-weight: 600; font-size: 14px; color: #f2eff7; }
  .nd-trend-count { display: block; font-size: 12px; color: #948da3; }
  .nd-post { display: flex; gap: 11px; padding: 13px 16px; border-bottom: 1px solid #2c2836; }
  .nd-avatar { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%; background: #2c2836;
    display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .nd-main { flex: 1; min-width: 0; }
  .nd-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px; font-size: 14px; }
  .nd-name { font-weight: 700; color: #f2eff7; }
  .nd-handle { color: #948da3; font-size: 13px; }
  .nd-body { margin-top: 2px; font-size: 14.5px; overflow-wrap: anywhere; }
  .nd-actions { display: flex; justify-content: space-between; max-width: 250px; margin-top: 9px; color: #948da3; font-size: 12.5px; }
  .nd-banner { height: 120px; background: linear-gradient(120deg,#2c2836,#3d2f44); }
  .nd-id { padding: 10px 16px 14px; border-bottom: 8px solid #17151d; }
  .nd-id h1 { font-size: 19px; }
  .nd-bio { margin-top: 9px; font-size: 14.5px; }
  .nd-counts { margin-top: 8px; font-size: 13.5px; color: #948da3; }
  .nd-counts b { color: #f2eff7; }
  .nd-tabs { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-around;
    padding: 8px 0 10px; background: rgba(14,13,18,.94); border-top: 1px solid #2c2836; }
  .nd-tabs a { display: flex; flex-direction: column; align-items: center; gap: 2px; color: #948da3; font-size: 10px; }
  .nd-tabs a.on { color: #ffb347; }
  .nd-tabs em { font-style: normal; font-size: 19px; }
`;

const NOODLE_TABS = `
    <nav class="nd-tabs" aria-label="Noodle">
      <a class="on" href="https://noodle.social/"><em>🏠</em>Home</a>
      <a href="https://noodle.social/search"><em>🔍</em>Search</a>
      <a href="https://noodle.social/notifications"><em>🔔</em>Alerts</a>
      <a href="https://noodle.social/messages"><em>✉️</em>DMs</a>
    </nav>`;

const NOODLE_POST_DOC = `Each post is exactly this markup, with your content substituted:
<article class="nd-post">
  <div class="nd-avatar">🙂</div>
  <div class="nd-main">
    <div class="nd-head">
      <a class="nd-name" href="https://noodle.social/@handle">Display Name</a>
      <span class="nd-handle">@handle · 2h</span>
    </div>
    <div class="nd-body">The post text. May use @mentions and #hashtags.</div>
    <div class="nd-actions"><span>💬 29</span><span>🍜 47</span><span>❤️ 318</span><span>↗</span></div>
  </div>
</article>
The avatar div holds one emoji that suits the poster. Reposts are called "slurps" (🍜).`;

const NOODLE_RULES = `Noodle is the story world's public social network. Never mention Twitter, X, or any
real platform — in this world Noodle is simply what exists.
- Never write posts as the user's persona. The user controls that account; other accounts
  may mention, reply to, or talk about the persona.
- Handles are lowercase with no spaces (mira_k, chef.tetsu, notyourguy).
- Voice comes from each character's own personality. A guarded or hostile character must not
  sound like a chatty extrovert. Vary sentence length, punctuation, capitalisation, and emoji use.
- Characters may be petty, flirty, vulgar, sarcastic, or start arguments when it fits them.
  This is permission, not a quota.
- Accounts know each other. Have them reply to, quote, and subtweet each other in the same
  batch rather than posting in isolation.
- Background accounts are ordinary fictional users, not characters.
- Keep Noodle itself non-explicit. Adult content belongs on Noodler.`;

const NOODLER_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0c0a10; color: #f4eff8; font-size: 15px; line-height: 1.45;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  a { color: #e0457b; text-decoration: none; }
  .nr-app { display: flex; flex-direction: column; min-height: 100vh; padding-bottom: 58px; }
  .nr-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: rgba(12,10,16,.86); backdrop-filter: blur(12px); border-bottom: 1px solid #302739; }
  .nr-wordmark { display: flex; align-items: center; gap: 7px; font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
  .nr-badge { padding: 3px 8px; border: 1px solid #e0457b; border-radius: 10px; color: #e0457b; font-size: 10px; font-weight: 800; letter-spacing: .06em; }
  .nr-gate { margin: 14px 16px; padding: 14px 16px; border: 1px solid #302739; border-radius: 14px; background: #16121c; }
  .nr-gate h2 { font-size: 15px; margin-bottom: 6px; }
  .nr-gate p { color: #9b8fa8; font-size: 13px; }
  .nr-gate-actions { display: flex; gap: 9px; margin-top: 12px; }
  .nr-gate-actions a { flex: 1; padding: 9px; border-radius: 20px; text-align: center; font-size: 13px; font-weight: 700; }
  .nr-yes { background: #e0457b; color: #fff; }
  .nr-no { border: 1px solid #302739; color: #9b8fa8; }
  .nr-post { padding: 13px 16px; border-bottom: 1px solid #302739; position: relative; }
  .nr-head { display: flex; align-items: center; gap: 10px; }
  .nr-avatar { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; background: #302739;
    display: flex; align-items: center; justify-content: center; font-size: 17px; }
  .nr-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nr-name { font-weight: 700; font-size: 14px; color: #f4eff8; }
  .nr-handle { color: #9b8fa8; font-size: 11.5px; }
  .nr-tier { flex: 0 0 auto; padding: 3px 9px; border-radius: 11px; background: #201a29; color: #ffb347; font-size: 10.5px; font-weight: 700; }
  .nr-body { margin-top: 9px; font-size: 14.5px; overflow-wrap: anywhere; }
  .nr-media { margin-top: 10px; height: 190px; border-radius: 14px; background: linear-gradient(140deg,#2a2131,#3a2436); }
  .nr-actions { display: flex; gap: 20px; margin-top: 10px; color: #9b8fa8; font-size: 12.5px; }
  .nr-post[data-lock=true] .nr-media { filter: blur(18px) saturate(.7); }
  .nr-post[data-lock=true]::after { content: "🔒 Subscribe to unlock"; position: absolute; left: 50%; top: 62%;
    transform: translate(-50%,-50%); padding: 9px 16px; border-radius: 20px; background: rgba(12,10,16,.88);
    font-size: 13px; font-weight: 700; }
  .nr-tiers { display: flex; gap: 11px; padding: 4px 16px 16px; overflow-x: auto; border-bottom: 8px solid #16121c; }
  .nr-tier-card { flex: 0 0 200px; padding: 14px; border: 1px solid #302739; border-radius: 14px; background: #16121c; }
  .nr-tier-name { font-size: 13px; font-weight: 700; color: #ffb347; }
  .nr-tier-price { margin-top: 4px; font-size: 24px; font-weight: 800; }
  .nr-tier-price span { font-size: 13px; font-weight: 500; color: #9b8fa8; }
  .nr-tier-perks { margin-top: 8px; color: #9b8fa8; font-size: 12.5px; }
  .nr-tier-card button { width: 100%; margin-top: 12px; padding: 9px; border: 0; border-radius: 20px; background: #e0457b; color: #fff; font-weight: 700; font-size: 13px; }
  .nr-banner { height: 120px; background: linear-gradient(120deg,#2a2131,#3a2436); }
  .nr-id { padding: 10px 16px 14px; }
  .nr-id h1 { font-size: 19px; }
  .nr-bio { margin-top: 9px; font-size: 14.5px; }
  .nr-tabs { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-around;
    padding: 8px 0 10px; background: rgba(12,10,16,.94); border-top: 1px solid #302739; }
  .nr-tabs a { display: flex; flex-direction: column; align-items: center; gap: 2px; color: #9b8fa8; font-size: 10px; }
  .nr-tabs a.on { color: #e0457b; }
  .nr-tabs em { font-style: normal; font-size: 19px; }
`;

const NOODLER_TABS = `
    <nav class="nr-tabs" aria-label="Noodler">
      <a class="on" href="https://noodler.social/feed"><em>🏠</em>Feed</a>
      <a href="https://noodler.social/discover"><em>🔍</em>Discover</a>
      <a href="https://noodler.social/messages"><em>✉️</em>DMs</a>
      <a href="https://noodler.social/subscriptions"><em>💳</em>Subs</a>
    </nav>`;

const NOODLER_POST_DOC = `Each post is exactly this markup, with your content substituted:
<article class="nr-post" data-lock="false">
  <div class="nr-head">
    <div class="nr-avatar">🙂</div>
    <div class="nr-who"><span class="nr-name">Display Name</span><span class="nr-handle">@handle · 3h</span></div>
    <span class="nr-tier">Sweet Tier</span>
  </div>
  <div class="nr-body">The caption.</div>
  <div class="nr-media"></div>
  <div class="nr-actions"><span>❤️ 1.2K</span><span>💬 88</span><span>💸 Tip</span></div>
</article>
Set data-lock="true" for a paywalled post: it blurs the media and overlays a subscribe prompt.
A locked post's caption is a teaser line only, never the full content. Omit the nr-media div
for text-only posts. The avatar div holds one emoji suiting the creator.`;

const NOODLER_RULES = `Noodler is the story world's age-gated creator platform, the adult sibling of Noodle.
Never mention OnlyFans, Fansly, or any real platform — in this world Noodler is what exists.
- Match the content level this chat has already established. If the scene is not explicit,
  keep captions suggestive and teasing rather than graphic. Never escalate past the story.
- Every creator on Noodler is an adult.
- Locked posts are the norm. Mix a couple of free posts in with the paywalled ones.
- Never write posts as the user's persona.
- Creators are characters first. Voice, pricing, and posting rhythm follow their personality
  and in-world standing, not one generic flirty tone.
- Pricing and follower counts should reflect standing, not be uniformly large.`;

const SPECIAL_PHONE_TEMPLATES: readonly PhoneTemplate[] = [
  {
    id: "noodle/profile",
    appId: "noodle",
    match: (path) => path.startsWith("/@") || path.startsWith("/profile"),
    name: "Noodle profile",
    slots: ["identity", "posts"],
    slotDoc: `${NOODLE_RULES}

This is one account's Noodle profile. Keep the bio, counts, and posts consistent with
anything already established about this character.

- identity: exactly this block, filled in:
    <h1>Display Name</h1>
    <p class="nd-handle">@handle</p>
    <p class="nd-bio">One or two lines of bio in the character's own voice.</p>
    <p class="nd-counts"><b>412</b> following · <b>1,203</b> followers</p>
- posts: 5-10 posts, all authored by THIS account, newest first.
${NOODLE_POST_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile / Noodle</title><style>${NOODLE_CSS}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>🍜</span> noodle</div><a href="https://noodle.social/">Home</a></header>
  <div class="nd-banner"></div>
  <section class="nd-id"><!-- SLOT: identity --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${NOODLE_TABS}
</div></body></html>`,
  },
  {
    id: "noodle/feed",
    appId: "noodle",
    match: (path) => !/^\/(search|notifications|messages)(?:\/|$)/i.test(path),
    name: "Noodle feed",
    slots: ["trending", "posts"],
    slotDoc: `${NOODLE_RULES}

This is the Noodle home timeline.

- trending: 3-5 topics, each exactly:
    <a class="nd-trend" href="https://noodle.social/search?q=Topic">
      <span class="nd-trend-name">#TopicName</span><span class="nd-trend-count">1,204 posts</span>
    </a>
- posts: 6-12 posts from different accounts, newest first.
${NOODLE_POST_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodle</title><style>${NOODLE_CSS}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>🍜</span> noodle</div><a href="https://noodle.social/settings">Settings</a></header>
  <form class="nd-compose" action="https://noodle.social/compose" method="get" aria-label="new post">
    <input name="text" placeholder="What's cooking?" aria-label="Post text"><button type="submit">Post</button>
  </form>
  <section class="nd-trends" aria-label="Trending"><h2>Trending now</h2><!-- SLOT: trending --></section>
  <main aria-label="Timeline"><!-- SLOT: posts --></main>
${NOODLE_TABS}
</div></body></html>`,
  },
  {
    id: "noodle/search",
    appId: "noodle",
    match: (path) => path.startsWith("/search"),
    name: "Noodle search",
    slots: ["query", "results"],
    slotDoc: `${NOODLE_RULES}

This is Noodle's search results page. The query comes from the URL and must be preserved.
- query: one short line showing the exact searched phrase.
- results: 6-10 posts or accounts relevant to the query, each using the standard Noodle post markup or a profile link.
${NOODLE_POST_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Search / Noodle</title><style>${NOODLE_CSS}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>🍜</span> noodle</div><a href="https://noodle.social/">Home</a></header><form class="nd-compose" action="https://noodle.social/search" method="get" aria-label="search Noodle"><input name="q" placeholder="Search Noodle" aria-label="Search phrase"><button type="submit">Search</button></form><section class="nd-trends"><h2>Results for</h2><div class="nd-trend-name"><!-- SLOT: query --></div></section><main aria-label="Search results"><!-- SLOT: results --></main>${NOODLE_TABS}</div></body></html>`,
  },
  {
    id: "noodle/notifications",
    appId: "noodle",
    match: (path) => path.startsWith("/notifications"),
    name: "Noodle notifications",
    slots: ["notifications"],
    slotDoc: `${NOODLE_RULES}

This is the logged-in user's Noodle notifications page.
- notifications: 6-12 notification rows. Include follows, replies, mentions, slurps, and noodle reactions when they fit the scene. Do not write as the user's persona.` ,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notifications / Noodle</title><style>${NOODLE_CSS}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>🍜</span> noodle</div><a href="https://noodle.social/">Home</a></header><section class="nd-trends"><h2>Notifications</h2></section><main aria-label="Notifications"><!-- SLOT: notifications --></main>${NOODLE_TABS}</div></body></html>`,
  },
  {
    id: "noodle/messages",
    appId: "noodle",
    match: (path) => path.startsWith("/messages"),
    name: "Noodle messages",
    slots: ["conversations"],
    slotDoc: `${NOODLE_RULES}

This is Noodle direct messages.
- conversations: 4-8 conversation rows with a display name, handle, last message, and relative time. Use links to https://noodle.social/messages/<handle>. Keep private messages in character and never write the user's persona's outgoing words.` ,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Messages / Noodle</title><style>${NOODLE_CSS}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>🍜</span> noodle</div><a href="https://noodle.social/">Home</a></header><section class="nd-trends"><h2>Messages</h2></section><main aria-label="Direct messages"><!-- SLOT: conversations --></main>${NOODLE_TABS}</div></body></html>`,
  },
  {
    id: "noodler/profile",
    appId: "noodler",
    match: (path) => /^\/[^/]+\/?$/.test(path) && !/^\/(feed|discover|messages|subscriptions)\/?$/.test(path),
    name: "Noodler creator page",
    slots: ["identity", "tiers", "posts"],
    slotDoc: `${NOODLER_RULES}

This is one creator's Noodler page.

- identity: exactly this block, filled in:
    <h1>Display Name</h1>
    <p class="nr-handle">@handle · 312 posts · 48 media</p>
    <p class="nr-bio">One or two lines of bio in the creator's own voice.</p>
- tiers: 2-3 tiers, each exactly:
    <div class="nr-tier-card">
      <div class="nr-tier-name">Tier Name</div>
      <div class="nr-tier-price">$12<span>/mo</span></div>
      <div class="nr-tier-perks">What subscribers get, in the creator's voice.</div>
      <button type="button">Subscribe</button>
    </div>
- posts: 5-10 posts by THIS creator, mixing free and locked.
${NOODLER_POST_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creator / Noodler</title><style>${NOODLER_CSS}</style></head>
<body><div class="nr-app">
  <header class="nr-top"><div class="nr-wordmark"><span>🌶️</span> noodler</div><span class="nr-badge">18+</span></header>
  <div class="nr-banner"></div>
  <section class="nr-id"><!-- SLOT: identity --></section>
  <section class="nr-tiers" aria-label="Tiers"><!-- SLOT: tiers --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${NOODLER_TABS}
</div></body></html>`,
  },
  {
    id: "noodler/discover",
    appId: "noodler",
    match: (path) => path.startsWith("/discover"),
    name: "Noodler discover",
    slots: ["creators"],
    slotDoc: `${NOODLER_RULES}

This is Noodler's creator discovery page.
- creators: 6-10 creator cards with an adult creator name, handle, short pitch, subscription price, and a link to their profile. Keep discovery suggestive but not automatically explicit.` ,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Discover / Noodler</title><style>${NOODLER_CSS}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>🌶️</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Discover creators</h1><p class="nr-bio">Find creators worth subscribing to.</p></section><main aria-label="Creators"><!-- SLOT: creators --></main>${NOODLER_TABS}</div></body></html>`,
  },
  {
    id: "noodler/messages",
    appId: "noodler",
    match: (path) => path.startsWith("/messages"),
    name: "Noodler messages",
    slots: ["conversations"],
    slotDoc: `${NOODLER_RULES}

This is Noodler creator and subscriber messaging.
- conversations: 4-8 rows with adult creator names, handles, a teasing but non-graphic preview, and a relative time. Never write as the user's persona.` ,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Messages / Noodler</title><style>${NOODLER_CSS}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>🌶️</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Messages</h1></section><main aria-label="Messages"><!-- SLOT: conversations --></main>${NOODLER_TABS}</div></body></html>`,
  },
  {
    id: "noodler/subscriptions",
    appId: "noodler",
    match: (path) => path.startsWith("/subscriptions"),
    name: "Noodler subscriptions",
    slots: ["subscriptions"],
    slotDoc: `${NOODLER_RULES}

This is the user's Noodler subscriptions page.
- subscriptions: 4-8 creator subscription rows with tier name, price, renewal status, and one recent post teaser. Locked media stays locked.` ,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Subscriptions / Noodler</title><style>${NOODLER_CSS}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>🌶️</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Your subscriptions</h1></section><main aria-label="Subscriptions"><!-- SLOT: subscriptions --></main>${NOODLER_TABS}</div></body></html>`,
  },
  {
    id: "noodler/home",
    appId: "noodler",
    match: (path) => !/^\/(discover|messages|subscriptions)(?:\/|$)/i.test(path),
    name: "Noodler feed",
    slots: ["gate", "posts"],
    slotDoc: `${NOODLER_RULES}

This is the Noodler subscription feed behind its age gate.

- gate: one short in-universe sentence for the age-gate card, e.g.
    "Noodler hosts adult content and is intended for verified adults only."
- posts: 5-10 posts from creators this account subscribes to or is being pitched.
${NOODLER_POST_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodler</title><style>${NOODLER_CSS}</style></head>
<body><div class="nr-app">
  <header class="nr-top"><div class="nr-wordmark"><span>🌶️</span> noodler</div><span class="nr-badge">18+</span></header>
  <section class="nr-gate" aria-label="Age verification">
    <h2>Verified adults only</h2><p><!-- SLOT: gate --></p>
    <div class="nr-gate-actions">
      <a class="nr-yes" href="https://noodler.social/feed">I am 18 or older</a>
      <a class="nr-no" href="https://noodle.social/">Take me to Noodle</a>
    </div>
  </section>
  <main aria-label="Feed"><!-- SLOT: posts --></main>
${NOODLER_TABS}
</div></body></html>`,
  },
];

const FRAMEWORK_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #101116; color: #f3f4f6; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  a { color: #8ec5ff; text-decoration: none; }
  .vp-app { min-height: 100vh; padding-bottom: 58px; }
  .vp-top { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; background: #181a22; border-bottom: 1px solid #303442; }
  .vp-brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; }
  .vp-search { display: flex; gap: 8px; padding: 12px 16px; background: #14161d; border-bottom: 1px solid #292d38; }
  .vp-search input { min-width: 0; flex: 1; padding: 9px 11px; border: 1px solid #3a3f4e; border-radius: 8px; background: #0f1117; color: inherit; }
  .vp-search button, .vp-action { padding: 9px 12px; border: 0; border-radius: 8px; background: #8ec5ff; color: #101116; font-weight: 700; }
  .vp-section { padding: 14px 16px; border-bottom: 1px solid #292d38; }
  .vp-section h2 { margin: 0 0 9px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #aeb5c5; }
  .vp-items { display: grid; gap: 9px; }
  .vp-item { display: block; padding: 12px; border: 1px solid #303442; border-radius: 10px; background: #191c25; }
  .vp-item strong { display: block; color: #f3f4f6; }
  .vp-item small { display: block; margin-top: 4px; color: #aeb5c5; }
  .vp-detail { display: grid; gap: 10px; color: #d8dce6; }
  .vp-tabs { position: fixed; right: 0; bottom: 0; left: 0; display: flex; justify-content: space-around; padding: 9px 0 11px; background: #181a22; border-top: 1px solid #303442; }
  .vp-tabs a { font-size: 11px; color: #aeb5c5; }
  .vp-tabs a.active { color: #8ec5ff; font-weight: 700; }
`;

const FRAMEWORK_DOC = `
The page shell is fixed and already includes its header, controls, section labels, item cards, and bottom navigation.
Fill only the documented slots with content. Use absolute links on the app's own domain.
- summary: one short app-specific summary or status line.
- items: 5-10 complete item cards. Each card must be an <a class="vp-item" href="..."><strong>Title</strong><small>Useful detail</small></a>.
- action: one short label for the primary action, or an empty string when no action fits.
- detail: the body of one selected item, with 2-4 paragraphs or short rows.
`;

const FRAMEWORK_ROUTE_DOC = {
  home: "Show the app's primary home/feed view with current, recommended, or recent content.",
  search: "Show results for the submitted search query. Preserve the query in the result titles and links.",
  detail: "Show one selected item, profile, conversation, product, event, or location in detail.",
  settings: "Show practical account/app settings as compact rows. Do not invent dangerous account actions.",
} as const;

function frameworkTemplate(app: PhoneApp, route: keyof typeof FRAMEWORK_ROUTE_DOC): PhoneTemplate {
  const routePath = route === "home" ? "/" : `/${route}`;
  const pathLabel = route === "home" ? "Home" : route[0].toUpperCase() + route.slice(1);
  const slotNames = route === "detail" ? ["summary", "detail", "action"] : route === "settings" ? ["summary", "items"] : ["summary", "items", "action"];
  const detailSlot = route === "detail" ? '<section class="vp-section"><h2>Details</h2><div class="vp-detail"><!-- SLOT: detail --></div></section>' : "";
  return {
    id: `${app.id}/${route}`,
    appId: app.id,
    match: (path) => route === "home"
      ? !/^\/(search|detail|settings|discover|saved|profile|item|product|event|thread)(?:\/|$)/i.test(path)
      : route === "search" ? path.startsWith("/search")
        : route === "settings" ? path.startsWith("/settings")
          : /\/(detail|profile|item|product|event|thread)\b/i.test(path) || /^\/[^/]+$/.test(path),
    name: `${app.name} ${pathLabel}`,
    slots: slotNames,
    slotDoc: `${app.description}\n\nContent brief: ${app.contentGuidance || app.description}\nStore category: ${app.storeCategory || "reference"}\n\n${FRAMEWORK_ROUTE_DOC[route]}\n\n${FRAMEWORK_DOC}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${app.name} ${pathLabel}</title><style>${FRAMEWORK_CSS}</style></head><body><div class="vp-app"><header class="vp-top"><div class="vp-brand"><span>${app.icon}</span>${app.name}</div><a href="https://${app.domain}${routePath}">${pathLabel}</a></header>${route === "search" ? `<form class="vp-search" action="https://${app.domain}/search" method="get" aria-label="Search ${app.name}"><input name="q" placeholder="Search ${app.name}" aria-label="Search"><button type="submit">Go</button></form>` : ""}<section class="vp-section"><h2>${route === "search" ? "Results" : route === "detail" ? "Overview" : route === "settings" ? "Account" : "Now"}</h2><div class="vp-item"><span><!-- SLOT: summary --></span></div></section>${detailSlot}${route !== "detail" ? `<main class="vp-section"><h2>${route === "settings" ? "Preferences" : route === "search" ? "Matches" : "For you"}</h2><div class="vp-items"><!-- SLOT: items --></div></main>` : ""}${route !== "settings" ? `<section class="vp-section"><!-- SLOT: action --></section>` : ""}<nav class="vp-tabs" aria-label="${app.name}"><a class="${route === "home" ? "active" : ""}" href="https://${app.domain}/">Home</a><a class="${route === "search" ? "active" : ""}" href="https://${app.domain}/search">Search</a><a class="${route === "detail" ? "active" : ""}" href="https://${app.domain}/discover">Discover</a><a class="${route === "settings" ? "active" : ""}" href="https://${app.domain}/settings">Settings</a></nav></div></body></html>`,
  };
}

const FRAMEWORK_TEMPLATES = PHONE_APPS
  .filter((app) => app.framework && app.id !== "noodle" && app.id !== "noodler")
  .flatMap((app) => (Object.keys(FRAMEWORK_ROUTE_DOC) as Array<keyof typeof FRAMEWORK_ROUTE_DOC>).map((route) => frameworkTemplate(app, route)));

export const PHONE_TEMPLATES: readonly PhoneTemplate[] = [...SPECIAL_PHONE_TEMPLATES, ...FRAMEWORK_TEMPLATES];

/** First template whose app matches and whose path predicate accepts. */
export function findTemplate(appId: string, url: string): PhoneTemplate | null {
  let path = "/";
  try {
    path = new URL(url, "https://phone.local").pathname || "/";
  } catch {
    path = "/";
  }
  return PHONE_TEMPLATES.find((template) => template.appId === appId && template.match(path)) ?? null;
}

/**
 * Replace `<!-- SLOT: name -->` markers with generated HTML. Unfilled slots
 * collapse to empty so a partial model response still renders a usable page.
 */
export function fillSlots(html: string, values: Record<string, unknown>): string {
  return html.replace(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g, (_match, name: string) => {
    const value = values[name];
    return typeof value === "string" ? value : "";
  });
}

export function extractSlots(html: string): string[] {
  return [...html.matchAll(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g)].map((match) => match[1]);
}
