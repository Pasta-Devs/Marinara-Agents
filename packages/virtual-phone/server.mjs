import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var c=[{id:"noodle",name:"Noodle",icon:"\u{1F35C}",domain:"noodle.social",description:"The public feed everyone in the story argues on.",preinstalled:!0},{id:"noodler",name:"Noodler",icon:"\u{1F336}\uFE0F",domain:"noodler.social",description:"Noodle's age-gated creator platform. Subscriptions, tips, locked posts.",adult:!0},{id:"search",name:"Search",icon:"\u{1F50D}",domain:"search.web",description:"Look anything up in the story world.",preinstalled:!0},{id:"maps",name:"Maps",icon:"\u{1F5FA}\uFE0F",domain:"maps.web",description:"Where things are, and how far.",preinstalled:!0},{id:"messages",name:"Messages",icon:"\u{1F4AC}",domain:"messages.phone",description:"Texts with characters in the scene.",preinstalled:!0},{id:"gallery",name:"Gallery",icon:"\u{1F5BC}\uFE0F",domain:"gallery.phone",description:"Photos the persona has taken.",preinstalled:!0},{id:"notes",name:"Notes",icon:"\u{1F4DD}",domain:"notes.phone",description:"Scraps, lists, and things worth remembering."},{id:"wallet",name:"Wallet",icon:"\u{1F4B3}",domain:"wallet.phone",description:"Balance, recent charges, and regrettable purchases."},{id:"news",name:"News",icon:"\u{1F4F0}",domain:"news.web",description:"What the world thinks is happening."},{id:"video",name:"Video",icon:"\u25B6\uFE0F",domain:"video.web",description:"Clips, channels, and comment sections."},{id:"music",name:"Music",icon:"\u{1F3B5}",domain:"music.web",description:"Playlists that say too much about the listener."},{id:"forum",name:"Forum",icon:"\u{1F5E3}\uFE0F",domain:"forum.web",description:"Threaded posts from people with strong opinions."},{id:"shop",name:"Shop",icon:"\u{1F4E6}",domain:"shop.web",description:"Listings, reviews, and next-day delivery."},{id:"weather",name:"Weather",icon:"\u{1F326}\uFE0F",domain:"weather.phone",description:"Forecast for wherever the scene is set."}],ne=new Map(c.map(e=>[e.id,e]));function R(e){return ne.get(e)??null}function $(e){let t;try{t=new URL(e,"https://phone.local").hostname.toLowerCase()}catch{return null}return c.find(n=>t===n.domain||t.endsWith(`.${n.domain}`))??null}function O(){return c.filter(e=>e.preinstalled).map(e=>e.id)}function I(e){return c.filter(t=>e||!t.adult)}var x=null,z=0;function y(){if(!x)throw new Error("Virtual Phone package runtime is not configured");return x}function L(e){let t=++z;return x=e,()=>{z===t&&(x=null)}}async function E(e,t){let n=y();if(!n.languageModels)throw new Error("This Marinara build does not expose a language-model host to packages.");return n.languageModels.resolveForRequest({connectionId:e,chatConnectionId:t})}var M=["You are writing a page as it appears on a character's phone inside a story. Never break that frame.","Never state or imply that the page, the app, or the wider internet is simulated or AI-generated.","Write as an author inside the story world, not as an assistant.","The screen is 390px wide in portrait. Single column, large tap targets, no side rails, no multi-column dashboards.","Every link must carry a plausible absolute URL on the app's own domain. Never use href='#'."];function oe(e){return e.filter(t=>t&&typeof t.content=="string").map(t=>`${t.role||"user"}: ${t.content}`).join(`
`)}function D(e){let t=[];return e.characters?.length&&t.push(`Characters in the scene: ${e.characters.join(", ")}`),e.persona&&t.push(`The phone belongs to: ${e.persona}`),e.chatSummary&&t.push(`Scene: ${e.chatSummary}`),e.worldInfo&&t.push(`World info: ${e.worldInfo}`),e.recentMessages?.length&&t.push(`Recent chat:
${oe(e.recentMessages)}`),e.pageHistory&&t.push(`Previous visit to this page: ${e.pageHistory}. Keep names and facts consistent.`),e.navHistory?.length&&t.push(`Navigation path: ${e.navHistory.map(n=>`${n.title||n.url}`).join(" \u2192 ")}`),e.lastAction&&t.push(`Exact user action: ${e.lastAction}`),e.formData&&Object.keys(e.formData).length&&t.push(`Submitted form data: ${JSON.stringify(e.formData)}`),t}var H="observerText must briefly describe what is visible and name the exact link, control, or submitted text the user acted on. Describe the screen, not internal thoughts.";function j(e,t,n){return[{role:"system",content:[`Fill the content slots of the ${e.name} app on a character's phone.`,`App: ${e.name} (${e.domain}) \u2014 URL: ${n.url}`,`Slots to fill: ${t.slots.join(", ")}`,"",t.slotDoc,"",...M,"Do not recreate app chrome, headers, or navigation inside a slot. The template owns all stable structure; supply only the documented content.","Populate every requested slot with complete, realistic content, not placeholders.",H,...D(n),"",'Return only JSON: {"slots":{"slotName":"<HTML string>"},"title":"...","observerText":"...","observerName":"..."}'].join(`
`)},{role:"user",content:`Fill the slots for ${n.url}.`}]}function _(e,t){return[{role:"system",content:[`Generate the ${e.name} app screen at ${t.url} as it appears on a character's phone.`,`App purpose: ${e.description}`,"Return one complete HTML document with semantic markup and all CSS in a <style> element.","Design it like a real, polished native app screen: a sticky top bar, a bottom tab bar with 3-5 tabs, cards or list rows with real spacing, and a dark theme that suits the app.","It must never look like bare unstyled HTML.",...M,H,...D(t),"",'Return only JSON: {"html":"<full document>","title":"...","observerText":"...","observerName":"..."}'].join(`
`)},{role:"user",content:`Render ${t.url} as a polished phone screen.`}]}function F(e){if(typeof e!="string")return null;let t=e.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");try{let a=JSON.parse(t);if(a&&typeof a=="object")return a}catch{}let n=t.indexOf("{"),o=t.lastIndexOf("}");if(n<0||o<=n)return null;try{let a=JSON.parse(t.slice(n,o+1));return a&&typeof a=="object"?a:null}catch{return null}}var U=`
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
`,V=`
    <nav class="nd-tabs" aria-label="Noodle">
      <a class="on" href="https://noodle.social/"><em>\u{1F3E0}</em>Home</a>
      <a href="https://noodle.social/search"><em>\u{1F50D}</em>Search</a>
      <a href="https://noodle.social/notifications"><em>\u{1F514}</em>Alerts</a>
      <a href="https://noodle.social/messages"><em>\u2709\uFE0F</em>DMs</a>
    </nav>`,q=`Each post is exactly this markup, with your content substituted:
<article class="nd-post">
  <div class="nd-avatar">\u{1F642}</div>
  <div class="nd-main">
    <div class="nd-head">
      <a class="nd-name" href="https://noodle.social/@handle">Display Name</a>
      <span class="nd-handle">@handle \xB7 2h</span>
    </div>
    <div class="nd-body">The post text. May use @mentions and #hashtags.</div>
    <div class="nd-actions"><span>\u{1F4AC} 29</span><span>\u{1F35C} 47</span><span>\u2764\uFE0F 318</span><span>\u2197</span></div>
  </div>
</article>
The avatar div holds one emoji that suits the poster. Reposts are called "slurps" (\u{1F35C}).`,B=`Noodle is the story world's public social network. Never mention Twitter, X, or any
real platform \u2014 in this world Noodle is simply what exists.
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
- Keep Noodle itself non-explicit. Adult content belongs on Noodler.`,W=`
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
  .nr-post[data-lock=true]::after { content: "\u{1F512} Subscribe to unlock"; position: absolute; left: 50%; top: 62%;
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
`,G=`
    <nav class="nr-tabs" aria-label="Noodler">
      <a class="on" href="https://noodler.social/feed"><em>\u{1F3E0}</em>Feed</a>
      <a href="https://noodler.social/discover"><em>\u{1F50D}</em>Discover</a>
      <a href="https://noodler.social/messages"><em>\u2709\uFE0F</em>DMs</a>
      <a href="https://noodler.social/subscriptions"><em>\u{1F4B3}</em>Subs</a>
    </nav>`,J=`Each post is exactly this markup, with your content substituted:
<article class="nr-post" data-lock="false">
  <div class="nr-head">
    <div class="nr-avatar">\u{1F642}</div>
    <div class="nr-who"><span class="nr-name">Display Name</span><span class="nr-handle">@handle \xB7 3h</span></div>
    <span class="nr-tier">Sweet Tier</span>
  </div>
  <div class="nr-body">The caption.</div>
  <div class="nr-media"></div>
  <div class="nr-actions"><span>\u2764\uFE0F 1.2K</span><span>\u{1F4AC} 88</span><span>\u{1F4B8} Tip</span></div>
</article>
Set data-lock="true" for a paywalled post: it blurs the media and overlays a subscribe prompt.
A locked post's caption is a teaser line only, never the full content. Omit the nr-media div
for text-only posts. The avatar div holds one emoji suiting the creator.`,K=`Noodler is the story world's age-gated creator platform, the adult sibling of Noodle.
Never mention OnlyFans, Fansly, or any real platform \u2014 in this world Noodler is what exists.
- Match the content level this chat has already established. If the scene is not explicit,
  keep captions suggestive and teasing rather than graphic. Never escalate past the story.
- Every creator on Noodler is an adult.
- Locked posts are the norm. Mix a couple of free posts in with the paywalled ones.
- Never write posts as the user's persona.
- Creators are characters first. Voice, pricing, and posting rhythm follow their personality
  and in-world standing, not one generic flirty tone.
- Pricing and follower counts should reflect standing, not be uniformly large.`,w=[{id:"noodle/profile",appId:"noodle",match:e=>e.startsWith("/@")||e.startsWith("/profile"),name:"Noodle profile",slots:["identity","posts"],slotDoc:`${B}

This is one account's Noodle profile. Keep the bio, counts, and posts consistent with
anything already established about this character.

- identity: exactly this block, filled in:
    <h1>Display Name</h1>
    <p class="nd-handle">@handle</p>
    <p class="nd-bio">One or two lines of bio in the character's own voice.</p>
    <p class="nd-counts"><b>412</b> following \xB7 <b>1,203</b> followers</p>
- posts: 5-10 posts, all authored by THIS account, newest first.
${q}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile / Noodle</title><style>${U}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/">Home</a></header>
  <div class="nd-banner"></div>
  <section class="nd-id"><!-- SLOT: identity --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${V}
</div></body></html>`},{id:"noodle/feed",appId:"noodle",match:()=>!0,name:"Noodle feed",slots:["trending","posts"],slotDoc:`${B}

This is the Noodle home timeline.

- trending: 3-5 topics, each exactly:
    <a class="nd-trend" href="https://noodle.social/search?q=Topic">
      <span class="nd-trend-name">#TopicName</span><span class="nd-trend-count">1,204 posts</span>
    </a>
- posts: 6-12 posts from different accounts, newest first.
${q}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodle</title><style>${U}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/settings">Settings</a></header>
  <form class="nd-compose" action="https://noodle.social/compose" method="get" aria-label="new post">
    <input name="text" placeholder="What's cooking?" aria-label="Post text"><button type="submit">Post</button>
  </form>
  <section class="nd-trends" aria-label="Trending"><h2>Trending now</h2><!-- SLOT: trending --></section>
  <main aria-label="Timeline"><!-- SLOT: posts --></main>
${V}
</div></body></html>`},{id:"noodler/profile",appId:"noodler",match:e=>/^\/[^/]+\/?$/.test(e)&&!/^\/(feed|discover|messages|subscriptions)\/?$/.test(e),name:"Noodler creator page",slots:["identity","tiers","posts"],slotDoc:`${K}

This is one creator's Noodler page.

- identity: exactly this block, filled in:
    <h1>Display Name</h1>
    <p class="nr-handle">@handle \xB7 312 posts \xB7 48 media</p>
    <p class="nr-bio">One or two lines of bio in the creator's own voice.</p>
- tiers: 2-3 tiers, each exactly:
    <div class="nr-tier-card">
      <div class="nr-tier-name">Tier Name</div>
      <div class="nr-tier-price">$12<span>/mo</span></div>
      <div class="nr-tier-perks">What subscribers get, in the creator's voice.</div>
      <button type="button">Subscribe</button>
    </div>
- posts: 5-10 posts by THIS creator, mixing free and locked.
${J}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creator / Noodler</title><style>${W}</style></head>
<body><div class="nr-app">
  <header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header>
  <div class="nr-banner"></div>
  <section class="nr-id"><!-- SLOT: identity --></section>
  <section class="nr-tiers" aria-label="Tiers"><!-- SLOT: tiers --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${G}
</div></body></html>`},{id:"noodler/home",appId:"noodler",match:()=>!0,name:"Noodler feed",slots:["gate","posts"],slotDoc:`${K}

This is the Noodler subscription feed behind its age gate.

- gate: one short in-universe sentence for the age-gate card, e.g.
    "Noodler hosts adult content and is intended for verified adults only."
- posts: 5-10 posts from creators this account subscribes to or is being pitched.
${J}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodler</title><style>${W}</style></head>
<body><div class="nr-app">
  <header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header>
  <section class="nr-gate" aria-label="Age verification">
    <h2>Verified adults only</h2><p><!-- SLOT: gate --></p>
    <div class="nr-gate-actions">
      <a class="nr-yes" href="https://noodler.social/feed">I am 18 or older</a>
      <a class="nr-no" href="https://noodle.social/">Take me to Noodle</a>
    </div>
  </section>
  <main aria-label="Feed"><!-- SLOT: posts --></main>
${G}
</div></body></html>`}];function X(e,t){let n="/";try{n=new URL(t,"https://phone.local").pathname||"/"}catch{n="/"}return w.find(o=>o.appId===e&&o.match(n))??null}function Y(e,t){return e.replace(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g,(n,o)=>{let a=t[o];return typeof a=="string"?a:""})}function Q(e){return[...e.matchAll(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g)].map(t=>t[1])}var se=300*1e3,ae=120,re=12,h=new Map;function ie(e,t){return`${e}\0${t}`}function le(e){let t=h.get(e);return t?Date.now()-t.timestamp>se?(h.delete(e),null):t.value:null}function de(e,t){for(h.set(e,{timestamp:Date.now(),value:t});h.size>ae;){let n=h.keys().next();if(n.done)break;h.delete(n.value)}}function Z(){h.clear()}function r(e,t=""){return typeof e=="string"?e.trim():t}function d(e){return e&&typeof e=="object"&&!Array.isArray(e)?e:{}}function pe(e,t){let n=e.trim();return/^<!doctype html/i.test(n)||/^<html[\s>]/i.test(n)?n:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${ce(t)}</title></head><body>${n}</body></html>`}function ce(e){return e.replace(/[&<>"']/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":t===">"?"&gt;":t==='"'?"&quot;":"&#39;")}async function he(e,t){let n=y(),o=r(e.chatId),a=d(e.context),m={url:t,chatSummary:r(a.chatSummary)||void 0,worldInfo:r(a.worldInfo)||void 0,persona:r(a.persona)||void 0,lastAction:r(e.lastAction)||void 0,formData:Object.keys(d(e.formData)).length?d(e.formData):void 0,pageHistory:r(e.pageHistory)||void 0,allowAdult:e.allowAdult===!0},u=Array.isArray(a.recentMessages)?a.recentMessages:[];u.length&&(m.recentMessages=u.slice(-re).map(s=>d(s)).filter(s=>typeof s.content=="string").map(s=>({role:r(s.role,"user"),content:String(s.content)})));let l=Array.isArray(e.navHistory)?e.navHistory:[];if(l.length&&(m.navHistory=l.map(s=>d(s)).filter(s=>typeof s.url=="string").slice(-3).map(s=>({url:String(s.url),title:r(s.title)}))),o&&n.persistence?.getChat&&n.resources?.listCharacters)try{let s=await n.persistence.getChat(o);if(s?.characterIds?.length){let f=(await n.resources.listCharacters(s.characterIds)).map(p=>d(p.data).name).filter(p=>typeof p=="string"&&p.length>0);f.length&&(m.characters=f)}}catch(s){n.logger.warn("Virtual Phone could not read chat characters: %s",s instanceof Error?s.message:String(s))}return m}function ee(){return async e=>{e.get("/apps",async t=>{let n=d(t.query),o=n.allowAdult==="true"||n.allowAdult===!0;return{apps:I(o),defaults:O()}}),e.post("/page",async(t,n)=>{let o=d(t.body),a=y(),m=r(o.appId),u=r(o.url),l=R(m)??(u?$(u):null);if(!l)return n.code(400).send({error:"Unknown phone app."});if(l.adult&&o.allowAdult!==!0)return n.code(403).send({error:`${l.name} needs adult content enabled for this chat.`});let s=u||`https://${l.domain}/`,P=r(o.chatId),f=ie(P,s);if(o.refresh!==!0){let i=le(f);if(i)return{...i,fromCache:!0}}let p=r(o.connectionId)||null,S=r(o.chatConnectionId)||null;if(!p&&!S)return n.code(400).send({error:"The phone needs an active language-model connection."});let v;try{v=await E(p,S)}catch(i){return n.code(400).send({error:i instanceof Error?i.message:"Could not resolve a language-model connection."})}let A=await he(o,s),b=X(l.id,s),te=b?j(l,b,A):_(l,A),T=null;try{let i=v.fitContext(te);T=(await v.chatComplete(i.messages,{temperature:.9,maxTokens:i.maxTokens,responseFormat:{type:"json_object"}})).content}catch(i){return a.logger.error(i,"Virtual Phone page generation failed"),n.code(502).send({error:"The model could not render that screen."})}let g=F(T);if(!g)return n.code(502).send({error:"The model returned no usable page."});let N=r(g.title)||l.name,k;if(b){let i=d(g.slots);k=Y(b.html,i)}else{let i=r(g.html);if(!i)return n.code(502).send({error:"The model returned no page HTML."});k=pe(i,N)}let C={html:k,title:N,observerText:r(g.observerText),observerName:r(g.observerName)||l.name,appId:l.id,url:s};return de(f,C),C})}}async function me({api:e,dataDir:t}){let n=L({...e.runtime,dataDir:t});try{let o=await e.registerPrivilegedRoutes(ee(),{prefix:"/api/virtual-phone"});return async()=>{o(),Z(),n()}}catch(o){throw n(),o}}async function ue(){let e=new Set(c.map(t=>t.id));for(let t of w){if(!e.has(t.appId))throw new Error(`Virtual Phone template ${t.id} targets unknown app ${t.appId}`);let n=Q(t.html).sort(),o=[...t.slots].sort();if(n.join(",")!==o.join(","))throw new Error(`Virtual Phone template ${t.id} declares slots [${o}] but its markup has [${n}]`)}return{ok:!0,apps:c.length,templates:w.length}}export{me as activate,ue as selfCheck};
