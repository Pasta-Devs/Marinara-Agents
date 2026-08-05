import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var m=[{id:"noodle",name:"Noodle",icon:"\u{1F35C}",domain:"noodle.social",description:"The public feed everyone in the story argues on.",preinstalled:!0,storeCategory:"social",contentGuidance:"A public social feed with posts, replies, profiles, reactions, trends, notifications, and direct messages."},{id:"noodler",name:"Noodler",icon:"\u{1F336}\uFE0F",domain:"noodler.social",description:"Noodle's age-gated creator platform. Subscriptions, tips, locked posts.",adult:!0,storeCategory:"social",contentGuidance:"An age-gated creator platform with adult creators, subscriptions, tips, locked media, discovery, and private messages. Respect the established content level."},{id:"search",name:"Search",icon:"\u{1F50D}",domain:"search.web",description:"Look anything up in the story world.",preinstalled:!0,framework:"utility",storeCategory:"reference",contentGuidance:"A story-world search engine with query results, snippets, related searches, and useful links."},{id:"maps",name:"Maps",icon:"\u{1F5FA}\uFE0F",domain:"maps.web",description:"Where things are, and how far.",preinstalled:!0,framework:"utility",storeCategory:"reference",contentGuidance:"A map and place browser with locations, routes, distances, addresses, and local details."},{id:"messages",name:"Messages",icon:"\u{1F4AC}",domain:"messages.phone",description:"Texts with characters in the scene.",preinstalled:!0,framework:"social",storeCategory:"social",contentGuidance:"A private messaging app with conversation rows, message threads, unread counts, and believable short previews."},{id:"gallery",name:"Gallery",icon:"\u{1F5BC}\uFE0F",domain:"gallery.phone",description:"Photos the persona has taken.",preinstalled:!0,framework:"media",storeCategory:"entertainment",contentGuidance:"A personal photo library with albums, captions, dates, people, and image descriptions."},{id:"notes",name:"Notes",icon:"\u{1F4DD}",domain:"notes.phone",description:"Scraps, lists, and things worth remembering.",framework:"utility",storeCategory:"productivity",contentGuidance:"A private notes app with titles, snippets, tags, dates, and detail pages."},{id:"wallet",name:"Wallet",icon:"\u{1F4B3}",domain:"wallet.phone",description:"Balance, recent charges, and regrettable purchases.",framework:"commerce",storeCategory:"finance",contentGuidance:"A private wallet with balance, recent transactions, payment cards, and cautious financial language."},{id:"news",name:"News",icon:"\u{1F4F0}",domain:"news.web",description:"What the world thinks is happening.",framework:"community",storeCategory:"reference",contentGuidance:"A news reader with headlines, sections, article summaries, timestamps, and source names."},{id:"video",name:"Video",icon:"\u25B6\uFE0F",domain:"video.web",description:"Clips, channels, and comment sections.",framework:"media",storeCategory:"entertainment",contentGuidance:"A video platform with channels, clips, thumbnails described in text, views, comments, and watch history."},{id:"music",name:"Music",icon:"\u{1F3B5}",domain:"music.web",description:"Playlists that say too much about the listener.",framework:"media",storeCategory:"entertainment",contentGuidance:"A music player with tracks, albums, artists, playlists, queue state, and listening history."},{id:"forum",name:"Forum",icon:"\u{1F5E3}\uFE0F",domain:"forum.web",description:"Threaded posts from people with strong opinions.",framework:"community",storeCategory:"social",contentGuidance:"A threaded community forum with boards, posts, replies, votes, usernames, and moderation context."},{id:"shop",name:"Shop",icon:"\u{1F4E6}",domain:"shop.web",description:"Listings, reviews, and next-day delivery.",framework:"commerce",storeCategory:"shopping",contentGuidance:"A shopping site with product listings, prices, sellers, ratings, availability, cart, and order details."},{id:"weather",name:"Weather",icon:"\u{1F326}\uFE0F",domain:"weather.phone",description:"Forecast for wherever the scene is set.",framework:"utility",storeCategory:"reference",contentGuidance:"A weather app with current conditions, hourly forecast, daily forecast, alerts, and location context."},{id:"calendar",name:"Calendar",icon:"\u{1F4C5}",domain:"calendar.phone",description:"Plans, appointments, and suspiciously vague reminders.",framework:"utility",storeCategory:"productivity",contentGuidance:"A calendar with events, dates, times, locations, attendees, reminders, and schedule conflicts."},{id:"mail",name:"Mail",icon:"\u2709\uFE0F",domain:"mail.phone",description:"Inbox messages from people and places in the story.",framework:"social",storeCategory:"productivity",contentGuidance:"An inbox with senders, subjects, unread state, timestamps, short previews, and message detail pages."},{id:"recipes",name:"Recipes",icon:"\u{1F373}",domain:"recipes.web",description:"Recipes, ratings, and arguments about substitutions.",framework:"community",storeCategory:"reference",contentGuidance:"A recipe community with recipes, ingredients, steps, cook time, ratings, substitutions, and comments."}],ce=new Map(m.map(e=>[e.id,e]));function D(e){return ce.get(e)??null}function z(e){let t;try{t=new URL(e,"https://phone.local").hostname.toLowerCase()}catch{return null}return m.find(n=>t===n.domain||t.endsWith(`.${n.domain}`))??null}function H(){return m.filter(e=>e.preinstalled).map(e=>e.id)}function _(){return m}var S=null,j=0;function b(){if(!S)throw new Error("Virtual Phone package runtime is not configured");return S}function F(e){let t=++j;return S=e,()=>{j===t&&(S=null)}}async function G(e,t){let n=b();if(!n.languageModels)throw new Error("This Marinara build does not expose a language-model host to packages.");return n.languageModels.resolveForRequest({connectionId:e,chatConnectionId:t})}var W=["You are writing a page as it appears on a character's phone inside a story. Never break that frame.","Never state or imply that the page, the app, or the wider internet is simulated or AI-generated.","Write as an author inside the story world, not as an assistant.","The screen is 390px wide in portrait. Single column, large tap targets, no side rails, no multi-column dashboards.","Every link must carry a plausible absolute URL on the app's own domain. Never use href='#'."];function pe(e){return e.filter(t=>t&&typeof t.content=="string").map(t=>`${t.role||"user"}: ${t.content}`).join(`
`)}function U(e){let t=[];return e.phoneOwner&&t.push(`Phone owner: ${e.phoneOwner.kind} ${e.phoneOwner.name||e.phoneOwner.id}`),e.personaId&&t.push(`Phone persona identity: ${e.personaId}`),e.characterIds?.length&&t.push(`Phone character identities: ${e.characterIds.join(", ")}`),e.characters?.length&&t.push(`Characters in the scene: ${e.characters.join(", ")}`),e.persona&&t.push(`The phone belongs to: ${e.persona}`),e.chatSummary&&t.push(`Scene: ${e.chatSummary}`),e.worldInfo&&t.push(`World info: ${e.worldInfo}`),e.recentMessages?.length&&t.push(`Recent chat:
${pe(e.recentMessages)}`),e.pageHistory&&t.push(`Previous visit to this page: ${e.pageHistory}. Keep names and facts consistent.`),e.navHistory?.length&&t.push(`Navigation path: ${e.navHistory.map(n=>`${n.title||n.url}`).join(" \u2192 ")}`),e.lastAction&&t.push(`Exact user action: ${e.lastAction}`),e.formData&&Object.keys(e.formData).length&&t.push(`Submitted form data: ${JSON.stringify(e.formData)}`),t}var q="observerText must briefly describe what is visible and name the exact link, control, or submitted text the user acted on. Describe the screen, not internal thoughts.";function K(e,t,n){return[{role:"system",content:[`Fill the content slots of the ${e.name} app on a character's phone.`,`App: ${e.name} (${e.domain}) \u2014 URL: ${n.url}`,`App content brief: ${e.contentGuidance||e.description}`,`App category: ${e.storeCategory||"reference"}`,`Slots to fill: ${t.slots.join(", ")}`,"",t.slotDoc,"",...W,"Do not recreate app chrome, headers, or navigation inside a slot. The template owns all stable structure; supply only the documented content.","Populate every requested slot with complete, realistic content, not placeholders.",q,...U(n),"",'Return only JSON: {"slots":{"slotName":"<HTML string>"},"title":"...","observerText":"...","observerName":"..."}'].join(`
`)},{role:"user",content:`Fill the slots for ${n.url}.`}]}function V(e,t){return[{role:"system",content:[`Generate the ${e.name} app screen at ${t.url} as it appears on a character's phone.`,`App purpose: ${e.description}`,"Return one complete HTML document with semantic markup and all CSS in a <style> element.","Design it like a real, polished native app screen: a sticky top bar, a bottom tab bar with 3-5 tabs, cards or list rows with real spacing, and a dark theme that suits the app.","It must never look like bare unstyled HTML.",...W,q,...U(t),"",'Return only JSON: {"html":"<full document>","title":"...","observerText":"...","observerName":"..."}'].join(`
`)},{role:"user",content:`Render ${t.url} as a polished phone screen.`}]}function B(e){if(typeof e!="string")return null;let t=e.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");try{let r=JSON.parse(t);if(r&&typeof r=="object")return r}catch{}let n=t.indexOf("{"),s=t.lastIndexOf("}");if(n<0||s<=n)return null;try{let r=JSON.parse(t.slice(n,s+1));return r&&typeof r=="object"?r:null}catch{return null}}var y=`
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
`,w=`
    <nav class="nd-tabs" aria-label="Noodle">
      <a class="on" href="https://noodle.social/"><em>\u{1F3E0}</em>Home</a>
      <a href="https://noodle.social/search"><em>\u{1F50D}</em>Search</a>
      <a href="https://noodle.social/notifications"><em>\u{1F514}</em>Alerts</a>
      <a href="https://noodle.social/messages"><em>\u2709\uFE0F</em>DMs</a>
    </nav>`,C=`Each post is exactly this markup, with your content substituted:
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
The avatar div holds one emoji that suits the poster. Reposts are called "slurps" (\u{1F35C}).`,v=`Noodle is the story world's public social network. Never mention Twitter, X, or any
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
- Keep Noodle itself non-explicit. Adult content belongs on Noodler.`,x=`
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
`,k=`
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
for text-only posts. The avatar div holds one emoji suiting the creator.`,P=`Noodler is the story world's age-gated creator platform, the adult sibling of Noodle.
Never mention OnlyFans, Fansly, or any real platform \u2014 in this world Noodler is what exists.
- Match the content level this chat has already established. If the scene is not explicit,
  keep captions suggestive and teasing rather than graphic. Never escalate past the story.
- Every creator on Noodler is an adult.
- Locked posts are the norm. Mix a couple of free posts in with the paywalled ones.
- Never write posts as the user's persona.
- Creators are characters first. Voice, pricing, and posting rhythm follow their personality
  and in-world standing, not one generic flirty tone.
- Pricing and follower counts should reflect standing, not be uniformly large.`,he=[{id:"noodle/profile",appId:"noodle",match:e=>e.startsWith("/@")||e.startsWith("/profile"),name:"Noodle profile",slots:["identity","posts"],slotDoc:`${v}

This is one account's Noodle profile. Keep the bio, counts, and posts consistent with
anything already established about this character.

- identity: exactly this block, filled in:
    <h1>Display Name</h1>
    <p class="nd-handle">@handle</p>
    <p class="nd-bio">One or two lines of bio in the character's own voice.</p>
    <p class="nd-counts"><b>412</b> following \xB7 <b>1,203</b> followers</p>
- posts: 5-10 posts, all authored by THIS account, newest first.
${C}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile / Noodle</title><style>${y}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/">Home</a></header>
  <div class="nd-banner"></div>
  <section class="nd-id"><!-- SLOT: identity --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${w}
</div></body></html>`},{id:"noodle/feed",appId:"noodle",match:e=>!/^\/(search|notifications|messages)(?:\/|$)/i.test(e),name:"Noodle feed",slots:["trending","posts"],slotDoc:`${v}

This is the Noodle home timeline.

- trending: 3-5 topics, each exactly:
    <a class="nd-trend" href="https://noodle.social/search?q=Topic">
      <span class="nd-trend-name">#TopicName</span><span class="nd-trend-count">1,204 posts</span>
    </a>
- posts: 6-12 posts from different accounts, newest first.
${C}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodle</title><style>${y}</style></head>
<body><div class="nd-app">
  <header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/settings">Settings</a></header>
  <form class="nd-compose" action="https://noodle.social/compose" method="get" aria-label="new post">
    <input name="text" placeholder="What's cooking?" aria-label="Post text"><button type="submit">Post</button>
  </form>
  <section class="nd-trends" aria-label="Trending"><h2>Trending now</h2><!-- SLOT: trending --></section>
  <main aria-label="Timeline"><!-- SLOT: posts --></main>
${w}
</div></body></html>`},{id:"noodle/search",appId:"noodle",match:e=>e.startsWith("/search"),name:"Noodle search",slots:["query","results"],slotDoc:`${v}

This is Noodle's search results page. The query comes from the URL and must be preserved.
- query: one short line showing the exact searched phrase.
- results: 6-10 posts or accounts relevant to the query, each using the standard Noodle post markup or a profile link.
${C}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Search / Noodle</title><style>${y}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/">Home</a></header><form class="nd-compose" action="https://noodle.social/search" method="get" aria-label="search Noodle"><input name="q" placeholder="Search Noodle" aria-label="Search phrase"><button type="submit">Search</button></form><section class="nd-trends"><h2>Results for</h2><div class="nd-trend-name"><!-- SLOT: query --></div></section><main aria-label="Search results"><!-- SLOT: results --></main>${w}</div></body></html>`},{id:"noodle/notifications",appId:"noodle",match:e=>e.startsWith("/notifications"),name:"Noodle notifications",slots:["notifications"],slotDoc:`${v}

This is the logged-in user's Noodle notifications page.
- notifications: 6-12 notification rows. Include follows, replies, mentions, slurps, and noodle reactions when they fit the scene. Do not write as the user's persona.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notifications / Noodle</title><style>${y}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/">Home</a></header><section class="nd-trends"><h2>Notifications</h2></section><main aria-label="Notifications"><!-- SLOT: notifications --></main>${w}</div></body></html>`},{id:"noodle/messages",appId:"noodle",match:e=>e.startsWith("/messages"),name:"Noodle messages",slots:["conversations"],slotDoc:`${v}

This is Noodle direct messages.
- conversations: 4-8 conversation rows with a display name, handle, last message, and relative time. Use links to https://noodle.social/messages/<handle>. Keep private messages in character and never write the user's persona's outgoing words.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Messages / Noodle</title><style>${y}</style></head><body><div class="nd-app"><header class="nd-top"><div class="nd-wordmark"><span>\u{1F35C}</span> noodle</div><a href="https://noodle.social/">Home</a></header><section class="nd-trends"><h2>Messages</h2></section><main aria-label="Direct messages"><!-- SLOT: conversations --></main>${w}</div></body></html>`},{id:"noodler/profile",appId:"noodler",match:e=>/^\/[^/]+\/?$/.test(e)&&!/^\/(feed|discover|messages|subscriptions)\/?$/.test(e),name:"Noodler creator page",slots:["identity","tiers","posts"],slotDoc:`${P}

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
<title>Creator / Noodler</title><style>${x}</style></head>
<body><div class="nr-app">
  <header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header>
  <div class="nr-banner"></div>
  <section class="nr-id"><!-- SLOT: identity --></section>
  <section class="nr-tiers" aria-label="Tiers"><!-- SLOT: tiers --></section>
  <main aria-label="Posts"><!-- SLOT: posts --></main>
${k}
</div></body></html>`},{id:"noodler/discover",appId:"noodler",match:e=>e.startsWith("/discover"),name:"Noodler discover",slots:["creators"],slotDoc:`${P}

This is Noodler's creator discovery page.
- creators: 6-10 creator cards with an adult creator name, handle, short pitch, subscription price, and a link to their profile. Keep discovery suggestive but not automatically explicit.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Discover / Noodler</title><style>${x}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Discover creators</h1><p class="nr-bio">Find creators worth subscribing to.</p></section><main aria-label="Creators"><!-- SLOT: creators --></main>${k}</div></body></html>`},{id:"noodler/messages",appId:"noodler",match:e=>e.startsWith("/messages"),name:"Noodler messages",slots:["conversations"],slotDoc:`${P}

This is Noodler creator and subscriber messaging.
- conversations: 4-8 rows with adult creator names, handles, a teasing but non-graphic preview, and a relative time. Never write as the user's persona.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Messages / Noodler</title><style>${x}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Messages</h1></section><main aria-label="Messages"><!-- SLOT: conversations --></main>${k}</div></body></html>`},{id:"noodler/subscriptions",appId:"noodler",match:e=>e.startsWith("/subscriptions"),name:"Noodler subscriptions",slots:["subscriptions"],slotDoc:`${P}

This is the user's Noodler subscriptions page.
- subscriptions: 4-8 creator subscription rows with tier name, price, renewal status, and one recent post teaser. Locked media stays locked.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Subscriptions / Noodler</title><style>${x}</style></head><body><div class="nr-app"><header class="nr-top"><div class="nr-wordmark"><span>\u{1F336}\uFE0F</span> noodler</div><span class="nr-badge">18+</span></header><section class="nr-id"><h1>Your subscriptions</h1></section><main aria-label="Subscriptions"><!-- SLOT: subscriptions --></main>${k}</div></body></html>`},{id:"noodler/home",appId:"noodler",match:e=>!/^\/(discover|messages|subscriptions)(?:\/|$)/i.test(e),name:"Noodler feed",slots:["gate","posts"],slotDoc:`${P}

This is the Noodler subscription feed behind its age gate.

- gate: one short in-universe sentence for the age-gate card, e.g.
    "Noodler hosts adult content and is intended for verified adults only."
- posts: 5-10 posts from creators this account subscribes to or is being pitched.
${J}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noodler</title><style>${x}</style></head>
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
${k}
</div></body></html>`}],me=`
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
`,ge=`
The page shell is fixed and already includes its header, controls, section labels, item cards, and bottom navigation.
Fill only the documented slots with content. Use absolute links on the app's own domain.
- summary: one short app-specific summary or status line.
- items: 5-10 complete item cards. Each card must be an <a class="vp-item" href="..."><strong>Title</strong><small>Useful detail</small></a>.
- action: one short label for the primary action, or an empty string when no action fits.
- detail: the body of one selected item, with 2-4 paragraphs or short rows.
`,X={home:"Show the app's primary home/feed view with current, recommended, or recent content.",search:"Show results for the submitted search query. Preserve the query in the result titles and links.",detail:"Show one selected item, profile, conversation, product, event, or location in detail.",settings:"Show practical account/app settings as compact rows. Do not invent dangerous account actions."};function ue(e,t){let n=t==="home"?"/":`/${t}`,s=t==="home"?"Home":t[0].toUpperCase()+t.slice(1),r=t==="detail"?["summary","detail","action"]:t==="settings"?["summary","items"]:["summary","items","action"],g=t==="detail"?'<section class="vp-section"><h2>Details</h2><div class="vp-detail"><!-- SLOT: detail --></div></section>':"";return{id:`${e.id}/${t}`,appId:e.id,match:l=>t==="home"?!/^\/(search|detail|settings|discover|saved|profile|item|product|event|thread)(?:\/|$)/i.test(l):t==="search"?l.startsWith("/search"):t==="settings"?l.startsWith("/settings"):/\/(detail|profile|item|product|event|thread)\b/i.test(l)||/^\/[^/]+$/.test(l),name:`${e.name} ${s}`,slots:r,slotDoc:`${e.description}

Content brief: ${e.contentGuidance||e.description}
Store category: ${e.storeCategory||"reference"}

${X[t]}

${ge}`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e.name} ${s}</title><style>${me}</style></head><body><div class="vp-app"><header class="vp-top"><div class="vp-brand"><span>${e.icon}</span>${e.name}</div><a href="https://${e.domain}${n}">${s}</a></header>${t==="search"?`<form class="vp-search" action="https://${e.domain}/search" method="get" aria-label="Search ${e.name}"><input name="q" placeholder="Search ${e.name}" aria-label="Search"><button type="submit">Go</button></form>`:""}<section class="vp-section"><h2>${t==="search"?"Results":t==="detail"?"Overview":t==="settings"?"Account":"Now"}</h2><div class="vp-item"><span><!-- SLOT: summary --></span></div></section>${g}${t!=="detail"?`<main class="vp-section"><h2>${t==="settings"?"Preferences":t==="search"?"Matches":"For you"}</h2><div class="vp-items"><!-- SLOT: items --></div></main>`:""}${t!=="settings"?'<section class="vp-section"><!-- SLOT: action --></section>':""}<nav class="vp-tabs" aria-label="${e.name}"><a class="${t==="home"?"active":""}" href="https://${e.domain}/">Home</a><a class="${t==="search"?"active":""}" href="https://${e.domain}/search">Search</a><a class="${t==="detail"?"active":""}" href="https://${e.domain}/discover">Discover</a><a class="${t==="settings"?"active":""}" href="https://${e.domain}/settings">Settings</a></nav></div></body></html>`}}var fe=m.filter(e=>e.framework&&e.id!=="noodle"&&e.id!=="noodler").flatMap(e=>Object.keys(X).map(t=>ue(e,t))),T=[...he,...fe];function Y(e,t){let n="/";try{n=new URL(t,"https://phone.local").pathname||"/"}catch{n="/"}return T.find(s=>s.appId===e&&s.match(n))??null}function Q(e,t){return e.replace(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g,(n,s)=>{let r=t[s];return typeof r=="string"?r:""})}function Z(e){return[...e.matchAll(/<!--\s*SLOT:\s*([\w-]+)\s*-->/g)].map(t=>t[1])}var be=300*1e3,ye=120,we=12,u=new Map;function ve(e){let t=e.owner?`${e.owner.kind}:${e.owner.id}`:`chat:${e.chatId}`,n=e.personaId||"none",s=[...e.characterIds||[]].sort().join(",")||"none";return[e.chatId,e.phoneIdentity||"",t,`persona:${n}`,`characters:${s}`,e.url].join("\0")}function xe(e){let t=u.get(e);return t?Date.now()-t.timestamp>be?(u.delete(e),null):t.value:null}function ke(e,t){for(u.set(e,{timestamp:Date.now(),value:t});u.size>ye;){let n=u.keys().next();if(n.done)break;u.delete(n.value)}}function ee(){u.clear()}function a(e,t=""){return typeof e=="string"?e.trim():t}function p(e){return e&&typeof e=="object"&&!Array.isArray(e)?e:{}}function Pe(e,t){let n=e.trim();return/^<!doctype html/i.test(n)||/^<html[\s>]/i.test(n)?n:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${$e(t)}</title></head><body>${n}</body></html>`}function $e(e){return e.replace(/[&<>"']/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":t===">"?"&gt;":t==='"'?"&quot;":"&#39;")}async function Se(e){let t=b();if(!e||!t.persistence?.getChat)return null;try{return await t.persistence.getChat(e)}catch(n){return t.logger.warn("Virtual Phone could not read the chat: %s",n instanceof Error?n.message:String(n)),null}}async function Te(e,t,n){let s=b(),r=p(e.context),g={url:t,phoneOwner:(()=>{let o=p(e.phoneOwner),h=o.kind==="character"?"character":"chat",d=a(o.id);return d?{kind:h,id:d,name:a(o.name)||void 0}:void 0})(),personaId:a(r.personaId)||void 0,characterIds:n?.characterIds?.length?[...n.characterIds].sort():void 0,chatSummary:a(r.chatSummary)||void 0,worldInfo:a(r.worldInfo)||void 0,persona:a(r.persona)||void 0,lastAction:a(e.lastAction)||void 0,formData:Object.keys(p(e.formData)).length?p(e.formData):void 0,pageHistory:a(e.pageHistory)||void 0},l=Array.isArray(r.recentMessages)?r.recentMessages:[];l.length&&(g.recentMessages=l.slice(-we).map(o=>p(o)).filter(o=>typeof o.content=="string").map(o=>({role:a(o.role,"user"),content:String(o.content)})));let c=Array.isArray(e.navHistory)?e.navHistory:[];if(c.length&&(g.navHistory=c.map(o=>p(o)).filter(o=>typeof o.url=="string").slice(-3).map(o=>({url:String(o.url),title:a(o.title)}))),n?.characterIds?.length&&s.resources?.listCharacters)try{let h=(await s.resources.listCharacters(n.characterIds)).map(d=>p(d.data).name).filter(d=>typeof d=="string"&&d.length>0);h.length&&(g.characters=h)}catch(o){s.logger.warn("Virtual Phone could not read chat characters: %s",o instanceof Error?o.message:String(o))}return g}function te(){return async e=>{e.get("/apps",async()=>({apps:_(),defaults:H()})),e.post("/page",async(t,n)=>{let s=p(t.body),r=b(),g=a(s.appId),l=a(s.url),c=D(g)??(l?z(l):null);if(!c)return n.code(400).send({error:"Unknown phone app."});let o=l||`https://${c.domain}/`,h=a(s.chatId);if(!h)return n.code(400).send({error:"Open a supported chat before using the phone."});let d=await Se(h);if(!d)return n.code(404).send({error:"The active chat could not be found."});let ne=p(s.context),O=p(s.phoneOwner),se=O.kind==="character"?"character":"chat",oe=a(O.id)||h,ae=a(s.phoneIdentity),re=a(ne.personaId),R=ve({chatId:h,url:o,phoneIdentity:ae,owner:{kind:se,id:oe},personaId:re,characterIds:d.characterIds});if(s.refresh!==!0){let i=xe(R);if(i)return{...i,fromCache:!0}}let ie=a(s.connectionId)||null,le=a(s.chatConnectionId)||d.connectionId||null,A;try{A=await G(ie,le)}catch(i){return n.code(400).send({error:i instanceof Error?i.message:"Could not resolve a language-model connection."})}let I=await Te(s,o,d),$=Y(c.id,o),de=$?K(c,$,I):V(c,I),E=null;try{let i=A.fitContext(de);E=(await A.chatComplete(i.messages,{temperature:.9,maxTokens:i.maxTokens,responseFormat:{type:"json_object"}})).content}catch(i){return r.logger.error(i,"Virtual Phone page generation failed"),n.code(502).send({error:"The model could not render that screen."})}let f=B(E);if(!f)return n.code(502).send({error:"The model returned no usable page."});let L=a(f.title)||c.name,N;if($)N=Q($.html,p(f.slots));else{let i=a(f.html);if(!i)return n.code(502).send({error:"The model returned no page HTML."});N=Pe(i,L)}let M={html:N,title:L,observerText:a(f.observerText),observerName:a(f.observerName)||c.name,appId:c.id,url:o};return ke(R,M),M})}}async function Ae({api:e,dataDir:t}){let n=F({...e.runtime,dataDir:t});try{let s=await e.registerPrivilegedRoutes(te(),{prefix:"/api/virtual-phone"});return async()=>{s(),ee(),n()}}catch(s){throw n(),s}}async function Ne(){let e=new Set(m.map(t=>t.id));for(let t of T){if(!e.has(t.appId))throw new Error(`Virtual Phone template ${t.id} targets unknown app ${t.appId}`);let n=Z(t.html).sort(),s=[...t.slots].sort();if(n.join(",")!==s.join(","))throw new Error(`Virtual Phone template ${t.id} declares slots [${s}] but its markup has [${n}]`)}return{ok:!0,apps:m.length,templates:T.length}}export{Ae as activate,Ne as selfCheck};
