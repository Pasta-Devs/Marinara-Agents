var Xr=Object.defineProperty;var Jr=(e,t,n)=>t in e?Xr(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var re=(e,t,n)=>Jr(e,typeof t!="symbol"?t+"":t,n);var Gt=globalThis.__MARINARA_HOST__,K=Gt&&Gt.version===1&&Gt.modules?Gt.modules["@tanstack/react-query"]:void 0;if(!K)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var rl=K.CancelledError,ol=K.HydrationBoundary,il=K.InfiniteQueryObserver,ll=K.IsRestoringProvider,cl=K.Mutation,ul=K.MutationCache,gl=K.MutationObserver,dl=K.QueriesObserver,pl=K.Query,ml=K.QueryCache,fa=K.QueryClient,fl=K.QueryClientContext,ha=K.QueryClientProvider,hl=K.QueryErrorResetBoundary,bl=K.QueryObserver,yl=K.dataTagErrorSymbol,vl=K.dataTagSymbol,wl=K.defaultScheduler,Sl=K.defaultShouldDehydrateMutation,kl=K.defaultShouldDehydrateQuery,xl=K.dehydrate,El=K.dehydrateQuery,Cl=K.environmentManager,Rl=K.experimental_streamedQuery,Ml=K.focusManager,Il=K.hashKey,Al=K.hydrate,Nl=K.infiniteQueryOptions,Pl=K.isCancelledError,Tl=K.isServer,_l=K.keepPreviousData,Ol=K.matchMutation,Fl=K.matchQuery,Ll=K.mutationOptions,$l=K.noop,Ul=K.notifyManager,Hl=K.onlineManager,Dl=K.partialMatchKey,zl=K.queryOptions,Bl=K.replaceEqualDeep,Gl=K.shouldThrowError,Kl=K.skipToken,ql=K.timeoutManager,Vl=K.unsetMarker,Wl=K.useInfiniteQuery,Ql=K.useIsFetching,jl=K.useIsMutating,Yl=K.useIsRestoring,ne=K.useMutation,ba=K.useMutationState,Xl=K.usePrefetchInfiniteQuery,Jl=K.usePrefetchQuery,Zl=K.useQueries,ie=K.useQuery,ue=K.useQueryClient,ec=K.useQueryErrorResetBoundary,tc=K.useSuspenseInfiniteQuery,nc=K.useSuspenseQueries,ac=K.useSuspenseQuery;var Kt=globalThis.__MARINARA_HOST__,Q=Kt&&Kt.version===1&&Kt.modules?Kt.modules.react:void 0;if(!Q)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var rc=Q.Activity,oc=Q.Children,ic=Q.Component,lc=Q.Fragment,cc=Q.Profiler,uc=Q.PureComponent,gc=Q.StrictMode,dc=Q.Suspense,pc=Q.ViewTransition,mc=Q.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,fc=Q.__COMPILER_RUNTIME,hc=Q.act,bc=Q.addTransitionType,yc=Q.cache,vc=Q.cacheSignal,wc=Q.captureOwnerStack,Sc=Q.cloneElement,ya=Q.createContext,kc=Q.createElement,xc=Q.createRef,va=Q.default,Ec=Q.forwardRef,Cc=Q.isValidElement,Rc=Q.lazy,Mc=Q.memo,Ic=Q.startTransition,Ac=Q.unstable_useCacheRefresh,Nc=Q.use,Pc=Q.useActionState,ge=Q.useCallback,wa=Q.useContext,Tc=Q.useDebugValue,_c=Q.useDeferredValue,X=Q.useEffect,Oc=Q.useEffectEvent,Sa=Q.useId,ka=Q.useImperativeHandle,Fc=Q.useInsertionEffect,Be=Q.useLayoutEffect,qt=Q.useMemo,Lc=Q.useOptimistic,$c=Q.useReducer,j=Q.useRef,G=Q.useState,Uc=Q.useSyncExternalStore,Hc=Q.useTransition,Dc=Q.version;var Vt=globalThis.__MARINARA_HOST__,vt=Vt&&Vt.version===1&&Vt.modules?Vt.modules["react-dom/client"]:void 0;if(!vt)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var xa=vt.createRoot,Bc=vt.default,Gc=vt.hydrateRoot,Kc=vt.version;var Zr="/api/saucelings",eo="x-marinara-csrf";var to="marinara_admin_secret";function no(){if(typeof window>"u")return{};try{let e=window.localStorage.getItem(to)?.trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function V(e,t="GET",n,s){return Se(`${Zr}${e}`,t,n,s)}async function Se(e,t="GET",n,s){let a=new Headers(no());t!=="GET"&&a.set(eo,"1"),n!==void 0&&a.set("Content-Type","application/json");let o=await fetch(e,{method:t,headers:a,signal:s,cache:"no-store",credentials:"same-origin",...n===void 0?{}:{body:JSON.stringify(n)}});if(!o.ok){let r=await o.json().catch(()=>null),l=typeof r?.error=="string"?r.error:typeof r?.message=="string"?r.message:o.statusText;throw new Error(l||"Saucelings request failed")}return o.json()}function Ge(e="saucelings",t,n){let s=`/api/capability-packages/${encodeURIComponent(e)}/assets/${t}`;return n?`${s}?v=${encodeURIComponent(n)}`:s}var Ea={_meta:{locale:"en",direction:"ltr"},"saucelings.title":"Saucelings","saucelings.subtitle":"Your characters look after a little companion; you cover the gaps.","saucelings.loading":"Loading Saucelings\u2026","saucelings.nav.label":"Saucelings views","saucelings.tab.nook":"Nook","saucelings.tab.journal":"Journal","saucelings.tab.album":"Album","saucelings.tab.menagerie":"Menagerie","saucelings.tab.settings":"Settings","saucelings.empty.title":"No sauceling in the nook yet","saucelings.empty.body":"Pick a character to look after a sauceling. They'll bring an egg that looks like something they would find.","saucelings.empty.pickCaretaker":"Choose caretaker","saucelings.empty.bringEgg":"Have caretaker bring an egg","saucelings.empty.bringingEgg":"Bringing egg\u2026","saucelings.empty.houseCaretaker":"House Caretaker","saucelings.empty.eggAlt":"Egg","saucelings.egg.name":"Egg","saucelings.egg.about":"Nobody knows what is inside yet. Keep it warm and talk to it, and it will hatch.","saucelings.egg.moveLabel":"Egg. Drag it, or use the arrow keys, to move it.","saucelings.egg.moveHint":"Drag the egg to move it, or tap where it should go.","saucelings.pet.rename":"Rename","saucelings.pet.nameIt":"Name it","saucelings.pet.namePlaceholder":"Give it a name","saucelings.pet.sauce":"Sauce: {{sauce}}","saucelings.pet.rare.special":"Special sauceling","saucelings.pet.rare.halloween":"Halloween sauceling","saucelings.pet.sauceAbout":"{{sauce}} sauce: {{readsAs}}. Its sauce changes with how it is looked after.","saucelings.pet.temperament":"Temperament: {{temperament}}","saucelings.pet.temperamentAbout":"{{temperament}}: {{readsAs}}. It takes after {{after}}, and slowly picks up the ways of whoever looks after it.","saucelings.pet.temperamentForming":"Its temperament is still taking shape.","saucelings.pet.locked":"{{stage}} (locked)","saucelings.pet.growthPaused":"Growing paused: hungry","saucelings.pet.caretaker":"Caretaker:","saucelings.pet.eggCaretaker":"Keeping it warm:","saucelings.pet.meals":"Meals: {{given}} of {{total}} this week","saucelings.pet.mealsTitle":"Meals {{name}} gave in the last 7 days","saucelings.pet.keptWarm":"Kept warm: {{given}} of {{total}} this week","saucelings.pet.keptWarmTitle":"Times {{name}} kept the egg warm in the last 7 days","saucelings.stage.egg":"egg","saucelings.stage.hatchling":"hatchling","saucelings.stage.juvenile":"juvenile","saucelings.stage.adult":"adult","saucelings.stage.elder":"elder","saucelings.meter.hunger":"Hunger","saucelings.meter.mood":"Mood","saucelings.meter.bond":"Bond","saucelings.meter.hungerGap":"Needs attention","saucelings.meter.moodGap":"Low spirits","saucelings.meter.warmth":"Warmth","saucelings.meter.warmthGap":"Getting cold","saucelings.meter.hatching":"Hatching","saucelings.meter.hatchingGap":"Needs care first","saucelings.action.feed":"Feed","saucelings.action.play":"Play","saucelings.action.rest":"Rest","saucelings.action.pet":"Cuddle","saucelings.action.warm":"Warm","saucelings.action.talk":"Talk","saucelings.action.listen":"Listen","saucelings.action.wait":"{{minutes}}m","saucelings.nudge.heading":"Ask {{name}} to","saucelings.nudge.ask":"Ask","saucelings.nudge.note":"Lasts 48 hours.","saucelings.nudge.active":"Asked: {{asks}}","saucelings.nudge.left":"{{ask}} ({{hours}} h left)","saucelings.nudge.meals":"remember meals","saucelings.nudge.portions":"go easy on portions","saucelings.nudge.play":"play more","saucelings.nudge.cuddles":"give extra cuddles","saucelings.nudge.warm":"keep it warm","saucelings.nudge.talk":"talk to it more","saucelings.retire.button":"Retire to the Menagerie","saucelings.checkIn.button":"Check in with {{name}}","saucelings.checkIn.pending":"{{name}} is writing\u2026","saucelings.swap.button":"Swap for a new egg","saucelings.swap.note":"{{name}} will move to the Menagerie, and the caretaker you pick brings a new egg.","saucelings.swap.noteEgg":"The egg will move to the Menagerie, and the caretaker you pick brings a new one.","saucelings.swap.confirm":"Swap","saucelings.unlocks.title":"Special eggs","saucelings.unlocks.prismite":"Prismite: raise {{need}} saucelings to elder or evolve them ({{have}} so far).","saucelings.unlocks.thundrake":"Thundrake: care for your saucelings {{need}} times ({{have}} so far).","saucelings.unlocks.clockrit":"Clockrit: care for a sauceling on {{need}} different days ({{have}} so far).","saucelings.unlocks.done":"{{name}}: unlocked. A new egg may be one.","saucelings.unlocks.halloween":"Wickwisp, Cauldrop and Webbit: October only.","saucelings.unlocks.halloweenNow":"Wickwisp, Cauldrop and Webbit: it's October, so a new egg may be one.","saucelings.menagerie.empty":"No saucelings in the Menagerie yet.","saucelings.menagerie.bringBack":"Bring back to Nook","saucelings.menagerie.lockStage":"Lock stage at:","saucelings.menagerie.retiredAs":"Retired as {{stage}} with {{name}}","saucelings.menagerie.returnsAt":"Returns at stage:","saucelings.menagerie.release":"Release","saucelings.menagerie.releaseNote":"Release {{name}} for good? It leaves the Menagerie and can't come back. Its paintings stay in the Album.","saucelings.menagerie.releaseNoteEgg":"Release this egg for good? It leaves the Menagerie and can't come back.","saucelings.menagerie.releaseConfirm":"Release for good","saucelings.menagerie.swapNote":"{{active}} will move to the Menagerie, and {{name}} comes back to the nook.","saucelings.menagerie.swapConfirm":"Swap them","saucelings.menagerie.activeEgg":"The egg in the nook","saucelings.menagerie.thisEgg":"this egg","saucelings.menagerie.foundBy":"Found by {{name}}","saucelings.menagerie.evolved":"Evolved","saucelings.menagerie.close":"Close","saucelings.menagerie.lookedAfterBy":"Looked after by","saucelings.menagerie.chooseCaretaker":"Choose who looks after it","saucelings.menagerie.section.elder":"Elders","saucelings.menagerie.section.adult":"Adults","saucelings.menagerie.section.juvenile":"Juveniles","saucelings.menagerie.section.hatchling":"Hatchlings","saucelings.menagerie.section.egg":"Eggs","saucelings.album.paint":"Paint {{name}}","saucelings.album.painting":"Painting\u2026","saucelings.album.needsConnection":"Pick an image connection in Saucelings settings first.","saucelings.album.off":"Turn on image generation in Settings to paint your sauceling.","saucelings.album.egg":"Paint it once it hatches.","saucelings.album.noPet":"Bring a sauceling into the nook to paint it.","saucelings.album.empty":"No paintings yet.","saucelings.album.inMenagerie":"(in the Menagerie)","saucelings.album.released":"(released)","saucelings.album.caption":"{{stage}}, {{date}}","saucelings.album.alt":"Painting of {{name}}","saucelings.album.missing":"This painting could not be loaded.","saucelings.album.delete":"Delete","saucelings.album.deleteConfirm":"Delete for good","saucelings.album.close":"Close","saucelings.album.keepsakeLabel":"{{name}} before and after evolving","saucelings.album.keepsakeCaption":"{{name}} became {{form}}, {{date}}","saucelings.album.before":"Before","saucelings.album.after":"After","saucelings.album.addInstructions":"Add instructions","saucelings.album.removeInstructions":"Remove instructions","saucelings.album.instructionsLabel":"What should the painting show?","saucelings.album.instructionsPlaceholder":"e.g. sitting in a teacup at a caf\xE9, rain outside","saucelings.album.instructionsNote":"Your words replace the plain background. Leave it empty for a plain portrait.","saucelings.album.instructionsCaption":"\u201C{{instructions}}\u201D","saucelings.form.paint":"Paint {{name}}'s {{stage}} form","saucelings.form.paintEgg":"Paint the egg","saucelings.form.painting":"Painting\u2026","saucelings.form.paintingNote":"Painting it now with your image connection.","saucelings.form.paintingEgg":"Painting the egg\u2026","saucelings.form.repaint":"Repaint all of {{name}}'s forms","saucelings.form.repaintEgg":"Repaint the egg","saucelings.form.repaintHint":"For when the picture came out wrong.","saucelings.form.repaintNote":"Paint every stage again in one new picture? The one you see now stays until the new one is ready.","saucelings.form.repaintConfirm":"Repaint","saucelings.form.undoRepaint":"Undo repaint","saucelings.form.undoRepaintHint":"Goes back to the pictures from before the last repaint. Press it again to bring the repaint back.","saucelings.form.eggFailed":"The egg could not be painted: {{error}} Bring it to the nook to paint it there.","saucelings.form.needed":"Its caretaker invented it, so this stage has no picture until one is painted.","saucelings.form.failed":"The painting could not be cut out into a form. Try again.","saucelings.form.offerEggTitle":"Paint the egg?","saucelings.form.offerEggBody":"This egg has no picture yet. Painting it uses your image connection.","saucelings.form.offerTitle":"Paint {{name}}?","saucelings.form.offerBody":"{{name}} has no picture for this stage yet. Painting it uses your image connection.","saucelings.form.offerNotNow":"Not now","saucelings.form.offerPaint":"Paint it","saucelings.figure.paint":"Paint {{name}} for the Nook","saucelings.figure.repaint":"Repaint {{name}} for the Nook","saucelings.figure.hint":"Draws them in eight poses as a pixel figure in the pets' style, from their avatar and card.","saucelings.figure.confirmNote":"Paint {{name}} as a pixel figure with your image connection? It takes one image request, and what the Nook shows now stays until it is ready.","saucelings.figure.confirm":"Paint","saucelings.figure.failed":"The picture could not be read as drawings of {{name}}. Try again.","saucelings.figure.threePoses":"{{name}} has three poses so far. Repaint for all eight.","saucelings.figure.undoRepaint":"Undo {{name}}'s repaint","saucelings.figure.undoHint":"Goes back to the figure from before the last repaint. Press it again to bring the repaint back.","saucelings.flip.label":"Flip {{name}}","saucelings.flip.note":"Turns {{name}} to face the other way in the Nook. Nothing is repainted.","saucelings.settings.careWindow":"Care window (hours)","saucelings.settings.careWindowNote":"How often the caretaker rolls feeding, play and cuddles (default 6 h).","saucelings.settings.connection":"Writing connection","saucelings.settings.connectionNote":"The connection the caretaker writes journal lines and check-ins with.","saucelings.settings.connectionDefault":"Engine default","saucelings.settings.connectionMissing":"Deleted connection: pick another","saucelings.settings.dailyBudget":"Written lines per day","saucelings.settings.budgetUsed":"Used today: {{used}} / {{limit}}","saucelings.settings.budgetNote":"Lines you ask for with a click (Check in, a new caretaker's hello, a welcome back, a farewell) don't count. Past the limit, other events keep their plain template line.","saucelings.settings.writeEveryLine":"Caretaker writes every line","saucelings.settings.writeEveryLineNote":"Every caretaker line comes from the model instead of the phrasebook. Uses more model calls; the daily limit doesn't apply.","saucelings.settings.images":"Enable image generation","saucelings.settings.imagesNote":"Adds a Paint button to the Album tab and a Generate button for the Nook background, and paints each creature a caretaker invents as soon as Saucelings is open, all with the image connection you pick.","saucelings.settings.threeDrawingFallback":"Simpler caretaker figures","saucelings.settings.threeDrawingFallbackNote":"If a caretaker's figure doesn't come out, ask once more for just three drawings in one row. Helps weaker image models, but uses an extra image call.","saucelings.settings.eggHunting":"Egg hunting","saucelings.settings.eggHuntingNote":"When a character replies in a chat, they may find an egg, which waits in the Menagerie and is mentioned by the caretaker. Only a chance is rolled: no chat text is read and nothing is added to the prompt.","saucelings.settings.imageConnection":"Image connection","saucelings.settings.imageConnectionPick":"Choose an image connection","saucelings.settings.imageConnectionEmpty":"No image generation connection yet. Add one under Connections.","saucelings.settings.reset":"Reset Saucelings","saucelings.settings.resetNote":"Clear the nook, the Menagerie and the Album to start fresh.","saucelings.settings.resetConfirm":"Confirm Reset","saucelings.journal.generated":"AI","saucelings.journal.speaker":"{{name}}:","saucelings.event.egg-found":"Egg found","saucelings.event.hatch":"Hatched","saucelings.event.caretaker-care":"Caretaker","saucelings.event.user-care":"Your care","saucelings.event.nudge":"Nudge","saucelings.event.absence":"While you were away","saucelings.event.stage-up":"Grew up","saucelings.event.temperament-shift":"New sauce","saucelings.event.farewell":"Farewell","saucelings.event.return-from-album":"Back from the Menagerie","saucelings.event.check-in":"Check-in","saucelings.event.evolve":"Evolved","saucelings.event.evolve-offer":"Ready to evolve","saucelings.event.caretaker-change":"New caretaker","saucelings.widget.emptyHint":"Tap to open Saucelings and pick a caretaker.","saucelings.error.interface":"Saucelings encountered an interface error.","saucelings.error.load":"Could not load Saucelings Nook.","saucelings.error.request":"Request failed","saucelings.error.retry":"Try again","saucelings.common.cancel":"Cancel","saucelings.common.save":"Save","saucelings.nook.background":"Background","saucelings.background.title":"Nook background","saucelings.background.upload":"Upload a picture","saucelings.background.uploading":"Uploading\u2026","saucelings.background.generate":"Generate a background","saucelings.background.generating":"Generating\u2026","saucelings.background.promptLabel":"What the background shows","saucelings.background.suggest":"Suggest one for {{name}}","saucelings.background.suggestEgg":"Suggest one for the egg","saucelings.background.suggesting":"Writing\u2026","saucelings.background.suggestPlain":"No writing connection answered, so this is a plain starting point. Edit it as you like.","saucelings.background.useBuiltIn":"Use the built-in background","saucelings.background.tooBig":"That picture is too big.","saucelings.background.off":"Turn on image generation in Settings to generate a background.","saucelings.background.noConnection":"Pick an image connection in Saucelings settings first.","saucelings.background.library":"Saved backgrounds","saucelings.background.tileAlt":"Background: {{label}}","saucelings.background.earlier":"An earlier background","saucelings.background.missing":"Could not load","saucelings.background.delete":"Delete {{label}}","saucelings.background.deleteNote":"Delete \u201C{{label}}\u201D for good? Saucelings showing it go back to their built-in background.","saucelings.background.deleteConfirm":"Delete for good","saucelings.background.full":"The library is full at {{limit}}. Delete a background to save another.","saucelings.caretaker.says":"{{name}} says","saucelings.caretaker.previous":"Earlier line","saucelings.caretaker.next":"Later line","saucelings.caretaker.position":"{{index}} of {{count}}","saucelings.caretaker.idle":"I'm keeping an eye on {{name}}.","saucelings.caretaker.idleEgg":"I'm keeping an eye on the egg.","saucelings.about.summary":"About {{name}}","saucelings.about.egg":"About the egg","saucelings.about.refreshVoice":"Refresh {{name}}'s voice from their card","saucelings.about.refreshingVoice":"{{name}} is reading their card\u2026","saucelings.about.refreshVoiceNote":"Reads their character card again, so their lines sound like them.","saucelings.help.label":"Show help: {{action}}","saucelings.evolve.button":"Evolve\u2026","saucelings.evolve.note":"{{name}} can become something new, once in its life. You choose, or keep it as it is.","saucelings.evolve.undo":"Undo evolution","saucelings.evolve.undoNote":"{{name}} goes back to how it looked before. Evolve\u2026 comes back with the same two choices.","saucelings.evolve.title":"What could {{name}} become?","saucelings.evolve.writing":"{{caretaker}} is thinking about what {{name}} could become\u2026","saucelings.evolve.from":"From: {{from}}","saucelings.evolve.become":"Become {{form}}","saucelings.evolve.keep":"Keep it as it is","saucelings.evolve.decline":"Not interested","saucelings.evolve.declineNote":"Hides Evolve\u2026 for {{name}} for good.","saucelings.evolve.declineConfirm":"Never offer {{name}} an evolution again?","saucelings.evolve.into":"Evolved into: {{form}}","saucelings.evolve.move":"Signature move: {{move}}","saucelings.evolve.moves.twirl":"Twirl","saucelings.evolve.moves.float":"Float","saucelings.evolve.moves.shine":"Shine","saucelings.evolve.moves.roar":"Roar","saucelings.evolve.moves.sparkle":"Sparkle","saucelings.evolve.moves.firepuff":"Fire Puff","saucelings.evolve.moves.icicles":"Icicles","saucelings.evolve.moves.leafwhirl":"Leaf Whirl","saucelings.evolve.moves.wiggle":"Wiggle","saucelings.evolve.moves.petalshower":"Petal Shower","saucelings.evolve.moves.triplehop":"Triple Hop","saucelings.evolve.moves.starburst":"Star Burst","saucelings.evolve.moves.coinshower":"Coin Shower","saucelings.evolve.moves.shockwave":"Shockwave","saucelings.evolve.moves.vanish":"Vanish","saucelings.evolve.moves.zap":"Lightning Zap","saucelings.evolve.moves.dash":"Dash","saucelings.evolve.moves.bubbleblow":"Bubble Blow","saucelings.evolve.moves.splash":"Splash","saucelings.voice.title":"Give {{name}} their own voice?","saucelings.voice.body":"{{name}} has no voice of their own yet, so their stock lines are generic. Saucelings can read their character card once with your writing connection to learn how they talk, what they call your pet and what they say at mealtimes.","saucelings.voice.read":"Read {{name}}'s card","saucelings.voice.notNow":"Not now","saucelings.voice.failed":"Couldn't make {{name}}'s voice: the writing connection didn't answer.","saucelings.voice.tryAgain":"Try again","saucelings.voice.close":"Close","saucelings.retire.ready":"{{name}} is old enough to retire.","saucelings.stage.tapHint":"Tap the stage and {{name}} comes over."};var Wt=globalThis.__MARINARA_HOST__,wt=Wt&&Wt.version===1&&Wt.modules?Wt.modules["react/jsx-runtime"]:void 0;if(!wt)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var le=wt.Fragment,Qc=wt.default,i=wt.jsx,h=wt.jsxs;var so=Object.fromEntries(Object.entries(Ea).filter(([e,t])=>e!=="_meta"&&typeof t=="string"));function ro(e,t){return t?e.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(n,s)=>{let a=t[s];return a==null?n:String(a)}):e}function at(e,t,n){return ro(so[t]??t,n)}var Ca=ya({direction:"ltr",t:(e,t)=>at(void 0,e,t)});function Ra({localization:e,children:t}){let n=e?.direction==="rtl"?"rtl":"ltr",s=qt(()=>({direction:n,t:(a,o)=>at(e,a,o)}),[n,e]);return i(Ca.Provider,{value:s,children:i("div",{dir:n,style:{display:"contents"},children:t})})}function ee(){return wa(Ca)}var Ma=["prismite","thundrake","clockrit"],Ia=["wickwisp","cauldrop","webbit"],Aa=["rigamuffin","fluttino","lentino","shellbini","tortellump"];var Fe=["egg","hatchling","juvenile","adult","elder"],Na=["hatchling","juvenile","adult","elder"];var Rn=["feed","play","rest","pet"],Mn=["warm","talk","listen"],eu=[...Rn,...Mn],In=1800*1e3,Pa=70,Ta=35;var oo=["feed","fedBadly","overfed","forgot","play","cuddle","milestone","warmEgg","letCool","chatEgg","hatch","stageUp"],tu=[...oo,"checkInEgg","checkInContent","checkInHungry","checkInSad","hello","farewell"];var St=["halo","crown","star","flame","moon","leaf","gem","snowflake","cloud","bolt","feather","heart","mushroom","orb","bow","flower","shell"],Qt=["embers","snow","leaves","petals","stars","glints","wisps","sparks","bubbles"];var st={ember:{aura:"embers",extras:["flame","star","crown"],moves:["firepuff","roar"]},frost:{aura:"snow",extras:["snowflake","gem","moon"],moves:["icicles","twirl"]},moss:{aura:"leaves",extras:["leaf","mushroom","feather"],moves:["leafwhirl","wiggle"]},dusk:{aura:"stars",extras:["moon","star","orb"],moves:["starburst","float"]},gilded:{aura:"glints",extras:["crown","halo","gem"],moves:["coinshower","sparkle","shine"]},shade:{aura:"wisps",extras:["moon","orb","feather"],moves:["shockwave","vanish"]},bloom:{aura:"petals",extras:["flower","heart","bow"],moves:["petalshower","triplehop"]},storm:{aura:"sparks",extras:["bolt","cloud","orb"],moves:["zap","dash"]},tide:{aura:"bubbles",extras:["shell","gem","orb"],moves:["bubbleblow","splash"]}},_a=200,An=24;var jt={rigamuffin:{id:"rigamuffin",name:"Rigamuffin",origin:"rigatoni + ragamuffin",look:"scruffy little tube with ridges, always slightly grubby",defaultTraits:["ridged-hide","crumb-collector","sturdy","curious"]},fluttino:{id:"fluttino",name:"Fluttino",origin:"farfalle + flutter",look:"bow-shaped wings, hovers, never quite lands",defaultTraits:["hover-drift","bow-winged","breezy","restless"]},lentino:{id:"lentino",name:"Lentino",origin:"linguine / lentil + -ino",look:"long, thin, loops itself into knots when happy",defaultTraits:["knot-tier","slender","springy","affectionate"]},shellbini:{id:"shellbini",name:"Shellbini",origin:"conchiglie + shell",look:"shelled, hides inside when sulky",defaultTraits:["pocket-shell","peeker","shy-sweet","echo-hum"]},tortellump:{id:"tortellump",name:"Tortellump",origin:"tortellini + lump",look:"plump folded dumpling with a pinched dimple on top, rolls instead of walking",defaultTraits:["roly-poly","stuffed-snug","dimpled","homebody"]},mossaboo:{id:"mossaboo",name:"Mossaboo",origin:"moss + peekaboo",look:"round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",defaultTraits:["moss-backed","slow","patient","cosy"]},puddlepip:{id:"puddlepip",name:"Puddlepip",origin:"puddle + pip",look:"clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",defaultTraits:["raindrop-headed","splashy","happy","noisy"]},snufflump:{id:"snufflump",name:"Snufflump",origin:"snuffle + lump",look:"round ball of beige fluff with floppy ears, puffs up when startled",defaultTraits:["fluff-ball","sleepy","cuddly","nervous"]},burrowl:{id:"burrowl",name:"Burrowl",origin:"burrow + owl",look:"round brown owl with goggle eyes and big pink digging paws",defaultTraits:["big-pawed","busy","wise","messy"]},prismite:{id:"prismite",name:"Prismite",origin:"prism + -ite",look:"cluster of clear crystal spikes that splits light into rainbows",defaultTraits:["faceted","proud","sparkly","aloof"]},thundrake:{id:"thundrake",name:"Thundrake",origin:"thunder + drake",look:"little storm-cloud dragon with lightning horns and a rainy tail",defaultTraits:["spark-horned","stormy","bold","moody"]},clockrit:{id:"clockrit",name:"Clockrit",origin:"clock + critter",look:"brass wind-up critter with a clock-face belly and a pendulum tail",defaultTraits:["wind-up","punctual","fussy","kind"]},wickwisp:{id:"wickwisp",name:"Wickwisp",origin:"wick + will-o'-the-wisp",look:"stub of dripping candle wax with a little flame floating over its head",defaultTraits:["flame-crowned","flickery","timid","warm-hearted"]},cauldrop:{id:"cauldrop",name:"Cauldrop",origin:"cauldron + drop",look:"small iron cauldron on three legs, brim-full of bubbling purple potion",defaultTraits:["brim-bubbler","bubbly","mischievous","greedy"]},webbit:{id:"webbit",name:"Webbit",origin:"web + -bit",look:"fluffy cobweb spider whose round belly glows like a paper lantern",defaultTraits:["lantern-bellied","tidy","patient","clingy"]}},io={marinara:{id:"marinara",name:"Marinara",origin:"house sauce",readsAs:"freshly hatched, open-hearted, still finding its flavor",grownBy:"hatching and balanced early days",accentColor:"#e05246",badgeBg:"rgba(224, 82, 70, 0.16)"},zesto:{id:"zesto",name:"Zesto",origin:"pesto + zest",readsAs:"bright, bouncy, chatty",grownBy:"steady feeding and play, good bond",accentColor:"#48b868",badgeBg:"rgba(72, 184, 104, 0.16)"},carbonuzzle:{id:"carbonuzzle",name:"Carbonuzzle",origin:"carbonara + nuzzle",readsAs:"warm, clingy, golden",grownBy:"lots of cuddles and affection",accentColor:"#f0b449",badgeBg:"rgba(240, 180, 73, 0.18)"},rabbratty:{id:"rabbratty",name:"Rabbratty",origin:"arrabbiata + bratty",readsAs:"feisty, demanding, quick-tempered",grownBy:"erratic care, missed meals then spoiling",accentColor:"#f25c3b",badgeBg:"rgba(242, 92, 59, 0.18)"},seppy:{id:"seppy",name:"Seppy",origin:"seppia + sulky",readsAs:"gloomy, brooding, dramatic",grownBy:"neglect, long absences, low mood",accentColor:"#7882a4",badgeBg:"rgba(120, 130, 164, 0.2)"},alfredoze:{id:"alfredoze",name:"Alfredoze",origin:"alfredo + doze",readsAs:"mellow, sleepy, content",grownBy:"over-feeding, little play",accentColor:"#d9ceb8",badgeBg:"rgba(217, 206, 184, 0.2)"},truffoddity:{id:"truffoddity",name:"Truffoddity",origin:"truffle + oddity",readsAs:"strange, brilliant, unsettling",grownBy:"milestones noticed, no affection",accentColor:"#a978e8",badgeBg:"rgba(169, 120, 232, 0.18)"}};function lo(e,t){return Math.min(e,t)<42?"grumpy":e>=68&&t>=68?"happy":"content"}var Nn=["happy","content","grumpy","side"],Ye=1+(Fe.length-1)*Nn.length;function Te(e,t,n){let s=`sprites/${e}.webp`;return t==="egg"?n==="side"?null:{path:s,row:0}:{path:s,row:1+(Fe.indexOf(t)-1)*Nn.length+Nn.indexOf(n)}}var kt=6,co={thundrake:140,wickwisp:140,cauldrop:180,clockrit:1e3,webbit:220,prismite:180};function Oa(e){let t=co[e];return t?{path:`sprites/${e}-live.webp`,ms:t}:null}var Pn=["egg-found","hatch","caretaker-care","absence","stage-up","temperament-shift","farewell","return-from-album","check-in","evolve","evolve-offer","caretaker-change"];function xt(e){return`${/^[aeiou]/iu.test(e)?"an":"a"} ${e}`}function Ke(e){return e.design?{name:e.design.kind,look:e.design.look}:{name:jt[e.species].name,look:jt[e.species].look}}function uo(e){return!e.design&&Aa.includes(e.species)}function Le(e){if(uo(e)){let t=io[e.temperament];return{name:t.name,readsAs:t.readsAs,sauce:t}}return e.ownTemperament?{name:e.ownTemperament.name,readsAs:e.ownTemperament.readsAs,sauce:null}:null}function Fa(e){return[...Fe].reverse().map(t=>({stage:t,entries:e.filter(n=>(n.reachedElder?"elder":n.stageAtRetirement)===t)})).filter(t=>t.entries.length>0)}var La={rigamuffin:"a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",fluttino:"a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",lentino:"a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",shellbini:"a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",tortellump:"a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",mossaboo:"a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",puddlepip:"a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",snufflump:"a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",burrowl:"an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",prismite:"a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",thundrake:"a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",clockrit:"a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",wickwisp:"a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",cauldrop:"a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",webbit:"a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves"},$a="a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";function rt(e){return e.stage==="egg"?"sprites/scene-nest.webp":`sprites/scene-${e.species}.webp`}function Xe(e){return{stage:e.lockedStage??e.stage,mood:lo(e.meters.hunger,e.meters.mood)}}function Ua(e,t){let n=e.forms[t];return n?{kind:"form",formId:n}:e.design?.origin==="found"?{kind:"silhouette"}:{kind:"species"}}var Va={egg:32,hatchling:29,juvenile:37,adult:45,elder:46},Re=(e,t)=>({data:new Uint8ClampedArray(e*t*4),width:e,height:t}),Yt=(e,t,n,s)=>{let a=[0,0,0],o=0;for(let r=n;r<Math.min(n+s,e.height);r++)for(let l=t;l<Math.min(t+s,e.width);l++){let c=(r*e.width+l)*4;a[0]+=e.data[c],a[1]+=e.data[c+1],a[2]+=e.data[c+2],o++}return[Math.round(a[0]/o),Math.round(a[1]/o),Math.round(a[2]/o)]};function Ln(e,t=48){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s};if(n===0||s===0)return a;let o=4,r=[Yt(e,0,0,o),Yt(e,Math.max(0,n-o),0,o),Yt(e,0,Math.max(0,s-o),o),Yt(e,Math.max(0,n-o),Math.max(0,s-o),o)],l=(f,m)=>Math.max(Math.abs(f[0]-m[0]),Math.abs(f[1]-m[1]),Math.abs(f[2]-m[2]))<=t,c=r[0],g=0;for(let f of r){let m=r.filter(y=>l(f,y)).length;m>g&&(g=m,c=f)}let p=f=>{let m=f*4;return e.data[m+3]<16||l([e.data[m],e.data[m+1],e.data[m+2]],c)},d=new Uint8Array(n*s),u=new Int32Array(n*s),w=0,b=f=>{d[f]||!p(f)||(d[f]=1,u[w++]=f)};for(let f=0;f<n;f++)b(f),b((s-1)*n+f);for(let f=0;f<s;f++)b(f*n),b(f*n+n-1);for(;w>0;){let f=u[--w];a.data[f*4+3]=0;let m=f%n;m>0&&b(f-1),m<n-1&&b(f+1),f>=n&&b(f-n),f<n*(s-1)&&b(f+n)}return a}function Et(e,t=128){let n=e.width,s=e.height,a=-1,o=-1;for(let r=0;r<e.height;r++)for(let l=0;l<e.width;l++)e.data[(r*e.width+l)*4+3]<t||(l<n&&(n=l),l>a&&(a=l),r<s&&(s=r),r>o&&(o=r));return a<0?null:{x:n,y:s,width:a-n+1,height:o-s+1}}var Xt=(e,t,n,s,a,o)=>{let r=Re(s,s),l=Math.max(1,Math.round(t.width*n)),c=Math.max(1,Math.round(t.height*n)),g=o===void 0?Math.floor((s-l)/2):o-l,p=s-a-c,d=n<1;for(let u=0;u<c;u++)if(!(p+u<0||p+u>=s))for(let w=0;w<l;w++){if(g+w<0||g+w>=s)continue;let b=w*t.width/l,f=(w+1)*t.width/l,m=u*t.height/c,y=(u+1)*t.height/c,k=0,E=0,_=0,P=0,z=0,x=Math.floor(b),S=Math.floor(m),N=d?Math.ceil(f):x+1,L=d?Math.ceil(y):S+1;for(let M=S;M<Math.min(L,t.height);M++)for(let A=x;A<Math.min(N,t.width);A++){let C=d?(Math.min(A+1,f)-Math.max(A,b))*(Math.min(M+1,y)-Math.max(M,m)):1,T=((t.y+M)*e.width+t.x+A)*4,R=e.data[T+3];k+=C,E+=C*R,_+=C*R*e.data[T],P+=C*R*e.data[T+1],z+=C*R*e.data[T+2]}if(E<=0||E/k<128)continue;let D=((p+u)*s+g+w)*4;r.data[D]=Math.round(_/E),r.data[D+1]=Math.round(P/E),r.data[D+2]=Math.round(z/E),r.data[D+3]=255}return r};function go(e,t,n=52,s=2,a){let o=Et(e);return o?Xt(e,o,a??Math.min(t/o.height,(n-4)/o.width),n,s):Re(n,n)}function po(e,t){let n=Math.max(1,Math.floor(t)),s=Re(e.width*n,e.height*n);for(let a=0;a<s.height;a++)for(let o=0;o<s.width;o++){let r=(Math.floor(a/n)*e.width+Math.floor(o/n))*4;s.data.set(e.data.subarray(r,r+4),(a*s.width+o)*4)}return s}var Wa=e=>{let t=-1,n=-1;for(let s=0;s<e.height;s++)for(let a=0;a<e.width;a++)if(e.data[(s*e.width+a)*4+3]!==0){t<0&&(t=s),n=s;break}return t<0?null:{top:t,bottom:n}},Jt=(e,t,n,s)=>{let a=e.width*4;n.data.set(e.data.subarray(t*a,t*a+a),s*a)};function Qa(e){let t=1/0,n=[0,0,0];for(let s=0;s<e.data.length;s+=4){if(e.data[s+3]===0)continue;let a=e.data[s]+e.data[s+1]+e.data[s+2];a<t&&(t=a,n=[e.data[s],e.data[s+1],e.data[s+2]])}return n}function Ct(e,t){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s},o=(r,l)=>r>=0&&l>=0&&r<n&&l<s&&e.data[(l*n+r)*4+3]>0;for(let r=0;r<s;r++)for(let l=0;l<n;l++)!o(l,r)||o(l-1,r)&&o(l+1,r)&&o(l,r-1)&&o(l,r+1)||a.data.set([t[0],t[1],t[2]],(r*n+l)*4);return a}function ja(e){let t=Wa(e);if(!t)return 0;let n=Math.max(1,t.top+Math.floor((t.bottom-t.top)/2)),s=t.bottom-2,a=Math.min(n,t.bottom),o=1/0,r=e.width*4;for(let l=n;l<=s;l++){let c=0;for(let g=0;g<e.width;g++){let p=l*r+g*4,d=p-r;(e.data[p]!==e.data[d]||e.data[p+1]!==e.data[d+1]||e.data[p+2]!==e.data[d+2]||e.data[p+3]!==e.data[d+3])&&c++}c<=o&&(o=c,a=l)}return a}function Ya(e,t){let n=Re(e.width,e.height);for(let s=0;s<e.height;s++)s!==0&&(s<=t?Jt(e,s-1,n,s):Jt(e,s,n,s));return n}function mo(e,t){let n=Re(e.width,e.height);for(let s=0;s<e.height;s++)s<t-1?Jt(e,s+1,n,s):Jt(e,s,n,s);return n}function Ha(e,t){let n=Re(e.width,e.height),s=Wa(e);if(!s)return n;let a=s.bottom-s.top+1;for(let o=0;o<e.height;o++){let r=t*(o<s.top+a/3?2:o<s.top+2*a/3?1:0);for(let l=0;l<e.width;l++){let c=l+r;if(c<0||c>=e.width)continue;let g=(o*e.width+l)*4;n.data.set(e.data.subarray(g,g+4),(o*e.width+c)*4)}}return n}function Xa(e){let t=Qa(e),n=ja(e);return[e,Ct(Ya(e,n),t),Ct(mo(e,n),t)]}function Ja(e){let t=Qa(e);return[e,Ct(Ha(e,-1),t),Ct(Ha(e,1),t)]}function Rt(e,t=2){let n=e.reduce((o,r)=>o+r.width,0),s=Re(n,e[0]?.height??0),a=0;for(let o of e){for(let r=0;r<o.height;r++)s.data.set(o.data.subarray(r*o.width*4,(r+1)*o.width*4),(r*n+a)*4);a+=o.width}return po(s,t)}var fo=e=>{let{width:t,height:n}=e,s=new Uint8Array(t*n),a=(o,r)=>o>=0&&r>=0&&o<t&&r<n&&e.data[(r*t+o)*4+3]>=128?1:0;for(let o=0;o<n;o++)for(let r=0;r<t;r++){if(!a(r,o))continue;let l=0;for(let c=-1;c<=1;c++)for(let g=-1;g<=1;g++)(g||c)&&(l+=a(r+g,o+c));l>=2&&(s[o*t+r]=1)}return s};function $n(e,t=16){let n=e.map(fo),s=new Int32Array(4096),a=new Int32Array(4096),o=[];e.forEach((u,w)=>{for(let b=0;b<u.width*u.height;b++){if(!n[w][b])continue;let f=u.data[b*4],m=u.data[b*4+1],y=u.data[b*4+2],k=f>>4<<8|m>>4<<4|y>>4;s[k]++===0&&(a[k]=f<<16|m<<8|y,o.push(k))}});let r=o.map(u=>({c:[a[u]>>16,a[u]>>8&255,a[u]&255],w:Math.ceil(Math.sqrt(s[u]))})),l=u=>{let w=-1,b=0;for(let f=0;f<3;f++){let m=255,y=0;for(let k of u)m=Math.min(m,k.c[f]),y=Math.max(y,k.c[f]);y-m>w&&(w=y-m,b=f)}return{spread:w,channel:b}},c=r.length?[r]:[];for(;c.length<t;){let u=-1,w=0;if(c.forEach((_,P)=>{if(_.length<2)return;let{spread:z}=l(_);z>w&&(w=z,u=P)}),u<0)break;let b=c[u],{channel:f}=l(b),m=[...b].sort((_,P)=>_.c[f]-P.c[f]),y=m.reduce((_,P)=>_+P.w,0)/2,k=0,E=1;for(let _=0;_<m.length-1&&(k+=m[_].w,E=_+1,!(k>=y));_++);c.splice(u,1,m.slice(0,E),m.slice(E))}let g=c.map(u=>{let w=u.reduce((b,f)=>b+f.w,0);return[0,1,2].map(b=>Math.round(u.reduce((f,m)=>f+m.w*m.c[b],0)/w))}),p=g[0]??[0,0,0];for(let u of g)u[0]+u[1]+u[2]<p[0]+p[1]+p[2]&&(p=u);let d=new Map;return e.map((u,w)=>{let b=Re(u.width,u.height);for(let f=0;f<u.width*u.height;f++){if(!n[w][f])continue;let m=u.data[f*4],y=u.data[f*4+1],k=u.data[f*4+2],E=m<<16|y<<8|k,_=d.get(E);if(_===void 0){let P=1/0;_=0,g.forEach((z,x)=>{let S=(z[0]-m)**2+(z[1]-y)**2+(z[2]-k)**2;S<P&&(P=S,_=x)}),d.set(E,_)}b.data.set([...g[_],255],f*4)}return Ct(b,p)})}var Tn=(e,t,n)=>{let s=[],a=-1,o=-1;for(let r=0;r<e.length;r++)e[r]&&(a>=0&&r-o>t&&(s.push([a,o+1]),a=-1),a<0&&(a=r),o=r);return a>=0&&s.push([a,o+1]),s.filter(([r,l])=>l-r>=n)},Za=e=>e.map(t=>t==="egg"?2:4);function Zt(e,t,n=!0,s=!1){let a=Ln(e),{width:o,height:r}=a,l=new Uint8Array(o*r);for(let x=0;x<l.length;x++)l[x]=a.data[x*4+3]>=128?1:0;let c=Math.max(o,r)/1024,g=Math.round(10*c),p=Math.round(16*c),d=[],u=(x,S,N,L)=>{let D=new Int32Array(r);for(let M=N;M<L;M++)for(let A=x;A<S;A++)D[M]+=l[M*o+A];return D},w=(x,S,N,L)=>{let D=new Int32Array(o);for(let M=N;M<L;M++)for(let A=x;A<S;A++)D[A]+=l[M*o+A];return D},b=(x,S,N)=>{let L=S;for(let D=S;D<N;D++)x[D]<x[L]&&(L=D);return L},f=(x,S,N)=>{let L=x.r-x.l,D=x.b-x.t,M=new Int32Array(L*D).fill(-1),A=[],C=(v,I)=>l[(x.t+I)*o+x.l+v]===1;for(let v=0;v<L*D;v++){if(M[v]!==-1||!C(v%L,Math.floor(v/L)))continue;let I={size:0,l:L,t:D,r:0,b:0};M[v]=A.length;let U=[v];for(;U.length;){let $=U.pop(),q=$%L,W=($-q)/L;I.size++,I.l=Math.min(I.l,q),I.r=Math.max(I.r,q+1),I.t=Math.min(I.t,W),I.b=Math.max(I.b,W+1);for(let[H,J]of[[q-1,W],[q+1,W],[q,W-1],[q,W+1]]){let te=J*L+H;H>=0&&J>=0&&H<L&&J<D&&M[te]===-1&&C(H,J)&&(M[te]=A.length,U.push(te))}}A.push(I)}let T=Math.max(...A.map(v=>v.size)),R=A.map(v=>v.size!==T&&(x.l+v.l===S||x.l+v.r===N));for(let v=0;v<L*D;v++)M[v]>=0&&R[M[v]]&&(a.data[((x.t+Math.floor(v/L))*o+x.l+v%L)*4+3]=0);let B=A.filter((v,I)=>!R[I]);return{l:x.l+Math.min(...B.map(v=>v.l)),t:x.t+Math.min(...B.map(v=>v.t)),r:x.l+Math.max(...B.map(v=>v.r)),b:x.t+Math.max(...B.map(v=>v.b))}},m=u(0,o,0,r),y=Tn(m,g,p);if(!y.length)return null;let k=()=>y.map(([x,S])=>S-x).sort((x,S)=>x-S)[Math.floor(y.length/2)],E=.3*k();for(y=y.filter(([x,S])=>S-x>=E),s&&(y=y.slice(0,t.length));y.length<t.length;){let x=0;y.forEach(([A,C],T)=>{C-A>y[x][1]-y[x][0]&&(x=T)});let[S,N]=y[x];if(N-S<1.4*k())return null;let L=S+Math.floor(.3*(N-S)),D=S+Math.floor(.7*(N-S));if(D<=L)return null;let M=b(m,L,D);if(M<=S)return null;y.splice(x,1,[S,M],[M,N])}if(y.length!==t.length)return null;let _=[];for(let x=0;x<y.length;x++){let[S,N]=y[x],L=t[x],D=w(0,o,S,N),M=Tn(D,g,p);if(!M.length)return null;let A=M.map(([v,I])=>{let U=u(v,I,S,N),$=S;for(;!U[$];)$++;let q=N-1;for(;!U[q];)q--;return{h:q-$+1,w:I-v}}),C=Math.max(...A.map(v=>v.h)),T=Math.max(...A.map(v=>v.w));if(M=M.filter((v,I)=>A[I].h>=.6*C||A[I].w>=.6*T),M.length>2*L)return null;let R=!1;if(M.length>L)d.push(`row ${x+1}: ${M.length} drawings, first ${L} used`),M=M.slice(0,L);else if(M.length<L){if(!n)return null;let v=M[0][0],I=M[M.length-1][1],U=(I-v)/L;if(!M.some(([q,W])=>W-q>1.5*U))return null;let $=[v];for(let q=1;q<L;q++)$.push(b(D,Math.floor(v+(q-.15)*U),Math.floor(v+(q+.15)*U)));$.push(I),M=$.slice(0,-1).map((q,W)=>[q,$[W+1]]),R=!0,d.push(`row ${x+1}: drawings touch, split at ${$.slice(1,-1).join(", ")}`)}let B=[];for(let[v,I]of M){let U=(W,H)=>{let J=u(v,I,W,H),te=w(v,I,W,H),se=W;for(;se<H&&!J[se];)se++;if(se===H)return null;let oe=H-1;for(;!J[oe];)oe--;let ye=v;for(;!te[ye];)ye++;let be=I-1;for(;!te[be];)be--;return{l:ye,t:se,r:be+1,b:oe+1,rows:J}},$=U(S,N);if(!$)return null;let q=Tn($.rows.subarray(0,$.b),1,1).filter(([,W])=>W>$.t);if(q.length>1){let[W,H]=q[q.length-1],J=w(v,I,W,H),te=v;for(;!J[te];)te++;let se=I-1;for(;!J[se];)se--;let oe=se-te+1;H-W<=.12*($.b-$.t)&&oe>=4*(H-W)&&oe>=.4*($.r-$.l)&&($=U(S,q[q.length-2][1])??$)}if(R){let W=v===M[0][0]?-1:v,H=I===M[M.length-1][1]?-1:I;$={...$,...f($,W,H)}}B.push({x:$.l,y:$.t,width:$.r-$.l,height:$.b-$.t})}_.push(B)}let P=t.length===5?0:-1;if(P===0&&_[0].length>1){let[x,S]=[_[0][0].height,_[0][1].height];Math.abs(x-S)>.25*Math.max(x,S)&&d.push(`egg row sizes differ: ${x} vs ${S}`)}let z=x=>x[x.length>=4?1:0];for(let x=P+2;x<_.length;x++){let[S,N]=[z(_[x]).height,z(_[x-1]).height];S<N*.95&&d.push(`row ${x+1} (${S}) smaller than row ${x} (${N})`)}for(let x=P+1;x<_.length;x++){let S=_[x];if(S.length<2)continue;let[N,L]=[z(S).height,S[S.length-1].height];Math.abs(N-L)>.3*Math.max(N,L)&&d.push(`row ${x+1}: front ${N} vs side ${L}`)}return{cells:_,notes:d,keyed:a}}function es(e,t,n){let s=t.keyed??Ln(e),a=t.cells.map((c,g)=>{let p=n[g];if(!p)return[];let d=Math.min(Va[p]/Math.max(...c.map(u=>u.height)),48/Math.max(...c.map(u=>u.width)));return c.map(u=>Xt(s,u,d,52,2))}),o=$n(a.flat()),r={},l=0;return a.forEach((c,g)=>{let p=o.slice(l,l+c.length);l+=c.length;let d=n[g];if(!d||!p.length)return;let u=w=>Rt(d==="egg"?Ja(p[w]):Xa(p[w]));d==="egg"?r[d]={image:u(0)}:p.length>=4?r[d]={image:u(1),happy:u(0),grumpy:u(2),side:u(3)}:r[d]=p.length>1?{image:u(0),side:u(1)}:{image:u(0)}}),r}var _e=96,Je=[5,3],ho=80,bo=48;function yo(e){let t=[[[...Je],!1],[[4,4],!1],[[...Je],!0]];for(let[s,a]of t){let o=Zt(e,s,a),r=o?.cells.flat();if(o&&r)return{front:r.slice(0,Je[0]),facing:r.slice(Je[0]),keyed:o.keyed}}let n=Zt(e,[3],!1,!0);return n?{front:n.cells[0],facing:[],keyed:n.keyed}:null}function ts(e){let t=yo(e);if(!t)return null;let{front:n,facing:s,keyed:a}=t,o=Math.max(...n.map(d=>d.width)),r=Math.max(...s.map(d=>d.width))-o/2,l=Math.min(ho/Math.max(...[...n,...s].map(d=>d.height)),bo/o,r>0?(_e/2-2)/r:1/0),c=Math.max(1,Math.round(o*l)),g=Math.floor((_e-c)/2)+c,p=$n([...n.map(d=>Xt(a,d,l,_e,0)),...s.map(d=>Xt(a,d,l,_e,0,g))]);return p.every(d=>Et(d))?Rt(p,1):null}var en=(e,t)=>{let n=e.height,s=Re(n,n);for(let a=0;a<n;a++){let o=(a*e.width+t*n)*4;s.data.set(e.data.subarray(o,o+n*4),a*n*4)}return s},Da=[.12,.42],vo=50,wo=45,za=50,So=.04,ot=e=>e>>16,it=e=>e>>8&255,lt=e=>e&255,qe=e=>.299*ot(e)+.587*it(e)+.114*lt(e),Ba=e=>Math.max(ot(e),it(e),lt(e))-Math.min(ot(e),it(e),lt(e)),_n=(e,t)=>Math.hypot(ot(e)-ot(t),it(e)-it(t),lt(e)-lt(t)),On=e=>e.reduce((t,n)=>qe(n)<qe(t)?n:t);function ko(e){let t=Et(e);if(!t)return null;let{width:n,height:s,data:a}=e,o=new Int32Array(n*s).fill(-1);for(let g=0;g<n*s;g++)a[g*4+3]>=128&&(o[g]=a[g*4]<<16|a[g*4+1]<<8|a[g*4+2]);let r=t.y+Math.round(t.height*Da[0]),l=t.y+Math.round(t.height*Da[1]),c=new Map;for(let g=r*n;g<l*n;g++){let p=o[g];p>=0&&c.set(p,(c.get(p)??0)+1)}return{colours:o,width:n,z0:r,z1:l,counts:c}}var Fn=(e,t)=>{let n=e.map(a=>a%t),s=e.map(a=>Math.floor(a/t));return{x0:Math.min(...n),x1:Math.max(...n),y0:Math.min(...s),y1:Math.max(...s)}};function ns(e,t,n){let{colours:s,width:a,z0:o,z1:r}=e,l=n?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]],c=new Uint8Array(s.length),g=[];for(let p=o*a;p<r*a;p++){if(c[p]||s[p]<0||!t(s[p]))continue;c[p]=1;let d=[p],u=[],w=!1;for(;d.length;){let b=d.pop();u.push(b);for(let[f,m]of l){let y=b%a+f,k=Math.floor(b/a)+m,E=k*a+y;y<0||y>=a||k<o||k>=r||s[E]<0?w=!0:!c[E]&&t(s[E])&&(c[E]=1,d.push(E))}}g.push({pixels:u,open:w})}return g}var as=(e,t)=>e.x1-e.x0<10&&e.y1-e.y0<8&&e.y1-e.y0+1>=t;function xo(e){return[...e.counts].filter(([,n])=>n>=30).sort((n,s)=>s[1]-n[1]).slice(0,4).map(([n])=>n).flatMap(n=>ns(e,s=>_n(s,n)>vo,!1).flatMap(({pixels:s,open:a})=>{let o=Fn(s,e.width),r=s.map(c=>e.colours[c]);if(a||s.length<2||s.length>40||!as(o,2))return[];if(Math.max(...r.map(c=>_n(c,n)))<90)return[];let l=On(r);return[{pixels:s,...o,fill:n,lid:qe(n)>qe(l)+40?l:null}]}))}function Eo(e){let t=[...e.counts.values()].reduce((l,c)=>l+c,0),n=[...e.counts].filter(([,l])=>l>=t*So).map(([l])=>l);if(!n.length)return[];let s=l=>l>=0&&n.every(c=>_n(l,c)>wo),a=On(n),{width:o,colours:r}=e;return ns(e,l=>Ba(l)>=za&&s(l),!0).flatMap(({pixels:l})=>{if(l.length<2||l.length>36)return[];let c=Fn(l,o),g=new Set(l),p=[...l];for(;p.length;){let f=p.pop();for(let m of[1,-1,o,-o,o+1,o-1,1-o,-1-o]){let y=f+m,k=y%o,E=Math.floor(y/o);g.has(y)||k<c.x0-1||k>c.x1+1||E<c.y0-1||E>c.y1+1||E<e.z0||E>=e.z1||!s(r[y])||(g.add(y),p.push(y))}}let d=[...g],u=Fn(d,o);if(!as(u,1))return[];let w=new Map;for(let f of d){let m=f+o;for(;g.has(m);)m+=o;let y=r[m]??-1;y>=0&&w.set(y,(w.get(y)??0)+1)}let b=[...w].sort((f,m)=>m[1]-f[1])[0]?.[0];return b===void 0||Ba(b)>=za&&!n.includes(b)?[]:Math.abs(qe(b)-qe(On(d.map(f=>r[f]))))<60?[]:[{pixels:d,...u,fill:b,lid:qe(b)>qe(a)+60?a:null}]})}function Ga(e){let t=null;for(let n of e)for(let s of e){let a=s.x0-n.x1-1,o=Math.abs(n.y0+n.y1-s.y0-s.y1)/2,r=Math.max(n.pixels.length,s.pixels.length)/Math.min(n.pixels.length,s.pixels.length);if(a<2||a>20||o>1.5||r>2.5||Math.abs(n.y1-n.y0-(s.y1-s.y0))>2)continue;let l=n.pixels.length+s.pixels.length-o*4-r*3;(!t||l>t.score)&&(t={pair:[n,s],score:l})}return t?.pair??null}function Ka(e){let t=ko(e);return t?Ga(xo(t))??Ga(Eo(t)):null}var Co=(e,t)=>e.every((n,s)=>Math.abs(n.y0+n.y1-t[s].y0-t[s].y1)<=4&&Math.abs(n.x1-n.x0-(t[s].x1-t[s].x0))<=2)&&Math.abs(e[1].x0-e[0].x1-(t[1].x0-t[0].x1))<=2;function Ro(e){let t=e.height,n=Math.floor(e.width/t),s=n===Je[0]+Je[1]?Je[0]:Math.min(n,3),a=n?Ka(en(e,0)):null;if(!a)return null;let o=Array.from({length:n},(r,l)=>{let c=Re(t,t),g=l<s?Ka(en(e,l)):null;if(!g||!Co(g,a))return c;let p=(d,u)=>c.data.set([ot(u),it(u),lt(u),255],d*4);for(let d of g){for(let w of d.pixels)p(w,d.fill);if(d.lid===null)continue;let u=d.y0+Math.floor((d.y1-d.y0+1)*.6);for(let w=d.x0;w<=d.x1;w++)p(u*t+w,d.lid)}return c});return Rt(o,1)}var qa=(e,t)=>{let n=Re(e.width,e.height+t.height);return n.data.set(e.data),n.data.set(t.data,e.data.length),n};function ss(e){let t=Math.floor(e.width/e.height),n=Array.from({length:t},(o,r)=>ja(en(e,r))),s=o=>Rt(n.map((r,l)=>Ya(en(o,l),r)),1),a=Ro(e);return{body:qa(e,s(e)),blink:a?qa(a,s(a)):null}}function rs(e,t){let n=Ln(e);if(!Et(n))return null;let s=$n([go(n,Va[t])])[0];return Et(s)?Rt(t==="egg"?Ja(s):Xa(s)):null}var os=104,ct=416,is="#ececec",Mo=512,ls=1024,Io=512;function $e(e){return new Promise((t,n)=>{let s=new Image;s.onload=()=>t(s),s.onerror=()=>n(new Error("That file is not a picture this browser can open.")),s.src=e})}function tn(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d");if(!s)throw new Error("This browser cannot draw pictures.");return{canvas:n,context:s}}function Ve(e){let{canvas:t,context:n}=tn(e.width,e.height);return n.putImageData(new ImageData(new Uint8ClampedArray(e.data),e.width,e.height),0,0),t.toDataURL("image/png")}async function nn(e,t){let n=await $e(e),s=Math.min(1,t/Math.max(n.naturalWidth,n.naturalHeight)),a=Math.max(1,Math.round(n.naturalWidth*s)),o=Math.max(1,Math.round(n.naturalHeight*s)),r=tn(a,o);return r.context.drawImage(n,0,0,a,o),r.context.getImageData(0,0,a,o)}async function cs(e,t){let n=rs(await nn(e,Mo),t);return n?Ve(n):null}async function us(e,t){let n=await nn(e,ls),s=Zt(n,Za(t));if(!s)return null;let a={};for(let[o,r]of Object.entries(es(n,s,t)))a[o]={image:Ve(r.image),...r.side?{side:Ve(r.side)}:{},...r.happy?{happy:Ve(r.happy)}:{},...r.grumpy?{grumpy:Ve(r.grumpy)}:{}};return a}async function gs(e){let t=ts(await nn(e,ls));return t?{image:Ve(t),frames:t.width/t.height}:null}async function ds(e){let{body:t,blink:n}=ss(await nn(e,1/0));return{body:Ve(t),blink:n?Ve(n):null}}async function ps(e){let t=await $e(e),n=Math.min(1,Io/Math.max(t.naturalWidth,t.naturalHeight)),s=Math.max(1,Math.round(t.naturalWidth*n)),a=Math.max(1,Math.round(t.naturalHeight*n)),{canvas:o,context:r}=tn(s,a);return r.fillStyle=is,r.fillRect(0,0,s,a),r.drawImage(t,0,0,s,a),o.toDataURL("image/jpeg",.9)}async function Ze(e,t=0){let n=await $e(e),s=Math.min(n.naturalHeight,os),{canvas:a,context:o}=tn(ct,ct);return o.fillStyle=is,o.fillRect(0,0,ct,ct),o.imageSmoothingEnabled=!1,o.drawImage(n,0,t*os,s,s,0,0,ct,ct),a.toDataURL("image/png")}var an={feed:"\u{1F35D}",play:"\u{1F3B2}",rest:"\u{1F319}",pet:"\u{1F49B}",warm:"\u{1F9E3}",talk:"\u{1F4AC}",listen:"\u{1F442}"},sn={feed:"saucelings.action.feed",play:"saucelings.action.play",rest:"saucelings.action.rest",pet:"saucelings.action.pet",warm:"saucelings.action.warm",talk:"saucelings.action.talk",listen:"saucelings.action.listen"};function rn(e){return e.stage==="egg"?Mn:Rn}function on(e,t){return e==="feed"&&t.hunger||e==="play"&&t.mood||e==="warm"&&t.warmth}function ln(e){let[t,n]=G(()=>Date.now());return X(()=>{let s=window.setInterval(()=>n(Date.now()),e);return()=>window.clearInterval(s)},[e]),[t,ge(()=>n(Date.now()),[])]}function Mt(e){let[t,n]=G(null),s=j(void 0);X(()=>()=>window.clearTimeout(s.current),[]);let a=ge(o=>{window.clearTimeout(s.current),n(o),s.current=window.setTimeout(()=>n(null),e)},[e]);return[t,a]}var cn=2e3;function un(e,t,n){let s=e.actionCooldowns[t],a=s?Date.parse(s)-n:0;return a>0?Math.ceil(a/6e4):0}function It(e){return e.meters.warmth??Pa}function At(e,t){let n=t-Date.parse(e.createdAt);return Math.max(0,Math.min(100,Math.floor(n/In*100)))}function ms(e){return e?.stage!=="egg"||e.careActionCount<1?null:Date.parse(e.createdAt)+In}function Ao(e){let t=e;if(typeof t=="string")try{t=JSON.parse(t)}catch{return""}let n=t?.extensions,s=n?.imageAppearanceEnabled===!0?n.imageAppearance:null,a=typeof s=="string"&&s.trim()?s:n?.appearance;return typeof a=="string"?a:""}function Un(e){return{queryKey:["saucelings","caretaker-card",e],queryFn:async()=>{let t=await Se(`/api/characters/${encodeURIComponent(e)}`);return{avatar:typeof t.avatarPath=="string"&&/^\/(?![/\\])/u.test(t.avatarPath)?t.avatarPath:null,appearance:Ao(t.data)}},staleTime:5*6e4,retry:!1}}function ut(e,t){return ie({...Un(e),enabled:t}).data?.avatar??null}function gt(e){let t=ie({queryKey:["saucelings","figure",e],queryFn:()=>V(`/figure/${encodeURIComponent(e??"")}`),enabled:!!e,staleTime:1/0,retry:!1});return!e||t.isError?null:t.data?t.data.image?t.data:null:void 0}function gn(e,t){let n=t?.image;return ie({queryKey:["saucelings","figure-motion",e],queryFn:()=>ds(n??""),enabled:!!(e&&n),staleTime:1/0,retry:!1}).data??null}function fs(e){let[t,n]=G(null),[s,a]=G(!1);return Be(()=>{let o=t?.closest(".sl-shell")??t;if(!o||typeof ResizeObserver>"u")return;let r=()=>a(o.clientWidth>=e*parseFloat(getComputedStyle(document.documentElement).fontSize));r();let l=new ResizeObserver(r);return l.observe(o),()=>l.disconnect()},[t,e]),[n,s]}var No=[];function dn(e,t){let n=ie({queryKey:["saucelings","caretaker-sprites",e],queryFn:async()=>{let s=await Se(`/api/sprites/${encodeURIComponent(e)}`);return(Array.isArray(s)?s:[]).flatMap(a=>{let o=a;return typeof o.expression=="string"&&typeof o.url=="string"&&/^\/api\/sprites\//u.test(o.url)?[{expression:o.expression,url:o.url}]:[]})},enabled:t,staleTime:3e5,retry:!1});return t&&n.data||No}function dt({name:e,src:t,small:n,box:s}){let a=s?"sl-avatar sl-avatar--box":n?"sl-avatar sl-avatar--small":"sl-avatar";return t?i("img",{className:a,src:t,alt:""}):i("span",{className:a,"aria-hidden":"true",children:e.trim().charAt(0).toUpperCase()||"?"})}var Po=["calm","happy","worried","talking","waving","feeding","playing","tending"],To={worried:["worried","concerned","sad","anxious"],happy:["happy","smile","laugh","joy"],neutral:["neutral","idle","default","calm"]},_o=/^full[_-]/iu;function Oo(e,t){for(let n of t==="neutral"?["neutral"]:[t,"neutral"])for(let s of To[n]){let a=e.find(o=>o.expression.toLowerCase().includes(s));if(a)return a.url}return null}function Hn(e,t){let n=e.filter(a=>!_o.test(a.expression)),s=n.length>0?n:e;return Oo(s,t)??s[0]?.url??null}var Fo={feed:"feeding",play:"playing",rest:"tending",pet:"tending",warm:"tending",talk:"talking"};function pn({gaps:e,line:t,speaking:n,cheering:s,caring:a}){let o=a&&Fo[a];return o||(n&&(t?.kind==="caretaker-change"||t?.kind==="return-from-album")?"waving":s?"happy":n?"talking":e.hunger||e.mood||e.warmth||t?.kind==="absence"?"worried":"calm")}function mn(e,t,n,s=null){if(e)return{figure:s?.body??e.image,rows:s?2:1,frames:e.frames,frame:Lo(n,e.frames),blink:s?.blink??null};let a=e===null?Hn(t,hs(n)):null;return a?{src:a}:null}function hs(e){return e==="worried"?"worried":e==="calm"||e==="talking"?"neutral":"happy"}function Lo(e,t){let n=Po.indexOf(e);return n<t?n:["neutral","happy","worried"].indexOf(hs(e))}var $o={"fed-fine":"feed","fed-badly":"feed",overfed:"feed",played:"play",cuddled:"pet","kept-warm":"warm",chatted:"talk"};function bs(e){return(e&&$o[e])??null}var Uo={rigamuffin:"a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",fluttino:"a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",lentino:"a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",shellbini:"a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",tortellump:"a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",mossaboo:"a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",puddlepip:"a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",snufflump:"a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",burrowl:"a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",prismite:"a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",thundrake:"a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",clockrit:"a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",wickwisp:"a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",cauldrop:"a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",webbit:"a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black"},fn="Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.",vs="Simple, bold, readable face with small eyes and a small mouth.",Dn="Plain flat white background.",pt="text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering",Ho=`${pt}, human, person, cropped`,ws=e=>e.trim()?`${pt}, cropped`:Ho,Ss=`${pt}, shadow, ground, floor, scenery, multiple creatures, human, person`,Do=`${Ss}, face, eyes, mouth, nest`,ks=`${pt}, shadow, ground, scenery, overlapping drawings, human, person`,xs=`${pt}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`,Es=`${pt}, characters, people, person, creatures, animals, pets`,Cs=e=>e==="egg"?Do:Ss,zo="Same creature as the reference image: keep its shape, colours and markings.";function Rs(e,t,n=""){let s=Le(e),a=n.replace(/\s+/gu," ").trim(),o=e.lockedStage??e.stage,r=e.design,l=r?`${xt(r.kind)}: ${(r.stages[o]??r.look).replace(/[.\s]+$/u,"")}; its colours are ${r.colours.join(", ")}`:Uo[e.species],c=r?"":o==="elder"?", wearing little round spectacles and a few white whiskers":o==="hatchling"?", small and round":"";return[fn,`A little virtual pet creature: ${l}.`,`${s?`Its face and pose look ${s.readsAs}. `:""}Life stage: ${o}${c}.`,t?zo:"",vs,...a?[`Full body. ${a.charAt(0).toUpperCase()}${a.slice(1)}${/[.!?]$/u.test(a)?"":"."}`]:["One single creature, full body, centred.",Dn]].filter(Boolean).join(" ")}var Bo=400;function Ms(e,t,n,s){let a=t.replace(/\s+/gu," ").trim().slice(0,Bo).replace(/[.\s]+$/u,"");return[fn,...s,"Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",a?`What ${e} looks like: ${a}.`:"",n>0?`Keep ${e}'s hair, face, outfit and colours from the reference image${n>1?"s":""}.`:"",Dn].filter(Boolean).join(" ")}function ys(e,t,n){return Ms(e,t,n,[`Eight drawings of the same character, ${e}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,"The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.","The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands."])}function Go(e,t,n){return Ms(e,t,n,[`Three drawings of the same character, ${e}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`])}function Is(e,t,n,s){let a=[{prompt:ys(e,t,n.length),references:n}];return n.length>0&&a.push({prompt:ys(e,t,0),references:[]}),s&&a.push({prompt:Go(e,t,0),references:[]}),a}var As={earlier:"Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",before:"The reference image shows what this creature was before it evolved: keep a hint of its colours."};function Ns(e,t,n){let s=(e.stages[t]??e.look).replace(/[.\s]+$/u,"");return[fn,t==="egg"?`The egg of a small creature, ${xt(e.kind)}: ${s}.`:`A small creature, ${xt(e.kind)}, at its ${t} stage: ${s}.`,`Its colours are ${e.colours.join(", ")}.`,n?As[n]:"",t==="egg"?"One single egg with no face, upright and centred, filling most of the picture.":`${vs} One single creature, full body, seen from the front and centred, filling most of the picture.`,Dn].filter(Boolean).join(" ")}function zn(e){return Fe.filter(t=>e.stages[t])}var Ko="The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.",qo="Plain flat white background everywhere.";function Ps(e,t){let n=zn(e),s=c=>(e.stages[c]??e.look).replace(/[.\s]+$/u,""),a=n[0]==="egg",o=n.reduce((c,g)=>c+(g==="egg"?2:4),0),r=n.map((c,g)=>c==="egg"?`Row ${g+1}, the egg, only two drawings. Left: the whole egg, ${s(c)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`:`Row ${g+1}, ${c}, four drawings: ${s(c)}.`),l="and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";return[`${fn} A sprite sheet of one small creature, ${xt(e.kind)}: ${e.look} Its colours are ${e.colours.join(", ")}.${t?` ${As[t]}`:""}`,"",a?`Lay out ${o} drawings in ${n.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${n.length}, ${l}`:`Lay out ${o} drawings in ${n.length} rows: exactly four drawings in each row, ${l}`,...r,"",`${a?`In rows 2 to ${n.length}`:"In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${a?"Growth must read clearly: the hatchling is small and round and the elder is full size.":"The elder is as big as the adult and looks older."}`,"",Ko,"",qo].join(`
`)}function Bn(e){if(e.stage==="egg")return $a;if(!e.design)return La[e.species];let[t,n,s]=e.design.colours;return`a cosy little room in ${t}, ${n} and ${s} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`}var Vo="Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";function Ts(e){return`${Vo} A wide side-on scene of ${e.trim().replace(/[.\s]+$/u,"")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`}var hn=globalThis.__MARINARA_HOST__,fe=hn&&hn.version===1&&hn.modules?hn.modules["react-dom"]:void 0;if(!fe)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var vu=fe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,wu=fe.browser,_s=fe.createPortal,Su=fe.default,ku=fe.flushSync,xu=fe.preconnect,Eu=fe.prefetchDNS,Cu=fe.preinit,Ru=fe.preinitModule,Mu=fe.preload,Iu=fe.preloadModule,Au=fe.requestFormReset,Nu=fe.unstable_batchedUpdates,Pu=fe.useFormState,Tu=fe.useFormStatus,_u=fe.version;function Me({text:e,label:t,children:n}){let[s,a]=G(null),[o,r]=G(null),l=j(null),c=j(null),g=Sa();Be(()=>{let u=l.current?.getBoundingClientRect(),w=c.current?.getBoundingClientRect();if(!s||!u||!w){r(null);return}let b=8,f=u.top-6-w.height;r({top:f>=b?f:u.bottom+6,left:Math.max(b,Math.min(u.left+u.width/2-w.width/2,window.innerWidth-b-w.width))})},[s]),X(()=>{if(!s)return;let u=b=>{let f=b.target;!l.current?.contains(f)&&!c.current?.contains(f)&&a(null)},w=b=>b.key==="Escape"&&a(null);return document.addEventListener("pointerdown",u),document.addEventListener("keydown",w),()=>{document.removeEventListener("pointerdown",u),document.removeEventListener("keydown",w)}},[s]);let p=()=>a(u=>u??"shown"),d=()=>a(u=>u==="shown"?null:u);return h("span",{className:"sl-with-help",children:[n,i("button",{ref:l,type:"button",className:"sl-help","aria-label":t,"aria-expanded":s!==null,"aria-describedby":s?g:void 0,onMouseEnter:p,onMouseLeave:d,onFocus:p,onBlur:d,onKeyDown:u=>{u.key!=="Escape"||!s||(u.preventDefault(),u.stopPropagation(),a(null))},onClick:()=>a(u=>u==="pinned"?null:"pinned"),children:h("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:[i("circle",{cx:"12",cy:"12",r:"10"}),i("path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}),i("path",{d:"M12 17h.01"})]})}),s?_s(i("div",{ref:c,id:g,role:"tooltip",className:"sl-help-tip",style:o?{top:o.top,left:o.left}:{top:0,left:0,visibility:"hidden"},children:e}),document.body):null]})}var ae=52,He=100,Os=[4,6,8,10,12,14,16,19,22],Vn={hatchling:{t:21,l:12,r:39,m:30},juvenile:{t:13,l:9,r:42,m:25},adult:{t:5,l:7,r:44,m:19},elder:{t:4,l:7,r:44,m:19}},Wn={embers:"rise",wisps:"rise",bubbles:"rise",snow:"fall",leaves:"fall",petals:"fall",stars:"twinkle",glints:"twinkle",sparks:"twinkle"},bn={ember:["#2a0f0a","#8a2a12","#d9581e","#ff9a3c","#ffe08a"],frost:["#0f1a33","#2c5a9a","#5fa0e0","#a8dcff","#f2fbff"],moss:["#10220f","#2f5e1e","#5c9a2e","#9fd35a","#e4f7a8"],dusk:["#170f2e","#46287a","#7d4fc4","#b58cff","#ecdcff"],gilded:["#2a1a05","#7a5410","#c99a1e","#ffd84a","#fff6c2"],shade:["#0e0c14","#2e2a3c","#575070","#8f86ad","#cfc8e6"],bloom:["#2e0f1e","#8a3060","#d9609a","#ff9fcb","#ffe6f2"],storm:["#12141f","#2e3550","#56607f","#8d96b5","#d6dcef"],tide:["#08202a","#145a6a","#2a9a9a","#6ad8c8","#d8fff4"],spark:["#2a1f05","#8a6a10","#e0c020","#fff050","#ffffe0"]},Ds=["#1c1917","#57534e","#a8a29e","#e7e5e4","#fafaf9"],Wo={ember:"#ff7a3d",frost:"#8fd8ff",moss:"#7fd35a",dusk:"#b58cff",gilded:"#ffd84a",shade:"#a99cc8",bloom:"#ff9fcb",storm:"#f5ec5a",tide:"#5fe0d0"};var zs={"webbit:elder":[42,33]};function _t(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d",{willReadFrequently:!0});if(!s)throw new Error("No 2D canvas.");return s.imageSmoothingEnabled=!1,[n,s]}var Qn=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),Fs=new WeakMap;function jn(e,t,n){let s=Fs.get(e);s||Fs.set(e,s=new Map);let a=s.get(t);return a||s.set(t,a=n()),a}function Qo(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function Gn(e,t,n=0){return jn(e,`t|${t}|${n}`,()=>{let s=(t==="neutral"?Ds:bn[t]).map(Qn),[a,o]=_t(e.width,e.height);o.drawImage(e,0,0);let r=o.getImageData(0,0,a.width,a.height),l=r.data;for(let c=0;c<l.length;c+=4){if(!l[c+3])continue;let g=Math.min(1,(.2126*l[c]+.7152*l[c+1]+.0722*l[c+2])/255+n),p=Math.min(3,Math.floor(g*4)),d=(g-p/4)*4;for(let u=0;u<3;u++)l[c+u]=Math.round(s[p][u]+d*(s[p+1][u]-s[p][u]))}return o.putImageData(r,0,0),a})}function mt(e,t,n,s,a){return jn(e,`s|${t}|${n}|${s}|${a}`,()=>{let o=e.getContext("2d").getImageData(t,n,ae,ae).data,r=ae+2*s,l=ae+2*s,c=new Uint8Array(r*l);for(let f=0;f<ae;f++)for(let m=0;m<ae;m++)c[(f+s)*r+m+s]=o[(f*ae+m)*4+3]?1:0;for(let f=0;f<s;f++){let m=c.slice();for(let y=0;y<l;y++)for(let k=0;k<r;k++){let E=y*r+k;!c[E]&&(k>0&&c[E-1]||k<r-1&&c[E+1]||y>0&&c[E-r]||y<l-1&&c[E+r])&&(m[E]=1)}c=m}let[g,p]=_t(r,l),d=p.createImageData(r,l),[u,w,b]=Qn(a);for(let f=0;f<c.length;f++)c[f]&&d.data.set([u,w,b,255],f*4);return p.putImageData(d,0,0),g})}var jo=[[[0,0],[-1,-1],[-1,-2],[-2,-3],[-2,-4],[-3,-5],[-3,-6],[-4,-7]],[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]],[[0,0],[0,1],[-1,2],[-1,3],[0,4],[-1,5],[-1,6],[-2,7]]];function Yo(e,t,n,s,a,o){return jn(e,`c|${t}|${n}|${s}|${o}|${a.cx}|${a.mid}`,()=>{let[r,l]=_t(ae,ae);l.drawImage(mt(e,t,n,0,"#ffffff"),0,0),l.globalCompositeOperation="source-atop",l.fillStyle=o;for(let c=0;c<s;c++)for(let[g,p]of jo[c])l.fillRect(a.cx+g,a.mid+p,1,1);return r})}function ke(e,t,n,s,a,o=1,r,l){if(o<=0)return;let c=l?l[2]:t.width,g=l?l[3]:t.height,p=r??c;e.save(),e.globalAlpha*=o,a&&(e.translate(2*n+p,0),e.scale(-1,1)),l?e.drawImage(t,l[0],l[1],c,g,n,s,p,g):e.drawImage(t,n,s,p,g),e.restore()}var Xo=e=>{let t=Vn[e];return{...t,cx:t.l+t.r>>1,mid:t.t+51>>1}},qn=class{constructor(){re(this,"view","happy");re(this,"col",0);re(this,"dx",0);re(this,"dy",0);re(this,"flip",!1);re(this,"alpha",1);re(this,"hide",!1);re(this,"boost",0);re(this,"white",0);re(this,"crack",0);re(this,"ringA",null);re(this,"evo",null);re(this,"body",null);re(this,"fadeNew",0);re(this,"aura",!0);re(this,"extra",!0);re(this,"extraDy",0);re(this,"dim",0);re(this,"shake",0);re(this,"thread",null);re(this,"list",[]);re(this,"marks",[]);re(this,"after",[]);re(this,"rings",[])}fx(t,n,s,a,o={}){this.list.push({name:t,frame:n,x:s,y:a,...o})}mark(t,n,s,a,o={}){this.marks.push({name:t,frame:n,x:s,y:a,life:16,anchor:"bc",...o})}};function Ls(e,t){let n=t.width,s=t.height;switch(e.anchor){case"c":return[e.x-(n>>1),e.y-(s>>1)];case"bc":return[e.x-(n>>1),e.y-s];case"bl":return[e.x,e.y-s];case"cl":return[e.x,e.y-(s>>1)];default:return[e.x,e.y]}}var F=(e,t,n)=>e>=t&&e<n,Nt=(e,t,n)=>{e.view=t>=1&&t<n-1?"side":"happy"},Ue=(e,t,n,s,a=1)=>[e+Math.round(Math.cos(s)*n),t+Math.round(Math.sin(s)*n*a)];function Jo(e,t,n,s,a){let o=[9,6,3][t-2];for(let[r,l]of[[1,-1],[1.3,0],[1,1]])e.fx(n,t,s+Math.round(o*r),a+Math.round(o*l),{anchor:"c"})}var Tt={firepuff:{dir:!0,hit:5,steps:e=>e?17:15,run(e,t,n){Nt(e,t,n.n);let s=n.E?[0,1,2,4,4,3]:[0,1,2,3];F(t,2,5)&&(e.col=1),F(t,5,7)&&(e.col=2,e.dx=-1);let[a,o]=n.mouth[e.col];F(t,2,5)&&Jo(e,t,"embers",a,o),F(t,5,5+s.length)&&e.fx("flamepuff",s[t-5],a+(t-5===s.length-1?2:0),o,{anchor:"cl",follow:t<7});for(let r of n.E?[4+s.length,6+s.length]:[4+s.length]){let l=t-r;F(l,0,4)&&e.fx("smokering",l,a+20+3*l,o-3-2*l,{anchor:"c",ramp:"neutral"})}}},roar:{hit:6,steps:e=>e?18:15,run(e,t,n){let s=n.E?15:12;F(t,3,6)&&(e.col=1),F(t,6,s)&&(e.col=2,e.dx=t%2?2:-2,e.shake=t%2?1:-1,e.fx("bang",0,n.r+2,n.m-8,{follow:!0,ramp:null})),F(t,6,10)&&e.fx("burstring",t-6,n.r+4+3*(t-6),n.m,{anchor:"c",alpha:[1,.7,.45,.25][t-6]});let a=[n.l+3,n.r-3,n.cx,n.l+8,n.r-8,n.cx-5];for(let o=0;o<(n.E?6:3);o++){let r=t-6-o;F(r,0,7)&&e.fx("wisp",r>>1,a[o]+r%2,49-3*r,{anchor:"c",alpha:r>=5?.5:1})}}},icicles:{dir:!0,hit:4,steps:e=>e?21:17,run(e,t,n){Nt(e,t,n.n);let s=[[0,0],[2,-1],[2,-2],[2,-3],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]);let a=n.E?[2,4,5,7,8]:[2,4,6],o=n.E?16:13;F(t,4,6)&&e.fx("snow",t-4,n.r+2,50,{anchor:"c"}),a.forEach((r,l)=>{let c=n.r+7+9*l,g=t-4-2*l;F(g,0,3)&&t<o?e.fx("icicle",r-2+g,c,52,{anchor:"bc"}):g>=3&&t<o&&e.fx("icicle",r,c,52,{anchor:"bc"}),t===o&&e.fx("icicle",r,c,52,{anchor:"bc",alpha:.5}),l===a.length-1&&F(g,3,7)&&e.fx("glint",g-3,c-1,55-Os[r],{anchor:"c"});for(let p=0;p<3&&F(t-o,0,3);p++){let d=t-o,u=Os[r];e.fx("shard",(l+p)%4,c+(p-1)*(2+2*d),52-u+4*p+d*d+2*d,{anchor:"c",alpha:d===2?.5:1})}}),t===o&&e.mark("frostpatch",1,n.r+4,52,{anchor:"bl",life:18}),n.E&&t===o&&e.mark("frostpatch",1,n.r+22,52,{anchor:"bl",life:18})}},twirl:{hit:4,steps:e=>e?16:12,run(e,t,n){let s=n.E?[[1,0],[1,0],[2,-2],[2,-3],[0,-4],[0,-5],[0,-5],[0,-5],[0,-4],[0,-3],[2,-2],[2,-1],[1,0],[1,0]]:[[1,0],[1,0],[2,-2],[2,-2],[0,-3],[0,-3],[0,-3],[0,-2],[2,-2],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),F(t,2,s.length-1)&&(e.view=(t-2)%2?"side":"happy",e.flip=(t-2>>1)%2===1);let a=n.E?6:4,o=t-4;for(let r=0;r<a&&F(o,0,8);r++){let[l,c]=Ue(n.cx,n.mid,6+3*o,r/a*2*Math.PI+.4,.5);e.fx("snow",o+r,l,c+o,{anchor:"c"})}}},leafwhirl:{hit:3,steps:e=>e?22:18,run(e,t,n){let s=n.n-4;F(t,1,3)&&(e.col=1),F(t,3,s)&&(e.col=t===3?2:0,e.dy=t===3?-1:n.E?-3:-2),t===s&&(e.dy=-1),t===s+1&&(e.col=1);let a=n.E?8:6,o=(n.r-n.l)/2+4,r=s-3;for(let l=0;l<a&&F(t,3,s+3);l++){let c=(t-3)*(Math.PI/3.5)+l/a*2*Math.PI,g=Math.max(0,Math.min(1,(t-3-l*.5)/(r-2))),p=50-Math.round(g*(50-n.t+6)),d=t-s,[u,w]=Ue(n.cx,p,o,c,.25);d>=0&&([u,w]=[u+Math.round(Math.cos(c)*6*(d+1)),w-2*(d+1)+d*d]),e.fx("leaf",(t+l)%3,u,w,{anchor:"c",follow:d<0,alpha:d>=1?.5:1,layer:Math.sin(c)<0&&d<0?"back":"front"})}}},wiggle:{hit:4,steps:e=>e?16:12,run(e,t,n){F(t,2,n.n-2)&&(e.dx=t%2?1:-1,e.col=t%2?1:0),(n.E?[n.r+7,n.l-7]:[n.r+7]).forEach((a,o)=>{let r=t-4-2*o;F(r,0,2)&&e.fx("sprout",r,a,52,{anchor:"bc"}),r===2&&e.mark("sprout",2,a,52,{life:18})})}},petalshower:{hit:3,steps:e=>e?28:25,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0);let s=n.E?12:8,a=t-3,o=n.t-3;for(let r=0;r<s&&a>=0;r++){let l=r%2?1:-1,c=l*(4+2*((r>>1)%3)),g=(r>>1)%2*3,p,d;if(a<=3)[p,d]=[n.cx+c*a,o-[0,5,9,11][a]-g];else{let u=a-3;[p,d]=[n.cx+c*3+l*Math.floor(u/3)+((u>>1)%2?2:-2),o-11-g+3*u]}d<49&&e.fx("petal",(a+r)%3,p,d,{anchor:"c"})}t===9&&e.mark("flower",0,n.r+7,52,{life:20}),n.E&&t===11&&e.mark("flower",0,n.l-7,52,{life:18})}},triplehop:{hit:13,steps:()=>18,run(e,t,n){let s=n.E?[5,9,14]:[4,7,11],a=[[1,0]],o=[];for(let r of s){let l=Math.ceil(r/2);a.push([2,-l],[2,-r],[0,-r],[0,-l],[1,0]),o.push(a.length-1)}t<a.length&&([e.col,e.dy]=a[t]),o.forEach((r,l)=>{let c=t-r,g=l===2?8:4;for(let p=0;p<g&&F(c,0,4);p++){let d=p%2===0,u=p>>1;e.fx("petal",(c+p)%3,d?n.l+1-2*c-4*u:n.r-1+2*c+4*u,49-2*c-2*u+(c*c>>1),{anchor:"c",alpha:c===3?.5:1})}if(F(c,0,2))for(let p of[n.l,n.r])e.fx("dust",c,p,52,{anchor:"bc",ramp:"neutral"})})}},starburst:{hit:6,steps:e=>e?16:14,run(e,t,n){if(F(t,3,6)&&(e.col=1),F(t,6,8)&&(e.col=2),t<6)for(let a=0;a<6;a++){let[o,r]=Ue(n.cx,n.mid,[28,23,18,13,9,5][t],(a+.5)/6*2*Math.PI+t*.15);e.fx("bigstar",(t+a)%2+1,o,r,{anchor:"c"})}let s=n.E?[[6,0,7],[8,.5,9]]:[[6,0,7]];for(let[a,o,r]of s){let l=t-a;for(let c=0;c<6&&F(l,0,6);c++){let[g,p]=Ue(n.cx,n.mid,8+r*l,(c+o)/6*2*Math.PI);e.fx("bigstar",[2,3,2,3,1,0][l],g,p,{anchor:"c",alpha:l>=4?.5:1})}}}},float:{hit:4,steps:e=>e?18:16,run(e,t,n){let s=n.E?-14:-10,a=[0,-1,-4,-8],o=n.n-4;t<4?e.dy=Math.max(s,a[t]):t<o?e.dy=s+Math.floor((t-4)/3)%2:e.dy=[-6,-2,0,0][t-o],e.dy<0&&e.fx("shadow",Math.min(3,Math.floor(-e.dy/3)),n.cx,51,{anchor:"c",layer:"floor",ramp:"neutral",alpha:.5}),t===n.n-2&&(e.col=1);for(let r=0;r<5;r++){let l=4+2*r,c=t-l;l>=o||!F(c,0,5)||e.fx("bigstar",[1,2,1,0,0][c],n.cx+[-8,6,-3,9,1][r],50+s+2*c,{anchor:"c",alpha:c===4?.5:1})}}},coinshower:{hit:3,steps:e=>e?24:22,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0),(n.E?[-2.6,-2,-1.5,1.5,2,2.6,-3.2,3.2]:[-2.4,-1.7,1.7,2.4]).forEach((a,o)=>{let r=t-3-o%3;if(r<0)return;let l=n.cx+Math.sign(a)*6,c=n.t+4,g=a,p=-4-o%2,d=!1,u=-1;for(let b=0;b<r&&u<0;b++)l+=g,p+=1,c+=p,c>=47&&(c=47,d&&(u=b+1),p=d?0:-3,g/=2,d=!0);let w=Math.round(l);u<0?e.fx("coin",r,w,c,{anchor:"c"}):(u===r&&e.mark("coinflat",0,w,52,{life:14}),r-u<4&&e.fx("glint",r-u,w+3,45,{anchor:"c"}))})}},sparkle:{hit:2,steps:e=>e?18:14,run(e,t,n){t===1&&(e.col=1),t===2&&(e.col=2),[[n.l-6,n.t+4],[n.r+5,n.t+9],[n.l-3,n.m+13],[n.r+3,n.m+18],[n.cx+4,n.t-6],[n.l-9,n.m+2],[n.r+8,n.m],[n.cx-7,n.m+24]].slice(0,n.E?8:4).forEach(([a,o],r)=>{let l=t-4-2*(r%4)-(r>=4?1:0);F(l,0,5)&&e.fx("glint",l,a,o,{anchor:"c"})});for(let a=0;a<6&&F(t,2,5);a++){let[o,r]=Ue(n.cx,n.mid,10+7*(t-2),(a+.5)/6*2*Math.PI);e.fx("bigstar",[1,2,0][t-2],o,r,{anchor:"c",alpha:t===4?.5:1})}}},shine:{hit:2,steps:e=>e?18:14,run(e,t,n){for(let s of n.E?[2,7,12]:[2,8]){let a=t-s;F(a,0,3)&&(e.boost=.25,e.ringA=a===1?.8:.35),F(a,0,4)&&e.fx("glint",[1,2,3,4][a],n.r-4,n.t+3,{anchor:"c"});for(let o=0;o<8&&F(a,0,3);o++){let[r,l]=Ue(n.cx,n.mid,(n.r-n.l)/2+3+3*a,o/8*2*Math.PI,.9);e.fx("bigstar",[0,1,0][a],r,l,{anchor:"c",alpha:a===2?.5:1})}}t===1&&(e.col=1),t===2&&(e.col=2)}},shockwave:{hit:5,steps:e=>e?17:14,run(e,t,n){let s=[[0,0],[1,0],[2,-1],[2,-3],[2,-4],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),t===5&&(e.shake=1),t===6&&(e.shake=-1);for(let a of n.E?[5,7]:[5])F(t-a,0,6)&&e.fx("shockring",t-a,n.cx,51,{anchor:"c",layer:"floor"});if(F(t,5,8))for(let[a,o]of[[n.l-3,-1],[n.r+3,1]])e.fx("dust",Math.min(1,t-5),a+3*o*(t-5),52,{anchor:"bc",ramp:"neutral",alpha:t===7?.5:1})}},vanish:{hit:10,steps:()=>14,travel:(e,t)=>t?0:e?40:24,run(e,t,n){let s=n.travel;F(t,1,4)&&(e.col=1),e.alpha={2:.66,3:.33,9:.33,10:.66}[t]??1,F(t,4,9)&&(e.hide=!0),t>=9&&(e.dx=s),F(t,10,12)&&(e.col=2);for(let a=0;a<(n.E?8:6);a++){let o=[-8,8,-3,4,-12,11,0,-6][a],r=[2,0,8,12,10,6,-2,16][a],l,c;if(F(t,2,5))[l,c]=[n.cx+o,n.mid+r-2*(t-2)];else if(F(t,5,9)){let g=t-5,p=s?0:Math.round(4*Math.cos((g+a)*Math.PI/2));[l,c]=[n.cx+o+Math.round(s*(g+1)/5)+p,n.mid+r-6+(g+a)%2]}else if(F(t,9,11))[l,c]=[n.cx+s+Math.round(o*(1-(t-9)/2)),n.mid+r-4+2*(t-9)];else continue;e.fx(a%2?"wisps":"wisp",t+a,l,c,{anchor:"c"})}}},zap:{dir:!0,hit:6,steps:e=>e?15:12,run(e,t,n){if(Nt(e,t,n.n),F(t,2,6))for(let a=0;a<4;a++){let[o,r]=Ue(n.cx,n.t-1,[20,15,10,5][t-2],(a+.5)/4*2*Math.PI+t*.3,.6);e.fx("bigstar",(t+a)%2+1,o,r,{anchor:"c"})}F(t,4,6)&&(e.col=1),F(t,6,8)&&(e.col=2);let s=n.E?[[6,n.r+16],[9,n.r+34]]:[[6,n.r+16]];for(let[a,o]of s){let r=t-a;F(r,0,3)&&e.fx("bolt",r===1?1:0,o,52,{anchor:"bc",alpha:r===2?.5:1}),r===1&&e.mark("scorch",0,o,52,{ramp:"neutral",life:18});for(let l=0;l<6&&F(r,1,5);l++)e.fx("bigstar",[2,1,1,0][r-1],o+(l%2?1:-1)*(3+3*r+2*(l>>1)),50-2*r-(l>>1)*3+(r*r>>1),{anchor:"c"})}}},dash:{dir:!0,hit:4,steps:()=>13,travel:(e,t)=>t?0:e?44:30,run(e,t,n){Nt(e,t,n.n);let s=n.travel,a=s?[0,Math.round(s*.3),Math.round(s*.65),s]:[1,2,3,3];if(F(t,2,4)&&(e.col=1,e.dx=-1),F(t,4,8)){let o=t-4;e.col=o<2?2:0,e.dx=a[o];for(let r=1;r<=(n.E?3:2);r++){let l=s?a[o-r]:a[o]-3*r;l!==void 0&&l!==a[o]&&e.after.push({dx:l,alpha:[.5,.3,.15][r-1]})}}if(F(t,8,10)){e.col=1,e.dx=(s||3)+1,e.fx("dust",t-8,n.l-3,52,{anchor:"bc",follow:!0,ramp:"neutral"}),e.fx("dust",t-8,n.l-11-2*(t-8),52,{anchor:"bc",follow:!0,ramp:"neutral",alpha:.6});for(let o=0;o<3;o++)e.fx("bigstar",(t-8+o)%3,n.r+3+3*o,49-3*o-2*(t-8),{anchor:"c",follow:!0})}t>=10&&(e.dx=s||[1,0][t-10]||0)}},bubbleblow:{dir:!0,hit:10,light:17,steps:e=>e?30:23,run(e,t,n){Nt(e,t,n.n),F(t,2,4)&&(e.col=1),F(t,4,10)&&(e.col=2);let[s,a]=n.mouth[2];F(t,4,10)&&e.fx("bubble",t-4,s,a,{anchor:"cl"});let o=n.E?[[10,6,2],[13,5,3],[16,4,2]]:[[10,6,2]];for(let[r,l,c]of o){let g=t-r,p=s+9+2*g,d=a-c*g+g%2;F(g,0,7)&&e.fx("bubble",l,p,d,{anchor:"c"}),F(g,7,9)&&e.fx("pop",g-7,p,d,{anchor:"c"});for(let u=0;u<6&&F(g,8,14);u++){let w=g-8,b=[-3,-2,-1,1,2,3][u];e.fx("droplet",0,p+b*(w+2),d+w*w-3*w-1+u%2*2,{anchor:"c",alpha:w>=5?.5:1})}}}},splash:{hit:8,steps:e=>e?18:15,run(e,t,n){let s=n.E?[-5,-11,-16,-18,-18,-16,-11,-5]:[-4,-9,-13,-15,-13,-9,-4],a=[[1,0],[1,0],...s.map((l,c)=>[c<2||c===s.length-1?2:0,l]),[1,0],[1,0]],o=2+s.length;t<a.length&&([e.col,e.dy]=a[t]);for(let l of n.E?[o,o+2]:[o])F(t-l,0,5)&&e.fx("waterring",t-l,n.cx,51,{anchor:"c",layer:"floor"});let r=t-o;F(r,0,3)&&e.fx("crown",r,n.cx,52,{anchor:"bc"});for(let l=0;l<(n.E?10:8)&&F(r,0,8);l++){let c=[-5,-3,-2,-1,1,2,3,5,-4,4][l],g=6-Math.abs(c)%3;e.fx("droplet",0,n.cx+c*(r+2),46-g*r+r*r,{anchor:"c",alpha:r>=6?.5:1})}}}},Ot=(e,t)=>Tt[e].steps(t),Bs=(e,t,n)=>Tt[e].travel?.(t,n)??0,Gs=e=>!!(Tt[e].dir||Tt[e].travel),Yn=54,Xn=16,Ks=e=>e.kind==="move"?Ot(e.move,e.encore):e.kind==="hatch"?Jn:e.reduced?Xn:Yn,Zo=(()=>{let e=Qo(7);return Array.from({length:16},()=>{let t=e()*4|0,n=e();return[[n*176,-2],[178,n*99*.8],[n*176,-2],[-2,n*99*.8]][t]})})(),$s=[12,20,27,33,38,42];function ei(e,t,n,s,a,o){if(o){e.evo=t>=12,e.body=t>=12?"new":"old",F(t,4,12)&&(e.fadeNew=[.25,.5,.75,1][t-4>>1]);return}e.evo=t>=44,e.aura=e.extra=t>=46,e.dim=t<10?(t+1)*.06:t<44?.6:[.4,.25,.1][t-44]??0;let r=s+26,l=a+n.mid;t<21&&Zo.forEach(([c,g],p)=>{let d=c+s-62,u=g+a-39,w=Math.min(1,(t+1+p%4)/22)**1.5;w<.92&&e.fx(p%3?"speck":"bigstar",0,Math.round(d+(r-d)*w),Math.round(u+(l-u)*w),{world:!0})}),F(t,10,44)&&(e.col=1),F(t,44,46)&&(e.col=2),F(t,10,22)&&(e.white=[.33,.66][t-10]??($s.includes(t)?1:.75)),e.body=t<28?"old":t<33?"new":t<37?"old":t<41?"new":t<44?"old":"new",F(t,41,44)&&(e.white=1,e.crack=t-40);for(let c of $s)F(t-c,0,3)&&e.rings.push({d:[2,4,6][t-c],a:[.9,.5,.25][t-c],c:"#ffffff"});F(t,44,49)&&e.fx("burstring",t-44,n.cx,n.mid,{anchor:"c"});for(let c=0;c<8&&F(t,44,52);c++){let g=t-44,[p,d]=Ue(n.cx,n.mid,4+5*g,(c+.5)/8*2*Math.PI);e.fx("shard",c,p,d+(g*g>>1),{anchor:"c",alpha:g>=6?.5:1})}F(t,46,53)&&(e.extraDy=[-20,-14,-8,-3,0,-2,0][t-46])}var qs={prismite:{how:"crack",colour:"frost",moves:["starburst"]},thundrake:{how:"crack",colour:"storm",moves:["zap"]},clockrit:{how:"crack",colour:"gilded",moves:["shockwave"]},wickwisp:{how:"crack",colour:"ember",moves:["firepuff"]},cauldrop:{how:"crack",colour:"moss",moves:["bubbleblow","splash"]},webbit:{how:"thread",colour:"dusk",moves:[]}},Jn=24,Us=[2,7,11],ti=e=>[[15,e.l-3,e.t+3],[17,e.r+2,e.m],[19,e.cx+2,e.t-4]];function ni(e,t,n,s){if(s==="thread"){e.dy=t<10?-Math.round(92*(1-t/10)**2):[0,-3,-2,-1][t-10]??0,e.col=t<10?2:[1,2][t-10]??0,e.dim=t<10?.3:[.2,.1][t-10]??0,t<14?e.thread=e.dy+n.t+1:t<18&&(e.thread=n.t+1-25*(t-13));for(let[a,o,r]of ti(n))F(t,a,a+3)&&e.fx("glint",t-a,o,r,{anchor:"c"});return}e.dim=t<6?(t+1)*.07:t<17?.42:[.28,.14][t-17]??0,e.col=t<14?1:F(t,17,19)?2:0,t<17&&(e.white=t<14&&!Us.includes(t)?.85:1),F(t,14,17)&&(e.crack=t-13);for(let a of Us)F(t-a,0,3)&&e.rings.push({d:[2,4,6][t-a],a:[.9,.5,.25][t-a],c:"#ffffff"});F(t,17,22)&&e.fx("burstring",t-17,n.cx,n.mid,{anchor:"c"});for(let a=0;a<8&&F(t,17,24);a++){let o=t-17,[r,l]=Ue(n.cx,n.mid,4+5*o,(a+.5)/8*2*Math.PI);e.fx("shard",a,r,l+(o*o>>1),{anchor:"c",alpha:o>=5?.5:1})}}function Vs(e){e.getContext("2d").getImageData(0,0,1,1)}function Hs(e,[t,n,s,a],o){let[r,l]=_t(s,a);return l.drawImage(e,t*o,n*o,s*o,a*o,0,0,s,a),r}var Kn=new Map;function yn(e){let t=e("sprites/atlas.json"),n=Kn.get(t);return n||(n=(async()=>{let s=await fetch(t);if(!s.ok)throw new Error(`atlas ${s.status}`);let a=await s.json(),[o,r]=await Promise.all([$e(e(a.moves.path)),$e(e(a.extras.path))]),l={};for(let[p,d]of Object.entries(a.moves.pieces))l[p]=d.map(u=>Hs(o,u,a.scale));let[c,g]=a.extras.artSize;return a.extras.rows.forEach((p,d)=>{l[`x-${p}`]=Array.from({length:a.extras.frames},(u,w)=>Hs(r,[w*c,d*g,c,g],a.scale))}),Vs(l.bang[0]),{pieces:l,raw:new Set(a.moves.raw)}})(),Kn.set(t,n),n.catch(()=>Kn.delete(t))),n}function ai(e){let t=(p,d)=>e[(d*ae+p)*4+3]>0,n=[];for(let p=0;p<ae;p++)for(let d=0;d<ae;d++)if(t(d,p)){n.push(p);break}if(!n.length)return null;let s=n[0],a=n[n.length-1]-s+1,o=new Map;for(let p=s+Math.floor(.3*a);p<=s+Math.floor(.7*a);p++)for(let d=ae-1;d>=0;d--)if(t(d,p)){o.set(p,d);break}if(!o.size)return null;let r=Math.max(...o.values()),l=[...o].filter(([,p])=>p>=r-1),[c,g]=l[l.length>>1];return[g+1,c]}var Pt=new Map;function Ws(e,t,n,s=null){let a=JSON.stringify([e,t,n,s]),o=Pt.get(a);return o||(Pt.size>32&&Pt.clear(),o=(async()=>{let[r,l]=_t(ae*3,ae*2);for(let[g,p]of[[e,0],[t??e,ae]]){let d=await $e(g.src),u=d.naturalHeight/g.rows;for(let w=0;w<3;w++){let b=g.frames===3?d.naturalWidth/3*w:0,f=g.frames===3?d.naturalWidth/3:d.naturalWidth;l.save(),n&&(l.translate((2*w+1)*ae,0),l.scale(-1,1)),l.drawImage(d,b,g.row*u,f,u,w*ae,p,ae,ae),l.restore()}}Vs(r);let c=null;if(s)c=[s,s,s];else if(t){let g=[0,1,2].map(p=>ai(l.getImageData(p*ae,ae,ae,ae).data));c=g.every(Boolean)?g:null}return{img:r,mouths:c}})(),Pt.set(a,o),o.catch(()=>Pt.delete(a))),o}var si=[0,.35,.8,.35],ri=[[-2,.5],[-3,-1],[-3,-1],[-3,.5],[-2,1],[-1,1]],oi={rise:e=>[[e.l-4,e.m+12],[e.r-1,e.m+8],[e.r-6,e.m+18]],fall:e=>[[e.l-3,e.t-2],[e.r-2,e.t+2],[e.r+1,e.m+2]],twinkle:e=>[[e.l-5,e.t+2],[e.r-1,e.m+6],[e.l-3,e.m+15]]},ii=[[0,0],[1,-2],[0,-4],[-1,-6],[0,-8],[1,-10],[0,-12],[-1,-14]],li=[[0,0],[1,2],[2,4],[1,6],[0,8],[1,10],[2,12],[1,14]];function ci(e,t){let n=Math.floor(t/3);return e==="rise"?{frame:[0,0,0,1,1,1,2,2][n],d:ii[n]}:e==="fall"?{frame:[0,1,2,1,0,1,2,1][n],d:li[n]}:n<3?{frame:n,d:[0,0]}:null}function Qs(e,t,n,s){let{ctx:a,art:o,body:r,colour:l,dir:c,X:g,Y0:p}=e,{width:d,height:u}=a.canvas,w=Xo(e.stage),b=l==="storm"?"spark":l,f=Wo[l],m=new qn,y=-99,k=-99;if(t?.kind==="move"){let v=Tt[t.move],I=v.steps(t.encore),U=r.mouths??[0,1,2].map(()=>[w.r,w.m]);v.run(m,n,{...w,mouth:U,E:t.encore,spot:t.spot,n:I,travel:t.travel}),y=n-v.hit,k=n-(v.light??v.hit)}else t?.kind==="hatch"?(ni(m,n,w,t.how),y=k=n-(t.how==="thread"?10:17)):t&&(ei(m,n,w,g,p,t.reduced),y=n-46,k=n-44);let E=!e.plain&&(m.evo??!0),_=t?.kind==="move"&&t.encore,P=(v,I)=>c>0?g+v:g+ae-v-I,z=P(m.dx,ae),x=p+m.dy,S=(v,I,U,$=0)=>{let q=o.pieces[v],W=q[(I%q.length+q.length)%q.length];return o.raw.has(v)||U===null?W:Gn(W,U,$)},N=(v,I,U)=>{let[$,q,W]=Qn(v),H=z+26,J=p+30,te=a.createRadialGradient(H,J,4,H,J,U?200:95);te.addColorStop(0,`rgba(${$},${q},${W},${I})`),U&&te.addColorStop(U,`rgba(${$},${q},${W},${I})`),te.addColorStop(1,`rgba(${$},${q},${W},0)`),a.fillStyle=te,a.fillRect(0,0,d,u)};if(a.save(),a.clearRect(0,0,d,u),m.shake&&a.translate(m.shake,0),e.lit&&m.dim&&N("#000000",m.dim,.55),e.lit&&t&&(E||e.plain)&&F(k,0,6)){let v=[1,1,.75,.5,.3,.15][k]*(_?1.4:1);l==="shade"?N("#000000",.38*v,0):N(f,.24*v,0)}let L=t?`${t.at}|${n}`:e.drawn;if(L!==e.drawn){e.drawn=L;for(let v of m.marks){let I=S(v.name,v.frame,v.ramp===void 0?b:v.ramp),[U,$]=Ls(v,I);e.marks.push({img:I,wx:P(U,I.width),wy:p+$,flip:c<0,born:s,life:v.life})}}e.marks=e.marks.filter(v=>s-v.born<v.life);for(let v of e.marks){let I=v.life-(s-v.born);ke(a,v.img,v.wx,v.wy,v.flip,I<=3?I/4:1)}if(!t)return a.restore(),e.marks.length>0;let D=v=>{let I=S(v.name,v.frame,v.ramp===void 0?b:v.ramp),[U,$]=Ls(v,I);v.follow&&(U+=m.dx,$+=m.dy),v.world?ke(a,I,U,$,!1,v.alpha??1):ke(a,I,P(U,I.width),p+$,c<0,v.alpha??1)};m.list.filter(v=>v.layer==="floor").forEach(D),m.list.filter(v=>v.layer==="back").forEach(D);let M=m.col*ae,A=m.view==="side"?ae:0,C=c<0!==m.flip,T=r.img,R=[M,A,ae,ae];m.thread!==null&&p+m.thread>0&&(a.fillStyle=Ds[3],a.globalAlpha=.8,a.fillRect(P(w.cx+m.dx,1),0,1,p+m.thread),a.globalAlpha=1);for(let v of m.after)ke(a,mt(T,M,A,0,f),P(v.dx,ae),x,C,v.alpha);if(!m.hide){for(let U of m.rings)ke(a,mt(T,M,A,U.d,U.c),z-U.d,x-U.d,C,m.alpha*U.a);let v=m.ringA??(E?si[s%24/6|0]:0);v&&ke(a,mt(T,M,A,2,f),z-2,x-2,C,m.alpha*v),E&&ke(a,mt(T,M,A,1,f),z-1,x-1,C,m.alpha);let I=(m.body??(E?"new":"old"))==="new";if(ke(a,I?Gn(T,l,m.boost):T,z,x,C,m.alpha,ae,R),m.fadeNew&&ke(a,Gn(T,l),z,x,C,m.fadeNew,ae,R),m.white){let U=m.crack?Yo(T,M,A,m.crack,w,bn[b][2]):mt(T,M,A,0,"#ffffff");ke(a,U,z,x,C,m.alpha*m.white)}}m.list.filter(v=>!v.layer||v.layer==="front").forEach(D);let B=c>0?g+m.dx:g-m.dx;if(E&&m.aura&&!m.hide){let v=st[l].aura,I=Wn[v],U=F(y,0,12);for(let[$,q]of U?[[0,!1],[4,!0]]:[[0,!1]])oi[I](w).forEach(([W,H],J)=>{let te=ci(I,(s+J*8+$)%24);if(!te)return;let se=S(v,te.frame,b,U?.25:0),oe=(q?ae-W-7:W)+te.d[0]+(7-se.width>>1),ye=H+te.d[1]+(7-se.height>>1);ke(a,se,B+oe,x+ye,!1,m.alpha)})}if(E&&m.extra&&!m.hide){let v=12,I=!1,U=(s%24>=12?-1:0)+m.extraDy;if(t.kind==="move"&&F(y,0,6)){let[q,W]=ri[y];U+=q,v=Math.round(12*Math.abs(W)),I=W<0}let $=S(`x-${e.extra}`,s%12>=6?1:0,b);ke(a,$,B+20+(12-v>>1),x+w.t-13+U,I,m.alpha,v)}return a.restore(),e.marks.length>0}var vn=52,ui=1200,gi={feed:[{sprite:"tomato",motion:"feed"}],play:[{sprite:"sparkle",motion:"play-a"},{sprite:"sparkle",motion:"play-b"}],rest:[{sprite:"z",motion:"rest-a"},{sprite:"z",motion:"rest-b"}],pet:[{sprite:"heart",motion:"pet"}]},js={stage:{x:176,top:80,bottom:24},spot:{x:48,top:56,bottom:8}},di={note:[{sprite:"note",motion:"cue-note"}],question:[{sprite:"question",motion:"cue-question"}],bang:[{sprite:"bang",motion:"cue-bang"}],nap:[{sprite:"z",motion:"nap-a"},{sprite:"z",motion:"nap-b"}]},pi="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0",Zn=(e,t)=>e.map(n=>(parseInt(n.slice(1+t*2,3+t*2),16)/255).toFixed(3)).join(" ");function Js(){return i("svg",{"aria-hidden":"true",width:"0",height:"0",style:{position:"absolute"},children:i("defs",{children:Object.entries(bn).map(([e,t])=>h("filter",{id:`sl-ramp-${e}`,colorInterpolationFilters:"sRGB",children:[i("feColorMatrix",{type:"matrix",values:pi}),h("feComponentTransfer",{children:[i("feFuncR",{type:"table",tableValues:Zn(t,0)}),i("feFuncG",{type:"table",tableValues:Zn(t,1)}),i("feFuncB",{type:"table",tableValues:Zn(t,2)})]})]},e))})})}function wn(){let[e,t]=G(null),n=j(void 0);X(()=>()=>window.clearTimeout(n.current),[]);let s=ge(a=>{window.clearTimeout(n.current),t({action:a,at:Date.now()}),n.current=window.setTimeout(()=>t(null),ui)},[]);return[e,s]}var mi={egg:{w:22,h:30},hatchling:{w:26,h:32},juvenile:{w:32,h:40},adult:{w:36,h:46},elder:{w:36,h:46}};function Ys(e,t,n){if(e)return{backgroundImage:`url("${e}")`};if(t)return{backgroundImage:`url("${n(t.path)}")`,backgroundSize:`300% ${Ye*100}%`,backgroundPositionY:`${t.row/(Ye-1)*100}%`}}function Xs(e,t,n){let s=t&&Oa(e);if(!s)return;let a=Ye*kt,o=r=>`${(r*Ye+t.row)/(a-1)*100}%`;return{backgroundImage:`url("${n(s.path)}")`,backgroundSize:`300% ${a*100}%`,"--sl-live-y0":o(0),"--sl-live-y1":o(kt),animationDuration:`${s.ms*kt}ms`,animationTimingFunction:`steps(${kt}, end)`}}function fi({act:e,player:t,look:n,plain:s,stage:a,facing:o,scale:r}){let[l,c]=G(null),[g,p]=G(e);e!==g&&(p(e),c(e?null:g));let d=e??l,u=d?.kind==="move"&&d.spot,w=u?js.spot:js.stage,b=w.x*2+vn,f=w.top+vn+w.bottom,m=j(null),y=j(null),{colour:k,extra:E}=n;return Be(()=>{let _=m.current?.getContext("2d");if(!_||!d)return;_.imageSmoothingEnabled=!1;let P={ctx:_,...t,colour:k,extra:E,stage:a,dir:o==="right"?1:-1,X:w.x,Y0:w.top,lit:!u,plain:s};y.current?.ctx===_?Object.assign(y.current,P):y.current={...P,marks:[],drawn:""};let z=y.current,x=0,S="",N=()=>{let L=Date.now(),D=Math.floor(L/He),M=e?Math.min(Ks(e)-1,Math.max(0,Math.floor((L-e.at)/He))):0,A=`${M}|${D}`;if(A!==S&&(S=A,!Qs(z,e,M,D)&&!e))return c(null);x=requestAnimationFrame(N)};return N(),()=>cancelAnimationFrame(x)},[e,d,t,k,E,a,o,w,u,s]),d?i("canvas",{ref:m,"aria-hidden":"true",className:"sl-move-canvas",width:b,height:f,style:{left:`${-w.x*r}px`,top:`${-w.top*r}px`,width:`${b*r}px`,height:`${f*r}px`}}):null}function ft({species:e,stage:t,mood:n,assetUrl:s,alt:a,scale:o,still:r=!1,reaction:l=null,pose:c=null,cue:g=null,customSrc:p=null,sideSrc:d=null,frames:u=3,silhouette:w=!1,look:b=null,act:f=null,facing:m="right",flipped:y=!1}){let k=t==="egg"?null:Vn[t],E=!!p,_=E&&u===1,P=!E&&w,z=E||P?null:Te(e,t,n),x=Ys(E?p:null,z,s),S=z&&Te(e,t,"side"),N=Ys(E?d:null,S,s),L=t==="egg"?void 0:Xs(e,z,s),D=t==="egg"?void 0:Xs(e,S,s),M=r?"sl-live":"sl-live sl-live--on",A=L?i("span",{className:M,style:L}):null,C=D?i("span",{className:M,style:D}):null,T=L?{...x,backgroundImage:"none"}:x,R=D?{...N,backgroundImage:"none"}:N,B=!!N&&c==="walk"&&!l&&t!=="egg",v=l?`sl-react-${t==="egg"?"egg":l.action}`:c&&t!=="egg"?`sl-pose-${c}`:r?"":_||P?"sl-idle sl-idle-custom":`sl-idle sl-idle-${t==="egg"?"egg":n}`,I=!b&&f&&f.kind!=="moment"?f.colour:void 0,U=b??(I?{colour:I,extra:St[0]}:null),$=!!U&&t!=="egg"&&!P,q=$?Te(e,t,"happy"):null,W=$?Te(e,t,"side"):null,H=$?JSON.stringify(E?[{src:p,row:0,rows:1,frames:u},d?{src:d,row:0,rows:1,frames:u}:null,y,null]:[{src:s(q.path),row:q.row,rows:Ye,frames:3},W?{src:s(W.path),row:W.row,rows:Ye,frames:3}:null,y,y?null:zs[`${e}:${t}`]??null]):"",[J,te]=G(null),se=j(s);X(()=>{se.current=s}),X(()=>{if(!H)return;let ce=!0,[Oe,We,Qe,xe]=JSON.parse(H);return Promise.all([yn(se.current),Ws(Oe,We,Qe,xe)]).then(([he,je])=>ce&&te({key:H,art:he,body:je}),()=>ce&&te(null)),()=>{ce=!1}},[H]);let oe=J&&J.key===H&&U&&t!=="egg"?J:null,ye=mi[t],be={width:`${vn*o}px`,height:`${vn*o}px`,"--sl-px":`${o}px`,...k?{"--sl-t":k.t,"--sl-l":k.l,"--sl-r":k.r,"--sl-m":k.m}:{},...P?{"--sl-sil-w":ye.w,"--sl-sil-h":ye.h}:{}},ze=_?"sl-sprite-frames sl-sprite-frames--single":P?"sl-sprite-frames sl-sprite-frames--silhouette":"sl-sprite-frames",ve=b?st[b.colour].aura:null,we=f&&(oe||I)?" sl-sprite--canvas":"";return h("span",{className:b?`sl-sprite sl-evo sl-evo--${b.colour}${we}`:`sl-sprite${we}`,role:"img","aria-label":a,style:be,children:[oe&&U&&t!=="egg"?i(fi,{act:f,player:oe,look:U,plain:!b,stage:t,facing:m,scale:o}):null,b?i("span",{"aria-hidden":"true",className:"sl-evo-ring",children:i("span",{className:B?"sl-sprite-frames sl-pose-walk-side":`${ze} ${v}`,style:B?R:T,children:B?C:A},l?.at)}):null,i("span",{className:`${ze} ${B?"sl-sprite-frames--hidden":v}`,style:T,children:A},l?.at),N?i("span",{className:`sl-sprite-frames ${B?"sl-pose-walk-side":"sl-sprite-frames--hidden"}`,style:R,children:C}):null,l&&k?(gi[l.action]??[]).map(ce=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ce.sprite} sl-fx-${ce.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ce.sprite}.webp`)}")`}},`${l.at}-${ce.motion}`)):null,g&&k&&!l?di[g.kind].map(ce=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ce.sprite} sl-fx-${ce.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ce.sprite}.webp`)}")`}},`${g.at}-${ce.motion}`)):null,b&&ve&&k?h(le,{children:[["a","b","c"].map(ce=>i("span",{"aria-hidden":"true",className:`sl-evo-aura sl-evo-aura--${Wn[ve]} sl-evo-aura-${ce}`,style:{backgroundImage:`url("${s("sprites/fx-auras.webp")}")`,backgroundSize:`300% ${Qt.length*100}%`,backgroundPositionY:`${Qt.indexOf(ve)/(Qt.length-1)*100}%`}},ce)),i("span",{"aria-hidden":"true",className:"sl-evo-extra",style:{backgroundImage:`url("${s("sprites/fx-extras.webp")}")`,backgroundSize:`200% ${St.length*100}%`,backgroundPositionY:`${St.indexOf(b.extra)/(St.length-1)*100}%`}})]}):null]})}var ht=(e,t=!1)=>({queryKey:["saucelings","form",e,t?"front":"all"],queryFn:()=>V(`/form/${encodeURIComponent(e)}${t?"?strips=front":""}`),staleTime:1/0});function Ie({art:e,frontOnly:t=!1,...n}){let s=Ua(e,n.stage),a=s.kind==="form"?s.formId:null,o=ie({...ht(a??"",t),enabled:a!==null}),r=a?o.data??null:null,l=r?(n.mood==="content"?null:r[n.mood])??r.image:null,c=!l&&(s.kind==="silhouette"||a!==null&&e.design?.origin==="found");return i(ft,{...n,customSrc:l,sideSrc:r?.side??null,frames:r?.frames??1,silhouette:c,look:e.evolution?.look??null})}var hi=1024,er=1024;function tr(e,t=!1){let n=e?e.lockedStage??e.stage:null;if(!e?.design||!n||!e.design.stages[n])return null;let s=t||Object.keys(e.forms).length===0?"sheet":"stage";return{petId:e.id,species:e.species,design:e.design,forms:e.forms,stage:n,kind:s}}var bi=e=>e&&!e.forms[e.stage]?e:null,nr=e=>["saucelings","paint",e],yi=e=>e.kind==="sheet"?"sheet":e.stage,vi=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;async function ea(e,t,n,s,a){return(await Se("/api/characters/avatar-generation","POST",{connectionId:e,name:"sauceling-form",appearance:t,promptOverrides:[{id:"avatar:sauceling-form",prompt:t,negativePrompt:n}],styleProfileId:"off",width:s,height:s,...a.length>0?{referenceImages:a}:{}})).image}async function ar(e,t,n,s,a){let{design:o,stage:r}=e,l=Fe.slice(0,Fe.indexOf(r)).reverse().map(u=>e.forms[u]).find(Boolean),c=null,g=null;if(l)c=await n.fetchQuery(ht(l,!0)).then(u=>Ze(u.image)).catch(()=>null),g=c?"earlier":null;else if(o.origin==="evolved"){let u=Te(e.species,r,"content");c=await Ze(s(u.path),u.row).catch(()=>null),g=c?"before":null}let p=await ea(t,Ns(o,r,g),Cs(r),hi,c?[c]:[]),d=await cs(p,r);if(!d)throw new Error(a);return V("/form","POST",{stage:r,image:d,petId:e.petId})}async function wi(e,t,n,s,a){let o=Te(e.species,"adult","content"),r=e.design.origin==="evolved"?await Ze(s(o.path),o.row).catch(()=>null):null,l=zn(e.design),c=await ea(t,Ps(e.design,r?"before":null),ks,er,r?[r]:[]),g=await us(c,l);return g?V("/form/sheet","POST",{petId:e.petId,forms:g}):ar({...e,kind:"stage"},t,n,s,a)}function sr(e,t,n){let{t:s}=ee(),a=ue(),o=t.world.settings.portraitConnectionId;return ne({mutationKey:e?nr(e.petId):["saucelings","paint"],mutationFn:async({target:r})=>{if(!o)throw new Error(s("saucelings.album.needsConnection"));return await V("/form/start","POST",{petId:r.petId,key:yi(r),token:vi}),(r.kind==="sheet"?wi:ar)(r,o,a,n,s("saucelings.form.failed"))},onSuccess:r=>{a.setQueryData(["saucelings","state"],r),a.invalidateQueries({queryKey:["saucelings","menagerie"]})}}).mutate}function rr(e){let n=ba({filters:{mutationKey:e,exact:!0},select:s=>s.state}).at(-1);return{pending:n?.status==="pending",error:n?.error??null}}var ta=e=>rr(nr(e)),or="saucelings-paint-asked",ir=new Set;function lr(){try{let e=JSON.parse(localStorage.getItem(or)??"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}catch{return[]}}var Si=e=>ir.has(e)||lr().includes(e);function ki(e){ir.add(e);try{localStorage.setItem(or,JSON.stringify([...lr().filter(t=>t!==e),e].slice(-100)))}catch{}}function xi({isEgg:e,name:t,onAnswer:n}){let{t:s}=ee(),a=j(null);return X(()=>{let o=a.current;return o&&!o.open&&o.showModal(),o?.querySelector(".sl-btn--primary")?.focus(),()=>o?.close()},[]),h("dialog",{ref:a,className:"sl-dialog","aria-labelledby":"sl-paint-offer-title",onCancel:o=>{o.preventDefault(),n(!1)},children:[i("h2",{id:"sl-paint-offer-title",children:e?s("saucelings.form.offerEggTitle"):s("saucelings.form.offerTitle",{name:t})}),i("p",{children:e?s("saucelings.form.offerEggBody"):s("saucelings.form.offerBody",{name:t})}),h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(!1),children:s("saucelings.form.offerNotNow")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>n(!0),children:s("saucelings.form.offerPaint")})]})]})}function cr({petId:e}){let{t}=ee(),{pending:n,error:s}=ta(e);return n?i("span",{role:"status",style:{fontSize:"0.8rem",opacity:.8},children:t("saucelings.form.paintingEgg")}):s?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:t("saucelings.form.eggFailed",{error:s.message})}):null}function Sn({state:e,assetUrl:t}){let{t:n}=ee(),s=e.world.activePet,a=bi(tr(s)),o=sr(a,e,t),{pending:r,error:l}=ta(a?.petId??""),[,c]=G(0),g=e.world.settings;if(!s||!a||!g.portraitEnabled||!g.portraitConnectionId)return null;let p=s.stage==="egg",d=`${a.petId}/${a.stage}`,u=w=>{ki(d),c(b=>b+1),w&&o({target:a})};return h("div",{className:"sl-care-row",children:[!r&&!Si(d)?i(xi,{isEgg:p,name:s.name,onAnswer:u}):null,i("button",{type:"button",className:"sl-btn",disabled:r,onClick:()=>o({target:a}),children:r?n("saucelings.form.painting"):`\u{1F3A8} ${p?n("saucelings.form.paintEgg"):n("saucelings.form.paint",{name:s.name,stage:n(`saucelings.stage.${a.stage}`)})}`}),i("span",{className:"sl-care-note",role:"status",children:n(r?"saucelings.form.paintingNote":"saucelings.form.needed")}),l&&!r?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:l.message}):null]})}function ur({state:e,assetUrl:t}){let{t:n}=ee(),s=ue(),[a,o]=G(!1),r=e.world.activePet,l=tr(r,!0),c=sr(l,e,t),{pending:g,error:p}=ta(l?.petId??""),d=ne({mutationFn:async m=>{let y=await V("/form/undo","POST",{petId:m});return await Promise.all(Object.values(y.world.activePet?.forms??{}).map(k=>s.prefetchQuery(ht(k)))),y},onSuccess:m=>{s.setQueryData(["saucelings","state"],m),s.invalidateQueries({queryKey:["saucelings","menagerie"]})}}),u=e.world.settings;if(!r||!l||!l.forms[l.stage]||!u.portraitEnabled)return null;let w=!!u.portraitConnectionId,b=Object.keys(r.savedForms).length>0;if(!w&&!b)return null;let f=r.stage==="egg"?n("saucelings.form.repaintEgg"):n("saucelings.form.repaint",{name:r.name});return h("div",{className:"sl-about-row",children:[a?h(le,{children:[i("span",{className:"sl-care-note",children:n("saucelings.form.repaintNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>{o(!1),c({target:l})},children:n("saucelings.form.repaintConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>o(!1),children:n("saucelings.common.cancel")})]}):h(le,{children:[g?i("button",{type:"button",className:"sl-btn",disabled:!0,children:n("saucelings.form.painting")}):w?i(Me,{text:n("saucelings.form.repaintHint"),label:n("saucelings.help.label",{action:f}),children:h("button",{type:"button",className:"sl-btn",onClick:()=>o(!0),children:["\u{1F3A8} ",f]})}):null,b?i(Me,{text:n("saucelings.form.undoRepaintHint"),label:n("saucelings.help.label",{action:n("saucelings.form.undoRepaint")}),children:h("button",{type:"button",className:"sl-btn",disabled:g||d.isPending,onClick:()=>d.mutate(r.id),children:["\u21B6 ",n("saucelings.form.undoRepaint")]})}):null,i("span",{className:"sl-care-note",role:"status",children:g?n("saucelings.form.paintingNote"):null})]}),p&&!g?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:p.message}):null,d.error&&!d.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:d.error.message}):null]})}function gr({name:e,flipped:t,request:n}){let{t:s}=ee(),a=ue(),o=ne({mutationFn:()=>n(!t),onSuccess:r=>a.setQueryData(["saucelings","state"],r)});return h("div",{className:"sl-about-row",children:[i(Me,{text:s("saucelings.flip.note",{name:e}),label:s("saucelings.help.label",{action:s("saucelings.flip.label",{name:e})}),children:h("button",{type:"button",className:"sl-btn","aria-pressed":t,disabled:o.isPending,onClick:()=>o.mutate(),children:["\u2194 ",s("saucelings.flip.label",{name:e})]})}),o.error&&!o.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:o.error.message}):null]})}function dr({state:e}){let t=e.world.activePet;return t?i(gr,{name:t.name,flipped:t.flipped,request:n=>V("/pet","PATCH",{flipped:n})}):null}function pr({state:e,characterId:t,name:n}){return i(gr,{name:n,flipped:e.world.flippedCaretakers.includes(t),request:s=>V("/caretaker/flip","PATCH",{characterId:t,flipped:s})})}var Zs=e=>["saucelings","figure-paint",e];function mr({state:e,characterId:t,name:n,sprites:s}){let{t:a}=ee(),o=ue(),[r,l]=G(!1),c=e.world.settings,g=c.portraitConnectionId,p=gt(e.world.caretakerFigures[t]),d=({next:E,image:_,frames:P})=>{let z=E.world.caretakerFigures[t];z&&o.setQueryData(["saucelings","figure",z],{image:_,frames:P}),o.setQueryData(["saucelings","state"],E)},u=ne({mutationKey:Zs(t),mutationFn:async()=>{if(!g)throw new Error(a("saucelings.album.needsConnection"));let E=await o.fetchQuery(Un(t)),_=[E.avatar,Hn(s,"neutral")].filter(S=>!!S),P=(await Promise.all(_.map(S=>ps(S).catch(()=>null)))).filter(S=>S!==null),z=null;for(let S of Is(n,E.appearance,P,c.threeDrawingFallback)){let N=await ea(g,S.prompt,xs,er,S.references);if(z=await gs(N),z)break}if(!z)throw new Error(a("saucelings.figure.failed",{name:n}));return{next:await V("/figure","POST",{characterId:t,image:z.image}),...z}},onSuccess:d}).mutate,w=ne({mutationFn:async()=>{let E=await V("/figure/undo","POST",{characterId:t}),_=E.world.caretakerFigures[t];return _&&await o.prefetchQuery({queryKey:["saucelings","figure",_],queryFn:()=>V(`/figure/${encodeURIComponent(_)}`),staleTime:1/0}),E},onSuccess:E=>o.setQueryData(["saucelings","state"],E)}),{pending:b,error:f}=rr(Zs(t));if(!c.portraitEnabled)return null;let m=!!e.world.caretakerFigures[t],y=!!(m&&e.world.savedFigures[t]);if(!g&&!y)return null;let k=b||w.isPending;return i(le,{children:h("div",{className:"sl-about-row",children:[r?h(le,{children:[i("span",{className:"sl-care-note",children:a("saucelings.figure.confirmNote",{name:n})}),i("button",{type:"button",className:"sl-btn",onClick:()=>{l(!1),u()},children:a("saucelings.figure.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>l(!1),children:a("saucelings.common.cancel")})]}):h(le,{children:[b?i("button",{type:"button",className:"sl-btn",disabled:!0,children:a("saucelings.form.painting")}):g?i(Me,{text:a("saucelings.figure.hint"),label:a("saucelings.help.label",{action:m?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})}),children:h("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>l(!0),children:["\u{1F3A8} ",m?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})]})}):null,y?i(Me,{text:a("saucelings.figure.undoHint"),label:a("saucelings.help.label",{action:a("saucelings.figure.undoRepaint",{name:n})}),children:h("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>w.mutate(),children:["\u21B6 ",a("saucelings.figure.undoRepaint",{name:n})]})}):null,i("span",{className:"sl-care-note",role:"status",children:b?a("saucelings.form.paintingNote"):p?.frames===3?a("saucelings.figure.threePoses",{name:n}):null})]}),f&&!b?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:f.message}):null,w.error&&!w.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:w.error.message}):null]})})}function fr({keepsake:e,assetUrl:t,large:n=!1}){let{t:s}=ee(),{backgroundId:a}=e,o=ie({queryKey:["saucelings","background",a],queryFn:()=>V(`/background/${encodeURIComponent(a??"")}`),enabled:a!==null,staleTime:1/0}),r=a?o.data?.image??null:t(rt({species:e.species,stage:e.stage})),c=[{art:{...e.art,evolution:{...e.art.evolution,look:null}},label:s("saucelings.album.before")},{art:e.art,label:s("saucelings.album.after")}];return h("span",{className:`sl-keepsake${n?" sl-keepsake--large":""}`,children:[r?i("img",{className:`sl-stage-bg ${a?"":"sl-stage-bg--pixel"}`,src:r,alt:""}):null,c.map(g=>h("span",{className:"sl-keepsake-side",children:[i(Ie,{art:g.art,species:e.species,stage:e.stage,mood:"happy",assetUrl:t,alt:"",scale:n?2:1,still:!0,frontOnly:!0}),n?i("span",{className:"sl-keepsake-label",children:g.label}):null]},g.label))]})}function hr({id:e,className:t,alt:n}){let{t:s}=ee(),a=ie({queryKey:["saucelings","portrait",e],queryFn:()=>V(`/portrait/${encodeURIComponent(e)}`),staleTime:1/0});return a.data?i("img",{className:t,src:a.data.image,alt:n}):i("span",{className:`${t} sl-gallery-blank`,children:a.isError?s("saucelings.album.missing"):null})}function br({state:e,packageId:t,packageVersion:n}){let{t:s}=ee(),a=R=>Ge(t,R,n),o=ue(),r=e.world.activePet,l=e.world.settings,[c,g]=G(null),[p,d]=G(null),[u,w]=G(!1),[b,f]=G(!1),[m,y]=G(""),k=j(null);X(()=>{(c||p)&&k.current?.focus()},[c,p]);let E=ie({queryKey:["saucelings","portraits"],queryFn:()=>V("/portraits"),refetchOnMount:"always"}),_=E.data?.portraits??[],P=ie({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),enabled:e.menagerieCount>0}),z=[];if(r?.evolution.look&&r.stage!=="egg"){let R=Xe(r).stage;z.push({petId:r.id,name:r.name,home:"nook",art:r,species:r.species,stage:R==="egg"?"hatchling":R,backgroundId:r.backgroundId,form:r.evolution.look.form,at:r.evolution.at})}for(let R of P.data?.menagerie??[]){let B=R.reachedElder?"elder":R.lockedStage??R.stageAtRetirement;!R.evolution.look||B==="egg"||z.push({petId:R.id,name:R.name,home:"menagerie",art:R,species:R.species,stage:B,backgroundId:R.backgroundId,form:R.evolution.look.form,at:R.evolution.at})}let x=R=>{o.setQueryData(["saucelings","state"],R),o.invalidateQueries({queryKey:["saucelings","portraits"]})},S=ne({mutationFn:async R=>{if(!l.portraitConnectionId)throw new Error(s("saucelings.album.needsConnection"));let B=Xe(R).stage,v=R.forms[B],I=Te(R.species,B,"content"),U=v?o.fetchQuery(ht(v,!0)).then(J=>Ze(J.image)):R.design?null:Ze(a(I.path),I.row),$=U?await U.catch(()=>null):null,q=m.replace(/\s+/gu," ").trim(),W=Rs(R,$!==null,q),H=await Se("/api/characters/avatar-generation","POST",{connectionId:l.portraitConnectionId,name:"sauceling-portrait",appearance:W,promptOverrides:[{id:"avatar:sauceling-portrait",prompt:W,negativePrompt:ws(q)}],styleProfileId:"off",...$?{referenceImages:[$]}:{}});return V("/portrait","POST",{image:H.image,instructions:q})},onSuccess:x}),N=ne({mutationFn:R=>V(`/portrait/${encodeURIComponent(R)}/delete`,"POST",{}),onSuccess:R=>{g(null),w(!1),x(R)}}),L=new Map;for(let R of _){let B=L.get(R.petId)??{petId:R.petId,name:R.petName,home:R.home,keepsake:null,paintings:[]};B.paintings.push(R),L.set(R.petId,B)}for(let R of z){let B=L.get(R.petId);B?B.keepsake=R:L.set(R.petId,{petId:R.petId,name:R.name,home:R.home,keepsake:R,paintings:[]})}let D=[...L.values()].sort((R,B)=>+(B.home==="nook")-+(R.home==="nook")),M=_.find(R=>R.id===c)??null,A=z.find(R=>R.petId===p)??null,C=S.error??N.error??E.error,T=l.portraitEnabled?r?r.stage==="egg"?s("saucelings.album.egg"):null:s("saucelings.album.noPet"):s("saucelings.album.off");return h("div",{style:{display:"grid",gap:"1rem"},children:[h("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem",justifyItems:"start"},children:[T||!r?i("span",{style:{fontSize:"0.85rem",opacity:.8},children:T}):h(le,{children:[i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:S.isPending,onClick:()=>S.mutate(r),children:S.isPending?s("saucelings.album.painting"):`\u{1F3A8} ${s("saucelings.album.paint",{name:r.name})}`}),i("button",{type:"button",className:"sl-link",disabled:S.isPending,onClick:()=>{b&&y(""),f(!b)},children:s(b?"saucelings.album.removeInstructions":"saucelings.album.addInstructions")}),b?h("div",{style:{display:"grid",gap:"0.3rem",width:"100%"},children:[i("label",{className:"sl-picker-label",htmlFor:"sl-paint-instructions",children:s("saucelings.album.instructionsLabel")}),i("textarea",{id:"sl-paint-instructions",className:"sl-input sl-picker-prompt",rows:2,maxLength:_a,placeholder:s("saucelings.album.instructionsPlaceholder"),disabled:S.isPending,value:m,onChange:R=>y(R.target.value)}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:s("saucelings.album.instructionsNote")})]}):null]}),C?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:C.message}):null,r&&!T?i(Sn,{state:e,assetUrl:a}):null]}),A?h("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(fr,{keepsake:A,assetUrl:a,large:!0}),i("div",{style:{fontSize:"0.85rem"},children:s("saucelings.album.keepsakeCaption",{name:A.name,form:A.form,date:A.at?new Date(A.at).toLocaleDateString():""})}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:s("saucelings.album.close")})]}):null,M?h("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(hr,{id:M.id,className:"sl-viewer-image",alt:s("saucelings.album.alt",{name:M.petName})}),h("div",{style:{fontSize:"0.85rem"},children:[i("strong",{children:M.petName})," ",i("span",{style:{opacity:.75},children:s("saucelings.album.caption",{stage:s(`saucelings.stage.${M.stage}`),date:new Date(M.savedAt).toLocaleDateString()})}),M.instructions?i("div",{style:{fontStyle:"italic",opacity:.75},children:s("saucelings.album.instructionsCaption",{instructions:M.instructions})}):null]}),i("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem"},children:u?h(le,{children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:N.isPending,onClick:()=>N.mutate(M.id),children:s("saucelings.album.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>w(!1),children:s("saucelings.common.cancel")})]}):h(le,{children:[i("button",{type:"button",className:"sl-btn",onClick:()=>w(!0),children:s("saucelings.album.delete")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:s("saucelings.album.close")})]})})]}):null,E.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.loading")}):D.length===0?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.album.empty")}):D.map(R=>h("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem"},children:[h("div",{style:{fontSize:"0.9rem"},children:[i("strong",{children:R.name})," ",i("span",{style:{opacity:.7},children:R.home==="menagerie"?s("saucelings.album.inMenagerie"):R.home==="released"?s("saucelings.album.released"):""})]}),h("div",{className:"sl-gallery",children:[R.keepsake?i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.keepsakeLabel",{name:R.name}),"aria-pressed":R.petId===p,onClick:()=>{g(null),d(R.petId)},children:i(fr,{keepsake:R.keepsake,assetUrl:a})}):null,R.paintings.map(B=>i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.alt",{name:B.petName}),"aria-pressed":B.id===c,onClick:()=>{w(!1),d(null),g(B.id)},children:i(hr,{id:B.id,className:"sl-gallery-image",alt:""})},B.id))]})]},R.petId))]})}function yr({state:e}){let{t}=ee(),n=e.world.activePet,s=n?.journal??[];return!n||s.length===0?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.empty.title")}):i("div",{style:{display:"grid",gap:"0.65rem"},children:s.map(a=>h("div",{className:"sl-card",style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"1rem"},children:[h("div",{style:{display:"grid",gap:"0.25rem"},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.72rem",opacity:.7},children:[i("span",{style:{textTransform:"uppercase",fontWeight:600},children:t(`saucelings.event.${a.kind}`)}),a.generated?i("span",{style:{padding:"0.05rem 0.4rem",borderRadius:"999px",background:"rgba(169,120,232,0.2)",color:"#d8b4fe"},children:t("saucelings.journal.generated")}):null]}),h("p",{style:{margin:0,fontSize:"0.875rem",lineHeight:1.45},children:[a.speaker?i("strong",{children:t("saucelings.journal.speaker",{name:a.speaker})}):null,a.speaker?" ":null,a.text]})]}),i("time",{style:{fontSize:"0.72rem",opacity:.6,whiteSpace:"nowrap"},children:new Date(a.createdAt).toLocaleString()})]},a.id))})}function na(e){return e.design?null:Ma.includes(e.species)?"special":Ia.includes(e.species)?"halloween":null}var Ei={special:{rows:["....K....","...KYK...","KKKKYKKKK","KYYYWYYYK",".KYYYYYK.","..KYYYK..",".KYYKYYK.",".KYK.KYK.",".KK...KK."],colours:{K:"#4a2c0a",Y:"#ffd84a",W:"#fff6c2"}},halloween:{rows:[".....gg..","....gG...",".KKKgKKK.","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK",".KOOOOOK.","..KKKKK.."],colours:{K:"#5a2008",O:"#ff8a28",o:"#c95212",g:"#2f5e1e",G:"#7fd35a"}}},Ci=Object.fromEntries(Object.entries(Ei).map(([e,{rows:t,colours:n}])=>[e,t.flatMap((s,a)=>[...s.matchAll(/([^.])\1*/gu)].map(o=>({x:o.index,y:a,w:o[0].length,fill:n[o[1]]})))]));function Ft({pet:e,labelled:t=!0}){let{t:n}=ee(),s=na(e);return s?i("svg",{className:"sl-rare-mark",viewBox:"0 0 9 9",width:"18",height:"18",shapeRendering:"crispEdges",...t?{role:"img","aria-label":n(`saucelings.pet.rare.${s}`)}:{"aria-hidden":!0},children:Ci[s].map(a=>i("rect",{x:a.x,y:a.y,width:a.w,height:1,fill:a.fill},`${a.x},${a.y}`))}):null}function vr(e){let t=Le(e)?.sauce;return t?{"--sl-sauce-accent":t.accentColor,"--sl-sauce-bg":t.badgeBg}:{}}function wr({state:e,packageId:t,packageVersion:n,onRestored:s}){let{t:a}=ee(),o=C=>Ge(t,C,n),r=ue(),l=ie({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),refetchOnMount:"always"}),c=l.data?.menagerie??[],g=e.world.activePet,p=g?g.stage==="egg"?a("saucelings.menagerie.activeEgg"):g.name:"",[d,u]=G({}),[w,b]=G({}),f=C=>w[C.id]??(C.farewellScene?C.caretakerId:""),[m,y]=G(null),[k,E]=G(null),_=j(null),P=j(new Map),z=j(null);X(()=>{m?_.current?.focus():z.current&&P.current.get(z.current)?.focus(),z.current=null},[m]);let x=ne({mutationFn:C=>V(`/menagerie/${encodeURIComponent(C.id)}/restore`,"POST",{stage:C.stage,swap:C.swap,caretakerId:C.caretakerId}),onSuccess:(C,T)=>{E(null),r.setQueryData(["saucelings","state"],C),s(T.caretakerId)}}),S=ne({mutationFn:C=>V(`/menagerie/${encodeURIComponent(C)}/release`,"POST",{}),onSuccess:C=>{E(null),y(null),r.setQueryData(["saucelings","state"],C),r.invalidateQueries({queryKey:["saucelings","menagerie"]}),r.invalidateQueries({queryKey:["saucelings","portraits"]})}}),N=x.error??S.error??l.error,L=x.isPending||S.isPending,D=c.find(C=>C.id===m)??null,M=C=>{E(null),y(C)},A=()=>{z.current=m,E(null),y(null)};return l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.loading")}):c.length===0&&!N?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.menagerie.empty")}):h("div",{style:{display:"grid",gap:"1rem"},children:[N?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:N.message}):null,D?i(Ri,{entry:D,cardRef:_,assetUrl:o,chosenStage:d[D.id]??"elder",onPickStage:C=>u(T=>({...T,[D.id]:C})),characters:e.characters,caretakerId:f(D),onPickCaretaker:C=>b(T=>({...T,[D.id]:C})),activeName:p,hasActivePet:!!g,confirming:k,setConfirming:E,pending:L,onRestore:(C,T)=>x.mutate({id:D.id,stage:C,swap:T,caretakerId:f(D)}),onRelease:()=>S.mutate(D.id),onClose:A}):null,Fa(c).map(C=>h("section",{className:"sl-menagerie-section",children:[h("h3",{className:"sl-menagerie-heading",children:[a(`saucelings.menagerie.section.${C.stage}`),i("span",{className:"sl-menagerie-count",children:C.entries.length})]}),i("div",{className:"sl-gallery sl-gallery--pets",children:C.entries.map(T=>{let R=T.stageAtRetirement==="egg",B=R?a("saucelings.egg.name"):T.name,v=R?null:na(T);return h("button",{ref:I=>{I?P.current.set(T.id,I):P.current.delete(T.id)},type:"button",className:"sl-gallery-tile",style:vr(T),"aria-label":v?`${B}, ${a(`saucelings.pet.rare.${v}`)}`:B,"aria-pressed":T.id===m,onClick:()=>M(T.id),children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ie,{art:T,species:T.species,stage:T.reachedElder?d[T.id]??"elder":T.lockedStage??T.stageAtRetirement,mood:"happy",assetUrl:o,alt:"",scale:2,still:!0,frontOnly:!0})}),R?null:h("span",{className:"sl-pet-tile-name",children:[i(Ft,{pet:T,labelled:!1}),T.name]})]},T.id)})})]},C.stage))]})}function Ri({entry:e,cardRef:t,assetUrl:n,chosenStage:s,onPickStage:a,characters:o,caretakerId:r,onPickCaretaker:l,activeName:c,hasActivePet:g,confirming:p,setConfirming:d,pending:u,onRestore:w,onRelease:b,onClose:f}){let{t:m}=ee(),y=Ke(e),k=e.stageAtRetirement==="egg",E=k?m("saucelings.egg.name"):e.name,_=k?m("saucelings.menagerie.thisEgg"):e.name,P=Le(e),z=e.reachedElder?s:e.lockedStage??e.stageAtRetirement,x=N=>w(e.reachedElder?s:void 0,N),S=o.length>0?o.map(N=>({id:N.id,name:N.name})):[{id:"caretaker",name:m("saucelings.empty.houseCaretaker")}];return e.farewellScene&&!S.some(N=>N.id===e.caretakerId)&&S.unshift({id:e.caretakerId,name:e.careProfile.characterName}),h("div",{ref:t,tabIndex:-1,className:"sl-card sl-viewer",style:{display:"grid",gap:"0.75rem",justifyItems:"stretch",...vr(e)},children:[h("div",{style:{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"},children:[i("div",{className:"sl-sprite-stage",style:{width:"7.5rem",height:"7.5rem"},children:i(Ie,{art:e,species:e.species,stage:z,mood:"happy",assetUrl:n,alt:E,scale:2,still:!0,frontOnly:!0})}),h("div",{style:{flex:"1 1 16rem",display:"grid",gap:"0.35rem"},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"1.1rem"},children:E}),k?null:i(Ft,{pet:e}),k||!P?null:i("span",{className:"sl-badge",title:P.readsAs,children:P.sauce?m("saucelings.pet.sauce",{sauce:P.name}):m("saucelings.pet.temperament",{temperament:P.name})}),i("span",{className:"sl-badge",children:m("saucelings.menagerie.foundBy",{name:e.finder.name})}),!k&&e.evolution?.at?i("span",{className:"sl-badge",children:m("saucelings.menagerie.evolved")}):null,h("span",{style:{fontSize:"0.8rem",opacity:.75},children:[k?"":`${y.name} \xB7 `,e.farewellScene?m("saucelings.menagerie.retiredAs",{stage:m(`saucelings.stage.${e.stageAtRetirement}`),name:e.careProfile.characterName}):""]})]}),e.farewellScene?i("p",{style:{margin:0,fontSize:"0.825rem",opacity:.85},children:e.farewellScene}):null,k&&e.design?i(cr,{petId:e.id}):null]})]}),h("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem",flexWrap:"wrap"},children:[i("span",{children:m("saucelings.menagerie.lookedAfterBy")}),h("select",{className:"sl-select",value:r,disabled:u,onChange:N=>l(N.target.value),children:[r?null:i("option",{value:"",disabled:!0,children:m("saucelings.menagerie.chooseCaretaker")}),S.map(N=>i("option",{value:N.id,children:N.name},N.id))]})]}),h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem",borderTop:"1px solid var(--border, rgba(255,255,255,0.08))",paddingTop:"0.65rem"},children:[p?h(le,{children:[i("span",{style:{fontSize:"0.8rem"},children:p==="release"?k?m("saucelings.menagerie.releaseNoteEgg"):m("saucelings.menagerie.releaseNote",{name:e.name}):m("saucelings.menagerie.swapNote",{name:_,active:c})}),h("div",{style:{display:"flex",gap:"0.5rem"},children:[p==="release"?i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:u,onClick:b,children:m("saucelings.menagerie.releaseConfirm")}):i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:u||!r,onClick:()=>x(!0),children:m("saucelings.menagerie.swapConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:m("saucelings.common.cancel")})]})]}):e.reachedElder?h("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem"},children:[i("span",{children:m("saucelings.menagerie.lockStage")}),i("select",{className:"sl-select",value:s,onChange:N=>a(N.target.value),children:Na.map(N=>i("option",{value:N,children:m(`saucelings.stage.${N}`)},N))})]}):e.farewellScene?null:h("span",{style:{fontSize:"0.75rem",opacity:.7},children:[m("saucelings.menagerie.returnsAt")," ",i("strong",{children:m(`saucelings.stage.${e.stageAtRetirement}`)})]}),p?null:h("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginLeft:"auto"},children:[i("button",{type:"button",className:"sl-btn",onClick:f,children:m("saucelings.menagerie.close")}),i("button",{type:"button",className:"sl-btn",disabled:u,onClick:()=>d("release"),children:m("saucelings.menagerie.release")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:u||!r,title:r?void 0:m("saucelings.menagerie.chooseCaretaker"),onClick:()=>g?d("swap"):x(!1),children:m("saucelings.menagerie.bringBack")})]})]})]})}var kr=1280,xr=720,Mi=20*1024*1024;async function Sr(e){let t=await $e(e),n=Math.min(t.naturalWidth,t.naturalHeight*16/9),s=n*9/16,a=document.createElement("canvas");a.width=Math.min(kr,Math.round(n)),a.height=Math.min(xr,Math.round(a.width*9/16));let o=a.getContext("2d");if(!o)throw new Error("This browser cannot resize pictures.");o.imageSmoothingQuality="high",o.drawImage(t,(t.naturalWidth-n)/2,(t.naturalHeight-s)/2,n,s,0,0,a.width,a.height);let r=a.toDataURL("image/webp",.85);return r.startsWith("data:image/webp")?r:a.toDataURL("image/jpeg",.88)}function Ii({id:e}){let{t}=ee(),n=ie({queryKey:["saucelings","background",e],queryFn:()=>V(`/background/${encodeURIComponent(e)}`),staleTime:1/0});return n.data?i("img",{className:"sl-gallery-image",src:n.data.image,alt:""}):i("span",{className:"sl-gallery-image sl-gallery-blank",children:n.isError?t("saucelings.background.missing"):null})}function Er({pet:e,settings:t,assetUrl:n,onClose:s}){let{t:a}=ee(),o=ue(),r=j(null),[l,c]=G(()=>Bn(e)),[g,p]=G(null),d=ie({queryKey:["saucelings","backgrounds"],queryFn:()=>V("/backgrounds"),refetchOnMount:"always"}),u=d.data?.backgrounds??[],w=u.length>=An,b=S=>S.label||a("saucelings.background.earlier"),f=S=>{o.setQueryData(["saucelings","state"],S),o.invalidateQueries({queryKey:["saucelings","backgrounds"]})},m=ne({mutationFn:async S=>{if(S.size>Mi)throw new Error(a("saucelings.background.tooBig"));let N=URL.createObjectURL(S);try{let L=await Sr(N),D=S.name.replace(/\.[^.]+$/u,"").slice(0,120);return await V("/background","POST",{image:L,label:D,source:"upload"})}finally{URL.revokeObjectURL(N)}},onSuccess:f}),y=ne({mutationFn:async()=>{if(!t.portraitConnectionId)throw new Error(a("saucelings.background.noConnection"));let S=Ts(l),N=await Se("/api/characters/avatar-generation","POST",{connectionId:t.portraitConnectionId,name:"sauceling-background",appearance:S,width:kr,height:xr,styleProfileId:"off",promptOverrides:[{id:"avatar:sauceling-background",prompt:S,negativePrompt:Es}]}),L=await Sr(N.image);return V("/background","POST",{image:L,label:l.trim().slice(0,120),source:"generated"})},onSuccess:f}),k=ne({mutationFn:()=>V("/background/suggest","POST",{}),onSuccess:({scene:S})=>c(S??Bn(e))}),E=ne({mutationFn:S=>V(S?`/background/${encodeURIComponent(S)}/select`:"/background/clear","POST",{}),onSuccess:f}),_=ne({mutationFn:S=>V(`/background/${encodeURIComponent(S)}/delete`,"POST",{}),onSuccess:S=>{p(null),f(S)}}),P=m.isPending||y.isPending||k.isPending||E.isPending||_.isPending,z=m.error??y.error??k.error??E.error??_.error??d.error,x=t.portraitEnabled?t.portraitConnectionId?null:a("saucelings.background.noConnection"):a("saucelings.background.off");return h("section",{className:"sl-card sl-picker","aria-label":a("saucelings.background.title"),children:[i("strong",{children:a("saucelings.background.title")}),h("div",{className:"sl-gallery sl-gallery--wide",role:"group","aria-label":a("saucelings.background.library"),children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.useBuiltIn"),title:a("saucelings.background.useBuiltIn"),"aria-pressed":e.backgroundId===null,disabled:P,onClick:()=>e.backgroundId!==null&&E.mutate(null),children:i("img",{className:"sl-gallery-image sl-stage-bg--pixel",src:n(rt(e)),alt:""})}),u.map(S=>h("div",{className:"sl-gallery-item",children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.tileAlt",{label:b(S)}),title:b(S),"aria-pressed":e.backgroundId===S.id,disabled:P,onClick:()=>e.backgroundId!==S.id&&E.mutate(S.id),children:i(Ii,{id:S.id})}),i("button",{type:"button",className:"sl-gallery-remove","aria-label":a("saucelings.background.delete",{label:b(S)}),title:a("saucelings.background.delete",{label:b(S)}),disabled:P,onClick:()=>p(S),children:"\xD7"})]},S.id))]}),g?h("div",{className:"sl-picker-row",role:"group","aria-label":a("saucelings.background.delete",{label:b(g)}),children:[i("span",{className:"sl-box-note",children:a("saucelings.background.deleteNote",{label:b(g)})}),i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:P,onClick:()=>_.mutate(g.id),children:a("saucelings.background.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>p(null),children:a("saucelings.common.cancel")})]}):null,h("div",{className:"sl-picker-row",children:[i("input",{ref:r,type:"file",className:"sl-sr-only",accept:"image/png,image/jpeg,image/webp",tabIndex:-1,onChange:S=>{let N=S.target.files?.[0];S.target.value="",N&&m.mutate(N)}}),i("button",{type:"button",className:"sl-btn",disabled:P||w,onClick:()=>r.current?.click(),children:m.isPending?a("saucelings.background.uploading"):`\u2B06 ${a("saucelings.background.upload")}`}),i("button",{type:"button",className:"sl-btn",onClick:s,children:a("saucelings.album.close")}),w?i("span",{className:"sl-box-note",children:a("saucelings.background.full",{limit:An})}):null]}),i("label",{className:"sl-picker-label",htmlFor:"sl-background-prompt",children:a("saucelings.background.promptLabel")}),i("textarea",{id:"sl-background-prompt",className:"sl-input sl-picker-prompt",rows:3,maxLength:600,value:l,onChange:S=>{c(S.target.value),k.reset()}}),h("div",{className:"sl-picker-row",children:[i("button",{type:"button",className:"sl-btn",disabled:P||x!==null,onClick:()=>k.mutate(),children:k.isPending?a("saucelings.background.suggesting"):`\u270D ${e.stage==="egg"?a("saucelings.background.suggestEgg"):a("saucelings.background.suggest",{name:e.name})}`}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:P||w||x!==null||!l.trim(),onClick:()=>y.mutate(),children:y.isPending?a("saucelings.background.generating"):`\u2728 ${a("saucelings.background.generate")}`}),x?i("span",{className:"sl-box-note",children:x}):null,k.data?.scene===null?i("span",{className:"sl-box-note",children:a("saucelings.background.suggestPlain")}):null]}),z?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:z.message}):null]})}function Cr(e,t=e*9/16){let n=Math.round(Math.max(e/176,t/99));return n>=4?4:n<=2?2:3}var aa=["rigamuffin","fluttino","burrowl"],Ai=["shellbini","lentino","puddlepip"],Rr=["fluttino","wickwisp"],Ni={grumpy:6,content:10,happy:14};function Pi(e){return e>=22||e<7}function Ti(e,t,n,s=!1){let a=aa.includes(t)?2:1,o=Ai.includes(t)?3:1;if(e==="grumpy")return{wander:2,idle:3,look:1,hop:0,hum:0,nap:0,huff:3,signature:0};if(e==="happy")return{wander:4,idle:3,look:a,hop:1,hum:o,nap:0,huff:0,signature:s?1:0};let r=Pi(n)?4:1;return{wander:4,idle:3,look:a,hop:0,hum:o,nap:r,huff:0,signature:s?.5:0}}function Mr(e,t,n,s,a=!1){let o=Ti(e,t,n,a),r=Object.keys(o).filter(g=>o[g]>0),l=r.reduce((g,p)=>g+o[p],0),c=Math.min(Math.max(s,0),.999999)*l;for(let g of r)if(c-=o[g],c<0)return g;return r[r.length-1]}function sa(e,t,n){return e==="huff"?"grumpy":e==="hop"||e==="hum"||e==="signature"?t==="grumpy"?null:"happy":e!=="idle"?null:t==="happy"?n<.6?"happy":null:t==="content"?n<.25?"happy":null:n<.3?"content":null}function kn(e,t,n){return t==="rest"?"content":t?e==="grumpy"?"content":"happy":n??(e==="happy"?"content":e)}function Lt(e){return{min:-6,max:Math.max(-6,Math.floor(e)-52+6)}}function et(e,t){let{min:n,max:s}=Lt(t);return Math.round(Math.min(Math.max(e,n),s))}var _i=.3;function Ir(e,t){return t?Math.floor(e*(1-_i)):e}function ra(e){return et((e-52)/2,e)}function Ar(e,t){return Math.max(200,Math.round(Math.abs(e)/Ni[t]*1e3))}var Oi=48,Fi=1e3;function Nr(e){return Math.min(Fi,Math.max(200,Math.round(Math.abs(e)/Oi*1e3)))}var xn=(e,t)=>e+Math.random()*(t-e);function Ae(){if(typeof document>"u")return!0;let e=document.documentElement;return e.dataset.marinaraReducedEffects==="true"||e.dataset.marinaraEffectsPaused==="true"||document.hidden||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Pr({stageArtWidth:e,mood:t,species:n,enabled:s,busy:a,paused:o=!1,move:r=null,measureX:l}){let[c,g]=G(()=>({x:ra(e),facing:"right",pose:null,cue:null,moveMs:0,steps:1,face:null,act:null})),p=s&&!a&&!o&&e>0,d=j({actor:c,stageArtWidth:e,mood:t,species:n,move:r,measureX:l,running:p});d.current={actor:c,stageArtWidth:e,mood:t,species:n,move:r,measureX:l,running:p};let u=j([]),w=j(null),b=ge(A=>g(C=>({...C,...A})),[]),f=ge((A,C)=>{u.current.push(window.setTimeout(C,A))},[]),m=ge(()=>{for(let C of u.current)window.clearTimeout(C);u.current=[];let A=w.current;w.current=null,A?.()},[]),y=ge(()=>{let A=d.current.measureX();g(C=>({...C,x:A===null?C.x:et(A,d.current.stageArtWidth),moveMs:0,steps:1,pose:null,cue:null,face:null,act:null}))},[]),k=j(()=>{}),E=ge(()=>f(xn(2500,7e3),()=>k.current()),[f]),_=ge((A,C,T=!1)=>{let{actor:R,mood:B}=d.current,v=et(A,d.current.stageArtWidth),I=v-R.x;if(Math.abs(I)<4)return C();let U=T?Nr(I):Ar(I,B);b({x:v,facing:I>0?"right":"left",pose:"walk",moveMs:U,steps:Math.abs(I)}),f(U+60,()=>{b({pose:null,moveMs:0,steps:1}),C()})},[f,b]),P=ge((A,C,T,R,B)=>{let{actor:v,stageArtWidth:I}=d.current,U=et(d.current.measureX()??v.x,I),$=B!==void 0||Math.random()<1/8,q=Gs(A)?T??(U+52/2<=I/2?"right":"left"):v.facing,W=q==="right"?1:-1,H=Math.abs(et(U+W*Bs(A,$,!1),I)-U);b({x:U,moveMs:0,steps:1,facing:q,face:C,act:{kind:"move",move:A,encore:$,travel:H,spot:!1,at:Date.now(),...B?{colour:B}:{}}}),f(Ot(A,$)*He,()=>{b({act:null,x:U+W*H,face:null}),R()})},[f,b]),z=ge(()=>{if(Ae())return E();let{actor:A,mood:C,species:T,stageArtWidth:R,move:B}=d.current,v=Mr(C,T,new Date().getHours(),Math.random(),!!B),I=sa(v,C,Math.random()),U=Date.now();switch(v){case"wander":{let{min:$,max:q}=Lt(R);return _(xn($,q),E)}case"idle":return b({face:I}),f(xn(3e3,6e3),()=>{b({face:null}),E()});case"look":{let $=A.facing;return b({facing:$==="right"?"left":"right",cue:aa.includes(T)?{kind:"question",at:U}:null,face:I}),f(1400,()=>{b({facing:$,cue:null,face:null}),E()})}case"hop":return b({pose:"hop",face:I}),f(700,()=>{b({pose:null,face:null}),E()});case"hum":return b({cue:{kind:"note",at:U},face:I}),f(2200,()=>{b({cue:null,face:null}),E()});case"nap":return b({pose:"nap",cue:{kind:"nap",at:U},face:I}),f(xn(4e3,6e3),()=>{b({pose:null,cue:null,face:null}),E()});case"huff":return b({pose:"huff",face:I}),f(1300,()=>{b({pose:null,face:null}),E()});case"signature":return B?P(B,I,null,E):E()}},[f,E,b,P,_]);k.current=z,X(()=>{if(p)return E(),()=>{m(),y()}},[p,E,m,y]);let x=j(!1);X(()=>{let A=!x.current&&e>0;A&&(x.current=!0),g(C=>{let T=s&&!A?et(C.x,e):ra(e);return T===C.x?C:{...C,x:T,moveMs:0,steps:1}})},[e,s]);let S=ge(A=>{if(!s||a||o||Ae())return;m(),y();let C=Date.now(),T=d.current.measureX()??d.current.actor.x,R=A>=T+52/2?"right":"left",{move:B,mood:v}=d.current;if(B&&v==="happy"&&Math.random()<.4)return P(B,"happy",R,E);b({facing:R,pose:"hop",cue:{kind:"bang",at:C}}),f(700,()=>{b({pose:null,cue:null}),_(A-52/2,E)})},[f,E,a,s,o,y,b,P,m,_]),N=ge(A=>{m(),y();let C=Ae();b({act:{kind:"moment",reduced:C,at:Date.now()}});let T=()=>{d.current.running&&E()};f((C?Xn:Yn)*He,()=>{b({act:null}),C?T():P(A,"happy",null,T)})},[f,E,y,b,P,m]),L=ge((A,C,T,R)=>{m(),y(),b({act:{kind:"hatch",how:A,colour:C,at:Date.now()}});let B=v=>v<T.length?P(T[v],"happy",null,()=>B(v+1),C):R();f(Jn*He,()=>{b({act:null}),B(0)})},[f,y,b,P,m]),D=ge(A=>{if(!s||a||o||w.current||Ae())return;m(),y();let C=()=>{b({facing:A?"right":d.current.actor.facing,pose:"hop",face:sa("hop",d.current.mood,0)}),f(700,()=>{b({pose:null,face:null}),E()})};if(!A)return C();b({facing:"right"}),f(300,()=>_(Lt(d.current.stageArtWidth).max,C))},[f,E,a,s,o,y,b,m,_]),M=ge(A=>new Promise(C=>{if(!A||!s||a||o||Ae()||d.current.stageArtWidth<=0)return C();m(),y(),w.current=C;let T=0,R=()=>{if(d.current.measureX()!==d.current.actor.x&&T++<8)return f(50,R);w.current=null,C(),E()},B=d.current.actor.facing!=="right";b({facing:"right"}),f(B?250:60,()=>_(Lt(d.current.stageArtWidth).max,R,!0))}),[f,E,a,s,o,y,b,m,_]);return{actor:c,poke:S,listen:D,comeOver:M,celebrate:N,hatch:L}}var Li=8,$i=2,Ui=44;function Tr({lines:e,fallbackLine:t,caretakerId:n,caretakerName:s,isCharacter:a,meals:o,isEgg:r,writing:l,standing:c,onTyping:g,children:p}){let{t:d}=ee(),u=e.slice(0,Li),[w,b]=G(0),f=u[0]?.id;X(()=>b(0),[f]);let m=Math.min(w,Math.max(0,u.length-1)),y=u[m]??null,k=ut(n,a&&!c),E=y&&l.includes(y.id)?d("saucelings.checkIn.pending",{name:y.speaker??s}):y?.text??t,_=u[0]&&!l.includes(u[0].id)?u[0]:null,P=_?`${_.id}:${_.text}`:null,z=j(P),[x,S]=G(null);X(()=>{!P||P===z.current||(z.current=P,S(Ae()?null:0))},[P]);let N=Array.from(E),L=x!==null&&m===0&&y===_&&x<N.length;X(()=>{if(!L)return;let M=window.setTimeout(()=>S(A=>A===null?null:A+$i),Ui);return()=>window.clearTimeout(M)},[L,x]),X(()=>g?.(L),[g,L]);let D=M=>{S(null),b(M)};return h("section",{className:`sl-box sl-box--joined ${c?"sl-box--standing":""}`,"aria-label":d("saucelings.caretaker.says",{name:s}),children:[c?null:i(dt,{box:!0,name:s,src:k}),h("div",{className:"sl-box-plate",children:[i("strong",{children:y?.speaker??s}),o.total>0?i("span",{className:"sl-pill",title:d(r?"saucelings.pet.keptWarmTitle":"saucelings.pet.mealsTitle",{name:s}),children:d(r?"saucelings.pet.keptWarm":"saucelings.pet.meals",o)}):null,y?.generated?i("span",{className:"sl-pill sl-pill--ai",children:d("saucelings.journal.generated")}):null]}),h("p",{className:`sl-box-line ${L?"sl-box-line--typing":""}`,"aria-live":"polite",onClick:()=>S(null),children:[h("span",{className:"sl-box-typed","aria-hidden":"true",children:[i("span",{className:"sl-box-ghost",children:E}),i("span",{children:L?N.slice(0,x).join(""):E})]}),i("span",{className:"sl-sr-only",children:E})]}),y?h("div",{className:"sl-box-nav",children:[u.length>1?h(le,{children:[i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.previous"),disabled:m>=u.length-1,onClick:()=>D(m+1),children:"\u25C0"}),i("span",{children:d("saucelings.caretaker.position",{index:u.length-m,count:u.length})}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.next"),disabled:m===0,onClick:()=>D(m-1),children:"\u25B6"})]}):null,i("time",{className:"sl-box-time",children:new Date(y.createdAt).toLocaleString()})]}):null,p]})}function _r({state:e,assetUrl:t}){let{t:n}=ee(),[s,a]=G(!1),o=e.world.activePet;return!o||o.stage==="egg"||o.evolution.offer!=="offered"||o.evolution.look?null:h("div",{className:"sl-about-row",children:[i(Me,{text:n("saucelings.evolve.note",{name:o.name}),label:n("saucelings.help.label",{action:n("saucelings.evolve.button")}),children:h("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>a(!0),children:["\u2728 ",n("saucelings.evolve.button")]})}),s?i(Di,{pet:o,assetUrl:t,onClose:()=>a(!1)}):null]})}function Or({state:e}){let{t}=ee(),n=ue(),s=ne({mutationFn:()=>V("/evolve/undo","POST",{}),onSuccess:o=>n.setQueryData(["saucelings","state"],o)}),a=e.world.activePet;return a?.evolution.look?h("div",{className:"sl-about-row",children:[i(Me,{text:t("saucelings.evolve.undoNote",{name:a.name}),label:t("saucelings.help.label",{action:t("saucelings.evolve.undo")}),children:h("button",{type:"button",className:"sl-btn",disabled:s.isPending,onClick:()=>s.mutate(),children:["\u21A9 ",t("saucelings.evolve.undo")]})}),s.error&&!s.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:s.error.message}):null]}):null}function Hi(e){let[t,n]=G(null),s=e.join(" ");return X(()=>{if(!s)return;let a=Math.max(...s.split(" ").map(l=>Ot(l,!1)))*He,o=0,r=l=>{n(l&&!Ae()?Date.now():null),o=window.setTimeout(()=>r(!l),l?a:2100)};return o=window.setTimeout(()=>r(!0),1200),()=>window.clearTimeout(o)},[s]),qt(()=>s.split(" ").map(a=>t===null?null:{kind:"move",move:a,encore:!1,travel:0,spot:!0,at:t}),[s,t])}function Di({pet:e,assetUrl:t,onClose:n}){let{t:s}=ee(),a=ue(),o=j(null),[r,l]=G(!1),c=e.careProfile.characterName,g=y=>{a.setQueryData(["saucelings","state"],y)},p=ne({mutationFn:()=>V("/evolve/options","POST",{}),onSuccess:g}),d=ne({mutationFn:y=>V("/evolve/choose","POST",{index:y}),onSuccess:y=>{g(y),n()}}),u=ne({mutationFn:()=>V("/evolve/decline","POST",{}),onSuccess:y=>{g(y),n()}}),w=e.evolution.choices,b=Hi(w?.map(y=>y.move)??[]),f=p.isPending||d.isPending||u.isPending,m=p.error??d.error??u.error;return X(()=>{let y=o.current;return y&&!y.open&&y.showModal(),y?.focus(),()=>y?.close()},[]),X(()=>{w||p.mutate()},[]),h("dialog",{ref:o,className:"sl-dialog sl-dialog--wide",tabIndex:-1,"aria-labelledby":"sl-evolve-title",onCancel:y=>{y.preventDefault(),r?l(!1):f||n()},children:[i("h2",{id:"sl-evolve-title",children:r?s("saucelings.evolve.declineConfirm",{name:e.name}):s("saucelings.evolve.title",{name:e.name})}),r?h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",autoFocus:!0,onClick:()=>l(!1),children:s("saucelings.common.cancel")}),i("button",{type:"button",className:"sl-btn",disabled:f,onClick:()=>u.mutate(),children:s("saucelings.evolve.decline")})]}):h(le,{children:[w?i("div",{className:"sl-evolve-choices",children:w.map((y,k)=>h("div",{className:"sl-evolve-choice",children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ie,{art:{...e,evolution:{...e.evolution,look:y}},species:e.species,stage:e.stage,mood:"happy",act:b[k]??null,facing:e.flipped?"left":"right",flipped:e.flipped,assetUrl:t,alt:"",scale:2})}),i("h3",{children:y.form}),i("p",{children:y.description}),i("p",{className:"sl-evolve-from",children:s("saucelings.evolve.from",{from:y.from})}),i("p",{children:s("saucelings.evolve.move",{move:s(`saucelings.evolve.moves.${y.move}`)})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:f,onClick:()=>d.mutate(k),children:s("saucelings.evolve.become",{form:y.form})})]},y.form))}):i("p",{role:"status",children:p.isPending||!m?s("saucelings.evolve.writing",{caretaker:c,name:e.name}):null}),m&&!f?i("p",{role:"alert",style:{color:"#f87171"},children:m.message}):null,i("div",{className:"sl-dialog-actions",children:i("button",{type:"button",className:"sl-btn",disabled:f,onClick:n,children:s("saucelings.evolve.keep")})}),h("p",{className:"sl-evolve-decline",children:[i("button",{type:"button",className:"sl-link",disabled:f,onClick:()=>l(!0),children:s("saucelings.evolve.decline")})," ",s("saucelings.evolve.declineNote",{name:e.name})]})]})]})}var Fr=8,zi=10,Bi={x:.5,y:.69},oa=2,Lr=32,ia=13;function Gi(e,t,n){let s=Math.max(e/n.width,t/n.height);return{left:(e-n.width*s)/2,top:(t-n.height*s)/2,width:n.width*s,height:n.height*s}}var Ki=22;function qi(){let e=j(null),[t,n]=G({width:0,height:0});return X(()=>{let s=e.current;if(!s||typeof ResizeObserver>"u")return;let a=()=>n(r=>r.width===s.clientWidth&&r.height===s.clientHeight?r:{width:s.clientWidth,height:s.clientHeight});a();let o=new ResizeObserver(a);return o.observe(s),()=>o.disconnect()},[]),[e,t]}function En({pet:e,reaction:t,assetUrl:n,backgroundSrc:s,paused:a=!1,caretaker:o=null,caretakerFlipped:r=!1,listenKey:l=null,handle:c,onMoveEgg:g}){let{t:p}=ee(),[d,{width:u,height:w}]=qi(),b=j(null),f=Cr(u,w),m=u/f,y=Xe(e),k=e.stage==="egg",E=s!==null,_=ge(()=>{let Y=d.current,Z=b.current;return!Y||!Z?null:Math.round((Z.getBoundingClientRect().left-Y.getBoundingClientRect().left)/f)},[f,d]),P=e.design?void 0:qs[e.species],[z,x]=G({id:e.id,isEgg:k}),[S,N]=G(!1);(z.id!==e.id||z.isEgg!==k)&&(x({id:e.id,isEgg:k}),N(z.id===e.id&&!k&&!!P&&!a&&!Ae()));let L=S?null:t;X(()=>{k&&P&&yn(n).catch(()=>{})},[k,P,n]);let D=o!==null,{actor:M,poke:A,listen:C,comeOver:T,celebrate:R,hatch:B}=Pr({stageArtWidth:Ir(m,D),mood:y.mood,species:e.species,enabled:!k,busy:S||t!==null,paused:a,move:e.evolution.look?.move??null,measureX:_}),v=e.evolution.look?.colour??null,I=j(v);X(()=>{v!==I.current&&(I.current=v,v&&R(st[v].moves[0]))},[v,R]),Be(()=>{S&&P&&B(P.how,P.colour,P.moves,()=>N(!1))},[S,P,B]),ka(c,()=>({comeOver:()=>T(D)}),[T,D]);let U=j(l);X(()=>{l!==U.current&&(U.current=l,l&&C(D))},[l,C,D]);let $=Y=>{let Z=d.current;Z&&A((Y.clientX-Z.getBoundingClientRect().left)/f)},[q,W]=G({width:16,height:9}),[H,J]=G(null),te=e.eggSpot?.backgroundId===(E?e.backgroundId:null)?e.eggSpot:null,se=k?H??te??(E?null:Bi):null,oe=Gi(u,w,q),ye=w/f,be=k&&g!==void 0&&u>0,ze=(Y,Z)=>{let pe=(52/2-ia)*f,de=Math.min(u-pe,Math.max(pe,Y)),Ee=Math.min(w,Math.max(Lr*f,Z));return{x:(de-oe.left)/oe.width,y:(Ee-oe.top)/oe.height}},ve=Y=>({px:oe.left+Y.x*oe.width,py:oe.top+Y.y*oe.height}),we=j(void 0);X(()=>()=>window.clearTimeout(we.current),[]);let ce=(Y,Z)=>{J(Y),window.clearTimeout(we.current),we.current=window.setTimeout(()=>{g?.(Y).catch(()=>{}).finally(()=>J(pe=>pe===Y?null:pe))},Z)},Oe=j(null),We=Y=>{let Z=d.current?.getBoundingClientRect();return Z?{px:Y.clientX-Z.left,py:Y.clientY-Z.top}:null},Qe=be?{onPointerDown:Y=>{let Z=We(Y);if(!Z||!se||Y.button!==0)return;Y.stopPropagation(),Y.currentTarget.setPointerCapture(Y.pointerId);let pe=ve(se);Oe.current={pointer:Y.pointerId,dx:Z.px-pe.px,dy:Z.py-pe.py,to:null}},onPointerMove:Y=>{let Z=Oe.current,pe=We(Y);if(!Z||Z.pointer!==Y.pointerId||!pe)return;let de=ze(pe.px-Z.dx,pe.py-Z.dy),Ee=ve(se??de),Ne=ve(de);!Z.to&&Math.hypot(Ne.px-Ee.px,Ne.py-Ee.py)<4||(Z.to=de,J(de))},onPointerUp:Y=>{let Z=Oe.current;Oe.current=null,Z?.to&&ce(Z.to,0),Y.stopPropagation()},onPointerCancel:()=>{Oe.current=null,J(null)},onKeyDown:Y=>{let Z=(Y.shiftKey?8:2)*f,[pe,de]=Y.key==="ArrowLeft"?[-Z,0]:Y.key==="ArrowRight"?[Z,0]:Y.key==="ArrowUp"?[0,-Z]:Y.key==="ArrowDown"?[0,Z]:[0,0];if(!pe&&!de||!se)return;Y.preventDefault();let Ee=ve(se);ce(ze(Ee.px+pe,Ee.py+de),500)}}:{},xe=Y=>{let Z=We(Y);!be||!Z||b.current?.contains(Y.target)||ce(ze(Z.px,Z.py),0)},he=se?ve(se):null,je=he?Math.min(m-52+ia,Math.max(-ia,Math.round(he.px/f-52/2))):M.x,Ht=he?`${Math.min(ye-Lr-oa,Math.max(-oa,Math.round(ye-he.py/f-oa)))*f}px`:`${Fr}%`,bt={"--sl-px":`${f}px`,"--sl-x":je,"--sl-move-ms":`${he?0:M.moveMs}ms`,"--sl-steps":M.steps,bottom:Ht,width:`${52*f}px`,height:`${52*f}px`},Dt=kn(y.mood,L?.action??null,M.face),tt=Rr.includes(e.species)&&!e.design&&!k;return h("div",{ref:d,className:"sl-stage","data-paused":a?"true":void 0,onPointerDown:$,onClick:xe,style:{"--sl-hover":zi,"--sl-px":`${f}px`},children:[i("img",{className:`sl-stage-bg ${E?"":"sl-stage-bg--pixel"}`,src:E?s:n(rt(e)),alt:"",draggable:!1,onLoad:Y=>{let{naturalWidth:Z,naturalHeight:pe}=Y.currentTarget;Z>0&&pe>0&&W({width:Z,height:pe})}}),o&&"figure"in o?i("div",{className:"sl-stage-figure","aria-hidden":"true","data-breathes":o.rows===2?"true":void 0,"data-flipped":r?"true":void 0,style:{backgroundImage:`url("${o.figure}")`,backgroundSize:`${o.frames*_e*f}px ${o.rows*_e*f}px`,backgroundPositionX:`${-o.frame*_e*f}px`,width:`${_e*f}px`,height:`${_e*f}px`,right:`${-Ki*f}px`,bottom:`calc(${Fr}% + ${2*f}px)`},children:o.blink?i("div",{className:"sl-stage-blink",style:{backgroundImage:`url("${o.blink}")`}}):null}):o?i("img",{className:"sl-stage-caretaker","data-flipped":r?"true":void 0,src:o.src,alt:"",draggable:!1}):null,i("div",{ref:b,className:"sl-stage-actor","data-facing":e.flipped===(M.facing==="left")?"right":"left","data-hover":tt?"true":void 0,"data-movable":be?"true":void 0,style:bt,...be?{tabIndex:0,role:"img","aria-label":p("saucelings.egg.moveLabel"),title:p("saucelings.egg.moveHint")}:{},...Qe,children:u>0?i(Ie,{art:e,species:e.species,stage:y.stage,mood:Dt,assetUrl:n,alt:k?p("saucelings.egg.name"):`${e.name} (${Ke(e).name})`,scale:f,still:a,reaction:L,pose:M.pose,cue:M.cue,act:k?null:M.act,facing:M.facing,flipped:e.flipped}):null}),k?null:i("span",{className:"sl-sr-only",children:p("saucelings.stage.tapHint",{name:e.name})})]})}function Hr({characters:e,defaultCaretakerId:t,submitLabel:n,pending:s,onSubmit:a,onCancel:o}){let{t:r}=ee(),[l,c]=G(t),g=e.find(d=>d.id===l),p=ut(l,!!g);return h("div",{className:"sl-egg-form",style:{display:"flex",flexWrap:"wrap",gap:"0.6rem",justifyContent:"center",alignItems:"center",marginTop:"0.5rem"},children:[i(dt,{name:g?.name??r("saucelings.empty.houseCaretaker"),src:p}),i("select",{className:"sl-select",value:l,onChange:d=>c(d.target.value),"aria-label":r("saucelings.empty.pickCaretaker"),children:e.length===0?i("option",{value:"caretaker",children:r("saucelings.empty.houseCaretaker")}):e.map(d=>i("option",{value:d.id,children:d.name},d.id))}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:s,onClick:()=>a({characterId:l}),children:s?r("saucelings.empty.bringingEgg"):n}),o?i("button",{type:"button",className:"sl-btn",onClick:o,children:r("saucelings.common.cancel")}):null]})}function Dr({unlocks:e}){let{t}=ee(),n=(s,a)=>e[s].done?t("saucelings.unlocks.done",{name:jt[s].name}):a;return h("div",{className:"sl-unlocks",style:{fontSize:"0.8rem",opacity:.85,textAlign:"left",margin:"0 auto"},children:[i("div",{style:{fontWeight:600},children:t("saucelings.unlocks.title")}),h("ul",{style:{margin:"0.25rem 0 0",paddingLeft:"1.1rem",display:"grid",gap:"0.15rem"},children:[i("li",{children:n("prismite",t("saucelings.unlocks.prismite",{...e.prismite}))}),i("li",{children:n("thundrake",t("saucelings.unlocks.thundrake",{...e.thundrake}))}),i("li",{children:n("clockrit",t("saucelings.unlocks.clockrit",{...e.clockrit}))}),i("li",{children:e.halloween?t("saucelings.unlocks.halloweenNow"):t("saucelings.unlocks.halloween")})]})]})}function $t({label:e,value:t,gapLabel:n}){return h("div",{className:`sl-meter-box ${n?"sl-meter-box--gap":""}`,title:n??void 0,children:[h("div",{className:"sl-meter-head",children:[i("span",{children:e}),h("span",{className:"sl-meter-value",children:[t,"%"]})]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})}),n?i("div",{className:"sl-meter-gap",children:n}):null]})}var zr=null,Vi=4e3,Wi=["hatch","stage-up","evolve-offer","evolve"],Qi=48;function Br({state:e,packageId:t,packageVersion:n,askVoice:s}){let{t:a}=ee(),o=ue(),r=e.world.activePet,l=e.characters,[c,g]=G(!1),[p,d]=G(!1),[u,w]=G(""),[b,f]=G(null),[m,y]=G("feedReliability"),[k,E]=wn(),_=j(null),[P,z]=ln(15e3),x=O=>Ge(t,O,n),S=r?.backgroundId??null,N=ie({queryKey:["saucelings","background",S],queryFn:()=>V(`/background/${encodeURIComponent(S??"")}`),enabled:S!==null,staleTime:1/0}),L=S?N.data?.image??null:null,[D,M]=G(!1),A=r?.journal.find(O=>O.kind==="user-care"||O.kind==="nudge")??null,C=A?.id,T=A?.text,R=j(C),[B,v]=G({text:"",shown:!1});X(()=>{if(!C||C===R.current)return;R.current=C,v({text:T??"",shown:!0});let O=window.setTimeout(()=>v(me=>({...me,shown:!1})),6e3);return()=>window.clearTimeout(O)},[C,T]);let[I,U]=fs(Qi),$=dn(r?.caretakerId??"",l.some(O=>O.id===r?.caretakerId)),q=r?e.world.caretakerFigures[r.caretakerId]:void 0,W=gt(q),H=gn(q,W),J=r?.journal.find(O=>Pn.includes(O.kind))??null,te=J&&!e.writing.includes(J.id)?J:null,se=te?.kind==="caretaker-care"?bs(te.outcome):null,oe=se?te?.id??null:null,[ye,be]=Mt(cn);X(()=>{!se||!oe||oe===zr||(zr=oe,(_.current?.comeOver()??Promise.resolve()).then(()=>{E(se),be(se)}))},[se,oe,E,be]);let[ze,ve]=Mt(Vi),we=te&&Wi.includes(te.kind)?te.id:null,ce=j(we);X(()=>{!we||we===ce.current||(ce.current=we,ve(!0))},[we,ve]);let[Oe,We]=G(!1),Qe=ms(r);X(()=>{if(Qe===null)return;let O=window.setTimeout(()=>{o.invalidateQueries({queryKey:["saucelings","state"]})},Math.max(0,Qe-Date.now())+1e3);return()=>window.clearTimeout(O)},[Qe,o]);let xe=O=>{f(null),o.setQueryData(["saucelings","state"],O)},he=O=>f(O instanceof Error?O.message:a("saucelings.error.request")),je=ne({mutationFn:O=>V("/adopt","POST",O),onSuccess:O=>{g(!1),xe(O)},onError:he}),Ht=ne({mutationFn:O=>V("/action","POST",{action:O}),onMutate:()=>({arrived:_.current?.comeOver()??Promise.resolve()}),onSuccess:(O,me,nt)=>{xe(O),z(),nt.arrived.then(()=>{E(me),me!=="talk"&&be(me)})},onError:he}),bt=ne({mutationFn:()=>V("/check-in","POST",{}),onSuccess:xe,onError:he}),Dt=ne({mutationFn:O=>V("/nudge","POST",{tendency:O}),onSuccess:O=>{xe(O),z()},onError:he}),tt=ne({mutationFn:O=>V("/pet","PATCH",O),onSuccess:(O,me)=>{d(!1),xe(O),me.caretakerId&&s(me.caretakerId)},onError:he}),Y=ne({mutationFn:({characterId:O,name:me})=>V("/voice","POST",{characterId:O}).catch(()=>{throw new Error(a("saucelings.voice.failed",{name:me}))}),onSuccess:xe,onError:he}),Z=O=>s(O.characterId,me=>{me&&je.mutate(O)}),pe=ne({mutationFn:()=>V("/retire","POST",{}),onSuccess:xe,onError:he});if(!r)return h("div",{className:"sl-card",style:{display:"grid",gap:"1rem",textAlign:"center",padding:"2rem"},children:[i("div",{style:{display:"flex",justifyContent:"center"},children:i(ft,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:x,alt:a("saucelings.empty.eggAlt"),scale:2})}),i("h2",{style:{fontSize:"1.125rem",fontWeight:600,margin:0},children:a("saucelings.empty.title")}),i("p",{style:{fontSize:"0.85rem",opacity:.8,maxWidth:"32rem",margin:"0 auto"},children:a("saucelings.empty.body")}),i(Hr,{characters:l,defaultCaretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.empty.bringEgg"),pending:je.isPending,onSubmit:Z}),i(Dr,{unlocks:e.unlocks}),b?i("p",{style:{color:"#f87171",fontSize:"0.8rem",margin:0},children:b}):null]});let de=r.stage==="egg",Ee=Ke(r),Ne=Le(r),Ce=Ne?.sauce??null,yt=r.name===Ee.name,Pe=r.careProfile.characterName,zt=l.some(O=>O.id===r.caretakerId),ca=At(r,P),Qr=Ce?{"--sl-sauce-accent":Ce.accentColor,"--sl-sauce-bg":Ce.badgeBg}:{},Bt=de?[{tendency:"feedReliability",label:a("saucelings.nudge.warm")},{tendency:"affection",label:a("saucelings.nudge.talk")}]:[{tendency:"feedReliability",label:a("saucelings.nudge.meals")},{tendency:"overfeeding",label:a("saucelings.nudge.portions")},{tendency:"playfulness",label:a("saucelings.nudge.play")},{tendency:"affection",label:a("saucelings.nudge.cuddles")}],ua=Bt.some(O=>O.tendency===m)?m:Bt[0].tendency,ga=Bt.flatMap(O=>{let me=r.nudges.find(ma=>ma.tendency===O.tendency&&Date.parse(ma.expiresAt)>P);if(!me)return[];let nt=Math.ceil((Date.parse(me.expiresAt)-P)/36e5);return[a("saucelings.nudge.left",{ask:O.label,hours:nt})]}),jr=r.journal.filter(O=>Pn.includes(O.kind)),Yr=pn({gaps:e.gaps,line:J,speaking:Oe||J!==null&&e.writing.includes(J.id),cheering:ze!==null,caring:ye}),da=mn(W,$,Yr,H),pa=h(le,{children:[i("div",{className:"sl-care-row",children:i("button",{type:"button",className:"sl-btn",disabled:bt.isPending,onClick:()=>bt.mutate(),children:bt.isPending?a("saucelings.checkIn.pending",{name:Pe}):`\u{1F4AC} ${a("saucelings.checkIn.button",{name:Pe})}`})}),h("div",{className:"sl-care-row sl-ask-row",children:[i("label",{htmlFor:"sl-nudge-pick",className:"sl-care-ask",children:a("saucelings.nudge.heading",{name:Pe})}),i("select",{id:"sl-nudge-pick",className:"sl-select sl-select--small",value:ua,onChange:O=>y(O.target.value),children:Bt.map(O=>i("option",{value:O.tendency,children:O.label},O.tendency))}),i("button",{type:"button",className:"sl-btn sl-btn--small",disabled:Dt.isPending,onClick:()=>Dt.mutate(ua),children:a("saucelings.nudge.ask")}),i("span",{className:"sl-care-note",children:ga.length>0?a("saucelings.nudge.active",{asks:ga.join(", ")}):a("saucelings.nudge.note")})]})]});return h("div",{ref:I,className:"sl-nook",style:Qr,children:[b?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:b}):null,r.retireReady?h("div",{className:"sl-card sl-retire",children:[i("span",{children:a("saucelings.retire.ready",{name:r.name})}),h("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:pe.isPending,onClick:()=>pe.mutate(),children:["\u{1F4D6} ",a("saucelings.retire.button")]})]}):null,h("div",{className:"sl-nook-main",children:[h("div",{className:"sl-card sl-stage-card",children:[h("div",{className:"sl-stage-bar",children:[p?h("div",{className:"sl-rename",children:[i("input",{className:"sl-input",style:{flex:"1 1 8rem",width:"100%"},value:u,maxLength:40,placeholder:a("saucelings.pet.namePlaceholder"),"aria-label":a("saucelings.pet.namePlaceholder"),onChange:O=>w(O.target.value)}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:!u.trim()||tt.isPending,onClick:()=>tt.mutate({name:u}),children:a("saucelings.common.save")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(!1),children:a("saucelings.common.cancel")})]}):h("div",{className:"sl-stage-title",children:[h("div",{className:"sl-stage-name",children:[i("h2",{style:{fontSize:"1.35rem",fontWeight:700,margin:0,overflowWrap:"anywhere"},children:de?a("saucelings.egg.name"):r.name}),de?null:i(Ft,{pet:r}),de?null:i("button",{type:"button",className:`sl-btn sl-btn--small ${yt?"sl-btn--primary":""}`,"aria-label":yt?void 0:a("saucelings.pet.rename"),title:yt?void 0:a("saucelings.pet.rename"),onClick:()=>{w(yt?"":r.name),d(!0)},children:yt?a("saucelings.pet.nameIt"):"\u270F\uFE0F"})]}),de?null:h("div",{className:"sl-stage-sub",title:Ce?`${Ce.origin} \u2014 ${Ce.readsAs}`:Ne?.readsAs,children:[Ne?`${Ce?a("saucelings.pet.sauce",{sauce:Ce.name}):a("saucelings.pet.temperament",{temperament:Ne.name})} \xB7 `:null,Ee.name," \xB7"," ",r.lockedStage?a("saucelings.pet.locked",{stage:a(`saucelings.stage.${r.lockedStage}`)}):a(`saucelings.stage.${r.stage}`),!r.lockedStage&&r.stage!=="elder"&&r.meters.hunger<Ta?` \xB7 ${a("saucelings.pet.growthPaused")}`:null]})]}),h("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":D,"aria-label":a("saucelings.nook.background"),title:a("saucelings.nook.background"),onClick:()=>M(O=>!O),children:["\u{1F5BC}",h("span",{className:"sl-btn-label",children:[" ",a("saucelings.nook.background")]})]})]}),h("div",{className:"sl-scene",children:[i(En,{pet:r,reaction:k,assetUrl:x,backgroundSrc:L,caretaker:da,caretakerFlipped:e.world.flippedCaretakers.includes(r.caretakerId),listenKey:te?.id??null,handle:_,onMoveEgg:O=>tt.mutateAsync({eggSpot:O})}),i(Tr,{lines:jr,fallbackLine:de?a("saucelings.caretaker.idleEgg"):a("saucelings.caretaker.idle",{name:r.name}),caretakerId:r.caretakerId,caretakerName:Pe,isCharacter:zt,meals:e.gaps.meals,isEgg:de,writing:e.writing,standing:da!==null||W===void 0,onTyping:We,children:U?pa:null})]})]}),h("div",{className:"sl-card sl-care-card",children:[h("div",{className:"sl-meters sl-meters--strip",children:[de?h(le,{children:[i($t,{label:a("saucelings.meter.warmth"),value:It(r),gapLabel:e.gaps.warmth?a("saucelings.meter.warmthGap"):null}),i($t,{label:a("saucelings.meter.hatching"),value:ca,gapLabel:ca>=100&&r.careActionCount<1?a("saucelings.meter.hatchingGap"):null})]}):h(le,{children:[i($t,{label:a("saucelings.meter.hunger"),value:r.meters.hunger,gapLabel:e.gaps.hunger?a("saucelings.meter.hungerGap"):null}),i($t,{label:a("saucelings.meter.mood"),value:r.meters.mood,gapLabel:e.gaps.mood?a("saucelings.meter.moodGap"):null})]}),i($t,{label:a("saucelings.meter.bond"),value:r.meters.bond})]}),i("div",{className:"sl-actions",children:rn(r).map(O=>{let me=un(r,O,P),nt=on(O,e.gaps);return h("button",{type:"button",className:`sl-btn ${nt?"sl-btn--gap":""}`,disabled:Ht.isPending||me>0,onClick:()=>Ht.mutate(O,{onSuccess:()=>{nt&&ve(!0)}}),children:[an[O]," ",a(sn[O]),me>0?` \xB7 ${a("saucelings.action.wait",{minutes:me})}`:""]},O)})}),i("p",{className:`sl-action-note ${B.shown?"sl-action-note--shown":""}`,"aria-live":"polite",children:B.text}),i(Sn,{state:e,assetUrl:x}),i(_r,{state:e,assetUrl:x}),U?null:pa]})]}),D?i(Er,{pet:r,settings:e.world.settings,assetUrl:x,onClose:()=>M(!1)}):null,h("details",{className:"sl-card sl-about",children:[i("summary",{children:de?a("saucelings.about.egg"):a("saucelings.about.summary",{name:r.name})}),h("div",{className:"sl-about-body",children:[de?i("p",{children:a("saucelings.egg.about")}):h(le,{children:[h("p",{children:[Ee.look," \u2014 ",i("em",{children:r.quirk})]}),i("p",{children:Ce?a("saucelings.pet.sauceAbout",{sauce:Ce.name,readsAs:Ce.readsAs}):Ne&&r.ownTemperament?a("saucelings.pet.temperamentAbout",{temperament:Ne.name,readsAs:Ne.readsAs,after:r.ownTemperament.takesAfter.name}):a("saucelings.pet.temperamentForming")}),r.evolution.look?i("p",{title:r.evolution.look.description,children:a("saucelings.evolve.into",{form:r.evolution.look.form})}):null,r.evolution.look?i("p",{children:a("saucelings.evolve.move",{move:a(`saucelings.evolve.moves.${r.evolution.look.move}`)})}):null,i("div",{className:"sl-traits",children:r.traits.map(O=>h("span",{className:"sl-trait",children:["#",O]},O))})]}),i("p",{children:a("saucelings.menagerie.foundBy",{name:r.finder.name})}),l.length>1?h("label",{className:"sl-about-row",children:[i("span",{children:a(de?"saucelings.pet.eggCaretaker":"saucelings.pet.caretaker")}),i("select",{className:"sl-select sl-select--small","aria-label":a("saucelings.empty.pickCaretaker"),value:r.caretakerId,onChange:O=>tt.mutate({caretakerId:O.target.value}),children:l.map(O=>i("option",{value:O.id,children:O.name},O.id))})]}):null,zt?i("div",{className:"sl-about-row",children:i(Me,{text:a("saucelings.about.refreshVoiceNote"),label:a("saucelings.help.label",{action:a("saucelings.about.refreshVoice",{name:Pe})}),children:i("button",{type:"button",className:"sl-btn",disabled:Y.isPending,onClick:()=>Y.mutate({characterId:r.caretakerId,name:Pe}),children:Y.isPending?a("saucelings.about.refreshingVoice",{name:Pe}):`\u{1F504} ${a("saucelings.about.refreshVoice",{name:Pe})}`})})}):null,zt?i(mr,{state:e,characterId:r.caretakerId,name:Pe,sprites:$}):null,zt?i(pr,{state:e,characterId:r.caretakerId,name:Pe}):null,i(ur,{state:e,assetUrl:x}),i(dr,{state:e}),i(Or,{state:e}),i("div",{className:"sl-about-row",children:h("button",{type:"button",className:"sl-btn","aria-expanded":c,onClick:()=>g(O=>!O),children:["\u{1F95A} ",a("saucelings.swap.button")]})}),c?h("div",{style:{display:"grid",gap:"0.5rem",textAlign:"center"},children:[i("p",{style:{margin:0,fontSize:"0.85rem"},children:de?a("saucelings.swap.noteEgg"):a("saucelings.swap.note",{name:r.name})}),i(Hr,{characters:l,defaultCaretakerId:l.some(O=>O.id===r.caretakerId)?r.caretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.swap.confirm"),pending:je.isPending,onSubmit:O=>Z({...O,swap:!0}),onCancel:()=>g(!1)}),i(Dr,{unlocks:e.unlocks})]}):null]})]})]})}var ji=new Set(["image_generation","video_generation","audio","decision"]);function Gr({state:e}){let{t}=ee(),n=ue(),s=e.world.settings,a=e.world.budget,[o,r]=G(!1),l=ie({queryKey:["saucelings","connections"],queryFn:()=>Se("/api/connections")}),c=(l.data??[]).filter(u=>!ji.has(u.provider)),g=l.data?.filter(u=>u.provider==="image_generation"),p=ne({mutationFn:u=>V("/settings","PATCH",u),onSuccess:u=>n.setQueryData(["saucelings","state"],u)}),d=ne({mutationFn:()=>V("/reset","POST",{}),onSuccess:u=>{r(!1),n.setQueryData(["saucelings","state"],u)}});return h("div",{className:"sl-card",style:{display:"grid",gap:"1.15rem"},children:[h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.careWindow")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.careWindowNote")})]}),i("input",{type:"number",className:"sl-input",min:1,max:24,style:{width:"5rem"},value:s.careWindowHours,onChange:u=>p.mutate({careWindowHours:Number(u.target.value)||6})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.dailyBudget")}),h("div",{style:{fontSize:"0.75rem",opacity:.7},children:[t("saucelings.settings.budgetUsed",{used:a.used,limit:s.dailyGenerationBudget})," ","\u2014 ",t("saucelings.settings.budgetNote")]})]}),i("input",{type:"number",className:"sl-input",min:0,max:30,style:{width:"5rem"},value:s.dailyGenerationBudget,onChange:u=>p.mutate({dailyGenerationBudget:Number(u.target.value)})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.connection")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.connectionNote")})]}),h("select",{className:"sl-input",value:s.connectionId??"",onChange:u=>p.mutate({connectionId:u.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.connectionDefault")}),c.map(u=>i("option",{value:u.id,children:u.name},u.id)),s.connectionId&&l.data&&!c.some(u=>u.id===s.connectionId)?i("option",{value:s.connectionId,children:t("saucelings.settings.connectionMissing")}):null]})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.writeEveryLine")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.writeEveryLineNote")})]}),i("input",{type:"checkbox",checked:s.writeEveryLine,onChange:u=>p.mutate({writeEveryLine:u.target.checked})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.images")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imagesNote")})]}),i("input",{type:"checkbox",checked:s.portraitEnabled,onChange:u=>p.mutate({portraitEnabled:u.target.checked})})]}),h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.eggHunting")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.eggHuntingNote")})]}),i("input",{type:"checkbox",checked:s.eggHunting,onChange:u=>p.mutate({eggHunting:u.target.checked})})]}),s.portraitEnabled?h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.imageConnection")}),g&&g.length===0?i("span",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imageConnectionEmpty")}):h("select",{className:"sl-input",value:s.portraitConnectionId??"",onChange:u=>p.mutate({portraitConnectionId:u.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.imageConnectionPick")}),(g??[]).map(u=>i("option",{value:u.id,children:u.name},u.id))]})]}):null,s.portraitEnabled?h("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:t("saucelings.settings.threeDrawingFallback")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.threeDrawingFallbackNote")})]}),i("input",{type:"checkbox",checked:s.threeDrawingFallback,onChange:u=>p.mutate({threeDrawingFallback:u.target.checked})})]}):null,h("div",{style:{borderTop:"1px solid var(--border, rgba(255,255,255,0.1))",paddingTop:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"},children:[i("span",{style:{fontSize:"0.8rem",opacity:.75},children:t("saucelings.settings.resetNote")}),o?h("div",{style:{display:"flex",gap:"0.5rem"},children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:d.isPending,onClick:()=>d.mutate(),children:t("saucelings.settings.resetConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>r(!1),children:t("saucelings.common.cancel")})]}):i("button",{type:"button",className:"sl-btn",onClick:()=>r(!0),children:t("saucelings.settings.reset")})]})]})}function Ut({label:e,value:t,gap:n}){return h("div",{children:[h("span",{children:[e," ",t,"%"]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})})]})}var Yi={warmth:"\u{1F525}",hatching:"\u{1F95A}",hunger:"\u{1F35D}",mood:"\u{1F60A}",bond:"\u{1F49B}"};function Xi({icon:e,label:t,value:n,gap:s}){return h("div",{className:"sl-widget-bar-row",role:"meter","aria-label":t,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":n,title:`${t} ${n}%`,children:[i("span",{className:"sl-widget-bar-icon","aria-hidden":"true",children:e}),i("div",{className:"sl-widget-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})})]})}function Kr({active:e,compact:t,packageId:n,packageVersion:s,onOpenNoodle:a}){let{t:o}=ee(),r=ue(),[l,c]=wn(),g=j(null),[p,d]=Mt(cn),[u,w]=ln(3e4),b=H=>Ge(n,H,s),f=ie({queryKey:["saucelings","state"],queryFn:()=>V("/state"),enabled:e,staleTime:1e4,refetchOnMount:"always",refetchInterval:H=>e?H.state.data?.writing.length?2e3:3e4:!1,refetchIntervalInBackground:!1}),m=ne({mutationFn:H=>V("/action","POST",{action:H}),onMutate:()=>({arrived:g.current?.comeOver()??Promise.resolve()}),onSuccess:(H,J,te)=>{r.setQueryData(["saucelings","state"],H),w(),te.arrived.then(()=>{c(J),J!=="talk"&&d(J)})}}),y=f.data,k=y?.world.activePet,E=!!(k&&y?.characters.some(H=>H.id===k.caretakerId)),_=ut(k?.caretakerId??"",E),P=dn(k?.caretakerId??"",E&&!t),z=k&&!t?y?.world.caretakerFigures[k.caretakerId]:void 0,x=gt(z),S=gn(z,x),N=k?.backgroundId??null,L=ie({queryKey:["saucelings","background",N],queryFn:()=>V(`/background/${encodeURIComponent(N??"")}`),enabled:e&&!t&&N!==null,staleTime:1/0}),D=N?L.data?.image??null:null;if(!k)return i("div",{className:"sl-widget",role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:H=>{(H.key==="Enter"||H.key===" ")&&a?.()},children:h("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(ft,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:b,alt:o("saucelings.empty.eggAlt"),scale:1,still:!e}),h("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.85rem"},children:o("saucelings.empty.title")}),i("div",{style:{fontSize:"0.72rem",opacity:.75},children:o("saucelings.widget.emptyHint")})]})]})});let M=k.stage==="egg",A=Ke(k),C=Le(k),T=C?.sauce??null,R=Xe(k),B=T?{"--sl-sauce-accent":T.accentColor,"--sl-sauce-bg":T.badgeBg}:{},v=h("div",{style:{minWidth:0,flex:1},children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"0.875rem"},children:M?o("saucelings.egg.name"):k.name}),M||!C?null:i("span",{className:"sl-badge",style:{fontSize:"0.65rem",padding:"0.1rem 0.45rem"},title:C.readsAs,children:T?o("saucelings.pet.sauce",{sauce:T.name}):o("saucelings.pet.temperament",{temperament:C.name})})]}),h("div",{style:{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",marginTop:"0.15rem"},children:[i(dt,{name:k.careProfile.characterName,src:_,small:!0}),i("span",{style:{opacity:.75,minWidth:0},children:M?`${o("saucelings.pet.eggCaretaker")} ${k.careProfile.characterName}`:`${A.name} \xB7 ${o("saucelings.pet.caretaker")} ${k.careProfile.characterName}`})]})]}),I=h("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"0.4rem",fontSize:"0.68rem"},children:[M?h(le,{children:[i(Ut,{label:o("saucelings.meter.warmth"),value:It(k),gap:y?.gaps.warmth}),i(Ut,{label:o("saucelings.meter.hatching"),value:At(k,u)})]}):h(le,{children:[i(Ut,{label:o("saucelings.meter.hunger"),value:k.meters.hunger,gap:y?.gaps.hunger}),i(Ut,{label:o("saucelings.meter.mood"),value:k.meters.mood,gap:y?.gaps.mood})]}),i(Ut,{label:o("saucelings.meter.bond"),value:k.meters.bond})]}),U=i("p",{style:{margin:0,fontSize:"0.75rem",opacity:.85,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:t?1:2,WebkitBoxOrient:"vertical"},children:y?.latestRemark}),$=H=>{(H.key==="Enter"||H.key===" ")&&a?.()};if(t)return h("div",{className:"sl-widget",style:B,role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:$,children:[h("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(Ie,{art:k,species:k.species,stage:R.stage,mood:kn(R.mood,l?.action??null,null),assetUrl:b,alt:M?o("saucelings.egg.name"):k.name,scale:1,still:!e,reaction:l}),v]}),I,U]});let q=y?mn(x,P,pn({gaps:y.gaps,line:null,speaking:!1,cheering:!1,caring:p}),S):null,W=M?[{key:"warmth",label:o("saucelings.meter.warmth"),value:It(k),gap:y?.gaps.warmth},{key:"hatching",label:o("saucelings.meter.hatching"),value:At(k,u),gap:!1}]:[{key:"hunger",label:o("saucelings.meter.hunger"),value:k.meters.hunger,gap:y?.gaps.hunger},{key:"mood",label:o("saucelings.meter.mood"),value:k.meters.mood,gap:y?.gaps.mood}];return W.push({key:"bond",label:o("saucelings.meter.bond"),value:k.meters.bond,gap:!1}),i("div",{className:"sl-widget sl-widget--stage",style:B,role:"button",tabIndex:0,"aria-label":M?o("saucelings.egg.name"):k.name,onClick:()=>a?.(),onKeyDown:$,children:h("div",{className:"sl-widget-body",children:[i("div",{className:"sl-widget-stage",onClick:H=>{M||H.stopPropagation()},children:i(En,{pet:k,reaction:l,assetUrl:b,backgroundSrc:D,paused:!e,caretaker:q,caretakerFlipped:y?.world.flippedCaretakers.includes(k.caretakerId),handle:g})}),h("div",{className:"sl-widget-hud",children:[i("div",{className:"sl-widget-bars",children:W.map(H=>i(Xi,{icon:Yi[H.key],label:H.label,value:H.value,gap:H.gap},H.key))}),i("div",{className:"sl-widget-acts",onClick:H=>H.stopPropagation(),onKeyDown:H=>H.stopPropagation(),children:rn(k).slice(0,2).map(H=>{let J=un(k,H,u),te=o(sn[H]),se=J>0?`${te} \xB7 ${o("saucelings.action.wait",{minutes:J})}`:te;return i("button",{type:"button",className:`sl-btn sl-widget-act ${y&&on(H,y.gaps)?"sl-btn--gap":""}`,"aria-label":se,title:se,disabled:m.isPending||J>0,onClick:()=>m.mutate(H),children:i("span",{"aria-hidden":"true",children:an[H]})},H)})})]})]})})}var qr=`
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

