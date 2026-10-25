var to=Object.defineProperty;var no=(e,t,n)=>t in e?to(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var oe=(e,t,n)=>no(e,typeof t!="symbol"?t+"":t,n);var Kt=globalThis.__MARINARA_HOST__,K=Kt&&Kt.version===1&&Kt.modules?Kt.modules["@tanstack/react-query"]:void 0;if(!K)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var pl=K.CancelledError,ml=K.HydrationBoundary,fl=K.InfiniteQueryObserver,hl=K.IsRestoringProvider,bl=K.Mutation,yl=K.MutationCache,vl=K.MutationObserver,wl=K.QueriesObserver,Sl=K.Query,kl=K.QueryCache,ba=K.QueryClient,xl=K.QueryClientContext,ya=K.QueryClientProvider,El=K.QueryErrorResetBoundary,Cl=K.QueryObserver,Rl=K.dataTagErrorSymbol,Ml=K.dataTagSymbol,Il=K.defaultScheduler,Al=K.defaultShouldDehydrateMutation,Nl=K.defaultShouldDehydrateQuery,Pl=K.dehydrate,Tl=K.dehydrateQuery,_l=K.environmentManager,Ol=K.experimental_streamedQuery,Fl=K.focusManager,Ll=K.hashKey,$l=K.hydrate,Ul=K.infiniteQueryOptions,Hl=K.isCancelledError,Dl=K.isServer,zl=K.keepPreviousData,Bl=K.matchMutation,Gl=K.matchQuery,Kl=K.mutationOptions,ql=K.noop,Vl=K.notifyManager,Wl=K.onlineManager,Ql=K.partialMatchKey,jl=K.queryOptions,Yl=K.replaceEqualDeep,Xl=K.shouldThrowError,Jl=K.skipToken,Zl=K.timeoutManager,ec=K.unsetMarker,tc=K.useInfiniteQuery,nc=K.useIsFetching,ac=K.useIsMutating,sc=K.useIsRestoring,ne=K.useMutation,va=K.useMutationState,rc=K.usePrefetchInfiniteQuery,oc=K.usePrefetchQuery,ic=K.useQueries,le=K.useQuery,ge=K.useQueryClient,lc=K.useQueryErrorResetBoundary,cc=K.useSuspenseInfiniteQuery,uc=K.useSuspenseQueries,gc=K.useSuspenseQuery;var qt=globalThis.__MARINARA_HOST__,Q=qt&&qt.version===1&&qt.modules?qt.modules.react:void 0;if(!Q)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var pc=Q.Activity,mc=Q.Children,fc=Q.Component,hc=Q.Fragment,bc=Q.Profiler,yc=Q.PureComponent,vc=Q.StrictMode,wc=Q.Suspense,Sc=Q.ViewTransition,kc=Q.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,xc=Q.__COMPILER_RUNTIME,Ec=Q.act,Cc=Q.addTransitionType,Rc=Q.cache,Mc=Q.cacheSignal,Ic=Q.captureOwnerStack,Ac=Q.cloneElement,wa=Q.createContext,Nc=Q.createElement,Pc=Q.createRef,Sa=Q.default,Tc=Q.forwardRef,_c=Q.isValidElement,Oc=Q.lazy,Fc=Q.memo,Lc=Q.startTransition,$c=Q.unstable_useCacheRefresh,Uc=Q.use,Hc=Q.useActionState,de=Q.useCallback,ka=Q.useContext,Dc=Q.useDebugValue,zc=Q.useDeferredValue,Y=Q.useEffect,Bc=Q.useEffectEvent,xa=Q.useId,Ea=Q.useImperativeHandle,Gc=Q.useInsertionEffect,Ge=Q.useLayoutEffect,Vt=Q.useMemo,Kc=Q.useOptimistic,qc=Q.useReducer,j=Q.useRef,G=Q.useState,Vc=Q.useSyncExternalStore,Wc=Q.useTransition,Qc=Q.version;var Wt=globalThis.__MARINARA_HOST__,vt=Wt&&Wt.version===1&&Wt.modules?Wt.modules["react-dom/client"]:void 0;if(!vt)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var Ca=vt.createRoot,Yc=vt.default,Xc=vt.hydrateRoot,Jc=vt.version;var ao="/api/saucelings",so="x-marinara-csrf";var ro="marinara_admin_secret";function oo(){if(typeof window>"u")return{};try{let e=window.localStorage.getItem(ro)?.trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function V(e,t="GET",n,s){return ke(`${ao}${e}`,t,n,s)}async function ke(e,t="GET",n,s){let a=new Headers(oo());t!=="GET"&&a.set(so,"1"),n!==void 0&&a.set("Content-Type","application/json");let r=await fetch(e,{method:t,headers:a,signal:s,cache:"no-store",credentials:"same-origin",...n===void 0?{}:{body:JSON.stringify(n)}});if(!r.ok){let o=await r.json().catch(()=>null),l=typeof o?.error=="string"?o.error:typeof o?.message=="string"?o.message:r.statusText;throw Object.assign(new Error(l||"Saucelings request failed"),{status:r.status})}return r.json()}function Ke(e="saucelings",t,n){let s=`/api/capability-packages/${encodeURIComponent(e)}/assets/${t}`;return n?`${s}?v=${encodeURIComponent(n)}`:s}var Ra={_meta:{locale:"en",direction:"ltr"},"saucelings.title":"Saucelings","saucelings.subtitle":"Your characters look after a little companion; you cover the gaps.","saucelings.loading":"Loading Saucelings\u2026","saucelings.nav.label":"Saucelings views","saucelings.tab.nook":"Nook","saucelings.tab.journal":"Journal","saucelings.tab.album":"Album","saucelings.tab.menagerie":"Menagerie","saucelings.tab.settings":"Settings","saucelings.empty.title":"No sauceling in the nook yet","saucelings.empty.body":"Pick a character to look after a sauceling. They'll bring an egg that looks like something they would find.","saucelings.empty.pickCaretaker":"Choose caretaker","saucelings.empty.bringEgg":"Have caretaker bring an egg","saucelings.empty.bringingEgg":"Bringing egg\u2026","saucelings.empty.houseCaretaker":"House Caretaker","saucelings.empty.eggAlt":"Egg","saucelings.egg.name":"Egg","saucelings.egg.about":"Nobody knows what is inside yet. Keep it warm and talk to it, and it will hatch.","saucelings.egg.moveLabel":"Egg. Drag it, or use the arrow keys, to move it.","saucelings.egg.moveHint":"Drag the egg to move it, or tap where it should go.","saucelings.pet.rename":"Rename","saucelings.pet.nameIt":"Name it","saucelings.pet.namePlaceholder":"Give it a name","saucelings.pet.sauce":"Sauce: {{sauce}}","saucelings.pet.rare.special":"Special sauceling","saucelings.pet.rare.halloween":"Halloween sauceling","saucelings.pet.sauceAbout":"{{sauce}} sauce: {{readsAs}}. Its sauce changes with how it is looked after.","saucelings.pet.temperament":"Temperament: {{temperament}}","saucelings.pet.temperamentAbout":"{{temperament}}: {{readsAs}}. It takes after {{after}}, and slowly picks up the ways of whoever looks after it.","saucelings.pet.temperamentForming":"Its temperament is still taking shape.","saucelings.pet.locked":"{{stage}} (locked)","saucelings.pet.growthPaused":"Growing paused: hungry","saucelings.pet.caretaker":"Caretaker:","saucelings.pet.eggCaretaker":"Keeping it warm:","saucelings.pet.meals":"Meals: {{given}} of {{total}} this week","saucelings.pet.mealsTitle":"Meals {{name}} gave in the last 7 days","saucelings.pet.keptWarm":"Kept warm: {{given}} of {{total}} this week","saucelings.pet.keptWarmTitle":"Times {{name}} kept the egg warm in the last 7 days","saucelings.stage.egg":"egg","saucelings.stage.hatchling":"hatchling","saucelings.stage.juvenile":"juvenile","saucelings.stage.adult":"adult","saucelings.stage.elder":"elder","saucelings.meter.hunger":"Hunger","saucelings.meter.mood":"Mood","saucelings.meter.bond":"Bond","saucelings.meter.hungerGap":"Needs attention","saucelings.meter.moodGap":"Low spirits","saucelings.meter.warmth":"Warmth","saucelings.meter.warmthGap":"Getting cold","saucelings.meter.hatching":"Hatching","saucelings.meter.hatchingGap":"Needs care first","saucelings.action.feed":"Feed","saucelings.action.play":"Play","saucelings.action.rest":"Rest","saucelings.action.pet":"Cuddle","saucelings.action.warm":"Warm","saucelings.action.talk":"Talk","saucelings.action.listen":"Listen","saucelings.action.wait":"{{minutes}}m","saucelings.nudge.heading":"Ask {{name}} to","saucelings.nudge.ask":"Ask","saucelings.nudge.note":"Lasts 48 hours.","saucelings.nudge.active":"Asked: {{asks}}","saucelings.nudge.left":"{{ask}} ({{hours}} h left)","saucelings.nudge.meals":"remember meals","saucelings.nudge.portions":"go easy on portions","saucelings.nudge.play":"play more","saucelings.nudge.cuddles":"give extra cuddles","saucelings.nudge.warm":"keep it warm","saucelings.nudge.talk":"talk to it more","saucelings.retire.button":"Retire to the Menagerie","saucelings.checkIn.button":"Check in with {{name}}","saucelings.checkIn.pending":"{{name}} is writing\u2026","saucelings.swap.button":"Swap for a new egg","saucelings.swap.note":"{{name}} will move to the Menagerie, and the caretaker you pick brings a new egg.","saucelings.swap.noteEgg":"The egg will move to the Menagerie, and the caretaker you pick brings a new one.","saucelings.swap.confirm":"Swap","saucelings.unlocks.title":"Special eggs","saucelings.unlocks.prismite":"Prismite: raise {{need}} saucelings to elder or evolve them ({{have}} so far).","saucelings.unlocks.thundrake":"Thundrake: care for your saucelings {{need}} times ({{have}} so far).","saucelings.unlocks.clockrit":"Clockrit: care for a sauceling on {{need}} different days ({{have}} so far).","saucelings.unlocks.done":"{{name}}: unlocked. A new egg may be one.","saucelings.unlocks.halloween":"Wickwisp, Cauldrop and Webbit: October only.","saucelings.unlocks.halloweenNow":"Wickwisp, Cauldrop and Webbit: it's October, so a new egg may be one.","saucelings.menagerie.empty":"No saucelings in the Menagerie yet.","saucelings.menagerie.bringBack":"Bring back to Nook","saucelings.menagerie.lockStage":"Lock stage at:","saucelings.menagerie.retiredAs":"Retired as {{stage}} with {{name}}","saucelings.menagerie.returnsAt":"Returns at stage:","saucelings.menagerie.release":"Release","saucelings.menagerie.releaseNote":"Release {{name}} for good? It leaves the Menagerie and can't come back. Its paintings stay in the Album.","saucelings.menagerie.releaseNoteEgg":"Release this egg for good? It leaves the Menagerie and can't come back.","saucelings.menagerie.releaseConfirm":"Release for good","saucelings.menagerie.swapNote":"{{active}} will move to the Menagerie, and {{name}} comes back to the nook.","saucelings.menagerie.swapConfirm":"Swap them","saucelings.menagerie.activeEgg":"The egg in the nook","saucelings.menagerie.thisEgg":"this egg","saucelings.menagerie.foundBy":"Found by {{name}}","saucelings.menagerie.evolved":"Evolved","saucelings.menagerie.close":"Close","saucelings.menagerie.lookedAfterBy":"Looked after by","saucelings.menagerie.chooseCaretaker":"Choose who looks after it","saucelings.menagerie.section.elder":"Elders","saucelings.menagerie.section.adult":"Adults","saucelings.menagerie.section.juvenile":"Juveniles","saucelings.menagerie.section.hatchling":"Hatchlings","saucelings.menagerie.section.egg":"Eggs","saucelings.album.paint":"Paint {{name}}","saucelings.album.painting":"Painting\u2026","saucelings.album.needsConnection":"Pick an image connection in Saucelings settings first.","saucelings.album.off":"Turn on image generation in Settings to paint your sauceling.","saucelings.album.egg":"Paint it once it hatches.","saucelings.album.noPet":"Bring a sauceling into the nook to paint it.","saucelings.album.full":"The Album is full at {{limit}} paintings. Delete one to paint another.","saucelings.album.empty":"No paintings yet.","saucelings.album.inMenagerie":"(in the Menagerie)","saucelings.album.released":"(released)","saucelings.album.caption":"{{stage}}, {{date}}","saucelings.album.alt":"Painting of {{name}}","saucelings.album.missing":"This painting could not be loaded.","saucelings.album.delete":"Delete","saucelings.album.deleteConfirm":"Delete for good","saucelings.album.close":"Close","saucelings.album.keepsakeLabel":"{{name}} before and after evolving","saucelings.album.keepsakeCaption":"{{name}} became {{form}}, {{date}}","saucelings.album.before":"Before","saucelings.album.after":"After","saucelings.album.addInstructions":"Add instructions","saucelings.album.removeInstructions":"Remove instructions","saucelings.album.instructionsLabel":"What should the painting show?","saucelings.album.instructionsPlaceholder":"e.g. sitting in a teacup at a caf\xE9, rain outside","saucelings.album.instructionsNote":"Your words replace the plain background. Leave it empty for a plain portrait.","saucelings.album.instructionsCaption":"\u201C{{instructions}}\u201D","saucelings.form.paint":"Paint {{name}}'s {{stage}} form","saucelings.form.paintEgg":"Paint the egg","saucelings.form.painting":"Painting\u2026","saucelings.form.paintingNote":"Painting it now with your image connection.","saucelings.form.paintingEgg":"Painting the egg\u2026","saucelings.form.repaint":"Repaint all of {{name}}'s forms","saucelings.form.repaintEgg":"Repaint the egg","saucelings.form.repaintHint":"For when the picture came out wrong.","saucelings.form.repaintNote":"Paint every stage again in one new picture? The one you see now stays until the new one is ready.","saucelings.form.repaintConfirm":"Repaint","saucelings.form.undoRepaint":"Undo repaint","saucelings.form.undoRepaintHint":"Goes back to the pictures from before the last repaint. Press it again to bring the repaint back.","saucelings.form.eggFailed":"The egg could not be painted: {{error}} Bring it to the nook to paint it there.","saucelings.form.needed":"Its caretaker invented it, so this stage has no picture until one is painted.","saucelings.form.failed":"The painting could not be cut out into a form. Try again.","saucelings.form.offerEggTitle":"Paint the egg?","saucelings.form.offerEggBody":"This egg has no picture yet. Painting it uses your image connection.","saucelings.form.offerTitle":"Paint {{name}}?","saucelings.form.offerBody":"{{name}} has no picture for this stage yet. Painting it uses your image connection.","saucelings.form.offerNotNow":"Not now","saucelings.form.offerPaint":"Paint it","saucelings.figure.paint":"Paint {{name}} for the Nook","saucelings.figure.repaint":"Repaint {{name}} for the Nook","saucelings.figure.hint":"Draws them in eight poses as a pixel figure in the pets' style, from their avatar and card.","saucelings.figure.confirmNote":"Paint {{name}} as a pixel figure with your image connection? It takes one image request, and what the Nook shows now stays until it is ready.","saucelings.figure.confirm":"Paint","saucelings.figure.failed":"The picture could not be read as drawings of {{name}}. Try again.","saucelings.figure.threePoses":"{{name}} has three poses so far. Repaint for all eight.","saucelings.figure.undoRepaint":"Undo {{name}}'s repaint","saucelings.figure.undoHint":"Goes back to the figure from before the last repaint. Press it again to bring the repaint back.","saucelings.flip.label":"Flip {{name}}","saucelings.flip.note":"Turns {{name}} to face the other way in the Nook. Nothing is repainted.","saucelings.settings.careWindow":"Care window (hours)","saucelings.settings.careWindowNote":"How often the caretaker rolls feeding, play and cuddles (default 6 h).","saucelings.settings.connection":"Writing connection","saucelings.settings.connectionNote":"The connection the caretaker writes journal lines and check-ins with.","saucelings.settings.connectionDefault":"Engine default","saucelings.settings.connectionMissing":"Deleted connection: pick another","saucelings.settings.dailyBudget":"Written lines per day","saucelings.settings.budgetUsed":"Used today: {{used}} / {{limit}}","saucelings.settings.budgetNote":"Lines you ask for with a click (Check in, a new caretaker's hello, a welcome back, a farewell) don't count. Past the limit, other events keep their plain template line.","saucelings.settings.writeEveryLine":"Caretaker writes every line","saucelings.settings.writeEveryLineNote":"Every caretaker line comes from the model instead of the phrasebook. Uses more model calls; the daily limit doesn't apply.","saucelings.settings.images":"Enable image generation","saucelings.settings.imagesNote":"Adds a Paint button to the Album tab and a Generate button for the Nook background, and paints each creature a caretaker invents as soon as Saucelings is open, all with the image connection you pick.","saucelings.settings.threeDrawingFallback":"Simpler caretaker figures","saucelings.settings.threeDrawingFallbackNote":"If a caretaker's figure doesn't come out, ask once more for just three drawings in one row. Helps weaker image models, but uses an extra image call.","saucelings.settings.eggHunting":"Egg hunting","saucelings.settings.eggHuntingNote":"When a character replies in a chat, they may find an egg, which waits in the Menagerie and is mentioned by the caretaker. Only a chance is rolled: no chat text is read and nothing is added to the prompt.","saucelings.settings.imageConnection":"Image connection","saucelings.settings.imageConnectionPick":"Choose an image connection","saucelings.settings.imageConnectionEmpty":"No image generation connection yet. Add one under Connections.","saucelings.settings.reset":"Reset Saucelings","saucelings.settings.resetNote":"Clear the nook, the Menagerie and the Album to start fresh.","saucelings.settings.resetConfirm":"Confirm Reset","saucelings.journal.generated":"AI","saucelings.journal.speaker":"{{name}}:","saucelings.event.egg-found":"Egg found","saucelings.event.hatch":"Hatched","saucelings.event.caretaker-care":"Caretaker","saucelings.event.user-care":"Your care","saucelings.event.nudge":"Nudge","saucelings.event.absence":"While you were away","saucelings.event.stage-up":"Grew up","saucelings.event.temperament-shift":"New sauce","saucelings.event.farewell":"Farewell","saucelings.event.return-from-album":"Back from the Menagerie","saucelings.event.check-in":"Check-in","saucelings.event.evolve":"Evolved","saucelings.event.evolve-offer":"Ready to evolve","saucelings.event.caretaker-change":"New caretaker","saucelings.widget.emptyHint":"Tap to open Saucelings and pick a caretaker.","saucelings.error.interface":"Saucelings encountered an interface error.","saucelings.error.load":"Could not load Saucelings Nook.","saucelings.error.request":"Request failed","saucelings.error.retry":"Try again","saucelings.error.restart":"Restart Marinara Engine to finish installing Saucelings.","saucelings.common.cancel":"Cancel","saucelings.common.save":"Save","saucelings.nook.background":"Background","saucelings.background.title":"Nook background","saucelings.background.upload":"Upload a picture","saucelings.background.uploading":"Uploading\u2026","saucelings.background.generate":"Generate a background","saucelings.background.generating":"Generating\u2026","saucelings.background.promptLabel":"What the background shows","saucelings.background.suggest":"Suggest one for {{name}}","saucelings.background.suggestEgg":"Suggest one for the egg","saucelings.background.suggesting":"Writing\u2026","saucelings.background.suggestPlain":"No writing connection answered, so this is a plain starting point. Edit it as you like.","saucelings.background.useBuiltIn":"Use the built-in background","saucelings.background.tooBig":"That picture is too big.","saucelings.background.off":"Turn on image generation in Settings to generate a background.","saucelings.background.noConnection":"Pick an image connection in Saucelings settings first.","saucelings.background.library":"Saved backgrounds","saucelings.background.tileAlt":"Background: {{label}}","saucelings.background.earlier":"An earlier background","saucelings.background.missing":"Could not load","saucelings.background.delete":"Delete {{label}}","saucelings.background.deleteNote":"Delete \u201C{{label}}\u201D for good? Saucelings showing it go back to their built-in background.","saucelings.background.deleteConfirm":"Delete for good","saucelings.background.full":"The library is full at {{limit}}. Delete a background to save another.","saucelings.caretaker.says":"{{name}} says","saucelings.caretaker.previous":"Earlier line","saucelings.caretaker.next":"Later line","saucelings.caretaker.position":"{{index}} of {{count}}","saucelings.caretaker.idle":"I'm keeping an eye on {{name}}.","saucelings.caretaker.idleEgg":"I'm keeping an eye on the egg.","saucelings.about.summary":"About {{name}}","saucelings.about.egg":"About the egg","saucelings.about.refreshVoice":"Refresh {{name}}'s voice from their card","saucelings.about.refreshingVoice":"{{name}} is reading their card\u2026","saucelings.about.refreshVoiceNote":"Reads their character card again, so their lines sound like them.","saucelings.help.label":"Show help: {{action}}","saucelings.evolve.button":"Evolve\u2026","saucelings.evolve.note":"{{name}} can become something new, once in its life. You choose, or keep it as it is.","saucelings.evolve.undo":"Undo evolution","saucelings.evolve.undoNote":"{{name}} goes back to how it looked before. Evolve\u2026 comes back with the same two choices.","saucelings.evolve.title":"What could {{name}} become?","saucelings.evolve.writing":"{{caretaker}} is thinking about what {{name}} could become\u2026","saucelings.evolve.from":"From: {{from}}","saucelings.evolve.become":"Become {{form}}","saucelings.evolve.keep":"Keep it as it is","saucelings.evolve.decline":"Not interested","saucelings.evolve.declineNote":"Hides Evolve\u2026 for {{name}} for good.","saucelings.evolve.declineConfirm":"Never offer {{name}} an evolution again?","saucelings.evolve.into":"Evolved into: {{form}}","saucelings.evolve.move":"Signature move: {{move}}","saucelings.evolve.moves.twirl":"Twirl","saucelings.evolve.moves.float":"Float","saucelings.evolve.moves.shine":"Shine","saucelings.evolve.moves.roar":"Roar","saucelings.evolve.moves.sparkle":"Sparkle","saucelings.evolve.moves.firepuff":"Fire Puff","saucelings.evolve.moves.icicles":"Icicles","saucelings.evolve.moves.leafwhirl":"Leaf Whirl","saucelings.evolve.moves.wiggle":"Wiggle","saucelings.evolve.moves.petalshower":"Petal Shower","saucelings.evolve.moves.triplehop":"Triple Hop","saucelings.evolve.moves.starburst":"Star Burst","saucelings.evolve.moves.coinshower":"Coin Shower","saucelings.evolve.moves.shockwave":"Shockwave","saucelings.evolve.moves.vanish":"Vanish","saucelings.evolve.moves.zap":"Lightning Zap","saucelings.evolve.moves.dash":"Dash","saucelings.evolve.moves.bubbleblow":"Bubble Blow","saucelings.evolve.moves.splash":"Splash","saucelings.voice.title":"Give {{name}} their own voice?","saucelings.voice.body":"{{name}} has no voice of their own yet, so their stock lines are generic. Saucelings can read their character card once with your writing connection to learn how they talk, what they call your pet and what they say at mealtimes.","saucelings.voice.read":"Read {{name}}'s card","saucelings.voice.notNow":"Not now","saucelings.voice.failed":"Couldn't make {{name}}'s voice: the writing connection didn't answer.","saucelings.voice.tryAgain":"Try again","saucelings.voice.close":"Close","saucelings.retire.ready":"{{name}} is old enough to retire.","saucelings.stage.tapHint":"Tap the stage and {{name}} comes over."};var Qt=globalThis.__MARINARA_HOST__,wt=Qt&&Qt.version===1&&Qt.modules?Qt.modules["react/jsx-runtime"]:void 0;if(!wt)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var ce=wt.Fragment,nu=wt.default,i=wt.jsx,h=wt.jsxs;var lo=Object.fromEntries(Object.entries(Ra).filter(([e,t])=>e!=="_meta"&&typeof t=="string"));function co(e,t){return t?e.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(n,s)=>{let a=t[s];return a==null?n:String(a)}):e}function nt(e,t,n){return co(lo[t]??t,n)}var Ma=wa({direction:"ltr",t:(e,t)=>nt(void 0,e,t)});function Ia({localization:e,children:t}){let n=e?.direction==="rtl"?"rtl":"ltr",s=Vt(()=>({direction:n,t:(a,r)=>nt(e,a,r)}),[n,e]);return i(Ma.Provider,{value:s,children:i("div",{dir:n,style:{display:"contents"},children:t})})}function J(){return ka(Ma)}var Aa=["prismite","thundrake","clockrit"],Na=["wickwisp","cauldrop","webbit"],Pa=["rigamuffin","fluttino","lentino","shellbini","tortellump"];var $e=["egg","hatchling","juvenile","adult","elder"],Ta=["hatchling","juvenile","adult","elder"];var Rn=["feed","play","rest","pet"],Mn=["warm","talk","listen"],lu=[...Rn,...Mn],In=1800*1e3,_a=70,Oa=35;var uo=["feed","fedBadly","overfed","forgot","play","cuddle","milestone","warmEgg","letCool","chatEgg","hatch","stageUp"],cu=[...uo,"checkInEgg","checkInContent","checkInHungry","checkInSad","hello","farewell"];var St=["halo","crown","star","flame","moon","leaf","gem","snowflake","cloud","bolt","feather","heart","mushroom","orb","bow","flower","shell"],jt=["embers","snow","leaves","petals","stars","glints","wisps","sparks","bubbles"];var at={ember:{aura:"embers",extras:["flame","star","crown"],moves:["firepuff","roar"]},frost:{aura:"snow",extras:["snowflake","gem","moon"],moves:["icicles","twirl"]},moss:{aura:"leaves",extras:["leaf","mushroom","feather"],moves:["leafwhirl","wiggle"]},dusk:{aura:"stars",extras:["moon","star","orb"],moves:["starburst","float"]},gilded:{aura:"glints",extras:["crown","halo","gem"],moves:["coinshower","sparkle","shine"]},shade:{aura:"wisps",extras:["moon","orb","feather"],moves:["shockwave","vanish"]},bloom:{aura:"petals",extras:["flower","heart","bow"],moves:["petalshower","triplehop"]},storm:{aura:"sparks",extras:["bolt","cloud","orb"],moves:["zap","dash"]},tide:{aura:"bubbles",extras:["shell","gem","orb"],moves:["bubbleblow","splash"]}},Fa=200,An=24,Nn=24;var Yt={rigamuffin:{id:"rigamuffin",name:"Rigamuffin",origin:"rigatoni + ragamuffin",look:"scruffy little tube with ridges, always slightly grubby",defaultTraits:["ridged-hide","crumb-collector","sturdy","curious"]},fluttino:{id:"fluttino",name:"Fluttino",origin:"farfalle + flutter",look:"bow-shaped wings, hovers, never quite lands",defaultTraits:["hover-drift","bow-winged","breezy","restless"]},lentino:{id:"lentino",name:"Lentino",origin:"linguine / lentil + -ino",look:"long, thin, loops itself into knots when happy",defaultTraits:["knot-tier","slender","springy","affectionate"]},shellbini:{id:"shellbini",name:"Shellbini",origin:"conchiglie + shell",look:"shelled, hides inside when sulky",defaultTraits:["pocket-shell","peeker","shy-sweet","echo-hum"]},tortellump:{id:"tortellump",name:"Tortellump",origin:"tortellini + lump",look:"plump folded dumpling with a pinched dimple on top, rolls instead of walking",defaultTraits:["roly-poly","stuffed-snug","dimpled","homebody"]},mossaboo:{id:"mossaboo",name:"Mossaboo",origin:"moss + peekaboo",look:"round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",defaultTraits:["moss-backed","slow","patient","cosy"]},puddlepip:{id:"puddlepip",name:"Puddlepip",origin:"puddle + pip",look:"clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",defaultTraits:["raindrop-headed","splashy","happy","noisy"]},snufflump:{id:"snufflump",name:"Snufflump",origin:"snuffle + lump",look:"round ball of beige fluff with floppy ears, puffs up when startled",defaultTraits:["fluff-ball","sleepy","cuddly","nervous"]},burrowl:{id:"burrowl",name:"Burrowl",origin:"burrow + owl",look:"round brown owl with goggle eyes and big pink digging paws",defaultTraits:["big-pawed","busy","wise","messy"]},prismite:{id:"prismite",name:"Prismite",origin:"prism + -ite",look:"cluster of clear crystal spikes that splits light into rainbows",defaultTraits:["faceted","proud","sparkly","aloof"]},thundrake:{id:"thundrake",name:"Thundrake",origin:"thunder + drake",look:"little storm-cloud dragon with lightning horns and a rainy tail",defaultTraits:["spark-horned","stormy","bold","moody"]},clockrit:{id:"clockrit",name:"Clockrit",origin:"clock + critter",look:"brass wind-up critter with a clock-face belly and a pendulum tail",defaultTraits:["wind-up","punctual","fussy","kind"]},wickwisp:{id:"wickwisp",name:"Wickwisp",origin:"wick + will-o'-the-wisp",look:"stub of dripping candle wax with a little flame floating over its head",defaultTraits:["flame-crowned","flickery","timid","warm-hearted"]},cauldrop:{id:"cauldrop",name:"Cauldrop",origin:"cauldron + drop",look:"small iron cauldron on three legs, brim-full of bubbling purple potion",defaultTraits:["brim-bubbler","bubbly","mischievous","greedy"]},webbit:{id:"webbit",name:"Webbit",origin:"web + -bit",look:"fluffy cobweb spider whose round belly glows like a paper lantern",defaultTraits:["lantern-bellied","tidy","patient","clingy"]}},go={marinara:{id:"marinara",name:"Marinara",origin:"house sauce",readsAs:"freshly hatched, open-hearted, still finding its flavor",grownBy:"hatching and balanced early days",accentColor:"#e05246",badgeBg:"rgba(224, 82, 70, 0.16)"},zesto:{id:"zesto",name:"Zesto",origin:"pesto + zest",readsAs:"bright, bouncy, chatty",grownBy:"steady feeding and play, good bond",accentColor:"#48b868",badgeBg:"rgba(72, 184, 104, 0.16)"},carbonuzzle:{id:"carbonuzzle",name:"Carbonuzzle",origin:"carbonara + nuzzle",readsAs:"warm, clingy, golden",grownBy:"lots of cuddles and affection",accentColor:"#f0b449",badgeBg:"rgba(240, 180, 73, 0.18)"},rabbratty:{id:"rabbratty",name:"Rabbratty",origin:"arrabbiata + bratty",readsAs:"feisty, demanding, quick-tempered",grownBy:"erratic care, missed meals then spoiling",accentColor:"#f25c3b",badgeBg:"rgba(242, 92, 59, 0.18)"},seppy:{id:"seppy",name:"Seppy",origin:"seppia + sulky",readsAs:"gloomy, brooding, dramatic",grownBy:"neglect, long absences, low mood",accentColor:"#7882a4",badgeBg:"rgba(120, 130, 164, 0.2)"},alfredoze:{id:"alfredoze",name:"Alfredoze",origin:"alfredo + doze",readsAs:"mellow, sleepy, content",grownBy:"over-feeding, little play",accentColor:"#d9ceb8",badgeBg:"rgba(217, 206, 184, 0.2)"},truffoddity:{id:"truffoddity",name:"Truffoddity",origin:"truffle + oddity",readsAs:"strange, brilliant, unsettling",grownBy:"milestones noticed, no affection",accentColor:"#a978e8",badgeBg:"rgba(169, 120, 232, 0.18)"}};function po(e,t){return Math.min(e,t)<42?"grumpy":e>=68&&t>=68?"happy":"content"}var Pn=["happy","content","grumpy","side"],je=1+($e.length-1)*Pn.length;function Te(e,t,n){let s=`sprites/${e}.webp`;return t==="egg"?n==="side"?null:{path:s,row:0}:{path:s,row:1+($e.indexOf(t)-1)*Pn.length+Pn.indexOf(n)}}var kt=6,mo={thundrake:140,wickwisp:140,cauldrop:180,clockrit:1e3,webbit:220,prismite:180};function La(e){let t=mo[e];return t?{path:`sprites/${e}-live.webp`,ms:t}:null}var Tn=["egg-found","hatch","caretaker-care","absence","stage-up","temperament-shift","farewell","return-from-album","check-in","evolve","evolve-offer","caretaker-change"];function xt(e){return`${/^[aeiou]/iu.test(e)?"an":"a"} ${e}`}function qe(e){return e.design?{name:e.design.kind,look:e.design.look}:{name:Yt[e.species].name,look:Yt[e.species].look}}function fo(e){return!e.design&&Pa.includes(e.species)}function Ue(e){if(fo(e)){let t=go[e.temperament];return{name:t.name,readsAs:t.readsAs,sauce:t}}return e.ownTemperament?{name:e.ownTemperament.name,readsAs:e.ownTemperament.readsAs,sauce:null}:null}function $a(e){return[...$e].reverse().map(t=>({stage:t,entries:e.filter(n=>(n.reachedElder?"elder":n.stageAtRetirement)===t)})).filter(t=>t.entries.length>0)}var Ua={rigamuffin:"a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",fluttino:"a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",lentino:"a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",shellbini:"a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",tortellump:"a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",mossaboo:"a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",puddlepip:"a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",snufflump:"a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",burrowl:"an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",prismite:"a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",thundrake:"a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",clockrit:"a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",wickwisp:"a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",cauldrop:"a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",webbit:"a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves"},Ha="a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";function st(e){return e.stage==="egg"?"sprites/scene-nest.webp":`sprites/scene-${e.species}.webp`}function Ye(e){return{stage:e.lockedStage??e.stage,mood:po(e.meters.hunger,e.meters.mood)}}function Da(e,t){let n=e.forms[t];return n?{kind:"form",formId:n}:e.design?.origin==="found"?{kind:"silhouette"}:{kind:"species"}}var Qa={egg:32,hatchling:29,juvenile:37,adult:45,elder:46},Me=(e,t)=>({data:new Uint8ClampedArray(e*t*4),width:e,height:t}),Xt=(e,t,n,s)=>{let a=[0,0,0],r=0;for(let o=n;o<Math.min(n+s,e.height);o++)for(let l=t;l<Math.min(t+s,e.width);l++){let c=(o*e.width+l)*4;a[0]+=e.data[c],a[1]+=e.data[c+1],a[2]+=e.data[c+2],r++}return[Math.round(a[0]/r),Math.round(a[1]/r),Math.round(a[2]/r)]};function $n(e,t=48){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s};if(n===0||s===0)return a;let r=4,o=[Xt(e,0,0,r),Xt(e,Math.max(0,n-r),0,r),Xt(e,0,Math.max(0,s-r),r),Xt(e,Math.max(0,n-r),Math.max(0,s-r),r)],l=(f,m)=>Math.max(Math.abs(f[0]-m[0]),Math.abs(f[1]-m[1]),Math.abs(f[2]-m[2]))<=t,c=o[0],u=0;for(let f of o){let m=o.filter(b=>l(f,b)).length;m>u&&(u=m,c=f)}let p=f=>{let m=f*4;return e.data[m+3]<16||l([e.data[m],e.data[m+1],e.data[m+2]],c)},d=new Uint8Array(n*s),g=new Int32Array(n*s),w=0,y=f=>{d[f]||!p(f)||(d[f]=1,g[w++]=f)};for(let f=0;f<n;f++)y(f),y((s-1)*n+f);for(let f=0;f<s;f++)y(f*n),y(f*n+n-1);for(;w>0;){let f=g[--w];a.data[f*4+3]=0;let m=f%n;m>0&&y(f-1),m<n-1&&y(f+1),f>=n&&y(f-n),f<n*(s-1)&&y(f+n)}return a}function Et(e,t=128){let n=e.width,s=e.height,a=-1,r=-1;for(let o=0;o<e.height;o++)for(let l=0;l<e.width;l++)e.data[(o*e.width+l)*4+3]<t||(l<n&&(n=l),l>a&&(a=l),o<s&&(s=o),o>r&&(r=o));return a<0?null:{x:n,y:s,width:a-n+1,height:r-s+1}}var Jt=(e,t,n,s,a,r)=>{let o=Me(s,s),l=Math.max(1,Math.round(t.width*n)),c=Math.max(1,Math.round(t.height*n)),u=r===void 0?Math.floor((s-l)/2):r-l,p=s-a-c,d=n<1;for(let g=0;g<c;g++)if(!(p+g<0||p+g>=s))for(let w=0;w<l;w++){if(u+w<0||u+w>=s)continue;let y=w*t.width/l,f=(w+1)*t.width/l,m=g*t.height/c,b=(g+1)*t.height/c,k=0,E=0,_=0,T=0,z=0,x=Math.floor(y),S=Math.floor(m),N=d?Math.ceil(f):x+1,L=d?Math.ceil(b):S+1;for(let M=S;M<Math.min(L,t.height);M++)for(let A=x;A<Math.min(N,t.width);A++){let C=d?(Math.min(A+1,f)-Math.max(A,y))*(Math.min(M+1,b)-Math.max(M,m)):1,P=((t.y+M)*e.width+t.x+A)*4,R=e.data[P+3];k+=C,E+=C*R,_+=C*R*e.data[P],T+=C*R*e.data[P+1],z+=C*R*e.data[P+2]}if(E<=0||E/k<128)continue;let D=((p+g)*s+u+w)*4;o.data[D]=Math.round(_/E),o.data[D+1]=Math.round(T/E),o.data[D+2]=Math.round(z/E),o.data[D+3]=255}return o};function ho(e,t,n=52,s=2,a){let r=Et(e);return r?Jt(e,r,a??Math.min(t/r.height,(n-4)/r.width),n,s):Me(n,n)}function bo(e,t){let n=Math.max(1,Math.floor(t)),s=Me(e.width*n,e.height*n);for(let a=0;a<s.height;a++)for(let r=0;r<s.width;r++){let o=(Math.floor(a/n)*e.width+Math.floor(r/n))*4;s.data.set(e.data.subarray(o,o+4),(a*s.width+r)*4)}return s}var ja=e=>{let t=-1,n=-1;for(let s=0;s<e.height;s++)for(let a=0;a<e.width;a++)if(e.data[(s*e.width+a)*4+3]!==0){t<0&&(t=s),n=s;break}return t<0?null:{top:t,bottom:n}},Zt=(e,t,n,s)=>{let a=e.width*4;n.data.set(e.data.subarray(t*a,t*a+a),s*a)};function Ya(e){let t=1/0,n=[0,0,0];for(let s=0;s<e.data.length;s+=4){if(e.data[s+3]===0)continue;let a=e.data[s]+e.data[s+1]+e.data[s+2];a<t&&(t=a,n=[e.data[s],e.data[s+1],e.data[s+2]])}return n}function Ct(e,t){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s},r=(o,l)=>o>=0&&l>=0&&o<n&&l<s&&e.data[(l*n+o)*4+3]>0;for(let o=0;o<s;o++)for(let l=0;l<n;l++)!r(l,o)||r(l-1,o)&&r(l+1,o)&&r(l,o-1)&&r(l,o+1)||a.data.set([t[0],t[1],t[2]],(o*n+l)*4);return a}function Xa(e){let t=ja(e);if(!t)return 0;let n=Math.max(1,t.top+Math.floor((t.bottom-t.top)/2)),s=t.bottom-2,a=Math.min(n,t.bottom),r=1/0,o=e.width*4;for(let l=n;l<=s;l++){let c=0;for(let u=0;u<e.width;u++){let p=l*o+u*4,d=p-o;(e.data[p]!==e.data[d]||e.data[p+1]!==e.data[d+1]||e.data[p+2]!==e.data[d+2]||e.data[p+3]!==e.data[d+3])&&c++}c<=r&&(r=c,a=l)}return a}function Ja(e,t){let n=Me(e.width,e.height);for(let s=0;s<e.height;s++)s!==0&&(s<=t?Zt(e,s-1,n,s):Zt(e,s,n,s));return n}function yo(e,t){let n=Me(e.width,e.height);for(let s=0;s<e.height;s++)s<t-1?Zt(e,s+1,n,s):Zt(e,s,n,s);return n}function za(e,t){let n=Me(e.width,e.height),s=ja(e);if(!s)return n;let a=s.bottom-s.top+1;for(let r=0;r<e.height;r++){let o=t*(r<s.top+a/3?2:r<s.top+2*a/3?1:0);for(let l=0;l<e.width;l++){let c=l+o;if(c<0||c>=e.width)continue;let u=(r*e.width+l)*4;n.data.set(e.data.subarray(u,u+4),(r*e.width+c)*4)}}return n}function Za(e){let t=Ya(e),n=Xa(e);return[e,Ct(Ja(e,n),t),Ct(yo(e,n),t)]}function es(e){let t=Ya(e);return[e,Ct(za(e,-1),t),Ct(za(e,1),t)]}function Rt(e,t=2){let n=e.reduce((r,o)=>r+o.width,0),s=Me(n,e[0]?.height??0),a=0;for(let r of e){for(let o=0;o<r.height;o++)s.data.set(r.data.subarray(o*r.width*4,(o+1)*r.width*4),(o*n+a)*4);a+=r.width}return bo(s,t)}var vo=e=>{let{width:t,height:n}=e,s=new Uint8Array(t*n),a=(r,o)=>r>=0&&o>=0&&r<t&&o<n&&e.data[(o*t+r)*4+3]>=128?1:0;for(let r=0;r<n;r++)for(let o=0;o<t;o++){if(!a(o,r))continue;let l=0;for(let c=-1;c<=1;c++)for(let u=-1;u<=1;u++)(u||c)&&(l+=a(o+u,r+c));l>=2&&(s[r*t+o]=1)}return s};function Un(e,t=16){let n=e.map(vo),s=new Int32Array(4096),a=new Int32Array(4096),r=[];e.forEach((g,w)=>{for(let y=0;y<g.width*g.height;y++){if(!n[w][y])continue;let f=g.data[y*4],m=g.data[y*4+1],b=g.data[y*4+2],k=f>>4<<8|m>>4<<4|b>>4;s[k]++===0&&(a[k]=f<<16|m<<8|b,r.push(k))}});let o=r.map(g=>({c:[a[g]>>16,a[g]>>8&255,a[g]&255],w:Math.ceil(Math.sqrt(s[g]))})),l=g=>{let w=-1,y=0;for(let f=0;f<3;f++){let m=255,b=0;for(let k of g)m=Math.min(m,k.c[f]),b=Math.max(b,k.c[f]);b-m>w&&(w=b-m,y=f)}return{spread:w,channel:y}},c=o.length?[o]:[];for(;c.length<t;){let g=-1,w=0;if(c.forEach((_,T)=>{if(_.length<2)return;let{spread:z}=l(_);z>w&&(w=z,g=T)}),g<0)break;let y=c[g],{channel:f}=l(y),m=[...y].sort((_,T)=>_.c[f]-T.c[f]),b=m.reduce((_,T)=>_+T.w,0)/2,k=0,E=1;for(let _=0;_<m.length-1&&(k+=m[_].w,E=_+1,!(k>=b));_++);c.splice(g,1,m.slice(0,E),m.slice(E))}let u=c.map(g=>{let w=g.reduce((y,f)=>y+f.w,0);return[0,1,2].map(y=>Math.round(g.reduce((f,m)=>f+m.w*m.c[y],0)/w))}),p=u[0]??[0,0,0];for(let g of u)g[0]+g[1]+g[2]<p[0]+p[1]+p[2]&&(p=g);let d=new Map;return e.map((g,w)=>{let y=Me(g.width,g.height);for(let f=0;f<g.width*g.height;f++){if(!n[w][f])continue;let m=g.data[f*4],b=g.data[f*4+1],k=g.data[f*4+2],E=m<<16|b<<8|k,_=d.get(E);if(_===void 0){let T=1/0;_=0,u.forEach((z,x)=>{let S=(z[0]-m)**2+(z[1]-b)**2+(z[2]-k)**2;S<T&&(T=S,_=x)}),d.set(E,_)}y.data.set([...u[_],255],f*4)}return Ct(y,p)})}var _n=(e,t,n)=>{let s=[],a=-1,r=-1;for(let o=0;o<e.length;o++)e[o]&&(a>=0&&o-r>t&&(s.push([a,r+1]),a=-1),a<0&&(a=o),r=o);return a>=0&&s.push([a,r+1]),s.filter(([o,l])=>l-o>=n)},ts=e=>e.map(t=>t==="egg"?2:4);function en(e,t,n=!0,s=!1){let a=$n(e),{width:r,height:o}=a,l=new Uint8Array(r*o);for(let x=0;x<l.length;x++)l[x]=a.data[x*4+3]>=128?1:0;let c=Math.max(r,o)/1024,u=Math.round(10*c),p=Math.round(16*c),d=[],g=(x,S,N,L)=>{let D=new Int32Array(o);for(let M=N;M<L;M++)for(let A=x;A<S;A++)D[M]+=l[M*r+A];return D},w=(x,S,N,L)=>{let D=new Int32Array(r);for(let M=N;M<L;M++)for(let A=x;A<S;A++)D[A]+=l[M*r+A];return D},y=(x,S,N)=>{let L=S;for(let D=S;D<N;D++)x[D]<x[L]&&(L=D);return L},f=(x,S,N)=>{let L=x.r-x.l,D=x.b-x.t,M=new Int32Array(L*D).fill(-1),A=[],C=(v,I)=>l[(x.t+I)*r+x.l+v]===1;for(let v=0;v<L*D;v++){if(M[v]!==-1||!C(v%L,Math.floor(v/L)))continue;let I={size:0,l:L,t:D,r:0,b:0};M[v]=A.length;let H=[v];for(;H.length;){let $=H.pop(),q=$%L,W=($-q)/L;I.size++,I.l=Math.min(I.l,q),I.r=Math.max(I.r,q+1),I.t=Math.min(I.t,W),I.b=Math.max(I.b,W+1);for(let[U,Z]of[[q-1,W],[q+1,W],[q,W-1],[q,W+1]]){let te=Z*L+U;U>=0&&Z>=0&&U<L&&Z<D&&M[te]===-1&&C(U,Z)&&(M[te]=A.length,H.push(te))}}A.push(I)}let P=Math.max(...A.map(v=>v.size)),R=A.map(v=>v.size!==P&&(x.l+v.l===S||x.l+v.r===N));for(let v=0;v<L*D;v++)M[v]>=0&&R[M[v]]&&(a.data[((x.t+Math.floor(v/L))*r+x.l+v%L)*4+3]=0);let B=A.filter((v,I)=>!R[I]);return{l:x.l+Math.min(...B.map(v=>v.l)),t:x.t+Math.min(...B.map(v=>v.t)),r:x.l+Math.max(...B.map(v=>v.r)),b:x.t+Math.max(...B.map(v=>v.b))}},m=g(0,r,0,o),b=_n(m,u,p);if(!b.length)return null;let k=()=>b.map(([x,S])=>S-x).sort((x,S)=>x-S)[Math.floor(b.length/2)],E=.3*k();for(b=b.filter(([x,S])=>S-x>=E),s&&(b=b.slice(0,t.length));b.length<t.length;){let x=0;b.forEach(([A,C],P)=>{C-A>b[x][1]-b[x][0]&&(x=P)});let[S,N]=b[x];if(N-S<1.4*k())return null;let L=S+Math.floor(.3*(N-S)),D=S+Math.floor(.7*(N-S));if(D<=L)return null;let M=y(m,L,D);if(M<=S)return null;b.splice(x,1,[S,M],[M,N])}if(b.length!==t.length)return null;let _=[];for(let x=0;x<b.length;x++){let[S,N]=b[x],L=t[x],D=w(0,r,S,N),M=_n(D,u,p);if(!M.length)return null;let A=M.map(([v,I])=>{let H=g(v,I,S,N),$=S;for(;!H[$];)$++;let q=N-1;for(;!H[q];)q--;return{h:q-$+1,w:I-v}}),C=Math.max(...A.map(v=>v.h)),P=Math.max(...A.map(v=>v.w));if(M=M.filter((v,I)=>A[I].h>=.6*C||A[I].w>=.6*P),M.length>2*L)return null;let R=!1;if(M.length>L)d.push(`row ${x+1}: ${M.length} drawings, first ${L} used`),M=M.slice(0,L);else if(M.length<L){if(!n)return null;let v=M[0][0],I=M[M.length-1][1],H=(I-v)/L;if(!M.some(([q,W])=>W-q>1.5*H))return null;let $=[v];for(let q=1;q<L;q++)$.push(y(D,Math.floor(v+(q-.15)*H),Math.floor(v+(q+.15)*H)));$.push(I),M=$.slice(0,-1).map((q,W)=>[q,$[W+1]]),R=!0,d.push(`row ${x+1}: drawings touch, split at ${$.slice(1,-1).join(", ")}`)}let B=[];for(let[v,I]of M){let H=(W,U)=>{let Z=g(v,I,W,U),te=w(v,I,W,U),se=W;for(;se<U&&!Z[se];)se++;if(se===U)return null;let ie=U-1;for(;!Z[ie];)ie--;let ye=v;for(;!te[ye];)ye++;let he=I-1;for(;!te[he];)he--;return{l:ye,t:se,r:he+1,b:ie+1,rows:Z}},$=H(S,N);if(!$)return null;let q=_n($.rows.subarray(0,$.b),1,1).filter(([,W])=>W>$.t);if(q.length>1){let[W,U]=q[q.length-1],Z=w(v,I,W,U),te=v;for(;!Z[te];)te++;let se=I-1;for(;!Z[se];)se--;let ie=se-te+1;U-W<=.12*($.b-$.t)&&ie>=4*(U-W)&&ie>=.4*($.r-$.l)&&($=H(S,q[q.length-2][1])??$)}if(R){let W=v===M[0][0]?-1:v,U=I===M[M.length-1][1]?-1:I;$={...$,...f($,W,U)}}B.push({x:$.l,y:$.t,width:$.r-$.l,height:$.b-$.t})}_.push(B)}let T=t.length===5?0:-1;if(T===0&&_[0].length>1){let[x,S]=[_[0][0].height,_[0][1].height];Math.abs(x-S)>.25*Math.max(x,S)&&d.push(`egg row sizes differ: ${x} vs ${S}`)}let z=x=>x[x.length>=4?1:0];for(let x=T+2;x<_.length;x++){let[S,N]=[z(_[x]).height,z(_[x-1]).height];S<N*.95&&d.push(`row ${x+1} (${S}) smaller than row ${x} (${N})`)}for(let x=T+1;x<_.length;x++){let S=_[x];if(S.length<2)continue;let[N,L]=[z(S).height,S[S.length-1].height];Math.abs(N-L)>.3*Math.max(N,L)&&d.push(`row ${x+1}: front ${N} vs side ${L}`)}return{cells:_,notes:d,keyed:a}}function ns(e,t,n){let s=t.keyed??$n(e),a=t.cells.map((c,u)=>{let p=n[u];if(!p)return[];let d=Math.min(Qa[p]/Math.max(...c.map(g=>g.height)),48/Math.max(...c.map(g=>g.width)));return c.map(g=>Jt(s,g,d,52,2))}),r=Un(a.flat()),o={},l=0;return a.forEach((c,u)=>{let p=r.slice(l,l+c.length);l+=c.length;let d=n[u];if(!d||!p.length)return;let g=w=>Rt(d==="egg"?es(p[w]):Za(p[w]));d==="egg"?o[d]={image:g(0)}:p.length>=4?o[d]={image:g(1),happy:g(0),grumpy:g(2),side:g(3)}:o[d]=p.length>1?{image:g(0),side:g(1)}:{image:g(0)}}),o}var _e=96,Xe=[5,3],wo=80,So=48;function ko(e){let t=[[[...Xe],!1],[[4,4],!1],[[...Xe],!0]];for(let[s,a]of t){let r=en(e,s,a),o=r?.cells.flat();if(r&&o)return{front:o.slice(0,Xe[0]),facing:o.slice(Xe[0]),keyed:r.keyed}}let n=en(e,[3],!1,!0);return n?{front:n.cells[0],facing:[],keyed:n.keyed}:null}function as(e){let t=ko(e);if(!t)return null;let{front:n,facing:s,keyed:a}=t,r=Math.max(...n.map(d=>d.width)),o=Math.max(...s.map(d=>d.width))-r/2,l=Math.min(wo/Math.max(...[...n,...s].map(d=>d.height)),So/r,o>0?(_e/2-2)/o:1/0),c=Math.max(1,Math.round(r*l)),u=Math.floor((_e-c)/2)+c,p=Un([...n.map(d=>Jt(a,d,l,_e,0)),...s.map(d=>Jt(a,d,l,_e,0,u))]);return p.every(d=>Et(d))?Rt(p,1):null}var tn=(e,t)=>{let n=e.height,s=Me(n,n);for(let a=0;a<n;a++){let r=(a*e.width+t*n)*4;s.data.set(e.data.subarray(r,r+n*4),a*n*4)}return s},Ba=[.12,.42],xo=50,Eo=45,Ga=50,Co=.04,rt=e=>e>>16,ot=e=>e>>8&255,it=e=>e&255,Ve=e=>.299*rt(e)+.587*ot(e)+.114*it(e),Ka=e=>Math.max(rt(e),ot(e),it(e))-Math.min(rt(e),ot(e),it(e)),On=(e,t)=>Math.hypot(rt(e)-rt(t),ot(e)-ot(t),it(e)-it(t)),Fn=e=>e.reduce((t,n)=>Ve(n)<Ve(t)?n:t);function Ro(e){let t=Et(e);if(!t)return null;let{width:n,height:s,data:a}=e,r=new Int32Array(n*s).fill(-1);for(let u=0;u<n*s;u++)a[u*4+3]>=128&&(r[u]=a[u*4]<<16|a[u*4+1]<<8|a[u*4+2]);let o=t.y+Math.round(t.height*Ba[0]),l=t.y+Math.round(t.height*Ba[1]),c=new Map;for(let u=o*n;u<l*n;u++){let p=r[u];p>=0&&c.set(p,(c.get(p)??0)+1)}return{colours:r,width:n,z0:o,z1:l,counts:c}}var Ln=(e,t)=>{let n=e.map(a=>a%t),s=e.map(a=>Math.floor(a/t));return{x0:Math.min(...n),x1:Math.max(...n),y0:Math.min(...s),y1:Math.max(...s)}};function ss(e,t,n){let{colours:s,width:a,z0:r,z1:o}=e,l=n?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]],c=new Uint8Array(s.length),u=[];for(let p=r*a;p<o*a;p++){if(c[p]||s[p]<0||!t(s[p]))continue;c[p]=1;let d=[p],g=[],w=!1;for(;d.length;){let y=d.pop();g.push(y);for(let[f,m]of l){let b=y%a+f,k=Math.floor(y/a)+m,E=k*a+b;b<0||b>=a||k<r||k>=o||s[E]<0?w=!0:!c[E]&&t(s[E])&&(c[E]=1,d.push(E))}}u.push({pixels:g,open:w})}return u}var rs=(e,t)=>e.x1-e.x0<10&&e.y1-e.y0<8&&e.y1-e.y0+1>=t;function Mo(e){return[...e.counts].filter(([,n])=>n>=30).sort((n,s)=>s[1]-n[1]).slice(0,4).map(([n])=>n).flatMap(n=>ss(e,s=>On(s,n)>xo,!1).flatMap(({pixels:s,open:a})=>{let r=Ln(s,e.width),o=s.map(c=>e.colours[c]);if(a||s.length<2||s.length>40||!rs(r,2))return[];if(Math.max(...o.map(c=>On(c,n)))<90)return[];let l=Fn(o);return[{pixels:s,...r,fill:n,lid:Ve(n)>Ve(l)+40?l:null}]}))}function Io(e){let t=[...e.counts.values()].reduce((l,c)=>l+c,0),n=[...e.counts].filter(([,l])=>l>=t*Co).map(([l])=>l);if(!n.length)return[];let s=l=>l>=0&&n.every(c=>On(l,c)>Eo),a=Fn(n),{width:r,colours:o}=e;return ss(e,l=>Ka(l)>=Ga&&s(l),!0).flatMap(({pixels:l})=>{if(l.length<2||l.length>36)return[];let c=Ln(l,r),u=new Set(l),p=[...l];for(;p.length;){let f=p.pop();for(let m of[1,-1,r,-r,r+1,r-1,1-r,-1-r]){let b=f+m,k=b%r,E=Math.floor(b/r);u.has(b)||k<c.x0-1||k>c.x1+1||E<c.y0-1||E>c.y1+1||E<e.z0||E>=e.z1||!s(o[b])||(u.add(b),p.push(b))}}let d=[...u],g=Ln(d,r);if(!rs(g,1))return[];let w=new Map;for(let f of d){let m=f+r;for(;u.has(m);)m+=r;let b=o[m]??-1;b>=0&&w.set(b,(w.get(b)??0)+1)}let y=[...w].sort((f,m)=>m[1]-f[1])[0]?.[0];return y===void 0||Ka(y)>=Ga&&!n.includes(y)?[]:Math.abs(Ve(y)-Ve(Fn(d.map(f=>o[f]))))<60?[]:[{pixels:d,...g,fill:y,lid:Ve(y)>Ve(a)+60?a:null}]})}function qa(e){let t=null;for(let n of e)for(let s of e){let a=s.x0-n.x1-1,r=Math.abs(n.y0+n.y1-s.y0-s.y1)/2,o=Math.max(n.pixels.length,s.pixels.length)/Math.min(n.pixels.length,s.pixels.length);if(a<2||a>20||r>1.5||o>2.5||Math.abs(n.y1-n.y0-(s.y1-s.y0))>2)continue;let l=n.pixels.length+s.pixels.length-r*4-o*3;(!t||l>t.score)&&(t={pair:[n,s],score:l})}return t?.pair??null}function Va(e){let t=Ro(e);return t?qa(Mo(t))??qa(Io(t)):null}var Ao=(e,t)=>e.every((n,s)=>Math.abs(n.y0+n.y1-t[s].y0-t[s].y1)<=4&&Math.abs(n.x1-n.x0-(t[s].x1-t[s].x0))<=2)&&Math.abs(e[1].x0-e[0].x1-(t[1].x0-t[0].x1))<=2;function No(e){let t=e.height,n=Math.floor(e.width/t),s=n===Xe[0]+Xe[1]?Xe[0]:Math.min(n,3),a=n?Va(tn(e,0)):null;if(!a)return null;let r=Array.from({length:n},(o,l)=>{let c=Me(t,t),u=l<s?Va(tn(e,l)):null;if(!u||!Ao(u,a))return c;let p=(d,g)=>c.data.set([rt(g),ot(g),it(g),255],d*4);for(let d of u){for(let w of d.pixels)p(w,d.fill);if(d.lid===null)continue;let g=d.y0+Math.floor((d.y1-d.y0+1)*.6);for(let w=d.x0;w<=d.x1;w++)p(g*t+w,d.lid)}return c});return Rt(r,1)}var Wa=(e,t)=>{let n=Me(e.width,e.height+t.height);return n.data.set(e.data),n.data.set(t.data,e.data.length),n};function os(e){let t=Math.floor(e.width/e.height),n=Array.from({length:t},(r,o)=>Xa(tn(e,o))),s=r=>Rt(n.map((o,l)=>Ja(tn(r,l),o)),1),a=No(e);return{body:Wa(e,s(e)),blink:a?Wa(a,s(a)):null}}var Po=.25,To=20;function _o(e){let{width:t,height:n,data:s}=e,a=u=>s[u*4+3]>0,r=0,o=0,l=0,c=0;for(let u=0;u<n;u++)for(let p=0;p<t;p++){let d=u*t+p,g=p===0||u===0||p===t-1||u===n-1;g&&r++,a(d)&&(l++,g&&o++,(p>0&&!a(d-1)||p<t-1&&!a(d+1)||u>0&&!a(d-t)||u<n-1&&!a(d+t))&&c++)}return o<=r*Po&&c<=Math.sqrt(l)*To}function is(e,t){let n=$n(e);if(!Et(n)||!_o(n))return null;let s=Un([ho(n,Qa[t])])[0];return Et(s)?Rt(t==="egg"?es(s):Za(s)):null}var ls=104,lt=416,cs="#ececec",Oo=512,us=1024,Fo=512,Lo=1024;function Oe(e){return new Promise((t,n)=>{let s=new Image;s.onload=()=>t(s),s.onerror=()=>n(new Error("That file is not a picture this browser can open.")),s.src=e})}function Mt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d");if(!s)throw new Error("This browser cannot draw pictures.");return{canvas:n,context:s}}function We(e){let{canvas:t,context:n}=Mt(e.width,e.height);return n.putImageData(new ImageData(new Uint8ClampedArray(e.data),e.width,e.height),0,0),t.toDataURL("image/png")}function Hn(e,t){let n=Math.min(1,t/Math.max(e.naturalWidth,e.naturalHeight));return{width:Math.max(1,Math.round(e.naturalWidth*n)),height:Math.max(1,Math.round(e.naturalHeight*n))}}async function nn(e,t){let n=await Oe(e),{width:s,height:a}=Hn(n,t),r=Mt(s,a);return r.context.drawImage(n,0,0,s,a),r.context.getImageData(0,0,s,a)}async function gs(e,t){let n=is(await nn(e,Oo),t);return n?We(n):null}async function ds(e,t){let n=await nn(e,us),s=en(n,ts(t));if(!s)return null;let a={};for(let[r,o]of Object.entries(ns(n,s,t)))a[r]={image:We(o.image),...o.side?{side:We(o.side)}:{},...o.happy?{happy:We(o.happy)}:{},...o.grumpy?{grumpy:We(o.grumpy)}:{}};return a}async function ps(e){let t=as(await nn(e,us));return t?{image:We(t),frames:t.width/t.height}:null}async function ms(e){let{body:t,blink:n}=os(await nn(e,1/0));return{body:We(t),blink:n?We(n):null}}async function fs(e){let t=await Oe(e),{width:n,height:s}=Hn(t,Fo),{canvas:a,context:r}=Mt(n,s);return r.fillStyle=cs,r.fillRect(0,0,n,s),r.drawImage(t,0,0,n,s),a.toDataURL("image/jpeg",.9)}async function hs(e){let t=await Oe(e),{width:n,height:s}=Hn(t,Lo),{canvas:a,context:r}=Mt(n,s);r.drawImage(t,0,0,n,s);let o=a.toDataURL("image/webp",.9);return o.length<e.length?o:e}async function Je(e,t=0){let n=await Oe(e),s=Math.min(n.naturalHeight,ls),{canvas:a,context:r}=Mt(lt,lt);return r.fillStyle=cs,r.fillRect(0,0,lt,lt),r.imageSmoothingEnabled=!1,r.drawImage(n,0,t*ls,s,s,0,0,lt,lt),a.toDataURL("image/png")}var an={feed:"\u{1F35D}",play:"\u{1F3B2}",rest:"\u{1F319}",pet:"\u{1F49B}",warm:"\u{1F9E3}",talk:"\u{1F4AC}",listen:"\u{1F442}"},sn={feed:"saucelings.action.feed",play:"saucelings.action.play",rest:"saucelings.action.rest",pet:"saucelings.action.pet",warm:"saucelings.action.warm",talk:"saucelings.action.talk",listen:"saucelings.action.listen"};function rn(e){return e.stage==="egg"?Mn:Rn}function on(e,t){return e==="feed"&&t.hunger||e==="play"&&t.mood||e==="warm"&&t.warmth}function ln(e){let[t,n]=G(()=>Date.now());return Y(()=>{let s=window.setInterval(()=>n(Date.now()),e);return()=>window.clearInterval(s)},[e]),[t,de(()=>n(Date.now()),[])]}function It(e){let[t,n]=G(null),s=j(void 0);Y(()=>()=>window.clearTimeout(s.current),[]);let a=de(r=>{window.clearTimeout(s.current),n(r),s.current=window.setTimeout(()=>n(null),e)},[e]);return[t,a]}var cn=2e3;function un(e,t,n){let s=e.actionCooldowns[t],a=s?Date.parse(s)-n:0;return a>0?Math.ceil(a/6e4):0}function At(e){return e.meters.warmth??_a}function Nt(e,t){let n=t-Date.parse(e.createdAt);return Math.max(0,Math.min(100,Math.floor(n/In*100)))}function bs(e){return e?.stage!=="egg"||e.careActionCount<1?null:Date.parse(e.createdAt)+In}function $o(e){let t=e;if(typeof t=="string")try{t=JSON.parse(t)}catch{return""}let n=t?.extensions,s=n?.imageAppearanceEnabled===!0?n.imageAppearance:null,a=typeof s=="string"&&s.trim()?s:n?.appearance;return typeof a=="string"?a:""}function Dn(e){return{queryKey:["saucelings","caretaker-card",e],queryFn:async()=>{let t=await ke(`/api/characters/${encodeURIComponent(e)}`);return{avatar:typeof t.avatarPath=="string"&&/^\/(?![/\\])/u.test(t.avatarPath)?t.avatarPath:null,appearance:$o(t.data)}},staleTime:5*6e4,retry:!1}}function ct(e,t){return le({...Dn(e),enabled:t}).data?.avatar??null}function ut(e){let t=le({queryKey:["saucelings","figure",e],queryFn:()=>V(`/figure/${encodeURIComponent(e??"")}`),enabled:!!e,staleTime:1/0,retry:!1});return!e||t.isError?null:t.data?t.data.image?t.data:null:void 0}function gn(e,t){let n=t?.image;return le({queryKey:["saucelings","figure-motion",e],queryFn:()=>ms(n??""),enabled:!!(e&&n),staleTime:1/0,retry:!1}).data??null}function ys(e){let[t,n]=G(null),[s,a]=G(!1);return Ge(()=>{let r=t?.closest(".sl-shell")??t;if(!r||typeof ResizeObserver>"u")return;let o=()=>a(r.clientWidth>=e*parseFloat(getComputedStyle(document.documentElement).fontSize));o();let l=new ResizeObserver(o);return l.observe(r),()=>l.disconnect()},[t,e]),[n,s]}var Uo=[];function dn(e,t){let n=le({queryKey:["saucelings","caretaker-sprites",e],queryFn:async()=>{let s=await ke(`/api/sprites/${encodeURIComponent(e)}`);return(Array.isArray(s)?s:[]).flatMap(a=>{let r=a;return typeof r.expression=="string"&&typeof r.url=="string"&&/^\/api\/sprites\//u.test(r.url)?[{expression:r.expression,url:r.url}]:[]})},enabled:t,staleTime:3e5,retry:!1});return t&&n.data||Uo}function gt({name:e,src:t,small:n,box:s}){let a=s?"sl-avatar sl-avatar--box":n?"sl-avatar sl-avatar--small":"sl-avatar";return t?i("img",{className:a,src:t,alt:""}):i("span",{className:a,"aria-hidden":"true",children:e.trim().charAt(0).toUpperCase()||"?"})}var Ho=["calm","happy","worried","talking","waving","feeding","playing","tending"],Do={worried:["worried","concerned","sad","anxious"],happy:["happy","smile","laugh","joy"],neutral:["neutral","idle","default","calm"]},zo=/^full[_-]/iu;function Bo(e,t){for(let n of t==="neutral"?["neutral"]:[t,"neutral"])for(let s of Do[n]){let a=e.find(r=>r.expression.toLowerCase().includes(s));if(a)return a.url}return null}function zn(e,t){let n=e.filter(a=>!zo.test(a.expression)),s=n.length>0?n:e;return Bo(s,t)??s[0]?.url??null}var Go={feed:"feeding",play:"playing",rest:"tending",pet:"tending",warm:"tending",talk:"talking"};function pn({gaps:e,line:t,speaking:n,cheering:s,caring:a}){let r=a&&Go[a];return r||(n&&(t?.kind==="caretaker-change"||t?.kind==="return-from-album")?"waving":s?"happy":n?"talking":e.hunger||e.mood||e.warmth||t?.kind==="absence"?"worried":"calm")}function mn(e,t,n,s=null){if(e)return{figure:s?.body??e.image,rows:s?2:1,frames:e.frames,frame:Ko(n,e.frames),blink:s?.blink??null};let a=e===null?zn(t,vs(n)):null;return a?{src:a}:null}function vs(e){return e==="worried"?"worried":e==="calm"||e==="talking"?"neutral":"happy"}function Ko(e,t){let n=Ho.indexOf(e);return n<t?n:["neutral","happy","worried"].indexOf(vs(e))}var qo={"fed-fine":"feed","fed-badly":"feed",overfed:"feed",played:"play",cuddled:"pet","kept-warm":"warm",chatted:"talk"};function ws(e){return(e&&qo[e])??null}var Vo={rigamuffin:"a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",fluttino:"a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",lentino:"a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",shellbini:"a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",tortellump:"a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",mossaboo:"a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",puddlepip:"a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",snufflump:"a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",burrowl:"a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",prismite:"a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",thundrake:"a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",clockrit:"a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",wickwisp:"a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",cauldrop:"a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",webbit:"a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black"},fn="Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.",ks="Simple, bold, readable face with small eyes and a small mouth.",Bn="Plain flat white background.",dt="text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering",Wo=`${dt}, human, person, cropped`,xs=e=>e.trim()?`${dt}, cropped`:Wo,Es=`${dt}, shadow, ground, floor, scenery, multiple creatures, human, person`,Qo=`${Es}, face, eyes, mouth, nest`,Cs=`${dt}, shadow, ground, scenery, overlapping drawings, human, person`,Rs=`${dt}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`,Ms=`${dt}, characters, people, person, creatures, animals, pets`,Is=e=>e==="egg"?Qo:Es,jo="Same creature as the reference image: keep its shape, colours and markings.";function As(e,t,n=""){let s=Ue(e),a=n.replace(/\s+/gu," ").trim(),r=e.lockedStage??e.stage,o=e.design,l=o?`${xt(o.kind)}: ${(o.stages[r]??o.look).replace(/[.\s]+$/u,"")}; its colours are ${o.colours.join(", ")}`:Vo[e.species],c=o?"":r==="elder"?", wearing little round spectacles and a few white whiskers":r==="hatchling"?", small and round":"";return[fn,`A little virtual pet creature: ${l}.`,`${s?`Its face and pose look ${s.readsAs}. `:""}Life stage: ${r}${c}.`,t?jo:"",ks,...a?[`Full body. ${a.charAt(0).toUpperCase()}${a.slice(1)}${/[.!?]$/u.test(a)?"":"."}`]:["One single creature, full body, centred.",Bn]].filter(Boolean).join(" ")}var Yo=400;function Ns(e,t,n,s){let a=t.replace(/\s+/gu," ").trim().slice(0,Yo).replace(/[.\s]+$/u,"");return[fn,...s,"Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",a?`What ${e} looks like: ${a}.`:"",n>0?`Keep ${e}'s hair, face, outfit and colours from the reference image${n>1?"s":""}.`:"",Bn].filter(Boolean).join(" ")}function Ss(e,t,n){return Ns(e,t,n,[`Eight drawings of the same character, ${e}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,"The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.","The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands."])}function Xo(e,t,n){return Ns(e,t,n,[`Three drawings of the same character, ${e}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`])}function Ps(e,t,n,s){let a=[{prompt:Ss(e,t,n.length),references:n}];return n.length>0&&a.push({prompt:Ss(e,t,0),references:[]}),s&&a.push({prompt:Xo(e,t,0),references:[]}),a}var Ts={earlier:"Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",before:"The reference image shows what this creature was before it evolved: keep a hint of its colours."};function _s(e,t,n){let s=(e.stages[t]??e.look).replace(/[.\s]+$/u,"");return[fn,t==="egg"?`The egg of a small creature, ${xt(e.kind)}: ${s}.`:`A small creature, ${xt(e.kind)}, at its ${t} stage: ${s}.`,`Its colours are ${e.colours.join(", ")}.`,n?Ts[n]:"",t==="egg"?"One single egg with no face, upright and centred, filling most of the picture.":`${ks} One single creature, full body, seen from the front and centred, filling most of the picture.`,Bn].filter(Boolean).join(" ")}function Gn(e){return $e.filter(t=>e.stages[t])}var Jo="The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.",Zo="Plain flat white background everywhere.";function Os(e,t){let n=Gn(e),s=c=>(e.stages[c]??e.look).replace(/[.\s]+$/u,""),a=n[0]==="egg",r=n.reduce((c,u)=>c+(u==="egg"?2:4),0),o=n.map((c,u)=>c==="egg"?`Row ${u+1}, the egg, only two drawings. Left: the whole egg, ${s(c)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`:`Row ${u+1}, ${c}, four drawings: ${s(c)}.`),l="and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";return[`${fn} A sprite sheet of one small creature, ${xt(e.kind)}: ${e.look} Its colours are ${e.colours.join(", ")}.${t?` ${Ts[t]}`:""}`,"",a?`Lay out ${r} drawings in ${n.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${n.length}, ${l}`:`Lay out ${r} drawings in ${n.length} rows: exactly four drawings in each row, ${l}`,...o,"",`${a?`In rows 2 to ${n.length}`:"In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${a?"Growth must read clearly: the hatchling is small and round and the elder is full size.":"The elder is as big as the adult and looks older."}`,"",Jo,"",Zo].join(`
`)}function Kn(e){if(e.stage==="egg")return Ha;if(!e.design)return Ua[e.species];let[t,n,s]=e.design.colours;return`a cosy little room in ${t}, ${n} and ${s} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`}var ei="Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";function Fs(e){return`${ei} A wide side-on scene of ${e.trim().replace(/[.\s]+$/u,"")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`}var hn=globalThis.__MARINARA_HOST__,me=hn&&hn.version===1&&hn.modules?hn.modules["react-dom"]:void 0;if(!me)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var Mu=me.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Iu=me.browser,Ls=me.createPortal,Au=me.default,Nu=me.flushSync,Pu=me.preconnect,Tu=me.prefetchDNS,_u=me.preinit,Ou=me.preinitModule,Fu=me.preload,Lu=me.preloadModule,$u=me.requestFormReset,Uu=me.unstable_batchedUpdates,Hu=me.useFormState,Du=me.useFormStatus,zu=me.version;function Ie({text:e,label:t,children:n}){let[s,a]=G(null),[r,o]=G(null),l=j(null),c=j(null),u=xa();Ge(()=>{let g=l.current?.getBoundingClientRect(),w=c.current?.getBoundingClientRect();if(!s||!g||!w){o(null);return}let y=8,f=g.top-6-w.height;o({top:f>=y?f:g.bottom+6,left:Math.max(y,Math.min(g.left+g.width/2-w.width/2,window.innerWidth-y-w.width))})},[s]),Y(()=>{if(!s)return;let g=y=>{let f=y.target;!l.current?.contains(f)&&!c.current?.contains(f)&&a(null)},w=y=>y.key==="Escape"&&a(null);return document.addEventListener("pointerdown",g),document.addEventListener("keydown",w),()=>{document.removeEventListener("pointerdown",g),document.removeEventListener("keydown",w)}},[s]);let p=()=>a(g=>g??"shown"),d=()=>a(g=>g==="shown"?null:g);return h("span",{className:"sl-with-help",children:[n,i("button",{ref:l,type:"button",className:"sl-help","aria-label":t,"aria-expanded":s!==null,"aria-describedby":s?u:void 0,onMouseEnter:p,onMouseLeave:d,onFocus:p,onBlur:d,onKeyDown:g=>{g.key!=="Escape"||!s||(g.preventDefault(),g.stopPropagation(),a(null))},onClick:()=>a(g=>g==="pinned"?null:"pinned"),children:h("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:[i("circle",{cx:"12",cy:"12",r:"10"}),i("path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}),i("path",{d:"M12 17h.01"})]})}),s?Ls(i("div",{ref:c,id:u,role:"tooltip",className:"sl-help-tip",style:r?{top:r.top,left:r.left}:{top:0,left:0,visibility:"hidden"},children:e}),document.body):null]})}var ae=52,De=100,$s=[4,6,8,10,12,14,16,19,22],Qn={hatchling:{t:21,l:12,r:39,m:30},juvenile:{t:13,l:9,r:42,m:25},adult:{t:5,l:7,r:44,m:19},elder:{t:4,l:7,r:44,m:19}},jn={embers:"rise",wisps:"rise",bubbles:"rise",snow:"fall",leaves:"fall",petals:"fall",stars:"twinkle",glints:"twinkle",sparks:"twinkle"},bn={ember:["#2a0f0a","#8a2a12","#d9581e","#ff9a3c","#ffe08a"],frost:["#0f1a33","#2c5a9a","#5fa0e0","#a8dcff","#f2fbff"],moss:["#10220f","#2f5e1e","#5c9a2e","#9fd35a","#e4f7a8"],dusk:["#170f2e","#46287a","#7d4fc4","#b58cff","#ecdcff"],gilded:["#2a1a05","#7a5410","#c99a1e","#ffd84a","#fff6c2"],shade:["#0e0c14","#2e2a3c","#575070","#8f86ad","#cfc8e6"],bloom:["#2e0f1e","#8a3060","#d9609a","#ff9fcb","#ffe6f2"],storm:["#12141f","#2e3550","#56607f","#8d96b5","#d6dcef"],tide:["#08202a","#145a6a","#2a9a9a","#6ad8c8","#d8fff4"],spark:["#2a1f05","#8a6a10","#e0c020","#fff050","#ffffe0"]},Gs=["#1c1917","#57534e","#a8a29e","#e7e5e4","#fafaf9"],ti={ember:"#ff7a3d",frost:"#8fd8ff",moss:"#7fd35a",dusk:"#b58cff",gilded:"#ffd84a",shade:"#a99cc8",bloom:"#ff9fcb",storm:"#f5ec5a",tide:"#5fe0d0"};var Ks={"webbit:elder":[42,33]};function Ot(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d",{willReadFrequently:!0});if(!s)throw new Error("No 2D canvas.");return s.imageSmoothingEnabled=!1,[n,s]}var Yn=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),Us=new WeakMap;function Xn(e,t,n){let s=Us.get(e);s||Us.set(e,s=new Map);let a=s.get(t);return a||s.set(t,a=n()),a}function ni(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function qn(e,t,n=0){return Xn(e,`t|${t}|${n}`,()=>{let s=(t==="neutral"?Gs:bn[t]).map(Yn),[a,r]=Ot(e.width,e.height);r.drawImage(e,0,0);let o=r.getImageData(0,0,a.width,a.height),l=o.data;for(let c=0;c<l.length;c+=4){if(!l[c+3])continue;let u=Math.min(1,(.2126*l[c]+.7152*l[c+1]+.0722*l[c+2])/255+n),p=Math.min(3,Math.floor(u*4)),d=(u-p/4)*4;for(let g=0;g<3;g++)l[c+g]=Math.round(s[p][g]+d*(s[p+1][g]-s[p][g]))}return r.putImageData(o,0,0),a})}function pt(e,t,n,s,a){return Xn(e,`s|${t}|${n}|${s}|${a}`,()=>{let r=e.getContext("2d").getImageData(t,n,ae,ae).data,o=ae+2*s,l=ae+2*s,c=new Uint8Array(o*l);for(let f=0;f<ae;f++)for(let m=0;m<ae;m++)c[(f+s)*o+m+s]=r[(f*ae+m)*4+3]?1:0;for(let f=0;f<s;f++){let m=c.slice();for(let b=0;b<l;b++)for(let k=0;k<o;k++){let E=b*o+k;!c[E]&&(k>0&&c[E-1]||k<o-1&&c[E+1]||b>0&&c[E-o]||b<l-1&&c[E+o])&&(m[E]=1)}c=m}let[u,p]=Ot(o,l),d=p.createImageData(o,l),[g,w,y]=Yn(a);for(let f=0;f<c.length;f++)c[f]&&d.data.set([g,w,y,255],f*4);return p.putImageData(d,0,0),u})}var ai=[[[0,0],[-1,-1],[-1,-2],[-2,-3],[-2,-4],[-3,-5],[-3,-6],[-4,-7]],[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]],[[0,0],[0,1],[-1,2],[-1,3],[0,4],[-1,5],[-1,6],[-2,7]]];function si(e,t,n,s,a,r){return Xn(e,`c|${t}|${n}|${s}|${r}|${a.cx}|${a.mid}`,()=>{let[o,l]=Ot(ae,ae);l.drawImage(pt(e,t,n,0,"#ffffff"),0,0),l.globalCompositeOperation="source-atop",l.fillStyle=r;for(let c=0;c<s;c++)for(let[u,p]of ai[c])l.fillRect(a.cx+u,a.mid+p,1,1);return o})}function xe(e,t,n,s,a,r=1,o,l){if(r<=0)return;let c=l?l[2]:t.width,u=l?l[3]:t.height,p=o??c;e.save(),e.globalAlpha*=r,a&&(e.translate(2*n+p,0),e.scale(-1,1)),l?e.drawImage(t,l[0],l[1],c,u,n,s,p,u):e.drawImage(t,n,s,p,u),e.restore()}var ri=e=>{let t=Qn[e];return{...t,cx:t.l+t.r>>1,mid:t.t+51>>1}},Wn=class{constructor(){oe(this,"view","happy");oe(this,"col",0);oe(this,"dx",0);oe(this,"dy",0);oe(this,"flip",!1);oe(this,"alpha",1);oe(this,"hide",!1);oe(this,"boost",0);oe(this,"white",0);oe(this,"crack",0);oe(this,"ringA",null);oe(this,"evo",null);oe(this,"body",null);oe(this,"fadeNew",0);oe(this,"aura",!0);oe(this,"extra",!0);oe(this,"extraDy",0);oe(this,"dim",0);oe(this,"shake",0);oe(this,"thread",null);oe(this,"list",[]);oe(this,"marks",[]);oe(this,"after",[]);oe(this,"rings",[])}fx(t,n,s,a,r={}){this.list.push({name:t,frame:n,x:s,y:a,...r})}mark(t,n,s,a,r={}){this.marks.push({name:t,frame:n,x:s,y:a,life:16,anchor:"bc",...r})}};function Hs(e,t){let n=t.width,s=t.height;switch(e.anchor){case"c":return[e.x-(n>>1),e.y-(s>>1)];case"bc":return[e.x-(n>>1),e.y-s];case"bl":return[e.x,e.y-s];case"cl":return[e.x,e.y-(s>>1)];default:return[e.x,e.y]}}var F=(e,t,n)=>e>=t&&e<n,Pt=(e,t,n)=>{e.view=t>=1&&t<n-1?"side":"happy"},He=(e,t,n,s,a=1)=>[e+Math.round(Math.cos(s)*n),t+Math.round(Math.sin(s)*n*a)];function oi(e,t,n,s,a){let r=[9,6,3][t-2];for(let[o,l]of[[1,-1],[1.3,0],[1,1]])e.fx(n,t,s+Math.round(r*o),a+Math.round(r*l),{anchor:"c"})}var _t={firepuff:{dir:!0,hit:5,steps:e=>e?17:15,run(e,t,n){Pt(e,t,n.n);let s=n.E?[0,1,2,4,4,3]:[0,1,2,3];F(t,2,5)&&(e.col=1),F(t,5,7)&&(e.col=2,e.dx=-1);let[a,r]=n.mouth[e.col];F(t,2,5)&&oi(e,t,"embers",a,r),F(t,5,5+s.length)&&e.fx("flamepuff",s[t-5],a+(t-5===s.length-1?2:0),r,{anchor:"cl",follow:t<7});for(let o of n.E?[4+s.length,6+s.length]:[4+s.length]){let l=t-o;F(l,0,4)&&e.fx("smokering",l,a+20+3*l,r-3-2*l,{anchor:"c",ramp:"neutral"})}}},roar:{hit:6,steps:e=>e?18:15,run(e,t,n){let s=n.E?15:12;F(t,3,6)&&(e.col=1),F(t,6,s)&&(e.col=2,e.dx=t%2?2:-2,e.shake=t%2?1:-1,e.fx("bang",0,n.r+2,n.m-8,{follow:!0,ramp:null})),F(t,6,10)&&e.fx("burstring",t-6,n.r+4+3*(t-6),n.m,{anchor:"c",alpha:[1,.7,.45,.25][t-6]});let a=[n.l+3,n.r-3,n.cx,n.l+8,n.r-8,n.cx-5];for(let r=0;r<(n.E?6:3);r++){let o=t-6-r;F(o,0,7)&&e.fx("wisp",o>>1,a[r]+o%2,49-3*o,{anchor:"c",alpha:o>=5?.5:1})}}},icicles:{dir:!0,hit:4,steps:e=>e?21:17,run(e,t,n){Pt(e,t,n.n);let s=[[0,0],[2,-1],[2,-2],[2,-3],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]);let a=n.E?[2,4,5,7,8]:[2,4,6],r=n.E?16:13;F(t,4,6)&&e.fx("snow",t-4,n.r+2,50,{anchor:"c"}),a.forEach((o,l)=>{let c=n.r+7+9*l,u=t-4-2*l;F(u,0,3)&&t<r?e.fx("icicle",o-2+u,c,52,{anchor:"bc"}):u>=3&&t<r&&e.fx("icicle",o,c,52,{anchor:"bc"}),t===r&&e.fx("icicle",o,c,52,{anchor:"bc",alpha:.5}),l===a.length-1&&F(u,3,7)&&e.fx("glint",u-3,c-1,55-$s[o],{anchor:"c"});for(let p=0;p<3&&F(t-r,0,3);p++){let d=t-r,g=$s[o];e.fx("shard",(l+p)%4,c+(p-1)*(2+2*d),52-g+4*p+d*d+2*d,{anchor:"c",alpha:d===2?.5:1})}}),t===r&&e.mark("frostpatch",1,n.r+4,52,{anchor:"bl",life:18}),n.E&&t===r&&e.mark("frostpatch",1,n.r+22,52,{anchor:"bl",life:18})}},twirl:{hit:4,steps:e=>e?16:12,run(e,t,n){let s=n.E?[[1,0],[1,0],[2,-2],[2,-3],[0,-4],[0,-5],[0,-5],[0,-5],[0,-4],[0,-3],[2,-2],[2,-1],[1,0],[1,0]]:[[1,0],[1,0],[2,-2],[2,-2],[0,-3],[0,-3],[0,-3],[0,-2],[2,-2],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),F(t,2,s.length-1)&&(e.view=(t-2)%2?"side":"happy",e.flip=(t-2>>1)%2===1);let a=n.E?6:4,r=t-4;for(let o=0;o<a&&F(r,0,8);o++){let[l,c]=He(n.cx,n.mid,6+3*r,o/a*2*Math.PI+.4,.5);e.fx("snow",r+o,l,c+r,{anchor:"c"})}}},leafwhirl:{hit:3,steps:e=>e?22:18,run(e,t,n){let s=n.n-4;F(t,1,3)&&(e.col=1),F(t,3,s)&&(e.col=t===3?2:0,e.dy=t===3?-1:n.E?-3:-2),t===s&&(e.dy=-1),t===s+1&&(e.col=1);let a=n.E?8:6,r=(n.r-n.l)/2+4,o=s-3;for(let l=0;l<a&&F(t,3,s+3);l++){let c=(t-3)*(Math.PI/3.5)+l/a*2*Math.PI,u=Math.max(0,Math.min(1,(t-3-l*.5)/(o-2))),p=50-Math.round(u*(50-n.t+6)),d=t-s,[g,w]=He(n.cx,p,r,c,.25);d>=0&&([g,w]=[g+Math.round(Math.cos(c)*6*(d+1)),w-2*(d+1)+d*d]),e.fx("leaf",(t+l)%3,g,w,{anchor:"c",follow:d<0,alpha:d>=1?.5:1,layer:Math.sin(c)<0&&d<0?"back":"front"})}}},wiggle:{hit:4,steps:e=>e?16:12,run(e,t,n){F(t,2,n.n-2)&&(e.dx=t%2?1:-1,e.col=t%2?1:0),(n.E?[n.r+7,n.l-7]:[n.r+7]).forEach((a,r)=>{let o=t-4-2*r;F(o,0,2)&&e.fx("sprout",o,a,52,{anchor:"bc"}),o===2&&e.mark("sprout",2,a,52,{life:18})})}},petalshower:{hit:3,steps:e=>e?28:25,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0);let s=n.E?12:8,a=t-3,r=n.t-3;for(let o=0;o<s&&a>=0;o++){let l=o%2?1:-1,c=l*(4+2*((o>>1)%3)),u=(o>>1)%2*3,p,d;if(a<=3)[p,d]=[n.cx+c*a,r-[0,5,9,11][a]-u];else{let g=a-3;[p,d]=[n.cx+c*3+l*Math.floor(g/3)+((g>>1)%2?2:-2),r-11-u+3*g]}d<49&&e.fx("petal",(a+o)%3,p,d,{anchor:"c"})}t===9&&e.mark("flower",0,n.r+7,52,{life:20}),n.E&&t===11&&e.mark("flower",0,n.l-7,52,{life:18})}},triplehop:{hit:13,steps:()=>18,run(e,t,n){let s=n.E?[5,9,14]:[4,7,11],a=[[1,0]],r=[];for(let o of s){let l=Math.ceil(o/2);a.push([2,-l],[2,-o],[0,-o],[0,-l],[1,0]),r.push(a.length-1)}t<a.length&&([e.col,e.dy]=a[t]),r.forEach((o,l)=>{let c=t-o,u=l===2?8:4;for(let p=0;p<u&&F(c,0,4);p++){let d=p%2===0,g=p>>1;e.fx("petal",(c+p)%3,d?n.l+1-2*c-4*g:n.r-1+2*c+4*g,49-2*c-2*g+(c*c>>1),{anchor:"c",alpha:c===3?.5:1})}if(F(c,0,2))for(let p of[n.l,n.r])e.fx("dust",c,p,52,{anchor:"bc",ramp:"neutral"})})}},starburst:{hit:6,steps:e=>e?16:14,run(e,t,n){if(F(t,3,6)&&(e.col=1),F(t,6,8)&&(e.col=2),t<6)for(let a=0;a<6;a++){let[r,o]=He(n.cx,n.mid,[28,23,18,13,9,5][t],(a+.5)/6*2*Math.PI+t*.15);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}let s=n.E?[[6,0,7],[8,.5,9]]:[[6,0,7]];for(let[a,r,o]of s){let l=t-a;for(let c=0;c<6&&F(l,0,6);c++){let[u,p]=He(n.cx,n.mid,8+o*l,(c+r)/6*2*Math.PI);e.fx("bigstar",[2,3,2,3,1,0][l],u,p,{anchor:"c",alpha:l>=4?.5:1})}}}},float:{hit:4,steps:e=>e?18:16,run(e,t,n){let s=n.E?-14:-10,a=[0,-1,-4,-8],r=n.n-4;t<4?e.dy=Math.max(s,a[t]):t<r?e.dy=s+Math.floor((t-4)/3)%2:e.dy=[-6,-2,0,0][t-r],e.dy<0&&e.fx("shadow",Math.min(3,Math.floor(-e.dy/3)),n.cx,51,{anchor:"c",layer:"floor",ramp:"neutral",alpha:.5}),t===n.n-2&&(e.col=1);for(let o=0;o<5;o++){let l=4+2*o,c=t-l;l>=r||!F(c,0,5)||e.fx("bigstar",[1,2,1,0,0][c],n.cx+[-8,6,-3,9,1][o],50+s+2*c,{anchor:"c",alpha:c===4?.5:1})}}},coinshower:{hit:3,steps:e=>e?24:22,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0),(n.E?[-2.6,-2,-1.5,1.5,2,2.6,-3.2,3.2]:[-2.4,-1.7,1.7,2.4]).forEach((a,r)=>{let o=t-3-r%3;if(o<0)return;let l=n.cx+Math.sign(a)*6,c=n.t+4,u=a,p=-4-r%2,d=!1,g=-1;for(let y=0;y<o&&g<0;y++)l+=u,p+=1,c+=p,c>=47&&(c=47,d&&(g=y+1),p=d?0:-3,u/=2,d=!0);let w=Math.round(l);g<0?e.fx("coin",o,w,c,{anchor:"c"}):(g===o&&e.mark("coinflat",0,w,52,{life:14}),o-g<4&&e.fx("glint",o-g,w+3,45,{anchor:"c"}))})}},sparkle:{hit:2,steps:e=>e?18:14,run(e,t,n){t===1&&(e.col=1),t===2&&(e.col=2),[[n.l-6,n.t+4],[n.r+5,n.t+9],[n.l-3,n.m+13],[n.r+3,n.m+18],[n.cx+4,n.t-6],[n.l-9,n.m+2],[n.r+8,n.m],[n.cx-7,n.m+24]].slice(0,n.E?8:4).forEach(([a,r],o)=>{let l=t-4-2*(o%4)-(o>=4?1:0);F(l,0,5)&&e.fx("glint",l,a,r,{anchor:"c"})});for(let a=0;a<6&&F(t,2,5);a++){let[r,o]=He(n.cx,n.mid,10+7*(t-2),(a+.5)/6*2*Math.PI);e.fx("bigstar",[1,2,0][t-2],r,o,{anchor:"c",alpha:t===4?.5:1})}}},shine:{hit:2,steps:e=>e?18:14,run(e,t,n){for(let s of n.E?[2,7,12]:[2,8]){let a=t-s;F(a,0,3)&&(e.boost=.25,e.ringA=a===1?.8:.35),F(a,0,4)&&e.fx("glint",[1,2,3,4][a],n.r-4,n.t+3,{anchor:"c"});for(let r=0;r<8&&F(a,0,3);r++){let[o,l]=He(n.cx,n.mid,(n.r-n.l)/2+3+3*a,r/8*2*Math.PI,.9);e.fx("bigstar",[0,1,0][a],o,l,{anchor:"c",alpha:a===2?.5:1})}}t===1&&(e.col=1),t===2&&(e.col=2)}},shockwave:{hit:5,steps:e=>e?17:14,run(e,t,n){let s=[[0,0],[1,0],[2,-1],[2,-3],[2,-4],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),t===5&&(e.shake=1),t===6&&(e.shake=-1);for(let a of n.E?[5,7]:[5])F(t-a,0,6)&&e.fx("shockring",t-a,n.cx,51,{anchor:"c",layer:"floor"});if(F(t,5,8))for(let[a,r]of[[n.l-3,-1],[n.r+3,1]])e.fx("dust",Math.min(1,t-5),a+3*r*(t-5),52,{anchor:"bc",ramp:"neutral",alpha:t===7?.5:1})}},vanish:{hit:10,steps:()=>14,travel:(e,t)=>t?0:e?40:24,run(e,t,n){let s=n.travel;F(t,1,4)&&(e.col=1),e.alpha={2:.66,3:.33,9:.33,10:.66}[t]??1,F(t,4,9)&&(e.hide=!0),t>=9&&(e.dx=s),F(t,10,12)&&(e.col=2);for(let a=0;a<(n.E?8:6);a++){let r=[-8,8,-3,4,-12,11,0,-6][a],o=[2,0,8,12,10,6,-2,16][a],l,c;if(F(t,2,5))[l,c]=[n.cx+r,n.mid+o-2*(t-2)];else if(F(t,5,9)){let u=t-5,p=s?0:Math.round(4*Math.cos((u+a)*Math.PI/2));[l,c]=[n.cx+r+Math.round(s*(u+1)/5)+p,n.mid+o-6+(u+a)%2]}else if(F(t,9,11))[l,c]=[n.cx+s+Math.round(r*(1-(t-9)/2)),n.mid+o-4+2*(t-9)];else continue;e.fx(a%2?"wisps":"wisp",t+a,l,c,{anchor:"c"})}}},zap:{dir:!0,hit:6,steps:e=>e?15:12,run(e,t,n){if(Pt(e,t,n.n),F(t,2,6))for(let a=0;a<4;a++){let[r,o]=He(n.cx,n.t-1,[20,15,10,5][t-2],(a+.5)/4*2*Math.PI+t*.3,.6);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}F(t,4,6)&&(e.col=1),F(t,6,8)&&(e.col=2);let s=n.E?[[6,n.r+16],[9,n.r+34]]:[[6,n.r+16]];for(let[a,r]of s){let o=t-a;F(o,0,3)&&e.fx("bolt",o===1?1:0,r,52,{anchor:"bc",alpha:o===2?.5:1}),o===1&&e.mark("scorch",0,r,52,{ramp:"neutral",life:18});for(let l=0;l<6&&F(o,1,5);l++)e.fx("bigstar",[2,1,1,0][o-1],r+(l%2?1:-1)*(3+3*o+2*(l>>1)),50-2*o-(l>>1)*3+(o*o>>1),{anchor:"c"})}}},dash:{dir:!0,hit:4,steps:()=>13,travel:(e,t)=>t?0:e?44:30,run(e,t,n){Pt(e,t,n.n);let s=n.travel,a=s?[0,Math.round(s*.3),Math.round(s*.65),s]:[1,2,3,3];if(F(t,2,4)&&(e.col=1,e.dx=-1),F(t,4,8)){let r=t-4;e.col=r<2?2:0,e.dx=a[r];for(let o=1;o<=(n.E?3:2);o++){let l=s?a[r-o]:a[r]-3*o;l!==void 0&&l!==a[r]&&e.after.push({dx:l,alpha:[.5,.3,.15][o-1]})}}if(F(t,8,10)){e.col=1,e.dx=(s||3)+1,e.fx("dust",t-8,n.l-3,52,{anchor:"bc",follow:!0,ramp:"neutral"}),e.fx("dust",t-8,n.l-11-2*(t-8),52,{anchor:"bc",follow:!0,ramp:"neutral",alpha:.6});for(let r=0;r<3;r++)e.fx("bigstar",(t-8+r)%3,n.r+3+3*r,49-3*r-2*(t-8),{anchor:"c",follow:!0})}t>=10&&(e.dx=s||[1,0][t-10]||0)}},bubbleblow:{dir:!0,hit:10,light:17,steps:e=>e?30:23,run(e,t,n){Pt(e,t,n.n),F(t,2,4)&&(e.col=1),F(t,4,10)&&(e.col=2);let[s,a]=n.mouth[2];F(t,4,10)&&e.fx("bubble",t-4,s,a,{anchor:"cl"});let r=n.E?[[10,6,2],[13,5,3],[16,4,2]]:[[10,6,2]];for(let[o,l,c]of r){let u=t-o,p=s+9+2*u,d=a-c*u+u%2;F(u,0,7)&&e.fx("bubble",l,p,d,{anchor:"c"}),F(u,7,9)&&e.fx("pop",u-7,p,d,{anchor:"c"});for(let g=0;g<6&&F(u,8,14);g++){let w=u-8,y=[-3,-2,-1,1,2,3][g];e.fx("droplet",0,p+y*(w+2),d+w*w-3*w-1+g%2*2,{anchor:"c",alpha:w>=5?.5:1})}}}},splash:{hit:8,steps:e=>e?18:15,run(e,t,n){let s=n.E?[-5,-11,-16,-18,-18,-16,-11,-5]:[-4,-9,-13,-15,-13,-9,-4],a=[[1,0],[1,0],...s.map((l,c)=>[c<2||c===s.length-1?2:0,l]),[1,0],[1,0]],r=2+s.length;t<a.length&&([e.col,e.dy]=a[t]);for(let l of n.E?[r,r+2]:[r])F(t-l,0,5)&&e.fx("waterring",t-l,n.cx,51,{anchor:"c",layer:"floor"});let o=t-r;F(o,0,3)&&e.fx("crown",o,n.cx,52,{anchor:"bc"});for(let l=0;l<(n.E?10:8)&&F(o,0,8);l++){let c=[-5,-3,-2,-1,1,2,3,5,-4,4][l],u=6-Math.abs(c)%3;e.fx("droplet",0,n.cx+c*(o+2),46-u*o+o*o,{anchor:"c",alpha:o>=6?.5:1})}}}},Ft=(e,t)=>_t[e].steps(t),qs=(e,t,n)=>_t[e].travel?.(t,n)??0,Vs=e=>!!(_t[e].dir||_t[e].travel),Jn=54,Zn=16,Ws=e=>e.kind==="move"?Ft(e.move,e.encore):e.kind==="hatch"?ea:e.reduced?Zn:Jn,ii=(()=>{let e=ni(7);return Array.from({length:16},()=>{let t=e()*4|0,n=e();return[[n*176,-2],[178,n*99*.8],[n*176,-2],[-2,n*99*.8]][t]})})(),Ds=[12,20,27,33,38,42];function li(e,t,n,s,a,r){if(r){e.evo=t>=12,e.body=t>=12?"new":"old",F(t,4,12)&&(e.fadeNew=[.25,.5,.75,1][t-4>>1]);return}e.evo=t>=44,e.aura=e.extra=t>=46,e.dim=t<10?(t+1)*.06:t<44?.6:[.4,.25,.1][t-44]??0;let o=s+26,l=a+n.mid;t<21&&ii.forEach(([c,u],p)=>{let d=c+s-62,g=u+a-39,w=Math.min(1,(t+1+p%4)/22)**1.5;w<.92&&e.fx(p%3?"speck":"bigstar",0,Math.round(d+(o-d)*w),Math.round(g+(l-g)*w),{world:!0})}),F(t,10,44)&&(e.col=1),F(t,44,46)&&(e.col=2),F(t,10,22)&&(e.white=[.33,.66][t-10]??(Ds.includes(t)?1:.75)),e.body=t<28?"old":t<33?"new":t<37?"old":t<41?"new":t<44?"old":"new",F(t,41,44)&&(e.white=1,e.crack=t-40);for(let c of Ds)F(t-c,0,3)&&e.rings.push({d:[2,4,6][t-c],a:[.9,.5,.25][t-c],c:"#ffffff"});F(t,44,49)&&e.fx("burstring",t-44,n.cx,n.mid,{anchor:"c"});for(let c=0;c<8&&F(t,44,52);c++){let u=t-44,[p,d]=He(n.cx,n.mid,4+5*u,(c+.5)/8*2*Math.PI);e.fx("shard",c,p,d+(u*u>>1),{anchor:"c",alpha:u>=6?.5:1})}F(t,46,53)&&(e.extraDy=[-20,-14,-8,-3,0,-2,0][t-46])}var Qs={prismite:{how:"crack",colour:"frost",moves:["starburst"]},thundrake:{how:"crack",colour:"storm",moves:["zap"]},clockrit:{how:"crack",colour:"gilded",moves:["shockwave"]},wickwisp:{how:"crack",colour:"ember",moves:["firepuff"]},cauldrop:{how:"crack",colour:"moss",moves:["bubbleblow","splash"]},webbit:{how:"thread",colour:"dusk",moves:[]}},ea=24,zs=[2,7,11],ci=e=>[[15,e.l-3,e.t+3],[17,e.r+2,e.m],[19,e.cx+2,e.t-4]];function ui(e,t,n,s){if(s==="thread"){e.dy=t<10?-Math.round(92*(1-t/10)**2):[0,-3,-2,-1][t-10]??0,e.col=t<10?2:[1,2][t-10]??0,e.dim=t<10?.3:[.2,.1][t-10]??0,t<14?e.thread=e.dy+n.t+1:t<18&&(e.thread=n.t+1-25*(t-13));for(let[a,r,o]of ci(n))F(t,a,a+3)&&e.fx("glint",t-a,r,o,{anchor:"c"});return}e.dim=t<6?(t+1)*.07:t<17?.42:[.28,.14][t-17]??0,e.col=t<14?1:F(t,17,19)?2:0,t<17&&(e.white=t<14&&!zs.includes(t)?.85:1),F(t,14,17)&&(e.crack=t-13);for(let a of zs)F(t-a,0,3)&&e.rings.push({d:[2,4,6][t-a],a:[.9,.5,.25][t-a],c:"#ffffff"});F(t,17,22)&&e.fx("burstring",t-17,n.cx,n.mid,{anchor:"c"});for(let a=0;a<8&&F(t,17,24);a++){let r=t-17,[o,l]=He(n.cx,n.mid,4+5*r,(a+.5)/8*2*Math.PI);e.fx("shard",a,o,l+(r*r>>1),{anchor:"c",alpha:r>=5?.5:1})}}function js(e){e.getContext("2d").getImageData(0,0,1,1)}function Bs(e,[t,n,s,a],r){let[o,l]=Ot(s,a);return l.drawImage(e,t*r,n*r,s*r,a*r,0,0,s,a),o}var Vn=new Map;function yn(e){let t=e("sprites/atlas.json"),n=Vn.get(t);return n||(n=(async()=>{let s=await fetch(t);if(!s.ok)throw new Error(`atlas ${s.status}`);let a=await s.json(),[r,o]=await Promise.all([Oe(e(a.moves.path)),Oe(e(a.extras.path))]),l={};for(let[p,d]of Object.entries(a.moves.pieces))l[p]=d.map(g=>Bs(r,g,a.scale));let[c,u]=a.extras.artSize;return a.extras.rows.forEach((p,d)=>{l[`x-${p}`]=Array.from({length:a.extras.frames},(g,w)=>Bs(o,[w*c,d*u,c,u],a.scale))}),js(l.bang[0]),{pieces:l,raw:new Set(a.moves.raw)}})(),Vn.set(t,n),n.catch(()=>Vn.delete(t))),n}function gi(e){let t=(p,d)=>e[(d*ae+p)*4+3]>0,n=[];for(let p=0;p<ae;p++)for(let d=0;d<ae;d++)if(t(d,p)){n.push(p);break}if(!n.length)return null;let s=n[0],a=n[n.length-1]-s+1,r=new Map;for(let p=s+Math.floor(.3*a);p<=s+Math.floor(.7*a);p++)for(let d=ae-1;d>=0;d--)if(t(d,p)){r.set(p,d);break}if(!r.size)return null;let o=Math.max(...r.values()),l=[...r].filter(([,p])=>p>=o-1),[c,u]=l[l.length>>1];return[u+1,c]}var Tt=new Map;function Ys(e,t,n,s=null){let a=JSON.stringify([e,t,n,s]),r=Tt.get(a);return r||(Tt.size>32&&Tt.clear(),r=(async()=>{let[o,l]=Ot(ae*3,ae*2);for(let[u,p]of[[e,0],[t??e,ae]]){let d=await Oe(u.src),g=d.naturalHeight/u.rows;for(let w=0;w<3;w++){let y=u.frames===3?d.naturalWidth/3*w:0,f=u.frames===3?d.naturalWidth/3:d.naturalWidth;l.save(),n&&(l.translate((2*w+1)*ae,0),l.scale(-1,1)),l.drawImage(d,y,u.row*g,f,g,w*ae,p,ae,ae),l.restore()}}js(o);let c=null;if(s)c=[s,s,s];else if(t){let u=[0,1,2].map(p=>gi(l.getImageData(p*ae,ae,ae,ae).data));c=u.every(Boolean)?u:null}return{img:o,mouths:c}})(),Tt.set(a,r),r.catch(()=>Tt.delete(a))),r}var di=[0,.35,.8,.35],pi=[[-2,.5],[-3,-1],[-3,-1],[-3,.5],[-2,1],[-1,1]],mi={rise:e=>[[e.l-4,e.m+12],[e.r-1,e.m+8],[e.r-6,e.m+18]],fall:e=>[[e.l-3,e.t-2],[e.r-2,e.t+2],[e.r+1,e.m+2]],twinkle:e=>[[e.l-5,e.t+2],[e.r-1,e.m+6],[e.l-3,e.m+15]]},fi=[[0,0],[1,-2],[0,-4],[-1,-6],[0,-8],[1,-10],[0,-12],[-1,-14]],hi=[[0,0],[1,2],[2,4],[1,6],[0,8],[1,10],[2,12],[1,14]];function bi(e,t){let n=Math.floor(t/3);return e==="rise"?{frame:[0,0,0,1,1,1,2,2][n],d:fi[n]}:e==="fall"?{frame:[0,1,2,1,0,1,2,1][n],d:hi[n]}:n<3?{frame:n,d:[0,0]}:null}function Xs(e,t,n,s){let{ctx:a,art:r,body:o,colour:l,dir:c,X:u,Y0:p}=e,{width:d,height:g}=a.canvas,w=ri(e.stage),y=l==="storm"?"spark":l,f=ti[l],m=new Wn,b=-99,k=-99;if(t?.kind==="move"){let v=_t[t.move],I=v.steps(t.encore),H=o.mouths??[0,1,2].map(()=>[w.r,w.m]);v.run(m,n,{...w,mouth:H,E:t.encore,spot:t.spot,n:I,travel:t.travel}),b=n-v.hit,k=n-(v.light??v.hit)}else t?.kind==="hatch"?(ui(m,n,w,t.how),b=k=n-(t.how==="thread"?10:17)):t&&(li(m,n,w,u,p,t.reduced),b=n-46,k=n-44);let E=!e.plain&&(m.evo??!0),_=t?.kind==="move"&&t.encore,T=(v,I)=>c>0?u+v:u+ae-v-I,z=T(m.dx,ae),x=p+m.dy,S=(v,I,H,$=0)=>{let q=r.pieces[v],W=q[(I%q.length+q.length)%q.length];return r.raw.has(v)||H===null?W:qn(W,H,$)},N=(v,I,H)=>{let[$,q,W]=Yn(v),U=z+26,Z=p+30,te=a.createRadialGradient(U,Z,4,U,Z,H?200:95);te.addColorStop(0,`rgba(${$},${q},${W},${I})`),H&&te.addColorStop(H,`rgba(${$},${q},${W},${I})`),te.addColorStop(1,`rgba(${$},${q},${W},0)`),a.fillStyle=te,a.fillRect(0,0,d,g)};if(a.save(),a.clearRect(0,0,d,g),m.shake&&a.translate(m.shake,0),e.lit&&m.dim&&N("#000000",m.dim,.55),e.lit&&t&&(E||e.plain)&&F(k,0,6)){let v=[1,1,.75,.5,.3,.15][k]*(_?1.4:1);l==="shade"?N("#000000",.38*v,0):N(f,.24*v,0)}let L=t?`${t.at}|${n}`:e.drawn;if(L!==e.drawn){e.drawn=L;for(let v of m.marks){let I=S(v.name,v.frame,v.ramp===void 0?y:v.ramp),[H,$]=Hs(v,I);e.marks.push({img:I,wx:T(H,I.width),wy:p+$,flip:c<0,born:s,life:v.life})}}e.marks=e.marks.filter(v=>s-v.born<v.life);for(let v of e.marks){let I=v.life-(s-v.born);xe(a,v.img,v.wx,v.wy,v.flip,I<=3?I/4:1)}if(!t)return a.restore(),e.marks.length>0;let D=v=>{let I=S(v.name,v.frame,v.ramp===void 0?y:v.ramp),[H,$]=Hs(v,I);v.follow&&(H+=m.dx,$+=m.dy),v.world?xe(a,I,H,$,!1,v.alpha??1):xe(a,I,T(H,I.width),p+$,c<0,v.alpha??1)};m.list.filter(v=>v.layer==="floor").forEach(D),m.list.filter(v=>v.layer==="back").forEach(D);let M=m.col*ae,A=m.view==="side"?ae:0,C=c<0!==m.flip,P=o.img,R=[M,A,ae,ae];m.thread!==null&&p+m.thread>0&&(a.fillStyle=Gs[3],a.globalAlpha=.8,a.fillRect(T(w.cx+m.dx,1),0,1,p+m.thread),a.globalAlpha=1);for(let v of m.after)xe(a,pt(P,M,A,0,f),T(v.dx,ae),x,C,v.alpha);if(!m.hide){for(let H of m.rings)xe(a,pt(P,M,A,H.d,H.c),z-H.d,x-H.d,C,m.alpha*H.a);let v=m.ringA??(E?di[s%24/6|0]:0);v&&xe(a,pt(P,M,A,2,f),z-2,x-2,C,m.alpha*v),E&&xe(a,pt(P,M,A,1,f),z-1,x-1,C,m.alpha);let I=(m.body??(E?"new":"old"))==="new";if(xe(a,I?qn(P,l,m.boost):P,z,x,C,m.alpha,ae,R),m.fadeNew&&xe(a,qn(P,l),z,x,C,m.fadeNew,ae,R),m.white){let H=m.crack?si(P,M,A,m.crack,w,bn[y][2]):pt(P,M,A,0,"#ffffff");xe(a,H,z,x,C,m.alpha*m.white)}}m.list.filter(v=>!v.layer||v.layer==="front").forEach(D);let B=c>0?u+m.dx:u-m.dx;if(E&&m.aura&&!m.hide){let v=at[l].aura,I=jn[v],H=F(b,0,12);for(let[$,q]of H?[[0,!1],[4,!0]]:[[0,!1]])mi[I](w).forEach(([W,U],Z)=>{let te=bi(I,(s+Z*8+$)%24);if(!te)return;let se=S(v,te.frame,y,H?.25:0),ie=(q?ae-W-7:W)+te.d[0]+(7-se.width>>1),ye=U+te.d[1]+(7-se.height>>1);xe(a,se,B+ie,x+ye,!1,m.alpha)})}if(E&&m.extra&&!m.hide){let v=12,I=!1,H=(s%24>=12?-1:0)+m.extraDy;if(t.kind==="move"&&F(b,0,6)){let[q,W]=pi[b];H+=q,v=Math.round(12*Math.abs(W)),I=W<0}let $=S(`x-${e.extra}`,s%12>=6?1:0,y);xe(a,$,B+20+(12-v>>1),x+w.t-13+H,I,m.alpha,v)}return a.restore(),e.marks.length>0}var vn=52,yi=1200,vi={feed:[{sprite:"tomato",motion:"feed"}],play:[{sprite:"sparkle",motion:"play-a"},{sprite:"sparkle",motion:"play-b"}],rest:[{sprite:"z",motion:"rest-a"},{sprite:"z",motion:"rest-b"}],pet:[{sprite:"heart",motion:"pet"}]},Js={stage:{x:176,top:80,bottom:24},spot:{x:48,top:56,bottom:8}},wi={note:[{sprite:"note",motion:"cue-note"}],question:[{sprite:"question",motion:"cue-question"}],bang:[{sprite:"bang",motion:"cue-bang"}],nap:[{sprite:"z",motion:"nap-a"},{sprite:"z",motion:"nap-b"}]},Si="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0",ta=(e,t)=>e.map(n=>(parseInt(n.slice(1+t*2,3+t*2),16)/255).toFixed(3)).join(" ");function tr(){return i("svg",{"aria-hidden":"true",width:"0",height:"0",style:{position:"absolute"},children:i("defs",{children:Object.entries(bn).map(([e,t])=>h("filter",{id:`sl-ramp-${e}`,colorInterpolationFilters:"sRGB",children:[i("feColorMatrix",{type:"matrix",values:Si}),h("feComponentTransfer",{children:[i("feFuncR",{type:"table",tableValues:ta(t,0)}),i("feFuncG",{type:"table",tableValues:ta(t,1)}),i("feFuncB",{type:"table",tableValues:ta(t,2)})]})]},e))})})}function wn(){let[e,t]=G(null),n=j(void 0);Y(()=>()=>window.clearTimeout(n.current),[]);let s=de(a=>{window.clearTimeout(n.current),t({action:a,at:Date.now()}),n.current=window.setTimeout(()=>t(null),yi)},[]);return[e,s]}var ki={egg:{w:22,h:30},hatchling:{w:26,h:32},juvenile:{w:32,h:40},adult:{w:36,h:46},elder:{w:36,h:46}};function Zs(e,t,n){if(e)return{backgroundImage:`url("${e}")`};if(t)return{backgroundImage:`url("${n(t.path)}")`,backgroundSize:`300% ${je*100}%`,backgroundPositionY:`${t.row/(je-1)*100}%`}}function er(e,t,n){let s=t&&La(e);if(!s)return;let a=je*kt,r=o=>`${(o*je+t.row)/(a-1)*100}%`;return{backgroundImage:`url("${n(s.path)}")`,backgroundSize:`300% ${a*100}%`,"--sl-live-y0":r(0),"--sl-live-y1":r(kt),animationDuration:`${s.ms*kt}ms`,animationTimingFunction:`steps(${kt}, end)`}}function xi({act:e,player:t,look:n,plain:s,stage:a,facing:r,scale:o}){let[l,c]=G(null),[u,p]=G(e);e!==u&&(p(e),c(e?null:u));let d=e??l,g=d?.kind==="move"&&d.spot,w=g?Js.spot:Js.stage,y=w.x*2+vn,f=w.top+vn+w.bottom,m=j(null),b=j(null),{colour:k,extra:E}=n;return Ge(()=>{let _=m.current?.getContext("2d");if(!_||!d)return;_.imageSmoothingEnabled=!1;let T={ctx:_,...t,colour:k,extra:E,stage:a,dir:r==="right"?1:-1,X:w.x,Y0:w.top,lit:!g,plain:s};b.current?.ctx===_?Object.assign(b.current,T):b.current={...T,marks:[],drawn:""};let z=b.current,x=0,S="",N=()=>{let L=Date.now(),D=Math.floor(L/De),M=e?Math.min(Ws(e)-1,Math.max(0,Math.floor((L-e.at)/De))):0,A=`${M}|${D}`;if(A!==S&&(S=A,!Xs(z,e,M,D)&&!e))return c(null);x=requestAnimationFrame(N)};return N(),()=>cancelAnimationFrame(x)},[e,d,t,k,E,a,r,w,g,s]),d?i("canvas",{ref:m,"aria-hidden":"true",className:"sl-move-canvas",width:y,height:f,style:{left:`${-w.x*o}px`,top:`${-w.top*o}px`,width:`${y*o}px`,height:`${f*o}px`}}):null}function mt({species:e,stage:t,mood:n,assetUrl:s,alt:a,scale:r,still:o=!1,reaction:l=null,pose:c=null,cue:u=null,customSrc:p=null,sideSrc:d=null,frames:g=3,silhouette:w=!1,look:y=null,act:f=null,facing:m="right",flipped:b=!1}){let k=t==="egg"?null:Qn[t],E=!!p,_=E&&g===1,T=!E&&w,z=E||T?null:Te(e,t,n),x=Zs(E?p:null,z,s),S=z&&Te(e,t,"side"),N=Zs(E?d:null,S,s),L=t==="egg"?void 0:er(e,z,s),D=t==="egg"?void 0:er(e,S,s),M=o?"sl-live":"sl-live sl-live--on",A=L?i("span",{className:M,style:L}):null,C=D?i("span",{className:M,style:D}):null,P=L?{...x,backgroundImage:"none"}:x,R=D?{...N,backgroundImage:"none"}:N,B=!!N&&c==="walk"&&!l&&t!=="egg",v=l?`sl-react-${t==="egg"?"egg":l.action}`:c&&t!=="egg"?`sl-pose-${c}`:o?"":_||T?"sl-idle sl-idle-custom":`sl-idle sl-idle-${t==="egg"?"egg":n}`,I=!y&&f&&f.kind!=="moment"?f.colour:void 0,H=y??(I?{colour:I,extra:St[0]}:null),$=!!H&&t!=="egg"&&!T,q=$?Te(e,t,"happy"):null,W=$?Te(e,t,"side"):null,U=$?JSON.stringify(E?[{src:p,row:0,rows:1,frames:g},d?{src:d,row:0,rows:1,frames:g}:null,b,null]:[{src:s(q.path),row:q.row,rows:je,frames:3},W?{src:s(W.path),row:W.row,rows:je,frames:3}:null,b,b?null:Ks[`${e}:${t}`]??null]):"",[Z,te]=G(null),se=j(s);Y(()=>{se.current=s}),Y(()=>{if(!U)return;let ue=!0,[Qe,Fe,Le,Ee]=JSON.parse(U);return Promise.all([yn(se.current),Ys(Qe,Fe,Le,Ee)]).then(([Ce,Re])=>ue&&te({key:U,art:Ce,body:Re}),()=>ue&&te(null)),()=>{ue=!1}},[U]);let ie=Z&&Z.key===U&&H&&t!=="egg"?Z:null,ye=ki[t],he={width:`${vn*r}px`,height:`${vn*r}px`,"--sl-px":`${r}px`,...k?{"--sl-t":k.t,"--sl-l":k.l,"--sl-r":k.r,"--sl-m":k.m}:{},...T?{"--sl-sil-w":ye.w,"--sl-sil-h":ye.h}:{}},Be=_?"sl-sprite-frames sl-sprite-frames--single":T?"sl-sprite-frames sl-sprite-frames--silhouette":"sl-sprite-frames",ve=y?at[y.colour].aura:null,Se=f&&(ie||I)?" sl-sprite--canvas":"";return h("span",{className:y?`sl-sprite sl-evo sl-evo--${y.colour}${Se}`:`sl-sprite${Se}`,role:"img","aria-label":a,style:he,children:[ie&&H&&t!=="egg"?i(xi,{act:f,player:ie,look:H,plain:!y,stage:t,facing:m,scale:r}):null,y?i("span",{"aria-hidden":"true",className:"sl-evo-ring",children:i("span",{className:B?"sl-sprite-frames sl-pose-walk-side":`${Be} ${v}`,style:B?R:P,children:B?C:A},l?.at)}):null,i("span",{className:`${Be} ${B?"sl-sprite-frames--hidden":v}`,style:P,children:A},l?.at),N?i("span",{className:`sl-sprite-frames ${B?"sl-pose-walk-side":"sl-sprite-frames--hidden"}`,style:R,children:C}):null,l&&k?(vi[l.action]??[]).map(ue=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ue.sprite} sl-fx-${ue.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ue.sprite}.webp`)}")`}},`${l.at}-${ue.motion}`)):null,u&&k&&!l?wi[u.kind].map(ue=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ue.sprite} sl-fx-${ue.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ue.sprite}.webp`)}")`}},`${u.at}-${ue.motion}`)):null,y&&ve&&k?h(ce,{children:[["a","b","c"].map(ue=>i("span",{"aria-hidden":"true",className:`sl-evo-aura sl-evo-aura--${jn[ve]} sl-evo-aura-${ue}`,style:{backgroundImage:`url("${s("sprites/fx-auras.webp")}")`,backgroundSize:`300% ${jt.length*100}%`,backgroundPositionY:`${jt.indexOf(ve)/(jt.length-1)*100}%`}},ue)),i("span",{"aria-hidden":"true",className:"sl-evo-extra",style:{backgroundImage:`url("${s("sprites/fx-extras.webp")}")`,backgroundSize:`200% ${St.length*100}%`,backgroundPositionY:`${St.indexOf(y.extra)/(St.length-1)*100}%`}})]}):null]})}var ft=(e,t=!1)=>({queryKey:["saucelings","form",e,t?"front":"all"],queryFn:()=>V(`/form/${encodeURIComponent(e)}${t?"?strips=front":""}`),staleTime:1/0});function Ae({art:e,frontOnly:t=!1,...n}){let s=Da(e,n.stage),a=s.kind==="form"?s.formId:null,r=le({...ft(a??"",t),enabled:a!==null}),o=a?r.data??null:null,l=o?(n.mood==="content"?null:o[n.mood])??o.image:null,c=!l&&(s.kind==="silhouette"||a!==null&&e.design?.origin==="found");return i(mt,{...n,customSrc:l,sideSrc:o?.side??null,frames:o?.frames??1,silhouette:c,look:e.evolution?.look??null})}var Ei=1024,ar=1024;function sr(e,t=!1){let n=e?e.lockedStage??e.stage:null;if(!e?.design||!n||!e.design.stages[n])return null;let s=t||Object.keys(e.forms).length===0?"sheet":"stage";return{petId:e.id,species:e.species,design:e.design,forms:e.forms,stage:n,kind:s}}var Ci=e=>e&&!e.forms[e.stage]?e:null,rr=e=>["saucelings","paint",e],Ri=e=>e.kind==="sheet"?"sheet":e.stage,Mi=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;async function na(e,t,n,s,a){return(await ke("/api/characters/avatar-generation","POST",{connectionId:e,name:"sauceling-form",appearance:t,promptOverrides:[{id:"avatar:sauceling-form",prompt:t,negativePrompt:n}],styleProfileId:"off",width:s,height:s,...a.length>0?{referenceImages:a}:{}})).image}async function or(e,t,n,s,a){let{design:r,stage:o}=e,l=$e.slice(0,$e.indexOf(o)).reverse().map(g=>e.forms[g]).find(Boolean),c=null,u=null;if(l)c=await n.fetchQuery(ft(l,!0)).then(g=>Je(g.image)).catch(()=>null),u=c?"earlier":null;else if(r.origin==="evolved"){let g=Te(e.species,o,"content");c=await Je(s(g.path),g.row).catch(()=>null),u=c?"before":null}let p=await na(t,_s(r,o,u),Is(o),Ei,c?[c]:[]),d=await gs(p,o);if(!d)throw new Error(a);return V("/form","POST",{stage:o,image:d,petId:e.petId})}async function Ii(e,t,n,s,a){let r=Te(e.species,"adult","content"),o=e.design.origin==="evolved"?await Je(s(r.path),r.row).catch(()=>null):null,l=Gn(e.design),c=await na(t,Os(e.design,o?"before":null),Cs,ar,o?[o]:[]),u=await ds(c,l);return u?V("/form/sheet","POST",{petId:e.petId,forms:u}):or({...e,kind:"stage"},t,n,s,a)}function ir(e,t,n){let{t:s}=J(),a=ge(),r=t.world.settings.portraitConnectionId;return ne({mutationKey:e?rr(e.petId):["saucelings","paint"],mutationFn:async({target:o})=>{if(!r)throw new Error(s("saucelings.album.needsConnection"));return await V("/form/start","POST",{petId:o.petId,key:Ri(o),token:Mi}),(o.kind==="sheet"?Ii:or)(o,r,a,n,s("saucelings.form.failed"))},onSuccess:o=>{a.setQueryData(["saucelings","state"],o),a.invalidateQueries({queryKey:["saucelings","menagerie"]})}}).mutate}function lr(e){let n=va({filters:{mutationKey:e,exact:!0},select:s=>s.state}).at(-1);return{pending:n?.status==="pending",error:n?.error??null}}var aa=e=>lr(rr(e)),cr="saucelings-paint-asked",ur=new Set;function gr(){try{let e=JSON.parse(localStorage.getItem(cr)??"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}catch{return[]}}var Ai=e=>ur.has(e)||gr().includes(e);function Ni(e){ur.add(e);try{localStorage.setItem(cr,JSON.stringify([...gr().filter(t=>t!==e),e].slice(-100)))}catch{}}function Pi({isEgg:e,name:t,onAnswer:n}){let{t:s}=J(),a=j(null);return Y(()=>{let r=a.current;return r&&!r.open&&r.showModal(),r?.querySelector(".sl-btn--primary")?.focus(),()=>r?.close()},[]),h("dialog",{ref:a,className:"sl-dialog","aria-labelledby":"sl-paint-offer-title",onCancel:r=>{r.preventDefault(),n(!1)},children:[i("h2",{id:"sl-paint-offer-title",children:e?s("saucelings.form.offerEggTitle"):s("saucelings.form.offerTitle",{name:t})}),i("p",{children:e?s("saucelings.form.offerEggBody"):s("saucelings.form.offerBody",{name:t})}),h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(!1),children:s("saucelings.form.offerNotNow")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>n(!0),children:s("saucelings.form.offerPaint")})]})]})}function dr({petId:e}){let{t}=J(),{pending:n,error:s}=aa(e);return n?i("span",{role:"status",style:{fontSize:"0.8rem",opacity:.8},children:t("saucelings.form.paintingEgg")}):s?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:t("saucelings.form.eggFailed",{error:s.message})}):null}function Sn({state:e,assetUrl:t}){let{t:n}=J(),s=e.world.activePet,a=Ci(sr(s)),r=ir(a,e,t),{pending:o,error:l}=aa(a?.petId??""),[,c]=G(0),u=e.world.settings;if(!s||!a||!u.portraitEnabled||!u.portraitConnectionId)return null;let p=s.stage==="egg",d=`${a.petId}/${a.stage}`,g=w=>{Ni(d),c(y=>y+1),w&&r({target:a})};return h("div",{className:"sl-care-row",children:[!o&&!Ai(d)?i(Pi,{isEgg:p,name:s.name,onAnswer:g}):null,i("button",{type:"button",className:"sl-btn",disabled:o,onClick:()=>r({target:a}),children:o?n("saucelings.form.painting"):`\u{1F3A8} ${p?n("saucelings.form.paintEgg"):n("saucelings.form.paint",{name:s.name,stage:n(`saucelings.stage.${a.stage}`)})}`}),i("span",{className:"sl-care-note",role:"status",children:n(o?"saucelings.form.paintingNote":"saucelings.form.needed")}),l&&!o?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:l.message}):null]})}function pr({state:e,assetUrl:t}){let{t:n}=J(),s=ge(),[a,r]=G(!1),o=e.world.activePet,l=sr(o,!0),c=ir(l,e,t),{pending:u,error:p}=aa(l?.petId??""),d=ne({mutationFn:async m=>{let b=await V("/form/undo","POST",{petId:m});return await Promise.all(Object.values(b.world.activePet?.forms??{}).map(k=>s.prefetchQuery(ft(k)))),b},onSuccess:m=>{s.setQueryData(["saucelings","state"],m),s.invalidateQueries({queryKey:["saucelings","menagerie"]})}}),g=e.world.settings;if(!o||!l||!l.forms[l.stage]||!g.portraitEnabled)return null;let w=!!g.portraitConnectionId,y=Object.keys(o.savedForms).length>0;if(!w&&!y)return null;let f=o.stage==="egg"?n("saucelings.form.repaintEgg"):n("saucelings.form.repaint",{name:o.name});return h("div",{className:"sl-about-row",children:[a?h(ce,{children:[i("span",{className:"sl-care-note",children:n("saucelings.form.repaintNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>{r(!1),c({target:l})},children:n("saucelings.form.repaintConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>r(!1),children:n("saucelings.common.cancel")})]}):h(ce,{children:[u?i("button",{type:"button",className:"sl-btn",disabled:!0,children:n("saucelings.form.painting")}):w?i(Ie,{text:n("saucelings.form.repaintHint"),label:n("saucelings.help.label",{action:f}),children:h("button",{type:"button",className:"sl-btn",onClick:()=>r(!0),children:["\u{1F3A8} ",f]})}):null,y?i(Ie,{text:n("saucelings.form.undoRepaintHint"),label:n("saucelings.help.label",{action:n("saucelings.form.undoRepaint")}),children:h("button",{type:"button",className:"sl-btn",disabled:u||d.isPending,onClick:()=>d.mutate(o.id),children:["\u21B6 ",n("saucelings.form.undoRepaint")]})}):null,i("span",{className:"sl-care-note",role:"status",children:u?n("saucelings.form.paintingNote"):null})]}),p&&!u?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:p.message}):null,d.error&&!d.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:d.error.message}):null]})}function mr({name:e,flipped:t,request:n}){let{t:s}=J(),a=ge(),r=ne({mutationFn:()=>n(!t),onSuccess:o=>a.setQueryData(["saucelings","state"],o)});return h("div",{className:"sl-about-row",children:[i(Ie,{text:s("saucelings.flip.note",{name:e}),label:s("saucelings.help.label",{action:s("saucelings.flip.label",{name:e})}),children:h("button",{type:"button",className:"sl-btn","aria-pressed":t,disabled:r.isPending,onClick:()=>r.mutate(),children:["\u2194 ",s("saucelings.flip.label",{name:e})]})}),r.error&&!r.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:r.error.message}):null]})}function fr({state:e}){let{t}=J(),n=e.world.activePet;return n?i(mr,{name:n.stage==="egg"?t("saucelings.egg.name"):n.name,flipped:n.flipped,request:s=>V("/pet","PATCH",{flipped:s})}):null}function hr({state:e,characterId:t,name:n}){return i(mr,{name:n,flipped:e.world.flippedCaretakers.includes(t),request:s=>V("/caretaker/flip","PATCH",{characterId:t,flipped:s})})}var nr=e=>["saucelings","figure-paint",e];function br({state:e,characterId:t,name:n,sprites:s}){let{t:a}=J(),r=ge(),[o,l]=G(!1),c=e.world.settings,u=c.portraitConnectionId,p=ut(e.world.caretakerFigures[t]),d=({next:E,image:_,frames:T})=>{let z=E.world.caretakerFigures[t];z&&r.setQueryData(["saucelings","figure",z],{image:_,frames:T}),r.setQueryData(["saucelings","state"],E)},g=ne({mutationKey:nr(t),mutationFn:async()=>{if(!u)throw new Error(a("saucelings.album.needsConnection"));let E=await r.fetchQuery(Dn(t)),_=[E.avatar,zn(s,"neutral")].filter(S=>!!S),T=(await Promise.all(_.map(S=>fs(S).catch(()=>null)))).filter(S=>S!==null),z=null;for(let S of Ps(n,E.appearance,T,c.threeDrawingFallback)){let N=await na(u,S.prompt,Rs,ar,S.references);if(z=await ps(N),z)break}if(!z)throw new Error(a("saucelings.figure.failed",{name:n}));return{next:await V("/figure","POST",{characterId:t,image:z.image}),...z}},onSuccess:d}).mutate,w=ne({mutationFn:async()=>{let E=await V("/figure/undo","POST",{characterId:t}),_=E.world.caretakerFigures[t];return _&&await r.prefetchQuery({queryKey:["saucelings","figure",_],queryFn:()=>V(`/figure/${encodeURIComponent(_)}`),staleTime:1/0}),E},onSuccess:E=>r.setQueryData(["saucelings","state"],E)}),{pending:y,error:f}=lr(nr(t));if(!c.portraitEnabled)return null;let m=!!e.world.caretakerFigures[t],b=!!(m&&e.world.savedFigures[t]);if(!u&&!b)return null;let k=y||w.isPending;return i(ce,{children:h("div",{className:"sl-about-row",children:[o?h(ce,{children:[i("span",{className:"sl-care-note",children:a("saucelings.figure.confirmNote",{name:n})}),i("button",{type:"button",className:"sl-btn",onClick:()=>{l(!1),g()},children:a("saucelings.figure.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>l(!1),children:a("saucelings.common.cancel")})]}):h(ce,{children:[y?i("button",{type:"button",className:"sl-btn",disabled:!0,children:a("saucelings.form.painting")}):u?i(Ie,{text:a("saucelings.figure.hint"),label:a("saucelings.help.label",{action:m?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})}),children:h("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>l(!0),children:["\u{1F3A8} ",m?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})]})}):null,b?i(Ie,{text:a("saucelings.figure.undoHint"),label:a("saucelings.help.label",{action:a("saucelings.figure.undoRepaint",{name:n})}),children:h("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>w.mutate(),children:["\u21B6 ",a("saucelings.figure.undoRepaint",{name:n})]})}):null,i("span",{className:"sl-care-note",role:"status",children:y?a("saucelings.form.paintingNote"):p?.frames===3?a("saucelings.figure.threePoses",{name:n}):null})]}),f&&!y?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:f.message}):null,w.error&&!w.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:w.error.message}):null]})})}function yr({keepsake:e,assetUrl:t,large:n=!1}){let{t:s}=J(),{backgroundId:a}=e,r=le({queryKey:["saucelings","background",a],queryFn:()=>V(`/background/${encodeURIComponent(a??"")}`),enabled:a!==null,staleTime:1/0}),o=a?r.data?.image??null:t(st({species:e.species,stage:e.stage})),c=[{art:{...e.art,evolution:{...e.art.evolution,look:null}},label:s("saucelings.album.before")},{art:e.art,label:s("saucelings.album.after")}];return h("span",{className:`sl-keepsake${n?" sl-keepsake--large":""}`,children:[o?i("img",{className:`sl-stage-bg ${a?"":"sl-stage-bg--pixel"}`,src:o,alt:""}):null,c.map(u=>h("span",{className:"sl-keepsake-side",children:[i(Ae,{art:u.art,species:e.species,stage:e.stage,mood:"happy",assetUrl:t,alt:"",scale:n?2:1,still:!0,frontOnly:!0}),n?i("span",{className:"sl-keepsake-label",children:u.label}):null]},u.label))]})}function vr({id:e,className:t,alt:n}){let{t:s}=J(),a=le({queryKey:["saucelings","portrait",e],queryFn:()=>V(`/portrait/${encodeURIComponent(e)}`),staleTime:1/0});return a.data?i("img",{className:t,src:a.data.image,alt:n}):i("span",{className:`${t} sl-gallery-blank`,children:a.isError?s("saucelings.album.missing"):null})}function wr({state:e,packageId:t,packageVersion:n}){let{t:s}=J(),a=R=>Ke(t,R,n),r=ge(),o=e.world.activePet,l=e.world.settings,[c,u]=G(null),[p,d]=G(null),[g,w]=G(!1),[y,f]=G(!1),[m,b]=G(""),k=j(null);Y(()=>{(c||p)&&k.current?.focus()},[c,p]);let E=le({queryKey:["saucelings","portraits"],queryFn:()=>V("/portraits"),refetchOnMount:"always"}),_=E.data?.portraits??[],T=le({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),enabled:e.menagerieCount>0}),z=[];if(o?.evolution.look&&o.stage!=="egg"){let R=Ye(o).stage;z.push({petId:o.id,name:o.name,home:"nook",art:o,species:o.species,stage:R==="egg"?"hatchling":R,backgroundId:o.backgroundId,form:o.evolution.look.form,at:o.evolution.at})}for(let R of T.data?.menagerie??[]){let B=R.reachedElder?"elder":R.lockedStage??R.stageAtRetirement;!R.evolution.look||B==="egg"||z.push({petId:R.id,name:R.name,home:"menagerie",art:R,species:R.species,stage:B,backgroundId:R.backgroundId,form:R.evolution.look.form,at:R.evolution.at})}let x=R=>{r.setQueryData(["saucelings","state"],R),r.invalidateQueries({queryKey:["saucelings","portraits"]})},S=ne({mutationFn:async R=>{if(!l.portraitConnectionId)throw new Error(s("saucelings.album.needsConnection"));let B=Ye(R).stage,v=R.forms[B],I=Te(R.species,B,"content"),H=v?r.fetchQuery(ft(v,!0)).then(te=>Je(te.image)):R.design?null:Je(a(I.path),I.row),$=H?await H.catch(()=>null):null,q=m.replace(/\s+/gu," ").trim(),W=As(R,$!==null,q),U=await ke("/api/characters/avatar-generation","POST",{connectionId:l.portraitConnectionId,name:"sauceling-portrait",appearance:W,promptOverrides:[{id:"avatar:sauceling-portrait",prompt:W,negativePrompt:xs(q)}],styleProfileId:"off",...$?{referenceImages:[$]}:{}}),Z=await hs(U.image).catch(()=>U.image);return V("/portrait","POST",{petId:R.id,image:Z,instructions:q})},onSuccess:x}),N=ne({mutationFn:R=>V(`/portrait/${encodeURIComponent(R)}/delete`,"POST",{}),onSuccess:R=>{u(null),w(!1),x(R)}}),L=new Map;for(let R of _){let B=L.get(R.petId)??{petId:R.petId,name:R.petName,home:R.home,keepsake:null,paintings:[]};B.paintings.push(R),L.set(R.petId,B)}for(let R of z){let B=L.get(R.petId);B?B.keepsake=R:L.set(R.petId,{petId:R.petId,name:R.name,home:R.home,keepsake:R,paintings:[]})}let D=[...L.values()].sort((R,B)=>+(B.home==="nook")-+(R.home==="nook")),M=_.find(R=>R.id===c)??null,A=z.find(R=>R.petId===p)??null,C=S.error??N.error??E.error,P=l.portraitEnabled?o?o.stage==="egg"?s("saucelings.album.egg"):e.portraitCount>=Nn?s("saucelings.album.full",{limit:Nn}):null:s("saucelings.album.noPet"):s("saucelings.album.off");return h("div",{style:{display:"grid",gap:"1rem"},children:[h("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem",justifyItems:"start"},children:[P||!o?i("span",{style:{fontSize:"0.85rem",opacity:.8},children:P}):h(ce,{children:[i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:S.isPending,onClick:()=>S.mutate(o),children:S.isPending?s("saucelings.album.painting"):`\u{1F3A8} ${s("saucelings.album.paint",{name:o.name})}`}),i("button",{type:"button",className:"sl-link",disabled:S.isPending,onClick:()=>{y&&b(""),f(!y)},children:s(y?"saucelings.album.removeInstructions":"saucelings.album.addInstructions")}),y?h("div",{style:{display:"grid",gap:"0.3rem",width:"100%"},children:[i("label",{className:"sl-picker-label",htmlFor:"sl-paint-instructions",children:s("saucelings.album.instructionsLabel")}),i("textarea",{id:"sl-paint-instructions",className:"sl-input sl-picker-prompt",rows:2,maxLength:Fa,placeholder:s("saucelings.album.instructionsPlaceholder"),disabled:S.isPending,value:m,onChange:R=>b(R.target.value)}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:s("saucelings.album.instructionsNote")})]}):null]}),C?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:C.message}):null,o&&!P?i(Sn,{state:e,assetUrl:a}):null]}),A?h("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(yr,{keepsake:A,assetUrl:a,large:!0}),i("div",{style:{fontSize:"0.85rem"},children:s("saucelings.album.keepsakeCaption",{name:A.name,form:A.form,date:A.at?new Date(A.at).toLocaleDateString():""})}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:s("saucelings.album.close")})]}):null,M?h("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(vr,{id:M.id,className:"sl-viewer-image",alt:s("saucelings.album.alt",{name:M.petName})}),h("div",{style:{fontSize:"0.85rem"},children:[i("strong",{children:M.petName})," ",i("span",{style:{opacity:.75},children:s("saucelings.album.caption",{stage:s(`saucelings.stage.${M.stage}`),date:new Date(M.savedAt).toLocaleDateString()})}),M.instructions?i("div",{style:{fontStyle:"italic",opacity:.75},children:s("saucelings.album.instructionsCaption",{instructions:M.instructions})}):null]}),i("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem"},children:g?h(ce,{children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:N.isPending,onClick:()=>N.mutate(M.id),children:s("saucelings.album.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>w(!1),children:s("saucelings.common.cancel")})]}):h(ce,{children:[i("button",{type:"button",className:"sl-btn",onClick:()=>w(!0),children:s("saucelings.album.delete")}),i("button",{type:"button",className:"sl-btn",onClick:()=>u(null),children:s("saucelings.album.close")})]})})]}):null,E.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.loading")}):D.length===0?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.album.empty")}):D.map(R=>h("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem"},children:[h("div",{style:{fontSize:"0.9rem"},children:[i("strong",{children:R.name})," ",i("span",{style:{opacity:.7},children:R.home==="menagerie"?s("saucelings.album.inMenagerie"):R.home==="released"?s("saucelings.album.released"):""})]}),h("div",{className:"sl-gallery",children:[R.keepsake?i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.keepsakeLabel",{name:R.name}),"aria-pressed":R.petId===p,onClick:()=>{u(null),d(R.petId)},children:i(yr,{keepsake:R.keepsake,assetUrl:a})}):null,R.paintings.map(B=>i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.alt",{name:B.petName}),"aria-pressed":B.id===c,onClick:()=>{w(!1),d(null),u(B.id)},children:i(vr,{id:B.id,className:"sl-gallery-image",alt:""})},B.id))]})]},R.petId))]})}function Sr({state:e}){let{t}=J(),n=e.world.activePet,s=n?.journal??[];return!n||s.length===0?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.empty.title")}):i("div",{style:{display:"grid",gap:"0.65rem"},children:s.map(a=>h("div",{className:"sl-card",style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"1rem"},children:[h("div",{style:{display:"grid",gap:"0.25rem"},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.72rem",opacity:.7},children:[i("span",{style:{textTransform:"uppercase",fontWeight:600},children:t(`saucelings.event.${a.kind}`)}),a.generated?i("span",{style:{padding:"0.05rem 0.4rem",borderRadius:"999px",background:"rgba(169,120,232,0.2)",color:"#d8b4fe"},children:t("saucelings.journal.generated")}):null]}),h("p",{style:{margin:0,fontSize:"0.875rem",lineHeight:1.45},children:[a.speaker?i("strong",{children:t("saucelings.journal.speaker",{name:a.speaker})}):null,a.speaker?" ":null,a.text]})]}),i("time",{style:{fontSize:"0.72rem",opacity:.6,whiteSpace:"nowrap"},children:new Date(a.createdAt).toLocaleString()})]},a.id))})}function sa(e){return e.design?null:Aa.includes(e.species)?"special":Na.includes(e.species)?"halloween":null}var Ti={special:{rows:["....K....","...KYK...","KKKKYKKKK","KYYYWYYYK",".KYYYYYK.","..KYYYK..",".KYYKYYK.",".KYK.KYK.",".KK...KK."],colours:{K:"#4a2c0a",Y:"#ffd84a",W:"#fff6c2"}},halloween:{rows:[".....gg..","....gG...",".KKKgKKK.","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK",".KOOOOOK.","..KKKKK.."],colours:{K:"#5a2008",O:"#ff8a28",o:"#c95212",g:"#2f5e1e",G:"#7fd35a"}}},_i=Object.fromEntries(Object.entries(Ti).map(([e,{rows:t,colours:n}])=>[e,t.flatMap((s,a)=>[...s.matchAll(/([^.])\1*/gu)].map(r=>({x:r.index,y:a,w:r[0].length,fill:n[r[1]]})))]));function Lt({pet:e,labelled:t=!0}){let{t:n}=J(),s=sa(e);return s?i("svg",{className:"sl-rare-mark",viewBox:"0 0 9 9",width:"18",height:"18",shapeRendering:"crispEdges",...t?{role:"img","aria-label":n(`saucelings.pet.rare.${s}`)}:{"aria-hidden":!0},children:_i[s].map(a=>i("rect",{x:a.x,y:a.y,width:a.w,height:1,fill:a.fill},`${a.x},${a.y}`))}):null}function kr(e){let t=Ue(e)?.sauce;return t?{"--sl-sauce-accent":t.accentColor,"--sl-sauce-bg":t.badgeBg}:{}}function xr({state:e,packageId:t,packageVersion:n,onRestored:s}){let{t:a}=J(),r=C=>Ke(t,C,n),o=ge(),l=le({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),refetchOnMount:"always"}),c=l.data?.menagerie??[],u=e.world.activePet,p=u?u.stage==="egg"?a("saucelings.menagerie.activeEgg"):u.name:"",[d,g]=G({}),[w,y]=G({}),f=C=>w[C.id]??(C.farewellScene?C.caretakerId:""),[m,b]=G(null),[k,E]=G(null),_=j(null),T=j(new Map),z=j(null);Y(()=>{m?_.current?.focus():z.current&&T.current.get(z.current)?.focus(),z.current=null},[m]);let x=ne({mutationFn:C=>V(`/menagerie/${encodeURIComponent(C.id)}/restore`,"POST",{stage:C.stage,swap:C.swap,caretakerId:C.caretakerId}),onSuccess:(C,P)=>{E(null),o.setQueryData(["saucelings","state"],C),s(P.caretakerId)}}),S=ne({mutationFn:C=>V(`/menagerie/${encodeURIComponent(C)}/release`,"POST",{}),onSuccess:C=>{E(null),b(null),o.setQueryData(["saucelings","state"],C),o.invalidateQueries({queryKey:["saucelings","menagerie"]}),o.invalidateQueries({queryKey:["saucelings","portraits"]})}}),N=x.error??S.error??l.error,L=x.isPending||S.isPending,D=c.find(C=>C.id===m)??null,M=C=>{E(null),b(C)},A=()=>{z.current=m,E(null),b(null)};return l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.loading")}):c.length===0&&!N?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.menagerie.empty")}):h("div",{style:{display:"grid",gap:"1rem"},children:[N?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:N.message}):null,D?i(Oi,{entry:D,cardRef:_,assetUrl:r,chosenStage:d[D.id]??"elder",onPickStage:C=>g(P=>({...P,[D.id]:C})),characters:e.characters,caretakerId:f(D),onPickCaretaker:C=>y(P=>({...P,[D.id]:C})),activeName:p,hasActivePet:!!u,confirming:k,setConfirming:E,pending:L,onRestore:(C,P)=>x.mutate({id:D.id,stage:C,swap:P,caretakerId:f(D)}),onRelease:()=>S.mutate(D.id),onClose:A}):null,$a(c).map(C=>h("section",{className:"sl-menagerie-section",children:[h("h3",{className:"sl-menagerie-heading",children:[a(`saucelings.menagerie.section.${C.stage}`),i("span",{className:"sl-menagerie-count",children:C.entries.length})]}),i("div",{className:"sl-gallery sl-gallery--pets",children:C.entries.map(P=>{let R=P.stageAtRetirement==="egg",B=R?a("saucelings.egg.name"):P.name,v=R?null:sa(P);return h("button",{ref:I=>{I?T.current.set(P.id,I):T.current.delete(P.id)},type:"button",className:"sl-gallery-tile",style:kr(P),"aria-label":v?`${B}, ${a(`saucelings.pet.rare.${v}`)}`:B,"aria-pressed":P.id===m,onClick:()=>M(P.id),children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:P,species:P.species,stage:P.reachedElder?d[P.id]??"elder":P.lockedStage??P.stageAtRetirement,mood:"happy",assetUrl:r,alt:"",scale:2,still:!0,frontOnly:!0})}),R?null:h("span",{className:"sl-pet-tile-name",children:[i(Lt,{pet:P,labelled:!1}),P.name]})]},P.id)})})]},C.stage))]})}function Oi({entry:e,cardRef:t,assetUrl:n,chosenStage:s,onPickStage:a,characters:r,caretakerId:o,onPickCaretaker:l,activeName:c,hasActivePet:u,confirming:p,setConfirming:d,pending:g,onRestore:w,onRelease:y,onClose:f}){let{t:m}=J(),b=qe(e),k=e.stageAtRetirement==="egg",E=k?m("saucelings.egg.name"):e.name,_=k?m("saucelings.menagerie.thisEgg"):e.name,T=Ue(e),z=e.reachedElder?s:e.lockedStage??e.stageAtRetirement,x=N=>w(e.reachedElder?s:void 0,N),S=r.length>0?r.map(N=>({id:N.id,name:N.name})):[{id:"caretaker",name:m("saucelings.empty.houseCaretaker")}];return e.farewellScene&&!S.some(N=>N.id===e.caretakerId)&&S.unshift({id:e.caretakerId,name:e.careProfile.characterName}),h("div",{ref:t,tabIndex:-1,className:"sl-card sl-viewer",style:{display:"grid",gap:"0.75rem",justifyItems:"stretch",...kr(e)},children:[h("div",{style:{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"},children:[i("div",{className:"sl-sprite-stage",style:{width:"7.5rem",height:"7.5rem"},children:i(Ae,{art:e,species:e.species,stage:z,mood:"happy",assetUrl:n,alt:E,scale:2,still:!0,frontOnly:!0})}),h("div",{style:{flex:"1 1 16rem",display:"grid",gap:"0.35rem"},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"1.1rem"},children:E}),k?null:i(Lt,{pet:e}),k||!T?null:i("span",{className:"sl-badge",title:T.readsAs,children:T.sauce?m("saucelings.pet.sauce",{sauce:T.name}):m("saucelings.pet.temperament",{temperament:T.name})}),i("span",{className:"sl-badge",children:m("saucelings.menagerie.foundBy",{name:e.finder.name})}),!k&&e.evolution?.at?i("span",{className:"sl-badge",children:m("saucelings.menagerie.evolved")}):null,h("span",{style:{fontSize:"0.8rem",opacity:.75},children:[k?"":`${b.name} \xB7 `,e.farewellScene?m("saucelings.menagerie.retiredAs",{stage:m(`saucelings.stage.${e.stageAtRetirement}`),name:e.careProfile.characterName}):""]})]}),e.farewellScene?i("p",{style:{margin:0,fontSize:"0.825rem",opacity:.85},children:e.farewellScene}):null,k&&e.design?i(dr,{petId:e.id}):null]})]}),h("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem",flexWrap:"wrap"},children:[i("span",{children:m("saucelings.menagerie.lookedAfterBy")}),h("select",{className:"sl-select",value:o,disabled:g,onChange:N=>l(N.target.value),children:[o?null:i("option",{value:"",disabled:!0,children:m("saucelings.menagerie.chooseCaretaker")}),S.map(N=>i("option",{value:N.id,children:N.name},N.id))]})]}),h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem",borderTop:"1px solid var(--border, rgba(255,255,255,0.08))",paddingTop:"0.65rem"},children:[p?h(ce,{children:[i("span",{style:{fontSize:"0.8rem"},children:p==="release"?k?m("saucelings.menagerie.releaseNoteEgg"):m("saucelings.menagerie.releaseNote",{name:e.name}):m("saucelings.menagerie.swapNote",{name:_,active:c})}),h("div",{style:{display:"flex",gap:"0.5rem"},children:[p==="release"?i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:g,onClick:y,children:m("saucelings.menagerie.releaseConfirm")}):i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:g||!o,onClick:()=>x(!0),children:m("saucelings.menagerie.swapConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:m("saucelings.common.cancel")})]})]}):e.reachedElder?h("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem"},children:[i("span",{children:m("saucelings.menagerie.lockStage")}),i("select",{className:"sl-select",value:s,onChange:N=>a(N.target.value),children:Ta.map(N=>i("option",{value:N,children:m(`saucelings.stage.${N}`)},N))})]}):e.farewellScene?null:h("span",{style:{fontSize:"0.75rem",opacity:.7},children:[m("saucelings.menagerie.returnsAt")," ",i("strong",{children:m(`saucelings.stage.${e.stageAtRetirement}`)})]}),p?null:h("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginLeft:"auto"},children:[i("button",{type:"button",className:"sl-btn",onClick:f,children:m("saucelings.menagerie.close")}),i("button",{type:"button",className:"sl-btn",disabled:g,onClick:()=>d("release"),children:m("saucelings.menagerie.release")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:g||!o,title:o?void 0:m("saucelings.menagerie.chooseCaretaker"),onClick:()=>u?d("swap"):x(!1),children:m("saucelings.menagerie.bringBack")})]})]})]})}var Cr=1280,Rr=720,Fi=20*1024*1024;async function Er(e){let t=await Oe(e),n=Math.min(t.naturalWidth,t.naturalHeight*16/9),s=n*9/16,a=document.createElement("canvas");a.width=Math.min(Cr,Math.round(n)),a.height=Math.min(Rr,Math.round(a.width*9/16));let r=a.getContext("2d");if(!r)throw new Error("This browser cannot resize pictures.");r.imageSmoothingQuality="high",r.drawImage(t,(t.naturalWidth-n)/2,(t.naturalHeight-s)/2,n,s,0,0,a.width,a.height);let o=a.toDataURL("image/webp",.85);return o.startsWith("data:image/webp")?o:a.toDataURL("image/jpeg",.88)}function Li({id:e}){let{t}=J(),n=le({queryKey:["saucelings","background",e],queryFn:()=>V(`/background/${encodeURIComponent(e)}`),staleTime:1/0});return n.data?i("img",{className:"sl-gallery-image",src:n.data.image,alt:""}):i("span",{className:"sl-gallery-image sl-gallery-blank",children:n.isError?t("saucelings.background.missing"):null})}function Mr({pet:e,settings:t,assetUrl:n,onClose:s}){let{t:a}=J(),r=ge(),o=j(null),[l,c]=G(()=>Kn(e)),[u,p]=G(null),d=le({queryKey:["saucelings","backgrounds"],queryFn:()=>V("/backgrounds"),refetchOnMount:"always"}),g=d.data?.backgrounds??[],w=g.length>=An,y=S=>S.label||a("saucelings.background.earlier"),f=S=>{r.setQueryData(["saucelings","state"],S),r.invalidateQueries({queryKey:["saucelings","backgrounds"]})},m=ne({mutationFn:async S=>{if(S.size>Fi)throw new Error(a("saucelings.background.tooBig"));let N=URL.createObjectURL(S);try{let L=await Er(N),D=S.name.replace(/\.[^.]+$/u,"").slice(0,120);return await V("/background","POST",{image:L,label:D,source:"upload"})}finally{URL.revokeObjectURL(N)}},onSuccess:f}),b=ne({mutationFn:async()=>{if(!t.portraitConnectionId)throw new Error(a("saucelings.background.noConnection"));let S=Fs(l),N=await ke("/api/characters/avatar-generation","POST",{connectionId:t.portraitConnectionId,name:"sauceling-background",appearance:S,width:Cr,height:Rr,styleProfileId:"off",promptOverrides:[{id:"avatar:sauceling-background",prompt:S,negativePrompt:Ms}]}),L=await Er(N.image);return V("/background","POST",{image:L,label:l.trim().slice(0,120),source:"generated"})},onSuccess:f}),k=ne({mutationFn:()=>V("/background/suggest","POST",{}),onSuccess:({scene:S})=>c(S??Kn(e))}),E=ne({mutationFn:S=>V(S?`/background/${encodeURIComponent(S)}/select`:"/background/clear","POST",{}),onSuccess:f}),_=ne({mutationFn:S=>V(`/background/${encodeURIComponent(S)}/delete`,"POST",{}),onSuccess:S=>{p(null),f(S)}}),T=m.isPending||b.isPending||k.isPending||E.isPending||_.isPending,z=m.error??b.error??k.error??E.error??_.error??d.error,x=t.portraitEnabled?t.portraitConnectionId?null:a("saucelings.background.noConnection"):a("saucelings.background.off");return h("section",{className:"sl-card sl-picker","aria-label":a("saucelings.background.title"),children:[i("strong",{children:a("saucelings.background.title")}),h("div",{className:"sl-gallery sl-gallery--wide",role:"group","aria-label":a("saucelings.background.library"),children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.useBuiltIn"),title:a("saucelings.background.useBuiltIn"),"aria-pressed":e.backgroundId===null,disabled:T,onClick:()=>e.backgroundId!==null&&E.mutate(null),children:i("img",{className:"sl-gallery-image sl-stage-bg--pixel",src:n(st(e)),alt:""})}),g.map(S=>h("div",{className:"sl-gallery-item",children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.tileAlt",{label:y(S)}),title:y(S),"aria-pressed":e.backgroundId===S.id,disabled:T,onClick:()=>e.backgroundId!==S.id&&E.mutate(S.id),children:i(Li,{id:S.id})}),i("button",{type:"button",className:"sl-gallery-remove","aria-label":a("saucelings.background.delete",{label:y(S)}),title:a("saucelings.background.delete",{label:y(S)}),disabled:T,onClick:()=>p(S),children:"\xD7"})]},S.id))]}),u?h("div",{className:"sl-picker-row",role:"group","aria-label":a("saucelings.background.delete",{label:y(u)}),children:[i("span",{className:"sl-box-note",children:a("saucelings.background.deleteNote",{label:y(u)})}),i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:T,onClick:()=>_.mutate(u.id),children:a("saucelings.background.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>p(null),children:a("saucelings.common.cancel")})]}):null,h("div",{className:"sl-picker-row",children:[i("input",{ref:o,type:"file",className:"sl-sr-only",accept:"image/png,image/jpeg,image/webp",tabIndex:-1,onChange:S=>{let N=S.target.files?.[0];S.target.value="",N&&m.mutate(N)}}),i("button",{type:"button",className:"sl-btn",disabled:T||w,onClick:()=>o.current?.click(),children:m.isPending?a("saucelings.background.uploading"):`\u2B06 ${a("saucelings.background.upload")}`}),i("button",{type:"button",className:"sl-btn",onClick:s,children:a("saucelings.album.close")}),w?i("span",{className:"sl-box-note",children:a("saucelings.background.full",{limit:An})}):null]}),i("label",{className:"sl-picker-label",htmlFor:"sl-background-prompt",children:a("saucelings.background.promptLabel")}),i("textarea",{id:"sl-background-prompt",className:"sl-input sl-picker-prompt",rows:3,maxLength:600,value:l,onChange:S=>{c(S.target.value),k.reset()}}),h("div",{className:"sl-picker-row",children:[i("button",{type:"button",className:"sl-btn",disabled:T||x!==null,onClick:()=>k.mutate(),children:k.isPending?a("saucelings.background.suggesting"):`\u270D ${e.stage==="egg"?a("saucelings.background.suggestEgg"):a("saucelings.background.suggest",{name:e.name})}`}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:T||w||x!==null||!l.trim(),onClick:()=>b.mutate(),children:b.isPending?a("saucelings.background.generating"):`\u2728 ${a("saucelings.background.generate")}`}),x?i("span",{className:"sl-box-note",children:x}):null,k.data?.scene===null?i("span",{className:"sl-box-note",children:a("saucelings.background.suggestPlain")}):null]}),z?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:z.message}):null]})}function Ir(e,t=e*9/16){let n=Math.round(Math.max(e/176,t/99));return n>=4?4:n<=2?2:3}var ra=["rigamuffin","fluttino","burrowl"],$i=["shellbini","lentino","puddlepip"],Ar=["fluttino","wickwisp"],Ui={grumpy:6,content:10,happy:14};function Hi(e){return e>=22||e<7}function Di(e,t,n,s=!1){let a=ra.includes(t)?2:1,r=$i.includes(t)?3:1;if(e==="grumpy")return{wander:2,idle:3,look:1,hop:0,hum:0,nap:0,huff:3,signature:0};if(e==="happy")return{wander:4,idle:3,look:a,hop:1,hum:r,nap:0,huff:0,signature:s?1:0};let o=Hi(n)?4:1;return{wander:4,idle:3,look:a,hop:0,hum:r,nap:o,huff:0,signature:s?.5:0}}function Nr(e,t,n,s,a=!1){let r=Di(e,t,n,a),o=Object.keys(r).filter(u=>r[u]>0),l=o.reduce((u,p)=>u+r[p],0),c=Math.min(Math.max(s,0),.999999)*l;for(let u of o)if(c-=r[u],c<0)return u;return o[o.length-1]}function oa(e,t,n){return e==="huff"?"grumpy":e==="hop"||e==="hum"||e==="signature"?t==="grumpy"?null:"happy":e!=="idle"?null:t==="happy"?n<.6?"happy":null:t==="content"?n<.25?"happy":null:n<.3?"content":null}function kn(e,t,n){return t==="rest"?"content":t?e==="grumpy"?"content":"happy":n??(e==="happy"?"content":e)}function $t(e){return{min:-6,max:Math.max(-6,Math.floor(e)-52+6)}}function Ze(e,t){let{min:n,max:s}=$t(t);return Math.round(Math.min(Math.max(e,n),s))}var zi=.3;function Pr(e,t){return t?Math.floor(e*(1-zi)):e}function ia(e){return Ze((e-52)/2,e)}function Tr(e,t){return Math.max(200,Math.round(Math.abs(e)/Ui[t]*1e3))}var Bi=48,Gi=1e3;function _r(e){return Math.min(Gi,Math.max(200,Math.round(Math.abs(e)/Bi*1e3)))}var xn=(e,t)=>e+Math.random()*(t-e);function Ne(){if(typeof document>"u")return!0;let e=document.documentElement;return e.dataset.marinaraReducedEffects==="true"||e.dataset.marinaraEffectsPaused==="true"||document.hidden||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Or({stageArtWidth:e,mood:t,species:n,enabled:s,busy:a,paused:r=!1,move:o=null,measureX:l}){let[c,u]=G(()=>({x:ia(e),facing:"right",pose:null,cue:null,moveMs:0,steps:1,face:null,act:null})),p=s&&!a&&!r&&e>0,d=j({actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p});d.current={actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p};let g=j([]),w=j(null),y=de(A=>u(C=>({...C,...A})),[]),f=de((A,C)=>{g.current.push(window.setTimeout(C,A))},[]),m=de(()=>{for(let C of g.current)window.clearTimeout(C);g.current=[];let A=w.current;w.current=null,A?.()},[]),b=de(()=>{let A=d.current.measureX(),C=d.current.stageArtWidth;u(P=>({...P,x:A===null||C<=0?P.x:Ze(A,C),moveMs:0,steps:1,pose:null,cue:null,face:null,act:null}))},[]),k=j(()=>{}),E=de(()=>f(xn(2500,7e3),()=>k.current()),[f]),_=de((A,C,P=!1)=>{let{actor:R,mood:B}=d.current,v=Ze(A,d.current.stageArtWidth),I=v-R.x;if(Math.abs(I)<4)return C();let H=P?_r(I):Tr(I,B);y({x:v,facing:I>0?"right":"left",pose:"walk",moveMs:H,steps:Math.abs(I)}),f(H+60,()=>{y({pose:null,moveMs:0,steps:1}),C()})},[f,y]),T=de((A,C,P,R,B)=>{let{actor:v,stageArtWidth:I}=d.current,H=Ze(d.current.measureX()??v.x,I),$=B!==void 0||Math.random()<1/8,q=Vs(A)?P??(H+52/2<=I/2?"right":"left"):v.facing,W=q==="right"?1:-1,U=Math.abs(Ze(H+W*qs(A,$,!1),I)-H);y({x:H,moveMs:0,steps:1,facing:q,face:C,act:{kind:"move",move:A,encore:$,travel:U,spot:!1,at:Date.now(),...B?{colour:B}:{}}}),f(Ft(A,$)*De,()=>{y({act:null,x:H+W*U,face:null}),R()})},[f,y]),z=de(()=>{if(Ne())return E();let{actor:A,mood:C,species:P,stageArtWidth:R,move:B}=d.current,v=Nr(C,P,new Date().getHours(),Math.random(),!!B),I=oa(v,C,Math.random()),H=Date.now();switch(v){case"wander":{let{min:$,max:q}=$t(R);return _(xn($,q),E)}case"idle":return y({face:I}),f(xn(3e3,6e3),()=>{y({face:null}),E()});case"look":{let $=A.facing;return y({facing:$==="right"?"left":"right",cue:ra.includes(P)?{kind:"question",at:H}:null,face:I}),f(1400,()=>{y({facing:$,cue:null,face:null}),E()})}case"hop":return y({pose:"hop",face:I}),f(700,()=>{y({pose:null,face:null}),E()});case"hum":return y({cue:{kind:"note",at:H},face:I}),f(2200,()=>{y({cue:null,face:null}),E()});case"nap":return y({pose:"nap",cue:{kind:"nap",at:H},face:I}),f(xn(4e3,6e3),()=>{y({pose:null,cue:null,face:null}),E()});case"huff":return y({pose:"huff",face:I}),f(1300,()=>{y({pose:null,face:null}),E()});case"signature":return B?T(B,I,null,E):E()}},[f,E,y,T,_]);k.current=z,Y(()=>{if(p)return E(),()=>{m(),b()}},[p,E,m,b]);let x=j(!1);Y(()=>{if(e<=0)return;let A=!x.current;A&&(x.current=!0),u(C=>{let P=s&&!A?Ze(C.x,e):ia(e);return P===C.x?C:{...C,x:P,moveMs:0,steps:1}})},[e,s]);let S=de(A=>{if(!s||a||r||Ne())return;m(),b();let C=Date.now(),P=d.current.measureX()??d.current.actor.x,R=A>=P+52/2?"right":"left",{move:B,mood:v}=d.current;if(B&&v==="happy"&&Math.random()<.4)return T(B,"happy",R,E);y({facing:R,pose:"hop",cue:{kind:"bang",at:C}}),f(700,()=>{y({pose:null,cue:null}),_(A-52/2,E)})},[f,E,a,s,r,b,y,T,m,_]),N=de(A=>{m(),b();let C=Ne();y({act:{kind:"moment",reduced:C,at:Date.now()}});let P=()=>{d.current.running&&E()};f((C?Zn:Jn)*De,()=>{y({act:null}),C?P():T(A,"happy",null,P)})},[f,E,b,y,T,m]),L=de((A,C,P,R)=>{m(),b(),y({act:{kind:"hatch",how:A,colour:C,at:Date.now()}});let B=v=>v<P.length?T(P[v],"happy",null,()=>B(v+1),C):R();f(ea*De,()=>{y({act:null}),B(0)})},[f,b,y,T,m]),D=de(A=>{if(!s||a||r||w.current||Ne())return;m(),b();let C=()=>{y({facing:A?"right":d.current.actor.facing,pose:"hop",face:oa("hop",d.current.mood,0)}),f(700,()=>{y({pose:null,face:null}),E()})};if(!A)return C();y({facing:"right"}),f(300,()=>_($t(d.current.stageArtWidth).max,C))},[f,E,a,s,r,b,y,m,_]),M=de(A=>new Promise(C=>{if(!A||!s||a||r||Ne()||d.current.stageArtWidth<=0)return C();m(),b(),w.current=C;let P=0,R=()=>{if(d.current.measureX()!==d.current.actor.x&&P++<8)return f(50,R);w.current=null,C(),E()},B=d.current.actor.facing!=="right";y({facing:"right"}),f(B?250:60,()=>_($t(d.current.stageArtWidth).max,R,!0))}),[f,E,a,s,r,b,y,m,_]);return{actor:c,poke:S,listen:D,comeOver:M,celebrate:N,hatch:L}}var Ki=8,qi=2,Vi=44;function Fr({lines:e,fallbackLine:t,caretakerId:n,caretakerName:s,isCharacter:a,meals:r,isEgg:o,writing:l,standing:c,onTyping:u,children:p}){let{t:d}=J(),g=e.slice(0,Ki),[w,y]=G(0),f=g[0]?.id;Y(()=>y(0),[f]);let m=Math.min(w,Math.max(0,g.length-1)),b=g[m]??null,k=ct(n,a&&!c),E=b&&l.includes(b.id)?d("saucelings.checkIn.pending",{name:b.speaker??s}):b?.text??t,_=g[0]&&!l.includes(g[0].id)?g[0]:null,T=_?`${_.id}:${_.text}`:null,z=j(T),[x,S]=G(null);Y(()=>{!T||T===z.current||(z.current=T,S(Ne()?null:0))},[T]);let N=Array.from(E),L=x!==null&&m===0&&b===_&&x<N.length;Y(()=>{if(!L)return;let M=window.setTimeout(()=>S(A=>A===null?null:A+qi),Vi);return()=>window.clearTimeout(M)},[L,x]),Y(()=>u?.(L),[u,L]);let D=M=>{S(null),y(M)};return h("section",{className:`sl-box sl-box--joined ${c?"sl-box--standing":""}`,"aria-label":d("saucelings.caretaker.says",{name:s}),children:[c?null:i(gt,{box:!0,name:s,src:k}),h("div",{className:"sl-box-plate",children:[i("strong",{children:b?.speaker??s}),r.total>0?i("span",{className:"sl-pill",title:d(o?"saucelings.pet.keptWarmTitle":"saucelings.pet.mealsTitle",{name:s}),children:d(o?"saucelings.pet.keptWarm":"saucelings.pet.meals",r)}):null,b?.generated?i("span",{className:"sl-pill sl-pill--ai",children:d("saucelings.journal.generated")}):null]}),h("p",{className:`sl-box-line ${L?"sl-box-line--typing":""}`,"aria-live":"polite",onClick:()=>S(null),children:[h("span",{className:"sl-box-typed","aria-hidden":"true",children:[i("span",{className:"sl-box-ghost",children:E}),i("span",{children:L?N.slice(0,x).join(""):E})]}),i("span",{className:"sl-sr-only",children:E})]}),b?h("div",{className:"sl-box-nav",children:[g.length>1?h(ce,{children:[i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.previous"),disabled:m>=g.length-1,onClick:()=>D(m+1),children:"\u25C0"}),i("span",{children:d("saucelings.caretaker.position",{index:g.length-m,count:g.length})}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.next"),disabled:m===0,onClick:()=>D(m-1),children:"\u25B6"})]}):null,i("time",{className:"sl-box-time",children:new Date(b.createdAt).toLocaleString()})]}):null,p]})}function Lr({state:e,assetUrl:t}){let{t:n}=J(),[s,a]=G(!1),r=e.world.activePet;return!r||r.stage==="egg"||r.evolution.offer!=="offered"||r.evolution.look?null:h("div",{className:"sl-about-row",children:[i(Ie,{text:n("saucelings.evolve.note",{name:r.name}),label:n("saucelings.help.label",{action:n("saucelings.evolve.button")}),children:h("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>a(!0),children:["\u2728 ",n("saucelings.evolve.button")]})}),s?i(Qi,{pet:r,assetUrl:t,onClose:()=>a(!1)}):null]})}function $r({state:e}){let{t}=J(),n=ge(),s=ne({mutationFn:()=>V("/evolve/undo","POST",{}),onSuccess:r=>n.setQueryData(["saucelings","state"],r)}),a=e.world.activePet;return a?.evolution.look?h("div",{className:"sl-about-row",children:[i(Ie,{text:t("saucelings.evolve.undoNote",{name:a.name}),label:t("saucelings.help.label",{action:t("saucelings.evolve.undo")}),children:h("button",{type:"button",className:"sl-btn",disabled:s.isPending,onClick:()=>s.mutate(),children:["\u21A9 ",t("saucelings.evolve.undo")]})}),s.error&&!s.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:s.error.message}):null]}):null}function Wi(e){let[t,n]=G(null),s=e.join(" ");return Y(()=>{if(!s)return;let a=Math.max(...s.split(" ").map(l=>Ft(l,!1)))*De,r=0,o=l=>{n(l&&!Ne()?Date.now():null),r=window.setTimeout(()=>o(!l),l?a:2100)};return r=window.setTimeout(()=>o(!0),1200),()=>window.clearTimeout(r)},[s]),Vt(()=>s.split(" ").map(a=>t===null?null:{kind:"move",move:a,encore:!1,travel:0,spot:!0,at:t}),[s,t])}function Qi({pet:e,assetUrl:t,onClose:n}){let{t:s}=J(),a=ge(),r=j(null),[o,l]=G(!1),c=e.careProfile.characterName,u=b=>{a.setQueryData(["saucelings","state"],b)},p=ne({mutationFn:()=>V("/evolve/options","POST",{}),onSuccess:u}),d=ne({mutationFn:b=>V("/evolve/choose","POST",{index:b}),onSuccess:b=>{u(b),n()}}),g=ne({mutationFn:()=>V("/evolve/decline","POST",{}),onSuccess:b=>{u(b),n()}}),w=e.evolution.choices,y=Wi(w?.map(b=>b.move)??[]),f=p.isPending||d.isPending||g.isPending,m=p.error??d.error??g.error;return Y(()=>{let b=r.current;return b&&!b.open&&b.showModal(),b?.focus(),()=>b?.close()},[]),Y(()=>{w||p.mutate()},[]),h("dialog",{ref:r,className:"sl-dialog sl-dialog--wide",tabIndex:-1,"aria-labelledby":"sl-evolve-title",onCancel:b=>{b.preventDefault(),o?l(!1):f||n()},children:[i("h2",{id:"sl-evolve-title",children:o?s("saucelings.evolve.declineConfirm",{name:e.name}):s("saucelings.evolve.title",{name:e.name})}),o?h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",autoFocus:!0,onClick:()=>l(!1),children:s("saucelings.common.cancel")}),i("button",{type:"button",className:"sl-btn",disabled:f,onClick:()=>g.mutate(),children:s("saucelings.evolve.decline")})]}):h(ce,{children:[w?i("div",{className:"sl-evolve-choices",children:w.map((b,k)=>h("div",{className:"sl-evolve-choice",children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:{...e,evolution:{...e.evolution,look:b}},species:e.species,stage:e.stage,mood:"happy",act:y[k]??null,facing:e.flipped?"left":"right",flipped:e.flipped,assetUrl:t,alt:"",scale:2})}),i("h3",{children:b.form}),i("p",{children:b.description}),i("p",{className:"sl-evolve-from",children:s("saucelings.evolve.from",{from:b.from})}),i("p",{children:s("saucelings.evolve.move",{move:s(`saucelings.evolve.moves.${b.move}`)})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:f,onClick:()=>d.mutate(k),children:s("saucelings.evolve.become",{form:b.form})})]},b.form))}):i("p",{role:"status",children:p.isPending||!m?s("saucelings.evolve.writing",{caretaker:c,name:e.name}):null}),m&&!f?i("p",{role:"alert",style:{color:"#f87171"},children:m.message}):null,i("div",{className:"sl-dialog-actions",children:i("button",{type:"button",className:"sl-btn",disabled:f,onClick:n,children:s("saucelings.evolve.keep")})}),h("p",{className:"sl-evolve-decline",children:[i("button",{type:"button",className:"sl-link",disabled:f,onClick:()=>l(!0),children:s("saucelings.evolve.decline")})," ",s("saucelings.evolve.declineNote",{name:e.name})]})]})]})}var Ur=8,ji=10,Yi={x:.5,y:.69},la=2,Hr=32,ca=13;function Xi(e,t,n){let s=Math.max(e/n.width,t/n.height);return{left:(e-n.width*s)/2,top:(t-n.height*s)/2,width:n.width*s,height:n.height*s}}var Ji=22;function Zi(){let e=j(null),[t,n]=G({width:0,height:0});return Y(()=>{let s=e.current;if(!s||typeof ResizeObserver>"u")return;let a=()=>n(o=>o.width===s.clientWidth&&o.height===s.clientHeight?o:{width:s.clientWidth,height:s.clientHeight});a();let r=new ResizeObserver(a);return r.observe(s),()=>r.disconnect()},[]),[e,t]}function En({pet:e,reaction:t,assetUrl:n,backgroundSrc:s,paused:a=!1,caretaker:r=null,caretakerFlipped:o=!1,listenKey:l=null,handle:c,onMoveEgg:u}){let{t:p}=J(),[d,{width:g,height:w}]=Zi(),y=j(null),f=Ir(g,w),m=g/f,b=Ye(e),k=e.stage==="egg",E=s!==null,_=de(()=>{let X=d.current,ee=y.current;return!X||!ee?null:Math.round((ee.getBoundingClientRect().left-X.getBoundingClientRect().left)/f)},[f,d]),T=e.design?void 0:Qs[e.species],[z,x]=G({id:e.id,isEgg:k}),[S,N]=G(!1);(z.id!==e.id||z.isEgg!==k)&&(x({id:e.id,isEgg:k}),N(z.id===e.id&&!k&&!!T&&!a&&!Ne()));let L=S?null:t;Y(()=>{k&&T&&yn(n).catch(()=>{})},[k,T,n]);let D=r!==null,{actor:M,poke:A,listen:C,comeOver:P,celebrate:R,hatch:B}=Or({stageArtWidth:Pr(m,D),mood:b.mood,species:e.species,enabled:!k,busy:S||t!==null,paused:a,move:e.evolution.look?.move??null,measureX:_}),v=e.evolution.look?.colour??null,I=j(v);Y(()=>{v!==I.current&&(I.current=v,v&&R(at[v].moves[0]))},[v,R]),Ge(()=>{S&&T&&B(T.how,T.colour,T.moves,()=>N(!1))},[S,T,B]),Ea(c,()=>({comeOver:()=>P(D)}),[P,D]);let H=j(l);Y(()=>{l!==H.current&&(H.current=l,l&&C(D))},[l,C,D]);let $=X=>{let ee=d.current;ee&&A((X.clientX-ee.getBoundingClientRect().left)/f)},[q,W]=G({width:16,height:9}),[U,Z]=G(null),te=e.eggSpot?.backgroundId===(E?e.backgroundId:null)?e.eggSpot:null,se=k?U??te??(E?null:Yi):null,ie=Xi(g,w,q),ye=w/f,he=k&&u!==void 0&&g>0,Be=(X,ee)=>{let re=(52/2-ca)*f,we=Math.min(g-re,Math.max(re,X)),fe=Math.min(w,Math.max(Hr*f,ee));return{x:(we-ie.left)/ie.width,y:(fe-ie.top)/ie.height}},ve=X=>({px:ie.left+X.x*ie.width,py:ie.top+X.y*ie.height}),Se=j(void 0),ue=j(null);Y(()=>()=>{window.clearTimeout(Se.current),ue.current&&u?.(ue.current).catch(()=>{})},[]);let Qe=(X,ee)=>{Z(X),ue.current=X,window.clearTimeout(Se.current),Se.current=window.setTimeout(()=>{ue.current=null,u?.(X).catch(()=>{}).finally(()=>Z(re=>re===X?null:re))},ee)},Fe=j(null),Le=X=>{let ee=d.current?.getBoundingClientRect();return ee?{px:X.clientX-ee.left,py:X.clientY-ee.top}:null},Ee=he?{onPointerDown:X=>{let ee=Le(X);if(!ee||!se||X.button!==0)return;X.stopPropagation(),X.currentTarget.setPointerCapture(X.pointerId);let re=ve(se);Fe.current={pointer:X.pointerId,dx:ee.px-re.px,dy:ee.py-re.py,to:null}},onPointerMove:X=>{let ee=Fe.current,re=Le(X);if(!ee||ee.pointer!==X.pointerId||!re)return;let we=Be(re.px-ee.dx,re.py-ee.dy),fe=ve(se??we),be=ve(we);!ee.to&&Math.hypot(be.px-fe.px,be.py-fe.py)<4||(ee.to=we,Z(we))},onPointerUp:X=>{let ee=Fe.current;Fe.current=null,ee?.to&&Qe(ee.to,0),X.stopPropagation()},onPointerCancel:()=>{Fe.current=null,Z(null)},onKeyDown:X=>{let ee=(X.shiftKey?8:2)*f,[re,we]=X.key==="ArrowLeft"?[-ee,0]:X.key==="ArrowRight"?[ee,0]:X.key==="ArrowUp"?[0,-ee]:X.key==="ArrowDown"?[0,ee]:[0,0];if(!re&&!we||!se)return;X.preventDefault();let fe=ve(se);Qe(Be(fe.px+re,fe.py+we),500)}}:{},Ce=X=>{let ee=Le(X);!he||!ee||y.current?.contains(X.target)||Qe(Be(ee.px,ee.py),0)},Re=se?ve(se):null,Dt=Re?Math.min(m-52+ca,Math.max(-ca,Math.round(Re.px/f-52/2))):M.x,ht=Re?`${Math.min(ye-Hr-la,Math.max(-la,Math.round(ye-Re.py/f-la)))*f}px`:`${Ur}%`,zt={"--sl-px":`${f}px`,"--sl-x":Dt,"--sl-move-ms":`${Re?0:M.moveMs}ms`,"--sl-steps":M.steps,bottom:ht,width:`${52*f}px`,height:`${52*f}px`},et=kn(b.mood,L?.action??null,M.face),bt=Ar.includes(e.species)&&!e.design&&!k;return h("div",{ref:d,className:"sl-stage","data-paused":a?"true":void 0,onPointerDown:$,onClick:Ce,style:{"--sl-hover":ji,"--sl-px":`${f}px`},children:[i("img",{className:`sl-stage-bg ${E?"":"sl-stage-bg--pixel"}`,src:E?s:n(st(e)),alt:"",draggable:!1,onLoad:X=>{let{naturalWidth:ee,naturalHeight:re}=X.currentTarget;ee>0&&re>0&&W({width:ee,height:re})}}),r&&"figure"in r?i("div",{className:"sl-stage-figure","aria-hidden":"true","data-breathes":r.rows===2?"true":void 0,"data-flipped":o?"true":void 0,style:{backgroundImage:`url("${r.figure}")`,backgroundSize:`${r.frames*_e*f}px ${r.rows*_e*f}px`,backgroundPositionX:`${-r.frame*_e*f}px`,width:`${_e*f}px`,height:`${_e*f}px`,right:`${-Ji*f}px`,bottom:`calc(${Ur}% + ${2*f}px)`},children:r.blink?i("div",{className:"sl-stage-blink",style:{backgroundImage:`url("${r.blink}")`}}):null}):r?i("img",{className:"sl-stage-caretaker","data-flipped":o?"true":void 0,src:r.src,alt:"",draggable:!1}):null,i("div",{ref:y,className:"sl-stage-actor","data-facing":e.flipped===(M.facing==="left")?"right":"left","data-hover":bt?"true":void 0,"data-movable":he?"true":void 0,style:zt,...he?{tabIndex:0,role:"img","aria-label":p("saucelings.egg.moveLabel"),title:p("saucelings.egg.moveHint")}:{},...Ee,children:g>0?i(Ae,{art:e,species:e.species,stage:b.stage,mood:et,assetUrl:n,alt:k?p("saucelings.egg.name"):`${e.name} (${qe(e).name})`,scale:f,still:a,reaction:L,pose:M.pose,cue:M.cue,act:k?null:M.act,facing:M.facing,flipped:e.flipped}):null}),k?null:i("span",{className:"sl-sr-only",children:p("saucelings.stage.tapHint",{name:e.name})})]})}function Br({characters:e,defaultCaretakerId:t,submitLabel:n,pending:s,onSubmit:a,onCancel:r}){let{t:o}=J(),[l,c]=G(t),u=e.find(d=>d.id===l),p=ct(l,!!u);return h("div",{className:"sl-egg-form",style:{display:"flex",flexWrap:"wrap",gap:"0.6rem",justifyContent:"center",alignItems:"center",marginTop:"0.5rem"},children:[i(gt,{name:u?.name??o("saucelings.empty.houseCaretaker"),src:p}),i("select",{className:"sl-select",value:l,onChange:d=>c(d.target.value),"aria-label":o("saucelings.empty.pickCaretaker"),children:e.length===0?i("option",{value:"caretaker",children:o("saucelings.empty.houseCaretaker")}):e.map(d=>i("option",{value:d.id,children:d.name},d.id))}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:s,onClick:()=>a({characterId:l}),children:s?o("saucelings.empty.bringingEgg"):n}),r?i("button",{type:"button",className:"sl-btn",onClick:r,children:o("saucelings.common.cancel")}):null]})}function Gr({unlocks:e}){let{t}=J(),n=(s,a)=>e[s].done?t("saucelings.unlocks.done",{name:Yt[s].name}):a;return h("div",{className:"sl-unlocks",style:{fontSize:"0.8rem",opacity:.85,textAlign:"left",margin:"0 auto"},children:[i("div",{style:{fontWeight:600},children:t("saucelings.unlocks.title")}),h("ul",{style:{margin:"0.25rem 0 0",paddingLeft:"1.1rem",display:"grid",gap:"0.15rem"},children:[i("li",{children:n("prismite",t("saucelings.unlocks.prismite",{...e.prismite}))}),i("li",{children:n("thundrake",t("saucelings.unlocks.thundrake",{...e.thundrake}))}),i("li",{children:n("clockrit",t("saucelings.unlocks.clockrit",{...e.clockrit}))}),i("li",{children:e.halloween?t("saucelings.unlocks.halloweenNow"):t("saucelings.unlocks.halloween")})]})]})}function Ut({label:e,value:t,gapLabel:n}){return h("div",{className:`sl-meter-box ${n?"sl-meter-box--gap":""}`,title:n??void 0,children:[h("div",{className:"sl-meter-head",children:[i("span",{children:e}),h("span",{className:"sl-meter-value",children:[t,"%"]})]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})}),n?i("div",{className:"sl-meter-gap",children:n}):null]})}var Kr=null,el=4e3,tl=["hatch","stage-up","evolve-offer","evolve"],nl=48;function qr({state:e,packageId:t,packageVersion:n,askVoice:s}){let{t:a}=J(),r=ge(),o=e.world.activePet,l=e.characters,[c,u]=G(!1),[p,d]=G(!1),[g,w]=G(""),[y,f]=G(null),[m,b]=G("feedReliability"),[k,E]=wn(),_=j(null),[T,z]=ln(15e3),x=O=>Ke(t,O,n),S=o?.backgroundId??null,N=le({queryKey:["saucelings","background",S],queryFn:()=>V(`/background/${encodeURIComponent(S??"")}`),enabled:S!==null,staleTime:1/0}),L=S?N.data?.image??null:null,[D,M]=G(!1),A=o?.journal.find(O=>O.kind==="user-care"||O.kind==="nudge")??null,C=A?.id,P=A?.text,R=j(C),[B,v]=G({text:"",shown:!1});Y(()=>{if(!C||C===R.current)return;R.current=C,v({text:P??"",shown:!0});let O=window.setTimeout(()=>v(pe=>({...pe,shown:!1})),6e3);return()=>window.clearTimeout(O)},[C,P]);let[I,H]=ys(nl),$=dn(o?.caretakerId??"",l.some(O=>O.id===o?.caretakerId)),q=o?e.world.caretakerFigures[o.caretakerId]:void 0,W=ut(q),U=gn(q,W),Z=o?.journal.find(O=>Tn.includes(O.kind))??null,te=Z&&!e.writing.includes(Z.id)?Z:null,se=te?.kind==="caretaker-care"?ws(te.outcome):null,ie=se?te?.id??null:null,[ye,he]=It(cn);Y(()=>{!se||!ie||ie===Kr||(Kr=ie,(_.current?.comeOver()??Promise.resolve()).then(()=>{E(se),he(se)}))},[se,ie,E,he]);let[Be,ve]=It(el),Se=te&&tl.includes(te.kind)?te.id:null,ue=j(Se);Y(()=>{!Se||Se===ue.current||(ue.current=Se,ve(!0))},[Se,ve]);let[Qe,Fe]=G(!1),Le=bs(o);Y(()=>{if(Le===null)return;let O=window.setTimeout(()=>{r.invalidateQueries({queryKey:["saucelings","state"]})},Math.max(0,Le-Date.now())+1e3);return()=>window.clearTimeout(O)},[Le,r]);let Ee=O=>{f(null),r.setQueryData(["saucelings","state"],O)},Ce=O=>f(O instanceof Error?O.message:a("saucelings.error.request")),Re=ne({mutationFn:O=>V("/adopt","POST",O),onSuccess:O=>{u(!1),Ee(O)},onError:Ce}),Dt=ne({mutationFn:O=>V("/action","POST",{action:O}),onMutate:()=>({arrived:_.current?.comeOver()??Promise.resolve()}),onSuccess:(O,pe,tt)=>{Ee(O),z(),tt.arrived.then(()=>{E(pe),pe!=="talk"&&he(pe)})},onError:Ce}),ht=ne({mutationFn:()=>V("/check-in","POST",{}),onSuccess:Ee,onError:Ce}),zt=ne({mutationFn:O=>V("/nudge","POST",{tendency:O}),onSuccess:O=>{Ee(O),z()},onError:Ce}),et=ne({mutationFn:O=>V("/pet","PATCH",O),onSuccess:(O,pe)=>{d(!1),Ee(O),pe.caretakerId&&s(pe.caretakerId)},onError:Ce}),bt=ne({mutationFn:({characterId:O,name:pe})=>V("/voice","POST",{characterId:O}).catch(()=>{throw new Error(a("saucelings.voice.failed",{name:pe}))}),onSuccess:Ee,onError:Ce}),X=O=>s(O.characterId,pe=>{pe&&Re.mutate(O)}),ee=ne({mutationFn:()=>V("/retire","POST",{}),onSuccess:Ee,onError:Ce});if(!o)return h("div",{className:"sl-card",style:{display:"grid",gap:"1rem",textAlign:"center",padding:"2rem"},children:[i("div",{style:{display:"flex",justifyContent:"center"},children:i(mt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:x,alt:a("saucelings.empty.eggAlt"),scale:2})}),i("h2",{style:{fontSize:"1.125rem",fontWeight:600,margin:0},children:a("saucelings.empty.title")}),i("p",{style:{fontSize:"0.85rem",opacity:.8,maxWidth:"32rem",margin:"0 auto"},children:a("saucelings.empty.body")}),i(Br,{characters:l,defaultCaretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.empty.bringEgg"),pending:Re.isPending,onSubmit:X}),i(Gr,{unlocks:e.unlocks}),y?i("p",{style:{color:"#f87171",fontSize:"0.8rem",margin:0},children:y}):null]});let re=o.stage==="egg",we=qe(o),fe=Ue(o),be=fe?.sauce??null,yt=o.name===we.name,Pe=o.careProfile.characterName,Bt=l.some(O=>O.id===o.caretakerId),ga=Nt(o,T),Jr=be?{"--sl-sauce-accent":be.accentColor,"--sl-sauce-bg":be.badgeBg}:{},Gt=re?[{tendency:"feedReliability",label:a("saucelings.nudge.warm")},{tendency:"affection",label:a("saucelings.nudge.talk")}]:[{tendency:"feedReliability",label:a("saucelings.nudge.meals")},{tendency:"overfeeding",label:a("saucelings.nudge.portions")},{tendency:"playfulness",label:a("saucelings.nudge.play")},{tendency:"affection",label:a("saucelings.nudge.cuddles")}],da=Gt.some(O=>O.tendency===m)?m:Gt[0].tendency,pa=Gt.flatMap(O=>{let pe=o.nudges.find(ha=>ha.tendency===O.tendency&&Date.parse(ha.expiresAt)>T);if(!pe)return[];let tt=Math.ceil((Date.parse(pe.expiresAt)-T)/36e5);return[a("saucelings.nudge.left",{ask:O.label,hours:tt})]}),Zr=o.journal.filter(O=>Tn.includes(O.kind)),eo=pn({gaps:e.gaps,line:Z,speaking:Qe||Z!==null&&e.writing.includes(Z.id),cheering:Be!==null,caring:ye}),ma=mn(W,$,eo,U),fa=h(ce,{children:[i("div",{className:"sl-care-row",children:i("button",{type:"button",className:"sl-btn",disabled:ht.isPending,onClick:()=>ht.mutate(),children:ht.isPending?a("saucelings.checkIn.pending",{name:Pe}):`\u{1F4AC} ${a("saucelings.checkIn.button",{name:Pe})}`})}),h("div",{className:"sl-care-row sl-ask-row",children:[i("label",{htmlFor:"sl-nudge-pick",className:"sl-care-ask",children:a("saucelings.nudge.heading",{name:Pe})}),i("select",{id:"sl-nudge-pick",className:"sl-select sl-select--small",value:da,onChange:O=>b(O.target.value),children:Gt.map(O=>i("option",{value:O.tendency,children:O.label},O.tendency))}),i("button",{type:"button",className:"sl-btn sl-btn--small",disabled:zt.isPending,onClick:()=>zt.mutate(da),children:a("saucelings.nudge.ask")}),i("span",{className:"sl-care-note",children:pa.length>0?a("saucelings.nudge.active",{asks:pa.join(", ")}):a("saucelings.nudge.note")})]})]});return h("div",{ref:I,className:"sl-nook",style:Jr,children:[y?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:y}):null,o.retireReady?h("div",{className:"sl-card sl-retire",children:[i("span",{children:a("saucelings.retire.ready",{name:o.name})}),h("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:ee.isPending,onClick:()=>ee.mutate(),children:["\u{1F4D6} ",a("saucelings.retire.button")]})]}):null,h("div",{className:"sl-nook-main",children:[h("div",{className:"sl-card sl-stage-card",children:[h("div",{className:"sl-stage-bar",children:[p?h("div",{className:"sl-rename",children:[i("input",{className:"sl-input",style:{flex:"1 1 8rem",width:"100%"},value:g,maxLength:40,placeholder:a("saucelings.pet.namePlaceholder"),"aria-label":a("saucelings.pet.namePlaceholder"),onChange:O=>w(O.target.value)}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:!g.trim()||et.isPending,onClick:()=>et.mutate({name:g}),children:a("saucelings.common.save")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(!1),children:a("saucelings.common.cancel")})]}):h("div",{className:"sl-stage-title",children:[h("div",{className:"sl-stage-name",children:[i("h2",{style:{fontSize:"1.35rem",fontWeight:700,margin:0,overflowWrap:"anywhere"},children:re?a("saucelings.egg.name"):o.name}),re?null:i(Lt,{pet:o}),re?null:i("button",{type:"button",className:`sl-btn sl-btn--small ${yt?"sl-btn--primary":""}`,"aria-label":yt?void 0:a("saucelings.pet.rename"),title:yt?void 0:a("saucelings.pet.rename"),onClick:()=>{w(yt?"":o.name),d(!0)},children:yt?a("saucelings.pet.nameIt"):"\u270F\uFE0F"})]}),re?null:h("div",{className:"sl-stage-sub",title:be?`${be.origin} \u2014 ${be.readsAs}`:fe?.readsAs,children:[fe?`${be?a("saucelings.pet.sauce",{sauce:be.name}):a("saucelings.pet.temperament",{temperament:fe.name})} \xB7 `:null,we.name," \xB7"," ",o.lockedStage?a("saucelings.pet.locked",{stage:a(`saucelings.stage.${o.lockedStage}`)}):a(`saucelings.stage.${o.stage}`),!o.lockedStage&&o.stage!=="elder"&&o.meters.hunger<Oa?` \xB7 ${a("saucelings.pet.growthPaused")}`:null]})]}),h("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":D,"aria-label":a("saucelings.nook.background"),title:a("saucelings.nook.background"),onClick:()=>M(O=>!O),children:["\u{1F5BC}",h("span",{className:"sl-btn-label",children:[" ",a("saucelings.nook.background")]})]})]}),h("div",{className:"sl-scene",children:[i(En,{pet:o,reaction:k,assetUrl:x,backgroundSrc:L,caretaker:ma,caretakerFlipped:e.world.flippedCaretakers.includes(o.caretakerId),listenKey:te?.id??null,handle:_,onMoveEgg:O=>et.mutateAsync({eggSpot:O})}),i(Fr,{lines:Zr,fallbackLine:re?a("saucelings.caretaker.idleEgg"):a("saucelings.caretaker.idle",{name:o.name}),caretakerId:o.caretakerId,caretakerName:Pe,isCharacter:Bt,meals:e.gaps.meals,isEgg:re,writing:e.writing,standing:ma!==null||W===void 0,onTyping:Fe,children:H?fa:null})]})]}),h("div",{className:"sl-card sl-care-card",children:[h("div",{className:"sl-meters sl-meters--strip",children:[re?h(ce,{children:[i(Ut,{label:a("saucelings.meter.warmth"),value:At(o),gapLabel:e.gaps.warmth?a("saucelings.meter.warmthGap"):null}),i(Ut,{label:a("saucelings.meter.hatching"),value:ga,gapLabel:ga>=100&&o.careActionCount<1?a("saucelings.meter.hatchingGap"):null})]}):h(ce,{children:[i(Ut,{label:a("saucelings.meter.hunger"),value:o.meters.hunger,gapLabel:e.gaps.hunger?a("saucelings.meter.hungerGap"):null}),i(Ut,{label:a("saucelings.meter.mood"),value:o.meters.mood,gapLabel:e.gaps.mood?a("saucelings.meter.moodGap"):null})]}),i(Ut,{label:a("saucelings.meter.bond"),value:o.meters.bond})]}),i("div",{className:"sl-actions",children:rn(o).map(O=>{let pe=un(o,O,T),tt=on(O,e.gaps);return h("button",{type:"button",className:`sl-btn ${tt?"sl-btn--gap":""}`,disabled:Dt.isPending||pe>0,onClick:()=>Dt.mutate(O,{onSuccess:()=>{tt&&ve(!0)}}),children:[an[O]," ",a(sn[O]),pe>0?` \xB7 ${a("saucelings.action.wait",{minutes:pe})}`:""]},O)})}),i("p",{className:`sl-action-note ${B.shown?"sl-action-note--shown":""}`,"aria-live":"polite",children:B.text}),i(Sn,{state:e,assetUrl:x}),i(Lr,{state:e,assetUrl:x}),H?null:fa]})]}),D?i(Mr,{pet:o,settings:e.world.settings,assetUrl:x,onClose:()=>M(!1)}):null,h("details",{className:"sl-card sl-about",children:[i("summary",{children:re?a("saucelings.about.egg"):a("saucelings.about.summary",{name:o.name})}),h("div",{className:"sl-about-body",children:[re?i("p",{children:a("saucelings.egg.about")}):h(ce,{children:[h("p",{children:[we.look," \u2014 ",i("em",{children:o.quirk})]}),i("p",{children:be?a("saucelings.pet.sauceAbout",{sauce:be.name,readsAs:be.readsAs}):fe&&o.ownTemperament?a("saucelings.pet.temperamentAbout",{temperament:fe.name,readsAs:fe.readsAs,after:o.ownTemperament.takesAfter.name}):a("saucelings.pet.temperamentForming")}),o.evolution.look?i("p",{title:o.evolution.look.description,children:a("saucelings.evolve.into",{form:o.evolution.look.form})}):null,o.evolution.look?i("p",{children:a("saucelings.evolve.move",{move:a(`saucelings.evolve.moves.${o.evolution.look.move}`)})}):null,i("div",{className:"sl-traits",children:o.traits.map(O=>h("span",{className:"sl-trait",children:["#",O]},O))})]}),i("p",{children:a("saucelings.menagerie.foundBy",{name:o.finder.name})}),l.length>1?h("label",{className:"sl-about-row",children:[i("span",{children:a(re?"saucelings.pet.eggCaretaker":"saucelings.pet.caretaker")}),i("select",{className:"sl-select sl-select--small","aria-label":a("saucelings.empty.pickCaretaker"),value:o.caretakerId,onChange:O=>et.mutate({caretakerId:O.target.value}),children:l.map(O=>i("option",{value:O.id,children:O.name},O.id))})]}):null,Bt?i("div",{className:"sl-about-row",children:i(Ie,{text:a("saucelings.about.refreshVoiceNote"),label:a("saucelings.help.label",{action:a("saucelings.about.refreshVoice",{name:Pe})}),children:i("button",{type:"button",className:"sl-btn",disabled:bt.isPending,onClick:()=>bt.mutate({characterId:o.caretakerId,name:Pe}),children:bt.isPending?a("saucelings.about.refreshingVoice",{name:Pe}):`\u{1F504} ${a("saucelings.about.refreshVoice",{name:Pe})}`})})}):null,Bt?i(br,{state:e,characterId:o.caretakerId,name:Pe,sprites:$}):null,Bt?i(hr,{state:e,characterId:o.caretakerId,name:Pe}):null,i(pr,{state:e,assetUrl:x}),i(fr,{state:e}),i($r,{state:e}),i("div",{className:"sl-about-row",children:h("button",{type:"button",className:"sl-btn","aria-expanded":c,onClick:()=>u(O=>!O),children:["\u{1F95A} ",a("saucelings.swap.button")]})}),c?h("div",{style:{display:"grid",gap:"0.5rem",textAlign:"center"},children:[i("p",{style:{margin:0,fontSize:"0.85rem"},children:re?a("saucelings.swap.noteEgg"):a("saucelings.swap.note",{name:o.name})}),i(Br,{characters:l,defaultCaretakerId:l.some(O=>O.id===o.caretakerId)?o.caretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.swap.confirm"),pending:Re.isPending,onSubmit:O=>X({...O,swap:!0}),onCancel:()=>u(!1)}),i(Gr,{unlocks:e.unlocks})]}):null]})]})]})}var al=new Set(["image_generation","video_generation","audio","decision"]);function Vr({value:e,min:t,max:n,onSave:s}){let[a,r]=G(String(e));return Y(()=>r(String(e)),[e]),i("input",{type:"number",className:"sl-input",min:t,max:n,style:{width:"5rem"},value:a,onChange:l=>r(l.target.value),onBlur:()=>{let l=a.trim()===""?Number.NaN:Number(a);if(!Number.isFinite(l))return r(String(e));let c=Math.min(n,Math.max(t,Math.round(l)));r(String(c)),c!==e&&s(c)},onKeyDown:l=>{l.key==="Enter"&&l.currentTarget.blur()}})}function Wr({state:e}){let{t}=J(),n=ge(),s=e.world.settings,a=e.world.budget,[r,o]=G(!1),l=le({queryKey:["saucelings","connections"],queryFn:()=>ke("/api/connections")}),c=(l.data??[]).filter(g=>!al.has(g.provider)),u=l.data?.filter(g=>g.provider==="image_generation"),p=ne({mutationFn:g=>V("/settings","PATCH",g),onSuccess:g=>n.setQueryData(["saucelings","state"],g)}),d=ne({mutationFn:()=>V("/reset","POST",{}),onSuccess:g=>{o(!1),n.setQueryData(["saucelings","state"],g)}});return h("div",{className:"sl-card",style:{display:"grid",gap:"1.15rem"},children:[h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.careWindow")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.careWindowNote")})]}),i(Vr,{value:s.careWindowHours,min:1,max:24,onSave:g=>p.mutate({careWindowHours:g})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.dailyBudget")}),h("div",{style:{fontSize:"0.75rem",opacity:.7},children:[t("saucelings.settings.budgetUsed",{used:a.used,limit:s.dailyGenerationBudget})," ","\u2014 ",t("saucelings.settings.budgetNote")]})]}),i(Vr,{value:s.dailyGenerationBudget,min:0,max:30,onSave:g=>p.mutate({dailyGenerationBudget:g})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.connection")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.connectionNote")})]}),h("select",{className:"sl-input",value:s.connectionId??"",onChange:g=>p.mutate({connectionId:g.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.connectionDefault")}),c.map(g=>i("option",{value:g.id,children:g.name},g.id)),s.connectionId&&l.data&&!c.some(g=>g.id===s.connectionId)?i("option",{value:s.connectionId,children:t("saucelings.settings.connectionMissing")}):null]})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.writeEveryLine")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.writeEveryLineNote")})]}),i("input",{type:"checkbox",checked:s.writeEveryLine,onChange:g=>p.mutate({writeEveryLine:g.target.checked})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.images")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imagesNote")})]}),i("input",{type:"checkbox",checked:s.portraitEnabled,onChange:g=>p.mutate({portraitEnabled:g.target.checked})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.eggHunting")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.eggHuntingNote")})]}),i("input",{type:"checkbox",checked:s.eggHunting,onChange:g=>p.mutate({eggHunting:g.target.checked})})]}),s.portraitEnabled?h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.imageConnection")}),u&&u.length===0?i("span",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imageConnectionEmpty")}):h("select",{className:"sl-input",value:s.portraitConnectionId??"",onChange:g=>p.mutate({portraitConnectionId:g.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.imageConnectionPick")}),(u??[]).map(g=>i("option",{value:g.id,children:g.name},g.id))]})]}):null,s.portraitEnabled?h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.threeDrawingFallback")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.threeDrawingFallbackNote")})]}),i("input",{type:"checkbox",checked:s.threeDrawingFallback,onChange:g=>p.mutate({threeDrawingFallback:g.target.checked})})]}):null,p.error??d.error?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:(p.error??d.error)?.message}):null,h("div",{style:{borderTop:"1px solid var(--border, rgba(255,255,255,0.1))",paddingTop:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"},children:[i("span",{style:{fontSize:"0.8rem",opacity:.75},children:t("saucelings.settings.resetNote")}),r?h("div",{style:{display:"flex",gap:"0.5rem"},children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:d.isPending,onClick:()=>d.mutate(),children:t("saucelings.settings.resetConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>o(!1),children:t("saucelings.common.cancel")})]}):i("button",{type:"button",className:"sl-btn",onClick:()=>o(!0),children:t("saucelings.settings.reset")})]})]})}function Ht({label:e,value:t,gap:n}){return h("div",{children:[h("span",{children:[e," ",t,"%"]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})})]})}var sl={warmth:"\u{1F525}",hatching:"\u{1F95A}",hunger:"\u{1F35D}",mood:"\u{1F60A}",bond:"\u{1F49B}"};function rl({icon:e,label:t,value:n,gap:s}){return h("div",{className:"sl-widget-bar-row",role:"meter","aria-label":t,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":n,title:`${t} ${n}%`,children:[i("span",{className:"sl-widget-bar-icon","aria-hidden":"true",children:e}),i("div",{className:"sl-widget-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})})]})}function Qr({active:e,compact:t,packageId:n,packageVersion:s,onOpenNoodle:a}){let{t:r}=J(),o=ge(),[l,c]=wn(),u=j(null),[p,d]=It(cn),[g,w]=ln(3e4),y=U=>Ke(n,U,s),f=le({queryKey:["saucelings","state"],queryFn:()=>V("/state"),enabled:e,staleTime:1e4,refetchOnMount:"always",refetchInterval:U=>e?U.state.data?.writing.length?2e3:3e4:!1,refetchIntervalInBackground:!1}),m=ne({mutationFn:U=>V("/action","POST",{action:U}),onMutate:()=>({arrived:u.current?.comeOver()??Promise.resolve()}),onSuccess:(U,Z,te)=>{o.setQueryData(["saucelings","state"],U),w(),te.arrived.then(()=>{c(Z),Z!=="talk"&&d(Z)})}}),b=f.data,k=b?.world.activePet,E=!!(k&&b?.characters.some(U=>U.id===k.caretakerId)),_=ct(k?.caretakerId??"",E),T=dn(k?.caretakerId??"",E&&!t),z=k&&!t?b?.world.caretakerFigures[k.caretakerId]:void 0,x=ut(z),S=gn(z,x),N=k?.backgroundId??null,L=le({queryKey:["saucelings","background",N],queryFn:()=>V(`/background/${encodeURIComponent(N??"")}`),enabled:e&&!t&&N!==null,staleTime:1/0}),D=N?L.data?.image??null:null;if(!b)return h("div",{className:"sl-widget",style:{display:"grid",gap:"0.5rem",fontSize:"0.8rem"},children:[i("span",{style:{opacity:.75},children:f.isError?r("saucelings.error.load"):r("saucelings.loading")}),f.isError?i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{f.refetch()},children:r("saucelings.error.retry")})}):null]});if(!k)return i("div",{className:"sl-widget",role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:U=>{(U.key==="Enter"||U.key===" ")&&a?.()},children:h("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(mt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:y,alt:r("saucelings.empty.eggAlt"),scale:1,still:!e}),h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.85rem"},children:r("saucelings.empty.title")}),i("div",{style:{fontSize:"0.72rem",opacity:.75},children:r("saucelings.widget.emptyHint")})]})]})});let M=k.stage==="egg",A=qe(k),C=Ue(k),P=C?.sauce??null,R=Ye(k),B=P?{"--sl-sauce-accent":P.accentColor,"--sl-sauce-bg":P.badgeBg}:{},v=h("div",{style:{minWidth:0,flex:1},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"0.875rem"},children:M?r("saucelings.egg.name"):k.name}),M||!C?null:i("span",{className:"sl-badge",style:{fontSize:"0.65rem",padding:"0.1rem 0.45rem"},title:C.readsAs,children:P?r("saucelings.pet.sauce",{sauce:P.name}):r("saucelings.pet.temperament",{temperament:C.name})})]}),h("div",{style:{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",marginTop:"0.15rem"},children:[i(gt,{name:k.careProfile.characterName,src:_,small:!0}),i("span",{style:{opacity:.75,minWidth:0},children:M?`${r("saucelings.pet.eggCaretaker")} ${k.careProfile.characterName}`:`${A.name} \xB7 ${r("saucelings.pet.caretaker")} ${k.careProfile.characterName}`})]})]}),I=h("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"0.4rem",fontSize:"0.68rem"},children:[M?h(ce,{children:[i(Ht,{label:r("saucelings.meter.warmth"),value:At(k),gap:b?.gaps.warmth}),i(Ht,{label:r("saucelings.meter.hatching"),value:Nt(k,g)})]}):h(ce,{children:[i(Ht,{label:r("saucelings.meter.hunger"),value:k.meters.hunger,gap:b?.gaps.hunger}),i(Ht,{label:r("saucelings.meter.mood"),value:k.meters.mood,gap:b?.gaps.mood})]}),i(Ht,{label:r("saucelings.meter.bond"),value:k.meters.bond})]}),H=i("p",{style:{margin:0,fontSize:"0.75rem",opacity:.85,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:t?1:2,WebkitBoxOrient:"vertical"},children:b?.latestRemark}),$=U=>{(U.key==="Enter"||U.key===" ")&&a?.()};if(t)return h("div",{className:"sl-widget",style:B,role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:$,children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(Ae,{art:k,species:k.species,stage:R.stage,mood:kn(R.mood,l?.action??null,null),assetUrl:y,alt:M?r("saucelings.egg.name"):k.name,scale:1,still:!e,reaction:l}),v]}),I,H]});let q=b?mn(x,T,pn({gaps:b.gaps,line:null,speaking:!1,cheering:!1,caring:p}),S):null,W=M?[{key:"warmth",label:r("saucelings.meter.warmth"),value:At(k),gap:b?.gaps.warmth},{key:"hatching",label:r("saucelings.meter.hatching"),value:Nt(k,g),gap:!1}]:[{key:"hunger",label:r("saucelings.meter.hunger"),value:k.meters.hunger,gap:b?.gaps.hunger},{key:"mood",label:r("saucelings.meter.mood"),value:k.meters.mood,gap:b?.gaps.mood}];return W.push({key:"bond",label:r("saucelings.meter.bond"),value:k.meters.bond,gap:!1}),i("div",{className:"sl-widget sl-widget--stage",style:B,role:"button",tabIndex:0,"aria-label":M?r("saucelings.egg.name"):k.name,onClick:()=>a?.(),onKeyDown:$,children:h("div",{className:"sl-widget-body",children:[i("div",{className:"sl-widget-stage",onClick:U=>{M||U.stopPropagation()},children:i(En,{pet:k,reaction:l,assetUrl:y,backgroundSrc:D,paused:!e,caretaker:q,caretakerFlipped:b?.world.flippedCaretakers.includes(k.caretakerId),handle:u})}),h("div",{className:"sl-widget-hud",children:[i("div",{className:"sl-widget-bars",children:W.map(U=>i(rl,{icon:sl[U.key],label:U.label,value:U.value,gap:U.gap},U.key))}),h("div",{className:"sl-widget-acts",onClick:U=>U.stopPropagation(),onKeyDown:U=>U.stopPropagation(),children:[rn(k).slice(0,2).map(U=>{let Z=un(k,U,g),te=r(sn[U]),se=Z>0?`${te} \xB7 ${r("saucelings.action.wait",{minutes:Z})}`:te;return i("button",{type:"button",className:`sl-btn sl-widget-act ${b&&on(U,b.gaps)?"sl-btn--gap":""}`,"aria-label":se,title:se,disabled:m.isPending||Z>0,onClick:()=>m.mutate(U),children:i("span",{"aria-hidden":"true",children:an[U]})},U)}),m.error?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:m.error.message}):null]})]})]})})}var jr=`
.sl-shell {
  --sl-accent: #e05246;
  --sl-amber: #f59e0b;
  --sl-green: #10b981;
  color: var(--foreground, #f4f4f5);
  background: var(--background, #09090b);
  font: inherit;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container: sl-shell / inline-size;
}

.sl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
  background: var(--card, rgba(24,24,27,0.7));
  flex-shrink: 0;
}

.sl-nav {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.sl-tab-btn {
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground, #a1a1aa);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

@media (hover: hover) {
  .sl-tab-btn:hover {
    color: var(--foreground, #f4f4f5);
    background: var(--secondary, rgba(255,255,255,0.06));
  }
}

.sl-tab-btn--active {
  color: var(--foreground, #f4f4f5);
  background: var(--secondary, rgba(255,255,255,0.1));
  border-color: var(--border, rgba(255,255,255,0.16));
}

.sl-body {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem;
}

/* One column that never grows past the page: a long option in a select would otherwise widen it, and a phone then
   zooms the whole page out to fit. */
.sl-container {
  max-width: 56rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.sl-card {
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  border-radius: 0.875rem;
  background: var(--card, rgba(24,24,27,0.65));
  padding: 1rem 1.25rem;
}

.sl-nook {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.sl-sprite-stage {
  position: relative;
  width: 8.5rem;
  height: 8.5rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 60%, var(--sl-sauce-bg, rgba(224,82,70,0.18)), transparent 75%);
  border: 2px solid var(--sl-sauce-accent, #e05246);
  overflow: hidden;
}

/* Sprites are 52 px pixel art shipped at 2x as strips of three frames: base | squash | stretch, or an
   egg's base | lean left | lean right. Show them at 52 or 104 px so every art pixel stays square.
   --sl-px is one art pixel (set inline, in whole screen pixels); every move is whole art pixels in 100 ms
   steps, so nothing shimmers. */
.sl-sprite {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.sl-sprite-frames, .sl-fx {
  position: absolute;
  background-repeat: no-repeat;
  background-position-x: 0%;
  image-rendering: pixelated;
}

/* The keyframes switch frames by x only: a species sheet's row is set inline as background-position-y. */
.sl-sprite-frames { inset: 0; background-size: 300% 100%; }

.sl-idle-content { animation: sl-idle-content 2.4s steps(1, end) infinite; }
.sl-idle-happy { animation: sl-idle-happy 2.4s steps(1, end) infinite; }
.sl-idle-grumpy { animation: sl-idle-grumpy 2.4s steps(1, end) infinite; }
.sl-idle-egg { animation: sl-idle-egg 4.8s steps(1, end) infinite; }
.sl-react-feed { animation: sl-react-feed 1.2s steps(1, end) both; }
.sl-react-play { animation: sl-react-play 1.2s steps(1, end) both; }
.sl-react-rest { animation: sl-react-rest 1.2s steps(1, end) both; }
.sl-react-pet { animation: sl-react-pet 1.2s steps(1, end) both; }
.sl-react-egg { animation: sl-react-egg 1.2s steps(1, end) both; }

/* Slow breath. */
@keyframes sl-idle-content {
  0% { background-position-x: 0%; }
  58.333%, 100% { background-position-x: 50%; }
}

/* Bounces on the spot twice, never leaving the floor, then rests: the stage's director does the hopping. */
@keyframes sl-idle-happy {
  0%, 25%, 50%, 100% { background-position-x: 0%; transform: none; }
  8.333%, 33.333% { background-position-x: 100%; transform: translateY(calc(-1 * var(--sl-px))); }
  16.667%, 41.667% { background-position-x: 50%; transform: none; }
}

/* Stands still, then huffs and stomps. */
@keyframes sl-idle-grumpy {
  0%, 66.667%, 75%, 87.5%, 100% { background-position-x: 0%; transform: none; }
  62.5% { background-position-x: 50%; transform: translateX(calc(-1 * var(--sl-px))); }
  70.833% { background-position-x: 50%; transform: translateX(var(--sl-px)); }
  79.167% { background-position-x: 50%; transform: none; }
}

/* Sits, then rocks on its base. */
@keyframes sl-idle-egg {
  0%, 79.167%, 100% { background-position-x: 0%; }
  62.5%, 70.833% { background-position-x: 50%; }
  66.667%, 75% { background-position-x: 100%; }
}

/* Three chomps. */
@keyframes sl-react-feed {
  0%, 33.333%, 58.333%, 83.333%, 100% { background-position-x: 0%; }
  25%, 50%, 75% { background-position-x: 50%; }
}

@keyframes sl-react-play {
  0%, 41.667%, 91.667% { background-position-x: 50%; transform: none; }
  8.333%, 33.333%, 58.333%, 83.333% { background-position-x: 100%; transform: translateY(calc(-2 * var(--sl-px))); }
  16.667%, 66.667% { background-position-x: 0%; transform: translateY(calc(-4 * var(--sl-px))); }
  100% { background-position-x: 0%; transform: none; }
}

/* Settles down. */
@keyframes sl-react-rest {
  0%, 100% { background-position-x: 50%; }
}

/* Snuggles down, then sits up. */
@keyframes sl-react-pet {
  0% { background-position-x: 50%; }
  50%, 100% { background-position-x: 0%; }
}

@keyframes sl-react-egg {
  0%, 33.333% { background-position-x: 50%; }
  16.667%, 50% { background-position-x: 100%; }
  66.667%, 100% { background-position-x: 0%; }
}

/* A painted form is one frame, not a strip. The !important beats the keyframes' frame switches (important
   author declarations override animations), so the picture never slides, while their transforms still move it. */
.sl-sprite-frames--single { background-size: 100% 100%; background-position: 0 0 !important; }

/* A found sauceling's form that is not painted yet: a dark shape standing on the floor band, sized in art
   pixels by --sl-sil-w and --sl-sil-h. translate (not transform) so the keyframe transforms still compose. */
.sl-sprite-frames--silhouette {
  position: absolute;
  inset: auto;
  width: calc(var(--sl-sil-w) * var(--sl-px));
  height: calc(var(--sl-sil-h) * var(--sl-px));
  left: 50%;
  bottom: calc(2 * var(--sl-px));
  translate: -50% 0;
  border-radius: 50% 50% 46% 46% / 58% 58% 42% 42%;
  background: rgb(24 20 28 / 0.72);
  box-shadow: inset 0 0 0 var(--sl-px) rgb(255 255 255 / 0.18);
}

/* The idle of a painted form or silhouette: a slow breath, one art pixel up for a stretch. */
.sl-idle-custom { animation: sl-idle-custom 2.4s steps(1, end) infinite; }
@keyframes sl-idle-custom {
  0%, 50%, 100% { transform: none; }
  58.333%, 91.667% { transform: translateY(calc(-1 * var(--sl-px))); }
}

/* Reaction effects, placed from the stage anchors --sl-t (head top), --sl-l and --sl-r (sides) and
   --sl-m (mouth height), all in art pixels. */
.sl-fx { opacity: 0; }
.sl-fx-tomato { width: calc(9 * var(--sl-px)); height: calc(8 * var(--sl-px)); background-size: 300% 100%; }
.sl-fx-heart { width: calc(9 * var(--sl-px)); height: calc(8 * var(--sl-px)); background-size: 100% 100%; }
.sl-fx-sparkle { width: calc(7 * var(--sl-px)); height: calc(7 * var(--sl-px)); background-size: 200% 100%; }
.sl-fx-z { width: calc(8 * var(--sl-px)); height: calc(7 * var(--sl-px)); background-size: 200% 100%; }

/* A tomato beside the mouth, eaten in three bites. */
.sl-fx-feed {
  left: calc((var(--sl-r) - 3) * var(--sl-px));
  top: calc(var(--sl-m) * var(--sl-px));
  animation: sl-fx-feed 1.2s steps(1, end) both;
}
@keyframes sl-fx-feed {
  0% { opacity: 1; background-position-x: 0%; }
  33.333% { background-position-x: 50%; }
  58.333% { background-position-x: 100%; }
  83.333%, 100% { opacity: 0; }
}

/* Sparkles either side of the head, at the top of each hop. */
.sl-fx-play-a { animation: sl-fx-play-a 1.2s steps(1, end) both; }
@keyframes sl-fx-play-a {
  0% {
    opacity: 0;
    left: calc((var(--sl-l) - 3) * var(--sl-px));
    top: calc((var(--sl-t) + 2) * var(--sl-px));
    background-position-x: 0%;
  }
  8.333% { opacity: 1; }
  33.333% { opacity: 0; }
  58.333% {
    opacity: 1;
    left: calc((var(--sl-l) - 2) * var(--sl-px));
    top: calc((var(--sl-t) - 2) * var(--sl-px));
    background-position-x: 100%;
  }
  83.333%, 100% { opacity: 0; }
}
.sl-fx-play-b { animation: sl-fx-play-b 1.2s steps(1, end) both; }
@keyframes sl-fx-play-b {
  0% {
    opacity: 0;
    left: calc(var(--sl-r) * var(--sl-px));
    top: calc(var(--sl-t) * var(--sl-px));
    background-position-x: 100%;
  }
  16.667% { opacity: 1; }
  41.667% { opacity: 0; }
  66.667% {
    opacity: 1;
    left: calc((var(--sl-r) - 1) * var(--sl-px));
    top: calc((var(--sl-t) + 3) * var(--sl-px));
    background-position-x: 0%;
  }
  91.667%, 100% { opacity: 0; }
}

/* A small z, then a big Z, drifting up. */
.sl-fx-rest-a { left: calc((var(--sl-r) - 4) * var(--sl-px)); animation: sl-fx-rest-a 1.2s steps(1, end) both; }
@keyframes sl-fx-rest-a {
  0% { opacity: 1; top: calc((var(--sl-t) + 1) * var(--sl-px)); }
  25% { top: calc(var(--sl-t) * var(--sl-px)); }
  50% { top: calc((var(--sl-t) - 1) * var(--sl-px)); }
  75%, 100% { opacity: 0; }
}
.sl-fx-rest-b {
  left: calc((var(--sl-r) - 1) * var(--sl-px));
  background-position-x: 100%;
  animation: sl-fx-rest-b 1.2s steps(1, end) both;
}
@keyframes sl-fx-rest-b {
  0% { opacity: 0; top: calc((var(--sl-t) - 5) * var(--sl-px)); }
  50% { opacity: 1; }
  75% { top: calc((var(--sl-t) - 6) * var(--sl-px)); }
  100% { opacity: 0; }
}

/* A heart floating up from the head. */
.sl-fx-pet { left: calc((var(--sl-r) - 6) * var(--sl-px)); animation: sl-fx-pet 1.2s steps(1, end) both; }
@keyframes sl-fx-pet {
  0% { opacity: 1; top: calc((var(--sl-t) - 4) * var(--sl-px)); }
  16.667% { top: calc((var(--sl-t) - 5) * var(--sl-px)); }
  33.333% { top: calc((var(--sl-t) - 6) * var(--sl-px)); }
  50% { top: calc((var(--sl-t) - 7) * var(--sl-px)); }
  66.667% { top: calc((var(--sl-t) - 8) * var(--sl-px)); }
  75%, 100% { opacity: 0; }
}

/* On the Nook's stage the sprite also walks, hops, naps and huffs between care taps (see the stage director).
   Each pose is whole art pixels in --sl-px steps, like the idles. */
.sl-pose-walk { animation: sl-pose-walk 0.4s steps(1, end) infinite; }
.sl-pose-hop { animation: sl-pose-hop 0.7s steps(1, end) both; }
.sl-pose-huff { animation: sl-pose-huff 1.3s steps(1, end) both; }
.sl-pose-nap { background-position-x: 50%; }

/* A waddle: the base frame lifted a pixel, then the squashed one. */
@keyframes sl-pose-walk {
  0% { background-position-x: 0%; transform: translateY(calc(-1 * var(--sl-px))); }
  50%, 100% { background-position-x: 50%; transform: none; }
}

/* Walking in side view: a step up on the base frame, down on the squashed one, then a stretch. */
.sl-pose-walk-side { animation: sl-pose-walk-side 0.6s steps(1, end) infinite; }
@keyframes sl-pose-walk-side {
  0% { background-position-x: 0%; transform: translateY(calc(-1 * var(--sl-px))); }
  33.333% { background-position-x: 50%; transform: none; }
  66.667%, 100% { background-position-x: 100%; transform: none; }
}

/* The view not showing (front while walking, side otherwise) stays loaded but hidden. */
.sl-sprite-frames--hidden { visibility: hidden; animation: none; }

/* A living sheet: copies of the species sheet stacked top to bottom, one part changed in each. It takes the strip's
   frame (x) from its parent and steps through the copies (y); the copy times are set inline. */
.sl-live {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-position-x: inherit;
  background-position-y: var(--sl-live-y0);
  image-rendering: pixelated;
}
.sl-live--on { animation-name: sl-live; animation-iteration-count: infinite; }
.sl-sprite-frames--hidden > .sl-live { animation: none; }
@keyframes sl-live {
  from { background-position-y: var(--sl-live-y0); }
  to { background-position-y: var(--sl-live-y1); }
}

/* One hop. */
@keyframes sl-pose-hop {
  0%, 85.714%, 100% { background-position-x: 50%; transform: none; }
  14.286% { background-position-x: 100%; transform: translateY(calc(-2 * var(--sl-px))); }
  28.571% { background-position-x: 0%; transform: translateY(calc(-4 * var(--sl-px))); }
  57.143% { background-position-x: 100%; transform: translateY(calc(-2 * var(--sl-px))); }
}

/* Two stomps. */
@keyframes sl-pose-huff {
  0%, 15.385%, 46.154%, 100% { background-position-x: 0%; transform: none; }
  7.692% { background-position-x: 50%; transform: translateX(calc(-1 * var(--sl-px))); }
  23.077% { background-position-x: 50%; transform: translateX(var(--sl-px)); }
  30.769% { background-position-x: 50%; transform: none; }
  38.462% { background-position-x: 50%; transform: translateX(calc(-1 * var(--sl-px))); }
}

/* Stage cues, placed from the same anchors as the care effects. */
.sl-fx-note { width: calc(9 * var(--sl-px)); height: calc(9 * var(--sl-px)); background-size: 200% 100%; }
.sl-fx-question { width: calc(8 * var(--sl-px)); height: calc(10 * var(--sl-px)); background-size: 100% 100%; }
.sl-fx-bang { width: calc(6 * var(--sl-px)); height: calc(10 * var(--sl-px)); background-size: 100% 100%; }

.sl-fx-cue-note {
  left: calc((var(--sl-r) - 3) * var(--sl-px));
  animation: sl-fx-cue-note 2.2s steps(1, end) both;
}
@keyframes sl-fx-cue-note {
  0% { opacity: 1; top: calc((var(--sl-t) - 8) * var(--sl-px)); background-position-x: 0%; }
  22.727% { top: calc((var(--sl-t) - 9) * var(--sl-px)); background-position-x: 100%; }
  45.455% { top: calc((var(--sl-t) - 10) * var(--sl-px)); background-position-x: 0%; }
  68.182% { top: calc((var(--sl-t) - 11) * var(--sl-px)); background-position-x: 100%; }
  90.909%, 100% { opacity: 0; }
}
.sl-fx-cue-question {
  left: calc((var(--sl-r) - 5) * var(--sl-px));
  top: calc((var(--sl-t) - 9) * var(--sl-px));
  animation: sl-fx-cue-still 1.4s steps(1, end) both;
}
.sl-fx-cue-bang {
  left: calc(((var(--sl-l) + var(--sl-r)) / 2 - 3) * var(--sl-px));
  top: calc((var(--sl-t) - 10) * var(--sl-px));
  animation: sl-fx-cue-still 0.7s steps(1, end) both;
}
@keyframes sl-fx-cue-still {
  0% { opacity: 1; }
  85%, 100% { opacity: 0; }
}

/* A sleeping creature: the z's keep drifting up for as long as it naps. */
.sl-fx-nap-a { left: calc((var(--sl-r) - 4) * var(--sl-px)); animation: sl-fx-rest-a 2.4s steps(1, end) infinite; }
.sl-fx-nap-b {
  left: calc((var(--sl-r) - 1) * var(--sl-px));
  background-position-x: 100%;
  animation: sl-fx-rest-b 2.4s steps(1, end) infinite;
}

/* An evolution's look, over whichever picture it has: --sl-evo-ramp recolours it along its path's colour ramp (an
   SVG filter, see SaucelingRamps), keeping its shading, and --sl-evo-c is the colour of its glow. The grey aura and
   extra strips take the ramp too; Storm's are sparks of yellow on its slate body. */
.sl-evo--ember { --sl-evo-ramp: url(#sl-ramp-ember); --sl-evo-c: #ff7a3d; }
.sl-evo--frost { --sl-evo-ramp: url(#sl-ramp-frost); --sl-evo-c: #8fd8ff; }
.sl-evo--moss { --sl-evo-ramp: url(#sl-ramp-moss); --sl-evo-c: #7fd35a; }
.sl-evo--dusk { --sl-evo-ramp: url(#sl-ramp-dusk); --sl-evo-c: #b58cff; }
.sl-evo--gilded { --sl-evo-ramp: url(#sl-ramp-gilded); --sl-evo-c: #ffd84a; }
.sl-evo--shade { --sl-evo-ramp: url(#sl-ramp-shade); --sl-evo-c: #a99cc8; }
.sl-evo--bloom { --sl-evo-ramp: url(#sl-ramp-bloom); --sl-evo-c: #ff9fcb; }
.sl-evo--storm { --sl-evo-ramp: url(#sl-ramp-storm); --sl-evo-c: #f5ec5a; }
.sl-evo--tide { --sl-evo-ramp: url(#sl-ramp-tide); --sl-evo-c: #5fe0d0; }
.sl-evo--storm > :is(.sl-evo-aura, .sl-evo-extra) { --sl-evo-ramp: url(#sl-ramp-spark); }
.sl-evo > :is(.sl-evo-aura, .sl-evo-extra) { filter: var(--sl-evo-ramp); }
/* Glow: four one-pixel shadows make a one-pixel outline, corners too. */
.sl-evo > .sl-sprite-frames {
  filter: var(--sl-evo-ramp) drop-shadow(var(--sl-px) 0 0 var(--sl-evo-c))
    drop-shadow(calc(-1 * var(--sl-px)) 0 0 var(--sl-evo-c)) drop-shadow(0 var(--sl-px) 0 var(--sl-evo-c))
    drop-shadow(0 calc(-1 * var(--sl-px)) 0 var(--sl-evo-c));
}
/* The glow breathes: a copy of the frames behind them, ringed twice more, a beat every 600 ms (none, faint, bright,
   faint). */
.sl-evo-ring {
  position: absolute;
  inset: 0;
  filter: drop-shadow(var(--sl-px) 0 0 var(--sl-evo-c)) drop-shadow(calc(-1 * var(--sl-px)) 0 0 var(--sl-evo-c))
    drop-shadow(0 var(--sl-px) 0 var(--sl-evo-c)) drop-shadow(0 calc(-1 * var(--sl-px)) 0 var(--sl-evo-c))
    drop-shadow(var(--sl-px) 0 0 var(--sl-evo-c)) drop-shadow(calc(-1 * var(--sl-px)) 0 0 var(--sl-evo-c))
    drop-shadow(0 var(--sl-px) 0 var(--sl-evo-c)) drop-shadow(0 calc(-1 * var(--sl-px)) 0 var(--sl-evo-c));
  animation: sl-evo-breathe 2.4s steps(1, end) infinite;
}
@keyframes sl-evo-breathe {
  0% { opacity: 0; }
  25% { opacity: 0.35; }
  50% { opacity: 0.8; }
  75% { opacity: 0.35; }
}

/* The aura: three particles that rise from the body, fall past it, or twinkle around it, a step every 300 ms. */
.sl-evo-aura {
  position: absolute;
  width: calc(7 * var(--sl-px));
  height: calc(7 * var(--sl-px));
  background-repeat: no-repeat;
  image-rendering: pixelated;
  animation: 2.4s steps(1, end) infinite;
}
.sl-evo-aura-b { animation-delay: -0.8s; }
.sl-evo-aura-c { animation-delay: -1.6s; }
.sl-evo-aura--rise { animation-name: sl-aura-rise; }
.sl-evo-aura--rise.sl-evo-aura-a { left: calc((var(--sl-l) - 4) * var(--sl-px)); top: calc((var(--sl-m) + 12) * var(--sl-px)); }
.sl-evo-aura--rise.sl-evo-aura-b { left: calc((var(--sl-r) - 1) * var(--sl-px)); top: calc((var(--sl-m) + 8) * var(--sl-px)); }
.sl-evo-aura--rise.sl-evo-aura-c { left: calc((var(--sl-r) - 6) * var(--sl-px)); top: calc((var(--sl-m) + 18) * var(--sl-px)); }
@keyframes sl-aura-rise {
  0% { opacity: 1; background-position-x: 0%; transform: none; }
  12.5% { transform: translate(var(--sl-px), calc(-2 * var(--sl-px))); }
  25% { transform: translate(0, calc(-4 * var(--sl-px))); }
  37.5% { background-position-x: 50%; transform: translate(calc(-1 * var(--sl-px)), calc(-6 * var(--sl-px))); }
  50% { transform: translate(0, calc(-8 * var(--sl-px))); }
  62.5% { transform: translate(var(--sl-px), calc(-10 * var(--sl-px))); }
  75% { background-position-x: 100%; transform: translate(0, calc(-12 * var(--sl-px))); }
  87.5% { transform: translate(calc(-1 * var(--sl-px)), calc(-14 * var(--sl-px))); }
  100% { opacity: 0; }
}
.sl-evo-aura--fall { animation-name: sl-aura-fall; }
.sl-evo-aura--fall.sl-evo-aura-a { left: calc((var(--sl-l) - 3) * var(--sl-px)); top: calc((var(--sl-t) - 2) * var(--sl-px)); }
.sl-evo-aura--fall.sl-evo-aura-b { left: calc((var(--sl-r) - 2) * var(--sl-px)); top: calc((var(--sl-t) + 2) * var(--sl-px)); }
.sl-evo-aura--fall.sl-evo-aura-c { left: calc((var(--sl-r) + 1) * var(--sl-px)); top: calc((var(--sl-m) + 2) * var(--sl-px)); }
@keyframes sl-aura-fall {
  0% { opacity: 1; background-position-x: 0%; transform: none; }
  12.5% { background-position-x: 50%; transform: translate(var(--sl-px), calc(2 * var(--sl-px))); }
  25% { background-position-x: 100%; transform: translate(calc(2 * var(--sl-px)), calc(4 * var(--sl-px))); }
  37.5% { background-position-x: 50%; transform: translate(var(--sl-px), calc(6 * var(--sl-px))); }
  50% { background-position-x: 0%; transform: translate(0, calc(8 * var(--sl-px))); }
  62.5% { background-position-x: 50%; transform: translate(var(--sl-px), calc(10 * var(--sl-px))); }
  75% { background-position-x: 100%; transform: translate(calc(2 * var(--sl-px)), calc(12 * var(--sl-px))); }
  87.5% { background-position-x: 50%; transform: translate(var(--sl-px), calc(14 * var(--sl-px))); }
  100% { opacity: 0; }
}
.sl-evo-aura--twinkle { animation-name: sl-aura-twinkle; }
.sl-evo-aura--twinkle.sl-evo-aura-a { left: calc((var(--sl-l) - 5) * var(--sl-px)); top: calc((var(--sl-t) + 2) * var(--sl-px)); }
.sl-evo-aura--twinkle.sl-evo-aura-b { left: calc((var(--sl-r) - 1) * var(--sl-px)); top: calc((var(--sl-m) + 6) * var(--sl-px)); }
.sl-evo-aura--twinkle.sl-evo-aura-c { left: calc((var(--sl-l) - 3) * var(--sl-px)); top: calc((var(--sl-m) + 15) * var(--sl-px)); }
@keyframes sl-aura-twinkle {
  0% { opacity: 1; background-position-x: 0%; }
  12.5% { background-position-x: 50%; }
  25% { background-position-x: 100%; }
  37.5%, 100% { opacity: 0; }
}

/* The floating extra: 12 x 12 art pixels, one pixel over the head, bobbing a pixel; its two frames twinkle or
   flicker. */
.sl-evo-extra {
  position: absolute;
  left: calc(20 * var(--sl-px));
  top: calc((var(--sl-t) - 13) * var(--sl-px));
  width: calc(12 * var(--sl-px));
  height: calc(12 * var(--sl-px));
  background-repeat: no-repeat;
  image-rendering: pixelated;
  animation: sl-evo-float 2.4s steps(1, end) infinite, sl-evo-extra-frames 1.2s steps(1, end) infinite;
}
@keyframes sl-evo-float {
  0% { transform: none; }
  50% { transform: translateY(calc(-1 * var(--sl-px))); }
}
@keyframes sl-evo-extra-frames {
  0% { background-position-x: 0%; }
  50% { background-position-x: 100%; }
}

/* An evolved sauceling's moves and its evolution moment play on a canvas over the sprite (see move-player.ts), which
   draws the sprite itself meanwhile. */
.sl-move-canvas {
  position: absolute;
  image-rendering: pixelated;
  pointer-events: none;
}
.sl-sprite--canvas > :not(canvas) { visibility: hidden; }

/* The stage: a 16:9 picture (the whole card on a large Home widget) with the creature standing on its floor band. Its
   frame is a pseudo-element, so the picture underneath keeps its shape and its pixels stay square. It clips rather
   than hides what overhangs it (a painted caretaker's frame), so nothing can scroll it sideways. */
.sl-stage {
  position: relative;
  width: 100%;
  max-width: 44rem;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  overflow: clip;
  border-radius: 0.875rem;
  background: var(--sl-sauce-bg, rgba(224,82,70,0.18));
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
.sl-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid var(--sl-sauce-accent, #e05246);
  border-radius: inherit;
  pointer-events: none;
}
.sl-stage-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.sl-stage-bg--pixel { image-rendering: pixelated; }
/* --sl-x is the sprite's left edge in art pixels; each move steps one art pixel at a time, with no script per frame. */
.sl-stage-actor {
  position: absolute;
  left: 0;
  transform: translateX(calc(var(--sl-x) * var(--sl-px)));
  transition: transform var(--sl-move-ms, 0ms) steps(var(--sl-steps, 1), end);
}
/* An egg in the Nook can be picked up and put somewhere else on its background. */
.sl-stage-actor[data-movable="true"] { cursor: grab; touch-action: none; }
.sl-stage-actor[data-movable="true"]:active { cursor: grabbing; }
.sl-stage-actor[data-movable="true"]:focus-visible { outline: 2px solid var(--sl-sauce-accent, #e05246); outline-offset: -2px; border-radius: 0.5rem; }
/* The frames face a little to the right; turning left mirrors them (the effects stay as drawn). */
.sl-stage-actor[data-facing="left"] .sl-sprite-frames { scale: -1 1; }
/* A Fluttino never quite lands. */
.sl-stage-actor[data-hover="true"] .sl-sprite {
  translate: 0 calc(-10 * var(--sl-px));
  animation: sl-hover 2.4s steps(1, end) infinite;
}
@keyframes sl-hover {
  0%, 50%, 100% { translate: 0 calc(-10 * var(--sl-px)); }
  25% { translate: 0 calc(-11 * var(--sl-px)); }
  75% { translate: 0 calc(-9 * var(--sl-px)); }
}

.sl-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* The Engine's "reduce ambient effects" stops idling but keeps the reply to a tap; an unfocused window
   holds the current frame, as Mari does; reduced motion stops everything. */
html[data-marinara-reduced-effects="true"] :is(.sl-sprite, .sl-evo-ring) > .sl-idle { animation: none; }
html[data-marinara-reduced-effects="true"] .sl-stage-actor .sl-sprite { animation: none; }
html[data-marinara-reduced-effects="true"] .sl-sprite > :is(.sl-evo-aura, .sl-evo-extra) { animation: none; }
html[data-marinara-reduced-effects="true"] .sl-sprite > .sl-evo-ring { animation: none; opacity: 0.35; }
html[data-marinara-reduced-effects="true"] .sl-live { animation: none; }
html[data-marinara-effects-paused="true"] :is(.sl-sprite, .sl-evo-ring) > .sl-sprite-frames,
html[data-marinara-effects-paused="true"] .sl-sprite > .sl-fx,
html[data-marinara-effects-paused="true"] .sl-live,
html[data-marinara-effects-paused="true"] .sl-sprite > :is(.sl-evo-ring, .sl-evo-aura, .sl-evo-extra),
html[data-marinara-effects-paused="true"] .sl-stage-actor .sl-sprite { animation-play-state: paused; }
html[data-marinara-effects-paused="true"] .sl-stage-actor { transition-duration: 0s !important; }
@media (prefers-reduced-motion: reduce) {
  :is(.sl-sprite, .sl-evo-ring) > .sl-sprite-frames { animation: none; }
  .sl-live { animation: none; }
  .sl-sprite > .sl-fx { display: none; }
  .sl-sprite > :is(.sl-evo-aura, .sl-evo-extra) { animation: none; }
  .sl-sprite > .sl-evo-ring { animation: none; opacity: 0.35; }
  .sl-stage-actor .sl-sprite { animation: none; }
  .sl-stage-actor { transition: none; }
}


.sl-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--sl-sauce-accent, #e05246);
  background: var(--sl-sauce-bg, rgba(224,82,70,0.16));
  color: var(--foreground, #fff);
}

.sl-meters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.sl-meter-box {
  padding: 0.4rem 0.65rem;
  border-radius: 0.65rem;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(0,0,0,0.2);
  min-width: 0;
}

.sl-meter-box--gap {
  border-color: var(--sl-amber);
  background: rgba(245, 158, 11, 0.1);
}

.sl-meter-head {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
}
.sl-meter-gap { margin-top: 0.2rem; font-size: 0.68rem; color: var(--sl-amber); }

.sl-meter-bar {
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  overflow: hidden;
  margin-top: 0.35rem;
}

.sl-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--sl-sauce-accent, #e05246);
  transition: width 0.25s ease;
}

.sl-meter-fill--gap {
  background: var(--sl-amber);
}

.sl-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

/* The Nook's two parts: the stage card (name bar, then the stage with the caretaker's box joined under it) and
   the care card (meters, care buttons, the line about the last one). A phone stacks them; a wide panel puts the
   care card beside the stage, so the pet, the caretaker and the buttons are all in view. */
.sl-nook-main {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "stage" "care";
}
.sl-stage-card { grid-area: stage; display: grid; gap: 0.75rem; }
.sl-care-card { grid-area: care; display: grid; gap: 0.75rem; }
.sl-stage-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.sl-stage-bar > .sl-btn { flex-shrink: 0; }
.sl-stage-title { display: grid; gap: 0.15rem; flex: 1 1 0; min-width: 0; }
.sl-stage-name { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.5rem; min-width: 0; }
/* A rare sauceling's pixel star or pumpkin beside its name. */
.sl-rare-mark { flex: none; vertical-align: -0.25em; }
.sl-pet-tile-name .sl-rare-mark { margin-right: 0.25rem; }
.sl-stage-sub { font-size: 0.78rem; opacity: 0.7; overflow-wrap: anywhere; }
.sl-rename { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; flex: 1 1 100%; }
.sl-action-note {
  min-height: 1.2em;
  margin: -0.25rem 0 0;
  text-align: center;
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.sl-action-note--shown { opacity: 0.85; transition-duration: 0.15s; }
.sl-retire {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  border-color: var(--sl-sauce-accent, #e05246);
  font-size: 0.85rem;
}

/* The stage and the caretaker's box under it, as one frame, the way a visual novel puts its dialogue box under
   the scene. A caretaker with sprites stands at the stage's right, cut off by its bottom edge; the pet keeps to
   the rest (see walkWidth). Their art is drawn smooth, as the Engine's chat draws it. */
.sl-scene { display: grid; width: 100%; max-width: 44rem; margin: 0 auto; }
.sl-scene .sl-stage { border-radius: 0.875rem 0.875rem 0 0; }
/* A painted caretaker: pixel art, drawn with square pixels like the pet; its size and frame are set inline. */
.sl-stage-figure {
  position: absolute;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  pointer-events: none;
}
.sl-stage-caretaker {
  position: absolute;
  right: 1%;
  bottom: 0;
  height: 92%;
  max-width: 30%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 0 0.6rem rgba(0, 0, 0, 0.45));
  pointer-events: none;
}
/* A flipped caretaker is mirrored about the middle of their frame, so a side view sits a few art pixels off where a
   repainted one would; the individual scale composes with the breathing and settling transforms below. */
.sl-stage-figure[data-flipped], .sl-stage-caretaker[data-flipped] { scale: -1 1; }
/* The caretaker breathes as the pet does, with their feet on the floor: a painted figure shows its squashed row
   (the top one art pixel lower) for part of each breath, and an Engine sprite, drawn smooth, settles a little
   from its feet. Slower than the pet's 2.4 s breath, so the two do not move in step. Reduced effects and reduced
   motion hold them still. */
.sl-stage-figure[data-breathes] { animation: sl-caretaker-breath 2.8s steps(1, end) infinite; }
.sl-stage-caretaker {
  transform-origin: 50% 100%;
  animation: sl-caretaker-settle 2.8s ease-in-out infinite alternate;
}
html[data-marinara-reduced-effects="true"] .sl-stage-figure,
html[data-marinara-reduced-effects="true"] .sl-stage-caretaker { animation: none; }
html[data-marinara-effects-paused="true"] .sl-stage-figure,
html[data-marinara-effects-paused="true"] .sl-stage-caretaker,
.sl-stage[data-paused] .sl-stage-figure,
.sl-stage[data-paused] .sl-stage-caretaker { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .sl-stage-figure[data-breathes], .sl-stage-caretaker { animation: none; }
}
@keyframes sl-caretaker-breath {
  0%, 100% { background-position-y: 0%; }
  60% { background-position-y: 100%; }
}
@keyframes sl-caretaker-settle {
  to { transform: scaleY(0.985); }
}
/* A painted caretaker blinks: their eyes shut, drawn over the same frame, for about 140 ms every 3 to 4 s, and
   sometimes twice. Off with reduced effects and reduced motion; held open while paused. */
.sl-stage-blink {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-size: inherit;
  background-position: inherit;
  opacity: 0;
  animation: sl-caretaker-blink 7s steps(1, end) infinite;
}
html[data-marinara-reduced-effects="true"] .sl-stage-blink { animation: none; }
html[data-marinara-effects-paused="true"] .sl-stage-blink,
.sl-stage[data-paused] .sl-stage-blink { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .sl-stage-blink { animation: none; }
}
@keyframes sl-caretaker-blink {
  45% { opacity: 1; }
  47% { opacity: 0; }
  89% { opacity: 1; }
  91% { opacity: 0; }
  94% { opacity: 1; }
  96% { opacity: 0; }
}

/* The caretaker's message box: their picture (when they are not standing in the scene) beside their name, then
   their line, the Previous and Next buttons, Check in and Ask the whole width. */
.sl-box {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.6rem 0.85rem;
  align-items: start;
}
.sl-box-plate {
  grid-column: 2;
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  font-size: 0.95rem;
}
.sl-box-time { margin-left: auto; font-size: 0.7rem; opacity: 0.6; white-space: nowrap; }
.sl-box-line {
  margin: 0;
  max-height: 9rem;
  overflow-y: auto;
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.sl-box-line, .sl-box-nav, .sl-box > .sl-care-row { grid-column: 1 / -1; }
.sl-box--joined {
  padding: 0.75rem 1rem 0.85rem;
  border: 2px solid var(--sl-sauce-accent, #e05246);
  border-top: none;
  border-radius: 0 0 0.875rem 0.875rem;
  background: rgba(0, 0, 0, 0.3);
}
.sl-box.sl-box--standing { grid-template-columns: minmax(0, 1fr); }
.sl-box--standing .sl-box-plate { grid-column: 1; }
/* A new line types out over the space the whole line takes, so nothing under it moves. */
.sl-box-typed { display: grid; }
.sl-box-typed > * { grid-area: 1 / 1; }
.sl-box-ghost { visibility: hidden; }
.sl-box-line--typing { cursor: pointer; }
.sl-box-nav { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; opacity: 0.85; }
/* Check in and Ask, under the care buttons. */
.sl-care-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
}
.sl-care-ask { font-size: 0.8rem; }
.sl-care-note { font-size: 0.72rem; opacity: 0.7; }
.sl-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border, rgba(255,255,255,0.16));
}
.sl-pill--ai { background: rgba(169,120,232,0.2); border-color: transparent; color: #d8b4fe; }

/* About the sauceling: closed until asked for. */
.sl-about > summary { cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.sl-about-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem; margin-top: 0.75rem; font-size: 0.8125rem; }
.sl-about-body p { margin: 0; opacity: 0.85; }
.sl-about-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.sl-about-row .sl-select { min-width: 0; max-width: 100%; }
/* A hint behind a "?", as in the Engine: muted until it is pointed at, and a 24px target for a finger. It stays
   beside the button it explains; on a narrow row the button's words wrap instead. */
.sl-with-help { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; max-width: 100%; }
.sl-with-help > .sl-btn { min-width: 0; }
.sl-help {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: none;
  color: inherit;
  opacity: 0.7;
  cursor: help;
}
.sl-help:hover, .sl-help:focus-visible, .sl-help[aria-expanded="true"] { opacity: 1; }
.sl-help:focus-visible { outline: 2px solid var(--sl-sauce-accent, #e05246); outline-offset: 1px; }
.sl-help svg {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sl-help-tip {
  position: fixed;
  z-index: 9999;
  max-width: min(18rem, calc(100vw - 16px));
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 0.5rem;
  background: var(--popover, var(--card, #18181b));
  color: var(--popover-foreground, var(--foreground, #f4f4f5));
  font-size: 0.75rem;
  line-height: 1.4;
  box-shadow: 0 6px 20px rgba(0,0,0,0.35);
}
.sl-traits { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.sl-trait { font-size: 0.68rem; padding: 0.12rem 0.45rem; border-radius: 0.35rem; background: rgba(255,255,255,0.07); opacity: 0.85; }

/* Changing the background. */
.sl-picker { display: grid; gap: 0.6rem; }
.sl-picker-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.sl-picker-label { font-size: 0.8rem; }
.sl-picker-prompt { width: 100%; resize: vertical; font-family: inherit; }

/* The caretaker's avatar, or their initial when the character has none. */
.sl-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid var(--sl-sauce-accent, var(--border, rgba(255,255,255,0.16)));
  background: rgba(255,255,255,0.08);
  font-weight: 700;
}
.sl-avatar--small { width: 1.5rem; height: 1.5rem; border-width: 1px; font-size: 0.7rem; }
/* Beside the caretaker's lines: large, a rounded square, as in visual-novel mode. */
.sl-avatar--box { width: 5rem; height: 5rem; border-radius: 0.75rem; font-size: 1.75rem; }

/* The Album: paintings as square tiles, and the one you opened, large, above them. */
.sl-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.6rem;
}
.sl-gallery-tile {
  padding: 0;
  border: 1px solid var(--border, rgba(255,255,255,0.16));
  border-radius: 0.75rem;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
  aspect-ratio: 1;
  cursor: pointer;
}
.sl-gallery-tile[aria-pressed="true"] { border: 2px solid var(--sl-sauce-accent, #e05246); }
.sl-gallery-tile:focus-visible, .sl-viewer:focus-visible {
  outline: 2px solid var(--ring, var(--primary, #e05246));
  outline-offset: 2px;
}
.sl-gallery-image { display: block; width: 100%; height: 100%; object-fit: cover; }
/* The Menagerie: a section per stage, each pet a tile of its sprite and name; the opened one has its sauce's border. */
.sl-menagerie-section { display: grid; gap: 0.5rem; }
.sl-menagerie-heading {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}
.sl-menagerie-count { font-weight: 500; opacity: 0.6; }
/* In px, like the 104 px sprite inside: 3 px of padding and a 1 px border each side, so three fit across a phone. */
.sl-gallery--pets { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
.sl-gallery--pets .sl-gallery-tile {
  aspect-ratio: auto;
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  padding: 3px 3px 0.45rem;
  color: var(--foreground, #fff);
  font: inherit;
}
/* Tall enough for a grown sauceling's floating extra; it stands on the tile's floor. */
.sl-sprite-stage--tile { width: 100%; height: 7.75rem; align-items: flex-end; border: 0; border-radius: 0.5rem; }
.sl-pet-tile-name {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.8rem;
}
/* The background library: 16:9 tiles, each saved one with a delete button in its corner. */
.sl-gallery--wide { grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); }
.sl-gallery--wide .sl-gallery-tile { aspect-ratio: 16 / 9; width: 100%; }
.sl-gallery-tile:disabled { cursor: default; }
.sl-gallery-item { position: relative; }
.sl-gallery-remove {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid var(--border, rgba(255,255,255,0.16));
  border-radius: 999px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.sl-gallery-remove:focus-visible { outline: 2px solid var(--ring, var(--primary, #e05246)); outline-offset: 2px; }
.sl-gallery-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  font-size: 0.7rem;
  opacity: 0.7;
}
.sl-viewer { display: grid; gap: 0.6rem; justify-items: start; }
.sl-viewer-image {
  display: block;
  width: min(100%, 32rem);
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 0.75rem;
  background: rgba(255,255,255,0.04);
}
/* An Album keepsake: before and after side by side on its Nook background, standing on its floor. */
.sl-keepsake {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.sl-keepsake--large { width: min(100%, 32rem); height: auto; aspect-ratio: 16 / 9; gap: 1rem; border-radius: 0.75rem; }
.sl-keepsake-side { position: relative; display: grid; justify-items: center; padding-bottom: 0.4rem; }
.sl-keepsake-label {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 0.75rem;
}

.sl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 0.55rem;
  border: 1px solid var(--border, rgba(255,255,255,0.14));
  background: var(--secondary, rgba(255,255,255,0.08));
  color: var(--foreground, #fff);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

@media (hover: hover) {
  .sl-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.14);
  }
}

.sl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sl-btn--small { padding: 0.2rem 0.55rem; font-size: 0.72rem; }

.sl-btn--primary {
  background: var(--sl-sauce-accent, #e05246);
  border-color: var(--sl-sauce-accent, #e05246);
  color: #fff;
}

/* The voice offer: a native modal dialog, opaque over the page. */
.sl-dialog {
  /* The Engine's reset zeroes the margin that centres a modal dialog. */
  margin: auto;
  width: min(26rem, calc(100vw - 2rem));
  border: 1px solid var(--border, rgba(255,255,255,0.14));
  border-radius: 0.875rem;
  background: var(--background, #09090b);
  color: var(--foreground, #fff);
  padding: 1.1rem 1.25rem;
}
.sl-dialog:focus { outline: none; }
.sl-dialog::backdrop { background: rgba(0,0,0,0.55); }
.sl-dialog h2 { font-size: 1rem; font-weight: 600; margin: 0 0 0.5rem; }
.sl-dialog p { font-size: 0.85rem; line-height: 1.45; opacity: 0.85; margin: 0 0 1rem; }
.sl-dialog p:last-child { margin-bottom: 0; }
.sl-dialog-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }

/* Evolve\u2026: the two looks side by side, one above the other on a narrow screen. */
.sl-dialog--wide { width: min(36rem, calc(100vw - 2rem)); }
.sl-evolve-choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.sl-evolve-choice { display: flex; flex-direction: column; gap: 0.4rem; align-items: stretch; }
/* A move may reach past its tile: above is free, but the tiles sit side by side. */
.sl-evolve-choice .sl-sprite-stage--tile { overflow: visible; overflow-x: clip; }
.sl-evolve-choice h3 { font-size: 0.95rem; font-weight: 600; margin: 0.25rem 0 0; }
.sl-dialog .sl-evolve-choice p { margin: 0; }
.sl-dialog .sl-evolve-choice .sl-evolve-from { font-size: 0.78rem; opacity: 0.7; font-style: italic; }
.sl-evolve-choice .sl-btn { margin-top: auto; }
.sl-dialog p.sl-evolve-decline { margin: 0.75rem 0 0; font-size: 0.78rem; opacity: 0.7; text-align: right; }
.sl-link {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.sl-link:disabled { cursor: default; opacity: 0.5; }

.sl-btn--gap {
  border-color: var(--sl-amber);
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.35);
}

.sl-input, .sl-select {
  padding: 0.45rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, rgba(255,255,255,0.16));
  background: var(--background, #09090b);
  color: var(--foreground, #fff);
  font-size: 0.8125rem;
  max-width: 100%;
  min-width: 0;
}

.sl-select--small {
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
}

.sl-widget {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.65rem;
  height: 100%;
  padding: 0.85rem;
  color: var(--foreground, #fff);
  cursor: pointer;
}
/* The large widget: the stage fills the card, with thin bars (each with a small picture) over its top-left and the
   care buttons in a column down its right side, below Home's own move handle. Its height comes from Home's row, so
   the card is a size container. */
.sl-widget--stage { container: sl-widget / size; position: relative; padding: 0; gap: 0; border-radius: inherit; overflow: clip; }
.sl-widget-body { position: absolute; inset: 0; border-radius: inherit; }
.sl-widget-stage { position: absolute; inset: 0; min-width: 0; border-radius: inherit; }
.sl-widget-stage .sl-stage { width: 100%; height: 100%; max-width: none; aspect-ratio: auto; margin: 0; border-radius: inherit; }
.sl-widget-hud {
  position: absolute;
  inset: 0.5rem 0.5rem auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  pointer-events: none;
}
.sl-widget-bars {
  display: grid;
  gap: 0.4rem;
  width: min(9rem, 60%);
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  background: rgba(0,0,0,0.45);
  pointer-events: auto;
}
.sl-widget-bar-row { display: flex; align-items: center; gap: 0.4rem; }
.sl-widget-bar-icon { flex: none; width: 1rem; font-size: 0.8rem; line-height: 1; text-align: center; }
.sl-widget-bar { flex: 1; min-width: 0; height: 0.45rem; border-radius: 999px; background: rgba(255,255,255,0.22); overflow: hidden; }
/* The column starts under the move handle Home puts in the card's top-right corner. */
.sl-widget-acts { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 2.25rem; pointer-events: auto; }
.sl-widget-act { width: 2.25rem; height: 2.25rem; padding: 0; border-radius: 50%; font-size: 1.05rem; background: rgba(0,0,0,0.5); }
/* Home gives a large widget two columns by two rows; this one is one column by two rows, a tall square-ish card. Home
   counts it as four spots, which only leaves a spare empty slot at the end of the grid. */
.mari-home-feed-grid .mari-home-widget[data-home-widget-kind="package"][data-home-widget-id$=":sauceling-nook"] {
  grid-column: span 1;
  grid-row: span 2;
}

/* A wide panel: the care card in its own column beside the stage, its meters one under another and its buttons
   two by two, kept in view while you scroll. */
@container sl-shell (min-width: 48rem) {
  .sl-nook-main {
    grid-template-columns: minmax(0, 1fr) 17rem;
    grid-template-areas: "stage care";
  }
  .sl-care-card { position: sticky; top: 0; align-self: start; }
  .sl-care-card .sl-meters--strip { grid-template-columns: minmax(0, 1fr); }
  .sl-care-card .sl-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sl-care-card .sl-actions > :last-child:nth-child(odd) { grid-column: 1 / -1; }
}

/* Phones and narrow panels: tabs in one row, the stage the width of the card, care buttons two by two. */
@container sl-shell (max-width: 40rem) {
  .sl-header { padding: 0.5rem 0.75rem; }
  .sl-header-title { display: none; }
  .sl-nav { flex: 1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.125rem; }
  .sl-tab-btn { padding: 0.45rem 0.125rem; font-size: 0.75rem; }
  /* Five tabs only fit a phone on one line without their counts. */
  .sl-tab-count { display: none; }
  .sl-body { padding: 0.75rem; }
  .sl-card { padding: 0.85rem; }
  .sl-nook, .sl-nook-main { gap: 0.75rem; }
  .sl-stage-card, .sl-care-card { gap: 0.6rem; }
  /* Three meters across: a gap's words move to its tooltip, and the box and bar turn amber. */
  .sl-meters--strip { gap: 0.35rem; }
  .sl-meter-box { padding: 0.35rem 0.5rem; }
  .sl-meter-head { font-size: 0.72rem; }
  .sl-meter-gap { display: none; }
  .sl-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  /* An odd last button (an egg's third, or Paint) takes the whole row. */
  .sl-actions > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  /* The caretaker's picture is smaller, the Background button is its icon, and Ask's picker and button share
     the row under its label. */
  .sl-box { grid-template-columns: 4rem minmax(0, 1fr); column-gap: 0.7rem; }
  .sl-box--joined { padding: 0.65rem 0.75rem 0.75rem; }
  .sl-btn-label { display: none; }
  .sl-ask-row > .sl-care-ask { flex-basis: 100%; }
  .sl-ask-row > .sl-select { flex: 1 1 0; min-width: 0; }
  .sl-avatar--box { width: 4rem; height: 4rem; }
  /* The caretaker's avatar stays beside the picker; the buttons share the row below. */
  .sl-egg-form > .sl-select, .sl-egg-form > .sl-input { flex: 1 1 calc(100% - 3.5rem); min-width: 0; }
  .sl-egg-form > .sl-btn { flex: 1 1 auto; }
}

/* Finger-sized targets, and text fields at 16 px so iOS Safari does not zoom the page on focus. */
@media (pointer: coarse) {
  .sl-btn, .sl-tab-btn { min-height: 2.75rem; }
  .sl-btn--small { min-height: 2.25rem; }
  .sl-widget-act { width: 2.75rem; height: 2.75rem; }
  .sl-input, .sl-select { min-height: 2.75rem; font-size: max(16px, 1rem); }
}
`;function Yr(){let e=ge(),[t,n]=G(null),s=de((r,o)=>{let c=e.getQueryData(["saucelings","state"])?.characters.find(u=>u.id===r);if(!c||c.hasVoice){o?.(!0);return}n({characterId:r,name:c.name,onDone:o})},[e]),a=r=>{t?.onDone?.(r),n(null)};return{ask:s,dialog:t?i(ol,{characterId:t.characterId,name:t.name,onFinish:a},t.characterId):null}}function ol({characterId:e,name:t,onFinish:n}){let{t:s}=J(),a=ge(),r=j(null),[o,l]=G("ask");Y(()=>{let u=r.current;return u&&!u.open&&u.showModal(),u?.querySelector(".sl-btn--primary")?.focus(),()=>u?.close()},[]);let c=async()=>{l("reading"),r.current?.focus();try{let u=await V("/voice","POST",{characterId:e});a.setQueryData(["saucelings","state"],u),n(!0)}catch{l("failed")}};return h("dialog",{ref:r,className:"sl-dialog",tabIndex:-1,"aria-labelledby":"sl-voice-title",onCancel:u=>{u.preventDefault(),o!=="reading"&&n(!1)},children:[i("h2",{id:"sl-voice-title",children:s("saucelings.voice.title",{name:t})}),i("p",{role:"status",children:o==="reading"?s("saucelings.about.refreshingVoice",{name:t}):o==="failed"?s("saucelings.voice.failed",{name:t}):s("saucelings.voice.body",{name:t})}),o==="reading"?null:h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(o==="ask"),children:s(o==="ask"?"saucelings.voice.notNow":"saucelings.voice.close")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",autoFocus:!0,onClick:()=>{c()},children:o==="ask"?s("saucelings.voice.read",{name:t}):s("saucelings.voice.tryAgain")})]})]})}var il=new ba({defaultOptions:{queries:{retry:!1,staleTime:5e3}}}),ua=class extends Sa.Component{constructor(){super(...arguments);oe(this,"state",{error:null})}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n){let s=n.message||nt(this.props.element.capabilityProps?.localization,"saucelings.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Saucelings client capability stopped",n)}render(){return this.state.error?i("div",{className:"sl-shell",style:{padding:"1.5rem"},role:"alert",children:h("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},children:[i("strong",{children:nt(this.props.element.capabilityProps?.localization,"saucelings.error.interface")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:this.state.error.message}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})},children:nt(this.props.element.capabilityProps?.localization,"saucelings.error.retry")})})]})}):this.props.children}},ll=["nook","journal","album","menagerie","settings"];function cl({props:e}){let{t}=J(),[n,s]=G("nook"),a=Yr(),r=e.focusPostId,o=e.onFocusPostHandled;Y(()=>{r&&o?.()},[r,o]);let l=le({queryKey:["saucelings","state"],queryFn:()=>V("/state"),refetchOnMount:"always",refetchInterval:u=>u.state.data?.writing.length?2e3:!1}),c=l.error?.status===404;return h("div",{className:"sl-shell",children:[h("header",{className:"sl-header",children:[h("div",{className:"sl-header-title",children:[i("strong",{style:{fontSize:"1rem"},children:t("saucelings.title")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.subtitle")})]}),i("nav",{className:"sl-nav","aria-label":t("saucelings.nav.label"),children:ll.map(u=>h("button",{type:"button",className:`sl-tab-btn ${n===u?"sl-tab-btn--active":""}`,"aria-current":n===u?"page":void 0,onClick:()=>s(u),children:[t(`saucelings.tab.${u}`),u==="album"&&l.data?.portraitCount?h("span",{className:"sl-tab-count",children:[" (",l.data.portraitCount,")"]}):null,u==="menagerie"&&l.data?.menagerieCount?h("span",{className:"sl-tab-count",children:[" (",l.data.menagerieCount,")"]}):null]},u))})]}),i("main",{className:"sl-body",children:h("div",{className:"sl-container",children:[l.isError&&l.data?i("div",{role:"alert",style:{fontSize:"0.8rem",color:"#f87171",marginBottom:"0.5rem"},children:t("saucelings.error.load")}):null,l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.loading")}):l.data?n==="nook"?i(qr,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,askVoice:a.ask}):n==="journal"?i(Sr,{state:l.data}):n==="album"?i(wr,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion}):n==="menagerie"?i(xr,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,onRestored:u=>{s("nook"),a.ask(u)}}):i(Wr,{state:l.data}):h("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},role:"alert",children:[i("strong",{children:t("saucelings.error.load")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:c?t("saucelings.error.restart"):l.error instanceof Error?l.error.message:t("saucelings.error.request")}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{l.refetch()},children:t("saucelings.error.retry")})})]})]})}),a.dialog]})}function ul({element:e}){let t=e.capabilityProps??{},n=e.getAttribute("view"),s=typeof t.packageId=="string"?t.packageId:"saucelings",a=typeof t.packageVersion=="string"?t.packageVersion:null;return n==="widget"?i(Qr,{active:t.active===!0,compact:t.widgetId==="sauceling-compact",packageId:s,packageVersion:a,onOpenNoodle:typeof t.onOpenNoodle=="function"?t.onOpenNoodle:void 0}):i(cl,{props:t})}function gl({element:e}){let[,t]=G(0);return Y(()=>{let n=()=>t(s=>s+1);return e.addEventListener("marinara-capability-props",n),()=>e.removeEventListener("marinara-capability-props",n)},[e]),h(Ia,{localization:e.capabilityProps?.localization,children:[i("style",{children:jr}),i(tr,{}),i(ua,{element:e,children:i(ul,{element:e})})]})}var Cn=class extends HTMLElement{constructor(){super(...arguments);oe(this,"__root",null);oe(this,"capabilityProps");oe(this,"capabilityRuntimeError")}attributeChangedCallback(n,s,a){n==="view"&&s!==a&&this.__root&&this.render()}render(){this.__root?.render(i(ya,{client:il,children:i(gl,{element:this})}))}connectedCallback(){this.__root||(this.__root=Ca(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};oe(Cn,"observedAttributes",["view"]);var Xr="marinara-capability-saucelings";customElements.get(Xr)||customElements.define(Xr,Cn);
