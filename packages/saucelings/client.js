var Co=Object.defineProperty;var Ro=(e,t,n)=>t in e?Co(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var oe=(e,t,n)=>Ro(e,typeof t!="symbol"?t+"":t,n);var Yt=globalThis.__MARINARA_HOST__,K=Yt&&Yt.version===1&&Yt.modules?Yt.modules["@tanstack/react-query"]:void 0;if(!K)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var Gl=K.CancelledError,Kl=K.HydrationBoundary,ql=K.InfiniteQueryObserver,Vl=K.IsRestoringProvider,jl=K.Mutation,Ql=K.MutationCache,Wl=K.MutationObserver,Yl=K.QueriesObserver,Xl=K.Query,Jl=K.QueryCache,$a=K.QueryClient,Zl=K.QueryClientContext,Ha=K.QueryClientProvider,ec=K.QueryErrorResetBoundary,tc=K.QueryObserver,nc=K.dataTagErrorSymbol,ac=K.dataTagSymbol,sc=K.defaultScheduler,rc=K.defaultShouldDehydrateMutation,oc=K.defaultShouldDehydrateQuery,ic=K.dehydrate,lc=K.dehydrateQuery,cc=K.environmentManager,uc=K.experimental_streamedQuery,gc=K.focusManager,dc=K.hashKey,pc=K.hydrate,mc=K.infiniteQueryOptions,fc=K.isCancelledError,hc=K.isServer,bc=K.keepPreviousData,yc=K.matchMutation,vc=K.matchQuery,wc=K.mutationOptions,Sc=K.noop,kc=K.notifyManager,xc=K.onlineManager,Ec=K.partialMatchKey,Cc=K.queryOptions,Rc=K.replaceEqualDeep,Nc=K.shouldThrowError,Mc=K.skipToken,Ic=K.timeoutManager,Tc=K.unsetMarker,Ac=K.useInfiniteQuery,Pc=K.useIsFetching,_c=K.useIsMutating,Oc=K.useIsRestoring,ne=K.useMutation,Ua=K.useMutationState,Fc=K.usePrefetchInfiniteQuery,Lc=K.usePrefetchQuery,$c=K.useQueries,ue=K.useQuery,pe=K.useQueryClient,Hc=K.useQueryErrorResetBoundary,Uc=K.useSuspenseInfiniteQuery,Dc=K.useSuspenseQueries,Bc=K.useSuspenseQuery;var Xt=globalThis.__MARINARA_HOST__,Y=Xt&&Xt.version===1&&Xt.modules?Xt.modules.react:void 0;if(!Y)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var Gc=Y.Activity,Kc=Y.Children,qc=Y.Component,Vc=Y.Fragment,jc=Y.Profiler,Qc=Y.PureComponent,Wc=Y.StrictMode,Yc=Y.Suspense,Xc=Y.ViewTransition,Jc=Y.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Zc=Y.__COMPILER_RUNTIME,eu=Y.act,tu=Y.addTransitionType,nu=Y.cache,au=Y.cacheSignal,su=Y.captureOwnerStack,ru=Y.cloneElement,Da=Y.createContext,ou=Y.createElement,iu=Y.createRef,Ba=Y.default,lu=Y.forwardRef,cu=Y.isValidElement,uu=Y.lazy,gu=Y.memo,du=Y.startTransition,pu=Y.unstable_useCacheRefresh,mu=Y.use,fu=Y.useActionState,me=Y.useCallback,za=Y.useContext,hu=Y.useDebugValue,bu=Y.useDeferredValue,q=Y.useEffect,yu=Y.useEffectEvent,Jt=Y.useId,Ga=Y.useImperativeHandle,vu=Y.useInsertionEffect,je=Y.useLayoutEffect,Zt=Y.useMemo,wu=Y.useOptimistic,Su=Y.useReducer,j=Y.useRef,F=Y.useState,ku=Y.useSyncExternalStore,xu=Y.useTransition,Eu=Y.version;var en=globalThis.__MARINARA_HOST__,Ct=en&&en.version===1&&en.modules?en.modules["react-dom/client"]:void 0;if(!Ct)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var Ka=Ct.createRoot,Ru=Ct.default,Nu=Ct.hydrateRoot,Mu=Ct.version;var No="/api/saucelings",Mo="x-marinara-csrf";var Io="marinara_admin_secret";function To(){if(typeof window>"u")return{};try{let e=window.localStorage.getItem(Io)?.trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function V(e,t="GET",n,s){return Re(`${No}${e}`,t,n,s)}async function Re(e,t="GET",n,s){let a=new Headers(To());t!=="GET"&&a.set(Mo,"1"),n!==void 0&&a.set("Content-Type","application/json");let r=await fetch(e,{method:t,headers:a,signal:s,cache:"no-store",credentials:"same-origin",...n===void 0?{}:{body:JSON.stringify(n)}});if(!r.ok){let o=await r.json().catch(()=>null),l=typeof o?.error=="string"?o.error:typeof o?.message=="string"?o.message:r.statusText;throw Object.assign(new Error(l||"Saucelings request failed"),{status:r.status})}return r.json()}function tn(e,t){let n=e instanceof Error?e.message:"",s=e?.status,a=e instanceof Error?e.name:"",r=a==="AbortError"||a==="TimeoutError"?"saucelings.error.timeout":e instanceof TypeError&&s===void 0&&/fetch|network|load failed/i.test(n)?"saucelings.error.network":s===502?"saucelings.error.writing":s===404&&n==="Not Found"?"saucelings.error.restart":typeof s=="number"&&s>=500&&(!n||/^internal server error$/i.test(n))?"saucelings.error.engine":null;return r?{message:t(r),details:n||null}:{message:n||t("saucelings.error.request"),details:null}}function Qe(e="saucelings",t,n){let s=`/api/capability-packages/${encodeURIComponent(e)}/assets/${t}`;return n?`${s}?v=${encodeURIComponent(n)}`:s}var qa=["prismite","thundrake","clockrit"],Va=["wickwisp","cauldrop","webbit"],ja=["rigamuffin","fluttino","lentino","shellbini","tortellump"];var Be=["egg","hatchling","juvenile","adult","elder"],Qa=["hatchling","juvenile","adult","elder"];var $n=["feed","play","rest","pet"],Hn=["warm","talk","listen"],Au=[...$n,...Hn],Un=1800*1e3,Wa=70,Ya=35;var Ao=["feed","fedBadly","overfed","forgot","play","cuddle","milestone","warmEgg","letCool","chatEgg","hatch","stageUp"],Po=["hello","farewell","checkInEgg","checkInContent","checkInHungry","checkInSad","backSoon","backLong","returnHome","eggFound","eggFoundTalking","anotherEgg","eggFoundByOther","evolveOffer","evolve","temperamentShift","takesAfter","eggFarewell","eggReturn"],Pu=[...Ao,...Po];var Rt=["halo","crown","star","flame","moon","leaf","gem","snowflake","cloud","bolt","feather","heart","mushroom","orb","bow","flower","shell"],nn=["embers","snow","leaves","petals","stars","glints","wisps","sparks","bubbles"];var ut={ember:{aura:"embers",extras:["flame","star","crown"],moves:["firepuff","roar"]},frost:{aura:"snow",extras:["snowflake","gem","moon"],moves:["icicles","twirl"]},moss:{aura:"leaves",extras:["leaf","mushroom","feather"],moves:["leafwhirl","wiggle"]},dusk:{aura:"stars",extras:["moon","star","orb"],moves:["starburst","float"]},gilded:{aura:"glints",extras:["crown","halo","gem"],moves:["coinshower","sparkle","shine"]},shade:{aura:"wisps",extras:["moon","orb","feather"],moves:["shockwave","vanish"]},bloom:{aura:"petals",extras:["flower","heart","bow"],moves:["petalshower","triplehop"]},storm:{aura:"sparks",extras:["bolt","cloud","orb"],moves:["zap","dash"]},tide:{aura:"bubbles",extras:["shell","gem","orb"],moves:["bubbleblow","splash"]}},Xa=200,Dn=24,Bn=24;var rs={egg:32,hatchling:29,juvenile:37,adult:45,elder:46},Te=(e,t)=>({data:new Uint8ClampedArray(e*t*4),width:e,height:t}),an=(e,t,n,s)=>{let a=[0,0,0],r=0;for(let o=n;o<Math.min(n+s,e.height);o++)for(let l=t;l<Math.min(t+s,e.width);l++){let c=(o*e.width+l)*4;a[0]+=e.data[c],a[1]+=e.data[c+1],a[2]+=e.data[c+2],r++}return[Math.round(a[0]/r),Math.round(a[1]/r),Math.round(a[2]/r)]};function Vn(e,t=48){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s};if(n===0||s===0)return a;let r=4,o=[an(e,0,0,r),an(e,Math.max(0,n-r),0,r),an(e,0,Math.max(0,s-r),r),an(e,Math.max(0,n-r),Math.max(0,s-r),r)],l=(b,d)=>Math.max(Math.abs(b[0]-d[0]),Math.abs(b[1]-d[1]),Math.abs(b[2]-d[2]))<=t,c=o[0],u=0;for(let b of o){let d=o.filter(v=>l(b,v)).length;d>u&&(u=d,c=b)}let p=b=>{let d=b*4;return e.data[d+3]<16||l([e.data[d],e.data[d+1],e.data[d+2]],c)},g=new Uint8Array(n*s),m=new Int32Array(n*s),h=0,y=b=>{g[b]||!p(b)||(g[b]=1,m[h++]=b)};for(let b=0;b<n;b++)y(b),y((s-1)*n+b);for(let b=0;b<s;b++)y(b*n),y(b*n+n-1);for(;h>0;){let b=m[--h];a.data[b*4+3]=0;let d=b%n;d>0&&y(b-1),d<n-1&&y(b+1),b>=n&&y(b-n),b<n*(s-1)&&y(b+n)}return a}function Nt(e,t=128){let n=e.width,s=e.height,a=-1,r=-1;for(let o=0;o<e.height;o++)for(let l=0;l<e.width;l++)e.data[(o*e.width+l)*4+3]<t||(l<n&&(n=l),l>a&&(a=l),o<s&&(s=o),o>r&&(r=o));return a<0?null:{x:n,y:s,width:a-n+1,height:r-s+1}}var sn=(e,t,n,s,a,r)=>{let o=Te(s,s),l=Math.max(1,Math.round(t.width*n)),c=Math.max(1,Math.round(t.height*n)),u=r===void 0?Math.floor((s-l)/2):r-l,p=s-a-c,g=n<1;for(let m=0;m<c;m++)if(!(p+m<0||p+m>=s))for(let h=0;h<l;h++){if(u+h<0||u+h>=s)continue;let y=h*t.width/l,b=(h+1)*t.width/l,d=m*t.height/c,v=(m+1)*t.height/c,C=0,k=0,P=0,U=0,H=0,E=Math.floor(y),x=Math.floor(d),R=g?Math.ceil(b):E+1,O=g?Math.ceil(v):x+1;for(let S=x;S<Math.min(O,t.height);S++)for(let I=E;I<Math.min(R,t.width);I++){let M=g?(Math.min(I+1,b)-Math.max(I,y))*(Math.min(S+1,v)-Math.max(S,d)):1,A=((t.y+S)*e.width+t.x+I)*4,N=e.data[A+3];C+=M,k+=M*N,P+=M*N*e.data[A],U+=M*N*e.data[A+1],H+=M*N*e.data[A+2]}if(k<=0||k/C<128)continue;let L=((p+m)*s+u+h)*4;o.data[L]=Math.round(P/k),o.data[L+1]=Math.round(U/k),o.data[L+2]=Math.round(H/k),o.data[L+3]=255}return o};function _o(e,t,n=52,s=2,a){let r=Nt(e);return r?sn(e,r,a??Math.min(t/r.height,(n-4)/r.width),n,s):Te(n,n)}function Oo(e,t){let n=Math.max(1,Math.floor(t)),s=Te(e.width*n,e.height*n);for(let a=0;a<s.height;a++)for(let r=0;r<s.width;r++){let o=(Math.floor(a/n)*e.width+Math.floor(r/n))*4;s.data.set(e.data.subarray(o,o+4),(a*s.width+r)*4)}return s}var os=e=>{let t=-1,n=-1;for(let s=0;s<e.height;s++)for(let a=0;a<e.width;a++)if(e.data[(s*e.width+a)*4+3]!==0){t<0&&(t=s),n=s;break}return t<0?null:{top:t,bottom:n}},rn=(e,t,n,s)=>{let a=e.width*4;n.data.set(e.data.subarray(t*a,t*a+a),s*a)};function is(e){let t=1/0,n=[0,0,0];for(let s=0;s<e.data.length;s+=4){if(e.data[s+3]===0)continue;let a=e.data[s]+e.data[s+1]+e.data[s+2];a<t&&(t=a,n=[e.data[s],e.data[s+1],e.data[s+2]])}return n}function Mt(e,t){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s},r=(o,l)=>o>=0&&l>=0&&o<n&&l<s&&e.data[(l*n+o)*4+3]>0;for(let o=0;o<s;o++)for(let l=0;l<n;l++)!r(l,o)||r(l-1,o)&&r(l+1,o)&&r(l,o-1)&&r(l,o+1)||a.data.set([t[0],t[1],t[2]],(o*n+l)*4);return a}function ls(e){let t=os(e);if(!t)return 0;let n=Math.max(1,t.top+Math.floor((t.bottom-t.top)/2)),s=t.bottom-2,a=Math.min(n,t.bottom),r=1/0,o=e.width*4;for(let l=n;l<=s;l++){let c=0;for(let u=0;u<e.width;u++){let p=l*o+u*4,g=p-o;(e.data[p]!==e.data[g]||e.data[p+1]!==e.data[g+1]||e.data[p+2]!==e.data[g+2]||e.data[p+3]!==e.data[g+3])&&c++}c<=r&&(r=c,a=l)}return a}function cs(e,t){let n=Te(e.width,e.height);for(let s=0;s<e.height;s++)s!==0&&(s<=t?rn(e,s-1,n,s):rn(e,s,n,s));return n}function Fo(e,t){let n=Te(e.width,e.height);for(let s=0;s<e.height;s++)s<t-1?rn(e,s+1,n,s):rn(e,s,n,s);return n}function Ja(e,t){let n=Te(e.width,e.height),s=os(e);if(!s)return n;let a=s.bottom-s.top+1;for(let r=0;r<e.height;r++){let o=t*(r<s.top+a/3?2:r<s.top+2*a/3?1:0);for(let l=0;l<e.width;l++){let c=l+o;if(c<0||c>=e.width)continue;let u=(r*e.width+l)*4;n.data.set(e.data.subarray(u,u+4),(r*e.width+c)*4)}}return n}function us(e){let t=is(e),n=ls(e);return[e,Mt(cs(e,n),t),Mt(Fo(e,n),t)]}function gs(e){let t=is(e);return[e,Mt(Ja(e,-1),t),Mt(Ja(e,1),t)]}function It(e,t=2){let n=e.reduce((r,o)=>r+o.width,0),s=Te(n,e[0]?.height??0),a=0;for(let r of e){for(let o=0;o<r.height;o++)s.data.set(r.data.subarray(o*r.width*4,(o+1)*r.width*4),(o*n+a)*4);a+=r.width}return Oo(s,t)}var Lo=e=>{let{width:t,height:n}=e,s=new Uint8Array(t*n),a=(r,o)=>r>=0&&o>=0&&r<t&&o<n&&e.data[(o*t+r)*4+3]>=128?1:0;for(let r=0;r<n;r++)for(let o=0;o<t;o++){if(!a(o,r))continue;let l=0;for(let c=-1;c<=1;c++)for(let u=-1;u<=1;u++)(u||c)&&(l+=a(o+u,r+c));l>=2&&(s[r*t+o]=1)}return s};function jn(e,t=16){let n=e.map(Lo),s=new Int32Array(4096),a=new Int32Array(4096),r=[];e.forEach((m,h)=>{for(let y=0;y<m.width*m.height;y++){if(!n[h][y])continue;let b=m.data[y*4],d=m.data[y*4+1],v=m.data[y*4+2],C=b>>4<<8|d>>4<<4|v>>4;s[C]++===0&&(a[C]=b<<16|d<<8|v,r.push(C))}});let o=r.map(m=>({c:[a[m]>>16,a[m]>>8&255,a[m]&255],w:Math.ceil(Math.sqrt(s[m]))})),l=m=>{let h=-1,y=0;for(let b=0;b<3;b++){let d=255,v=0;for(let C of m)d=Math.min(d,C.c[b]),v=Math.max(v,C.c[b]);v-d>h&&(h=v-d,y=b)}return{spread:h,channel:y}},c=o.length?[o]:[];for(;c.length<t;){let m=-1,h=0;if(c.forEach((P,U)=>{if(P.length<2)return;let{spread:H}=l(P);H>h&&(h=H,m=U)}),m<0)break;let y=c[m],{channel:b}=l(y),d=[...y].sort((P,U)=>P.c[b]-U.c[b]),v=d.reduce((P,U)=>P+U.w,0)/2,C=0,k=1;for(let P=0;P<d.length-1&&(C+=d[P].w,k=P+1,!(C>=v));P++);c.splice(m,1,d.slice(0,k),d.slice(k))}let u=c.map(m=>{let h=m.reduce((y,b)=>y+b.w,0);return[0,1,2].map(y=>Math.round(m.reduce((b,d)=>b+d.w*d.c[y],0)/h))}),p=u[0]??[0,0,0];for(let m of u)m[0]+m[1]+m[2]<p[0]+p[1]+p[2]&&(p=m);let g=new Map;return e.map((m,h)=>{let y=Te(m.width,m.height);for(let b=0;b<m.width*m.height;b++){if(!n[h][b])continue;let d=m.data[b*4],v=m.data[b*4+1],C=m.data[b*4+2],k=d<<16|v<<8|C,P=g.get(k);if(P===void 0){let U=1/0;P=0,u.forEach((H,E)=>{let x=(H[0]-d)**2+(H[1]-v)**2+(H[2]-C)**2;x<U&&(U=x,P=E)}),g.set(k,P)}y.data.set([...u[P],255],b*4)}return Mt(y,p)})}var zn=(e,t,n)=>{let s=[],a=-1,r=-1;for(let o=0;o<e.length;o++)e[o]&&(a>=0&&o-r>t&&(s.push([a,r+1]),a=-1),a<0&&(a=o),r=o);return a>=0&&s.push([a,r+1]),s.filter(([o,l])=>l-o>=n)},ds=e=>e.map(t=>t==="egg"?2:4);function on(e,t,n=!0,s=!1){let a=Vn(e),{width:r,height:o}=a,l=new Uint8Array(r*o);for(let E=0;E<l.length;E++)l[E]=a.data[E*4+3]>=128?1:0;let c=Math.max(r,o)/1024,u=Math.round(10*c),p=Math.round(16*c),g=[],m=(E,x,R,O)=>{let L=new Int32Array(o);for(let S=R;S<O;S++)for(let I=E;I<x;I++)L[S]+=l[S*r+I];return L},h=(E,x,R,O)=>{let L=new Int32Array(r);for(let S=R;S<O;S++)for(let I=E;I<x;I++)L[I]+=l[S*r+I];return L},y=(E,x,R)=>{let O=x;for(let L=x;L<R;L++)E[L]<E[O]&&(O=L);return O},b=(E,x,R)=>{let O=E.r-E.l,L=E.b-E.t,S=new Int32Array(O*L).fill(-1),I=[],M=(w,T)=>l[(E.t+T)*r+E.l+w]===1;for(let w=0;w<O*L;w++){if(S[w]!==-1||!M(w%O,Math.floor(w/O)))continue;let T={size:0,l:O,t:L,r:0,b:0};S[w]=I.length;let B=[w];for(;B.length;){let D=B.pop(),G=D%O,Q=(D-G)/O;T.size++,T.l=Math.min(T.l,G),T.r=Math.max(T.r,G+1),T.t=Math.min(T.t,Q),T.b=Math.max(T.b,Q+1);for(let[ee,re]of[[G-1,Q],[G+1,Q],[G,Q-1],[G,Q+1]]){let te=re*O+ee;ee>=0&&re>=0&&ee<O&&re<L&&S[te]===-1&&M(ee,re)&&(S[te]=I.length,B.push(te))}}I.push(T)}let A=Math.max(...I.map(w=>w.size)),N=I.map(w=>w.size!==A&&(E.l+w.l===x||E.l+w.r===R));for(let w=0;w<O*L;w++)S[w]>=0&&N[S[w]]&&(a.data[((E.t+Math.floor(w/O))*r+E.l+w%O)*4+3]=0);let z=I.filter((w,T)=>!N[T]);return{l:E.l+Math.min(...z.map(w=>w.l)),t:E.t+Math.min(...z.map(w=>w.t)),r:E.l+Math.max(...z.map(w=>w.r)),b:E.t+Math.max(...z.map(w=>w.b))}},d=m(0,r,0,o),v=zn(d,u,p);if(!v.length)return null;let k=.3*v.map(([E,x])=>x-E).sort((E,x)=>E-x)[Math.floor(v.length/2)];for(v=v.filter(([E,x])=>x-E>=k),s&&(v=v.slice(0,t.length));v.length<t.length;){let E=0;v.forEach(([M,A],N)=>{A-M>v[E][1]-v[E][0]&&(E=N)});let[x,R]=v[E],O=x+Math.floor(.3*(R-x)),L=x+Math.floor(.7*(R-x));if(L<=O)return null;let S=y(d,O,L);if(S<=x)return null;let I=v.filter((M,A)=>A!==E).map(([M,A])=>A-M);if(I.length){if(R-x<1.4*Math.max(...I))return null}else{let M=Array.from(d.subarray(x,R)).sort((A,N)=>A-N)[Math.floor((R-x)/2)];if(d[S]>=.25*M)return null}v.splice(E,1,[x,S],[S,R])}if(v.length!==t.length)return null;let P=[];for(let E=0;E<v.length;E++){let[x,R]=v[E],O=t[E],L=h(0,r,x,R),S=zn(L,u,p);if(!S.length)return null;let I=S.map(([w,T])=>{let B=m(w,T,x,R),D=x;for(;!B[D];)D++;let G=R-1;for(;!B[G];)G--;return{h:G-D+1,w:T-w}}),M=Math.max(...I.map(w=>w.h)),A=Math.max(...I.map(w=>w.w));if(S=S.filter((w,T)=>I[T].h>=.6*M||I[T].w>=.6*A),S.length>2*O)return null;let N=!1;if(S.length>O)g.push(`row ${E+1}: ${S.length} drawings, first ${O} used`),S=S.slice(0,O);else if(S.length<O){if(!n)return null;let w=S[0][0],T=S[S.length-1][1],B=(T-w)/O;if(!S.some(([G,Q])=>Q-G>1.5*B))return null;let D=[w];for(let G=1;G<O;G++)D.push(y(L,Math.floor(w+(G-.15)*B),Math.floor(w+(G+.15)*B)));D.push(T),S=D.slice(0,-1).map((G,Q)=>[G,D[Q+1]]),N=!0,g.push(`row ${E+1}: drawings touch, split at ${D.slice(1,-1).join(", ")}`)}let z=[];for(let[w,T]of S){let B=(Q,ee)=>{let re=m(w,T,Q,ee),te=h(w,T,Q,ee),fe=Q;for(;fe<ee&&!re[fe];)fe++;if(fe===ee)return null;let ge=ee-1;for(;!re[ge];)ge--;let he=w;for(;!te[he];)he++;let ke=T-1;for(;!te[ke];)ke--;return{l:he,t:fe,r:ke+1,b:ge+1,rows:re}},D=B(x,R);if(!D)return null;let G=zn(D.rows.subarray(0,D.b),1,1).filter(([,Q])=>Q>D.t);if(G.length>1){let[Q,ee]=G[G.length-1],re=h(w,T,Q,ee),te=w;for(;!re[te];)te++;let fe=T-1;for(;!re[fe];)fe--;let ge=fe-te+1;ee-Q<=.12*(D.b-D.t)&&ge>=4*(ee-Q)&&ge>=.4*(D.r-D.l)&&(D=B(x,G[G.length-2][1])??D)}if(N){let Q=w===S[0][0]?-1:w,ee=T===S[S.length-1][1]?-1:T;D={...D,...b(D,Q,ee)}}z.push({x:D.l,y:D.t,width:D.r-D.l,height:D.b-D.t})}P.push(z)}let U=t.length===5?0:-1;if(U===0&&P[0].length>1){let[E,x]=[P[0][0].height,P[0][1].height];Math.abs(E-x)>.25*Math.max(E,x)&&g.push(`egg row sizes differ: ${E} vs ${x}`)}let H=E=>E[E.length>=4?1:0];for(let E=U+2;E<P.length;E++){let[x,R]=[H(P[E]).height,H(P[E-1]).height];x<R*.95&&g.push(`row ${E+1} (${x}) smaller than row ${E} (${R})`)}for(let E=U+1;E<P.length;E++){let x=P[E];if(x.length<2)continue;let[R,O]=[H(x).height,x[x.length-1].height];Math.abs(R-O)>.3*Math.max(R,O)&&g.push(`row ${E+1}: front ${R} vs side ${O}`)}return{cells:P,notes:g,keyed:a}}function ps(e,t,n){let s=t.keyed??Vn(e),a=t.cells.map((c,u)=>{let p=n[u];if(!p)return[];let g=Math.min(rs[p]/Math.max(...c.map(m=>m.height)),48/Math.max(...c.map(m=>m.width)));return c.map(m=>sn(s,m,g,52,2))}),r=jn(a.flat()),o={},l=0;return a.forEach((c,u)=>{let p=r.slice(l,l+c.length);l+=c.length;let g=n[u];if(!g||!p.length)return;let m=h=>It(g==="egg"?gs(p[h]):us(p[h]));g==="egg"?o[g]={image:m(0)}:p.length>=4?o[g]={image:m(1),happy:m(0),grumpy:m(2),side:m(3)}:o[g]=p.length>1?{image:m(0),side:m(1)}:{image:m(0)}}),o}var Fe=96,tt=[5,3],$o=80,Ho=48;function Uo(e){let t=[[[...tt],!1],[[4,4],!1],[[...tt],!0]];for(let[s,a]of t){let r=on(e,s,a),o=r?.cells.flat();if(r&&o)return{front:o.slice(0,tt[0]),facing:o.slice(tt[0]),keyed:r.keyed}}let n=on(e,[3],!1,!0);return n?{front:n.cells[0],facing:[],keyed:n.keyed}:null}function ms(e){let t=Uo(e);if(!t)return null;let{front:n,facing:s,keyed:a}=t,r=Math.max(...n.map(g=>g.width)),o=Math.max(...s.map(g=>g.width))-r/2,l=Math.min($o/Math.max(...[...n,...s].map(g=>g.height)),Ho/r,o>0?(Fe/2-2)/o:1/0),c=Math.max(1,Math.round(r*l)),u=Math.floor((Fe-c)/2)+c,p=jn([...n.map(g=>sn(a,g,l,Fe,0)),...s.map(g=>sn(a,g,l,Fe,0,u))]);return p.every(g=>Nt(g))?It(p,1):null}var ln=(e,t)=>{let n=e.height,s=Te(n,n);for(let a=0;a<n;a++){let r=(a*e.width+t*n)*4;s.data.set(e.data.subarray(r,r+n*4),a*n*4)}return s},Za=[.12,.42],Do=50,Bo=45,es=50,zo=.04,gt=e=>e>>16,dt=e=>e>>8&255,pt=e=>e&255,We=e=>.299*gt(e)+.587*dt(e)+.114*pt(e),ts=e=>Math.max(gt(e),dt(e),pt(e))-Math.min(gt(e),dt(e),pt(e)),Gn=(e,t)=>Math.hypot(gt(e)-gt(t),dt(e)-dt(t),pt(e)-pt(t)),Kn=e=>e.reduce((t,n)=>We(n)<We(t)?n:t);function Go(e){let t=Nt(e);if(!t)return null;let{width:n,height:s,data:a}=e,r=new Int32Array(n*s).fill(-1);for(let u=0;u<n*s;u++)a[u*4+3]>=128&&(r[u]=a[u*4]<<16|a[u*4+1]<<8|a[u*4+2]);let o=t.y+Math.round(t.height*Za[0]),l=t.y+Math.round(t.height*Za[1]),c=new Map;for(let u=o*n;u<l*n;u++){let p=r[u];p>=0&&c.set(p,(c.get(p)??0)+1)}return{colours:r,width:n,z0:o,z1:l,counts:c}}var qn=(e,t)=>{let n=e.map(a=>a%t),s=e.map(a=>Math.floor(a/t));return{x0:Math.min(...n),x1:Math.max(...n),y0:Math.min(...s),y1:Math.max(...s)}};function fs(e,t,n){let{colours:s,width:a,z0:r,z1:o}=e,l=n?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]],c=new Uint8Array(s.length),u=[];for(let p=r*a;p<o*a;p++){if(c[p]||s[p]<0||!t(s[p]))continue;c[p]=1;let g=[p],m=[],h=!1;for(;g.length;){let y=g.pop();m.push(y);for(let[b,d]of l){let v=y%a+b,C=Math.floor(y/a)+d,k=C*a+v;v<0||v>=a||C<r||C>=o||s[k]<0?h=!0:!c[k]&&t(s[k])&&(c[k]=1,g.push(k))}}u.push({pixels:m,open:h})}return u}var hs=(e,t)=>e.x1-e.x0<10&&e.y1-e.y0<8&&e.y1-e.y0+1>=t;function Ko(e){return[...e.counts].filter(([,n])=>n>=30).sort((n,s)=>s[1]-n[1]).slice(0,4).map(([n])=>n).flatMap(n=>fs(e,s=>Gn(s,n)>Do,!1).flatMap(({pixels:s,open:a})=>{let r=qn(s,e.width),o=s.map(c=>e.colours[c]);if(a||s.length<2||s.length>40||!hs(r,2))return[];if(Math.max(...o.map(c=>Gn(c,n)))<90)return[];let l=Kn(o);return[{pixels:s,...r,fill:n,lid:We(n)>We(l)+40?l:null}]}))}function qo(e){let t=[...e.counts.values()].reduce((l,c)=>l+c,0),n=[...e.counts].filter(([,l])=>l>=t*zo).map(([l])=>l);if(!n.length)return[];let s=l=>l>=0&&n.every(c=>Gn(l,c)>Bo),a=Kn(n),{width:r,colours:o}=e;return fs(e,l=>ts(l)>=es&&s(l),!0).flatMap(({pixels:l})=>{if(l.length<2||l.length>36)return[];let c=qn(l,r),u=new Set(l),p=[...l];for(;p.length;){let b=p.pop();for(let d of[1,-1,r,-r,r+1,r-1,1-r,-1-r]){let v=b+d,C=v%r,k=Math.floor(v/r);u.has(v)||C<c.x0-1||C>c.x1+1||k<c.y0-1||k>c.y1+1||k<e.z0||k>=e.z1||!s(o[v])||(u.add(v),p.push(v))}}let g=[...u],m=qn(g,r);if(!hs(m,1))return[];let h=new Map;for(let b of g){let d=b+r;for(;u.has(d);)d+=r;let v=o[d]??-1;v>=0&&h.set(v,(h.get(v)??0)+1)}let y=[...h].sort((b,d)=>d[1]-b[1])[0]?.[0];return y===void 0||ts(y)>=es&&!n.includes(y)?[]:Math.abs(We(y)-We(Kn(g.map(b=>o[b]))))<60?[]:[{pixels:g,...m,fill:y,lid:We(y)>We(a)+60?a:null}]})}function ns(e){let t=null;for(let n of e)for(let s of e){let a=s.x0-n.x1-1,r=Math.abs(n.y0+n.y1-s.y0-s.y1)/2,o=Math.max(n.pixels.length,s.pixels.length)/Math.min(n.pixels.length,s.pixels.length);if(a<2||a>20||r>1.5||o>2.5||Math.abs(n.y1-n.y0-(s.y1-s.y0))>2)continue;let l=n.pixels.length+s.pixels.length-r*4-o*3;(!t||l>t.score)&&(t={pair:[n,s],score:l})}return t?.pair??null}function as(e){let t=Go(e);return t?ns(Ko(t))??ns(qo(t)):null}var Vo=(e,t)=>e.every((n,s)=>Math.abs(n.y0+n.y1-t[s].y0-t[s].y1)<=4&&Math.abs(n.x1-n.x0-(t[s].x1-t[s].x0))<=2)&&Math.abs(e[1].x0-e[0].x1-(t[1].x0-t[0].x1))<=2;function jo(e){let t=e.height,n=Math.floor(e.width/t),s=n===tt[0]+tt[1]?tt[0]:Math.min(n,3),a=n?as(ln(e,0)):null;if(!a)return null;let r=Array.from({length:n},(o,l)=>{let c=Te(t,t),u=l<s?as(ln(e,l)):null;if(!u||!Vo(u,a))return c;let p=(g,m)=>c.data.set([gt(m),dt(m),pt(m),255],g*4);for(let g of u){for(let h of g.pixels)p(h,g.fill);if(g.lid===null)continue;let m=g.y0+Math.floor((g.y1-g.y0+1)*.6);for(let h=g.x0;h<=g.x1;h++)p(m*t+h,g.lid)}return c});return It(r,1)}var ss=(e,t)=>{let n=Te(e.width,e.height+t.height);return n.data.set(e.data),n.data.set(t.data,e.data.length),n};function bs(e){let t=Math.floor(e.width/e.height),n=Array.from({length:t},(r,o)=>ls(ln(e,o))),s=r=>It(n.map((o,l)=>cs(ln(r,l),o)),1),a=jo(e);return{body:ss(e,s(e)),blink:a?ss(a,s(a)):null}}var Qo=.25,Wo=20;function Yo(e){let{width:t,height:n,data:s}=e,a=u=>s[u*4+3]>0,r=0,o=0,l=0,c=0;for(let u=0;u<n;u++)for(let p=0;p<t;p++){let g=u*t+p,m=p===0||u===0||p===t-1||u===n-1;m&&r++,a(g)&&(l++,m&&o++,(p>0&&!a(g-1)||p<t-1&&!a(g+1)||u>0&&!a(g-t)||u<n-1&&!a(g+t))&&c++)}return o<=r*Qo&&c<=Math.sqrt(l)*Wo}function ys(e,t){let n=Vn(e);if(!Nt(n)||!Yo(n))return null;let s=jn([_o(n,rs[t])])[0];return Nt(s)?It(t==="egg"?gs(s):us(s)):null}var vs=104,mt=416,ws="#ececec",Xo=512,Ss=1024,Jo=512,Zo=1024;function Le(e){return new Promise((t,n)=>{let s=new Image;s.onload=()=>t(s),s.onerror=()=>n(new Error("That file is not a picture this browser can open.")),s.src=e})}function Tt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d");if(!s)throw new Error("This browser cannot draw pictures.");return{canvas:n,context:s}}function Ye(e){let{canvas:t,context:n}=Tt(e.width,e.height);return n.putImageData(new ImageData(new Uint8ClampedArray(e.data),e.width,e.height),0,0),t.toDataURL("image/png")}function Qn(e,t){let n=Math.min(1,t/Math.max(e.naturalWidth,e.naturalHeight));return{width:Math.max(1,Math.round(e.naturalWidth*n)),height:Math.max(1,Math.round(e.naturalHeight*n))}}async function cn(e,t){let n=await Le(e),{width:s,height:a}=Qn(n,t),r=Tt(s,a);return r.context.drawImage(n,0,0,s,a),r.context.getImageData(0,0,s,a)}async function ks(e,t){let n=ys(await cn(e,Xo),t);return n?Ye(n):null}async function xs(e,t){let n=await cn(e,Ss),s=on(n,ds(t));if(!s)return null;let a={};for(let[r,o]of Object.entries(ps(n,s,t)))a[r]={image:Ye(o.image),...o.side?{side:Ye(o.side)}:{},...o.happy?{happy:Ye(o.happy)}:{},...o.grumpy?{grumpy:Ye(o.grumpy)}:{}};return a}async function Es(e){let t=ms(await cn(e,Ss));return t?{image:Ye(t),frames:t.width/t.height}:null}async function Cs(e){let{body:t,blink:n}=bs(await cn(e,1/0));return{body:Ye(t),blink:n?Ye(n):null}}async function Rs(e){let t=await Le(e),{width:n,height:s}=Qn(t,Jo),{canvas:a,context:r}=Tt(n,s);return r.fillStyle=ws,r.fillRect(0,0,n,s),r.drawImage(t,0,0,n,s),a.toDataURL("image/jpeg",.9)}async function Ns(e){let t=await Le(e),{width:n,height:s}=Qn(t,Zo),{canvas:a,context:r}=Tt(n,s);r.drawImage(t,0,0,n,s);let o=a.toDataURL("image/webp",.9);return o.length<e.length?o:e}async function nt(e,t=0){let n=await Le(e),s=Math.min(n.naturalHeight,vs),{canvas:a,context:r}=Tt(mt,mt);return r.fillStyle=ws,r.fillRect(0,0,mt,mt),r.imageSmoothingEnabled=!1,r.drawImage(n,0,t*vs,s,s,0,0,mt,mt),a.toDataURL("image/png")}var Ms={_meta:{locale:"en",direction:"ltr"},"saucelings.title":"Saucelings","saucelings.subtitle":"Your characters look after a little companion; you cover the gaps.","saucelings.loading":"Loading Saucelings\u2026","saucelings.nav.label":"Saucelings views","saucelings.tab.nook":"Nook","saucelings.tab.journal":"Journal","saucelings.tab.album":"Album","saucelings.tab.menagerie":"Menagerie","saucelings.tab.menagerieNew":"Menagerie, a new egg is waiting","saucelings.tab.settings":"Settings","saucelings.empty.title":"No sauceling in the nook yet","saucelings.empty.body":"Pick a character to look after a sauceling. They'll bring an egg that looks like something they would find.","saucelings.empty.pickCaretaker":"Choose caretaker","saucelings.empty.bringEgg":"Have caretaker bring an egg","saucelings.empty.bringingEgg":"Bringing egg\u2026","saucelings.empty.houseCaretaker":"House Caretaker","saucelings.empty.houseCaretakerNote":"You have no characters yet, so the House Caretaker looks after it. Make a character to choose your own.","saucelings.empty.mari":"Ooh, an empty nook! Pick a character and they'll bring you an egg to raise together (I can't wait to see what hatches).","saucelings.empty.eggAlt":"Egg","saucelings.egg.name":"Egg","saucelings.egg.about":"Nobody knows what is inside yet. Keep it warm and talk to it. Once someone has cared for it, it hatches in about half an hour.","saucelings.egg.moveLabel":"Egg. Drag it, or use the arrow keys, to move it.","saucelings.egg.moveHint":"Drag the egg to move it, or tap where it should go.","saucelings.pet.rename":"Rename","saucelings.pet.nameIt":"Name it","saucelings.pet.namePlaceholder":"Give it a name","saucelings.pet.sauce":"Sauce: {{sauce}}","saucelings.pet.rare.special":"Special sauceling","saucelings.pet.rare.halloween":"Halloween sauceling","saucelings.pet.sauceAbout":"{{sauce}} sauce: {{readsAs}}. Its sauce changes with how it is looked after.","saucelings.pet.temperament":"Temperament: {{temperament}}","saucelings.pet.temperamentAbout":"{{temperament}}: {{readsAs}}. It takes after {{after}}, and slowly picks up the ways of whoever looks after it.","saucelings.pet.temperamentForming":"Its temperament is still taking shape.","saucelings.pet.locked":"{{stage}} (locked)","saucelings.pet.growthPaused":"Growing paused: hungry","saucelings.pet.caretaker":"Caretaker:","saucelings.pet.eggCaretaker":"Keeping it warm:","saucelings.pet.meals":"Meals: {{given}} of {{total}} this week","saucelings.pet.mealsTitle":"Meals {{name}} gave in the last 7 days","saucelings.pet.keptWarm":"Kept warm: {{given}} of {{total}} this week","saucelings.pet.keptWarmTitle":"Times {{name}} kept the egg warm in the last 7 days","saucelings.stage.egg":"egg","saucelings.stage.hatchling":"hatchling","saucelings.stage.juvenile":"juvenile","saucelings.stage.adult":"adult","saucelings.stage.elder":"elder","saucelings.meter.hunger":"Hunger","saucelings.meter.mood":"Mood","saucelings.meter.bond":"Bond","saucelings.meter.hungerGap":"Needs attention","saucelings.meter.moodGap":"Low spirits","saucelings.meter.warmth":"Warmth","saucelings.meter.warmthGap":"Getting cold","saucelings.meter.hatching":"Hatching","saucelings.meter.hatchingGap":"Needs care first","saucelings.meter.warmthHelp":"Eggs need to stay warm. Use Warm when it gets cold.","saucelings.meter.hatchingHelp":"Fills up on its own. Once someone has cared for the egg, it hatches about half an hour after it arrived.","saucelings.meter.hungerHelp":"Feed it to keep this up. A hungry sauceling stops growing until it's fed.","saucelings.meter.moodHelp":"Play and cuddles lift it. A happy sauceling may get the chance to evolve once in its life.","saucelings.meter.bondHelp":"Grows every time anyone cares for it. It needs enough bond to grow into its next stage.","saucelings.action.feed":"Feed","saucelings.action.play":"Play","saucelings.action.rest":"Rest","saucelings.action.pet":"Cuddle","saucelings.action.warm":"Warm","saucelings.action.talk":"Talk","saucelings.action.listen":"Listen","saucelings.action.wait":"{{minutes}}m","saucelings.action.resting":"{{action}} is ready again in {{minutes}} min.","saucelings.nudge.heading":"Ask {{name}} to","saucelings.nudge.ask":"Ask","saucelings.nudge.note":"Lasts 48 hours.","saucelings.nudge.active":"Asked: {{asks}}","saucelings.nudge.left":"{{ask}} ({{hours}} h left)","saucelings.nudge.meals":"remember meals","saucelings.nudge.portions":"go easy on portions","saucelings.nudge.play":"play more","saucelings.nudge.cuddles":"give extra cuddles","saucelings.nudge.warm":"keep it warm","saucelings.nudge.talk":"talk to it more","saucelings.retire.button":"Retire to the Menagerie","saucelings.retire.confirmNote":"Retire {{name}} to the Menagerie? The nook will be free for a new egg, and you can bring {{name}} back later.","saucelings.retire.confirm":"Retire","saucelings.checkIn.button":"Check in with {{name}}","saucelings.checkIn.pending":"{{name}} is writing\u2026","saucelings.swap.note":"{{name}} will move to the Menagerie, and the caretaker you pick brings a new egg.","saucelings.swap.noteEgg":"The egg will move to the Menagerie, and the caretaker you pick brings a new one.","saucelings.swap.confirm":"Swap","saucelings.swap.wait":"One new egg a day. The next one is ready at {{time}}.","saucelings.unlocks.title":"Special saucelings \xB7 {{have}} of {{total}} unlocked","saucelings.unlocks.prismite":"Prismite: raise {{need}} saucelings to elder or evolve them ({{have}} so far).","saucelings.unlocks.thundrake":"Thundrake: care for your saucelings {{need}} times ({{have}} so far).","saucelings.unlocks.clockrit":"Clockrit: care for a sauceling on {{need}} different days ({{have}} so far).","saucelings.unlocks.done":"{{name}}: unlocked. A new egg may be one.","saucelings.unlocks.halloween":"Wickwisp, Cauldrop and Webbit: October only.","saucelings.unlocks.halloweenNow":"Wickwisp, Cauldrop and Webbit: it's October, so a new egg may be one.","saucelings.menagerie.empty":"No saucelings in the Menagerie yet.","saucelings.menagerie.emptyHow":"Saucelings come here when you retire them or swap them for a new egg. Eggs your characters find while chatting wait here too.","saucelings.menagerie.bringBack":"Bring back to Nook","saucelings.menagerie.lockStage":"Lock stage at:","saucelings.menagerie.lockStageHelp":"It grew all the way up, so it can come back at any age it reached. It stays that age from then on.","saucelings.menagerie.retiredAs":"Retired as {{stage}} with {{name}}","saucelings.menagerie.returnsAt":"Returns at stage:","saucelings.menagerie.release":"Release","saucelings.menagerie.releaseNote":"Release {{name}} for good? It leaves the Menagerie and can't come back. Its paintings stay in the Album.","saucelings.menagerie.releaseNoteEgg":"Release this egg for good? It leaves the Menagerie and can't come back.","saucelings.menagerie.releaseConfirm":"Release for good","saucelings.menagerie.swapNote":"{{active}} will move to the Menagerie, and {{name}} comes back to the nook.","saucelings.menagerie.swapConfirm":"Swap them","saucelings.menagerie.activeEgg":"The egg in the nook","saucelings.menagerie.thisEgg":"this egg","saucelings.menagerie.foundBy":"Found by {{name}}","saucelings.menagerie.evolved":"Evolved","saucelings.menagerie.close":"Close","saucelings.menagerie.lookedAfterBy":"Looked after by","saucelings.menagerie.chooseCaretaker":"Choose who looks after it","saucelings.menagerie.chooseFirst":"Choose who looks after it first.","saucelings.menagerie.section.elder":"Elders","saucelings.menagerie.section.adult":"Adults","saucelings.menagerie.section.juvenile":"Juveniles","saucelings.menagerie.section.hatchling":"Hatchlings","saucelings.menagerie.section.egg":"Eggs","saucelings.album.paint":"Paint {{name}}","saucelings.album.painting":"Painting\u2026","saucelings.album.needsConnection":"Pick an image connection in Saucelings settings first.","saucelings.album.off":"Turn on image generation in Settings to paint your sauceling.","saucelings.album.egg":"Paint it once it hatches.","saucelings.album.noPet":"Bring a sauceling into the nook to paint it.","saucelings.album.full":"The Album is full at {{limit}} paintings. Delete one to paint another.","saucelings.album.empty":"No paintings yet.","saucelings.album.emptyHint":"Use the Paint button above to make the first one.","saucelings.album.inMenagerie":"(in the Menagerie)","saucelings.album.released":"(released)","saucelings.album.caption":"{{stage}}, {{date}}","saucelings.album.alt":"Painting of {{name}}","saucelings.album.missing":"This painting could not be loaded.","saucelings.album.delete":"Delete","saucelings.album.deleteConfirm":"Delete for good","saucelings.album.close":"Close","saucelings.album.keepsakeLabel":"{{name}} before and after evolving","saucelings.album.keepsakeCaption":"{{name}} became {{form}}, {{date}}","saucelings.album.keepsakeNote":"Kept when a sauceling evolves: how it looked before and after.","saucelings.album.before":"Before","saucelings.album.after":"After","saucelings.album.addInstructions":"Add instructions","saucelings.album.removeInstructions":"Remove instructions","saucelings.album.instructionsLabel":"What should the painting show?","saucelings.album.instructionsPlaceholder":"e.g. sitting in a teacup at a caf\xE9, rain outside","saucelings.album.instructionsNote":"Your words replace the plain background. Leave it empty for a plain portrait.","saucelings.album.instructionsCaption":"\u201C{{instructions}}\u201D","saucelings.form.paint":"Paint {{name}}'s {{stage}} form","saucelings.form.paintEgg":"Paint the egg","saucelings.form.painting":"Painting\u2026","saucelings.form.paintingNote":"Painting it now with your image connection.","saucelings.form.paintingEgg":"Painting the egg\u2026","saucelings.form.repaint":"Repaint all of {{name}}'s forms","saucelings.form.repaintEgg":"Repaint the egg","saucelings.form.repaintHint":"For when the picture came out wrong.","saucelings.form.repaintNote":"Paint every stage again in one new picture? The one you see now stays until the new one is ready.","saucelings.form.repaintConfirm":"Repaint","saucelings.form.undoRepaint":"Undo repaint","saucelings.form.undoRepaintHint":"Goes back to the pictures from before the last repaint. Press it again to bring the repaint back.","saucelings.form.eggFailed":"The egg could not be painted: {{error}} Bring it to the nook to paint it there.","saucelings.form.needed":"Its caretaker invented it, so this stage has no picture until one is painted.","saucelings.form.failed":"The painting could not be cut out into a form. Try again.","saucelings.form.offerEggTitle":"Paint the egg?","saucelings.form.offerEggBody":"This egg has no picture yet. Painting it uses your image connection.","saucelings.form.offerTitle":"Paint {{name}}?","saucelings.form.offerBody":"{{name}} has no picture for this stage yet. Painting it uses your image connection.","saucelings.form.offerNotNow":"Not now","saucelings.form.offerPaint":"Paint it","saucelings.figure.paint":"Paint {{name}} for the Nook","saucelings.figure.repaint":"Repaint {{name}} for the Nook","saucelings.figure.hint":"Draws them in eight poses as a pixel figure in the pets' style, from their avatar and card.","saucelings.figure.confirmNote":"Paint {{name}} as a pixel figure with your image connection? It takes one image request, and what the Nook shows now stays until it is ready.","saucelings.figure.confirm":"Paint","saucelings.figure.failed":"The picture could not be read as drawings of {{name}}. Try again.","saucelings.figure.threePoses":"{{name}} has three poses so far. Repaint for all eight.","saucelings.figure.undoRepaint":"Undo {{name}}'s repaint","saucelings.figure.undoHint":"Goes back to the figure from before the last repaint. Press it again to bring the repaint back.","saucelings.flip.label":"Flip {{name}}","saucelings.flip.note":"Turns {{name}} to face the other way in the Nook. Nothing is repainted.","saucelings.settings.visitsGroup":"Visits","saucelings.settings.writingGroup":"Writing","saucelings.settings.picturesGroup":"Pictures","saucelings.settings.careWindow":"Time between caretaker visits (hours)","saucelings.settings.careWindowNote":"How often the caretaker may feed, play or cuddle (default 6 h).","saucelings.settings.connection":"Writing connection","saucelings.settings.connectionNote":"The connection the caretaker writes journal lines and check-ins with.","saucelings.settings.connectionDefault":"Engine default","saucelings.settings.connectionMissing":"Deleted connection: pick another","saucelings.settings.dailyBudget":"Written lines per day","saucelings.settings.budgetUsed":"Used today: {{used}} / {{limit}}","saucelings.settings.budgetNote":"Lines you ask for with a click (Check in, hello, welcome back, farewell) don't count. Past the limit, the caretaker uses saved lines.","saucelings.settings.writeEveryLine":"Caretaker writes every line","saucelings.settings.writeEveryLineNote":"Every line comes from the model, not the phrasebook. More model calls; the daily limit doesn't apply.","saucelings.settings.images":"Enable image generation","saucelings.settings.imagesNote":"Adds Paint and Generate buttons, and paints each creature a caretaker invents, with the image connection you pick.","saucelings.settings.threeDrawingFallback":"Simpler caretaker figures","saucelings.settings.threeDrawingFallbackNote":"If a figure doesn't come out, ask once more for three drawings in a row. Helps weaker image models; one extra image call.","saucelings.settings.eggHunting":"Egg hunting","saucelings.settings.eggHuntingNote":"A character replying in a chat may find an egg for the Menagerie. Only a chance is rolled: no chat text is read and nothing is added to the prompt.","saucelings.settings.imageConnection":"Image connection","saucelings.settings.imageConnectionPick":"Choose an image connection","saucelings.settings.imageConnectionEmpty":"No image generation connection yet. Add one under Connections.","saucelings.settings.reset":"Reset Saucelings","saucelings.settings.resetNote":"Clear the nook, the Menagerie, the Album, saved backgrounds, caretakers' voices and painted figures, and special-egg progress. Your settings stay.","saucelings.settings.resetConfirm":"Confirm Reset","saucelings.settings.saved":"\u2713 Saved","saucelings.journal.generated":"AI","saucelings.journal.speaker":"{{name}}:","saucelings.journal.toNook":"Go to the Nook","saucelings.journal.empty":"Nothing in the journal yet. Feed, play or cuddle {{name}} and it shows up here.","saucelings.journal.new":"{{count}} new since you last looked","saucelings.journal.today":"Today","saucelings.journal.yesterday":"Yesterday","saucelings.event.egg-found":"Egg found","saucelings.event.hatch":"Hatched","saucelings.event.caretaker-care":"Caretaker","saucelings.event.user-care":"Your care","saucelings.event.nudge":"Nudge","saucelings.event.absence":"While you were away","saucelings.event.stage-up":"Grew up","saucelings.event.temperament-shift":"New sauce","saucelings.event.farewell":"Farewell","saucelings.event.return-from-album":"Back from the Menagerie","saucelings.event.check-in":"Check-in","saucelings.event.evolve":"Evolved","saucelings.event.evolve-offer":"Ready to evolve","saucelings.event.caretaker-change":"New caretaker","saucelings.widget.care":"Care","saucelings.widget.open":"Open {{name}} in Saucelings","saucelings.widget.emptyHint":"Tap to open Saucelings and pick a caretaker.","saucelings.error.interface":"Saucelings encountered an interface error.","saucelings.error.load":"Could not load Saucelings Nook.","saucelings.error.request":"Request failed","saucelings.error.retry":"Try again","saucelings.error.restart":"Restart Marinara Engine to finish installing Saucelings.","saucelings.error.network":"Couldn't reach Marinara Engine. Check that it's running, then try again.","saucelings.error.timeout":"That took too long. Try again in a moment.","saucelings.error.writing":"The writing connection didn't answer. Check it in Settings, or try again in a moment.","saucelings.error.engine":"Something went wrong on the Engine side. Try again in a moment.","saucelings.error.details":"Details","saucelings.common.cancel":"Cancel","saucelings.common.save":"Save","saucelings.nook.background":"Background","saucelings.nook.menu":"More","saucelings.background.title":"Nook background","saucelings.background.upload":"Upload a picture","saucelings.background.uploading":"Uploading\u2026","saucelings.background.generate":"Generate a background","saucelings.background.generating":"Generating\u2026","saucelings.background.promptLabel":"What the background shows","saucelings.background.suggest":"Suggest one for {{name}}","saucelings.background.suggestEgg":"Suggest one for the egg","saucelings.background.suggesting":"Writing\u2026","saucelings.background.suggestPlain":"No writing connection answered, so this is a plain starting point. Edit it as you like.","saucelings.background.useBuiltIn":"Use the built-in background","saucelings.background.tooBig":"That picture is too big.","saucelings.background.off":"Turn on image generation in Settings to generate a background.","saucelings.background.noConnection":"Pick an image connection in Saucelings settings first.","saucelings.background.library":"Saved backgrounds","saucelings.background.sharedNote":"Saved backgrounds are shared by all your saucelings.","saucelings.background.tileAlt":"Background: {{label}}","saucelings.background.earlier":"An earlier background","saucelings.background.missing":"Could not load","saucelings.background.delete":"Delete {{label}}","saucelings.background.deleteNote":"Delete \u201C{{label}}\u201D for good? Saucelings showing it go back to their built-in background.","saucelings.background.deleteConfirm":"Delete for good","saucelings.background.full":"The library is full at {{limit}}. Delete a background to save another.","saucelings.caretaker.says":"{{name}} says","saucelings.caretaker.previous":"Earlier line","saucelings.caretaker.next":"Later line","saucelings.caretaker.position":"{{index}} of {{count}}","saucelings.caretaker.idle":"I'm keeping an eye on {{name}}.","saucelings.caretaker.idleEgg":"I'm keeping an eye on the egg.","saucelings.about.summary":"About {{name}}","saucelings.about.egg":"About the egg","saucelings.about.refreshVoice":"Refresh {{name}}'s voice from their card","saucelings.about.refreshingVoice":"{{name}} is reading their card\u2026","saucelings.about.refreshVoiceNote":"Reads their character card again, so their lines sound like them.","saucelings.about.caretakerGroup":"Caretaker","saucelings.about.looksGroup":"Looks","saucelings.about.newEggGroup":"New egg","saucelings.about.handOverNote":"Hand {{name}} over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOverEggNote":"Hand the egg over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOver":"Hand over","saucelings.help.label":"Show help: {{action}}","saucelings.evolve.button":"Evolve\u2026","saucelings.evolve.note":"{{name}} can become something new, once in its life. You choose, or keep it as it is.","saucelings.evolve.undo":"Undo evolution","saucelings.evolve.undoNote":"{{name}} goes back to how it looked before. Evolve\u2026 comes back with the same two choices.","saucelings.evolve.title":"What could {{name}} become?","saucelings.evolve.writing":"{{caretaker}} is thinking about what {{name}} could become\u2026","saucelings.evolve.from":"From: {{from}}","saucelings.evolve.become":"Become {{form}}","saucelings.evolve.keep":"Keep it as it is","saucelings.evolve.decline":"Not interested","saucelings.evolve.declineNote":"Hides Evolve\u2026 for {{name}} for good.","saucelings.evolve.declineConfirm":"Never offer {{name}} an evolution again?","saucelings.evolve.into":"Evolved into: {{form}}","saucelings.evolve.move":"Signature move: {{move}}","saucelings.evolve.moves.twirl":"Twirl","saucelings.evolve.moves.float":"Float","saucelings.evolve.moves.shine":"Shine","saucelings.evolve.moves.roar":"Roar","saucelings.evolve.moves.sparkle":"Sparkle","saucelings.evolve.moves.firepuff":"Fire Puff","saucelings.evolve.moves.icicles":"Icicles","saucelings.evolve.moves.leafwhirl":"Leaf Whirl","saucelings.evolve.moves.wiggle":"Wiggle","saucelings.evolve.moves.petalshower":"Petal Shower","saucelings.evolve.moves.triplehop":"Triple Hop","saucelings.evolve.moves.starburst":"Star Burst","saucelings.evolve.moves.coinshower":"Coin Shower","saucelings.evolve.moves.shockwave":"Shockwave","saucelings.evolve.moves.vanish":"Vanish","saucelings.evolve.moves.zap":"Lightning Zap","saucelings.evolve.moves.dash":"Dash","saucelings.evolve.moves.bubbleblow":"Bubble Blow","saucelings.evolve.moves.splash":"Splash","saucelings.voice.title":"Give {{name}} their own voice?","saucelings.voice.body":"{{name}} has no voice of their own yet, so their stock lines are generic. Saucelings can read their character card once with your writing connection to learn how they talk, what they call your pet and what they say at mealtimes.","saucelings.voice.read":"Read {{name}}'s card","saucelings.voice.notNow":"Not now","saucelings.voice.failed":"Couldn't make {{name}}'s voice: the writing connection didn't answer.","saucelings.voice.tryAgain":"Try again","saucelings.voice.close":"Close","saucelings.retire.ready":"{{name}} is old enough to retire.","saucelings.stage.tapHint":"Tap the stage and {{name}} comes over.","saucelings.tour.link":"Tour","saucelings.tour.next":"Next","saucelings.tour.back":"Back","saucelings.tour.skip":"Skip","saucelings.tour.done":"Done","saucelings.tour.eggTitle":"Your first egg.","saucelings.tour.eggBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.petTitle":"Your sauceling.","saucelings.tour.petBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.metersTitle":"How it's doing.","saucelings.tour.metersBody":"These bars show how it feels. Tap a name to see what it means.","saucelings.tour.careTitle":"Your care.","saucelings.tour.careBody":"Use these when a bar runs low. Each one rests for a while after you use it.","saucelings.tour.caretakerTitle":"Talk to {{caretaker}}.","saucelings.tour.caretakerBody":"Check in to hear how things are going, or Ask them to care for it differently.","saucelings.tour.aboutTitle":"More options.","saucelings.tour.aboutBody":"Name it, change its look, or change who looks after it here.","saucelings.tour.tabsTitle":"The rest of Saucelings.","saucelings.tour.tabsBody":"The Journal keeps a diary, the Album holds paintings, the Menagerie keeps retired saucelings, and Settings has your connections."};var un=globalThis.__MARINARA_HOST__,At=un&&un.version===1&&un.modules?un.modules["react/jsx-runtime"]:void 0;if(!At)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var ie=At.Fragment,Hu=At.default,i=At.jsx,f=At.jsxs;var ti=Object.fromEntries(Object.entries(Ms).filter(([e,t])=>e!=="_meta"&&typeof t=="string"));function ni(e,t){return t?e.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(n,s)=>{let a=t[s];return a==null?n:String(a)}):e}function ft(e,t,n){return ni(ti[t]??t,n)}var Is=Da({direction:"ltr",t:(e,t)=>ft(void 0,e,t)});function Ts({localization:e,children:t}){let n=e?.direction==="rtl"?"rtl":"ltr",s=Zt(()=>({direction:n,t:(a,r)=>ft(e,a,r)}),[n,e]);return i(Is.Provider,{value:s,children:i("div",{dir:n,style:{display:"contents"},children:t})})}function X(){return za(Is)}var gn={feed:"\u{1F35D}",play:"\u{1F3B2}",rest:"\u{1F319}",pet:"\u{1F49B}",warm:"\u{1F9E3}",talk:"\u{1F4AC}",listen:"\u{1F442}"},Pt={feed:"saucelings.action.feed",play:"saucelings.action.play",rest:"saucelings.action.rest",pet:"saucelings.action.pet",warm:"saucelings.action.warm",talk:"saucelings.action.talk",listen:"saucelings.action.listen"};function _t(e){return e.stage==="egg"?Hn:$n}function Ot(e,t){return e==="feed"&&t.hunger||e==="play"&&t.mood||e==="warm"&&t.warmth}function dn(e){let[t,n]=F(()=>Date.now());return q(()=>{let s=window.setInterval(()=>n(Date.now()),e);return()=>window.clearInterval(s)},[e]),[t,me(()=>n(Date.now()),[])]}function at(e){let[t,n]=F(null),s=j(void 0);q(()=>()=>window.clearTimeout(s.current),[]);let a=me(r=>{window.clearTimeout(s.current),n(r),s.current=window.setTimeout(()=>n(null),e)},[e]);return[t,a]}var pn=2e3;function mn(e,t,n){let s=e.actionCooldowns[t],a=s?Date.parse(s)-n:0;return a>0?Math.ceil(a/6e4):0}function Ft(e){return e.meters.warmth??Wa}function Lt(e,t){let n=t-Date.parse(e.createdAt);return Math.max(0,Math.min(100,Math.floor(n/Un*100)))}function As(e){return e?.stage!=="egg"||e.careActionCount<1?null:Date.parse(e.createdAt)+Un}function ai(e){let t=e;if(typeof t=="string")try{t=JSON.parse(t)}catch{return""}let n=t?.extensions,s=n?.imageAppearanceEnabled===!0?n.imageAppearance:null,a=typeof s=="string"&&s.trim()?s:n?.appearance;return typeof a=="string"?a:""}function Wn(e){return{queryKey:["saucelings","caretaker-card",e],queryFn:async()=>{let t=await Re(`/api/characters/${encodeURIComponent(e)}`);return{avatar:typeof t.avatarPath=="string"&&/^\/(?![/\\])/u.test(t.avatarPath)?t.avatarPath:null,appearance:ai(t.data)}},staleTime:5*6e4,retry:!1}}function ht(e,t){return ue({...Wn(e),enabled:t}).data?.avatar??null}function bt(e){let t=ue({queryKey:["saucelings","figure",e],queryFn:()=>V(`/figure/${encodeURIComponent(e??"")}`),enabled:!!e,staleTime:1/0,retry:!1});return!e||t.isError?null:t.data?t.data.image?t.data:null:void 0}function fn(e,t){let n=t?.image;return ue({queryKey:["saucelings","figure-motion",e],queryFn:()=>Cs(n??""),enabled:!!(e&&n),staleTime:1/0,retry:!1}).data??null}function Ps(e){let[t,n]=F(null),[s,a]=F(!1);return je(()=>{let r=t?.closest(".sl-shell")??t;if(!r||typeof ResizeObserver>"u")return;let o=()=>a(r.clientWidth>=e*parseFloat(getComputedStyle(document.documentElement).fontSize));o();let l=new ResizeObserver(o);return l.observe(r),()=>l.disconnect()},[t,e]),[n,s]}var si=[];function hn(e,t){let n=ue({queryKey:["saucelings","caretaker-sprites",e],queryFn:async()=>{let s=await Re(`/api/sprites/${encodeURIComponent(e)}`);return(Array.isArray(s)?s:[]).flatMap(a=>{let r=a;return typeof r.expression=="string"&&typeof r.url=="string"&&/^\/api\/sprites\//u.test(r.url)?[{expression:r.expression,url:r.url}]:[]})},enabled:t,staleTime:3e5,retry:!1});return t&&n.data||si}function yt({name:e,src:t,small:n,box:s}){let a=s?"sl-avatar sl-avatar--box":n?"sl-avatar sl-avatar--small":"sl-avatar";return t?i("img",{className:a,src:t,alt:""}):i("span",{className:a,"aria-hidden":"true",children:e.trim().charAt(0).toUpperCase()||"?"})}function de({error:e}){let{t}=X(),[n,s]=F(!1),{message:a,details:r}=tn(e,t);return f(ie,{children:[a,r?f(ie,{children:[" ",i("button",{type:"button",className:"sl-link","aria-expanded":n,onClick:()=>s(o=>!o),children:t("saucelings.error.details")}),n?i("span",{className:"sl-error-details",children:r}):null]}):null]})}var bn={rigamuffin:{id:"rigamuffin",name:"Rigamuffin",origin:"rigatoni + ragamuffin",look:"scruffy little tube with ridges, always slightly grubby",defaultTraits:["ridged-hide","crumb-collector","sturdy","curious"]},fluttino:{id:"fluttino",name:"Fluttino",origin:"farfalle + flutter",look:"bow-shaped wings, hovers, never quite lands",defaultTraits:["hover-drift","bow-winged","breezy","restless"]},lentino:{id:"lentino",name:"Lentino",origin:"linguine / lentil + -ino",look:"long, thin, loops itself into knots when happy",defaultTraits:["knot-tier","slender","springy","affectionate"]},shellbini:{id:"shellbini",name:"Shellbini",origin:"conchiglie + shell",look:"shelled, hides inside when sulky",defaultTraits:["pocket-shell","peeker","shy-sweet","echo-hum"]},tortellump:{id:"tortellump",name:"Tortellump",origin:"tortellini + lump",look:"plump folded dumpling with a pinched dimple on top, rolls instead of walking",defaultTraits:["roly-poly","stuffed-snug","dimpled","homebody"]},mossaboo:{id:"mossaboo",name:"Mossaboo",origin:"moss + peekaboo",look:"round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",defaultTraits:["moss-backed","slow","patient","cosy"]},puddlepip:{id:"puddlepip",name:"Puddlepip",origin:"puddle + pip",look:"clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",defaultTraits:["raindrop-headed","splashy","happy","noisy"]},snufflump:{id:"snufflump",name:"Snufflump",origin:"snuffle + lump",look:"round ball of beige fluff with floppy ears, puffs up when startled",defaultTraits:["fluff-ball","sleepy","cuddly","nervous"]},burrowl:{id:"burrowl",name:"Burrowl",origin:"burrow + owl",look:"round brown owl with goggle eyes and big pink digging paws",defaultTraits:["big-pawed","busy","wise","messy"]},prismite:{id:"prismite",name:"Prismite",origin:"prism + -ite",look:"cluster of clear crystal spikes that splits light into rainbows",defaultTraits:["faceted","proud","sparkly","aloof"]},thundrake:{id:"thundrake",name:"Thundrake",origin:"thunder + drake",look:"little storm-cloud dragon with lightning horns and a rainy tail",defaultTraits:["spark-horned","stormy","bold","moody"]},clockrit:{id:"clockrit",name:"Clockrit",origin:"clock + critter",look:"brass wind-up critter with a clock-face belly and a pendulum tail",defaultTraits:["wind-up","punctual","fussy","kind"]},wickwisp:{id:"wickwisp",name:"Wickwisp",origin:"wick + will-o'-the-wisp",look:"stub of dripping candle wax with a little flame floating over its head",defaultTraits:["flame-crowned","flickery","timid","warm-hearted"]},cauldrop:{id:"cauldrop",name:"Cauldrop",origin:"cauldron + drop",look:"small iron cauldron on three legs, brim-full of bubbling purple potion",defaultTraits:["brim-bubbler","bubbly","mischievous","greedy"]},webbit:{id:"webbit",name:"Webbit",origin:"web + -bit",look:"fluffy cobweb spider whose round belly glows like a paper lantern",defaultTraits:["lantern-bellied","tidy","patient","clingy"]}},ri={marinara:{id:"marinara",name:"Marinara",origin:"house sauce",readsAs:"freshly hatched, open-hearted, still finding its flavor",grownBy:"hatching and balanced early days",accentColor:"#e05246",badgeBg:"rgba(224, 82, 70, 0.16)"},zesto:{id:"zesto",name:"Zesto",origin:"pesto + zest",readsAs:"bright, bouncy, chatty",grownBy:"steady feeding and play, good bond",accentColor:"#48b868",badgeBg:"rgba(72, 184, 104, 0.16)"},carbonuzzle:{id:"carbonuzzle",name:"Carbonuzzle",origin:"carbonara + nuzzle",readsAs:"warm, clingy, golden",grownBy:"lots of cuddles and affection",accentColor:"#f0b449",badgeBg:"rgba(240, 180, 73, 0.18)"},rabbratty:{id:"rabbratty",name:"Rabbratty",origin:"arrabbiata + bratty",readsAs:"feisty, demanding, quick-tempered",grownBy:"erratic care, missed meals then spoiling",accentColor:"#f25c3b",badgeBg:"rgba(242, 92, 59, 0.18)"},seppy:{id:"seppy",name:"Seppy",origin:"seppia + sulky",readsAs:"gloomy, brooding, dramatic",grownBy:"neglect, long absences, low mood",accentColor:"#7882a4",badgeBg:"rgba(120, 130, 164, 0.2)"},alfredoze:{id:"alfredoze",name:"Alfredoze",origin:"alfredo + doze",readsAs:"mellow, sleepy, content",grownBy:"over-feeding, little play",accentColor:"#d9ceb8",badgeBg:"rgba(217, 206, 184, 0.2)"},truffoddity:{id:"truffoddity",name:"Truffoddity",origin:"truffle + oddity",readsAs:"strange, brilliant, unsettling",grownBy:"milestones noticed, no affection",accentColor:"#a978e8",badgeBg:"rgba(169, 120, 232, 0.18)"}};function oi(e,t){return Math.min(e,t)<42?"grumpy":e>=68&&t>=68?"happy":"content"}var Yn=["happy","content","grumpy","side"],st=1+(Be.length-1)*Yn.length;function $e(e,t,n){let s=`sprites/${e}.webp`;return t==="egg"?n==="side"?null:{path:s,row:0}:{path:s,row:1+(Be.indexOf(t)-1)*Yn.length+Yn.indexOf(n)}}var $t=6,ii={thundrake:140,wickwisp:140,cauldrop:180,clockrit:1e3,webbit:220,prismite:180};function _s(e){let t=ii[e];return t?{path:`sprites/${e}-live.webp`,ms:t}:null}var Xn=["egg-found","hatch","caretaker-care","absence","stage-up","temperament-shift","farewell","return-from-album","check-in","evolve","evolve-offer","caretaker-change"];function Ht(e){return`${/^[aeiou]/iu.test(e)?"an":"a"} ${e}`}function Xe(e){return e.design?{name:e.design.kind,look:e.design.look}:{name:bn[e.species].name,look:bn[e.species].look}}function li(e){return!e.design&&ja.includes(e.species)}function ze(e){if(li(e)){let t=ri[e.temperament];return{name:t.name,readsAs:t.readsAs,sauce:t}}return e.ownTemperament?{name:e.ownTemperament.name,readsAs:e.ownTemperament.readsAs,sauce:null}:null}function Os(e){return[...Be].reverse().map(t=>({stage:t,entries:e.filter(n=>(n.reachedElder?"elder":n.stageAtRetirement)===t)})).filter(t=>t.entries.length>0)}var Fs={rigamuffin:"a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",fluttino:"a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",lentino:"a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",shellbini:"a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",tortellump:"a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",mossaboo:"a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",puddlepip:"a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",snufflump:"a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",burrowl:"an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",prismite:"a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",thundrake:"a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",clockrit:"a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",wickwisp:"a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",cauldrop:"a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",webbit:"a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves"},Ls="a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";function vt(e){return e.stage==="egg"?"sprites/scene-nest.webp":`sprites/scene-${e.species}.webp`}function rt(e){return{stage:e.lockedStage??e.stage,mood:oi(e.meters.hunger,e.meters.mood)}}function $s(e,t){let n=e.forms[t];return n?{kind:"form",formId:n}:e.design?.origin==="found"?{kind:"silhouette"}:{kind:"species"}}var ci=["calm","happy","worried","talking","waving","feeding","playing","tending"],ui={worried:["worried","concerned","sad","anxious"],happy:["happy","smile","laugh","joy"],neutral:["neutral","idle","default","calm"]},gi=/^full[_-]/iu;function di(e,t){for(let n of t==="neutral"?["neutral"]:[t,"neutral"])for(let s of ui[n]){let a=e.find(r=>r.expression.toLowerCase().includes(s));if(a)return a.url}return null}function Jn(e,t){let n=e.filter(a=>!gi.test(a.expression)),s=n.length>0?n:e;return di(s,t)??s[0]?.url??null}var pi={feed:"feeding",play:"playing",rest:"tending",pet:"tending",warm:"tending",talk:"talking"};function yn({gaps:e,line:t,speaking:n,cheering:s,caring:a}){let r=a&&pi[a];return r||(n&&(t?.kind==="caretaker-change"||t?.kind==="return-from-album")?"waving":s?"happy":n?"talking":e.hunger||e.mood||e.warmth||t?.kind==="absence"?"worried":"calm")}function vn(e,t,n,s=null){if(e)return{figure:s?.body??e.image,rows:s?2:1,frames:e.frames,frame:mi(n,e.frames),blink:s?.blink??null};let a=e===null?Jn(t,Hs(n)):null;return a?{src:a}:null}function Hs(e){return e==="worried"?"worried":e==="calm"||e==="talking"?"neutral":"happy"}function mi(e,t){let n=ci.indexOf(e);return n<t?n:["neutral","happy","worried"].indexOf(Hs(e))}var fi={"fed-fine":"feed","fed-badly":"feed",overfed:"feed",played:"play",cuddled:"pet","kept-warm":"warm",chatted:"talk"};function Us(e){return(e&&fi[e])??null}var hi={rigamuffin:"a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",fluttino:"a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",lentino:"a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",shellbini:"a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",tortellump:"a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",mossaboo:"a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",puddlepip:"a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",snufflump:"a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",burrowl:"a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",prismite:"a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",thundrake:"a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",clockrit:"a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",wickwisp:"a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",cauldrop:"a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",webbit:"a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black"},wn="Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.",Bs="Simple, bold, readable face with small eyes and a small mouth.",Zn="Plain flat white background.",wt="text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering",bi=`${wt}, human, person, cropped`,zs=e=>e.trim()?`${wt}, cropped`:bi,Gs=`${wt}, shadow, ground, floor, scenery, multiple creatures, human, person`,yi=`${Gs}, face, eyes, mouth, nest`,Ks=`${wt}, shadow, ground, scenery, overlapping drawings, human, person`,qs=`${wt}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`,Vs=`${wt}, characters, people, person, creatures, animals, pets`,js=e=>e==="egg"?yi:Gs,vi="Same creature as the reference image: keep its shape, colours and markings.";function Qs(e,t,n=""){let s=ze(e),a=n.replace(/\s+/gu," ").trim(),r=e.lockedStage??e.stage,o=e.design,l=o?`${Ht(o.kind)}: ${(o.stages[r]??o.look).replace(/[.\s]+$/u,"")}; its colours are ${o.colours.join(", ")}`:hi[e.species],c=o?"":r==="elder"?", wearing little round spectacles and a few white whiskers":r==="hatchling"?", small and round":"";return[wn,`A little virtual pet creature: ${l}.`,`${s?`Its face and pose look ${s.readsAs}. `:""}Life stage: ${r}${c}.`,t?vi:"",Bs,...a?[`Full body. ${a.charAt(0).toUpperCase()}${a.slice(1)}${/[.!?]$/u.test(a)?"":"."}`]:["One single creature, full body, centred.",Zn]].filter(Boolean).join(" ")}var wi=400;function Ws(e,t,n,s){let a=t.replace(/\s+/gu," ").trim().slice(0,wi).replace(/[.\s]+$/u,"");return[wn,...s,"Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",a?`What ${e} looks like: ${a}.`:"",n>0?`Keep ${e}'s hair, face, outfit and colours from the reference image${n>1?"s":""}.`:"",Zn].filter(Boolean).join(" ")}function Ds(e,t,n){return Ws(e,t,n,[`Eight drawings of the same character, ${e}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,"The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.","The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands."])}function Si(e,t,n){return Ws(e,t,n,[`Three drawings of the same character, ${e}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`])}function Ys(e,t,n,s){let a=[{prompt:Ds(e,t,n.length),references:n}];return n.length>0&&a.push({prompt:Ds(e,t,0),references:[]}),s&&a.push({prompt:Si(e,t,0),references:[]}),a}var Xs={earlier:"Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",before:"The reference image shows what this creature was before it evolved: keep a hint of its colours."};function Js(e,t,n){let s=(e.stages[t]??e.look).replace(/[.\s]+$/u,"");return[wn,t==="egg"?`The egg of a small creature, ${Ht(e.kind)}: ${s}.`:`A small creature, ${Ht(e.kind)}, at its ${t} stage: ${s}.`,`Its colours are ${e.colours.join(", ")}.`,n?Xs[n]:"",t==="egg"?"One single egg with no face, upright and centred, filling most of the picture.":`${Bs} One single creature, full body, seen from the front and centred, filling most of the picture.`,Zn].filter(Boolean).join(" ")}function ea(e){return Be.filter(t=>e.stages[t])}var ki="The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.",xi="Plain flat white background everywhere.";function Zs(e,t){let n=ea(e),s=c=>(e.stages[c]??e.look).replace(/[.\s]+$/u,""),a=n[0]==="egg",r=n.reduce((c,u)=>c+(u==="egg"?2:4),0),o=n.map((c,u)=>c==="egg"?`Row ${u+1}, the egg, only two drawings. Left: the whole egg, ${s(c)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`:`Row ${u+1}, ${c}, four drawings: ${s(c)}.`),l="and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";return[`${wn} A sprite sheet of one small creature, ${Ht(e.kind)}: ${e.look} Its colours are ${e.colours.join(", ")}.${t?` ${Xs[t]}`:""}`,"",a?`Lay out ${r} drawings in ${n.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${n.length}, ${l}`:`Lay out ${r} drawings in ${n.length} rows: exactly four drawings in each row, ${l}`,...o,"",`${a?`In rows 2 to ${n.length}`:"In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${a?"Growth must read clearly: the hatchling is small and round and the elder is full size.":"The elder is as big as the adult and looks older."}`,"",ki,"",xi].join(`
`)}function ta(e){if(e.stage==="egg")return Ls;if(!e.design)return Fs[e.species];let[t,n,s]=e.design.colours;return`a cosy little room in ${t}, ${n} and ${s} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`}var Ei="Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";function er(e){return`${Ei} A wide side-on scene of ${e.trim().replace(/[.\s]+$/u,"")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`}var Sn=globalThis.__MARINARA_HOST__,ye=Sn&&Sn.version===1&&Sn.modules?Sn.modules["react-dom"]:void 0;if(!ye)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var sg=ye.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,rg=ye.browser,tr=ye.createPortal,og=ye.default,ig=ye.flushSync,lg=ye.preconnect,cg=ye.prefetchDNS,ug=ye.preinit,gg=ye.preinitModule,dg=ye.preload,pg=ye.preloadModule,mg=ye.requestFormReset,fg=ye.unstable_batchedUpdates,hg=ye.useFormState,bg=ye.useFormStatus,yg=ye.version;function Ee({text:e,label:t,trigger:n,children:s}){let[a,r]=F(null),[o,l]=F(null),c=j(null),u=j(null),p=Jt();je(()=>{let h=c.current?.getBoundingClientRect(),y=u.current?.getBoundingClientRect();if(!a||!h||!y){l(null);return}let b=8,d=h.top-6-y.height;l({top:d>=b?d:h.bottom+6,left:Math.max(b,Math.min(h.left+h.width/2-y.width/2,window.innerWidth-b-y.width))})},[a]),q(()=>{if(!a)return;let h=b=>{let d=b.target;!c.current?.contains(d)&&!u.current?.contains(d)&&r(null)},y=b=>b.key==="Escape"&&r(null);return document.addEventListener("pointerdown",h),document.addEventListener("keydown",y),()=>{document.removeEventListener("pointerdown",h),document.removeEventListener("keydown",y)}},[a]);let g=()=>r(h=>h??"shown"),m=()=>r(h=>h==="shown"?null:h);return f("span",{className:"sl-with-help",children:[s,i("button",{ref:c,type:"button",className:n?"sl-help sl-help--text":"sl-help","aria-label":t,"aria-expanded":a!==null,"aria-describedby":a?p:void 0,onMouseEnter:g,onMouseLeave:m,onFocus:g,onBlur:m,onKeyDown:h=>{h.key!=="Escape"||!a||(h.preventDefault(),h.stopPropagation(),r(null))},onClick:()=>r(h=>h==="pinned"?null:"pinned"),children:n??f("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:[i("circle",{cx:"12",cy:"12",r:"10"}),i("path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}),i("path",{d:"M12 17h.01"})]})}),a?tr(i("div",{ref:u,id:p,role:"tooltip",className:"sl-help-tip",style:o?{top:o.top,left:o.left}:{top:0,left:0,visibility:"hidden"},children:e}),document.body):null]})}var se=52,Ke=100,nr=[4,6,8,10,12,14,16,19,22],ra={hatchling:{t:21,l:12,r:39,m:30},juvenile:{t:13,l:9,r:42,m:25},adult:{t:5,l:7,r:44,m:19},elder:{t:4,l:7,r:44,m:19}},oa={embers:"rise",wisps:"rise",bubbles:"rise",snow:"fall",leaves:"fall",petals:"fall",stars:"twinkle",glints:"twinkle",sparks:"twinkle"},kn={ember:["#2a0f0a","#8a2a12","#d9581e","#ff9a3c","#ffe08a"],frost:["#0f1a33","#2c5a9a","#5fa0e0","#a8dcff","#f2fbff"],moss:["#10220f","#2f5e1e","#5c9a2e","#9fd35a","#e4f7a8"],dusk:["#170f2e","#46287a","#7d4fc4","#b58cff","#ecdcff"],gilded:["#2a1a05","#7a5410","#c99a1e","#ffd84a","#fff6c2"],shade:["#0e0c14","#2e2a3c","#575070","#8f86ad","#cfc8e6"],bloom:["#2e0f1e","#8a3060","#d9609a","#ff9fcb","#ffe6f2"],storm:["#12141f","#2e3550","#56607f","#8d96b5","#d6dcef"],tide:["#08202a","#145a6a","#2a9a9a","#6ad8c8","#d8fff4"],spark:["#2a1f05","#8a6a10","#e0c020","#fff050","#ffffe0"]},lr=["#1c1917","#57534e","#a8a29e","#e7e5e4","#fafaf9"],Ci={ember:"#ff7a3d",frost:"#8fd8ff",moss:"#7fd35a",dusk:"#b58cff",gilded:"#ffd84a",shade:"#a99cc8",bloom:"#ff9fcb",storm:"#f5ec5a",tide:"#5fe0d0"};var cr={"webbit:elder":[42,33]};function zt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d",{willReadFrequently:!0});if(!s)throw new Error("No 2D canvas.");return s.imageSmoothingEnabled=!1,[n,s]}var ia=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),ar=new WeakMap;function la(e,t,n){let s=ar.get(e);s||ar.set(e,s=new Map);let a=s.get(t);return a||s.set(t,a=n()),a}function Ri(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function na(e,t,n=0){return la(e,`t|${t}|${n}`,()=>{let s=(t==="neutral"?lr:kn[t]).map(ia),[a,r]=zt(e.width,e.height);r.drawImage(e,0,0);let o=r.getImageData(0,0,a.width,a.height),l=o.data;for(let c=0;c<l.length;c+=4){if(!l[c+3])continue;let u=Math.min(1,(.2126*l[c]+.7152*l[c+1]+.0722*l[c+2])/255+n),p=Math.min(3,Math.floor(u*4)),g=(u-p/4)*4;for(let m=0;m<3;m++)l[c+m]=Math.round(s[p][m]+g*(s[p+1][m]-s[p][m]))}return r.putImageData(o,0,0),a})}function St(e,t,n,s,a){return la(e,`s|${t}|${n}|${s}|${a}`,()=>{let r=e.getContext("2d").getImageData(t,n,se,se).data,o=se+2*s,l=se+2*s,c=new Uint8Array(o*l);for(let b=0;b<se;b++)for(let d=0;d<se;d++)c[(b+s)*o+d+s]=r[(b*se+d)*4+3]?1:0;for(let b=0;b<s;b++){let d=c.slice();for(let v=0;v<l;v++)for(let C=0;C<o;C++){let k=v*o+C;!c[k]&&(C>0&&c[k-1]||C<o-1&&c[k+1]||v>0&&c[k-o]||v<l-1&&c[k+o])&&(d[k]=1)}c=d}let[u,p]=zt(o,l),g=p.createImageData(o,l),[m,h,y]=ia(a);for(let b=0;b<c.length;b++)c[b]&&g.data.set([m,h,y,255],b*4);return p.putImageData(g,0,0),u})}var Ni=[[[0,0],[-1,-1],[-1,-2],[-2,-3],[-2,-4],[-3,-5],[-3,-6],[-4,-7]],[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]],[[0,0],[0,1],[-1,2],[-1,3],[0,4],[-1,5],[-1,6],[-2,7]]];function Mi(e,t,n,s,a,r){return la(e,`c|${t}|${n}|${s}|${r}|${a.cx}|${a.mid}`,()=>{let[o,l]=zt(se,se);l.drawImage(St(e,t,n,0,"#ffffff"),0,0),l.globalCompositeOperation="source-atop",l.fillStyle=r;for(let c=0;c<s;c++)for(let[u,p]of Ni[c])l.fillRect(a.cx+u,a.mid+p,1,1);return o})}function Ne(e,t,n,s,a,r=1,o,l){if(r<=0)return;let c=l?l[2]:t.width,u=l?l[3]:t.height,p=o??c;e.save(),e.globalAlpha*=r,a&&(e.translate(2*n+p,0),e.scale(-1,1)),l?e.drawImage(t,l[0],l[1],c,u,n,s,p,u):e.drawImage(t,n,s,p,u),e.restore()}var Ii=e=>{let t=ra[e];return{...t,cx:t.l+t.r>>1,mid:t.t+51>>1}},sa=class{constructor(){oe(this,"view","happy");oe(this,"col",0);oe(this,"dx",0);oe(this,"dy",0);oe(this,"flip",!1);oe(this,"alpha",1);oe(this,"hide",!1);oe(this,"boost",0);oe(this,"white",0);oe(this,"crack",0);oe(this,"ringA",null);oe(this,"evo",null);oe(this,"body",null);oe(this,"fadeNew",0);oe(this,"aura",!0);oe(this,"extra",!0);oe(this,"extraDy",0);oe(this,"dim",0);oe(this,"shake",0);oe(this,"thread",null);oe(this,"list",[]);oe(this,"marks",[]);oe(this,"after",[]);oe(this,"rings",[])}fx(t,n,s,a,r={}){this.list.push({name:t,frame:n,x:s,y:a,...r})}mark(t,n,s,a,r={}){this.marks.push({name:t,frame:n,x:s,y:a,life:16,anchor:"bc",...r})}};function sr(e,t){let n=t.width,s=t.height;switch(e.anchor){case"c":return[e.x-(n>>1),e.y-(s>>1)];case"bc":return[e.x-(n>>1),e.y-s];case"bl":return[e.x,e.y-s];case"cl":return[e.x,e.y-(s>>1)];default:return[e.x,e.y]}}var $=(e,t,n)=>e>=t&&e<n,Ut=(e,t,n)=>{e.view=t>=1&&t<n-1?"side":"happy"},Ge=(e,t,n,s,a=1)=>[e+Math.round(Math.cos(s)*n),t+Math.round(Math.sin(s)*n*a)];function Ti(e,t,n,s,a){let r=[9,6,3][t-2];for(let[o,l]of[[1,-1],[1.3,0],[1,1]])e.fx(n,t,s+Math.round(r*o),a+Math.round(r*l),{anchor:"c"})}var Bt={firepuff:{dir:!0,hit:5,steps:e=>e?17:15,run(e,t,n){Ut(e,t,n.n);let s=n.E?[0,1,2,4,4,3]:[0,1,2,3];$(t,2,5)&&(e.col=1),$(t,5,7)&&(e.col=2,e.dx=-1);let[a,r]=n.mouth[e.col];$(t,2,5)&&Ti(e,t,"embers",a,r),$(t,5,5+s.length)&&e.fx("flamepuff",s[t-5],a+(t-5===s.length-1?2:0),r,{anchor:"cl",follow:t<7});for(let o of n.E?[4+s.length,6+s.length]:[4+s.length]){let l=t-o;$(l,0,4)&&e.fx("smokering",l,a+20+3*l,r-3-2*l,{anchor:"c",ramp:"neutral"})}}},roar:{hit:6,steps:e=>e?18:15,run(e,t,n){let s=n.E?15:12;$(t,3,6)&&(e.col=1),$(t,6,s)&&(e.col=2,e.dx=t%2?2:-2,e.shake=t%2?1:-1,e.fx("bang",0,n.r+2,n.m-8,{follow:!0,ramp:null})),$(t,6,10)&&e.fx("burstring",t-6,n.r+4+3*(t-6),n.m,{anchor:"c",alpha:[1,.7,.45,.25][t-6]});let a=[n.l+3,n.r-3,n.cx,n.l+8,n.r-8,n.cx-5];for(let r=0;r<(n.E?6:3);r++){let o=t-6-r;$(o,0,7)&&e.fx("wisp",o>>1,a[r]+o%2,49-3*o,{anchor:"c",alpha:o>=5?.5:1})}}},icicles:{dir:!0,hit:4,steps:e=>e?21:17,run(e,t,n){Ut(e,t,n.n);let s=[[0,0],[2,-1],[2,-2],[2,-3],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]);let a=n.E?[2,4,5,7,8]:[2,4,6],r=n.E?16:13;$(t,4,6)&&e.fx("snow",t-4,n.r+2,50,{anchor:"c"}),a.forEach((o,l)=>{let c=n.r+7+9*l,u=t-4-2*l;$(u,0,3)&&t<r?e.fx("icicle",o-2+u,c,52,{anchor:"bc"}):u>=3&&t<r&&e.fx("icicle",o,c,52,{anchor:"bc"}),t===r&&e.fx("icicle",o,c,52,{anchor:"bc",alpha:.5}),l===a.length-1&&$(u,3,7)&&e.fx("glint",u-3,c-1,55-nr[o],{anchor:"c"});for(let p=0;p<3&&$(t-r,0,3);p++){let g=t-r,m=nr[o];e.fx("shard",(l+p)%4,c+(p-1)*(2+2*g),52-m+4*p+g*g+2*g,{anchor:"c",alpha:g===2?.5:1})}}),t===r&&e.mark("frostpatch",1,n.r+4,52,{anchor:"bl",life:18}),n.E&&t===r&&e.mark("frostpatch",1,n.r+22,52,{anchor:"bl",life:18})}},twirl:{hit:4,steps:e=>e?16:12,run(e,t,n){let s=n.E?[[1,0],[1,0],[2,-2],[2,-3],[0,-4],[0,-5],[0,-5],[0,-5],[0,-4],[0,-3],[2,-2],[2,-1],[1,0],[1,0]]:[[1,0],[1,0],[2,-2],[2,-2],[0,-3],[0,-3],[0,-3],[0,-2],[2,-2],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),$(t,2,s.length-1)&&(e.view=(t-2)%2?"side":"happy",e.flip=(t-2>>1)%2===1);let a=n.E?6:4,r=t-4;for(let o=0;o<a&&$(r,0,8);o++){let[l,c]=Ge(n.cx,n.mid,6+3*r,o/a*2*Math.PI+.4,.5);e.fx("snow",r+o,l,c+r,{anchor:"c"})}}},leafwhirl:{hit:3,steps:e=>e?22:18,run(e,t,n){let s=n.n-4;$(t,1,3)&&(e.col=1),$(t,3,s)&&(e.col=t===3?2:0,e.dy=t===3?-1:n.E?-3:-2),t===s&&(e.dy=-1),t===s+1&&(e.col=1);let a=n.E?8:6,r=(n.r-n.l)/2+4,o=s-3;for(let l=0;l<a&&$(t,3,s+3);l++){let c=(t-3)*(Math.PI/3.5)+l/a*2*Math.PI,u=Math.max(0,Math.min(1,(t-3-l*.5)/(o-2))),p=50-Math.round(u*(50-n.t+6)),g=t-s,[m,h]=Ge(n.cx,p,r,c,.25);g>=0&&([m,h]=[m+Math.round(Math.cos(c)*6*(g+1)),h-2*(g+1)+g*g]),e.fx("leaf",(t+l)%3,m,h,{anchor:"c",follow:g<0,alpha:g>=1?.5:1,layer:Math.sin(c)<0&&g<0?"back":"front"})}}},wiggle:{hit:4,steps:e=>e?16:12,run(e,t,n){$(t,2,n.n-2)&&(e.dx=t%2?1:-1,e.col=t%2?1:0),(n.E?[n.r+7,n.l-7]:[n.r+7]).forEach((a,r)=>{let o=t-4-2*r;$(o,0,2)&&e.fx("sprout",o,a,52,{anchor:"bc"}),o===2&&e.mark("sprout",2,a,52,{life:18})})}},petalshower:{hit:3,steps:e=>e?28:25,run(e,t,n){$(t,1,3)&&(e.col=1),$(t,3,5)&&(e.col=2,e.dy=t===3?-1:0);let s=n.E?12:8,a=t-3,r=n.t-3;for(let o=0;o<s&&a>=0;o++){let l=o%2?1:-1,c=l*(4+2*((o>>1)%3)),u=(o>>1)%2*3,p,g;if(a<=3)[p,g]=[n.cx+c*a,r-[0,5,9,11][a]-u];else{let m=a-3;[p,g]=[n.cx+c*3+l*Math.floor(m/3)+((m>>1)%2?2:-2),r-11-u+3*m]}g<49&&e.fx("petal",(a+o)%3,p,g,{anchor:"c"})}t===9&&e.mark("flower",0,n.r+7,52,{life:20}),n.E&&t===11&&e.mark("flower",0,n.l-7,52,{life:18})}},triplehop:{hit:13,steps:()=>18,run(e,t,n){let s=n.E?[5,9,14]:[4,7,11],a=[[1,0]],r=[];for(let o of s){let l=Math.ceil(o/2);a.push([2,-l],[2,-o],[0,-o],[0,-l],[1,0]),r.push(a.length-1)}t<a.length&&([e.col,e.dy]=a[t]),r.forEach((o,l)=>{let c=t-o,u=l===2?8:4;for(let p=0;p<u&&$(c,0,4);p++){let g=p%2===0,m=p>>1;e.fx("petal",(c+p)%3,g?n.l+1-2*c-4*m:n.r-1+2*c+4*m,49-2*c-2*m+(c*c>>1),{anchor:"c",alpha:c===3?.5:1})}if($(c,0,2))for(let p of[n.l,n.r])e.fx("dust",c,p,52,{anchor:"bc",ramp:"neutral"})})}},starburst:{hit:6,steps:e=>e?16:14,run(e,t,n){if($(t,3,6)&&(e.col=1),$(t,6,8)&&(e.col=2),t<6)for(let a=0;a<6;a++){let[r,o]=Ge(n.cx,n.mid,[28,23,18,13,9,5][t],(a+.5)/6*2*Math.PI+t*.15);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}let s=n.E?[[6,0,7],[8,.5,9]]:[[6,0,7]];for(let[a,r,o]of s){let l=t-a;for(let c=0;c<6&&$(l,0,6);c++){let[u,p]=Ge(n.cx,n.mid,8+o*l,(c+r)/6*2*Math.PI);e.fx("bigstar",[2,3,2,3,1,0][l],u,p,{anchor:"c",alpha:l>=4?.5:1})}}}},float:{hit:4,steps:e=>e?18:16,run(e,t,n){let s=n.E?-14:-10,a=[0,-1,-4,-8],r=n.n-4;t<4?e.dy=Math.max(s,a[t]):t<r?e.dy=s+Math.floor((t-4)/3)%2:e.dy=[-6,-2,0,0][t-r],e.dy<0&&e.fx("shadow",Math.min(3,Math.floor(-e.dy/3)),n.cx,51,{anchor:"c",layer:"floor",ramp:"neutral",alpha:.5}),t===n.n-2&&(e.col=1);for(let o=0;o<5;o++){let l=4+2*o,c=t-l;l>=r||!$(c,0,5)||e.fx("bigstar",[1,2,1,0,0][c],n.cx+[-8,6,-3,9,1][o],50+s+2*c,{anchor:"c",alpha:c===4?.5:1})}}},coinshower:{hit:3,steps:e=>e?24:22,run(e,t,n){$(t,1,3)&&(e.col=1),$(t,3,5)&&(e.col=2,e.dy=t===3?-1:0),(n.E?[-2.6,-2,-1.5,1.5,2,2.6,-3.2,3.2]:[-2.4,-1.7,1.7,2.4]).forEach((a,r)=>{let o=t-3-r%3;if(o<0)return;let l=n.cx+Math.sign(a)*6,c=n.t+4,u=a,p=-4-r%2,g=!1,m=-1;for(let y=0;y<o&&m<0;y++)l+=u,p+=1,c+=p,c>=47&&(c=47,g&&(m=y+1),p=g?0:-3,u/=2,g=!0);let h=Math.round(l);m<0?e.fx("coin",o,h,c,{anchor:"c"}):(m===o&&e.mark("coinflat",0,h,52,{life:14}),o-m<4&&e.fx("glint",o-m,h+3,45,{anchor:"c"}))})}},sparkle:{hit:2,steps:e=>e?18:14,run(e,t,n){t===1&&(e.col=1),t===2&&(e.col=2),[[n.l-6,n.t+4],[n.r+5,n.t+9],[n.l-3,n.m+13],[n.r+3,n.m+18],[n.cx+4,n.t-6],[n.l-9,n.m+2],[n.r+8,n.m],[n.cx-7,n.m+24]].slice(0,n.E?8:4).forEach(([a,r],o)=>{let l=t-4-2*(o%4)-(o>=4?1:0);$(l,0,5)&&e.fx("glint",l,a,r,{anchor:"c"})});for(let a=0;a<6&&$(t,2,5);a++){let[r,o]=Ge(n.cx,n.mid,10+7*(t-2),(a+.5)/6*2*Math.PI);e.fx("bigstar",[1,2,0][t-2],r,o,{anchor:"c",alpha:t===4?.5:1})}}},shine:{hit:2,steps:e=>e?18:14,run(e,t,n){for(let s of n.E?[2,7,12]:[2,8]){let a=t-s;$(a,0,3)&&(e.boost=.25,e.ringA=a===1?.8:.35),$(a,0,4)&&e.fx("glint",[1,2,3,4][a],n.r-4,n.t+3,{anchor:"c"});for(let r=0;r<8&&$(a,0,3);r++){let[o,l]=Ge(n.cx,n.mid,(n.r-n.l)/2+3+3*a,r/8*2*Math.PI,.9);e.fx("bigstar",[0,1,0][a],o,l,{anchor:"c",alpha:a===2?.5:1})}}t===1&&(e.col=1),t===2&&(e.col=2)}},shockwave:{hit:5,steps:e=>e?17:14,run(e,t,n){let s=[[0,0],[1,0],[2,-1],[2,-3],[2,-4],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),t===5&&(e.shake=1),t===6&&(e.shake=-1);for(let a of n.E?[5,7]:[5])$(t-a,0,6)&&e.fx("shockring",t-a,n.cx,51,{anchor:"c",layer:"floor"});if($(t,5,8))for(let[a,r]of[[n.l-3,-1],[n.r+3,1]])e.fx("dust",Math.min(1,t-5),a+3*r*(t-5),52,{anchor:"bc",ramp:"neutral",alpha:t===7?.5:1})}},vanish:{hit:10,steps:()=>14,travel:(e,t)=>t?0:e?40:24,run(e,t,n){let s=n.travel;$(t,1,4)&&(e.col=1),e.alpha={2:.66,3:.33,9:.33,10:.66}[t]??1,$(t,4,9)&&(e.hide=!0),t>=9&&(e.dx=s),$(t,10,12)&&(e.col=2);for(let a=0;a<(n.E?8:6);a++){let r=[-8,8,-3,4,-12,11,0,-6][a],o=[2,0,8,12,10,6,-2,16][a],l,c;if($(t,2,5))[l,c]=[n.cx+r,n.mid+o-2*(t-2)];else if($(t,5,9)){let u=t-5,p=s?0:Math.round(4*Math.cos((u+a)*Math.PI/2));[l,c]=[n.cx+r+Math.round(s*(u+1)/5)+p,n.mid+o-6+(u+a)%2]}else if($(t,9,11))[l,c]=[n.cx+s+Math.round(r*(1-(t-9)/2)),n.mid+o-4+2*(t-9)];else continue;e.fx(a%2?"wisps":"wisp",t+a,l,c,{anchor:"c"})}}},zap:{dir:!0,hit:6,steps:e=>e?15:12,run(e,t,n){if(Ut(e,t,n.n),$(t,2,6))for(let a=0;a<4;a++){let[r,o]=Ge(n.cx,n.t-1,[20,15,10,5][t-2],(a+.5)/4*2*Math.PI+t*.3,.6);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}$(t,4,6)&&(e.col=1),$(t,6,8)&&(e.col=2);let s=n.E?[[6,n.r+16],[9,n.r+34]]:[[6,n.r+16]];for(let[a,r]of s){let o=t-a;$(o,0,3)&&e.fx("bolt",o===1?1:0,r,52,{anchor:"bc",alpha:o===2?.5:1}),o===1&&e.mark("scorch",0,r,52,{ramp:"neutral",life:18});for(let l=0;l<6&&$(o,1,5);l++)e.fx("bigstar",[2,1,1,0][o-1],r+(l%2?1:-1)*(3+3*o+2*(l>>1)),50-2*o-(l>>1)*3+(o*o>>1),{anchor:"c"})}}},dash:{dir:!0,hit:4,steps:()=>13,travel:(e,t)=>t?0:e?44:30,run(e,t,n){Ut(e,t,n.n);let s=n.travel,a=s?[0,Math.round(s*.3),Math.round(s*.65),s]:[1,2,3,3];if($(t,2,4)&&(e.col=1,e.dx=-1),$(t,4,8)){let r=t-4;e.col=r<2?2:0,e.dx=a[r];for(let o=1;o<=(n.E?3:2);o++){let l=s?a[r-o]:a[r]-3*o;l!==void 0&&l!==a[r]&&e.after.push({dx:l,alpha:[.5,.3,.15][o-1]})}}if($(t,8,10)){e.col=1,e.dx=(s||3)+1,e.fx("dust",t-8,n.l-3,52,{anchor:"bc",follow:!0,ramp:"neutral"}),e.fx("dust",t-8,n.l-11-2*(t-8),52,{anchor:"bc",follow:!0,ramp:"neutral",alpha:.6});for(let r=0;r<3;r++)e.fx("bigstar",(t-8+r)%3,n.r+3+3*r,49-3*r-2*(t-8),{anchor:"c",follow:!0})}t>=10&&(e.dx=s||[1,0][t-10]||0)}},bubbleblow:{dir:!0,hit:10,light:17,steps:e=>e?30:23,run(e,t,n){Ut(e,t,n.n),$(t,2,4)&&(e.col=1),$(t,4,10)&&(e.col=2);let[s,a]=n.mouth[2];$(t,4,10)&&e.fx("bubble",t-4,s,a,{anchor:"cl"});let r=n.E?[[10,6,2],[13,5,3],[16,4,2]]:[[10,6,2]];for(let[o,l,c]of r){let u=t-o,p=s+9+2*u,g=a-c*u+u%2;$(u,0,7)&&e.fx("bubble",l,p,g,{anchor:"c"}),$(u,7,9)&&e.fx("pop",u-7,p,g,{anchor:"c"});for(let m=0;m<6&&$(u,8,14);m++){let h=u-8,y=[-3,-2,-1,1,2,3][m];e.fx("droplet",0,p+y*(h+2),g+h*h-3*h-1+m%2*2,{anchor:"c",alpha:h>=5?.5:1})}}}},splash:{hit:8,steps:e=>e?18:15,run(e,t,n){let s=n.E?[-5,-11,-16,-18,-18,-16,-11,-5]:[-4,-9,-13,-15,-13,-9,-4],a=[[1,0],[1,0],...s.map((l,c)=>[c<2||c===s.length-1?2:0,l]),[1,0],[1,0]],r=2+s.length;t<a.length&&([e.col,e.dy]=a[t]);for(let l of n.E?[r,r+2]:[r])$(t-l,0,5)&&e.fx("waterring",t-l,n.cx,51,{anchor:"c",layer:"floor"});let o=t-r;$(o,0,3)&&e.fx("crown",o,n.cx,52,{anchor:"bc"});for(let l=0;l<(n.E?10:8)&&$(o,0,8);l++){let c=[-5,-3,-2,-1,1,2,3,5,-4,4][l],u=6-Math.abs(c)%3;e.fx("droplet",0,n.cx+c*(o+2),46-u*o+o*o,{anchor:"c",alpha:o>=6?.5:1})}}}},Gt=(e,t)=>Bt[e].steps(t),ur=(e,t,n)=>Bt[e].travel?.(t,n)??0,gr=e=>!!(Bt[e].dir||Bt[e].travel),ca=54,ua=16,dr=e=>e.kind==="move"?Gt(e.move,e.encore):e.kind==="hatch"?ga:e.reduced?ua:ca,Ai=(()=>{let e=Ri(7);return Array.from({length:16},()=>{let t=e()*4|0,n=e();return[[n*176,-2],[178,n*99*.8],[n*176,-2],[-2,n*99*.8]][t]})})(),rr=[12,20,27,33,38,42];function Pi(e,t,n,s,a,r){if(r){e.evo=t>=12,e.body=t>=12?"new":"old",$(t,4,12)&&(e.fadeNew=[.25,.5,.75,1][t-4>>1]);return}e.evo=t>=44,e.aura=e.extra=t>=46,e.dim=t<10?(t+1)*.06:t<44?.6:[.4,.25,.1][t-44]??0;let o=s+26,l=a+n.mid;t<21&&Ai.forEach(([c,u],p)=>{let g=c+s-62,m=u+a-39,h=Math.min(1,(t+1+p%4)/22)**1.5;h<.92&&e.fx(p%3?"speck":"bigstar",0,Math.round(g+(o-g)*h),Math.round(m+(l-m)*h),{world:!0})}),$(t,10,44)&&(e.col=1),$(t,44,46)&&(e.col=2),$(t,10,22)&&(e.white=[.33,.66][t-10]??(rr.includes(t)?1:.75)),e.body=t<28?"old":t<33?"new":t<37?"old":t<41?"new":t<44?"old":"new",$(t,41,44)&&(e.white=1,e.crack=t-40);for(let c of rr)$(t-c,0,3)&&e.rings.push({d:[2,4,6][t-c],a:[.9,.5,.25][t-c],c:"#ffffff"});$(t,44,49)&&e.fx("burstring",t-44,n.cx,n.mid,{anchor:"c"});for(let c=0;c<8&&$(t,44,52);c++){let u=t-44,[p,g]=Ge(n.cx,n.mid,4+5*u,(c+.5)/8*2*Math.PI);e.fx("shard",c,p,g+(u*u>>1),{anchor:"c",alpha:u>=6?.5:1})}$(t,46,53)&&(e.extraDy=[-20,-14,-8,-3,0,-2,0][t-46])}var pr={prismite:{how:"crack",colour:"frost",moves:["starburst"]},thundrake:{how:"crack",colour:"storm",moves:["zap"]},clockrit:{how:"crack",colour:"gilded",moves:["shockwave"]},wickwisp:{how:"crack",colour:"ember",moves:["firepuff"]},cauldrop:{how:"crack",colour:"moss",moves:["bubbleblow","splash"]},webbit:{how:"thread",colour:"dusk",moves:[]}},ga=24,or=[2,7,11],_i=e=>[[15,e.l-3,e.t+3],[17,e.r+2,e.m],[19,e.cx+2,e.t-4]];function Oi(e,t,n,s){if(s==="thread"){e.dy=t<10?-Math.round(92*(1-t/10)**2):[0,-3,-2,-1][t-10]??0,e.col=t<10?2:[1,2][t-10]??0,e.dim=t<10?.3:[.2,.1][t-10]??0,t<14?e.thread=e.dy+n.t+1:t<18&&(e.thread=n.t+1-25*(t-13));for(let[a,r,o]of _i(n))$(t,a,a+3)&&e.fx("glint",t-a,r,o,{anchor:"c"});return}e.dim=t<6?(t+1)*.07:t<17?.42:[.28,.14][t-17]??0,e.col=t<14?1:$(t,17,19)?2:0,t<17&&(e.white=t<14&&!or.includes(t)?.85:1),$(t,14,17)&&(e.crack=t-13);for(let a of or)$(t-a,0,3)&&e.rings.push({d:[2,4,6][t-a],a:[.9,.5,.25][t-a],c:"#ffffff"});$(t,17,22)&&e.fx("burstring",t-17,n.cx,n.mid,{anchor:"c"});for(let a=0;a<8&&$(t,17,24);a++){let r=t-17,[o,l]=Ge(n.cx,n.mid,4+5*r,(a+.5)/8*2*Math.PI);e.fx("shard",a,o,l+(r*r>>1),{anchor:"c",alpha:r>=5?.5:1})}}function mr(e){e.getContext("2d").getImageData(0,0,1,1)}function ir(e,[t,n,s,a],r){let[o,l]=zt(s,a);return l.drawImage(e,t*r,n*r,s*r,a*r,0,0,s,a),o}var aa=new Map;function xn(e){let t=e("sprites/atlas.json"),n=aa.get(t);return n||(n=(async()=>{let s=await fetch(t);if(!s.ok)throw new Error(`atlas ${s.status}`);let a=await s.json(),[r,o]=await Promise.all([Le(e(a.moves.path)),Le(e(a.extras.path))]),l={};for(let[p,g]of Object.entries(a.moves.pieces))l[p]=g.map(m=>ir(r,m,a.scale));let[c,u]=a.extras.artSize;return a.extras.rows.forEach((p,g)=>{l[`x-${p}`]=Array.from({length:a.extras.frames},(m,h)=>ir(o,[h*c,g*u,c,u],a.scale))}),mr(l.bang[0]),{pieces:l,raw:new Set(a.moves.raw)}})(),aa.set(t,n),n.catch(()=>aa.delete(t))),n}function Fi(e){let t=(p,g)=>e[(g*se+p)*4+3]>0,n=[];for(let p=0;p<se;p++)for(let g=0;g<se;g++)if(t(g,p)){n.push(p);break}if(!n.length)return null;let s=n[0],a=n[n.length-1]-s+1,r=new Map;for(let p=s+Math.floor(.3*a);p<=s+Math.floor(.7*a);p++)for(let g=se-1;g>=0;g--)if(t(g,p)){r.set(p,g);break}if(!r.size)return null;let o=Math.max(...r.values()),l=[...r].filter(([,p])=>p>=o-1),[c,u]=l[l.length>>1];return[u+1,c]}var Dt=new Map;function fr(e,t,n,s=null){let a=JSON.stringify([e,t,n,s]),r=Dt.get(a);return r||(Dt.size>32&&Dt.clear(),r=(async()=>{let[o,l]=zt(se*3,se*2);for(let[u,p]of[[e,0],[t??e,se]]){let g=await Le(u.src),m=g.naturalHeight/u.rows;for(let h=0;h<3;h++){let y=u.frames===3?g.naturalWidth/3*h:0,b=u.frames===3?g.naturalWidth/3:g.naturalWidth;l.save(),n&&(l.translate((2*h+1)*se,0),l.scale(-1,1)),l.drawImage(g,y,u.row*m,b,m,h*se,p,se,se),l.restore()}}mr(o);let c=null;if(s)c=[s,s,s];else if(t){let u=[0,1,2].map(p=>Fi(l.getImageData(p*se,se,se,se).data));c=u.every(Boolean)?u:null}return{img:o,mouths:c}})(),Dt.set(a,r),r.catch(()=>Dt.delete(a))),r}var Li=[0,.35,.8,.35],$i=[[-2,.5],[-3,-1],[-3,-1],[-3,.5],[-2,1],[-1,1]],Hi={rise:e=>[[e.l-4,e.m+12],[e.r-1,e.m+8],[e.r-6,e.m+18]],fall:e=>[[e.l-3,e.t-2],[e.r-2,e.t+2],[e.r+1,e.m+2]],twinkle:e=>[[e.l-5,e.t+2],[e.r-1,e.m+6],[e.l-3,e.m+15]]},Ui=[[0,0],[1,-2],[0,-4],[-1,-6],[0,-8],[1,-10],[0,-12],[-1,-14]],Di=[[0,0],[1,2],[2,4],[1,6],[0,8],[1,10],[2,12],[1,14]];function Bi(e,t){let n=Math.floor(t/3);return e==="rise"?{frame:[0,0,0,1,1,1,2,2][n],d:Ui[n]}:e==="fall"?{frame:[0,1,2,1,0,1,2,1][n],d:Di[n]}:n<3?{frame:n,d:[0,0]}:null}function hr(e,t,n,s){let{ctx:a,art:r,body:o,colour:l,dir:c,X:u,Y0:p}=e,{width:g,height:m}=a.canvas,h=Ii(e.stage),y=l==="storm"?"spark":l,b=Ci[l],d=new sa,v=-99,C=-99;if(t?.kind==="move"){let w=Bt[t.move],T=w.steps(t.encore),B=o.mouths??[0,1,2].map(()=>[h.r,h.m]);w.run(d,n,{...h,mouth:B,E:t.encore,spot:t.spot,n:T,travel:t.travel}),v=n-w.hit,C=n-(w.light??w.hit)}else t?.kind==="hatch"?(Oi(d,n,h,t.how),v=C=n-(t.how==="thread"?10:17)):t&&(Pi(d,n,h,u,p,t.reduced),v=n-46,C=n-44);let k=!e.plain&&(d.evo??!0),P=t?.kind==="move"&&t.encore,U=(w,T)=>c>0?u+w:u+se-w-T,H=U(d.dx,se),E=p+d.dy,x=(w,T,B,D=0)=>{let G=r.pieces[w],Q=G[(T%G.length+G.length)%G.length];return r.raw.has(w)||B===null?Q:na(Q,B,D)},R=(w,T,B)=>{let[D,G,Q]=ia(w),ee=H+26,re=p+30,te=a.createRadialGradient(ee,re,4,ee,re,B?200:95);te.addColorStop(0,`rgba(${D},${G},${Q},${T})`),B&&te.addColorStop(B,`rgba(${D},${G},${Q},${T})`),te.addColorStop(1,`rgba(${D},${G},${Q},0)`),a.fillStyle=te,a.fillRect(0,0,g,m)};if(a.save(),a.clearRect(0,0,g,m),d.shake&&a.translate(d.shake,0),e.lit&&d.dim&&R("#000000",d.dim,.55),e.lit&&t&&(k||e.plain)&&$(C,0,6)){let w=[1,1,.75,.5,.3,.15][C]*(P?1.4:1);l==="shade"?R("#000000",.38*w,0):R(b,.24*w,0)}let O=t?`${t.at}|${n}`:e.drawn;if(O!==e.drawn){e.drawn=O;for(let w of d.marks){let T=x(w.name,w.frame,w.ramp===void 0?y:w.ramp),[B,D]=sr(w,T);e.marks.push({img:T,wx:U(B,T.width),wy:p+D,flip:c<0,born:s,life:w.life})}}e.marks=e.marks.filter(w=>s-w.born<w.life);for(let w of e.marks){let T=w.life-(s-w.born);Ne(a,w.img,w.wx,w.wy,w.flip,T<=3?T/4:1)}if(!t)return a.restore(),e.marks.length>0;let L=w=>{let T=x(w.name,w.frame,w.ramp===void 0?y:w.ramp),[B,D]=sr(w,T);w.follow&&(B+=d.dx,D+=d.dy),w.world?Ne(a,T,B,D,!1,w.alpha??1):Ne(a,T,U(B,T.width),p+D,c<0,w.alpha??1)};d.list.filter(w=>w.layer==="floor").forEach(L),d.list.filter(w=>w.layer==="back").forEach(L);let S=d.col*se,I=d.view==="side"?se:0,M=c<0!==d.flip,A=o.img,N=[S,I,se,se];d.thread!==null&&p+d.thread>0&&(a.fillStyle=lr[3],a.globalAlpha=.8,a.fillRect(U(h.cx+d.dx,1),0,1,p+d.thread),a.globalAlpha=1);for(let w of d.after)Ne(a,St(A,S,I,0,b),U(w.dx,se),E,M,w.alpha);if(!d.hide){for(let B of d.rings)Ne(a,St(A,S,I,B.d,B.c),H-B.d,E-B.d,M,d.alpha*B.a);let w=d.ringA??(k?Li[s%24/6|0]:0);w&&Ne(a,St(A,S,I,2,b),H-2,E-2,M,d.alpha*w),k&&Ne(a,St(A,S,I,1,b),H-1,E-1,M,d.alpha);let T=(d.body??(k?"new":"old"))==="new";if(Ne(a,T?na(A,l,d.boost):A,H,E,M,d.alpha,se,N),d.fadeNew&&Ne(a,na(A,l),H,E,M,d.fadeNew,se,N),d.white){let B=d.crack?Mi(A,S,I,d.crack,h,kn[y][2]):St(A,S,I,0,"#ffffff");Ne(a,B,H,E,M,d.alpha*d.white)}}d.list.filter(w=>!w.layer||w.layer==="front").forEach(L);let z=c>0?u+d.dx:u-d.dx;if(k&&d.aura&&!d.hide){let w=ut[l].aura,T=oa[w],B=$(v,0,12);for(let[D,G]of B?[[0,!1],[4,!0]]:[[0,!1]])Hi[T](h).forEach(([Q,ee],re)=>{let te=Bi(T,(s+re*8+D)%24);if(!te)return;let fe=x(w,te.frame,y,B?.25:0),ge=(G?se-Q-7:Q)+te.d[0]+(7-fe.width>>1),he=ee+te.d[1]+(7-fe.height>>1);Ne(a,fe,z+ge,E+he,!1,d.alpha)})}if(k&&d.extra&&!d.hide){let w=12,T=!1,B=(s%24>=12?-1:0)+d.extraDy;if(t.kind==="move"&&$(v,0,6)){let[G,Q]=$i[v];B+=G,w=Math.round(12*Math.abs(Q)),T=Q<0}let D=x(`x-${e.extra}`,s%12>=6?1:0,y);Ne(a,D,z+20+(12-w>>1),E+h.t-13+B,T,d.alpha,w)}return a.restore(),e.marks.length>0}var En=52,zi=1200,Gi={feed:[{sprite:"tomato",motion:"feed"}],play:[{sprite:"sparkle",motion:"play-a"},{sprite:"sparkle",motion:"play-b"}],rest:[{sprite:"z",motion:"rest-a"},{sprite:"z",motion:"rest-b"}],pet:[{sprite:"heart",motion:"pet"}]},br={stage:{x:176,top:80,bottom:24},spot:{x:48,top:56,bottom:8}},Ki={note:[{sprite:"note",motion:"cue-note"}],question:[{sprite:"question",motion:"cue-question"}],bang:[{sprite:"bang",motion:"cue-bang"}],nap:[{sprite:"z",motion:"nap-a"},{sprite:"z",motion:"nap-b"}]},qi="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0",da=(e,t)=>e.map(n=>(parseInt(n.slice(1+t*2,3+t*2),16)/255).toFixed(3)).join(" ");function wr(){return i("svg",{"aria-hidden":"true",width:"0",height:"0",style:{position:"absolute"},children:i("defs",{children:Object.entries(kn).map(([e,t])=>f("filter",{id:`sl-ramp-${e}`,colorInterpolationFilters:"sRGB",children:[i("feColorMatrix",{type:"matrix",values:qi}),f("feComponentTransfer",{children:[i("feFuncR",{type:"table",tableValues:da(t,0)}),i("feFuncG",{type:"table",tableValues:da(t,1)}),i("feFuncB",{type:"table",tableValues:da(t,2)})]})]},e))})})}function Cn(){let[e,t]=F(null),n=j(void 0);q(()=>()=>window.clearTimeout(n.current),[]);let s=me(a=>{window.clearTimeout(n.current),t({action:a,at:Date.now()}),n.current=window.setTimeout(()=>t(null),zi)},[]);return[e,s]}var Vi={egg:{w:22,h:30},hatchling:{w:26,h:32},juvenile:{w:32,h:40},adult:{w:36,h:46},elder:{w:36,h:46}};function yr(e,t,n){if(e)return{backgroundImage:`url("${e}")`};if(t)return{backgroundImage:`url("${n(t.path)}")`,backgroundSize:`300% ${st*100}%`,backgroundPositionY:`${t.row/(st-1)*100}%`}}function vr(e,t,n){let s=t&&_s(e);if(!s)return;let a=st*$t,r=o=>`${(o*st+t.row)/(a-1)*100}%`;return{backgroundImage:`url("${n(s.path)}")`,backgroundSize:`300% ${a*100}%`,"--sl-live-y0":r(0),"--sl-live-y1":r($t),animationDuration:`${s.ms*$t}ms`,animationTimingFunction:`steps(${$t}, end)`}}function ji({act:e,player:t,look:n,plain:s,stage:a,facing:r,scale:o}){let[l,c]=F(null),[u,p]=F(e);e!==u&&(p(e),c(e?null:u));let g=e??l,m=g?.kind==="move"&&g.spot,h=m?br.spot:br.stage,y=h.x*2+En,b=h.top+En+h.bottom,d=j(null),v=j(null),{colour:C,extra:k}=n;return je(()=>{let P=d.current?.getContext("2d");if(!P||!g)return;P.imageSmoothingEnabled=!1;let U={ctx:P,...t,colour:C,extra:k,stage:a,dir:r==="right"?1:-1,X:h.x,Y0:h.top,lit:!m,plain:s};v.current?.ctx===P?Object.assign(v.current,U):v.current={...U,marks:[],drawn:""};let H=v.current,E=0,x="",R=()=>{let O=Date.now(),L=Math.floor(O/Ke),S=e?Math.min(dr(e)-1,Math.max(0,Math.floor((O-e.at)/Ke))):0,I=`${S}|${L}`;if(I!==x&&(x=I,!hr(H,e,S,L)&&!e))return c(null);E=requestAnimationFrame(R)};return R(),()=>cancelAnimationFrame(E)},[e,g,t,C,k,a,r,h,m,s]),g?i("canvas",{ref:d,"aria-hidden":"true",className:"sl-move-canvas",width:y,height:b,style:{left:`${-h.x*o}px`,top:`${-h.top*o}px`,width:`${y*o}px`,height:`${b*o}px`}}):null}function kt({species:e,stage:t,mood:n,assetUrl:s,alt:a,scale:r,still:o=!1,reaction:l=null,pose:c=null,cue:u=null,customSrc:p=null,sideSrc:g=null,frames:m=3,silhouette:h=!1,look:y=null,act:b=null,facing:d="right",flipped:v=!1}){let C=t==="egg"?null:ra[t],k=!!p,P=k&&m===1,U=!k&&h,H=k||U?null:$e(e,t,n),E=yr(k?p:null,H,s),x=H&&$e(e,t,"side"),R=yr(k?g:null,x,s),O=t==="egg"?void 0:vr(e,H,s),L=t==="egg"?void 0:vr(e,x,s),S=o?"sl-live":"sl-live sl-live--on",I=O?i("span",{className:S,style:O}):null,M=L?i("span",{className:S,style:L}):null,A=O?{...E,backgroundImage:"none"}:E,N=L?{...R,backgroundImage:"none"}:R,z=!!R&&c==="walk"&&!l&&t!=="egg",w=l?`sl-react-${t==="egg"?"egg":l.action}`:c&&t!=="egg"?`sl-pose-${c}`:o?"":P||U?"sl-idle sl-idle-custom":`sl-idle sl-idle-${t==="egg"?"egg":n}`,T=!y&&b&&b.kind!=="moment"?b.colour:void 0,B=y??(T?{colour:T,extra:Rt[0]}:null),D=!!B&&t!=="egg"&&!U,G=D?$e(e,t,"happy"):null,Q=D?$e(e,t,"side"):null,ee=D?JSON.stringify(k?[{src:p,row:0,rows:1,frames:m},g?{src:g,row:0,rows:1,frames:m}:null,v,null]:[{src:s(G.path),row:G.row,rows:st,frames:3},Q?{src:s(Q.path),row:Q.row,rows:st,frames:3}:null,v,v?null:cr[`${e}:${t}`]??null]):"",[re,te]=F(null),fe=j(s);q(()=>{fe.current=s}),q(()=>{if(!ee)return;let ae=!0,[ve,_e,He,Ue]=JSON.parse(ee);return Promise.all([xn(fe.current),fr(ve,_e,He,Ue)]).then(([xt,Ze])=>ae&&te({key:ee,art:xt,body:Ze}),()=>ae&&te(null)),()=>{ae=!1}},[ee]);let ge=re&&re.key===ee&&B&&t!=="egg"?re:null,he=Vi[t],ke={width:`${En*r}px`,height:`${En*r}px`,"--sl-px":`${r}px`,...C?{"--sl-t":C.t,"--sl-l":C.l,"--sl-r":C.r,"--sl-m":C.m}:{},...U?{"--sl-sil-w":he.w,"--sl-sil-h":he.h}:{}},we=P?"sl-sprite-frames sl-sprite-frames--single":U?"sl-sprite-frames sl-sprite-frames--silhouette":"sl-sprite-frames",J=y?ut[y.colour].aura:null,ce=b&&(ge||T)?" sl-sprite--canvas":"";return f("span",{className:y?`sl-sprite sl-evo sl-evo--${y.colour}${ce}`:`sl-sprite${ce}`,role:"img","aria-label":a,style:ke,children:[ge&&B&&t!=="egg"?i(ji,{act:b,player:ge,look:B,plain:!y,stage:t,facing:d,scale:r}):null,y?i("span",{"aria-hidden":"true",className:"sl-evo-ring",children:i("span",{className:z?"sl-sprite-frames sl-pose-walk-side":`${we} ${w}`,style:z?N:A,children:z?M:I},l?.at)}):null,i("span",{className:`${we} ${z?"sl-sprite-frames--hidden":w}`,style:A,children:I},l?.at),R?i("span",{className:`sl-sprite-frames ${z?"sl-pose-walk-side":"sl-sprite-frames--hidden"}`,style:N,children:M}):null,l&&C?(Gi[l.action]??[]).map(ae=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ae.sprite} sl-fx-${ae.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ae.sprite}.webp`)}")`}},`${l.at}-${ae.motion}`)):null,u&&C&&!l?Ki[u.kind].map(ae=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ae.sprite} sl-fx-${ae.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ae.sprite}.webp`)}")`}},`${u.at}-${ae.motion}`)):null,y&&J&&C?f(ie,{children:[["a","b","c"].map(ae=>i("span",{"aria-hidden":"true",className:`sl-evo-aura sl-evo-aura--${oa[J]} sl-evo-aura-${ae}`,style:{backgroundImage:`url("${s("sprites/fx-auras.webp")}")`,backgroundSize:`300% ${nn.length*100}%`,backgroundPositionY:`${nn.indexOf(J)/(nn.length-1)*100}%`}},ae)),i("span",{"aria-hidden":"true",className:"sl-evo-extra",style:{backgroundImage:`url("${s("sprites/fx-extras.webp")}")`,backgroundSize:`200% ${Rt.length*100}%`,backgroundPositionY:`${Rt.indexOf(y.extra)/(Rt.length-1)*100}%`}})]}):null]})}var ot=(e,t=!1)=>({queryKey:["saucelings","form",e,t?"front":"all"],queryFn:()=>V(`/form/${encodeURIComponent(e)}${t?"?strips=front":""}`),staleTime:1/0});function Ae({art:e,frontOnly:t=!1,...n}){let s=$s(e,n.stage),a=s.kind==="form"?s.formId:null,r=ue({...ot(a??"",t),enabled:a!==null}),o=a?r.data??null:null,l=o?(n.mood==="content"?null:o[n.mood])??o.image:null,c=!l&&(s.kind==="silhouette"||a!==null&&e.design?.origin==="found");return i(kt,{...n,customSrc:l,sideSrc:o?.side??null,frames:o?.frames??1,silhouette:c,look:e.evolution?.look??null})}var Qi=1024,kr=1024;function xr(e,t=!1){let n=e?e.lockedStage??e.stage:null;if(!e?.design||!n||!e.design.stages[n])return null;let s=t||Object.keys(e.forms).length===0?"sheet":"stage";return{petId:e.id,species:e.species,design:e.design,forms:e.forms,stage:n,kind:s}}var Wi=e=>e&&!e.forms[e.stage]?e:null,Er=e=>["saucelings","paint",e],Yi=e=>e.kind==="sheet"?"sheet":e.stage,Xi=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;async function pa(e,t,n,s,a){return(await Re("/api/characters/avatar-generation","POST",{connectionId:e,name:"sauceling-form",appearance:t,promptOverrides:[{id:"avatar:sauceling-form",prompt:t,negativePrompt:n}],styleProfileId:"off",width:s,height:s,...a.length>0?{referenceImages:a}:{}})).image}async function Cr(e,t,n,s,a){let{design:r,stage:o}=e,l=Be.slice(0,Be.indexOf(o)).reverse().map(m=>e.forms[m]).find(Boolean),c=null,u=null;if(l)c=await n.fetchQuery(ot(l,!0)).then(m=>nt(m.image)).catch(()=>null),u=c?"earlier":null;else if(r.origin==="evolved"){let m=$e(e.species,o,"content");c=await nt(s(m.path),m.row).catch(()=>null),u=c?"before":null}let p=await pa(t,Js(r,o,u),js(o),Qi,c?[c]:[]),g=await ks(p,o);if(!g)throw new Error(a);return V("/form","POST",{stage:o,image:g,petId:e.petId})}async function Ji(e,t,n,s,a){let r=$e(e.species,"adult","content"),o=e.design.origin==="evolved"?await nt(s(r.path),r.row).catch(()=>null):null,l=ea(e.design),c=await pa(t,Zs(e.design,o?"before":null),Ks,kr,o?[o]:[]),u=await xs(c,l);return u?V("/form/sheet","POST",{petId:e.petId,forms:u}):Cr({...e,kind:"stage"},t,n,s,a)}function Rr(e,t,n){let{t:s}=X(),a=pe(),r=t.world.settings.portraitConnectionId;return ne({mutationKey:e?Er(e.petId):["saucelings","paint"],mutationFn:async({target:o})=>{if(!r)throw new Error(s("saucelings.album.needsConnection"));await V("/form/start","POST",{petId:o.petId,key:Yi(o),token:Xi});let c=await(o.kind==="sheet"?Ji:Cr)(o,r,a,n,s("saucelings.form.failed"));return await Promise.all(Object.values(c.world.activePet?.forms??{}).map(u=>a.prefetchQuery(ot(u)))),c},onSuccess:o=>{a.setQueryData(["saucelings","state"],o),a.invalidateQueries({queryKey:["saucelings","menagerie"]})}}).mutate}function Nr(e){let n=Ua({filters:{mutationKey:e,exact:!0},select:s=>s.state}).at(-1);return{pending:n?.status==="pending",error:n?.error??null}}var ma=e=>Nr(Er(e)),Mr="saucelings-paint-asked",Ir=new Set;function Tr(){try{let e=JSON.parse(localStorage.getItem(Mr)??"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}catch{return[]}}var Zi=e=>Ir.has(e)||Tr().includes(e);function el(e){Ir.add(e);try{localStorage.setItem(Mr,JSON.stringify([...Tr().filter(t=>t!==e),e].slice(-100)))}catch{}}function tl({isEgg:e,name:t,onAnswer:n}){let{t:s}=X(),a=j(null);return q(()=>{let r=a.current;return r&&!r.open&&r.showModal(),r?.querySelector(".sl-btn--primary")?.focus(),()=>r?.close()},[]),f("dialog",{ref:a,className:"sl-dialog","aria-labelledby":"sl-paint-offer-title",onCancel:r=>{r.preventDefault(),n(!1)},children:[i("h2",{id:"sl-paint-offer-title",children:e?s("saucelings.form.offerEggTitle"):s("saucelings.form.offerTitle",{name:t})}),i("p",{children:e?s("saucelings.form.offerEggBody"):s("saucelings.form.offerBody",{name:t})}),f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(!1),children:s("saucelings.form.offerNotNow")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>n(!0),children:s("saucelings.form.offerPaint")})]})]})}function Ar({petId:e}){let{t}=X(),{pending:n,error:s}=ma(e);return n?i("span",{role:"status",style:{fontSize:"0.8rem",opacity:.8},children:t("saucelings.form.paintingEgg")}):s?i("span",{role:"alert",className:"sl-error",children:t("saucelings.form.eggFailed",{error:tn(s,t).message})}):null}function Rn({state:e,assetUrl:t}){let{t:n}=X(),s=e.world.activePet,a=Wi(xr(s)),r=Rr(a,e,t),{pending:o,error:l}=ma(a?.petId??""),[,c]=F(0),u=e.world.settings;if(!s||!a||!u.portraitEnabled||!u.portraitConnectionId)return null;let p=s.stage==="egg",g=`${a.petId}/${a.stage}`,m=h=>{el(g),c(y=>y+1),h&&r({target:a})};return f("div",{className:"sl-care-row",children:[!o&&!Zi(g)?i(tl,{isEgg:p,name:s.name,onAnswer:m}):null,i("button",{type:"button",className:"sl-btn",disabled:o,onClick:()=>r({target:a}),children:o?n("saucelings.form.painting"):`\u{1F3A8} ${p?n("saucelings.form.paintEgg"):n("saucelings.form.paint",{name:s.name,stage:n(`saucelings.stage.${a.stage}`)})}`}),i("span",{className:"sl-care-note",role:"status",children:n(o?"saucelings.form.paintingNote":"saucelings.form.needed")}),l&&!o?i("span",{role:"alert",className:"sl-error",children:i(de,{error:l})}):null]})}function Pr({state:e,assetUrl:t}){let{t:n}=X(),s=pe(),[a,r]=F(!1),o=e.world.activePet,l=xr(o,!0),c=Rr(l,e,t),{pending:u,error:p}=ma(l?.petId??""),g=ne({mutationFn:async d=>{let v=await V("/form/undo","POST",{petId:d});return await Promise.all(Object.values(v.world.activePet?.forms??{}).map(C=>s.prefetchQuery(ot(C)))),v},onSuccess:d=>{s.setQueryData(["saucelings","state"],d),s.invalidateQueries({queryKey:["saucelings","menagerie"]})}}),m=e.world.settings;if(!o||!l||!l.forms[l.stage]||!m.portraitEnabled)return null;let h=!!m.portraitConnectionId,y=Object.keys(o.savedForms).length>0;if(!h&&!y)return null;let b=o.stage==="egg"?n("saucelings.form.repaintEgg"):n("saucelings.form.repaint",{name:o.name});return f("div",{className:"sl-about-row",children:[a?f(ie,{children:[i("span",{className:"sl-care-note",children:n("saucelings.form.repaintNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>{r(!1),c({target:l})},children:n("saucelings.form.repaintConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>r(!1),children:n("saucelings.common.cancel")})]}):f(ie,{children:[u?i("button",{type:"button",className:"sl-btn",disabled:!0,children:n("saucelings.form.painting")}):h?i(Ee,{text:n("saucelings.form.repaintHint"),label:n("saucelings.help.label",{action:b}),children:f("button",{type:"button",className:"sl-btn",onClick:()=>r(!0),children:["\u{1F3A8} ",b]})}):null,y?i(Ee,{text:n("saucelings.form.undoRepaintHint"),label:n("saucelings.help.label",{action:n("saucelings.form.undoRepaint")}),children:f("button",{type:"button",className:"sl-btn",disabled:u||g.isPending,onClick:()=>g.mutate(o.id),children:["\u21B6 ",n("saucelings.form.undoRepaint")]})}):null,i("span",{className:"sl-care-note",role:"status",children:u?n("saucelings.form.paintingNote"):null})]}),p&&!u?i("span",{role:"alert",className:"sl-error",children:i(de,{error:p})}):null,g.error&&!g.isPending?i("span",{role:"alert",className:"sl-error",children:i(de,{error:g.error})}):null]})}function _r({name:e,flipped:t,request:n}){let{t:s}=X(),a=pe(),r=ne({mutationFn:()=>n(!t),onSuccess:o=>a.setQueryData(["saucelings","state"],o)});return f("div",{className:"sl-about-row",children:[i(Ee,{text:s("saucelings.flip.note",{name:e}),label:s("saucelings.help.label",{action:s("saucelings.flip.label",{name:e})}),children:f("button",{type:"button",className:"sl-btn","aria-pressed":t,disabled:r.isPending,onClick:()=>r.mutate(),children:["\u2194 ",s("saucelings.flip.label",{name:e})]})}),r.error&&!r.isPending?i("span",{role:"alert",className:"sl-error",children:i(de,{error:r.error})}):null]})}function Or({state:e}){let{t}=X(),n=e.world.activePet;return n?i(_r,{name:n.stage==="egg"?t("saucelings.egg.name"):n.name,flipped:n.flipped,request:s=>V("/pet","PATCH",{flipped:s})}):null}function Fr({state:e,characterId:t,name:n}){return i(_r,{name:n,flipped:e.world.flippedCaretakers.includes(t),request:s=>V("/caretaker/flip","PATCH",{characterId:t,flipped:s})})}var Sr=e=>["saucelings","figure-paint",e];function Lr({state:e,characterId:t,name:n,sprites:s}){let{t:a}=X(),r=pe(),[o,l]=F(!1),c=e.world.settings,u=c.portraitConnectionId,p=bt(e.world.caretakerFigures[t]),g=({next:k,image:P,frames:U})=>{let H=k.world.caretakerFigures[t];H&&r.setQueryData(["saucelings","figure",H],{image:P,frames:U}),r.setQueryData(["saucelings","state"],k)},m=ne({mutationKey:Sr(t),mutationFn:async()=>{if(!u)throw new Error(a("saucelings.album.needsConnection"));let k=await r.fetchQuery(Wn(t)),P=[k.avatar,Jn(s,"neutral")].filter(x=>!!x),U=(await Promise.all(P.map(x=>Rs(x).catch(()=>null)))).filter(x=>x!==null),H=null;for(let x of Ys(n,k.appearance,U,c.threeDrawingFallback)){let R=await pa(u,x.prompt,qs,kr,x.references);if(H=await Es(R),H)break}if(!H)throw new Error(a("saucelings.figure.failed",{name:n}));return{next:await V("/figure","POST",{characterId:t,image:H.image}),...H}},onSuccess:g}).mutate,h=ne({mutationFn:async()=>{let k=await V("/figure/undo","POST",{characterId:t}),P=k.world.caretakerFigures[t];return P&&await r.prefetchQuery({queryKey:["saucelings","figure",P],queryFn:()=>V(`/figure/${encodeURIComponent(P)}`),staleTime:1/0}),k},onSuccess:k=>r.setQueryData(["saucelings","state"],k)}),{pending:y,error:b}=Nr(Sr(t));if(!c.portraitEnabled)return null;let d=!!e.world.caretakerFigures[t],v=!!(d&&e.world.savedFigures[t]);if(!u&&!v)return null;let C=y||h.isPending;return i(ie,{children:f("div",{className:"sl-about-row",children:[o?f(ie,{children:[i("span",{className:"sl-care-note",children:a("saucelings.figure.confirmNote",{name:n})}),i("button",{type:"button",className:"sl-btn",onClick:()=>{l(!1),m()},children:a("saucelings.figure.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>l(!1),children:a("saucelings.common.cancel")})]}):f(ie,{children:[y?i("button",{type:"button",className:"sl-btn",disabled:!0,children:a("saucelings.form.painting")}):u?i(Ee,{text:a("saucelings.figure.hint"),label:a("saucelings.help.label",{action:d?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:C,onClick:()=>l(!0),children:["\u{1F3A8} ",d?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})]})}):null,v?i(Ee,{text:a("saucelings.figure.undoHint"),label:a("saucelings.help.label",{action:a("saucelings.figure.undoRepaint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:C,onClick:()=>h.mutate(),children:["\u21B6 ",a("saucelings.figure.undoRepaint",{name:n})]})}):null,i("span",{className:"sl-care-note",role:"status",children:y?a("saucelings.form.paintingNote"):p?.frames===3?a("saucelings.figure.threePoses",{name:n}):null})]}),b&&!y?i("span",{role:"alert",className:"sl-error",children:i(de,{error:b})}):null,h.error&&!h.isPending?i("span",{role:"alert",className:"sl-error",children:i(de,{error:h.error})}):null]})})}function $r({keepsake:e,assetUrl:t,large:n=!1}){let{t:s}=X(),{backgroundId:a}=e,r=ue({queryKey:["saucelings","background",a],queryFn:()=>V(`/background/${encodeURIComponent(a??"")}`),enabled:a!==null,staleTime:1/0}),o=a?r.data?.image??null:t(vt({species:e.species,stage:e.stage})),c=[{art:{...e.art,evolution:{...e.art.evolution,look:null}},label:s("saucelings.album.before")},{art:e.art,label:s("saucelings.album.after")}];return f("span",{className:`sl-keepsake${n?" sl-keepsake--large":""}`,children:[o?i("img",{className:`sl-stage-bg ${a?"":"sl-stage-bg--pixel"}`,src:o,alt:""}):null,c.map(u=>f("span",{className:"sl-keepsake-side",children:[i(Ae,{art:u.art,species:e.species,stage:e.stage,mood:"happy",assetUrl:t,alt:"",scale:n?2:1,still:!0,frontOnly:!0}),n?i("span",{className:"sl-keepsake-label",children:u.label}):null]},u.label))]})}function Hr({id:e,className:t,alt:n}){let{t:s}=X(),a=ue({queryKey:["saucelings","portrait",e],queryFn:()=>V(`/portrait/${encodeURIComponent(e)}`),staleTime:1/0});return a.data?i("img",{className:t,src:a.data.image,alt:n}):i("span",{className:`${t} sl-gallery-blank`,children:a.isError?s("saucelings.album.missing"):null})}function Ur({state:e,packageId:t,packageVersion:n}){let{t:s}=X(),a=N=>Qe(t,N,n),r=pe(),o=e.world.activePet,l=e.world.settings,[c,u]=F(null),[p,g]=F(null),[m,h]=F(!1),[y,b]=F(!1),[d,v]=F(""),C=j(null);q(()=>{(c||p)&&C.current?.focus()},[c,p]);let k=ue({queryKey:["saucelings","portraits"],queryFn:()=>V("/portraits"),refetchOnMount:"always"}),P=k.data?.portraits??[],U=ue({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),enabled:e.menagerieCount>0}),H=[];if(o?.evolution.look&&o.stage!=="egg"){let N=rt(o).stage;H.push({petId:o.id,name:o.name,home:"nook",art:o,species:o.species,stage:N==="egg"?"hatchling":N,backgroundId:o.backgroundId,form:o.evolution.look.form,at:o.evolution.at})}for(let N of e.menagerieCount>0?U.data?.menagerie??[]:[]){let z=N.reachedElder?"elder":N.lockedStage??N.stageAtRetirement;!N.evolution.look||z==="egg"||N.id===o?.id||H.push({petId:N.id,name:N.name,home:"menagerie",art:N,species:N.species,stage:z,backgroundId:N.backgroundId,form:N.evolution.look.form,at:N.evolution.at})}let E=N=>{r.setQueryData(["saucelings","state"],N),r.invalidateQueries({queryKey:["saucelings","portraits"]})},x=ne({mutationFn:async N=>{if(!l.portraitConnectionId)throw new Error(s("saucelings.album.needsConnection"));let z=rt(N).stage,w=N.forms[z],T=$e(N.species,z,"content"),B=w?r.fetchQuery(ot(w,!0)).then(te=>nt(te.image)):N.design?null:nt(a(T.path),T.row),D=B?await B.catch(()=>null):null,G=y?d.replace(/\s+/gu," ").trim():"",Q=Qs(N,D!==null,G),ee=await Re("/api/characters/avatar-generation","POST",{connectionId:l.portraitConnectionId,name:"sauceling-portrait",appearance:Q,promptOverrides:[{id:"avatar:sauceling-portrait",prompt:Q,negativePrompt:zs(G)}],styleProfileId:"off",...D?{referenceImages:[D]}:{}}),re=await Ns(ee.image).catch(()=>ee.image);return V("/portrait","POST",{petId:N.id,image:re,instructions:G})},onSuccess:E}),R=ne({mutationFn:N=>V(`/portrait/${encodeURIComponent(N)}/delete`,"POST",{}),onSuccess:N=>{u(null),h(!1),E(N)}}),O=new Map;for(let N of P){let z=O.get(N.petId)??{petId:N.petId,name:N.petName,home:N.home,keepsake:null,paintings:[]};z.paintings.push(N),O.set(N.petId,z)}for(let N of H){let z=O.get(N.petId);z?z.keepsake=N:O.set(N.petId,{petId:N.petId,name:N.name,home:N.home,keepsake:N,paintings:[]})}let L=[...O.values()].sort((N,z)=>+(z.home==="nook")-+(N.home==="nook")),S=P.find(N=>N.id===c)??null,I=H.find(N=>N.petId===p)??null,M=x.error??R.error??k.error,A=l.portraitEnabled?o?o.stage==="egg"?s("saucelings.album.egg"):e.portraitCount>=Bn?s("saucelings.album.full",{limit:Bn}):null:s("saucelings.album.noPet"):s("saucelings.album.off");return f("div",{style:{display:"grid",gap:"1rem"},children:[f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem",justifyItems:"start"},children:[A||!o?i("span",{style:{fontSize:"0.85rem",opacity:.8},children:A}):f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:x.isPending,onClick:()=>{R.isError&&R.reset(),x.mutate(o)},children:x.isPending?s("saucelings.album.painting"):`\u{1F3A8} ${s("saucelings.album.paint",{name:o.name})}`}),i("button",{type:"button",className:"sl-link",disabled:x.isPending,onClick:()=>b(!y),children:s(y?"saucelings.album.removeInstructions":"saucelings.album.addInstructions")}),y?f("div",{style:{display:"grid",gap:"0.3rem",width:"100%"},children:[i("label",{className:"sl-picker-label",htmlFor:"sl-paint-instructions",children:s("saucelings.album.instructionsLabel")}),i("textarea",{id:"sl-paint-instructions",className:"sl-input sl-picker-prompt",rows:2,maxLength:Xa,placeholder:s("saucelings.album.instructionsPlaceholder"),disabled:x.isPending,value:d,onChange:N=>v(N.target.value)}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:s("saucelings.album.instructionsNote")})]}):null]}),M?i("span",{role:"alert",className:"sl-error",children:i(de,{error:M})}):null,o&&!A?i(Rn,{state:e,assetUrl:a}):null]}),I?f("div",{className:"sl-card sl-viewer",ref:C,tabIndex:-1,children:[i($r,{keepsake:I,assetUrl:a,large:!0}),i("div",{style:{fontSize:"0.85rem"},children:s("saucelings.album.keepsakeCaption",{name:I.name,form:I.form,date:I.at?new Date(I.at).toLocaleDateString():""})}),i("div",{style:{fontSize:"0.8rem",opacity:.75},children:s("saucelings.album.keepsakeNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:s("saucelings.album.close")})]}):null,S?f("div",{className:"sl-card sl-viewer",ref:C,tabIndex:-1,children:[i(Hr,{id:S.id,className:"sl-viewer-image",alt:s("saucelings.album.alt",{name:S.petName})}),f("div",{style:{fontSize:"0.85rem"},children:[i("strong",{children:S.petName})," ",i("span",{style:{opacity:.75},children:s("saucelings.album.caption",{stage:s(`saucelings.stage.${S.stage}`),date:new Date(S.savedAt).toLocaleDateString()})}),S.instructions?i("div",{style:{fontStyle:"italic",opacity:.75},children:s("saucelings.album.instructionsCaption",{instructions:S.instructions})}):null]}),i("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem"},children:m?f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:R.isPending,onClick:()=>{x.isError&&x.reset(),R.mutate(S.id)},children:s("saucelings.album.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>h(!1),children:s("saucelings.common.cancel")})]}):f(ie,{children:[i("button",{type:"button",className:"sl-btn",onClick:()=>h(!0),children:s("saucelings.album.delete")}),i("button",{type:"button",className:"sl-btn",onClick:()=>u(null),children:s("saucelings.album.close")})]})})]}):null,k.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.loading")}):L.length===0?f("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:[s("saucelings.album.empty"),o&&!A?` ${s("saucelings.album.emptyHint")}`:null]}):L.map(N=>f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem"},children:[f("div",{style:{fontSize:"0.9rem"},children:[i("strong",{children:N.name})," ",i("span",{style:{opacity:.7},children:N.home==="menagerie"?s("saucelings.album.inMenagerie"):N.home==="released"?s("saucelings.album.released"):""})]}),f("div",{className:"sl-gallery",children:[N.keepsake?i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.keepsakeLabel",{name:N.name}),"aria-pressed":N.petId===p,onClick:()=>{u(null),g(N.petId)},children:i($r,{keepsake:N.keepsake,assetUrl:a})}):null,N.paintings.map(z=>i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.alt",{name:z.petName}),"aria-pressed":z.id===c,onClick:()=>{h(!1),g(null),u(z.id)},children:i(Hr,{id:z.id,className:"sl-gallery-image",alt:""})},z.id))]})]},N.petId))]})}var Dr="saucelings-journal-seen";function nl(){try{return localStorage.getItem(Dr)}catch{return null}}function al(e){let t=[];for(let n of e){let s=new Date(n.createdAt),a=s.toDateString(),r=t[t.length-1];r?.key===a?r.events.push(n):t.push({key:a,at:s,events:[n]})}return t}function Br({state:e,onOpenNook:t}){let{t:n}=X(),s=e.world.activePet,a=s?.journal??[],r=a[0]?.createdAt??null,[o]=F(nl);q(()=>{if(r)try{localStorage.setItem(Dr,r)}catch{}},[r]);let l=o?a.filter(p=>p.createdAt>o).length:0;if(!s||a.length===0)return f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem",justifyItems:"center",padding:"2rem"},children:[i("span",{style:{opacity:.75},children:s?n("saucelings.journal.empty",{name:s.name}):n("saucelings.empty.title")}),s?null:i("button",{type:"button",className:"sl-btn",onClick:t,children:n("saucelings.journal.toNook")})]});let c=new Date().toDateString(),u=new Date(Date.now()-864e5).toDateString();return f("div",{style:{display:"grid",gap:"0.65rem"},children:[l>0?i("p",{role:"status",style:{margin:0,fontSize:"0.8rem",fontWeight:600},children:n("saucelings.journal.new",{count:l})}):null,al(a).map(p=>f("section",{style:{display:"grid",gap:"0.65rem"},children:[i("h3",{style:{margin:"0.35rem 0 0",fontSize:"0.8rem",fontWeight:600,opacity:.75},children:p.key===c?n("saucelings.journal.today"):p.key===u?n("saucelings.journal.yesterday"):p.at.toLocaleDateString()}),p.events.map(g=>f("div",{className:"sl-card",style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"1rem"},children:[f("div",{style:{display:"grid",gap:"0.25rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.72rem",opacity:.7},children:[i("span",{style:{textTransform:"uppercase",fontWeight:600},children:n(`saucelings.event.${g.kind}`)}),g.generated?i("span",{className:"sl-pill sl-pill--ai",children:n("saucelings.journal.generated")}):null]}),f("p",{style:{margin:0,fontSize:"0.875rem",lineHeight:1.45},children:[g.speaker?i("strong",{children:n("saucelings.journal.speaker",{name:g.speaker})}):null,g.speaker?" ":null,g.text]})]}),i("time",{dateTime:g.createdAt,title:new Date(g.createdAt).toLocaleString(),style:{fontSize:"0.72rem",opacity:.6,whiteSpace:"nowrap"},children:new Date(g.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})})]},g.id))]},p.key))]})}function fa(e){return e.design?null:qa.includes(e.species)?"special":Va.includes(e.species)?"halloween":null}var sl={special:{rows:["....K....","...KYK...","KKKKYKKKK","KYYYWYYYK",".KYYYYYK.","..KYYYK..",".KYYKYYK.",".KYK.KYK.",".KK...KK."],colours:{K:"#4a2c0a",Y:"#ffd84a",W:"#fff6c2"}},halloween:{rows:[".....gg..","....gG...",".KKKgKKK.","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK",".KOOOOOK.","..KKKKK.."],colours:{K:"#5a2008",O:"#ff8a28",o:"#c95212",g:"#2f5e1e",G:"#7fd35a"}}},rl=Object.fromEntries(Object.entries(sl).map(([e,{rows:t,colours:n}])=>[e,t.flatMap((s,a)=>[...s.matchAll(/([^.])\1*/gu)].map(r=>({x:r.index,y:a,w:r[0].length,fill:n[r[1]]})))]));function Kt({pet:e,labelled:t=!0}){let{t:n}=X(),s=fa(e);return s?i("svg",{className:"sl-rare-mark",viewBox:"0 0 9 9",width:"18",height:"18",shapeRendering:"crispEdges",...t?{role:"img","aria-label":n(`saucelings.pet.rare.${s}`)}:{"aria-hidden":!0},children:rl[s].map(a=>i("rect",{x:a.x,y:a.y,width:a.w,height:1,fill:a.fill},`${a.x},${a.y}`))}):null}function zr(e){let t=ze(e)?.sauce;return t?{"--sl-sauce-accent":t.accentColor,"--sl-sauce-bg":t.badgeBg}:{}}function Gr({state:e,packageId:t,packageVersion:n,onRestored:s}){let{t:a}=X(),r=M=>Qe(t,M,n),o=pe(),l=ue({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),refetchOnMount:"always"}),c=l.data?.menagerie??[],u=e.world.activePet,p=u?u.stage==="egg"?a("saucelings.menagerie.activeEgg"):u.name:"",[g,m]=F({}),[h,y]=F({}),b=M=>h[M.id]??(M.farewellScene?M.caretakerId:e.characters.find(A=>A.id===M.foundBy)?.id??""),[d,v]=F(null),[C,k]=F(null),P=j(null),U=j(new Map),H=j(null);q(()=>{d?P.current?.focus():H.current&&U.current.get(H.current)?.focus(),H.current=null},[d]);let E=ne({mutationFn:M=>V(`/menagerie/${encodeURIComponent(M.id)}/restore`,"POST",{stage:M.stage,swap:M.swap,caretakerId:M.caretakerId}),onSuccess:(M,A)=>{k(null),o.setQueryData(["saucelings","state"],M),s(A.caretakerId)}}),x=ne({mutationFn:M=>V(`/menagerie/${encodeURIComponent(M)}/release`,"POST",{}),onSuccess:M=>{k(null),v(null),o.setQueryData(["saucelings","state"],M),o.invalidateQueries({queryKey:["saucelings","menagerie"]}),o.invalidateQueries({queryKey:["saucelings","portraits"]})}}),R=E.error??x.error??l.error,O=E.isPending||x.isPending,L=c.find(M=>M.id===d)??null,S=M=>{k(null),v(M)},I=()=>{H.current=d,k(null),v(null)};return l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.loading")}):c.length===0&&!R?f("div",{className:"sl-card",style:{display:"grid",gap:"0.5rem",textAlign:"center",padding:"2.5rem"},children:[i("span",{style:{opacity:.75},children:a("saucelings.menagerie.empty")}),i("span",{style:{fontSize:"0.8rem",opacity:.65},children:a("saucelings.menagerie.emptyHow")})]}):f("div",{style:{display:"grid",gap:"1rem"},children:[R?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(de,{error:R})}):null,L?i(ol,{entry:L,cardRef:P,assetUrl:r,chosenStage:g[L.id]??"elder",onPickStage:M=>m(A=>({...A,[L.id]:M})),characters:e.characters,caretakerId:b(L),onPickCaretaker:M=>y(A=>({...A,[L.id]:M})),activeName:p,hasActivePet:!!u,confirming:C,setConfirming:k,pending:O,onRestore:(M,A)=>E.mutate({id:L.id,stage:M,swap:A,caretakerId:b(L)}),onRelease:()=>x.mutate(L.id),onClose:I},L.id):null,Os(c).map(M=>f("section",{className:"sl-menagerie-section",children:[f("h3",{className:"sl-menagerie-heading",children:[a(`saucelings.menagerie.section.${M.stage}`),i("span",{className:"sl-menagerie-count",children:M.entries.length})]}),i("div",{className:"sl-gallery sl-gallery--pets",children:M.entries.map(A=>{let N=A.stageAtRetirement==="egg",z=N?a("saucelings.egg.name"):A.name,w=N?null:fa(A);return f("button",{ref:T=>{T?U.current.set(A.id,T):U.current.delete(A.id)},type:"button",className:"sl-gallery-tile",style:zr(A),"aria-label":w?`${z}, ${a(`saucelings.pet.rare.${w}`)}`:z,"aria-pressed":A.id===d,onClick:()=>S(A.id),children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:A,species:A.species,stage:A.reachedElder?g[A.id]??"elder":A.lockedStage??A.stageAtRetirement,mood:"happy",assetUrl:r,alt:"",scale:2,still:!0,frontOnly:!0})}),N?null:f("span",{className:"sl-pet-tile-name",children:[i(Kt,{pet:A,labelled:!1}),A.name]})]},A.id)})})]},M.stage))]})}function ol({entry:e,cardRef:t,assetUrl:n,chosenStage:s,onPickStage:a,characters:r,caretakerId:o,onPickCaretaker:l,activeName:c,hasActivePet:u,confirming:p,setConfirming:g,pending:m,onRestore:h,onRelease:y,onClose:b}){let{t:d}=X(),[v,C]=F(!1),k=j(null),P=Xe(e),U=e.stageAtRetirement==="egg",H=U?d("saucelings.egg.name"):e.name,E=U?d("saucelings.menagerie.thisEgg"):e.name,x=ze(e),R=e.reachedElder?s:e.lockedStage??e.stageAtRetirement,O=S=>h(e.reachedElder?s:void 0,S),L=r.length>0?r.map(S=>({id:S.id,name:S.name})):[{id:"caretaker",name:d("saucelings.empty.houseCaretaker")}];return e.farewellScene&&!L.some(S=>S.id===e.caretakerId)&&L.unshift({id:e.caretakerId,name:e.careProfile.characterName}),f("div",{ref:t,tabIndex:-1,className:"sl-card sl-viewer",style:{display:"grid",gap:"0.75rem",justifyItems:"stretch",...zr(e)},children:[f("div",{style:{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"},children:[i("div",{className:"sl-sprite-stage",style:{width:"7.5rem",height:"7.5rem"},children:i(Ae,{art:e,species:e.species,stage:R,mood:"happy",assetUrl:n,alt:H,scale:2,still:!0,frontOnly:!0})}),f("div",{style:{flex:"1 1 16rem",display:"grid",gap:"0.35rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"1.1rem"},children:H}),U?null:i(Kt,{pet:e}),U||!x?null:i("span",{className:"sl-badge",title:x.readsAs,children:x.sauce?d("saucelings.pet.sauce",{sauce:x.name}):d("saucelings.pet.temperament",{temperament:x.name})}),i("span",{className:"sl-badge",children:d("saucelings.menagerie.foundBy",{name:e.finder.name})}),!U&&e.evolution?.at?i("span",{className:"sl-badge",children:d("saucelings.menagerie.evolved")}):null,f("span",{style:{fontSize:"0.8rem",opacity:.75},children:[U?"":`${P.name} \xB7 `,e.farewellScene?d("saucelings.menagerie.retiredAs",{stage:d(`saucelings.stage.${e.stageAtRetirement}`),name:e.careProfile.characterName}):""]})]}),e.farewellScene?i("p",{style:{margin:0,fontSize:"0.825rem",opacity:.85},children:e.farewellScene}):null,U&&e.design?i(Ar,{petId:e.id}):null]})]}),f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem",flexWrap:"wrap"},children:[i("span",{children:d("saucelings.menagerie.lookedAfterBy")}),f("select",{ref:k,className:"sl-select",value:o,disabled:m,onChange:S=>l(S.target.value),children:[o?null:i("option",{value:"",disabled:!0,children:d("saucelings.menagerie.chooseCaretaker")}),L.map(S=>i("option",{value:S.id,children:S.name},S.id))]}),v&&!o?i("span",{className:"sl-care-note",role:"status",children:d("saucelings.menagerie.chooseFirst")}):null]}),f("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem",borderTop:"1px solid var(--border, rgba(255,255,255,0.08))",paddingTop:"0.65rem"},children:[p?f(ie,{children:[i("span",{style:{fontSize:"0.8rem"},children:p==="release"?U?d("saucelings.menagerie.releaseNoteEgg"):d("saucelings.menagerie.releaseNote",{name:e.name}):d("saucelings.menagerie.swapNote",{name:E,active:c})}),f("div",{style:{display:"flex",gap:"0.5rem"},children:[p==="release"?i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:m,onClick:y,children:d("saucelings.menagerie.releaseConfirm")}):i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m||!o,onClick:()=>O(!0),children:d("saucelings.menagerie.swapConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:d("saucelings.common.cancel")})]})]}):e.reachedElder?i(Ee,{text:d("saucelings.menagerie.lockStageHelp"),label:d("saucelings.help.label",{action:d("saucelings.menagerie.lockStage")}),children:f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem"},children:[i("span",{children:d("saucelings.menagerie.lockStage")}),i("select",{className:"sl-select",value:s,onChange:S=>a(S.target.value),children:Qa.map(S=>i("option",{value:S,children:d(`saucelings.stage.${S}`)},S))})]})}):e.farewellScene?null:f("span",{style:{fontSize:"0.75rem",opacity:.7},children:[d("saucelings.menagerie.returnsAt")," ",i("strong",{children:d(`saucelings.stage.${e.stageAtRetirement}`)})]}),p?null:f("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginLeft:"auto"},children:[i("button",{type:"button",className:"sl-btn",onClick:b,children:d("saucelings.menagerie.close")}),i("button",{type:"button",className:"sl-btn",disabled:m,onClick:()=>g("release"),children:d("saucelings.menagerie.release")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m,"aria-disabled":!o||void 0,onClick:()=>{o?u?g("swap"):O(!1):(C(!0),k.current?.focus())},children:d("saucelings.menagerie.bringBack")})]})]})]})}var qr=1280,Vr=720,il=20*1024*1024;async function Kr(e){let t=await Le(e),n=Math.min(t.naturalWidth,t.naturalHeight*16/9),s=n*9/16,a=document.createElement("canvas");a.width=Math.min(qr,Math.round(n)),a.height=Math.min(Vr,Math.round(a.width*9/16));let r=a.getContext("2d");if(!r)throw new Error("This browser cannot resize pictures.");r.imageSmoothingQuality="high",r.drawImage(t,(t.naturalWidth-n)/2,(t.naturalHeight-s)/2,n,s,0,0,a.width,a.height);let o=a.toDataURL("image/webp",.85);return o.startsWith("data:image/webp")?o:a.toDataURL("image/jpeg",.88)}function ll({id:e}){let{t}=X(),n=ue({queryKey:["saucelings","background",e],queryFn:()=>V(`/background/${encodeURIComponent(e)}`),staleTime:1/0});return n.data?i("img",{className:"sl-gallery-image",src:n.data.image,alt:""}):i("span",{className:"sl-gallery-image sl-gallery-blank",children:n.isError?t("saucelings.background.missing"):null})}function jr({pet:e,settings:t,assetUrl:n,onClose:s}){let{t:a}=X(),r=pe(),o=j(null),l=j(null);q(()=>{l.current?.focus()},[]);let[c,u]=F(()=>ta(e)),[p,g]=F(null),m=ue({queryKey:["saucelings","backgrounds"],queryFn:()=>V("/backgrounds"),refetchOnMount:"always"}),h=m.data?.backgrounds??[],y=h.length>=Dn,b=S=>S.label||a("saucelings.background.earlier"),d=S=>{r.setQueryData(["saucelings","state"],S),r.invalidateQueries({queryKey:["saucelings","backgrounds"]})},[v,C]=F(null),k={onMutate:()=>C(null),onError:S=>C(S)},P=ne({mutationFn:async S=>{if(S.size>il)throw new Error(a("saucelings.background.tooBig"));let I=URL.createObjectURL(S);try{let M=await Kr(I),A=S.name.replace(/\.[^.]+$/u,"").slice(0,120);return await V("/background","POST",{image:M,label:A,source:"upload"})}finally{URL.revokeObjectURL(I)}},onSuccess:d,...k}),U=ne({mutationFn:async()=>{if(!t.portraitConnectionId)throw new Error(a("saucelings.background.noConnection"));let S=er(c),I=await Re("/api/characters/avatar-generation","POST",{connectionId:t.portraitConnectionId,name:"sauceling-background",appearance:S,width:qr,height:Vr,styleProfileId:"off",promptOverrides:[{id:"avatar:sauceling-background",prompt:S,negativePrompt:Vs}]}),M=await Kr(I.image);return V("/background","POST",{image:M,label:c.trim().slice(0,120),source:"generated"})},onSuccess:d,...k}),H=ne({mutationFn:()=>V("/background/suggest","POST",{}),onSuccess:({scene:S})=>u(S??ta(e)),...k}),E=ne({mutationFn:S=>V(S?`/background/${encodeURIComponent(S)}/select`:"/background/clear","POST",{}),onSuccess:d,...k}),x=ne({mutationFn:S=>V(`/background/${encodeURIComponent(S)}/delete`,"POST",{}),onSuccess:S=>{g(null),d(S)},...k}),R=P.isPending||U.isPending||H.isPending||E.isPending||x.isPending,O=v??m.error,L=t.portraitEnabled?t.portraitConnectionId?null:a("saucelings.background.noConnection"):a("saucelings.background.off");return f("section",{ref:l,className:"sl-card sl-picker",tabIndex:-1,"aria-label":a("saucelings.background.title"),onKeyDown:S=>{S.key==="Escape"&&s()},children:[i("strong",{children:a("saucelings.background.title")}),f("div",{className:"sl-gallery sl-gallery--wide",role:"group","aria-label":a("saucelings.background.library"),children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.useBuiltIn"),title:a("saucelings.background.useBuiltIn"),"aria-pressed":e.backgroundId===null,disabled:R,onClick:()=>e.backgroundId!==null&&E.mutate(null),children:i("img",{className:"sl-gallery-image sl-stage-bg--pixel",src:n(vt(e)),alt:""})}),h.map(S=>f("div",{className:"sl-gallery-item",children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.tileAlt",{label:b(S)}),title:b(S),"aria-pressed":e.backgroundId===S.id,disabled:R,onClick:()=>e.backgroundId!==S.id&&E.mutate(S.id),children:i(ll,{id:S.id})}),i("button",{type:"button",className:"sl-gallery-remove","aria-label":a("saucelings.background.delete",{label:b(S)}),title:a("saucelings.background.delete",{label:b(S)}),disabled:R,onClick:()=>g(S),children:"\xD7"})]},S.id))]}),i("span",{className:"sl-box-note",children:a("saucelings.background.sharedNote")}),p?f("div",{className:"sl-picker-row",role:"group","aria-label":a("saucelings.background.delete",{label:b(p)}),children:[i("span",{className:"sl-box-note",children:a("saucelings.background.deleteNote",{label:b(p)})}),i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:R,onClick:()=>x.mutate(p.id),children:a("saucelings.background.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:a("saucelings.common.cancel")})]}):null,f("div",{className:"sl-picker-row",children:[i("input",{ref:o,type:"file",className:"sl-sr-only",accept:"image/png,image/jpeg,image/webp",tabIndex:-1,onChange:S=>{let I=S.target.files?.[0];S.target.value="",I&&P.mutate(I)}}),i("button",{type:"button",className:"sl-btn",disabled:R||y,onClick:()=>o.current?.click(),children:P.isPending?a("saucelings.background.uploading"):`\u2B06 ${a("saucelings.background.upload")}`}),i("button",{type:"button",className:"sl-btn",onClick:s,children:a("saucelings.album.close")}),y?i("span",{className:"sl-box-note",children:a("saucelings.background.full",{limit:Dn})}):null]}),i("label",{className:"sl-picker-label",htmlFor:"sl-background-prompt",children:a("saucelings.background.promptLabel")}),i("textarea",{id:"sl-background-prompt",className:"sl-input sl-picker-prompt",rows:3,maxLength:600,value:c,disabled:H.isPending,onChange:S=>{u(S.target.value),H.reset()}}),f("div",{className:"sl-picker-row",children:[i("button",{type:"button",className:"sl-btn",disabled:R||L!==null,onClick:()=>H.mutate(),children:H.isPending?a("saucelings.background.suggesting"):`\u270D ${e.stage==="egg"?a("saucelings.background.suggestEgg"):a("saucelings.background.suggest",{name:e.name})}`}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:R||y||L!==null||!c.trim(),onClick:()=>U.mutate(),children:U.isPending?a("saucelings.background.generating"):`\u2728 ${a("saucelings.background.generate")}`}),L?i("span",{className:"sl-box-note",children:L}):null,H.data?.scene===null?i("span",{className:"sl-box-note",children:a("saucelings.background.suggestPlain")}):null]}),O?i("span",{role:"alert",className:"sl-error",children:i(de,{error:O})}):null]})}function ha(e,t=e*9/16){let n=Math.round(Math.max(e/176,t/99));return n>=4?4:n<=2?2:3}var ba=["rigamuffin","fluttino","burrowl"],cl=["shellbini","lentino","puddlepip"],Qr=["fluttino","wickwisp"],ul={grumpy:6,content:10,happy:14};function gl(e){return e>=22||e<7}function dl(e,t,n,s=!1){let a=ba.includes(t)?2:1,r=cl.includes(t)?3:1;if(e==="grumpy")return{wander:2,idle:3,look:1,hop:0,hum:0,nap:0,huff:3,signature:0};if(e==="happy")return{wander:4,idle:3,look:a,hop:1,hum:r,nap:0,huff:0,signature:s?1:0};let o=gl(n)?4:1;return{wander:4,idle:3,look:a,hop:0,hum:r,nap:o,huff:0,signature:s?.5:0}}function Wr(e,t,n,s,a=!1){let r=dl(e,t,n,a),o=Object.keys(r).filter(u=>r[u]>0),l=o.reduce((u,p)=>u+r[p],0),c=Math.min(Math.max(s,0),.999999)*l;for(let u of o)if(c-=r[u],c<0)return u;return o[o.length-1]}function ya(e,t,n){return e==="huff"?"grumpy":e==="hop"||e==="hum"||e==="signature"?t==="grumpy"?null:"happy":e!=="idle"?null:t==="happy"?n<.6?"happy":null:t==="content"?n<.25?"happy":null:n<.3?"content":null}function Nn(e,t,n){return t==="rest"?"content":t?e==="grumpy"?"content":"happy":n??(e==="happy"?"content":e)}function qt(e){return{min:-6,max:Math.max(-6,Math.floor(e)-52+6)}}function it(e,t){let{min:n,max:s}=qt(t);return Math.round(Math.min(Math.max(e,n),s))}var pl=.3;function Yr(e,t){return t?Math.floor(e*(1-pl)):e}function va(e){return it((e-52)/2,e)}function Xr(e,t){return Math.max(200,Math.round(Math.abs(e)/ul[t]*1e3))}var ml=48,fl=1e3;function Jr(e){return Math.min(fl,Math.max(200,Math.round(Math.abs(e)/ml*1e3)))}var Mn=(e,t)=>e+Math.random()*(t-e);function Pe(){if(typeof document>"u")return!0;let e=document.documentElement;return e.dataset.marinaraReducedEffects==="true"||e.dataset.marinaraEffectsPaused==="true"||document.hidden||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Zr({stageArtWidth:e,mood:t,species:n,enabled:s,busy:a,paused:r=!1,move:o=null,measureX:l}){let[c,u]=F(()=>({x:va(e),facing:"right",pose:null,cue:null,moveMs:0,steps:1,face:null,act:null})),p=s&&!a&&!r&&e>0,g=j({actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p});g.current={actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p};let m=j([]),h=j(null),y=me(I=>u(M=>({...M,...I})),[]),b=me((I,M)=>{m.current.push(window.setTimeout(M,I))},[]),d=me(()=>{for(let M of m.current)window.clearTimeout(M);m.current=[];let I=h.current;h.current=null,I?.()},[]),v=me(()=>{let I=g.current.measureX(),M=g.current.stageArtWidth;u(A=>({...A,x:I===null||M<=0?A.x:it(I,M),moveMs:0,steps:1,pose:null,cue:null,face:null,act:null}))},[]),C=j(()=>{}),k=me(()=>b(Mn(2500,7e3),()=>C.current()),[b]),P=me((I,M,A=!1)=>{let{actor:N,mood:z}=g.current,w=it(I,g.current.stageArtWidth),T=w-N.x;if(Math.abs(T)<4)return M();let B=A?Jr(T):Xr(T,z);y({x:w,facing:T>0?"right":"left",pose:"walk",moveMs:B,steps:Math.abs(T)}),b(B+60,()=>{y({pose:null,moveMs:0,steps:1}),M()})},[b,y]),U=me((I,M,A,N,z)=>{let{actor:w,stageArtWidth:T}=g.current,B=it(g.current.measureX()??w.x,T),D=z!==void 0||Math.random()<1/8,G=gr(I)?A??(B+52/2<=T/2?"right":"left"):w.facing,Q=G==="right"?1:-1,ee=Math.abs(it(B+Q*ur(I,D,!1),T)-B);y({x:B,moveMs:0,steps:1,facing:G,face:M,act:{kind:"move",move:I,encore:D,travel:ee,spot:!1,at:Date.now(),...z?{colour:z}:{}}}),b(Gt(I,D)*Ke,()=>{y({act:null,x:B+Q*ee,face:null}),N()})},[b,y]),H=me(()=>{if(Pe())return k();let{actor:I,mood:M,species:A,stageArtWidth:N,move:z}=g.current,w=Wr(M,A,new Date().getHours(),Math.random(),!!z),T=ya(w,M,Math.random()),B=Date.now();switch(w){case"wander":{let{min:D,max:G}=qt(N);return P(Mn(D,G),k)}case"idle":return y({face:T}),b(Mn(3e3,6e3),()=>{y({face:null}),k()});case"look":{let D=I.facing;return y({facing:D==="right"?"left":"right",cue:ba.includes(A)?{kind:"question",at:B}:null,face:T}),b(1400,()=>{y({facing:D,cue:null,face:null}),k()})}case"hop":return y({pose:"hop",face:T}),b(700,()=>{y({pose:null,face:null}),k()});case"hum":return y({cue:{kind:"note",at:B},face:T}),b(2200,()=>{y({cue:null,face:null}),k()});case"nap":return y({pose:"nap",cue:{kind:"nap",at:B},face:T}),b(Mn(4e3,6e3),()=>{y({pose:null,cue:null,face:null}),k()});case"huff":return y({pose:"huff",face:T}),b(1300,()=>{y({pose:null,face:null}),k()});case"signature":return z?U(z,T,null,k):k()}},[b,k,y,U,P]);C.current=H,q(()=>{if(p)return k(),()=>{d(),v()}},[p,k,d,v]);let E=j(!1);q(()=>{if(e<=0)return;let I=!E.current;I&&(E.current=!0),u(M=>{let A=s&&!I?it(M.x,e):va(e);return A===M.x?M:{...M,x:A,moveMs:0,steps:1}})},[e,s]);let x=me(I=>{if(!s||a||r||Pe())return;d(),v();let M=Date.now(),A=g.current.measureX()??g.current.actor.x,N=I>=A+52/2?"right":"left",{move:z,mood:w}=g.current;if(z&&w==="happy"&&Math.random()<.4)return U(z,"happy",N,k);y({facing:N,pose:"hop",cue:{kind:"bang",at:M}}),b(700,()=>{y({pose:null,cue:null}),P(I-52/2,k)})},[b,k,a,s,r,v,y,U,d,P]),R=me(I=>{d(),v();let M=Pe();y({act:{kind:"moment",reduced:M,at:Date.now()}});let A=()=>{g.current.running&&k()};b((M?ua:ca)*Ke,()=>{y({act:null}),M?A():U(I,"happy",null,A)})},[b,k,v,y,U,d]),O=me((I,M,A,N)=>{d(),v(),y({act:{kind:"hatch",how:I,colour:M,at:Date.now()}});let z=w=>w<A.length?U(A[w],"happy",null,()=>z(w+1),M):N();b(ga*Ke,()=>{y({act:null}),z(0)})},[b,v,y,U,d]),L=me(I=>{if(!s||a||r||h.current||Pe())return;d(),v();let M=()=>{y({facing:I?"right":g.current.actor.facing,pose:"hop",face:ya("hop",g.current.mood,0)}),b(700,()=>{y({pose:null,face:null}),k()})};if(!I)return M();y({facing:"right"}),b(300,()=>P(qt(g.current.stageArtWidth).max,M))},[b,k,a,s,r,v,y,d,P]),S=me(I=>new Promise(M=>{if(!I||!s||a||r||Pe()||g.current.stageArtWidth<=0)return M();d(),v(),h.current=M;let A=0,N=()=>{if(g.current.measureX()!==g.current.actor.x&&A++<8)return b(50,N);h.current=null,M(),k()},z=g.current.actor.facing!=="right";y({facing:"right"}),b(z?250:60,()=>P(qt(g.current.stageArtWidth).max,N,!0))}),[b,k,a,s,r,v,y,d,P]);return{actor:c,poke:x,listen:L,comeOver:S,celebrate:R,hatch:O}}var hl=8,bl=2,yl=44;function eo({lines:e,fallbackLine:t,caretakerId:n,caretakerName:s,isCharacter:a,meals:r,isEgg:o,writing:l,standing:c,onTyping:u,children:p}){let{t:g}=X(),m=e.slice(0,hl),[h,y]=F(0),b=m[0]?.id;q(()=>y(0),[b]);let d=Math.min(h,Math.max(0,m.length-1)),v=m[d]??null,C=ht(n,a&&!c),k=v&&l.includes(v.id)?g("saucelings.checkIn.pending",{name:v.speaker??s}):v?.text??t,P=m[0]&&!l.includes(m[0].id)?m[0]:null,U=P?`${P.id}:${P.text}`:null,H=j(U),[E,x]=F(null);q(()=>{!U||U===H.current||(H.current=U,x(Pe()?null:0))},[U]);let R=Array.from(k),O=E!==null&&d===0&&v===P&&E<R.length;q(()=>{if(!O)return;let S=window.setTimeout(()=>x(I=>I===null?null:I+bl),yl);return()=>window.clearTimeout(S)},[O,E]),q(()=>u?.(O),[u,O]);let L=S=>{x(null),y(S)};return f("section",{className:`sl-box sl-box--joined ${c?"sl-box--standing":""}`,"aria-label":g("saucelings.caretaker.says",{name:s}),children:[c?null:i(yt,{box:!0,name:s,src:C}),f("div",{className:"sl-box-plate",children:[i("strong",{children:v?.speaker??s}),r.total>0?i("span",{className:"sl-pill",title:g(o?"saucelings.pet.keptWarmTitle":"saucelings.pet.mealsTitle",{name:s}),children:g(o?"saucelings.pet.keptWarm":"saucelings.pet.meals",r)}):null,v?.generated?i("span",{className:"sl-pill sl-pill--ai",children:g("saucelings.journal.generated")}):null]}),f("p",{className:`sl-box-line ${O?"sl-box-line--typing":""}`,"aria-live":"polite",onClick:()=>x(null),children:[f("span",{className:"sl-box-typed","aria-hidden":"true",children:[i("span",{className:"sl-box-ghost",children:k}),i("span",{children:O?R.slice(0,E).join(""):k})]}),i("span",{className:"sl-sr-only",children:k})]}),v?f("div",{className:"sl-box-nav",children:[m.length>1?f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":g("saucelings.caretaker.previous"),disabled:d>=m.length-1,onClick:()=>L(d+1),children:"\u25C0"}),i("span",{children:g("saucelings.caretaker.position",{index:m.length-d,count:m.length})}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":g("saucelings.caretaker.next"),disabled:d===0,onClick:()=>L(d-1),children:"\u25B6"})]}):null,i("time",{className:"sl-box-time",children:new Date(v.createdAt).toLocaleString()})]}):null,p]})}function to({state:e,assetUrl:t}){let{t:n}=X(),[s,a]=F(!1),r=e.world.activePet;return!r||r.stage==="egg"||r.evolution.offer!=="offered"||r.evolution.look?null:f("div",{className:"sl-about-row",children:[f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>a(!0),children:["\u2728 ",n("saucelings.evolve.button")]}),i("span",{className:"sl-care-note",children:n("saucelings.evolve.note",{name:r.name})}),s?i(wl,{pet:r,assetUrl:t,onClose:()=>a(!1)}):null]})}function no({state:e}){let{t}=X(),n=pe(),s=ne({mutationFn:()=>V("/evolve/undo","POST",{}),onSuccess:r=>n.setQueryData(["saucelings","state"],r)}),a=e.world.activePet;return a?.evolution.look?f("div",{className:"sl-about-row",children:[i(Ee,{text:t("saucelings.evolve.undoNote",{name:a.name}),label:t("saucelings.help.label",{action:t("saucelings.evolve.undo")}),children:f("button",{type:"button",className:"sl-btn",disabled:s.isPending,onClick:()=>s.mutate(),children:["\u21A9 ",t("saucelings.evolve.undo")]})}),s.error&&!s.isPending?i("span",{role:"alert",className:"sl-error",children:i(de,{error:s.error})}):null]}):null}function vl(e){let[t,n]=F(null),s=e.join(" ");return q(()=>{if(!s)return;let a=Math.max(...s.split(" ").map(l=>Gt(l,!1)))*Ke,r=0,o=l=>{n(l&&!Pe()?Date.now():null),r=window.setTimeout(()=>o(!l),l?a:2100)};return r=window.setTimeout(()=>o(!0),1200),()=>window.clearTimeout(r)},[s]),Zt(()=>s.split(" ").map(a=>t===null?null:{kind:"move",move:a,encore:!1,travel:0,spot:!0,at:t}),[s,t])}function wl({pet:e,assetUrl:t,onClose:n}){let{t:s}=X(),a=pe(),r=j(null),[o,l]=F(!1),c=e.careProfile.characterName,u=C=>{a.setQueryData(["saucelings","state"],C)},p=ne({mutationFn:()=>V("/evolve/options","POST",{}),onSuccess:u}),g=ne({mutationFn:C=>V("/evolve/choose","POST",{index:C}),onSuccess:C=>{u(C),n()}}),m=ne({mutationFn:()=>V("/evolve/decline","POST",{}),onSuccess:C=>{u(C),n()}}),h=e.evolution.choices,y=vl(h?.map(C=>C.move)??[]),b=p.isPending||g.isPending||m.isPending,d=g.isPending||m.isPending,v=p.error??g.error??m.error;return q(()=>{let C=r.current;return C&&!C.open&&C.showModal(),C?.focus(),()=>C?.close()},[]),q(()=>{h||p.mutate()},[]),f("dialog",{ref:r,className:"sl-dialog sl-dialog--wide",tabIndex:-1,"aria-labelledby":"sl-evolve-title",onCancel:C=>{C.preventDefault(),o?l(!1):d||n()},onClose:n,children:[i("h2",{id:"sl-evolve-title",children:o?s("saucelings.evolve.declineConfirm",{name:e.name}):s("saucelings.evolve.title",{name:e.name})}),o?f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",autoFocus:!0,onClick:()=>l(!1),children:s("saucelings.common.cancel")}),i("button",{type:"button",className:"sl-btn",disabled:b,onClick:()=>m.mutate(),children:s("saucelings.evolve.decline")})]}):f(ie,{children:[h?i("div",{className:"sl-evolve-choices",children:h.map((C,k)=>f("div",{className:"sl-evolve-choice",children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:{...e,evolution:{...e.evolution,look:C}},species:e.species,stage:e.stage,mood:"happy",act:y[k]??null,facing:e.flipped?"left":"right",flipped:e.flipped,assetUrl:t,alt:"",scale:2})}),i("h3",{children:C.form}),i("p",{children:C.description}),i("p",{className:"sl-evolve-from",children:s("saucelings.evolve.from",{from:C.from})}),i("p",{children:s("saucelings.evolve.move",{move:s(`saucelings.evolve.moves.${C.move}`)})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:b,onClick:()=>g.mutate(k),children:s("saucelings.evolve.become",{form:C.form})})]},C.form))}):i("p",{role:"status",children:p.isPending||!v?s("saucelings.evolve.writing",{caretaker:c,name:e.name}):null}),v&&!b?i("p",{role:"alert",className:"sl-error",children:i(de,{error:v})}):null,f("div",{className:"sl-dialog-actions",children:[v&&!h&&!b?i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>p.mutate(),children:s("saucelings.error.retry")}):null,i("button",{type:"button",className:"sl-btn",disabled:d,onClick:n,children:s("saucelings.evolve.keep")})]}),f("p",{className:"sl-evolve-decline",children:[i("button",{type:"button",className:"sl-link",disabled:b,onClick:()=>l(!0),children:s("saucelings.evolve.decline")})," ",s("saucelings.evolve.declineNote",{name:e.name})]})]})]})}var ao="saucelings-tour-seen";function wa(){try{return localStorage.getItem(ao)==="1"}catch{return!1}}function Sl(){try{localStorage.setItem(ao,"1")}catch{}}function Sa(e){return`/sprites/mari/basic/pose-${e}.webp?v=39c2`}var In=[{title:"saucelings.tour.eggTitle",body:"saucelings.tour.eggBody",target:null,pose:"greet"},{title:"saucelings.tour.metersTitle",body:"saucelings.tour.metersBody",target:"meters",pose:"point-up"},{title:"saucelings.tour.careTitle",body:"saucelings.tour.careBody",target:"care",pose:"point-down"},{title:"saucelings.tour.caretakerTitle",body:"saucelings.tour.caretakerBody",target:"caretaker",pose:"explaining"},{title:"saucelings.tour.aboutTitle",body:"saucelings.tour.aboutBody",target:"menu",pose:"point-up"},{title:"saucelings.tour.tabsTitle",body:"saucelings.tour.tabsBody",target:"tabs",pose:"point-up"}],kl={...In[0],title:"saucelings.tour.petTitle",body:"saucelings.tour.petBody"};function so({caretaker:e,hatched:t,onClose:n}){let{t:s}=X(),[a,r]=F(0),[o,l]=F(!0),c=j(null),u=j(null),p=Jt(),g=a===0&&t?kl:In[a],m=a===In.length-1;return q(Sl,[]),q(()=>{let h=c.current?.closest(".sl-shell")??document,y=g.target?[...h.querySelectorAll(`[data-sl-tour="${g.target}"]`)]:[];if(!y.length)return;for(let d of y)d.classList.add("sl-tour-target");let b=window.matchMedia("(prefers-reduced-motion: reduce)").matches;return y[0].scrollIntoView({block:"center",behavior:b?"auto":"smooth"}),()=>y.forEach(d=>d.classList.remove("sl-tour-target"))},[g.target]),f("div",{ref:c,className:"sl-tour",role:"dialog","aria-labelledby":p,onKeyDown:h=>{h.key==="Escape"&&(h.stopPropagation(),n())},children:[o?i("img",{className:"sl-tour-mari",src:Sa(g.pose),alt:"",onError:()=>l(!1)}):null,f("div",{className:"sl-tour-text",children:[i("strong",{id:p,children:s(g.title,{caretaker:e})}),i("p",{children:s(g.body,{caretaker:e})}),f("div",{className:"sl-tour-foot",children:[i("span",{className:"sl-tour-dots","aria-hidden":"true",children:In.map((h,y)=>i("span",{className:y===a?"sl-tour-dot sl-tour-dot--on":"sl-tour-dot"},h.title))}),m?null:i("button",{type:"button",className:"sl-link",onClick:n,children:s("saucelings.tour.skip")}),a>0?i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>{a===1&&u.current?.focus(),r(a-1)},children:s("saucelings.tour.back")}):null,i("button",{ref:u,type:"button",className:"sl-btn sl-btn--small sl-btn--primary",autoFocus:!0,onClick:()=>m?n():r(a+1),children:s(m?"saucelings.tour.done":"saucelings.tour.next")})]})]})]})}var ro=8,xl=10,El={x:.5,y:.69},ka=2,oo=32,xa=13;function Cl(e,t,n){let s=Math.max(e/n.width,t/n.height);return{left:(e-n.width*s)/2,top:(t-n.height*s)/2,width:n.width*s,height:n.height*s}}var Rl=22;function Nl(){let e=j(null),[t,n]=F({width:0,height:0});return q(()=>{let s=e.current;if(!s||typeof ResizeObserver>"u")return;let a=()=>n(o=>o.width===s.clientWidth&&o.height===s.clientHeight?o:{width:s.clientWidth,height:s.clientHeight});a();let r=new ResizeObserver(a);return r.observe(s),()=>r.disconnect()},[]),[e,t]}function Tn({pet:e,reaction:t,assetUrl:n,backgroundSrc:s,paused:a=!1,caretaker:r=null,caretakerFlipped:o=!1,listenKey:l=null,handle:c,onMoveEgg:u,scaleByWidth:p=!1}){let{t:g}=X(),[m,{width:h,height:y}]=Nl(),b=j(null),d=p?ha(h):ha(h,y),v=h/d,C=rt(e),k=e.stage==="egg",P=s!==null,U=me(()=>{let W=m.current,Z=b.current;return!W||!Z?null:Math.round((Z.getBoundingClientRect().left-W.getBoundingClientRect().left)/d)},[d,m]),H=e.design?void 0:pr[e.species],[E,x]=F({id:e.id,isEgg:k}),[R,O]=F(!1);(E.id!==e.id||E.isEgg!==k)&&(x({id:e.id,isEgg:k}),O(E.id===e.id&&!k&&!!H&&!a&&!Pe()));let L=R?null:t;q(()=>{k&&H&&xn(n).catch(()=>{})},[k,H,n]);let S=r!==null,{actor:I,poke:M,listen:A,comeOver:N,celebrate:z,hatch:w}=Zr({stageArtWidth:Yr(v,S),mood:C.mood,species:e.species,enabled:!k,busy:R||t!==null,paused:a,move:e.evolution.look?.move??null,measureX:U}),T=e.evolution.look?.colour??null,B=j(T);q(()=>{T!==B.current&&(B.current=T,T&&z(ut[T].moves[0]))},[T,z]),je(()=>{R&&H&&w(H.how,H.colour,H.moves,()=>O(!1))},[R,H,w]),Ga(c,()=>({comeOver:()=>N(S)}),[N,S]);let D=j(l);q(()=>{l!==D.current&&(D.current=l,l&&A(S))},[l,A,S]);let G=W=>{let Z=m.current;Z&&M((W.clientX-Z.getBoundingClientRect().left)/d)},[Q,ee]=F({width:16,height:9}),[re,te]=F(null),fe=e.eggSpot?.backgroundId===(P?e.backgroundId:null)?e.eggSpot:null,ge=k?re??fe??(P?null:El):null,he=Cl(h,y,Q),ke=y/d,we=k&&u!==void 0&&h>0,J=(W,Z)=>{let be=(52/2-xa)*d,xe=Math.min(h-be,Math.max(be,W)),Oe=Math.min(y,Math.max(oo*d,Z));return{x:(xe-he.left)/he.width,y:(Oe-he.top)/he.height}},ce=W=>({px:he.left+W.x*he.width,py:he.top+W.y*he.height}),ae=j(void 0),ve=j(null);q(()=>()=>{window.clearTimeout(ae.current),ve.current&&u?.(ve.current).catch(()=>{})},[]);let _e=(W,Z)=>{te(W),ve.current=W,window.clearTimeout(ae.current),ae.current=window.setTimeout(()=>{ve.current=null,u?.(W).catch(()=>{}).finally(()=>te(be=>be===W?null:be))},Z)},He=j(null),Ue=W=>{let Z=m.current?.getBoundingClientRect();return Z?{px:W.clientX-Z.left,py:W.clientY-Z.top}:null},xt=we?{onPointerDown:W=>{let Z=Ue(W);if(!Z||!ge||W.button!==0)return;W.stopPropagation(),W.currentTarget.setPointerCapture(W.pointerId);let be=ce(ge);He.current={pointer:W.pointerId,dx:Z.px-be.px,dy:Z.py-be.py,to:null}},onPointerMove:W=>{let Z=He.current,be=Ue(W);if(!Z||Z.pointer!==W.pointerId||!be)return;let xe=J(be.px-Z.dx,be.py-Z.dy),Oe=ce(ge??xe),Ve=ce(xe);!Z.to&&Math.hypot(Ve.px-Oe.px,Ve.py-Oe.py)<4||(Z.to=xe,te(xe))},onPointerUp:W=>{let Z=He.current;He.current=null,Z?.to&&_e(Z.to,0),W.stopPropagation()},onPointerCancel:()=>{He.current=null,te(null)},onKeyDown:W=>{let Z=(W.shiftKey?8:2)*d,[be,xe]=W.key==="ArrowLeft"?[-Z,0]:W.key==="ArrowRight"?[Z,0]:W.key==="ArrowUp"?[0,-Z]:W.key==="ArrowDown"?[0,Z]:[0,0];if(!be&&!xe||!ge)return;W.preventDefault();let Oe=ce(ge);_e(J(Oe.px+be,Oe.py+xe),500)}}:{},Ze=W=>{let Z=Ue(W);!we||!Z||b.current?.contains(W.target)||_e(J(Z.px,Z.py),0)},Me=ge?ce(ge):null,Qt=Me?Math.min(v-52+xa,Math.max(-xa,Math.round(Me.px/d-52/2))):I.x,Pn=Me?`${Math.min(ke-oo-ka,Math.max(-ka,Math.round(ke-Me.py/d-ka)))*d}px`:`${ro}%`,_n={"--sl-px":`${d}px`,"--sl-x":Qt,"--sl-move-ms":`${Me?0:I.moveMs}ms`,"--sl-steps":I.steps,bottom:Pn,width:`${52*d}px`,height:`${52*d}px`},Et=Nn(C.mood,L?.action??null,I.face),De=Qr.includes(e.species)&&!e.design&&!k;return f("div",{ref:m,className:"sl-stage","data-paused":a?"true":void 0,onPointerDown:G,onClick:Ze,style:{"--sl-hover":xl,"--sl-px":`${d}px`},children:[i("img",{className:`sl-stage-bg ${P?"":"sl-stage-bg--pixel"}`,src:P?s:n(vt(e)),alt:"",draggable:!1,onLoad:W=>{let{naturalWidth:Z,naturalHeight:be}=W.currentTarget;Z>0&&be>0&&ee({width:Z,height:be})}}),r&&"figure"in r?i("div",{className:"sl-stage-figure","aria-hidden":"true","data-breathes":r.rows===2?"true":void 0,"data-flipped":o?"true":void 0,style:{backgroundImage:`url("${r.figure}")`,backgroundSize:`${r.frames*Fe*d}px ${r.rows*Fe*d}px`,backgroundPositionX:`${-r.frame*Fe*d}px`,width:`${Fe*d}px`,height:`${Fe*d}px`,right:`${-Rl*d}px`,bottom:`calc(${ro}% + ${2*d}px)`},children:r.blink?i("div",{className:"sl-stage-blink",style:{backgroundImage:`url("${r.blink}")`}}):null}):r?i("img",{className:"sl-stage-caretaker","data-flipped":o?"true":void 0,src:r.src,alt:"",draggable:!1}):null,i("div",{ref:b,className:"sl-stage-actor","data-facing":e.flipped===(I.facing==="left")?"right":"left","data-hover":De?"true":void 0,"data-movable":we?"true":void 0,style:_n,...we?{tabIndex:0,role:"img","aria-label":g("saucelings.egg.moveLabel"),title:g("saucelings.egg.moveHint")}:{},...xt,children:h>0?i(Ae,{art:e,species:e.species,stage:C.stage,mood:Et,assetUrl:n,alt:k?g("saucelings.egg.name"):`${e.name} (${Xe(e).name})`,scale:d,still:a,reaction:L,pose:I.pose,cue:I.cue,act:k?null:I.act,facing:I.facing,flipped:e.flipped}):null}),k?null:i("span",{className:"sl-sr-only",children:g("saucelings.stage.tapHint",{name:e.name})})]})}function co(e,t){let n=new Date(t);return e!==n.toISOString().slice(0,10)?null:(n.setUTCHours(24,0,0,0),n.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}))}function uo({characters:e,defaultCaretakerId:t,submitLabel:n,pending:s,readyAt:a,onSubmit:r,onCancel:o}){let{t:l}=X(),[c,u]=F(t),p=e.find(m=>m.id===c),g=ht(c,!!p);return f("div",{className:"sl-egg-form",style:{display:"flex",flexWrap:"wrap",gap:"0.6rem",justifyContent:"center",alignItems:"center",marginTop:"0.5rem"},children:[i(yt,{name:p?.name??l("saucelings.empty.houseCaretaker"),src:g}),i("select",{className:"sl-select",value:c,onChange:m=>u(m.target.value),"aria-label":l("saucelings.empty.pickCaretaker"),children:e.length===0?i("option",{value:"caretaker",children:l("saucelings.empty.houseCaretaker")}):e.map(m=>i("option",{value:m.id,children:m.name},m.id))}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:s||a!==null,onClick:()=>r({characterId:c}),children:s?l("saucelings.empty.bringingEgg"):n}),o?i("button",{type:"button",className:"sl-btn",onClick:o,children:l("saucelings.common.cancel")}):null,a?i("p",{style:{flexBasis:"100%",margin:0,fontSize:"0.8rem",opacity:.7,textAlign:"center"},children:l("saucelings.swap.wait",{time:a})}):null,e.length===0?i("p",{style:{flexBasis:"100%",margin:0,fontSize:"0.8rem",opacity:.7,textAlign:"center"},children:l("saucelings.empty.houseCaretakerNote")}):null]})}function go({unlocks:e}){let{t}=X(),n=["prismite","thundrake","clockrit"],s=n.filter(a=>e[a].done).length+(e.halloween?1:0);return f("details",{className:"sl-unlocks",children:[i("summary",{children:t("saucelings.unlocks.title",{have:s,total:n.length+1})}),f("ul",{children:[n.map(a=>i("li",{children:e[a].done?t("saucelings.unlocks.done",{name:bn[a].name}):t(`saucelings.unlocks.${a}`,{...e[a]})},a)),i("li",{children:e.halloween?t("saucelings.unlocks.halloweenNow"):t("saucelings.unlocks.halloween")})]})]})}function Vt({label:e,help:t,value:n,gapLabel:s,keepGap:a=!1}){return f("div",{className:`sl-meter-box ${s?"sl-meter-box--gap":""}`,title:s??void 0,children:[f("div",{className:"sl-meter-head",children:[i(Ee,{text:t,trigger:e}),f("span",{className:"sl-meter-value",children:[n,"%"]})]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})}),s?i("div",{className:`sl-meter-gap ${a?"sl-meter-gap--keep":""}`,children:s}):null]})}var po=null,Ml=4e3,Il=["hatch","stage-up","evolve-offer","evolve"],Tl=48;function Al({label:e,children:t}){let n=j(null);q(()=>{let a=r=>{n.current&&!n.current.contains(r.target)&&(n.current.open=!1)};return document.addEventListener("pointerdown",a),()=>document.removeEventListener("pointerdown",a)},[]);let s=()=>{n.current&&(n.current.open=!1)};return f("details",{ref:n,className:"sl-menu","data-sl-tour":"menu",onKeyDown:a=>{a.key==="Escape"&&(s(),n.current?.querySelector("summary")?.focus())},onClick:a=>{a.target.closest(".sl-menu-list button")&&s()},children:[i("summary",{className:"sl-btn sl-btn--small","aria-label":e,title:e,children:"\u22EF"}),i("div",{className:"sl-menu-list",children:t})]})}function Ea({title:e,closeLabel:t,onClose:n,children:s}){let a=j(null);return q(()=>{a.current?.focus()},[]),f("section",{ref:a,className:"sl-card sl-panel",tabIndex:-1,"aria-label":e,onKeyDown:r=>{r.key==="Escape"&&n()},children:[f("div",{className:"sl-panel-head",children:[i("h3",{children:e}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":t,title:t,onClick:n,children:"\u2715"})]}),s]})}function mo({state:e,packageId:t,packageVersion:n,askVoice:s}){let{t:a}=X(),r=pe(),o=e.world.activePet,l=e.characters,[c,u]=F(!1),[p,g]=F(null),[m,h]=F(!1),[y,b]=F(""),[d,v]=F(null),[C,k]=F("feedReliability"),[P,U]=F(null),[H,E]=Cn(),x=j(null),[R,O]=dn(15e3),L=_=>Qe(t,_,n),S=o?.backgroundId??null,I=ue({queryKey:["saucelings","background",S],queryFn:()=>V(`/background/${encodeURIComponent(S??"")}`),enabled:S!==null,staleTime:1/0}),M=S?I.data?.image??null:null,[A,N]=F(null),z=_=>N(le=>le===_?null:_),w=()=>{N(null),document.querySelector(".sl-nook .sl-menu > summary")?.focus()},T=o?.journal.find(_=>_.kind==="user-care"||_.kind==="nudge")??null,B=T?.id,D=T?.text,G=j(B),[Q,ee]=F({text:"",shown:!1}),re=j(0),te=_=>{ee({text:_,shown:!0}),window.clearTimeout(re.current),re.current=window.setTimeout(()=>ee(le=>({...le,shown:!1})),6e3)};q(()=>()=>window.clearTimeout(re.current),[]),q(()=>{!B||B===G.current||(G.current=B,te(D??""))},[B,D]);let[fe,ge]=Ps(Tl),he=hn(o?.caretakerId??"",l.some(_=>_.id===o?.caretakerId)),ke=o?e.world.caretakerFigures[o.caretakerId]:void 0,we=bt(ke),J=fn(ke,we),ce=o?.journal.find(_=>Xn.includes(_.kind))??null,ae=ce&&!e.writing.includes(ce.id)?ce:null,ve=ae?.kind==="caretaker-care"?Us(ae.outcome):null,_e=ve?ae?.id??null:null,[He,Ue]=at(pn);q(()=>{!ve||!_e||_e===po||(po=_e,(x.current?.comeOver()??Promise.resolve()).then(()=>{E(ve),Ue(ve)}))},[ve,_e,E,Ue]);let[xt,Ze]=at(Ml),Me=ae&&Il.includes(ae.kind)?ae.id:null,Qt=j(Me);q(()=>{!Me||Me===Qt.current||(Qt.current=Me,Ze(!0))},[Me,Ze]);let[Pn,_n]=F(!1),Et=As(o);q(()=>{if(Et===null)return;let _=window.setTimeout(()=>{r.invalidateQueries({queryKey:["saucelings","state"]})},Math.max(0,Et-Date.now())+1e3);return()=>window.clearTimeout(_)},[Et,r]);let De=_=>{v(null),r.setQueryData(["saucelings","state"],_)},W=_=>v(_??new Error(a("saucelings.error.request"))),Z=ne({mutationFn:_=>V("/adopt","POST",_),onSuccess:_=>{N(null),De(_)},onError:W}),be=ne({mutationFn:_=>V("/action","POST",{action:_}),onMutate:()=>({arrived:x.current?.comeOver()??Promise.resolve()}),onSuccess:(_,le,ct)=>{De(_),O(),ct.arrived.then(()=>{E(le),le!=="talk"&&Ue(le)})},onError:W}),xe=ne({mutationFn:()=>V("/check-in","POST",{}),onSuccess:De,onError:W}),Oe=ne({mutationFn:_=>V("/nudge","POST",{tendency:_}),onSuccess:_=>{De(_),O()},onError:W}),Ve=ne({mutationFn:_=>V("/pet","PATCH",_),onSuccess:(_,le)=>{le.name!==void 0&&h(!1),le.caretakerId!==void 0&&g(null),De(_),le.caretakerId&&s(le.caretakerId)},onError:W}),On=ne({mutationFn:({characterId:_,name:le})=>V("/voice","POST",{characterId:_}).catch(()=>{throw new Error(a("saucelings.voice.failed",{name:le}))}),onSuccess:De,onError:W}),Ra=_=>Z.mutate(_,{onSuccess:()=>{let le=()=>s(_.characterId);_.swap||wa()?le():U({then:le})}}),Na=ne({mutationFn:()=>V("/retire","POST",{}),onSuccess:_=>{u(!1),De(_)},onError:W});if(!o)return f("div",{className:"sl-card",style:{display:"grid",gap:"1rem",textAlign:"center",padding:"2rem"},children:[i("div",{style:{display:"flex",justifyContent:"center"},children:i(kt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:L,alt:a("saucelings.empty.eggAlt"),scale:2})}),i("h2",{style:{fontSize:"1.125rem",fontWeight:600,margin:0},children:a("saucelings.empty.title")}),i("p",{style:{fontSize:"0.85rem",opacity:.8,maxWidth:"32rem",margin:"0 auto"},children:a("saucelings.empty.body")}),wa()?null:f("div",{className:"sl-mari-line",children:[i("img",{src:Sa("wave"),alt:"",onError:_=>_.currentTarget.hidden=!0}),i("p",{children:a("saucelings.empty.mari")})]}),i(uo,{characters:l,defaultCaretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.empty.bringEgg"),pending:Z.isPending,readyAt:co(e.world.lastNewEggDay,R),onSubmit:Ra}),i(go,{unlocks:e.unlocks}),d?i("p",{role:"alert",className:"sl-error",style:{margin:0},children:i(de,{error:d})}):null]});let Se=o.stage==="egg",Fn=Xe(o),et=ze(o),Ie=et?.sauce??null,Ln=o.name===Fn.name,Ce=o.careProfile.characterName,lt=l.some(_=>_.id===o.caretakerId),Ma=l.length>1||lt,Ia=Lt(o,R),Ta=!o.lockedStage&&o.stage!=="elder"&&o.meters.hunger<Ya,ko=Ie?{"--sl-sauce-accent":Ie.accentColor,"--sl-sauce-bg":Ie.badgeBg}:{},Wt=Se?[{tendency:"feedReliability",label:a("saucelings.nudge.warm")},{tendency:"affection",label:a("saucelings.nudge.talk")}]:[{tendency:"feedReliability",label:a("saucelings.nudge.meals")},{tendency:"overfeeding",label:a("saucelings.nudge.portions")},{tendency:"playfulness",label:a("saucelings.nudge.play")},{tendency:"affection",label:a("saucelings.nudge.cuddles")}],Aa=Wt.some(_=>_.tendency===C)?C:Wt[0].tendency,Pa=Wt.flatMap(_=>{let le=o.nudges.find(La=>La.tendency===_.tendency&&Date.parse(La.expiresAt)>R);if(!le)return[];let ct=Math.ceil((Date.parse(le.expiresAt)-R)/36e5);return[a("saucelings.nudge.left",{ask:_.label,hours:ct})]}),xo=o.journal.filter(_=>Xn.includes(_.kind)),Eo=yn({gaps:e.gaps,line:ce,speaking:Pn||ce!==null&&e.writing.includes(ce.id),cheering:xt!==null,caring:He}),_a=vn(we,he,Eo,J),Oa=()=>{b(Ln?"":o.name),h(!0)},Fa=f(ie,{children:[i("div",{className:"sl-care-row","data-sl-tour":"caretaker",children:i("button",{type:"button",className:"sl-btn",disabled:xe.isPending,onClick:()=>xe.mutate(),children:xe.isPending?a("saucelings.checkIn.pending",{name:Ce}):`\u{1F4AC} ${a("saucelings.checkIn.button",{name:Ce})}`})}),f("details",{className:"sl-ask","data-sl-tour":"caretaker",children:[f("summary",{children:[a("saucelings.nudge.heading",{name:Ce}),"\u2026",Pa.length>0?f("span",{className:"sl-care-note",children:[" ",a("saucelings.nudge.active",{asks:Pa.join(", ")})]}):null]}),f("div",{className:"sl-care-row sl-ask-row",children:[i("select",{id:"sl-nudge-pick",className:"sl-select sl-select--small","aria-label":a("saucelings.nudge.heading",{name:Ce}),value:Aa,onChange:_=>k(_.target.value),children:Wt.map(_=>i("option",{value:_.tendency,children:_.label},_.tendency))}),i("button",{type:"button",className:"sl-btn sl-btn--small",disabled:Oe.isPending,onClick:()=>Oe.mutate(Aa),children:a("saucelings.nudge.ask")}),i("span",{className:"sl-care-note",children:a("saucelings.nudge.note")})]})]})]});return f("div",{ref:fe,className:"sl-nook",style:ko,children:[d?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(de,{error:d})}):null,o.retireReady?i("div",{className:"sl-card sl-retire",children:c?f(ie,{children:[i("span",{children:a("saucelings.retire.confirmNote",{name:o.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:Na.isPending,onClick:()=>Na.mutate(),children:a("saucelings.retire.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>u(!1),children:a("saucelings.common.cancel")})]}):f(ie,{children:[i("span",{children:a("saucelings.retire.ready",{name:o.name})}),f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>u(!0),children:["\u{1F4D6} ",a("saucelings.retire.button")]})]})}):null,f("div",{className:"sl-nook-main",children:[f("div",{className:"sl-card sl-stage-card",children:[f("div",{className:"sl-stage-bar",children:[m?f("div",{className:"sl-rename",children:[i("input",{className:"sl-input",style:{flex:"1 1 8rem",width:"100%"},value:y,maxLength:40,placeholder:a("saucelings.pet.namePlaceholder"),"aria-label":a("saucelings.pet.namePlaceholder"),onChange:_=>b(_.target.value)}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:!y.trim()||Ve.isPending,onClick:()=>Ve.mutate({name:y}),children:a("saucelings.common.save")}),i("button",{type:"button",className:"sl-btn",onClick:()=>h(!1),children:a("saucelings.common.cancel")})]}):f("div",{className:"sl-stage-title",children:[f("div",{className:"sl-stage-name",children:[i("h2",{style:{fontSize:"1.35rem",fontWeight:700,margin:0,overflowWrap:"anywhere"},children:Se?a("saucelings.egg.name"):o.name}),Se?null:i(Kt,{pet:o}),Se||!Ln?null:i("button",{type:"button",className:"sl-btn sl-btn--small sl-btn--primary",onClick:Oa,children:a("saucelings.pet.nameIt")})]}),Se?null:f("div",{className:"sl-stage-sub",title:Ie?`${Ie.origin} \u2014 ${Ie.readsAs}`:et?.readsAs,children:[et?`${Ie?a("saucelings.pet.sauce",{sauce:Ie.name}):a("saucelings.pet.temperament",{temperament:et.name})} \xB7 `:null,Fn.name," \xB7"," ",o.lockedStage?a("saucelings.pet.locked",{stage:a(`saucelings.stage.${o.lockedStage}`)}):a(`saucelings.stage.${o.stage}`)]})]}),m?null:f(Al,{label:a("saucelings.nook.menu"),children:[Se||Ln?null:f("button",{type:"button",className:"sl-btn sl-btn--small",onClick:Oa,children:["\u270F\uFE0F ",a("saucelings.pet.rename")]}),f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":A==="background",onClick:()=>z("background"),children:["\u{1F5BC} ",a("saucelings.nook.background")]}),Ma?f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":A==="caretaker",onClick:()=>z("caretaker"),children:["\u{1F464} ",a("saucelings.about.caretakerGroup")]}):null,f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":A==="looks",onClick:()=>z("looks"),children:["\u{1F3A8} ",a("saucelings.about.looksGroup")]}),f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":A==="egg",onClick:()=>z("egg"),children:["\u{1F95A} ",a("saucelings.about.newEggGroup")]}),i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>U({}),children:a("saucelings.tour.link")})]})]}),f("div",{className:"sl-scene",children:[i(Tn,{pet:o,reaction:H,assetUrl:L,backgroundSrc:M,caretaker:_a,caretakerFlipped:e.world.flippedCaretakers.includes(o.caretakerId),listenKey:ae?.id??null,handle:x,onMoveEgg:_=>Ve.mutateAsync({eggSpot:_})}),i(eo,{lines:xo,fallbackLine:Se?a("saucelings.caretaker.idleEgg"):a("saucelings.caretaker.idle",{name:o.name}),caretakerId:o.caretakerId,caretakerName:Ce,isCharacter:lt,meals:e.gaps.meals,isEgg:Se,writing:e.writing,standing:_a!==null||we===void 0,onTyping:_n,children:ge?Fa:null})]})]}),f("div",{className:"sl-nook-side",children:[f("div",{className:"sl-card sl-care-card",children:[f("div",{className:"sl-meters sl-meters--strip","data-sl-tour":"meters",children:[Se?f(ie,{children:[i(Vt,{label:a("saucelings.meter.warmth"),help:a("saucelings.meter.warmthHelp"),value:Ft(o),gapLabel:e.gaps.warmth?a("saucelings.meter.warmthGap"):null}),i(Vt,{label:a("saucelings.meter.hatching"),help:a("saucelings.meter.hatchingHelp"),value:Ia,gapLabel:Ia>=100&&o.careActionCount<1?a("saucelings.meter.hatchingGap"):null})]}):f(ie,{children:[i(Vt,{label:a("saucelings.meter.hunger"),help:a("saucelings.meter.hungerHelp"),value:o.meters.hunger,gapLabel:Ta?a("saucelings.pet.growthPaused"):e.gaps.hunger?a("saucelings.meter.hungerGap"):null,keepGap:Ta}),i(Vt,{label:a("saucelings.meter.mood"),help:a("saucelings.meter.moodHelp"),value:o.meters.mood,gapLabel:e.gaps.mood?a("saucelings.meter.moodGap"):null})]}),i(Vt,{label:a("saucelings.meter.bond"),help:a("saucelings.meter.bondHelp"),value:o.meters.bond})]}),i("div",{className:"sl-actions","data-sl-tour":"care",children:_t(o).map(_=>{let le=mn(o,_,R),ct=Ot(_,e.gaps);return f("button",{type:"button",className:`sl-btn ${ct?"sl-btn--gap":""}`,disabled:be.isPending,"aria-disabled":le>0||void 0,onClick:()=>le>0?te(a("saucelings.action.resting",{action:a(Pt[_]),minutes:le})):be.mutate(_,{onSuccess:()=>{ct&&Ze(!0)}}),children:[gn[_]," ",a(Pt[_]),le>0?` \xB7 ${a("saucelings.action.wait",{minutes:le})}`:""]},_)})}),i("p",{className:`sl-action-note ${Q.shown?"sl-action-note--shown":""}`,"aria-live":"polite",children:Q.text}),i(Rn,{state:e,assetUrl:L}),i(to,{state:e,assetUrl:L}),ge?null:Fa]}),A==="background"?i(jr,{pet:o,settings:e.world.settings,assetUrl:L,onClose:w}):null,A==="caretaker"&&Ma?f(Ea,{title:a("saucelings.about.caretakerGroup"),closeLabel:a("saucelings.album.close"),onClose:w,children:[l.length>1?f("label",{className:"sl-about-row",children:[i("span",{children:a(Se?"saucelings.pet.eggCaretaker":"saucelings.pet.caretaker")}),i("select",{className:"sl-select sl-select--small","aria-label":a("saucelings.empty.pickCaretaker"),value:p?.id??o.caretakerId,onChange:_=>g(l.find(le=>le.id===_.target.value)??null),children:l.map(_=>i("option",{value:_.id,children:_.name},_.id))})]}):null,p&&p.id!==o.caretakerId?f("div",{className:"sl-about-row",role:"group",children:[i("span",{children:Se?a("saucelings.about.handOverEggNote",{caretaker:p.name}):a("saucelings.about.handOverNote",{name:o.name,caretaker:p.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:Ve.isPending,onClick:()=>Ve.mutate({caretakerId:p.id}),children:a("saucelings.about.handOver")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:a("saucelings.common.cancel")})]}):null,lt?i("div",{className:"sl-about-row",children:i(Ee,{text:a("saucelings.about.refreshVoiceNote"),label:a("saucelings.help.label",{action:a("saucelings.about.refreshVoice",{name:Ce})}),children:i("button",{type:"button",className:"sl-btn",disabled:On.isPending,onClick:()=>On.mutate({characterId:o.caretakerId,name:Ce}),children:On.isPending?a("saucelings.about.refreshingVoice",{name:Ce}):`\u{1F504} ${a("saucelings.about.refreshVoice",{name:Ce})}`})})}):null,lt?i(Lr,{state:e,characterId:o.caretakerId,name:Ce,sprites:he}):null,lt?i(Fr,{state:e,characterId:o.caretakerId,name:Ce}):null]}):null,A==="looks"?f(Ea,{title:a("saucelings.about.looksGroup"),closeLabel:a("saucelings.album.close"),onClose:w,children:[i(Pr,{state:e,assetUrl:L}),i(Or,{state:e}),i(no,{state:e})]}):null,A==="egg"?f(Ea,{title:a("saucelings.about.newEggGroup"),closeLabel:a("saucelings.album.close"),onClose:w,children:[i("p",{children:Se?a("saucelings.swap.noteEgg"):a("saucelings.swap.note",{name:o.name})}),i(uo,{characters:l,defaultCaretakerId:lt?o.caretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.swap.confirm"),pending:Z.isPending,readyAt:co(e.world.lastNewEggDay,R),onSubmit:_=>Ra({..._,swap:!0}),onCancel:w}),i(go,{unlocks:e.unlocks})]}):null]})]}),f("details",{className:"sl-card sl-about",children:[i("summary",{children:Se?a("saucelings.about.egg"):a("saucelings.about.summary",{name:o.name})}),f("div",{className:"sl-about-body",children:[Se?i("p",{children:a("saucelings.egg.about")}):f(ie,{children:[f("p",{children:[Fn.look," \u2014 ",i("em",{children:o.quirk})]}),i("p",{children:Ie?a("saucelings.pet.sauceAbout",{sauce:Ie.name,readsAs:Ie.readsAs}):et&&o.ownTemperament?a("saucelings.pet.temperamentAbout",{temperament:et.name,readsAs:et.readsAs,after:o.ownTemperament.takesAfter.name}):a("saucelings.pet.temperamentForming")}),o.evolution.look?i("p",{title:o.evolution.look.description,children:a("saucelings.evolve.into",{form:o.evolution.look.form})}):null,o.evolution.look?i("p",{children:a("saucelings.evolve.move",{move:a(`saucelings.evolve.moves.${o.evolution.look.move}`)})}):null,i("div",{className:"sl-traits",children:o.traits.map(_=>f("span",{className:"sl-trait",children:["#",_]},_))})]}),i("p",{children:a("saucelings.menagerie.foundBy",{name:o.finder.name})})]})]}),P?i(so,{caretaker:Ce,hatched:o.stage!=="egg",onClose:()=>{U(null),P.then?.()}}):null]})}var Pl=new Set(["image_generation","video_generation","audio","decision"]);function fo({value:e,min:t,max:n,onSave:s}){let[a,r]=F(String(e));return q(()=>r(String(e)),[e]),i("input",{type:"number",className:"sl-input",min:t,max:n,style:{width:"5rem",flexShrink:0},value:a,onChange:l=>r(l.target.value),onBlur:()=>{let l=a.trim()===""?Number.NaN:Number(a);if(!Number.isFinite(l))return r(String(e));let c=Math.min(n,Math.max(t,Math.round(l)));r(String(c)),c!==e&&s(c,()=>r(String(e)))},onKeyDown:l=>{l.key==="Enter"&&l.currentTarget.blur()}})}function Je({title:e,note:t,tick:n,stack:s,children:a}){return f("label",{className:`sl-setting ${s?"sl-setting--stack":""}`,children:[f("span",{className:"sl-setting-text",children:[f("span",{className:"sl-setting-title",children:[e," ",n]}),t?i("span",{className:"sl-setting-note",children:t}):null]}),a]})}function ho({state:e}){let{t}=X(),n=pe(),s=e.world.settings,a=e.world.budget,[r,o]=F(!1),l=ue({queryKey:["saucelings","connections"],queryFn:()=>Re("/api/connections")}),c=(l.data??[]).filter(v=>!Pl.has(v.provider)),u=l.data?.filter(v=>v.provider==="image_generation"),p=ne({mutationFn:v=>V("/settings","PATCH",v),onSuccess:v=>n.setQueryData(["saucelings","state"],v)}),[g,m]=at(2e3),h=(v,C)=>{b.isError&&b.reset(),p.mutate(v,{onSuccess:()=>m(Object.keys(v)[0]),onError:C})},y=v=>g===v?i("span",{className:"sl-saved",role:"status",children:t("saucelings.settings.saved")}):null,b=ne({mutationFn:()=>V("/reset","POST",{}),onSuccess:v=>{o(!1),n.setQueryData(["saucelings","state"],v)}}),d=v=>i("input",{type:"checkbox",checked:s[v],onChange:C=>h({[v]:C.target.checked})});return f("div",{className:"sl-card sl-settings",children:[f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.visitsGroup")}),i(Je,{title:t("saucelings.settings.careWindow"),note:t("saucelings.settings.careWindowNote"),tick:y("careWindowHours"),children:i(fo,{value:s.careWindowHours,min:1,max:24,onSave:(v,C)=>h({careWindowHours:v},C)})}),i(Je,{title:t("saucelings.settings.eggHunting"),note:t("saucelings.settings.eggHuntingNote"),tick:y("eggHunting"),children:d("eggHunting")})]}),f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.writingGroup")}),i(Je,{stack:!0,title:t("saucelings.settings.connection"),note:t("saucelings.settings.connectionNote"),tick:y("connectionId"),children:f("select",{className:"sl-input",value:s.connectionId??"",onChange:v=>h({connectionId:v.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.connectionDefault")}),c.map(v=>i("option",{value:v.id,children:v.name},v.id)),s.connectionId&&l.data&&!c.some(v=>v.id===s.connectionId)?i("option",{value:s.connectionId,children:t("saucelings.settings.connectionMissing")}):null]})}),i(Je,{title:t("saucelings.settings.dailyBudget"),note:`${t("saucelings.settings.budgetUsed",{used:a.used,limit:s.dailyGenerationBudget})} \u2014 ${t("saucelings.settings.budgetNote")}`,tick:y("dailyGenerationBudget"),children:i(fo,{value:s.dailyGenerationBudget,min:0,max:30,onSave:(v,C)=>h({dailyGenerationBudget:v},C)})}),i(Je,{title:t("saucelings.settings.writeEveryLine"),note:t("saucelings.settings.writeEveryLineNote"),tick:y("writeEveryLine"),children:d("writeEveryLine")})]}),f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.picturesGroup")}),i(Je,{title:t("saucelings.settings.images"),note:t("saucelings.settings.imagesNote"),tick:y("portraitEnabled"),children:d("portraitEnabled")}),s.portraitEnabled?i(Je,{stack:!u||u.length>0,title:t("saucelings.settings.imageConnection"),note:u&&u.length===0?t("saucelings.settings.imageConnectionEmpty"):null,tick:y("portraitConnectionId"),children:u&&u.length===0?null:f("select",{className:"sl-input",value:s.portraitConnectionId??"",onChange:v=>h({portraitConnectionId:v.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.imageConnectionPick")}),(u??[]).map(v=>i("option",{value:v.id,children:v.name},v.id)),s.portraitConnectionId&&l.data&&!u?.some(v=>v.id===s.portraitConnectionId)?i("option",{value:s.portraitConnectionId,children:t("saucelings.settings.connectionMissing")}):null]})}):null,s.portraitEnabled?i(Je,{title:t("saucelings.settings.threeDrawingFallback"),note:t("saucelings.settings.threeDrawingFallbackNote"),tick:y("threeDrawingFallback"),children:d("threeDrawingFallback")}):null]}),p.error??b.error?i("span",{role:"alert",className:"sl-error",children:i(de,{error:p.error??b.error})}):null,f("div",{style:{borderTop:"1px solid var(--border, rgba(255,255,255,0.1))",paddingTop:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"},children:[i("span",{style:{fontSize:"0.8rem",opacity:.75},children:t("saucelings.settings.resetNote")}),r?f("div",{style:{display:"flex",gap:"0.5rem"},children:[i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:b.isPending,onClick:()=>{p.isError&&p.reset(),b.mutate()},children:t("saucelings.settings.resetConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>o(!1),children:t("saucelings.common.cancel")})]}):i("button",{type:"button",className:"sl-btn",onClick:()=>o(!0),children:t("saucelings.settings.reset")})]})]})}function jt({label:e,value:t,gap:n}){return f("div",{children:[f("span",{children:[e," ",t,"%"]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})})]})}var _l={warmth:"\u{1F525}",hatching:"\u{1F95A}",hunger:"\u{1F35D}",mood:"\u{1F60A}",bond:"\u{1F49B}"};function Ol({icon:e,label:t,value:n,gap:s}){return f("div",{className:"sl-widget-bar-row",role:"meter","aria-label":t,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":n,title:`${t} ${n}%`,children:[i("span",{className:"sl-widget-bar-icon","aria-hidden":"true",children:e}),i("span",{className:"sl-widget-bar-name","aria-hidden":"true",children:t}),i("div",{className:"sl-widget-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})})]})}function bo({active:e,compact:t,packageId:n,packageVersion:s,onOpenNoodle:a}){let{t:r}=X(),o=pe(),[l,c]=Cn(),u=j(null),[p,g]=at(pn),[m,h]=dn(3e4),y=J=>Qe(n,J,s),[b,d]=F(null),v=j(0),[C,k]=F(!1),P=j(null),U=J=>{d(J),window.clearTimeout(v.current),v.current=window.setTimeout(()=>d(null),6e3)};q(()=>()=>window.clearTimeout(v.current),[]);let H=ue({queryKey:["saucelings","state"],queryFn:()=>V("/state"),enabled:e,staleTime:1e4,refetchOnMount:"always",refetchInterval:J=>e?J.state.data?.writing.length?2e3:3e4:!1,refetchIntervalInBackground:!1}),E=ne({mutationFn:J=>V("/action","POST",{action:J}),onMutate:()=>({arrived:u.current?.comeOver()??Promise.resolve()}),onSuccess:(J,ce,ae)=>{o.setQueryData(["saucelings","state"],J),h(),ae.arrived.then(()=>{c(ce),ce!=="talk"&&g(ce)})}}),x=H.data,R=x?.world.activePet,O=!!(R&&x?.characters.some(J=>J.id===R.caretakerId)),L=ht(R?.caretakerId??"",O),S=hn(R?.caretakerId??"",O&&!t),I=R&&!t?x?.world.caretakerFigures[R.caretakerId]:void 0,M=bt(I),A=fn(I,M),N=R?.backgroundId??null,z=ue({queryKey:["saucelings","background",N],queryFn:()=>V(`/background/${encodeURIComponent(N??"")}`),enabled:e&&!t&&N!==null,staleTime:1/0}),w=N?z.data?.image??null:null;if(!x)return f("div",{className:"sl-widget",style:{display:"grid",gap:"0.5rem",fontSize:"0.8rem"},children:[i("span",{style:{opacity:.75},children:H.isError?r("saucelings.error.load"):r("saucelings.loading")}),H.isError?i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{H.refetch()},children:r("saucelings.error.retry")})}):null]});if(!R)return i("section",{className:"sl-widget","aria-label":r("saucelings.title"),children:f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(kt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:y,alt:r("saucelings.empty.eggAlt"),scale:1,still:!e}),f("div",{children:[i("button",{type:"button",className:"sl-widget-open",style:{fontWeight:600,fontSize:"0.85rem"},onClick:()=>a?.(),children:r("saucelings.empty.title")}),i("div",{style:{fontSize:"0.72rem",opacity:.75},children:r("saucelings.widget.emptyHint")})]})]})});let T=R.stage==="egg",B=Xe(R),D=ze(R),G=D?.sauce??null,Q=rt(R),ee=G?{"--sl-sauce-accent":G.accentColor,"--sl-sauce-bg":G.badgeBg}:{},re=R.journal[0],te=T?r("saucelings.egg.name"):R.name,fe=f("div",{style:{minWidth:0,flex:1},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"0.875rem"},children:t?i("button",{type:"button",className:"sl-widget-open","aria-label":r("saucelings.widget.open",{name:te}),onClick:()=>a?.(),children:te}):te}),T||!D?null:i("span",{className:"sl-badge",style:{fontSize:"0.65rem",padding:"0.1rem 0.45rem"},title:D.readsAs,children:G?r("saucelings.pet.sauce",{sauce:G.name}):r("saucelings.pet.temperament",{temperament:D.name})})]}),f("div",{style:{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",marginTop:"0.15rem"},children:[i(yt,{name:R.careProfile.characterName,src:L,small:!0}),i("span",{style:{opacity:.75,minWidth:0},children:T?`${r("saucelings.pet.eggCaretaker")} ${R.careProfile.characterName}`:`${B.name} \xB7 ${r("saucelings.pet.caretaker")} ${R.careProfile.characterName}`})]})]}),ge=f("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"0.4rem",fontSize:"0.68rem"},children:[T?f(ie,{children:[i(jt,{label:r("saucelings.meter.warmth"),value:Ft(R),gap:x?.gaps.warmth}),i(jt,{label:r("saucelings.meter.hatching"),value:Lt(R,m)})]}):f(ie,{children:[i(jt,{label:r("saucelings.meter.hunger"),value:R.meters.hunger,gap:x?.gaps.hunger}),i(jt,{label:r("saucelings.meter.mood"),value:R.meters.mood,gap:x?.gaps.mood})]}),i(jt,{label:r("saucelings.meter.bond"),value:R.meters.bond})]}),he=f("p",{style:{margin:0,fontSize:"0.75rem",opacity:.85,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:t?1:2,WebkitBoxOrient:"vertical"},children:[re?.generated?i("span",{className:"sl-pill sl-pill--ai",style:{marginRight:"0.35rem"},children:r("saucelings.journal.generated")}):null,x?.latestRemark]});if(t)return f("section",{className:"sl-widget",style:ee,"aria-label":te,children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(Ae,{art:R,species:R.species,stage:Q.stage,mood:Nn(Q.mood,l?.action??null,null),assetUrl:y,alt:T?r("saucelings.egg.name"):R.name,scale:1,still:!e,reaction:l}),fe]}),ge,he]});let ke=x?vn(M,S,yn({gaps:x.gaps,line:null,speaking:!1,cheering:!1,caring:p}),A):null,we=T?[{key:"warmth",label:r("saucelings.meter.warmth"),value:Ft(R),gap:x?.gaps.warmth},{key:"hatching",label:r("saucelings.meter.hatching"),value:Lt(R,m),gap:!1}]:[{key:"hunger",label:r("saucelings.meter.hunger"),value:R.meters.hunger,gap:x?.gaps.hunger},{key:"mood",label:r("saucelings.meter.mood"),value:R.meters.mood,gap:x?.gaps.mood}];return we.push({key:"bond",label:r("saucelings.meter.bond"),value:R.meters.bond,gap:!1}),i("section",{className:"sl-widget sl-widget--stage",style:ee,"aria-label":te,onClick:()=>a?.(),children:f("div",{className:"sl-widget-body",children:[i("div",{className:"sl-widget-stage",onClick:J=>{T||J.stopPropagation()},children:i(Tn,{pet:R,reaction:l,assetUrl:y,backgroundSrc:w,paused:!e,caretaker:ke,caretakerFlipped:x?.world.flippedCaretakers.includes(R.caretakerId),handle:u,scaleByWidth:!0})}),f("div",{className:"sl-widget-remark","aria-live":"polite",children:[b===null&&re?.generated?i("span",{className:"sl-pill sl-pill--ai",children:r("saucelings.journal.generated")}):null,i("p",{children:b??x.latestRemark})]}),f("div",{className:"sl-widget-hud",children:[i("div",{className:"sl-widget-bars",children:we.map(J=>i(Ol,{icon:_l[J.key],label:J.label,value:J.value,gap:J.gap},J.key))}),i("div",{className:"sl-widget-acts",children:i("button",{type:"button",className:"sl-btn sl-widget-act","aria-label":r("saucelings.widget.open",{name:te}),title:r("saucelings.widget.open",{name:te}),onClick:()=>a?.(),children:i("span",{"aria-hidden":"true",children:"\u2197"})})})]}),f("div",{className:"sl-widget-care",onClick:J=>J.stopPropagation(),onKeyDown:J=>{J.key==="Escape"&&C&&(J.stopPropagation(),k(!1),P.current?.focus())},children:[E.error?i("span",{role:"alert",className:"sl-error sl-widget-care-error",children:i(de,{error:E.error})}):null,f("div",{className:"sl-widget-care-row",children:[C?_t(R).map(J=>{let ce=mn(R,J,m),ae=r(Pt[J]),ve=ce>0?`${ae} \xB7 ${r("saucelings.action.wait",{minutes:ce})}`:ae;return f("button",{type:"button",className:`sl-btn sl-widget-act ${x&&Ot(J,x.gaps)?"sl-btn--gap":""}`,"aria-label":ve,title:ve,disabled:E.isPending,"aria-disabled":ce>0||void 0,onClick:()=>ce>0?U(r("saucelings.action.resting",{action:ae,minutes:ce})):E.mutate(J),children:[i("span",{"aria-hidden":"true",children:gn[J]}),ce>0?i("span",{className:"sl-widget-act-wait","aria-hidden":"true",children:ce}):null]},J)}):null,i("button",{ref:P,type:"button",className:`sl-btn sl-widget-act ${!C&&x&&_t(R).some(J=>Ot(J,x.gaps))?"sl-btn--gap":""}`,"aria-expanded":C,"aria-label":r("saucelings.widget.care"),title:r("saucelings.widget.care"),onClick:()=>k(J=>!J),children:i("span",{"aria-hidden":"true",children:C?"\u2715":"\u{1F932}"})})]})]})]})})}var yo=`
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
/* A found egg is waiting in the Menagerie. */
.sl-tab-dot {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  margin-left: 0.3rem;
  border-radius: 999px;
  background: var(--primary, #e05246);
  vertical-align: 0.1em;
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

/* A meter jumps to its new level instead of sliding when reduced effects or reduced motion is on. */
html[data-marinara-reduced-effects="true"] .sl-meter-fill { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .sl-meter-fill { transition: none; }
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
.sl-nook-side { grid-area: care; display: grid; gap: 1rem; align-content: start; min-width: 0; }
.sl-care-card { display: grid; gap: 0.75rem; }
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
/* A settings row's "Saved", for a moment after it changes. */
.sl-saved { margin-left: 0.35rem; font-size: 0.72rem; font-weight: 500; color: var(--sl-green); }
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
.sl-box-line, .sl-box-nav, .sl-box > .sl-care-row, .sl-box > .sl-ask { grid-column: 1 / -1; }
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
/* Settings: three groups of rows, name and note on the left and the control on the right. */
.sl-settings { display: grid; gap: 1.15rem; max-width: 40rem; margin: 0 auto; }
.sl-settings-group { display: grid; gap: 0.85rem; }
.sl-settings-group + .sl-settings-group { padding-top: 0.85rem; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); }
.sl-settings-group > h3 { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.7; }
.sl-setting { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.sl-setting-text { display: grid; gap: 0.1rem; min-width: 0; }
.sl-setting-title { font-weight: 600; font-size: 0.875rem; }
.sl-setting-note { font-size: 0.75rem; opacity: 0.7; }
.sl-setting > select { flex: 0 1 14rem; min-width: 0; }
/* Ask is one line until it is opened. */
.sl-ask { padding-top: 0.5rem; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); }
.sl-ask > summary { cursor: pointer; font-size: 0.8rem; }
.sl-ask > .sl-care-row { border-top: 0; padding-top: 0.45rem; }
/* Rename, Background, Caretaker, Looks, New egg and Tour in one menu under the stage bar's "\u22EF". */
.sl-menu { position: relative; flex-shrink: 0; }
.sl-menu > summary { list-style: none; cursor: pointer; }
.sl-menu > summary::-webkit-details-marker { display: none; }
.sl-menu-list {
  position: absolute;
  z-index: 5;
  top: calc(100% + 0.25rem);
  right: 0;
  display: grid;
  gap: 0.25rem;
  min-width: 9rem;
  padding: 0.35rem;
  border: 1px solid var(--border, rgba(255,255,255,0.15));
  border-radius: 0.6rem;
  background: var(--popover, var(--card, #1c1c22));
  box-shadow: 0 6px 20px rgba(0,0,0,0.35);
}
.sl-menu-list > .sl-btn { justify-content: flex-start; }
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
.sl-pill--ai { background: var(--accent, rgba(169,120,232,0.2)); border-color: transparent; color: var(--accent-foreground, #d8b4fe); }
/* Failures and the sure-you-want-to button take the theme's own danger colour. */
.sl-error { color: var(--destructive, #f87171); font-size: 0.8rem; }
.sl-btn.sl-btn--danger { background: var(--destructive, #dc2626); border-color: var(--destructive, #dc2626); color: var(--destructive-foreground, #fff); }

/* About the sauceling: closed until asked for. */
.sl-about > summary { cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.sl-about-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem; margin-top: 0.75rem; font-size: 0.8125rem; }
.sl-about-body p { margin: 0; opacity: 0.85; }
.sl-about-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.sl-about-row .sl-select { min-width: 0; max-width: 100%; }
/* A caretaker's name has no break points to wrap on, so the words in these rows may break anywhere. */
.sl-about-row, .sl-about-row > label { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
/* Caretaker, Looks and New egg: a panel the "\u22EF" menu opens under the nook. */
.sl-panel { display: grid; gap: 0.6rem; font-size: 0.8125rem; }
.sl-panel:focus,
.sl-picker:focus { outline: none; }
.sl-panel > p { margin: 0; opacity: 0.85; }
.sl-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.sl-panel-head > h3 { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.7; }
.sl-unlocks { margin: 0 auto; max-width: 32rem; font-size: 0.8rem; text-align: left; }
.sl-unlocks > summary { cursor: pointer; font-weight: 600; opacity: 0.85; }
.sl-unlocks ul { display: grid; gap: 0.15rem; margin: 0.35rem 0 0; padding-left: 1.1rem; opacity: 0.85; }
/* A hint behind a "?", as in the Engine: muted until it is pointed at, and a 24px target for a finger. It stays
   beside the button it explains; on a narrow row the button's words wrap instead. */
.sl-with-help { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; max-width: 100%; }
.sl-with-help > .sl-btn { min-width: 0; overflow-wrap: anywhere; }
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
.sl-help.sl-help--text { width: auto; height: auto; border-radius: 0.2rem; font: inherit; opacity: 1; text-decoration: underline dotted; text-underline-offset: 0.2em; }
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

/* Mari's tour: a card at the bottom of the panel, and an outline on the part each step is about. */
.sl-tour {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 9998;
  width: min(22rem, calc(100% - 2rem));
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 0.75rem;
  background: var(--popover, var(--card, #18181b));
  color: var(--popover-foreground, var(--foreground, #f4f4f5));
  box-shadow: 0 10px 30px rgba(0,0,0,0.45);
}
.sl-tour-mari { width: 4.5rem; height: auto; flex-shrink: 0; }
.sl-tour-text { display: grid; gap: 0.35rem; min-width: 0; flex: 1; overflow-wrap: anywhere; }
.sl-tour-text p { margin: 0; font-size: 0.8rem; line-height: 1.45; opacity: 0.9; }
.sl-tour-foot { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.8rem; }
.sl-tour-dots { display: flex; gap: 0.25rem; margin-right: auto; }
.sl-tour-dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: currentColor; opacity: 0.25; }
.sl-tour-dot--on { background: var(--sl-accent); opacity: 1; }
.sl-tour-target { outline: 2px solid var(--sl-accent); outline-offset: 4px; border-radius: 0.5rem; }
/* Room at the end of the nook, so the last parts can scroll up out from under the card. */
.sl-nook:has(> .sl-tour) { padding-bottom: 9rem; }
.sl-mari-line { display: flex; align-items: flex-end; justify-content: center; gap: 0.6rem; max-width: 30rem; margin: 0 auto; text-align: left; }
.sl-mari-line img { width: 4rem; height: auto; flex-shrink: 0; }
.sl-mari-line p { margin: 0; padding: 0.5rem 0.7rem; border-radius: 0.6rem; background: rgba(255,255,255,0.06); font-size: 0.82rem; line-height: 1.45; }

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
  width: 1.75rem;
  height: 1.75rem;
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
  .sl-btn:hover:not(:disabled, [aria-disabled="true"]) {
    background: rgba(255,255,255,0.14);
  }
  .sl-btn--primary:hover:not(:disabled, [aria-disabled="true"]) {
    background: var(--sl-sauce-accent, #e05246);
    filter: brightness(1.1);
  }
  .sl-btn--danger:hover:not(:disabled, [aria-disabled="true"]) {
    background: var(--destructive, #dc2626);
    filter: brightness(1.1);
  }
}

.sl-btn:disabled,
.sl-btn[aria-disabled="true"] {
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
.sl-error-details { display: block; margin-top: 0.25rem; font-family: ui-monospace, monospace; font-size: 0.72rem; opacity: 0.8; overflow-wrap: anywhere; }

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
  /* The widgets sit on Home, outside .sl-shell, so they carry the colour tokens themselves. */
  --sl-accent: #e05246;
  --sl-amber: #f59e0b;
  --sl-green: #10b981;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.65rem;
  height: 100%;
  padding: 0.85rem;
  color: var(--foreground, #fff);
  position: relative;
}
/* The card's real open control is its name; its click area stretches over the card, so a tap anywhere opens
   Saucelings while the meters stay plain text for a screen reader. */
.sl-widget-open {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  text-align: left;
  cursor: pointer;
}
.sl-widget-open::after { content: ""; position: absolute; inset: 0; }
.sl-widget-open:focus-visible { outline: none; }
/* The ring goes round the whole card, which the button's click area covers. */
.sl-widget:has(.sl-widget-open:focus-visible) { outline: 2px solid var(--ring, var(--primary, #e05246)); outline-offset: -2px; }
/* Anything with its own tooltip stays above the stretched click area. */
.sl-widget .sl-badge { position: relative; }
/* The large widget: the stage fills the card, with thin bars (each with a small picture) over its top-left and the
   care buttons in a column down its right side, below Home's own move handle. Its height comes from Home's row, so
   the card is a size container. */
.sl-widget--stage { --sl-remark-h: 3.4rem; container: sl-widget / size; position: relative; padding: 0; gap: 0; border-radius: inherit; overflow: clip; cursor: pointer; }
.sl-widget-body { position: absolute; inset: 0; border-radius: inherit; }
.sl-widget-stage { position: absolute; inset: 0 0 var(--sl-remark-h); min-width: 0; border-radius: inherit; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.sl-widget-stage .sl-stage { width: 100%; height: 100%; max-width: none; aspect-ratio: auto; margin: 0; border-radius: inherit; }
/* The caretaker's newest line sits in a strip under the stage, so it never covers the pet or the caretaker. */
.sl-widget-remark {
  position: absolute;
  inset: auto 0 0;
  height: var(--sl-remark-h);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.7rem;
  background: var(--card, rgba(24,24,27,0.95));
  border-top: 1px solid var(--border, rgba(255,255,255,0.12));
  font-size: 0.75rem;
  line-height: 1.3;
}
.sl-widget-remark .sl-pill { flex: none; }
.sl-widget-remark p { margin: 0; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
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
  width: min(11rem, 65%);
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  background: rgba(0,0,0,0.45);
  pointer-events: auto;
}
.sl-widget-bar-row { display: flex; align-items: center; gap: 0.4rem; }
.sl-widget-bar-icon { flex: none; width: 1rem; font-size: 0.8rem; line-height: 1; text-align: center; }
.sl-widget-bar-name { flex: none; width: 3.6rem; overflow: hidden; font-size: 0.62rem; line-height: 1; text-overflow: ellipsis; white-space: nowrap; opacity: 0.85; }
.sl-widget-bar { flex: 1; min-width: 0; height: 0.45rem; border-radius: 999px; background: rgba(255,255,255,0.22); overflow: hidden; }
/* The column starts under the move handle Home puts in the card's top-right corner. */
.sl-widget-acts { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 2.25rem; pointer-events: auto; }
/* The care buttons fold into one toggle in the bottom-right corner, above the caretaker's strip; open, they fan out
   to its left. */
.sl-widget-care {
  position: absolute;
  inset: auto 0.5rem calc(var(--sl-remark-h) + 0.5rem) auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  max-width: calc(100% - 1rem);
}
.sl-widget-care-row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.4rem; }
.sl-widget-care-error { padding: 0.25rem 0.5rem; border-radius: 0.5rem; background: rgba(0,0,0,0.6); font-size: 0.72rem; }
.sl-widget-act { position: relative; width: 2.25rem; height: 2.25rem; padding: 0; border-radius: 50%; font-size: 1.05rem; background: rgba(0,0,0,0.5); }
.sl-widget-act-wait { position: absolute; top: -0.3rem; right: -0.3rem; min-width: 1.1rem; padding: 0.1rem 0.25rem; border-radius: 999px; background: var(--sl-amber); color: #000; font-size: 0.6rem; font-weight: 700; line-height: 1; }
.sl-btn.sl-widget-act:disabled, .sl-btn.sl-widget-act[aria-disabled="true"] { opacity: 1; }
.sl-widget-act:disabled > span:first-child, .sl-widget-act[aria-disabled="true"] > span:first-child { opacity: 0.5; }
/* Home gives a large widget two columns by two rows; this one is one column by two rows, a tall square-ish card. Home
   counts it as four spots, which only leaves a spare empty slot at the end of the grid. */
.mari-home-feed-grid .mari-home-widget[data-home-widget-kind="package"][data-home-widget-id$=":sauceling-nook"] {
  grid-column: span 1;
  grid-row: span 2;
}

/* A wide panel: the care card in its own column beside the stage, its meters one under another and its buttons
   two by two, kept in view while you scroll. An open panel sits under it in the same column, and the column
   scrolls with the page so a tall panel is never pinned out of reach. */
@container sl-shell (min-width: 48rem) {
  .sl-nook-main {
    grid-template-columns: minmax(0, 1fr) 17rem;
    grid-template-areas: "stage care";
  }
  .sl-nook-side { position: sticky; top: 0; align-self: start; }
  .sl-nook-side:has(> .sl-panel, > .sl-picker) { position: static; }
  .sl-care-card .sl-meters--strip { grid-template-columns: minmax(0, 1fr); }
  .sl-care-card .sl-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sl-care-card .sl-actions > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  /* The column is as narrow as a phone: the egg form wraps the same way. */
  .sl-nook-side .sl-egg-form > .sl-select { flex: 1 1 calc(100% - 3.5rem); min-width: 0; }
  .sl-nook-side .sl-egg-form > .sl-btn { flex: 1 1 auto; }
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
  .sl-nook, .sl-nook-main, .sl-nook-side { gap: 0.75rem; }
  .sl-stage-card, .sl-care-card { gap: 0.6rem; }
  /* Three meters across: a gap's words move to its tooltip, and the box and bar turn amber. */
  .sl-meters--strip { gap: 0.35rem; }
  .sl-meter-box { padding: 0.35rem 0.5rem; }
  .sl-meter-head { font-size: 0.72rem; }
  .sl-meter-gap:not(.sl-meter-gap--keep) { display: none; }
  .sl-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  /* An odd last button (an egg's third, or Paint) takes the whole row. */
  .sl-actions > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  /* The caretaker's picture is smaller, and Ask's picker and button share a row. */
  .sl-box { grid-template-columns: 4rem minmax(0, 1fr); column-gap: 0.7rem; }
  .sl-box--joined { padding: 0.65rem 0.75rem 0.75rem; }
  .sl-ask-row > .sl-select { flex: 1 1 0; min-width: 0; }
  .sl-avatar--box { width: 4rem; height: 4rem; }
  /* The caretaker's avatar stays beside the picker; the buttons share the row below. */
  .sl-egg-form > .sl-select, .sl-egg-form > .sl-input { flex: 1 1 calc(100% - 3.5rem); min-width: 0; }
  .sl-egg-form > .sl-btn { flex: 1 1 auto; }
  /* A picker gets the row's width under its words. */
  .sl-setting--stack { flex-direction: column; align-items: stretch; }
  .sl-setting--stack > select { flex: none; width: 100%; }
  /* The tour card docks across the bottom. */
  .sl-tour { left: 0.5rem; right: 0.5rem; bottom: 0.5rem; width: auto; }
  .sl-tour-mari { width: 3.5rem; }
  /* Centred a little higher, so what it points at is not under the card. */
  .sl-tour-target { scroll-margin-bottom: 9rem; }
}

/* Finger-sized targets, and text fields at 16 px so iOS Safari does not zoom the page on focus. */
@media (pointer: coarse) {
  .sl-btn, .sl-tab-btn { min-height: 2.75rem; }
  .sl-btn--small { min-height: 2.25rem; }
  .sl-widget-act { width: 2.75rem; height: 2.75rem; }
  .sl-gallery-remove { width: 2.25rem; height: 2.25rem; }
  .sl-input, .sl-select { min-height: 2.75rem; font-size: max(16px, 1rem); }
}
`;function vo(){let e=pe(),[t,n]=F(null);return{ask:me(a=>{let o=e.getQueryData(["saucelings","state"])?.characters.find(l=>l.id===a);o&&!o.hasVoice&&n({characterId:a,name:o.name})},[e]),dialog:t?i(Fl,{characterId:t.characterId,name:t.name,onFinish:()=>n(null)},t.characterId):null}}function Fl({characterId:e,name:t,onFinish:n}){let{t:s}=X(),a=pe(),r=j(null),[o,l]=F("ask");q(()=>{let u=r.current;return u&&!u.open&&u.showModal(),u?.querySelector(".sl-btn--primary")?.focus(),()=>u?.close()},[]);let c=async()=>{l("reading"),r.current?.focus();try{let u=await V("/voice","POST",{characterId:e});a.setQueryData(["saucelings","state"],u),n()}catch{l("failed")}};return f("dialog",{ref:r,className:"sl-dialog",tabIndex:-1,"aria-labelledby":"sl-voice-title",onCancel:u=>{u.preventDefault(),o!=="reading"&&n()},children:[i("h2",{id:"sl-voice-title",children:s("saucelings.voice.title",{name:t})}),i("p",{role:"status",children:o==="reading"?s("saucelings.about.refreshingVoice",{name:t}):o==="failed"?s("saucelings.voice.failed",{name:t}):s("saucelings.voice.body",{name:t})}),o==="reading"?null:f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:n,children:s(o==="ask"?"saucelings.voice.notNow":"saucelings.voice.close")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",autoFocus:!0,onClick:()=>{c()},children:o==="ask"?s("saucelings.voice.read",{name:t}):s("saucelings.voice.tryAgain")})]})]})}var Ll=new $a({defaultOptions:{queries:{retry:!1,staleTime:5e3}}}),Ca=class extends Ba.Component{constructor(){super(...arguments);oe(this,"state",{error:null})}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n){let s=n.message||ft(this.props.element.capabilityProps?.localization,"saucelings.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Saucelings client capability stopped",n)}render(){return this.state.error?i("div",{className:"sl-shell",style:{padding:"1.5rem"},role:"alert",children:f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},children:[i("strong",{children:ft(this.props.element.capabilityProps?.localization,"saucelings.error.interface")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:this.state.error.message}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})},children:ft(this.props.element.capabilityProps?.localization,"saucelings.error.retry")})})]})}):this.props.children}},$l=["nook","journal","album","menagerie","settings"],So="saucelings-menagerie-seen";function Hl(){try{return localStorage.getItem(So)}catch{return null}}function Ul({props:e}){let{t}=X(),[n,s]=F("nook"),a=vo(),r=e.focusPostId,o=e.onFocusPostHandled;q(()=>{r&&o?.()},[r,o]);let l=ue({queryKey:["saucelings","state"],queryFn:()=>V("/state"),refetchOnMount:"always",refetchInterval:h=>h.state.data?.writing.length?2e3:!1}),c=l.error?.status===404,u=l.data?.world.lastEggFindDay??null,[p,g]=F(Hl),m=u!==null&&u!==p&&n!=="menagerie";return q(()=>{if(!(n!=="menagerie"||!u)){g(u);try{localStorage.setItem(So,u)}catch{}}},[n,u]),f("div",{className:"sl-shell",children:[f("header",{className:"sl-header",children:[f("div",{className:"sl-header-title",children:[i("strong",{style:{fontSize:"1rem"},children:t("saucelings.title")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.subtitle")})]}),i("nav",{className:"sl-nav","data-sl-tour":"tabs","aria-label":t("saucelings.nav.label"),children:$l.map(h=>f("button",{type:"button",className:`sl-tab-btn ${n===h?"sl-tab-btn--active":""}`,"aria-current":n===h?"page":void 0,"aria-label":h==="menagerie"&&m?t("saucelings.tab.menagerieNew"):void 0,onClick:()=>s(h),children:[t(`saucelings.tab.${h}`),h==="album"&&l.data?.portraitCount?f("span",{className:"sl-tab-count",children:[" (",l.data.portraitCount,")"]}):null,h==="menagerie"&&l.data?.menagerieCount?f("span",{className:"sl-tab-count",children:[" (",l.data.menagerieCount,")"]}):null,h==="menagerie"&&m?i("span",{className:"sl-tab-dot","aria-hidden":"true"}):null]},h))})]}),i("main",{className:"sl-body",children:f("div",{className:"sl-container",children:[l.isError&&l.data?i("div",{role:"alert",className:"sl-error",style:{marginBottom:"0.5rem"},children:t("saucelings.error.load")}):null,l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.loading")}):l.data?n==="nook"?i(mo,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,askVoice:a.ask}):n==="journal"?i(Br,{state:l.data,onOpenNook:()=>s("nook")}):n==="album"?i(Ur,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion}):n==="menagerie"?i(Gr,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,onRestored:h=>{s("nook"),a.ask(h)}}):i(ho,{state:l.data}):f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},role:"alert",children:[i("strong",{children:t("saucelings.error.load")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:c?t("saucelings.error.restart"):i(de,{error:l.error})}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{l.refetch()},children:t("saucelings.error.retry")})})]})]})}),a.dialog]})}function Dl({element:e}){let t=e.capabilityProps??{},n=e.getAttribute("view"),s=typeof t.packageId=="string"?t.packageId:"saucelings",a=typeof t.packageVersion=="string"?t.packageVersion:null;return n==="widget"?i(bo,{active:t.active===!0,compact:t.widgetId==="sauceling-compact",packageId:s,packageVersion:a,onOpenNoodle:typeof t.onOpenNoodle=="function"?t.onOpenNoodle:void 0}):i(Ul,{props:t})}function Bl({element:e}){let[,t]=F(0);return q(()=>{let n=()=>t(s=>s+1);return e.addEventListener("marinara-capability-props",n),()=>e.removeEventListener("marinara-capability-props",n)},[e]),f(Ts,{localization:e.capabilityProps?.localization,children:[i("style",{children:yo}),i(wr,{}),i(Ca,{element:e,children:i(Dl,{element:e})})]})}var An=class extends HTMLElement{constructor(){super(...arguments);oe(this,"__root",null);oe(this,"capabilityProps");oe(this,"capabilityRuntimeError")}attributeChangedCallback(n,s,a){n==="view"&&s!==a&&this.__root&&this.render()}render(){this.__root?.render(i(Ha,{client:Ll,children:i(Bl,{element:this})}))}connectedCallback(){this.__root||(this.__root=Ka(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};oe(An,"observedAttributes",["view"]);var wo="marinara-capability-saucelings";customElements.get(wo)||customElements.define(wo,An);