.sl-badge--plain { border-color: var(--border, rgba(255,255,255,0.2)); background: rgba(255,255,255,0.06); }

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
`;function Vr(){let e=ue(),[t,n]=G(null),s=ge((o,r)=>{let c=e.getQueryData(["saucelings","state"])?.characters.find(g=>g.id===o);if(!c||c.hasVoice){r?.(!0);return}n({characterId:o,name:c.name,onDone:r})},[e]),a=o=>{t?.onDone?.(o),n(null)};return{ask:s,dialog:t?i(Ji,{characterId:t.characterId,name:t.name,onFinish:a},t.characterId):null}}function Ji({characterId:e,name:t,onFinish:n}){let{t:s}=ee(),a=ue(),o=j(null),[r,l]=G("ask");X(()=>{let g=o.current;return g&&!g.open&&g.showModal(),g?.querySelector(".sl-btn--primary")?.focus(),()=>g?.close()},[]);let c=async()=>{l("reading"),o.current?.focus();try{let g=await V("/voice","POST",{characterId:e});a.setQueryData(["saucelings","state"],g),n(!0)}catch{l("failed")}};return h("dialog",{ref:o,className:"sl-dialog",tabIndex:-1,"aria-labelledby":"sl-voice-title",onCancel:g=>{g.preventDefault(),r!=="reading"&&n(!1)},children:[i("h2",{id:"sl-voice-title",children:s("saucelings.voice.title",{name:t})}),i("p",{role:"status",children:r==="reading"?s("saucelings.about.refreshingVoice",{name:t}):r==="failed"?s("saucelings.voice.failed",{name:t}):s("saucelings.voice.body",{name:t})}),r==="reading"?null:h("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(r==="ask"),children:s(r==="ask"?"saucelings.voice.notNow":"saucelings.voice.close")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",autoFocus:!0,onClick:()=>{c()},children:r==="ask"?s("saucelings.voice.read",{name:t}):s("saucelings.voice.tryAgain")})]})]})}var Zi=new fa({defaultOptions:{queries:{retry:!1,staleTime:5e3}}}),la=class extends va.Component{constructor(){super(...arguments);re(this,"state",{error:null})}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n){let s=n.message||at(this.props.element.capabilityProps?.localization,"saucelings.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Saucelings client capability stopped",n)}render(){return this.state.error?i("div",{className:"sl-shell",style:{padding:"1.5rem"},role:"alert",children:h("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},children:[i("strong",{children:at(this.props.element.capabilityProps?.localization,"saucelings.error.interface")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:this.state.error.message}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})},children:at(this.props.element.capabilityProps?.localization,"saucelings.error.retry")})})]})}):this.props.children}},el=["nook","journal","album","menagerie","settings"];function tl({props:e}){let{t}=ee(),[n,s]=G("nook"),a=Vr(),o=e.focusPostId,r=e.onFocusPostHandled;X(()=>{o&&r?.()},[o,r]);let l=ie({queryKey:["saucelings","state"],queryFn:()=>V("/state"),refetchOnMount:"always",refetchInterval:c=>c.state.data?.writing.length?2e3:!1});return h("div",{className:"sl-shell",children:[h("header",{className:"sl-header",children:[h("div",{className:"sl-header-title",children:[i("strong",{style:{fontSize:"1rem"},children:t("saucelings.title")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.subtitle")})]}),i("nav",{className:"sl-nav","aria-label":t("saucelings.nav.label"),children:el.map(c=>h("button",{type:"button",className:`sl-tab-btn ${n===c?"sl-tab-btn--active":""}`,onClick:()=>s(c),children:[t(`saucelings.tab.${c}`),c==="album"&&l.data?.portraitCount?h("span",{className:"sl-tab-count",children:[" (",l.data.portraitCount,")"]}):null,c==="menagerie"&&l.data?.menagerieCount?h("span",{className:"sl-tab-count",children:[" (",l.data.menagerieCount,")"]}):null]},c))})]}),i("main",{className:"sl-body",children:i("div",{className:"sl-container",children:l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.loading")}):l.isError||!l.data?h("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},role:"alert",children:[i("strong",{children:t("saucelings.error.load")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:l.error instanceof Error?l.error.message:t("saucelings.error.request")}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{l.refetch()},children:t("saucelings.error.retry")})})]}):n==="nook"?i(Br,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,askVoice:a.ask}):n==="journal"?i(yr,{state:l.data}):n==="album"?i(br,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion}):n==="menagerie"?i(wr,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,onRestored:c=>{s("nook"),a.ask(c)}}):i(Gr,{state:l.data})})}),a.dialog]})}function nl({element:e}){let t=e.capabilityProps??{},n=e.getAttribute("view"),s=typeof t.packageId=="string"?t.packageId:"saucelings",a=typeof t.packageVersion=="string"?t.packageVersion:null;return n==="widget"?i(Kr,{active:t.active===!0,compact:t.widgetId==="sauceling-compact",packageId:s,packageVersion:a,onOpenNoodle:typeof t.onOpenNoodle=="function"?t.onOpenNoodle:void 0}):i(tl,{props:t})}function al({element:e}){let[,t]=G(0);return X(()=>{let n=()=>t(s=>s+1);return e.addEventListener("marinara-capability-props",n),()=>e.removeEventListener("marinara-capability-props",n)},[e]),h(Ra,{localization:e.capabilityProps?.localization,children:[i("style",{children:qr}),i(Js,{}),i(la,{element:e,children:i(nl,{element:e})})]})}var Cn=class extends HTMLElement{constructor(){super(...arguments);re(this,"__root",null);re(this,"capabilityProps");re(this,"capabilityRuntimeError")}attributeChangedCallback(n,s,a){n==="view"&&s!==a&&this.__root&&this.render()}render(){this.__root?.render(i(ha,{client:Zi,children:i(al,{element:this})}))}connectedCallback(){this.__root||(this.__root=xa(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};re(Cn,"observedAttributes",["view"]);var Wr="marinara-capability-saucelings";customElements.get(Wr)||customElements.define(Wr,Cn);
