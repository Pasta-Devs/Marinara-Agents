var ko=Object.defineProperty;var xo=(e,t,n)=>t in e?ko(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var oe=(e,t,n)=>xo(e,typeof t!="symbol"?t+"":t,n);var Yt=globalThis.__MARINARA_HOST__,K=Yt&&Yt.version===1&&Yt.modules?Yt.modules["@tanstack/react-query"]:void 0;if(!K)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var Dl=K.CancelledError,Bl=K.HydrationBoundary,zl=K.InfiniteQueryObserver,Gl=K.IsRestoringProvider,Kl=K.Mutation,ql=K.MutationCache,Vl=K.MutationObserver,jl=K.QueriesObserver,Ql=K.Query,Wl=K.QueryCache,Fa=K.QueryClient,Yl=K.QueryClientContext,La=K.QueryClientProvider,Xl=K.QueryErrorResetBoundary,Jl=K.QueryObserver,Zl=K.dataTagErrorSymbol,ec=K.dataTagSymbol,tc=K.defaultScheduler,nc=K.defaultShouldDehydrateMutation,ac=K.defaultShouldDehydrateQuery,sc=K.dehydrate,rc=K.dehydrateQuery,oc=K.environmentManager,ic=K.experimental_streamedQuery,lc=K.focusManager,cc=K.hashKey,uc=K.hydrate,gc=K.infiniteQueryOptions,dc=K.isCancelledError,pc=K.isServer,mc=K.keepPreviousData,fc=K.matchMutation,hc=K.matchQuery,bc=K.mutationOptions,yc=K.noop,vc=K.notifyManager,wc=K.onlineManager,Sc=K.partialMatchKey,kc=K.queryOptions,xc=K.replaceEqualDeep,Ec=K.shouldThrowError,Cc=K.skipToken,Rc=K.timeoutManager,Nc=K.unsetMarker,Mc=K.useInfiniteQuery,Ic=K.useIsFetching,Tc=K.useIsMutating,Ac=K.useIsRestoring,ne=K.useMutation,$a=K.useMutationState,Pc=K.usePrefetchInfiniteQuery,_c=K.usePrefetchQuery,Oc=K.useQueries,ce=K.useQuery,pe=K.useQueryClient,Fc=K.useQueryErrorResetBoundary,Lc=K.useSuspenseInfiniteQuery,$c=K.useSuspenseQueries,Hc=K.useSuspenseQuery;var Xt=globalThis.__MARINARA_HOST__,Y=Xt&&Xt.version===1&&Xt.modules?Xt.modules.react:void 0;if(!Y)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var Dc=Y.Activity,Bc=Y.Children,zc=Y.Component,Gc=Y.Fragment,Kc=Y.Profiler,qc=Y.PureComponent,Vc=Y.StrictMode,jc=Y.Suspense,Qc=Y.ViewTransition,Wc=Y.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Yc=Y.__COMPILER_RUNTIME,Xc=Y.act,Jc=Y.addTransitionType,Zc=Y.cache,eu=Y.cacheSignal,tu=Y.captureOwnerStack,nu=Y.cloneElement,Ha=Y.createContext,au=Y.createElement,su=Y.createRef,Ua=Y.default,ru=Y.forwardRef,ou=Y.isValidElement,iu=Y.lazy,lu=Y.memo,cu=Y.startTransition,uu=Y.unstable_useCacheRefresh,gu=Y.use,du=Y.useActionState,me=Y.useCallback,Da=Y.useContext,pu=Y.useDebugValue,mu=Y.useDeferredValue,V=Y.useEffect,fu=Y.useEffectEvent,Jt=Y.useId,Ba=Y.useImperativeHandle,hu=Y.useInsertionEffect,je=Y.useLayoutEffect,Zt=Y.useMemo,bu=Y.useOptimistic,yu=Y.useReducer,Q=Y.useRef,F=Y.useState,vu=Y.useSyncExternalStore,wu=Y.useTransition,Su=Y.version;var en=globalThis.__MARINARA_HOST__,Ct=en&&en.version===1&&en.modules?en.modules["react-dom/client"]:void 0;if(!Ct)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var za=Ct.createRoot,xu=Ct.default,Eu=Ct.hydrateRoot,Cu=Ct.version;var Eo="/api/saucelings",Co="x-marinara-csrf";var Ro="marinara_admin_secret";function No(){if(typeof window>"u")return{};try{let e=window.localStorage.getItem(Ro)?.trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function q(e,t="GET",n,s){return Re(`${Eo}${e}`,t,n,s)}async function Re(e,t="GET",n,s){let a=new Headers(No());t!=="GET"&&a.set(Co,"1"),n!==void 0&&a.set("Content-Type","application/json");let r=await fetch(e,{method:t,headers:a,signal:s,cache:"no-store",credentials:"same-origin",...n===void 0?{}:{body:JSON.stringify(n)}});if(!r.ok){let o=await r.json().catch(()=>null),l=typeof o?.error=="string"?o.error:typeof o?.message=="string"?o.message:r.statusText;throw Object.assign(new Error(l||"Saucelings request failed"),{status:r.status})}return r.json()}function tn(e,t){let n=e instanceof Error?e.message:"",s=e?.status,a=e instanceof Error?e.name:"",r=a==="AbortError"||a==="TimeoutError"?"saucelings.error.timeout":e instanceof TypeError&&s===void 0&&/fetch|network|load failed/i.test(n)?"saucelings.error.network":s===502?"saucelings.error.writing":s===404&&n==="Not Found"?"saucelings.error.restart":typeof s=="number"&&s>=500&&(!n||/^internal server error$/i.test(n))?"saucelings.error.engine":null;return r?{message:t(r),details:n||null}:{message:n||t("saucelings.error.request"),details:null}}function Qe(e="saucelings",t,n){let s=`/api/capability-packages/${encodeURIComponent(e)}/assets/${t}`;return n?`${s}?v=${encodeURIComponent(n)}`:s}var Ga=["prismite","thundrake","clockrit"],Ka=["wickwisp","cauldrop","webbit"],qa=["rigamuffin","fluttino","lentino","shellbini","tortellump"];var Be=["egg","hatchling","juvenile","adult","elder"],Va=["hatchling","juvenile","adult","elder"];var $n=["feed","play","rest","pet"],Hn=["warm","talk","listen"],Mu=[...$n,...Hn],Un=1800*1e3,ja=70,Qa=35;var Mo=["feed","fedBadly","overfed","forgot","play","cuddle","milestone","warmEgg","letCool","chatEgg","hatch","stageUp"],Io=["hello","farewell","checkInEgg","checkInContent","checkInHungry","checkInSad","backSoon","backLong","returnHome","eggFound","eggFoundTalking","anotherEgg","eggFoundByOther","evolveOffer","evolve","temperamentShift","takesAfter","eggFarewell","eggReturn"],Iu=[...Mo,...Io];var Rt=["halo","crown","star","flame","moon","leaf","gem","snowflake","cloud","bolt","feather","heart","mushroom","orb","bow","flower","shell"],nn=["embers","snow","leaves","petals","stars","glints","wisps","sparks","bubbles"];var lt={ember:{aura:"embers",extras:["flame","star","crown"],moves:["firepuff","roar"]},frost:{aura:"snow",extras:["snowflake","gem","moon"],moves:["icicles","twirl"]},moss:{aura:"leaves",extras:["leaf","mushroom","feather"],moves:["leafwhirl","wiggle"]},dusk:{aura:"stars",extras:["moon","star","orb"],moves:["starburst","float"]},gilded:{aura:"glints",extras:["crown","halo","gem"],moves:["coinshower","sparkle","shine"]},shade:{aura:"wisps",extras:["moon","orb","feather"],moves:["shockwave","vanish"]},bloom:{aura:"petals",extras:["flower","heart","bow"],moves:["petalshower","triplehop"]},storm:{aura:"sparks",extras:["bolt","cloud","orb"],moves:["zap","dash"]},tide:{aura:"bubbles",extras:["shell","gem","orb"],moves:["bubbleblow","splash"]}},Wa=200,Dn=24,Bn=24;var as={egg:32,hatchling:29,juvenile:37,adult:45,elder:46},Te=(e,t)=>({data:new Uint8ClampedArray(e*t*4),width:e,height:t}),an=(e,t,n,s)=>{let a=[0,0,0],r=0;for(let o=n;o<Math.min(n+s,e.height);o++)for(let l=t;l<Math.min(t+s,e.width);l++){let c=(o*e.width+l)*4;a[0]+=e.data[c],a[1]+=e.data[c+1],a[2]+=e.data[c+2],r++}return[Math.round(a[0]/r),Math.round(a[1]/r),Math.round(a[2]/r)]};function Vn(e,t=48){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s};if(n===0||s===0)return a;let r=4,o=[an(e,0,0,r),an(e,Math.max(0,n-r),0,r),an(e,0,Math.max(0,s-r),r),an(e,Math.max(0,n-r),Math.max(0,s-r),r)],l=(y,d)=>Math.max(Math.abs(y[0]-d[0]),Math.abs(y[1]-d[1]),Math.abs(y[2]-d[2]))<=t,c=o[0],u=0;for(let y of o){let d=o.filter(b=>l(y,b)).length;d>u&&(u=d,c=y)}let p=y=>{let d=y*4;return e.data[d+3]<16||l([e.data[d],e.data[d+1],e.data[d+2]],c)},g=new Uint8Array(n*s),m=new Int32Array(n*s),h=0,v=y=>{g[y]||!p(y)||(g[y]=1,m[h++]=y)};for(let y=0;y<n;y++)v(y),v((s-1)*n+y);for(let y=0;y<s;y++)v(y*n),v(y*n+n-1);for(;h>0;){let y=m[--h];a.data[y*4+3]=0;let d=y%n;d>0&&v(y-1),d<n-1&&v(y+1),y>=n&&v(y-n),y<n*(s-1)&&v(y+n)}return a}function Nt(e,t=128){let n=e.width,s=e.height,a=-1,r=-1;for(let o=0;o<e.height;o++)for(let l=0;l<e.width;l++)e.data[(o*e.width+l)*4+3]<t||(l<n&&(n=l),l>a&&(a=l),o<s&&(s=o),o>r&&(r=o));return a<0?null:{x:n,y:s,width:a-n+1,height:r-s+1}}var sn=(e,t,n,s,a,r)=>{let o=Te(s,s),l=Math.max(1,Math.round(t.width*n)),c=Math.max(1,Math.round(t.height*n)),u=r===void 0?Math.floor((s-l)/2):r-l,p=s-a-c,g=n<1;for(let m=0;m<c;m++)if(!(p+m<0||p+m>=s))for(let h=0;h<l;h++){if(u+h<0||u+h>=s)continue;let v=h*t.width/l,y=(h+1)*t.width/l,d=m*t.height/c,b=(m+1)*t.height/c,T=0,k=0,A=0,L=0,U=0,x=Math.floor(v),w=Math.floor(d),E=g?Math.ceil(y):x+1,O=g?Math.ceil(b):w+1;for(let R=w;R<Math.min(O,t.height);R++)for(let N=x;N<Math.min(E,t.width);N++){let M=g?(Math.min(N+1,y)-Math.max(N,v))*(Math.min(R+1,b)-Math.max(R,d)):1,P=((t.y+R)*e.width+t.x+N)*4,C=e.data[P+3];T+=M,k+=M*C,A+=M*C*e.data[P],L+=M*C*e.data[P+1],U+=M*C*e.data[P+2]}if(k<=0||k/T<128)continue;let B=((p+m)*s+u+h)*4;o.data[B]=Math.round(A/k),o.data[B+1]=Math.round(L/k),o.data[B+2]=Math.round(U/k),o.data[B+3]=255}return o};function To(e,t,n=52,s=2,a){let r=Nt(e);return r?sn(e,r,a??Math.min(t/r.height,(n-4)/r.width),n,s):Te(n,n)}function Ao(e,t){let n=Math.max(1,Math.floor(t)),s=Te(e.width*n,e.height*n);for(let a=0;a<s.height;a++)for(let r=0;r<s.width;r++){let o=(Math.floor(a/n)*e.width+Math.floor(r/n))*4;s.data.set(e.data.subarray(o,o+4),(a*s.width+r)*4)}return s}var ss=e=>{let t=-1,n=-1;for(let s=0;s<e.height;s++)for(let a=0;a<e.width;a++)if(e.data[(s*e.width+a)*4+3]!==0){t<0&&(t=s),n=s;break}return t<0?null:{top:t,bottom:n}},rn=(e,t,n,s)=>{let a=e.width*4;n.data.set(e.data.subarray(t*a,t*a+a),s*a)};function rs(e){let t=1/0,n=[0,0,0];for(let s=0;s<e.data.length;s+=4){if(e.data[s+3]===0)continue;let a=e.data[s]+e.data[s+1]+e.data[s+2];a<t&&(t=a,n=[e.data[s],e.data[s+1],e.data[s+2]])}return n}function Mt(e,t){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s},r=(o,l)=>o>=0&&l>=0&&o<n&&l<s&&e.data[(l*n+o)*4+3]>0;for(let o=0;o<s;o++)for(let l=0;l<n;l++)!r(l,o)||r(l-1,o)&&r(l+1,o)&&r(l,o-1)&&r(l,o+1)||a.data.set([t[0],t[1],t[2]],(o*n+l)*4);return a}function os(e){let t=ss(e);if(!t)return 0;let n=Math.max(1,t.top+Math.floor((t.bottom-t.top)/2)),s=t.bottom-2,a=Math.min(n,t.bottom),r=1/0,o=e.width*4;for(let l=n;l<=s;l++){let c=0;for(let u=0;u<e.width;u++){let p=l*o+u*4,g=p-o;(e.data[p]!==e.data[g]||e.data[p+1]!==e.data[g+1]||e.data[p+2]!==e.data[g+2]||e.data[p+3]!==e.data[g+3])&&c++}c<=r&&(r=c,a=l)}return a}function is(e,t){let n=Te(e.width,e.height);for(let s=0;s<e.height;s++)s!==0&&(s<=t?rn(e,s-1,n,s):rn(e,s,n,s));return n}function Po(e,t){let n=Te(e.width,e.height);for(let s=0;s<e.height;s++)s<t-1?rn(e,s+1,n,s):rn(e,s,n,s);return n}function Ya(e,t){let n=Te(e.width,e.height),s=ss(e);if(!s)return n;let a=s.bottom-s.top+1;for(let r=0;r<e.height;r++){let o=t*(r<s.top+a/3?2:r<s.top+2*a/3?1:0);for(let l=0;l<e.width;l++){let c=l+o;if(c<0||c>=e.width)continue;let u=(r*e.width+l)*4;n.data.set(e.data.subarray(u,u+4),(r*e.width+c)*4)}}return n}function ls(e){let t=rs(e),n=os(e);return[e,Mt(is(e,n),t),Mt(Po(e,n),t)]}function cs(e){let t=rs(e);return[e,Mt(Ya(e,-1),t),Mt(Ya(e,1),t)]}function It(e,t=2){let n=e.reduce((r,o)=>r+o.width,0),s=Te(n,e[0]?.height??0),a=0;for(let r of e){for(let o=0;o<r.height;o++)s.data.set(r.data.subarray(o*r.width*4,(o+1)*r.width*4),(o*n+a)*4);a+=r.width}return Ao(s,t)}var _o=e=>{let{width:t,height:n}=e,s=new Uint8Array(t*n),a=(r,o)=>r>=0&&o>=0&&r<t&&o<n&&e.data[(o*t+r)*4+3]>=128?1:0;for(let r=0;r<n;r++)for(let o=0;o<t;o++){if(!a(o,r))continue;let l=0;for(let c=-1;c<=1;c++)for(let u=-1;u<=1;u++)(u||c)&&(l+=a(o+u,r+c));l>=2&&(s[r*t+o]=1)}return s};function jn(e,t=16){let n=e.map(_o),s=new Int32Array(4096),a=new Int32Array(4096),r=[];e.forEach((m,h)=>{for(let v=0;v<m.width*m.height;v++){if(!n[h][v])continue;let y=m.data[v*4],d=m.data[v*4+1],b=m.data[v*4+2],T=y>>4<<8|d>>4<<4|b>>4;s[T]++===0&&(a[T]=y<<16|d<<8|b,r.push(T))}});let o=r.map(m=>({c:[a[m]>>16,a[m]>>8&255,a[m]&255],w:Math.ceil(Math.sqrt(s[m]))})),l=m=>{let h=-1,v=0;for(let y=0;y<3;y++){let d=255,b=0;for(let T of m)d=Math.min(d,T.c[y]),b=Math.max(b,T.c[y]);b-d>h&&(h=b-d,v=y)}return{spread:h,channel:v}},c=o.length?[o]:[];for(;c.length<t;){let m=-1,h=0;if(c.forEach((A,L)=>{if(A.length<2)return;let{spread:U}=l(A);U>h&&(h=U,m=L)}),m<0)break;let v=c[m],{channel:y}=l(v),d=[...v].sort((A,L)=>A.c[y]-L.c[y]),b=d.reduce((A,L)=>A+L.w,0)/2,T=0,k=1;for(let A=0;A<d.length-1&&(T+=d[A].w,k=A+1,!(T>=b));A++);c.splice(m,1,d.slice(0,k),d.slice(k))}let u=c.map(m=>{let h=m.reduce((v,y)=>v+y.w,0);return[0,1,2].map(v=>Math.round(m.reduce((y,d)=>y+d.w*d.c[v],0)/h))}),p=u[0]??[0,0,0];for(let m of u)m[0]+m[1]+m[2]<p[0]+p[1]+p[2]&&(p=m);let g=new Map;return e.map((m,h)=>{let v=Te(m.width,m.height);for(let y=0;y<m.width*m.height;y++){if(!n[h][y])continue;let d=m.data[y*4],b=m.data[y*4+1],T=m.data[y*4+2],k=d<<16|b<<8|T,A=g.get(k);if(A===void 0){let L=1/0;A=0,u.forEach((U,x)=>{let w=(U[0]-d)**2+(U[1]-b)**2+(U[2]-T)**2;w<L&&(L=w,A=x)}),g.set(k,A)}v.data.set([...u[A],255],y*4)}return Mt(v,p)})}var zn=(e,t,n)=>{let s=[],a=-1,r=-1;for(let o=0;o<e.length;o++)e[o]&&(a>=0&&o-r>t&&(s.push([a,r+1]),a=-1),a<0&&(a=o),r=o);return a>=0&&s.push([a,r+1]),s.filter(([o,l])=>l-o>=n)},us=e=>e.map(t=>t==="egg"?2:4);function on(e,t,n=!0,s=!1){let a=Vn(e),{width:r,height:o}=a,l=new Uint8Array(r*o);for(let x=0;x<l.length;x++)l[x]=a.data[x*4+3]>=128?1:0;let c=Math.max(r,o)/1024,u=Math.round(10*c),p=Math.round(16*c),g=[],m=(x,w,E,O)=>{let B=new Int32Array(o);for(let R=E;R<O;R++)for(let N=x;N<w;N++)B[R]+=l[R*r+N];return B},h=(x,w,E,O)=>{let B=new Int32Array(r);for(let R=E;R<O;R++)for(let N=x;N<w;N++)B[N]+=l[R*r+N];return B},v=(x,w,E)=>{let O=w;for(let B=w;B<E;B++)x[B]<x[O]&&(O=B);return O},y=(x,w,E)=>{let O=x.r-x.l,B=x.b-x.t,R=new Int32Array(O*B).fill(-1),N=[],M=(S,I)=>l[(x.t+I)*r+x.l+S]===1;for(let S=0;S<O*B;S++){if(R[S]!==-1||!M(S%O,Math.floor(S/O)))continue;let I={size:0,l:O,t:B,r:0,b:0};R[S]=N.length;let D=[S];for(;D.length;){let H=D.pop(),G=H%O,j=(H-G)/O;I.size++,I.l=Math.min(I.l,G),I.r=Math.max(I.r,G+1),I.t=Math.min(I.t,j),I.b=Math.max(I.b,j+1);for(let[ee,re]of[[G-1,j],[G+1,j],[G,j-1],[G,j+1]]){let te=re*O+ee;ee>=0&&re>=0&&ee<O&&re<B&&R[te]===-1&&M(ee,re)&&(R[te]=N.length,D.push(te))}}N.push(I)}let P=Math.max(...N.map(S=>S.size)),C=N.map(S=>S.size!==P&&(x.l+S.l===w||x.l+S.r===E));for(let S=0;S<O*B;S++)R[S]>=0&&C[R[S]]&&(a.data[((x.t+Math.floor(S/O))*r+x.l+S%O)*4+3]=0);let z=N.filter((S,I)=>!C[I]);return{l:x.l+Math.min(...z.map(S=>S.l)),t:x.t+Math.min(...z.map(S=>S.t)),r:x.l+Math.max(...z.map(S=>S.r)),b:x.t+Math.max(...z.map(S=>S.b))}},d=m(0,r,0,o),b=zn(d,u,p);if(!b.length)return null;let T=()=>b.map(([x,w])=>w-x).sort((x,w)=>x-w)[Math.floor(b.length/2)],k=.3*T();for(b=b.filter(([x,w])=>w-x>=k),s&&(b=b.slice(0,t.length));b.length<t.length;){let x=0;b.forEach(([N,M],P)=>{M-N>b[x][1]-b[x][0]&&(x=P)});let[w,E]=b[x];if(E-w<1.4*T())return null;let O=w+Math.floor(.3*(E-w)),B=w+Math.floor(.7*(E-w));if(B<=O)return null;let R=v(d,O,B);if(R<=w)return null;b.splice(x,1,[w,R],[R,E])}if(b.length!==t.length)return null;let A=[];for(let x=0;x<b.length;x++){let[w,E]=b[x],O=t[x],B=h(0,r,w,E),R=zn(B,u,p);if(!R.length)return null;let N=R.map(([S,I])=>{let D=m(S,I,w,E),H=w;for(;!D[H];)H++;let G=E-1;for(;!D[G];)G--;return{h:G-H+1,w:I-S}}),M=Math.max(...N.map(S=>S.h)),P=Math.max(...N.map(S=>S.w));if(R=R.filter((S,I)=>N[I].h>=.6*M||N[I].w>=.6*P),R.length>2*O)return null;let C=!1;if(R.length>O)g.push(`row ${x+1}: ${R.length} drawings, first ${O} used`),R=R.slice(0,O);else if(R.length<O){if(!n)return null;let S=R[0][0],I=R[R.length-1][1],D=(I-S)/O;if(!R.some(([G,j])=>j-G>1.5*D))return null;let H=[S];for(let G=1;G<O;G++)H.push(v(B,Math.floor(S+(G-.15)*D),Math.floor(S+(G+.15)*D)));H.push(I),R=H.slice(0,-1).map((G,j)=>[G,H[j+1]]),C=!0,g.push(`row ${x+1}: drawings touch, split at ${H.slice(1,-1).join(", ")}`)}let z=[];for(let[S,I]of R){let D=(j,ee)=>{let re=m(S,I,j,ee),te=h(S,I,j,ee),fe=j;for(;fe<ee&&!re[fe];)fe++;if(fe===ee)return null;let ue=ee-1;for(;!re[ue];)ue--;let he=S;for(;!te[he];)he++;let ke=I-1;for(;!te[ke];)ke--;return{l:he,t:fe,r:ke+1,b:ue+1,rows:re}},H=D(w,E);if(!H)return null;let G=zn(H.rows.subarray(0,H.b),1,1).filter(([,j])=>j>H.t);if(G.length>1){let[j,ee]=G[G.length-1],re=h(S,I,j,ee),te=S;for(;!re[te];)te++;let fe=I-1;for(;!re[fe];)fe--;let ue=fe-te+1;ee-j<=.12*(H.b-H.t)&&ue>=4*(ee-j)&&ue>=.4*(H.r-H.l)&&(H=D(w,G[G.length-2][1])??H)}if(C){let j=S===R[0][0]?-1:S,ee=I===R[R.length-1][1]?-1:I;H={...H,...y(H,j,ee)}}z.push({x:H.l,y:H.t,width:H.r-H.l,height:H.b-H.t})}A.push(z)}let L=t.length===5?0:-1;if(L===0&&A[0].length>1){let[x,w]=[A[0][0].height,A[0][1].height];Math.abs(x-w)>.25*Math.max(x,w)&&g.push(`egg row sizes differ: ${x} vs ${w}`)}let U=x=>x[x.length>=4?1:0];for(let x=L+2;x<A.length;x++){let[w,E]=[U(A[x]).height,U(A[x-1]).height];w<E*.95&&g.push(`row ${x+1} (${w}) smaller than row ${x} (${E})`)}for(let x=L+1;x<A.length;x++){let w=A[x];if(w.length<2)continue;let[E,O]=[U(w).height,w[w.length-1].height];Math.abs(E-O)>.3*Math.max(E,O)&&g.push(`row ${x+1}: front ${E} vs side ${O}`)}return{cells:A,notes:g,keyed:a}}function gs(e,t,n){let s=t.keyed??Vn(e),a=t.cells.map((c,u)=>{let p=n[u];if(!p)return[];let g=Math.min(as[p]/Math.max(...c.map(m=>m.height)),48/Math.max(...c.map(m=>m.width)));return c.map(m=>sn(s,m,g,52,2))}),r=jn(a.flat()),o={},l=0;return a.forEach((c,u)=>{let p=r.slice(l,l+c.length);l+=c.length;let g=n[u];if(!g||!p.length)return;let m=h=>It(g==="egg"?cs(p[h]):ls(p[h]));g==="egg"?o[g]={image:m(0)}:p.length>=4?o[g]={image:m(1),happy:m(0),grumpy:m(2),side:m(3)}:o[g]=p.length>1?{image:m(0),side:m(1)}:{image:m(0)}}),o}var Fe=96,tt=[5,3],Oo=80,Fo=48;function Lo(e){let t=[[[...tt],!1],[[4,4],!1],[[...tt],!0]];for(let[s,a]of t){let r=on(e,s,a),o=r?.cells.flat();if(r&&o)return{front:o.slice(0,tt[0]),facing:o.slice(tt[0]),keyed:r.keyed}}let n=on(e,[3],!1,!0);return n?{front:n.cells[0],facing:[],keyed:n.keyed}:null}function ds(e){let t=Lo(e);if(!t)return null;let{front:n,facing:s,keyed:a}=t,r=Math.max(...n.map(g=>g.width)),o=Math.max(...s.map(g=>g.width))-r/2,l=Math.min(Oo/Math.max(...[...n,...s].map(g=>g.height)),Fo/r,o>0?(Fe/2-2)/o:1/0),c=Math.max(1,Math.round(r*l)),u=Math.floor((Fe-c)/2)+c,p=jn([...n.map(g=>sn(a,g,l,Fe,0)),...s.map(g=>sn(a,g,l,Fe,0,u))]);return p.every(g=>Nt(g))?It(p,1):null}var ln=(e,t)=>{let n=e.height,s=Te(n,n);for(let a=0;a<n;a++){let r=(a*e.width+t*n)*4;s.data.set(e.data.subarray(r,r+n*4),a*n*4)}return s},Xa=[.12,.42],$o=50,Ho=45,Ja=50,Uo=.04,ct=e=>e>>16,ut=e=>e>>8&255,gt=e=>e&255,We=e=>.299*ct(e)+.587*ut(e)+.114*gt(e),Za=e=>Math.max(ct(e),ut(e),gt(e))-Math.min(ct(e),ut(e),gt(e)),Gn=(e,t)=>Math.hypot(ct(e)-ct(t),ut(e)-ut(t),gt(e)-gt(t)),Kn=e=>e.reduce((t,n)=>We(n)<We(t)?n:t);function Do(e){let t=Nt(e);if(!t)return null;let{width:n,height:s,data:a}=e,r=new Int32Array(n*s).fill(-1);for(let u=0;u<n*s;u++)a[u*4+3]>=128&&(r[u]=a[u*4]<<16|a[u*4+1]<<8|a[u*4+2]);let o=t.y+Math.round(t.height*Xa[0]),l=t.y+Math.round(t.height*Xa[1]),c=new Map;for(let u=o*n;u<l*n;u++){let p=r[u];p>=0&&c.set(p,(c.get(p)??0)+1)}return{colours:r,width:n,z0:o,z1:l,counts:c}}var qn=(e,t)=>{let n=e.map(a=>a%t),s=e.map(a=>Math.floor(a/t));return{x0:Math.min(...n),x1:Math.max(...n),y0:Math.min(...s),y1:Math.max(...s)}};function ps(e,t,n){let{colours:s,width:a,z0:r,z1:o}=e,l=n?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]],c=new Uint8Array(s.length),u=[];for(let p=r*a;p<o*a;p++){if(c[p]||s[p]<0||!t(s[p]))continue;c[p]=1;let g=[p],m=[],h=!1;for(;g.length;){let v=g.pop();m.push(v);for(let[y,d]of l){let b=v%a+y,T=Math.floor(v/a)+d,k=T*a+b;b<0||b>=a||T<r||T>=o||s[k]<0?h=!0:!c[k]&&t(s[k])&&(c[k]=1,g.push(k))}}u.push({pixels:m,open:h})}return u}var ms=(e,t)=>e.x1-e.x0<10&&e.y1-e.y0<8&&e.y1-e.y0+1>=t;function Bo(e){return[...e.counts].filter(([,n])=>n>=30).sort((n,s)=>s[1]-n[1]).slice(0,4).map(([n])=>n).flatMap(n=>ps(e,s=>Gn(s,n)>$o,!1).flatMap(({pixels:s,open:a})=>{let r=qn(s,e.width),o=s.map(c=>e.colours[c]);if(a||s.length<2||s.length>40||!ms(r,2))return[];if(Math.max(...o.map(c=>Gn(c,n)))<90)return[];let l=Kn(o);return[{pixels:s,...r,fill:n,lid:We(n)>We(l)+40?l:null}]}))}function zo(e){let t=[...e.counts.values()].reduce((l,c)=>l+c,0),n=[...e.counts].filter(([,l])=>l>=t*Uo).map(([l])=>l);if(!n.length)return[];let s=l=>l>=0&&n.every(c=>Gn(l,c)>Ho),a=Kn(n),{width:r,colours:o}=e;return ps(e,l=>Za(l)>=Ja&&s(l),!0).flatMap(({pixels:l})=>{if(l.length<2||l.length>36)return[];let c=qn(l,r),u=new Set(l),p=[...l];for(;p.length;){let y=p.pop();for(let d of[1,-1,r,-r,r+1,r-1,1-r,-1-r]){let b=y+d,T=b%r,k=Math.floor(b/r);u.has(b)||T<c.x0-1||T>c.x1+1||k<c.y0-1||k>c.y1+1||k<e.z0||k>=e.z1||!s(o[b])||(u.add(b),p.push(b))}}let g=[...u],m=qn(g,r);if(!ms(m,1))return[];let h=new Map;for(let y of g){let d=y+r;for(;u.has(d);)d+=r;let b=o[d]??-1;b>=0&&h.set(b,(h.get(b)??0)+1)}let v=[...h].sort((y,d)=>d[1]-y[1])[0]?.[0];return v===void 0||Za(v)>=Ja&&!n.includes(v)?[]:Math.abs(We(v)-We(Kn(g.map(y=>o[y]))))<60?[]:[{pixels:g,...m,fill:v,lid:We(v)>We(a)+60?a:null}]})}function es(e){let t=null;for(let n of e)for(let s of e){let a=s.x0-n.x1-1,r=Math.abs(n.y0+n.y1-s.y0-s.y1)/2,o=Math.max(n.pixels.length,s.pixels.length)/Math.min(n.pixels.length,s.pixels.length);if(a<2||a>20||r>1.5||o>2.5||Math.abs(n.y1-n.y0-(s.y1-s.y0))>2)continue;let l=n.pixels.length+s.pixels.length-r*4-o*3;(!t||l>t.score)&&(t={pair:[n,s],score:l})}return t?.pair??null}function ts(e){let t=Do(e);return t?es(Bo(t))??es(zo(t)):null}var Go=(e,t)=>e.every((n,s)=>Math.abs(n.y0+n.y1-t[s].y0-t[s].y1)<=4&&Math.abs(n.x1-n.x0-(t[s].x1-t[s].x0))<=2)&&Math.abs(e[1].x0-e[0].x1-(t[1].x0-t[0].x1))<=2;function Ko(e){let t=e.height,n=Math.floor(e.width/t),s=n===tt[0]+tt[1]?tt[0]:Math.min(n,3),a=n?ts(ln(e,0)):null;if(!a)return null;let r=Array.from({length:n},(o,l)=>{let c=Te(t,t),u=l<s?ts(ln(e,l)):null;if(!u||!Go(u,a))return c;let p=(g,m)=>c.data.set([ct(m),ut(m),gt(m),255],g*4);for(let g of u){for(let h of g.pixels)p(h,g.fill);if(g.lid===null)continue;let m=g.y0+Math.floor((g.y1-g.y0+1)*.6);for(let h=g.x0;h<=g.x1;h++)p(m*t+h,g.lid)}return c});return It(r,1)}var ns=(e,t)=>{let n=Te(e.width,e.height+t.height);return n.data.set(e.data),n.data.set(t.data,e.data.length),n};function fs(e){let t=Math.floor(e.width/e.height),n=Array.from({length:t},(r,o)=>os(ln(e,o))),s=r=>It(n.map((o,l)=>is(ln(r,l),o)),1),a=Ko(e);return{body:ns(e,s(e)),blink:a?ns(a,s(a)):null}}var qo=.25,Vo=20;function jo(e){let{width:t,height:n,data:s}=e,a=u=>s[u*4+3]>0,r=0,o=0,l=0,c=0;for(let u=0;u<n;u++)for(let p=0;p<t;p++){let g=u*t+p,m=p===0||u===0||p===t-1||u===n-1;m&&r++,a(g)&&(l++,m&&o++,(p>0&&!a(g-1)||p<t-1&&!a(g+1)||u>0&&!a(g-t)||u<n-1&&!a(g+t))&&c++)}return o<=r*qo&&c<=Math.sqrt(l)*Vo}function hs(e,t){let n=Vn(e);if(!Nt(n)||!jo(n))return null;let s=jn([To(n,as[t])])[0];return Nt(s)?It(t==="egg"?cs(s):ls(s)):null}var bs=104,dt=416,ys="#ececec",Qo=512,vs=1024,Wo=512,Yo=1024;function Le(e){return new Promise((t,n)=>{let s=new Image;s.onload=()=>t(s),s.onerror=()=>n(new Error("That file is not a picture this browser can open.")),s.src=e})}function Tt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d");if(!s)throw new Error("This browser cannot draw pictures.");return{canvas:n,context:s}}function Ye(e){let{canvas:t,context:n}=Tt(e.width,e.height);return n.putImageData(new ImageData(new Uint8ClampedArray(e.data),e.width,e.height),0,0),t.toDataURL("image/png")}function Qn(e,t){let n=Math.min(1,t/Math.max(e.naturalWidth,e.naturalHeight));return{width:Math.max(1,Math.round(e.naturalWidth*n)),height:Math.max(1,Math.round(e.naturalHeight*n))}}async function cn(e,t){let n=await Le(e),{width:s,height:a}=Qn(n,t),r=Tt(s,a);return r.context.drawImage(n,0,0,s,a),r.context.getImageData(0,0,s,a)}async function ws(e,t){let n=hs(await cn(e,Qo),t);return n?Ye(n):null}async function Ss(e,t){let n=await cn(e,vs),s=on(n,us(t));if(!s)return null;let a={};for(let[r,o]of Object.entries(gs(n,s,t)))a[r]={image:Ye(o.image),...o.side?{side:Ye(o.side)}:{},...o.happy?{happy:Ye(o.happy)}:{},...o.grumpy?{grumpy:Ye(o.grumpy)}:{}};return a}async function ks(e){let t=ds(await cn(e,vs));return t?{image:Ye(t),frames:t.width/t.height}:null}async function xs(e){let{body:t,blink:n}=fs(await cn(e,1/0));return{body:Ye(t),blink:n?Ye(n):null}}async function Es(e){let t=await Le(e),{width:n,height:s}=Qn(t,Wo),{canvas:a,context:r}=Tt(n,s);return r.fillStyle=ys,r.fillRect(0,0,n,s),r.drawImage(t,0,0,n,s),a.toDataURL("image/jpeg",.9)}async function Cs(e){let t=await Le(e),{width:n,height:s}=Qn(t,Yo),{canvas:a,context:r}=Tt(n,s);r.drawImage(t,0,0,n,s);let o=a.toDataURL("image/webp",.9);return o.length<e.length?o:e}async function nt(e,t=0){let n=await Le(e),s=Math.min(n.naturalHeight,bs),{canvas:a,context:r}=Tt(dt,dt);return r.fillStyle=ys,r.fillRect(0,0,dt,dt),r.imageSmoothingEnabled=!1,r.drawImage(n,0,t*bs,s,s,0,0,dt,dt),a.toDataURL("image/png")}var Rs={_meta:{locale:"en",direction:"ltr"},"saucelings.title":"Saucelings","saucelings.subtitle":"Your characters look after a little companion; you cover the gaps.","saucelings.loading":"Loading Saucelings\u2026","saucelings.nav.label":"Saucelings views","saucelings.tab.nook":"Nook","saucelings.tab.journal":"Journal","saucelings.tab.album":"Album","saucelings.tab.menagerie":"Menagerie","saucelings.tab.menagerieNew":"Menagerie, a new egg is waiting","saucelings.tab.settings":"Settings","saucelings.empty.title":"No sauceling in the nook yet","saucelings.empty.body":"Pick a character to look after a sauceling. They'll bring an egg that looks like something they would find.","saucelings.empty.pickCaretaker":"Choose caretaker","saucelings.empty.bringEgg":"Have caretaker bring an egg","saucelings.empty.bringingEgg":"Bringing egg\u2026","saucelings.empty.houseCaretaker":"House Caretaker","saucelings.empty.houseCaretakerNote":"You have no characters yet, so the House Caretaker looks after it. Make a character to choose your own.","saucelings.empty.mari":"Ooh, an empty nook! Pick a character and they'll bring you an egg to raise together (I can't wait to see what hatches).","saucelings.empty.eggAlt":"Egg","saucelings.egg.name":"Egg","saucelings.egg.about":"Nobody knows what is inside yet. Keep it warm and talk to it. Once someone has cared for it, it hatches in about half an hour.","saucelings.egg.moveLabel":"Egg. Drag it, or use the arrow keys, to move it.","saucelings.egg.moveHint":"Drag the egg to move it, or tap where it should go.","saucelings.pet.rename":"Rename","saucelings.pet.nameIt":"Name it","saucelings.pet.namePlaceholder":"Give it a name","saucelings.pet.sauce":"Sauce: {{sauce}}","saucelings.pet.rare.special":"Special sauceling","saucelings.pet.rare.halloween":"Halloween sauceling","saucelings.pet.sauceAbout":"{{sauce}} sauce: {{readsAs}}. Its sauce changes with how it is looked after.","saucelings.pet.temperament":"Temperament: {{temperament}}","saucelings.pet.temperamentAbout":"{{temperament}}: {{readsAs}}. It takes after {{after}}, and slowly picks up the ways of whoever looks after it.","saucelings.pet.temperamentForming":"Its temperament is still taking shape.","saucelings.pet.locked":"{{stage}} (locked)","saucelings.pet.growthPaused":"Growing paused: hungry","saucelings.pet.caretaker":"Caretaker:","saucelings.pet.eggCaretaker":"Keeping it warm:","saucelings.pet.meals":"Meals: {{given}} of {{total}} this week","saucelings.pet.mealsTitle":"Meals {{name}} gave in the last 7 days","saucelings.pet.keptWarm":"Kept warm: {{given}} of {{total}} this week","saucelings.pet.keptWarmTitle":"Times {{name}} kept the egg warm in the last 7 days","saucelings.stage.egg":"egg","saucelings.stage.hatchling":"hatchling","saucelings.stage.juvenile":"juvenile","saucelings.stage.adult":"adult","saucelings.stage.elder":"elder","saucelings.meter.hunger":"Hunger","saucelings.meter.mood":"Mood","saucelings.meter.bond":"Bond","saucelings.meter.hungerGap":"Needs attention","saucelings.meter.moodGap":"Low spirits","saucelings.meter.warmth":"Warmth","saucelings.meter.warmthGap":"Getting cold","saucelings.meter.hatching":"Hatching","saucelings.meter.hatchingGap":"Needs care first","saucelings.meter.warmthHelp":"Eggs need to stay warm. Use Warm when it gets cold.","saucelings.meter.hatchingHelp":"Fills up on its own. Once someone has cared for the egg, it hatches about half an hour after it arrived.","saucelings.meter.hungerHelp":"Feed it to keep this up. A hungry sauceling stops growing until it's fed.","saucelings.meter.moodHelp":"Play and cuddles lift it. A happy sauceling may get the chance to evolve once in its life.","saucelings.meter.bondHelp":"Grows every time anyone cares for it. It needs enough bond to grow into its next stage.","saucelings.action.feed":"Feed","saucelings.action.play":"Play","saucelings.action.rest":"Rest","saucelings.action.pet":"Cuddle","saucelings.action.warm":"Warm","saucelings.action.talk":"Talk","saucelings.action.listen":"Listen","saucelings.action.wait":"{{minutes}}m","saucelings.action.resting":"{{action}} is ready again in {{minutes}} min.","saucelings.nudge.heading":"Ask {{name}} to","saucelings.nudge.ask":"Ask","saucelings.nudge.note":"Lasts 48 hours.","saucelings.nudge.active":"Asked: {{asks}}","saucelings.nudge.left":"{{ask}} ({{hours}} h left)","saucelings.nudge.meals":"remember meals","saucelings.nudge.portions":"go easy on portions","saucelings.nudge.play":"play more","saucelings.nudge.cuddles":"give extra cuddles","saucelings.nudge.warm":"keep it warm","saucelings.nudge.talk":"talk to it more","saucelings.retire.button":"Retire to the Menagerie","saucelings.retire.confirmNote":"Retire {{name}} to the Menagerie? The nook will be free for a new egg, and you can bring {{name}} back later.","saucelings.retire.confirm":"Retire","saucelings.checkIn.button":"Check in with {{name}}","saucelings.checkIn.pending":"{{name}} is writing\u2026","saucelings.swap.button":"Swap for a new egg","saucelings.swap.note":"{{name}} will move to the Menagerie, and the caretaker you pick brings a new egg.","saucelings.swap.noteEgg":"The egg will move to the Menagerie, and the caretaker you pick brings a new one.","saucelings.swap.confirm":"Swap","saucelings.unlocks.title":"Special saucelings \xB7 {{have}} of {{total}} unlocked","saucelings.unlocks.prismite":"Prismite: raise {{need}} saucelings to elder or evolve them ({{have}} so far).","saucelings.unlocks.thundrake":"Thundrake: care for your saucelings {{need}} times ({{have}} so far).","saucelings.unlocks.clockrit":"Clockrit: care for a sauceling on {{need}} different days ({{have}} so far).","saucelings.unlocks.done":"{{name}}: unlocked. A new egg may be one.","saucelings.unlocks.halloween":"Wickwisp, Cauldrop and Webbit: October only.","saucelings.unlocks.halloweenNow":"Wickwisp, Cauldrop and Webbit: it's October, so a new egg may be one.","saucelings.menagerie.empty":"No saucelings in the Menagerie yet.","saucelings.menagerie.emptyHow":"Saucelings come here when you retire them or swap them for a new egg. Eggs your characters find while chatting wait here too.","saucelings.menagerie.bringBack":"Bring back to Nook","saucelings.menagerie.lockStage":"Lock stage at:","saucelings.menagerie.lockStageHelp":"It grew all the way up, so it can come back at any age it reached. It stays that age from then on.","saucelings.menagerie.retiredAs":"Retired as {{stage}} with {{name}}","saucelings.menagerie.returnsAt":"Returns at stage:","saucelings.menagerie.release":"Release","saucelings.menagerie.releaseNote":"Release {{name}} for good? It leaves the Menagerie and can't come back. Its paintings stay in the Album.","saucelings.menagerie.releaseNoteEgg":"Release this egg for good? It leaves the Menagerie and can't come back.","saucelings.menagerie.releaseConfirm":"Release for good","saucelings.menagerie.swapNote":"{{active}} will move to the Menagerie, and {{name}} comes back to the nook.","saucelings.menagerie.swapConfirm":"Swap them","saucelings.menagerie.activeEgg":"The egg in the nook","saucelings.menagerie.thisEgg":"this egg","saucelings.menagerie.foundBy":"Found by {{name}}","saucelings.menagerie.evolved":"Evolved","saucelings.menagerie.close":"Close","saucelings.menagerie.lookedAfterBy":"Looked after by","saucelings.menagerie.chooseCaretaker":"Choose who looks after it","saucelings.menagerie.chooseFirst":"Choose who looks after it first.","saucelings.menagerie.section.elder":"Elders","saucelings.menagerie.section.adult":"Adults","saucelings.menagerie.section.juvenile":"Juveniles","saucelings.menagerie.section.hatchling":"Hatchlings","saucelings.menagerie.section.egg":"Eggs","saucelings.album.paint":"Paint {{name}}","saucelings.album.painting":"Painting\u2026","saucelings.album.needsConnection":"Pick an image connection in Saucelings settings first.","saucelings.album.off":"Turn on image generation in Settings to paint your sauceling.","saucelings.album.egg":"Paint it once it hatches.","saucelings.album.noPet":"Bring a sauceling into the nook to paint it.","saucelings.album.full":"The Album is full at {{limit}} paintings. Delete one to paint another.","saucelings.album.empty":"No paintings yet.","saucelings.album.emptyHint":"Use the Paint button above to make the first one.","saucelings.album.inMenagerie":"(in the Menagerie)","saucelings.album.released":"(released)","saucelings.album.caption":"{{stage}}, {{date}}","saucelings.album.alt":"Painting of {{name}}","saucelings.album.missing":"This painting could not be loaded.","saucelings.album.delete":"Delete","saucelings.album.deleteConfirm":"Delete for good","saucelings.album.close":"Close","saucelings.album.keepsakeLabel":"{{name}} before and after evolving","saucelings.album.keepsakeCaption":"{{name}} became {{form}}, {{date}}","saucelings.album.keepsakeNote":"Kept when a sauceling evolves: how it looked before and after.","saucelings.album.before":"Before","saucelings.album.after":"After","saucelings.album.addInstructions":"Add instructions","saucelings.album.removeInstructions":"Remove instructions","saucelings.album.instructionsLabel":"What should the painting show?","saucelings.album.instructionsPlaceholder":"e.g. sitting in a teacup at a caf\xE9, rain outside","saucelings.album.instructionsNote":"Your words replace the plain background. Leave it empty for a plain portrait.","saucelings.album.instructionsCaption":"\u201C{{instructions}}\u201D","saucelings.form.paint":"Paint {{name}}'s {{stage}} form","saucelings.form.paintEgg":"Paint the egg","saucelings.form.painting":"Painting\u2026","saucelings.form.paintingNote":"Painting it now with your image connection.","saucelings.form.paintingEgg":"Painting the egg\u2026","saucelings.form.repaint":"Repaint all of {{name}}'s forms","saucelings.form.repaintEgg":"Repaint the egg","saucelings.form.repaintHint":"For when the picture came out wrong.","saucelings.form.repaintNote":"Paint every stage again in one new picture? The one you see now stays until the new one is ready.","saucelings.form.repaintConfirm":"Repaint","saucelings.form.undoRepaint":"Undo repaint","saucelings.form.undoRepaintHint":"Goes back to the pictures from before the last repaint. Press it again to bring the repaint back.","saucelings.form.eggFailed":"The egg could not be painted: {{error}} Bring it to the nook to paint it there.","saucelings.form.needed":"Its caretaker invented it, so this stage has no picture until one is painted.","saucelings.form.failed":"The painting could not be cut out into a form. Try again.","saucelings.form.offerEggTitle":"Paint the egg?","saucelings.form.offerEggBody":"This egg has no picture yet. Painting it uses your image connection.","saucelings.form.offerTitle":"Paint {{name}}?","saucelings.form.offerBody":"{{name}} has no picture for this stage yet. Painting it uses your image connection.","saucelings.form.offerNotNow":"Not now","saucelings.form.offerPaint":"Paint it","saucelings.figure.paint":"Paint {{name}} for the Nook","saucelings.figure.repaint":"Repaint {{name}} for the Nook","saucelings.figure.hint":"Draws them in eight poses as a pixel figure in the pets' style, from their avatar and card.","saucelings.figure.confirmNote":"Paint {{name}} as a pixel figure with your image connection? It takes one image request, and what the Nook shows now stays until it is ready.","saucelings.figure.confirm":"Paint","saucelings.figure.failed":"The picture could not be read as drawings of {{name}}. Try again.","saucelings.figure.threePoses":"{{name}} has three poses so far. Repaint for all eight.","saucelings.figure.undoRepaint":"Undo {{name}}'s repaint","saucelings.figure.undoHint":"Goes back to the figure from before the last repaint. Press it again to bring the repaint back.","saucelings.flip.label":"Flip {{name}}","saucelings.flip.note":"Turns {{name}} to face the other way in the Nook. Nothing is repainted.","saucelings.settings.visitsGroup":"Visits","saucelings.settings.writingGroup":"Writing","saucelings.settings.picturesGroup":"Pictures","saucelings.settings.careWindow":"Time between caretaker visits (hours)","saucelings.settings.careWindowNote":"How often the caretaker may feed, play or cuddle (default 6 h).","saucelings.settings.connection":"Writing connection","saucelings.settings.connectionNote":"The connection the caretaker writes journal lines and check-ins with.","saucelings.settings.connectionDefault":"Engine default","saucelings.settings.connectionMissing":"Deleted connection: pick another","saucelings.settings.dailyBudget":"Written lines per day","saucelings.settings.budgetUsed":"Used today: {{used}} / {{limit}}","saucelings.settings.budgetNote":"Lines you ask for with a click (Check in, hello, welcome back, farewell) don't count. Past the limit, the caretaker uses saved lines.","saucelings.settings.writeEveryLine":"Caretaker writes every line","saucelings.settings.writeEveryLineNote":"Every line comes from the model, not the phrasebook. More model calls; the daily limit doesn't apply.","saucelings.settings.images":"Enable image generation","saucelings.settings.imagesNote":"Adds Paint and Generate buttons, and paints each creature a caretaker invents, with the image connection you pick.","saucelings.settings.threeDrawingFallback":"Simpler caretaker figures","saucelings.settings.threeDrawingFallbackNote":"If a figure doesn't come out, ask once more for three drawings in a row. Helps weaker image models; one extra image call.","saucelings.settings.eggHunting":"Egg hunting","saucelings.settings.eggHuntingNote":"A character replying in a chat may find an egg for the Menagerie. Only a chance is rolled: no chat text is read and nothing is added to the prompt.","saucelings.settings.imageConnection":"Image connection","saucelings.settings.imageConnectionPick":"Choose an image connection","saucelings.settings.imageConnectionEmpty":"No image generation connection yet. Add one under Connections.","saucelings.settings.reset":"Reset Saucelings","saucelings.settings.resetNote":"Clear the nook, the Menagerie, the Album, saved backgrounds, caretakers' voices and painted figures, and special-egg progress. Your settings stay.","saucelings.settings.resetConfirm":"Confirm Reset","saucelings.settings.saved":"\u2713 Saved","saucelings.journal.generated":"AI","saucelings.journal.speaker":"{{name}}:","saucelings.journal.toNook":"Go to the Nook","saucelings.journal.empty":"Nothing in the journal yet. Feed, play or cuddle {{name}} and it shows up here.","saucelings.journal.new":"{{count}} new since you last looked","saucelings.journal.today":"Today","saucelings.journal.yesterday":"Yesterday","saucelings.event.egg-found":"Egg found","saucelings.event.hatch":"Hatched","saucelings.event.caretaker-care":"Caretaker","saucelings.event.user-care":"Your care","saucelings.event.nudge":"Nudge","saucelings.event.absence":"While you were away","saucelings.event.stage-up":"Grew up","saucelings.event.temperament-shift":"New sauce","saucelings.event.farewell":"Farewell","saucelings.event.return-from-album":"Back from the Menagerie","saucelings.event.check-in":"Check-in","saucelings.event.evolve":"Evolved","saucelings.event.evolve-offer":"Ready to evolve","saucelings.event.caretaker-change":"New caretaker","saucelings.widget.care":"Care","saucelings.widget.open":"Open {{name}} in Saucelings","saucelings.widget.emptyHint":"Tap to open Saucelings and pick a caretaker.","saucelings.error.interface":"Saucelings encountered an interface error.","saucelings.error.load":"Could not load Saucelings Nook.","saucelings.error.request":"Request failed","saucelings.error.retry":"Try again","saucelings.error.restart":"Restart Marinara Engine to finish installing Saucelings.","saucelings.error.network":"Couldn't reach Marinara Engine. Check that it's running, then try again.","saucelings.error.timeout":"That took too long. Try again in a moment.","saucelings.error.writing":"The writing connection didn't answer. Check it in Settings, or try again in a moment.","saucelings.error.engine":"Something went wrong on the Engine side. Try again in a moment.","saucelings.error.details":"Details","saucelings.common.cancel":"Cancel","saucelings.common.save":"Save","saucelings.nook.background":"Background","saucelings.nook.menu":"More","saucelings.background.title":"Nook background","saucelings.background.upload":"Upload a picture","saucelings.background.uploading":"Uploading\u2026","saucelings.background.generate":"Generate a background","saucelings.background.generating":"Generating\u2026","saucelings.background.promptLabel":"What the background shows","saucelings.background.suggest":"Suggest one for {{name}}","saucelings.background.suggestEgg":"Suggest one for the egg","saucelings.background.suggesting":"Writing\u2026","saucelings.background.suggestPlain":"No writing connection answered, so this is a plain starting point. Edit it as you like.","saucelings.background.useBuiltIn":"Use the built-in background","saucelings.background.tooBig":"That picture is too big.","saucelings.background.off":"Turn on image generation in Settings to generate a background.","saucelings.background.noConnection":"Pick an image connection in Saucelings settings first.","saucelings.background.library":"Saved backgrounds","saucelings.background.sharedNote":"Saved backgrounds are shared by all your saucelings.","saucelings.background.tileAlt":"Background: {{label}}","saucelings.background.earlier":"An earlier background","saucelings.background.missing":"Could not load","saucelings.background.delete":"Delete {{label}}","saucelings.background.deleteNote":"Delete \u201C{{label}}\u201D for good? Saucelings showing it go back to their built-in background.","saucelings.background.deleteConfirm":"Delete for good","saucelings.background.full":"The library is full at {{limit}}. Delete a background to save another.","saucelings.caretaker.says":"{{name}} says","saucelings.caretaker.previous":"Earlier line","saucelings.caretaker.next":"Later line","saucelings.caretaker.position":"{{index}} of {{count}}","saucelings.caretaker.idle":"I'm keeping an eye on {{name}}.","saucelings.caretaker.idleEgg":"I'm keeping an eye on the egg.","saucelings.about.summary":"About {{name}}","saucelings.about.egg":"About the egg","saucelings.about.refreshVoice":"Refresh {{name}}'s voice from their card","saucelings.about.refreshingVoice":"{{name}} is reading their card\u2026","saucelings.about.refreshVoiceNote":"Reads their character card again, so their lines sound like them.","saucelings.about.caretakerGroup":"Caretaker","saucelings.about.looksGroup":"Looks","saucelings.about.newEggGroup":"New egg","saucelings.about.handOverNote":"Hand {{name}} over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOverEggNote":"Hand the egg over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOver":"Hand over","saucelings.help.label":"Show help: {{action}}","saucelings.evolve.button":"Evolve\u2026","saucelings.evolve.note":"{{name}} can become something new, once in its life. You choose, or keep it as it is.","saucelings.evolve.undo":"Undo evolution","saucelings.evolve.undoNote":"{{name}} goes back to how it looked before. Evolve\u2026 comes back with the same two choices.","saucelings.evolve.title":"What could {{name}} become?","saucelings.evolve.writing":"{{caretaker}} is thinking about what {{name}} could become\u2026","saucelings.evolve.from":"From: {{from}}","saucelings.evolve.become":"Become {{form}}","saucelings.evolve.keep":"Keep it as it is","saucelings.evolve.decline":"Not interested","saucelings.evolve.declineNote":"Hides Evolve\u2026 for {{name}} for good.","saucelings.evolve.declineConfirm":"Never offer {{name}} an evolution again?","saucelings.evolve.into":"Evolved into: {{form}}","saucelings.evolve.move":"Signature move: {{move}}","saucelings.evolve.moves.twirl":"Twirl","saucelings.evolve.moves.float":"Float","saucelings.evolve.moves.shine":"Shine","saucelings.evolve.moves.roar":"Roar","saucelings.evolve.moves.sparkle":"Sparkle","saucelings.evolve.moves.firepuff":"Fire Puff","saucelings.evolve.moves.icicles":"Icicles","saucelings.evolve.moves.leafwhirl":"Leaf Whirl","saucelings.evolve.moves.wiggle":"Wiggle","saucelings.evolve.moves.petalshower":"Petal Shower","saucelings.evolve.moves.triplehop":"Triple Hop","saucelings.evolve.moves.starburst":"Star Burst","saucelings.evolve.moves.coinshower":"Coin Shower","saucelings.evolve.moves.shockwave":"Shockwave","saucelings.evolve.moves.vanish":"Vanish","saucelings.evolve.moves.zap":"Lightning Zap","saucelings.evolve.moves.dash":"Dash","saucelings.evolve.moves.bubbleblow":"Bubble Blow","saucelings.evolve.moves.splash":"Splash","saucelings.voice.title":"Give {{name}} their own voice?","saucelings.voice.body":"{{name}} has no voice of their own yet, so their stock lines are generic. Saucelings can read their character card once with your writing connection to learn how they talk, what they call your pet and what they say at mealtimes.","saucelings.voice.read":"Read {{name}}'s card","saucelings.voice.notNow":"Not now","saucelings.voice.failed":"Couldn't make {{name}}'s voice: the writing connection didn't answer.","saucelings.voice.tryAgain":"Try again","saucelings.voice.close":"Close","saucelings.retire.ready":"{{name}} is old enough to retire.","saucelings.stage.tapHint":"Tap the stage and {{name}} comes over.","saucelings.tour.link":"Tour","saucelings.tour.next":"Next","saucelings.tour.back":"Back","saucelings.tour.skip":"Skip","saucelings.tour.done":"Done","saucelings.tour.eggTitle":"Your first egg.","saucelings.tour.eggBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.petTitle":"Your sauceling.","saucelings.tour.petBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.metersTitle":"How it's doing.","saucelings.tour.metersBody":"These bars show how it feels. Tap a name to see what it means.","saucelings.tour.careTitle":"Your care.","saucelings.tour.careBody":"Use these when a bar runs low. Each one rests for a while after you use it.","saucelings.tour.caretakerTitle":"Talk to {{caretaker}}.","saucelings.tour.caretakerBody":"Check in to hear how things are going, or Ask them to care for it differently.","saucelings.tour.aboutTitle":"More options.","saucelings.tour.aboutBody":"Name it, change its look, or change who looks after it here.","saucelings.tour.tabsTitle":"The rest of Saucelings.","saucelings.tour.tabsBody":"The Journal keeps a diary, the Album holds paintings, the Menagerie keeps retired saucelings, and Settings has your connections."};var un=globalThis.__MARINARA_HOST__,At=un&&un.version===1&&un.modules?un.modules["react/jsx-runtime"]:void 0;if(!At)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var ie=At.Fragment,Fu=At.default,i=At.jsx,f=At.jsxs;var Jo=Object.fromEntries(Object.entries(Rs).filter(([e,t])=>e!=="_meta"&&typeof t=="string"));function Zo(e,t){return t?e.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(n,s)=>{let a=t[s];return a==null?n:String(a)}):e}function pt(e,t,n){return Zo(Jo[t]??t,n)}var Ns=Ha({direction:"ltr",t:(e,t)=>pt(void 0,e,t)});function Ms({localization:e,children:t}){let n=e?.direction==="rtl"?"rtl":"ltr",s=Zt(()=>({direction:n,t:(a,r)=>pt(e,a,r)}),[n,e]);return i(Ns.Provider,{value:s,children:i("div",{dir:n,style:{display:"contents"},children:t})})}function X(){return Da(Ns)}var gn={feed:"\u{1F35D}",play:"\u{1F3B2}",rest:"\u{1F319}",pet:"\u{1F49B}",warm:"\u{1F9E3}",talk:"\u{1F4AC}",listen:"\u{1F442}"},Pt={feed:"saucelings.action.feed",play:"saucelings.action.play",rest:"saucelings.action.rest",pet:"saucelings.action.pet",warm:"saucelings.action.warm",talk:"saucelings.action.talk",listen:"saucelings.action.listen"};function _t(e){return e.stage==="egg"?Hn:$n}function Ot(e,t){return e==="feed"&&t.hunger||e==="play"&&t.mood||e==="warm"&&t.warmth}function dn(e){let[t,n]=F(()=>Date.now());return V(()=>{let s=window.setInterval(()=>n(Date.now()),e);return()=>window.clearInterval(s)},[e]),[t,me(()=>n(Date.now()),[])]}function at(e){let[t,n]=F(null),s=Q(void 0);V(()=>()=>window.clearTimeout(s.current),[]);let a=me(r=>{window.clearTimeout(s.current),n(r),s.current=window.setTimeout(()=>n(null),e)},[e]);return[t,a]}var pn=2e3;function mn(e,t,n){let s=e.actionCooldowns[t],a=s?Date.parse(s)-n:0;return a>0?Math.ceil(a/6e4):0}function Ft(e){return e.meters.warmth??ja}function Lt(e,t){let n=t-Date.parse(e.createdAt);return Math.max(0,Math.min(100,Math.floor(n/Un*100)))}function Is(e){return e?.stage!=="egg"||e.careActionCount<1?null:Date.parse(e.createdAt)+Un}function ei(e){let t=e;if(typeof t=="string")try{t=JSON.parse(t)}catch{return""}let n=t?.extensions,s=n?.imageAppearanceEnabled===!0?n.imageAppearance:null,a=typeof s=="string"&&s.trim()?s:n?.appearance;return typeof a=="string"?a:""}function Wn(e){return{queryKey:["saucelings","caretaker-card",e],queryFn:async()=>{let t=await Re(`/api/characters/${encodeURIComponent(e)}`);return{avatar:typeof t.avatarPath=="string"&&/^\/(?![/\\])/u.test(t.avatarPath)?t.avatarPath:null,appearance:ei(t.data)}},staleTime:5*6e4,retry:!1}}function mt(e,t){return ce({...Wn(e),enabled:t}).data?.avatar??null}function ft(e){let t=ce({queryKey:["saucelings","figure",e],queryFn:()=>q(`/figure/${encodeURIComponent(e??"")}`),enabled:!!e,staleTime:1/0,retry:!1});return!e||t.isError?null:t.data?t.data.image?t.data:null:void 0}function fn(e,t){let n=t?.image;return ce({queryKey:["saucelings","figure-motion",e],queryFn:()=>xs(n??""),enabled:!!(e&&n),staleTime:1/0,retry:!1}).data??null}function Ts(e){let[t,n]=F(null),[s,a]=F(!1);return je(()=>{let r=t?.closest(".sl-shell")??t;if(!r||typeof ResizeObserver>"u")return;let o=()=>a(r.clientWidth>=e*parseFloat(getComputedStyle(document.documentElement).fontSize));o();let l=new ResizeObserver(o);return l.observe(r),()=>l.disconnect()},[t,e]),[n,s]}var ti=[];function hn(e,t){let n=ce({queryKey:["saucelings","caretaker-sprites",e],queryFn:async()=>{let s=await Re(`/api/sprites/${encodeURIComponent(e)}`);return(Array.isArray(s)?s:[]).flatMap(a=>{let r=a;return typeof r.expression=="string"&&typeof r.url=="string"&&/^\/api\/sprites\//u.test(r.url)?[{expression:r.expression,url:r.url}]:[]})},enabled:t,staleTime:3e5,retry:!1});return t&&n.data||ti}function ht({name:e,src:t,small:n,box:s}){let a=s?"sl-avatar sl-avatar--box":n?"sl-avatar sl-avatar--small":"sl-avatar";return t?i("img",{className:a,src:t,alt:""}):i("span",{className:a,"aria-hidden":"true",children:e.trim().charAt(0).toUpperCase()||"?"})}function ge({error:e}){let{t}=X(),[n,s]=F(!1),{message:a,details:r}=tn(e,t);return f(ie,{children:[a,r?f(ie,{children:[" ",i("button",{type:"button",className:"sl-link","aria-expanded":n,onClick:()=>s(o=>!o),children:t("saucelings.error.details")}),n?i("span",{className:"sl-error-details",children:r}):null]}):null]})}var bn={rigamuffin:{id:"rigamuffin",name:"Rigamuffin",origin:"rigatoni + ragamuffin",look:"scruffy little tube with ridges, always slightly grubby",defaultTraits:["ridged-hide","crumb-collector","sturdy","curious"]},fluttino:{id:"fluttino",name:"Fluttino",origin:"farfalle + flutter",look:"bow-shaped wings, hovers, never quite lands",defaultTraits:["hover-drift","bow-winged","breezy","restless"]},lentino:{id:"lentino",name:"Lentino",origin:"linguine / lentil + -ino",look:"long, thin, loops itself into knots when happy",defaultTraits:["knot-tier","slender","springy","affectionate"]},shellbini:{id:"shellbini",name:"Shellbini",origin:"conchiglie + shell",look:"shelled, hides inside when sulky",defaultTraits:["pocket-shell","peeker","shy-sweet","echo-hum"]},tortellump:{id:"tortellump",name:"Tortellump",origin:"tortellini + lump",look:"plump folded dumpling with a pinched dimple on top, rolls instead of walking",defaultTraits:["roly-poly","stuffed-snug","dimpled","homebody"]},mossaboo:{id:"mossaboo",name:"Mossaboo",origin:"moss + peekaboo",look:"round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",defaultTraits:["moss-backed","slow","patient","cosy"]},puddlepip:{id:"puddlepip",name:"Puddlepip",origin:"puddle + pip",look:"clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",defaultTraits:["raindrop-headed","splashy","happy","noisy"]},snufflump:{id:"snufflump",name:"Snufflump",origin:"snuffle + lump",look:"round ball of beige fluff with floppy ears, puffs up when startled",defaultTraits:["fluff-ball","sleepy","cuddly","nervous"]},burrowl:{id:"burrowl",name:"Burrowl",origin:"burrow + owl",look:"round brown owl with goggle eyes and big pink digging paws",defaultTraits:["big-pawed","busy","wise","messy"]},prismite:{id:"prismite",name:"Prismite",origin:"prism + -ite",look:"cluster of clear crystal spikes that splits light into rainbows",defaultTraits:["faceted","proud","sparkly","aloof"]},thundrake:{id:"thundrake",name:"Thundrake",origin:"thunder + drake",look:"little storm-cloud dragon with lightning horns and a rainy tail",defaultTraits:["spark-horned","stormy","bold","moody"]},clockrit:{id:"clockrit",name:"Clockrit",origin:"clock + critter",look:"brass wind-up critter with a clock-face belly and a pendulum tail",defaultTraits:["wind-up","punctual","fussy","kind"]},wickwisp:{id:"wickwisp",name:"Wickwisp",origin:"wick + will-o'-the-wisp",look:"stub of dripping candle wax with a little flame floating over its head",defaultTraits:["flame-crowned","flickery","timid","warm-hearted"]},cauldrop:{id:"cauldrop",name:"Cauldrop",origin:"cauldron + drop",look:"small iron cauldron on three legs, brim-full of bubbling purple potion",defaultTraits:["brim-bubbler","bubbly","mischievous","greedy"]},webbit:{id:"webbit",name:"Webbit",origin:"web + -bit",look:"fluffy cobweb spider whose round belly glows like a paper lantern",defaultTraits:["lantern-bellied","tidy","patient","clingy"]}},ni={marinara:{id:"marinara",name:"Marinara",origin:"house sauce",readsAs:"freshly hatched, open-hearted, still finding its flavor",grownBy:"hatching and balanced early days",accentColor:"#e05246",badgeBg:"rgba(224, 82, 70, 0.16)"},zesto:{id:"zesto",name:"Zesto",origin:"pesto + zest",readsAs:"bright, bouncy, chatty",grownBy:"steady feeding and play, good bond",accentColor:"#48b868",badgeBg:"rgba(72, 184, 104, 0.16)"},carbonuzzle:{id:"carbonuzzle",name:"Carbonuzzle",origin:"carbonara + nuzzle",readsAs:"warm, clingy, golden",grownBy:"lots of cuddles and affection",accentColor:"#f0b449",badgeBg:"rgba(240, 180, 73, 0.18)"},rabbratty:{id:"rabbratty",name:"Rabbratty",origin:"arrabbiata + bratty",readsAs:"feisty, demanding, quick-tempered",grownBy:"erratic care, missed meals then spoiling",accentColor:"#f25c3b",badgeBg:"rgba(242, 92, 59, 0.18)"},seppy:{id:"seppy",name:"Seppy",origin:"seppia + sulky",readsAs:"gloomy, brooding, dramatic",grownBy:"neglect, long absences, low mood",accentColor:"#7882a4",badgeBg:"rgba(120, 130, 164, 0.2)"},alfredoze:{id:"alfredoze",name:"Alfredoze",origin:"alfredo + doze",readsAs:"mellow, sleepy, content",grownBy:"over-feeding, little play",accentColor:"#d9ceb8",badgeBg:"rgba(217, 206, 184, 0.2)"},truffoddity:{id:"truffoddity",name:"Truffoddity",origin:"truffle + oddity",readsAs:"strange, brilliant, unsettling",grownBy:"milestones noticed, no affection",accentColor:"#a978e8",badgeBg:"rgba(169, 120, 232, 0.18)"}};function ai(e,t){return Math.min(e,t)<42?"grumpy":e>=68&&t>=68?"happy":"content"}var Yn=["happy","content","grumpy","side"],st=1+(Be.length-1)*Yn.length;function $e(e,t,n){let s=`sprites/${e}.webp`;return t==="egg"?n==="side"?null:{path:s,row:0}:{path:s,row:1+(Be.indexOf(t)-1)*Yn.length+Yn.indexOf(n)}}var $t=6,si={thundrake:140,wickwisp:140,cauldrop:180,clockrit:1e3,webbit:220,prismite:180};function As(e){let t=si[e];return t?{path:`sprites/${e}-live.webp`,ms:t}:null}var Xn=["egg-found","hatch","caretaker-care","absence","stage-up","temperament-shift","farewell","return-from-album","check-in","evolve","evolve-offer","caretaker-change"];function Ht(e){return`${/^[aeiou]/iu.test(e)?"an":"a"} ${e}`}function Xe(e){return e.design?{name:e.design.kind,look:e.design.look}:{name:bn[e.species].name,look:bn[e.species].look}}function ri(e){return!e.design&&qa.includes(e.species)}function ze(e){if(ri(e)){let t=ni[e.temperament];return{name:t.name,readsAs:t.readsAs,sauce:t}}return e.ownTemperament?{name:e.ownTemperament.name,readsAs:e.ownTemperament.readsAs,sauce:null}:null}function Ps(e){return[...Be].reverse().map(t=>({stage:t,entries:e.filter(n=>(n.reachedElder?"elder":n.stageAtRetirement)===t)})).filter(t=>t.entries.length>0)}var _s={rigamuffin:"a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",fluttino:"a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",lentino:"a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",shellbini:"a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",tortellump:"a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",mossaboo:"a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",puddlepip:"a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",snufflump:"a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",burrowl:"an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",prismite:"a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",thundrake:"a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",clockrit:"a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",wickwisp:"a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",cauldrop:"a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",webbit:"a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves"},Os="a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";function bt(e){return e.stage==="egg"?"sprites/scene-nest.webp":`sprites/scene-${e.species}.webp`}function rt(e){return{stage:e.lockedStage??e.stage,mood:ai(e.meters.hunger,e.meters.mood)}}function Fs(e,t){let n=e.forms[t];return n?{kind:"form",formId:n}:e.design?.origin==="found"?{kind:"silhouette"}:{kind:"species"}}var oi=["calm","happy","worried","talking","waving","feeding","playing","tending"],ii={worried:["worried","concerned","sad","anxious"],happy:["happy","smile","laugh","joy"],neutral:["neutral","idle","default","calm"]},li=/^full[_-]/iu;function ci(e,t){for(let n of t==="neutral"?["neutral"]:[t,"neutral"])for(let s of ii[n]){let a=e.find(r=>r.expression.toLowerCase().includes(s));if(a)return a.url}return null}function Jn(e,t){let n=e.filter(a=>!li.test(a.expression)),s=n.length>0?n:e;return ci(s,t)??s[0]?.url??null}var ui={feed:"feeding",play:"playing",rest:"tending",pet:"tending",warm:"tending",talk:"talking"};function yn({gaps:e,line:t,speaking:n,cheering:s,caring:a}){let r=a&&ui[a];return r||(n&&(t?.kind==="caretaker-change"||t?.kind==="return-from-album")?"waving":s?"happy":n?"talking":e.hunger||e.mood||e.warmth||t?.kind==="absence"?"worried":"calm")}function vn(e,t,n,s=null){if(e)return{figure:s?.body??e.image,rows:s?2:1,frames:e.frames,frame:gi(n,e.frames),blink:s?.blink??null};let a=e===null?Jn(t,Ls(n)):null;return a?{src:a}:null}function Ls(e){return e==="worried"?"worried":e==="calm"||e==="talking"?"neutral":"happy"}function gi(e,t){let n=oi.indexOf(e);return n<t?n:["neutral","happy","worried"].indexOf(Ls(e))}var di={"fed-fine":"feed","fed-badly":"feed",overfed:"feed",played:"play",cuddled:"pet","kept-warm":"warm",chatted:"talk"};function $s(e){return(e&&di[e])??null}var pi={rigamuffin:"a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",fluttino:"a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",lentino:"a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",shellbini:"a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",tortellump:"a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",mossaboo:"a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",puddlepip:"a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",snufflump:"a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",burrowl:"a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",prismite:"a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",thundrake:"a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",clockrit:"a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",wickwisp:"a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",cauldrop:"a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",webbit:"a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black"},wn="Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.",Us="Simple, bold, readable face with small eyes and a small mouth.",Zn="Plain flat white background.",yt="text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering",mi=`${yt}, human, person, cropped`,Ds=e=>e.trim()?`${yt}, cropped`:mi,Bs=`${yt}, shadow, ground, floor, scenery, multiple creatures, human, person`,fi=`${Bs}, face, eyes, mouth, nest`,zs=`${yt}, shadow, ground, scenery, overlapping drawings, human, person`,Gs=`${yt}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`,Ks=`${yt}, characters, people, person, creatures, animals, pets`,qs=e=>e==="egg"?fi:Bs,hi="Same creature as the reference image: keep its shape, colours and markings.";function Vs(e,t,n=""){let s=ze(e),a=n.replace(/\s+/gu," ").trim(),r=e.lockedStage??e.stage,o=e.design,l=o?`${Ht(o.kind)}: ${(o.stages[r]??o.look).replace(/[.\s]+$/u,"")}; its colours are ${o.colours.join(", ")}`:pi[e.species],c=o?"":r==="elder"?", wearing little round spectacles and a few white whiskers":r==="hatchling"?", small and round":"";return[wn,`A little virtual pet creature: ${l}.`,`${s?`Its face and pose look ${s.readsAs}. `:""}Life stage: ${r}${c}.`,t?hi:"",Us,...a?[`Full body. ${a.charAt(0).toUpperCase()}${a.slice(1)}${/[.!?]$/u.test(a)?"":"."}`]:["One single creature, full body, centred.",Zn]].filter(Boolean).join(" ")}var bi=400;function js(e,t,n,s){let a=t.replace(/\s+/gu," ").trim().slice(0,bi).replace(/[.\s]+$/u,"");return[wn,...s,"Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",a?`What ${e} looks like: ${a}.`:"",n>0?`Keep ${e}'s hair, face, outfit and colours from the reference image${n>1?"s":""}.`:"",Zn].filter(Boolean).join(" ")}function Hs(e,t,n){return js(e,t,n,[`Eight drawings of the same character, ${e}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,"The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.","The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands."])}function yi(e,t,n){return js(e,t,n,[`Three drawings of the same character, ${e}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`])}function Qs(e,t,n,s){let a=[{prompt:Hs(e,t,n.length),references:n}];return n.length>0&&a.push({prompt:Hs(e,t,0),references:[]}),s&&a.push({prompt:yi(e,t,0),references:[]}),a}var Ws={earlier:"Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",before:"The reference image shows what this creature was before it evolved: keep a hint of its colours."};function Ys(e,t,n){let s=(e.stages[t]??e.look).replace(/[.\s]+$/u,"");return[wn,t==="egg"?`The egg of a small creature, ${Ht(e.kind)}: ${s}.`:`A small creature, ${Ht(e.kind)}, at its ${t} stage: ${s}.`,`Its colours are ${e.colours.join(", ")}.`,n?Ws[n]:"",t==="egg"?"One single egg with no face, upright and centred, filling most of the picture.":`${Us} One single creature, full body, seen from the front and centred, filling most of the picture.`,Zn].filter(Boolean).join(" ")}function ea(e){return Be.filter(t=>e.stages[t])}var vi="The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.",wi="Plain flat white background everywhere.";function Xs(e,t){let n=ea(e),s=c=>(e.stages[c]??e.look).replace(/[.\s]+$/u,""),a=n[0]==="egg",r=n.reduce((c,u)=>c+(u==="egg"?2:4),0),o=n.map((c,u)=>c==="egg"?`Row ${u+1}, the egg, only two drawings. Left: the whole egg, ${s(c)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`:`Row ${u+1}, ${c}, four drawings: ${s(c)}.`),l="and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";return[`${wn} A sprite sheet of one small creature, ${Ht(e.kind)}: ${e.look} Its colours are ${e.colours.join(", ")}.${t?` ${Ws[t]}`:""}`,"",a?`Lay out ${r} drawings in ${n.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${n.length}, ${l}`:`Lay out ${r} drawings in ${n.length} rows: exactly four drawings in each row, ${l}`,...o,"",`${a?`In rows 2 to ${n.length}`:"In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${a?"Growth must read clearly: the hatchling is small and round and the elder is full size.":"The elder is as big as the adult and looks older."}`,"",vi,"",wi].join(`
`)}function ta(e){if(e.stage==="egg")return Os;if(!e.design)return _s[e.species];let[t,n,s]=e.design.colours;return`a cosy little room in ${t}, ${n} and ${s} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`}var Si="Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";function Js(e){return`${Si} A wide side-on scene of ${e.trim().replace(/[.\s]+$/u,"")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`}var Sn=globalThis.__MARINARA_HOST__,ye=Sn&&Sn.version===1&&Sn.modules?Sn.modules["react-dom"]:void 0;if(!ye)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var tg=ye.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ng=ye.browser,Zs=ye.createPortal,ag=ye.default,sg=ye.flushSync,rg=ye.preconnect,og=ye.prefetchDNS,ig=ye.preinit,lg=ye.preinitModule,cg=ye.preload,ug=ye.preloadModule,gg=ye.requestFormReset,dg=ye.unstable_batchedUpdates,pg=ye.useFormState,mg=ye.useFormStatus,fg=ye.version;function Ee({text:e,label:t,trigger:n,children:s}){let[a,r]=F(null),[o,l]=F(null),c=Q(null),u=Q(null),p=Jt();je(()=>{let h=c.current?.getBoundingClientRect(),v=u.current?.getBoundingClientRect();if(!a||!h||!v){l(null);return}let y=8,d=h.top-6-v.height;l({top:d>=y?d:h.bottom+6,left:Math.max(y,Math.min(h.left+h.width/2-v.width/2,window.innerWidth-y-v.width))})},[a]),V(()=>{if(!a)return;let h=y=>{let d=y.target;!c.current?.contains(d)&&!u.current?.contains(d)&&r(null)},v=y=>y.key==="Escape"&&r(null);return document.addEventListener("pointerdown",h),document.addEventListener("keydown",v),()=>{document.removeEventListener("pointerdown",h),document.removeEventListener("keydown",v)}},[a]);let g=()=>r(h=>h??"shown"),m=()=>r(h=>h==="shown"?null:h);return f("span",{className:"sl-with-help",children:[s,i("button",{ref:c,type:"button",className:n?"sl-help sl-help--text":"sl-help","aria-label":t,"aria-expanded":a!==null,"aria-describedby":a?p:void 0,onMouseEnter:g,onMouseLeave:m,onFocus:g,onBlur:m,onKeyDown:h=>{h.key!=="Escape"||!a||(h.preventDefault(),h.stopPropagation(),r(null))},onClick:()=>r(h=>h==="pinned"?null:"pinned"),children:n??f("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:[i("circle",{cx:"12",cy:"12",r:"10"}),i("path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}),i("path",{d:"M12 17h.01"})]})}),a?Zs(i("div",{ref:u,id:p,role:"tooltip",className:"sl-help-tip",style:o?{top:o.top,left:o.left}:{top:0,left:0,visibility:"hidden"},children:e}),document.body):null]})}var se=52,Ke=100,er=[4,6,8,10,12,14,16,19,22],ra={hatchling:{t:21,l:12,r:39,m:30},juvenile:{t:13,l:9,r:42,m:25},adult:{t:5,l:7,r:44,m:19},elder:{t:4,l:7,r:44,m:19}},oa={embers:"rise",wisps:"rise",bubbles:"rise",snow:"fall",leaves:"fall",petals:"fall",stars:"twinkle",glints:"twinkle",sparks:"twinkle"},kn={ember:["#2a0f0a","#8a2a12","#d9581e","#ff9a3c","#ffe08a"],frost:["#0f1a33","#2c5a9a","#5fa0e0","#a8dcff","#f2fbff"],moss:["#10220f","#2f5e1e","#5c9a2e","#9fd35a","#e4f7a8"],dusk:["#170f2e","#46287a","#7d4fc4","#b58cff","#ecdcff"],gilded:["#2a1a05","#7a5410","#c99a1e","#ffd84a","#fff6c2"],shade:["#0e0c14","#2e2a3c","#575070","#8f86ad","#cfc8e6"],bloom:["#2e0f1e","#8a3060","#d9609a","#ff9fcb","#ffe6f2"],storm:["#12141f","#2e3550","#56607f","#8d96b5","#d6dcef"],tide:["#08202a","#145a6a","#2a9a9a","#6ad8c8","#d8fff4"],spark:["#2a1f05","#8a6a10","#e0c020","#fff050","#ffffe0"]},or=["#1c1917","#57534e","#a8a29e","#e7e5e4","#fafaf9"],ki={ember:"#ff7a3d",frost:"#8fd8ff",moss:"#7fd35a",dusk:"#b58cff",gilded:"#ffd84a",shade:"#a99cc8",bloom:"#ff9fcb",storm:"#f5ec5a",tide:"#5fe0d0"};var ir={"webbit:elder":[42,33]};function zt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d",{willReadFrequently:!0});if(!s)throw new Error("No 2D canvas.");return s.imageSmoothingEnabled=!1,[n,s]}var ia=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),tr=new WeakMap;function la(e,t,n){let s=tr.get(e);s||tr.set(e,s=new Map);let a=s.get(t);return a||s.set(t,a=n()),a}function xi(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function na(e,t,n=0){return la(e,`t|${t}|${n}`,()=>{let s=(t==="neutral"?or:kn[t]).map(ia),[a,r]=zt(e.width,e.height);r.drawImage(e,0,0);let o=r.getImageData(0,0,a.width,a.height),l=o.data;for(let c=0;c<l.length;c+=4){if(!l[c+3])continue;let u=Math.min(1,(.2126*l[c]+.7152*l[c+1]+.0722*l[c+2])/255+n),p=Math.min(3,Math.floor(u*4)),g=(u-p/4)*4;for(let m=0;m<3;m++)l[c+m]=Math.round(s[p][m]+g*(s[p+1][m]-s[p][m]))}return r.putImageData(o,0,0),a})}function vt(e,t,n,s,a){return la(e,`s|${t}|${n}|${s}|${a}`,()=>{let r=e.getContext("2d").getImageData(t,n,se,se).data,o=se+2*s,l=se+2*s,c=new Uint8Array(o*l);for(let y=0;y<se;y++)for(let d=0;d<se;d++)c[(y+s)*o+d+s]=r[(y*se+d)*4+3]?1:0;for(let y=0;y<s;y++){let d=c.slice();for(let b=0;b<l;b++)for(let T=0;T<o;T++){let k=b*o+T;!c[k]&&(T>0&&c[k-1]||T<o-1&&c[k+1]||b>0&&c[k-o]||b<l-1&&c[k+o])&&(d[k]=1)}c=d}let[u,p]=zt(o,l),g=p.createImageData(o,l),[m,h,v]=ia(a);for(let y=0;y<c.length;y++)c[y]&&g.data.set([m,h,v,255],y*4);return p.putImageData(g,0,0),u})}var Ei=[[[0,0],[-1,-1],[-1,-2],[-2,-3],[-2,-4],[-3,-5],[-3,-6],[-4,-7]],[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]],[[0,0],[0,1],[-1,2],[-1,3],[0,4],[-1,5],[-1,6],[-2,7]]];function Ci(e,t,n,s,a,r){return la(e,`c|${t}|${n}|${s}|${r}|${a.cx}|${a.mid}`,()=>{let[o,l]=zt(se,se);l.drawImage(vt(e,t,n,0,"#ffffff"),0,0),l.globalCompositeOperation="source-atop",l.fillStyle=r;for(let c=0;c<s;c++)for(let[u,p]of Ei[c])l.fillRect(a.cx+u,a.mid+p,1,1);return o})}function Ne(e,t,n,s,a,r=1,o,l){if(r<=0)return;let c=l?l[2]:t.width,u=l?l[3]:t.height,p=o??c;e.save(),e.globalAlpha*=r,a&&(e.translate(2*n+p,0),e.scale(-1,1)),l?e.drawImage(t,l[0],l[1],c,u,n,s,p,u):e.drawImage(t,n,s,p,u),e.restore()}var Ri=e=>{let t=ra[e];return{...t,cx:t.l+t.r>>1,mid:t.t+51>>1}},sa=class{constructor(){oe(this,"view","happy");oe(this,"col",0);oe(this,"dx",0);oe(this,"dy",0);oe(this,"flip",!1);oe(this,"alpha",1);oe(this,"hide",!1);oe(this,"boost",0);oe(this,"white",0);oe(this,"crack",0);oe(this,"ringA",null);oe(this,"evo",null);oe(this,"body",null);oe(this,"fadeNew",0);oe(this,"aura",!0);oe(this,"extra",!0);oe(this,"extraDy",0);oe(this,"dim",0);oe(this,"shake",0);oe(this,"thread",null);oe(this,"list",[]);oe(this,"marks",[]);oe(this,"after",[]);oe(this,"rings",[])}fx(t,n,s,a,r={}){this.list.push({name:t,frame:n,x:s,y:a,...r})}mark(t,n,s,a,r={}){this.marks.push({name:t,frame:n,x:s,y:a,life:16,anchor:"bc",...r})}};function nr(e,t){let n=t.width,s=t.height;switch(e.anchor){case"c":return[e.x-(n>>1),e.y-(s>>1)];case"bc":return[e.x-(n>>1),e.y-s];case"bl":return[e.x,e.y-s];case"cl":return[e.x,e.y-(s>>1)];default:return[e.x,e.y]}}var $=(e,t,n)=>e>=t&&e<n,Ut=(e,t,n)=>{e.view=t>=1&&t<n-1?"side":"happy"},Ge=(e,t,n,s,a=1)=>[e+Math.round(Math.cos(s)*n),t+Math.round(Math.sin(s)*n*a)];function Ni(e,t,n,s,a){let r=[9,6,3][t-2];for(let[o,l]of[[1,-1],[1.3,0],[1,1]])e.fx(n,t,s+Math.round(r*o),a+Math.round(r*l),{anchor:"c"})}var Bt={firepuff:{dir:!0,hit:5,steps:e=>e?17:15,run(e,t,n){Ut(e,t,n.n);let s=n.E?[0,1,2,4,4,3]:[0,1,2,3];$(t,2,5)&&(e.col=1),$(t,5,7)&&(e.col=2,e.dx=-1);let[a,r]=n.mouth[e.col];$(t,2,5)&&Ni(e,t,"embers",a,r),$(t,5,5+s.length)&&e.fx("flamepuff",s[t-5],a+(t-5===s.length-1?2:0),r,{anchor:"cl",follow:t<7});for(let o of n.E?[4+s.length,6+s.length]:[4+s.length]){let l=t-o;$(l,0,4)&&e.fx("smokering",l,a+20+3*l,r-3-2*l,{anchor:"c",ramp:"neutral"})}}},roar:{hit:6,steps:e=>e?18:15,run(e,t,n){let s=n.E?15:12;$(t,3,6)&&(e.col=1),$(t,6,s)&&(e.col=2,e.dx=t%2?2:-2,e.shake=t%2?1:-1,e.fx("bang",0,n.r+2,n.m-8,{follow:!0,ramp:null})),$(t,6,10)&&e.fx("burstring",t-6,n.r+4+3*(t-6),n.m,{anchor:"c",alpha:[1,.7,.45,.25][t-6]});let a=[n.l+3,n.r-3,n.cx,n.l+8,n.r-8,n.cx-5];for(let r=0;r<(n.E?6:3);r++){let o=t-6-r;$(o,0,7)&&e.fx("wisp",o>>1,a[r]+o%2,49-3*o,{anchor:"c",alpha:o>=5?.5:1})}}},icicles:{dir:!0,hit:4,steps:e=>e?21:17,run(e,t,n){Ut(e,t,n.n);let s=[[0,0],[2,-1],[2,-2],[2,-3],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]);let a=n.E?[2,4,5,7,8]:[2,4,6],r=n.E?16:13;$(t,4,6)&&e.fx("snow",t-4,n.r+2,50,{anchor:"c"}),a.forEach((o,l)=>{let c=n.r+7+9*l,u=t-4-2*l;$(u,0,3)&&t<r?e.fx("icicle",o-2+u,c,52,{anchor:"bc"}):u>=3&&t<r&&e.fx("icicle",o,c,52,{anchor:"bc"}),t===r&&e.fx("icicle",o,c,52,{anchor:"bc",alpha:.5}),l===a.length-1&&$(u,3,7)&&e.fx("glint",u-3,c-1,55-er[o],{anchor:"c"});for(let p=0;p<3&&$(t-r,0,3);p++){let g=t-r,m=er[o];e.fx("shard",(l+p)%4,c+(p-1)*(2+2*g),52-m+4*p+g*g+2*g,{anchor:"c",alpha:g===2?.5:1})}}),t===r&&e.mark("frostpatch",1,n.r+4,52,{anchor:"bl",life:18}),n.E&&t===r&&e.mark("frostpatch",1,n.r+22,52,{anchor:"bl",life:18})}},twirl:{hit:4,steps:e=>e?16:12,run(e,t,n){let s=n.E?[[1,0],[1,0],[2,-2],[2,-3],[0,-4],[0,-5],[0,-5],[0,-5],[0,-4],[0,-3],[2,-2],[2,-1],[1,0],[1,0]]:[[1,0],[1,0],[2,-2],[2,-2],[0,-3],[0,-3],[0,-3],[0,-2],[2,-2],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),$(t,2,s.length-1)&&(e.view=(t-2)%2?"side":"happy",e.flip=(t-2>>1)%2===1);let a=n.E?6:4,r=t-4;for(let o=0;o<a&&$(r,0,8);o++){let[l,c]=Ge(n.cx,n.mid,6+3*r,o/a*2*Math.PI+.4,.5);e.fx("snow",r+o,l,c+r,{anchor:"c"})}}},leafwhirl:{hit:3,steps:e=>e?22:18,run(e,t,n){let s=n.n-4;$(t,1,3)&&(e.col=1),$(t,3,s)&&(e.col=t===3?2:0,e.dy=t===3?-1:n.E?-3:-2),t===s&&(e.dy=-1),t===s+1&&(e.col=1);let a=n.E?8:6,r=(n.r-n.l)/2+4,o=s-3;for(let l=0;l<a&&$(t,3,s+3);l++){let c=(t-3)*(Math.PI/3.5)+l/a*2*Math.PI,u=Math.max(0,Math.min(1,(t-3-l*.5)/(o-2))),p=50-Math.round(u*(50-n.t+6)),g=t-s,[m,h]=Ge(n.cx,p,r,c,.25);g>=0&&([m,h]=[m+Math.round(Math.cos(c)*6*(g+1)),h-2*(g+1)+g*g]),e.fx("leaf",(t+l)%3,m,h,{anchor:"c",follow:g<0,alpha:g>=1?.5:1,layer:Math.sin(c)<0&&g<0?"back":"front"})}}},wiggle:{hit:4,steps:e=>e?16:12,run(e,t,n){$(t,2,n.n-2)&&(e.dx=t%2?1:-1,e.col=t%2?1:0),(n.E?[n.r+7,n.l-7]:[n.r+7]).forEach((a,r)=>{let o=t-4-2*r;$(o,0,2)&&e.fx("sprout",o,a,52,{anchor:"bc"}),o===2&&e.mark("sprout",2,a,52,{life:18})})}},petalshower:{hit:3,steps:e=>e?28:25,run(e,t,n){$(t,1,3)&&(e.col=1),$(t,3,5)&&(e.col=2,e.dy=t===3?-1:0);let s=n.E?12:8,a=t-3,r=n.t-3;for(let o=0;o<s&&a>=0;o++){let l=o%2?1:-1,c=l*(4+2*((o>>1)%3)),u=(o>>1)%2*3,p,g;if(a<=3)[p,g]=[n.cx+c*a,r-[0,5,9,11][a]-u];else{let m=a-3;[p,g]=[n.cx+c*3+l*Math.floor(m/3)+((m>>1)%2?2:-2),r-11-u+3*m]}g<49&&e.fx("petal",(a+o)%3,p,g,{anchor:"c"})}t===9&&e.mark("flower",0,n.r+7,52,{life:20}),n.E&&t===11&&e.mark("flower",0,n.l-7,52,{life:18})}},triplehop:{hit:13,steps:()=>18,run(e,t,n){let s=n.E?[5,9,14]:[4,7,11],a=[[1,0]],r=[];for(let o of s){let l=Math.ceil(o/2);a.push([2,-l],[2,-o],[0,-o],[0,-l],[1,0]),r.push(a.length-1)}t<a.length&&([e.col,e.dy]=a[t]),r.forEach((o,l)=>{let c=t-o,u=l===2?8:4;for(let p=0;p<u&&$(c,0,4);p++){let g=p%2===0,m=p>>1;e.fx("petal",(c+p)%3,g?n.l+1-2*c-4*m:n.r-1+2*c+4*m,49-2*c-2*m+(c*c>>1),{anchor:"c",alpha:c===3?.5:1})}if($(c,0,2))for(let p of[n.l,n.r])e.fx("dust",c,p,52,{anchor:"bc",ramp:"neutral"})})}},starburst:{hit:6,steps:e=>e?16:14,run(e,t,n){if($(t,3,6)&&(e.col=1),$(t,6,8)&&(e.col=2),t<6)for(let a=0;a<6;a++){let[r,o]=Ge(n.cx,n.mid,[28,23,18,13,9,5][t],(a+.5)/6*2*Math.PI+t*.15);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}let s=n.E?[[6,0,7],[8,.5,9]]:[[6,0,7]];for(let[a,r,o]of s){let l=t-a;for(let c=0;c<6&&$(l,0,6);c++){let[u,p]=Ge(n.cx,n.mid,8+o*l,(c+r)/6*2*Math.PI);e.fx("bigstar",[2,3,2,3,1,0][l],u,p,{anchor:"c",alpha:l>=4?.5:1})}}}},float:{hit:4,steps:e=>e?18:16,run(e,t,n){let s=n.E?-14:-10,a=[0,-1,-4,-8],r=n.n-4;t<4?e.dy=Math.max(s,a[t]):t<r?e.dy=s+Math.floor((t-4)/3)%2:e.dy=[-6,-2,0,0][t-r],e.dy<0&&e.fx("shadow",Math.min(3,Math.floor(-e.dy/3)),n.cx,51,{anchor:"c",layer:"floor",ramp:"neutral",alpha:.5}),t===n.n-2&&(e.col=1);for(let o=0;o<5;o++){let l=4+2*o,c=t-l;l>=r||!$(c,0,5)||e.fx("bigstar",[1,2,1,0,0][c],n.cx+[-8,6,-3,9,1][o],50+s+2*c,{anchor:"c",alpha:c===4?.5:1})}}},coinshower:{hit:3,steps:e=>e?24:22,run(e,t,n){$(t,1,3)&&(e.col=1),$(t,3,5)&&(e.col=2,e.dy=t===3?-1:0),(n.E?[-2.6,-2,-1.5,1.5,2,2.6,-3.2,3.2]:[-2.4,-1.7,1.7,2.4]).forEach((a,r)=>{let o=t-3-r%3;if(o<0)return;let l=n.cx+Math.sign(a)*6,c=n.t+4,u=a,p=-4-r%2,g=!1,m=-1;for(let v=0;v<o&&m<0;v++)l+=u,p+=1,c+=p,c>=47&&(c=47,g&&(m=v+1),p=g?0:-3,u/=2,g=!0);let h=Math.round(l);m<0?e.fx("coin",o,h,c,{anchor:"c"}):(m===o&&e.mark("coinflat",0,h,52,{life:14}),o-m<4&&e.fx("glint",o-m,h+3,45,{anchor:"c"}))})}},sparkle:{hit:2,steps:e=>e?18:14,run(e,t,n){t===1&&(e.col=1),t===2&&(e.col=2),[[n.l-6,n.t+4],[n.r+5,n.t+9],[n.l-3,n.m+13],[n.r+3,n.m+18],[n.cx+4,n.t-6],[n.l-9,n.m+2],[n.r+8,n.m],[n.cx-7,n.m+24]].slice(0,n.E?8:4).forEach(([a,r],o)=>{let l=t-4-2*(o%4)-(o>=4?1:0);$(l,0,5)&&e.fx("glint",l,a,r,{anchor:"c"})});for(let a=0;a<6&&$(t,2,5);a++){let[r,o]=Ge(n.cx,n.mid,10+7*(t-2),(a+.5)/6*2*Math.PI);e.fx("bigstar",[1,2,0][t-2],r,o,{anchor:"c",alpha:t===4?.5:1})}}},shine:{hit:2,steps:e=>e?18:14,run(e,t,n){for(let s of n.E?[2,7,12]:[2,8]){let a=t-s;$(a,0,3)&&(e.boost=.25,e.ringA=a===1?.8:.35),$(a,0,4)&&e.fx("glint",[1,2,3,4][a],n.r-4,n.t+3,{anchor:"c"});for(let r=0;r<8&&$(a,0,3);r++){let[o,l]=Ge(n.cx,n.mid,(n.r-n.l)/2+3+3*a,r/8*2*Math.PI,.9);e.fx("bigstar",[0,1,0][a],o,l,{anchor:"c",alpha:a===2?.5:1})}}t===1&&(e.col=1),t===2&&(e.col=2)}},shockwave:{hit:5,steps:e=>e?17:14,run(e,t,n){let s=[[0,0],[1,0],[2,-1],[2,-3],[2,-4],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),t===5&&(e.shake=1),t===6&&(e.shake=-1);for(let a of n.E?[5,7]:[5])$(t-a,0,6)&&e.fx("shockring",t-a,n.cx,51,{anchor:"c",layer:"floor"});if($(t,5,8))for(let[a,r]of[[n.l-3,-1],[n.r+3,1]])e.fx("dust",Math.min(1,t-5),a+3*r*(t-5),52,{anchor:"bc",ramp:"neutral",alpha:t===7?.5:1})}},vanish:{hit:10,steps:()=>14,travel:(e,t)=>t?0:e?40:24,run(e,t,n){let s=n.travel;$(t,1,4)&&(e.col=1),e.alpha={2:.66,3:.33,9:.33,10:.66}[t]??1,$(t,4,9)&&(e.hide=!0),t>=9&&(e.dx=s),$(t,10,12)&&(e.col=2);for(let a=0;a<(n.E?8:6);a++){let r=[-8,8,-3,4,-12,11,0,-6][a],o=[2,0,8,12,10,6,-2,16][a],l,c;if($(t,2,5))[l,c]=[n.cx+r,n.mid+o-2*(t-2)];else if($(t,5,9)){let u=t-5,p=s?0:Math.round(4*Math.cos((u+a)*Math.PI/2));[l,c]=[n.cx+r+Math.round(s*(u+1)/5)+p,n.mid+o-6+(u+a)%2]}else if($(t,9,11))[l,c]=[n.cx+s+Math.round(r*(1-(t-9)/2)),n.mid+o-4+2*(t-9)];else continue;e.fx(a%2?"wisps":"wisp",t+a,l,c,{anchor:"c"})}}},zap:{dir:!0,hit:6,steps:e=>e?15:12,run(e,t,n){if(Ut(e,t,n.n),$(t,2,6))for(let a=0;a<4;a++){let[r,o]=Ge(n.cx,n.t-1,[20,15,10,5][t-2],(a+.5)/4*2*Math.PI+t*.3,.6);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}$(t,4,6)&&(e.col=1),$(t,6,8)&&(e.col=2);let s=n.E?[[6,n.r+16],[9,n.r+34]]:[[6,n.r+16]];for(let[a,r]of s){let o=t-a;$(o,0,3)&&e.fx("bolt",o===1?1:0,r,52,{anchor:"bc",alpha:o===2?.5:1}),o===1&&e.mark("scorch",0,r,52,{ramp:"neutral",life:18});for(let l=0;l<6&&$(o,1,5);l++)e.fx("bigstar",[2,1,1,0][o-1],r+(l%2?1:-1)*(3+3*o+2*(l>>1)),50-2*o-(l>>1)*3+(o*o>>1),{anchor:"c"})}}},dash:{dir:!0,hit:4,steps:()=>13,travel:(e,t)=>t?0:e?44:30,run(e,t,n){Ut(e,t,n.n);let s=n.travel,a=s?[0,Math.round(s*.3),Math.round(s*.65),s]:[1,2,3,3];if($(t,2,4)&&(e.col=1,e.dx=-1),$(t,4,8)){let r=t-4;e.col=r<2?2:0,e.dx=a[r];for(let o=1;o<=(n.E?3:2);o++){let l=s?a[r-o]:a[r]-3*o;l!==void 0&&l!==a[r]&&e.after.push({dx:l,alpha:[.5,.3,.15][o-1]})}}if($(t,8,10)){e.col=1,e.dx=(s||3)+1,e.fx("dust",t-8,n.l-3,52,{anchor:"bc",follow:!0,ramp:"neutral"}),e.fx("dust",t-8,n.l-11-2*(t-8),52,{anchor:"bc",follow:!0,ramp:"neutral",alpha:.6});for(let r=0;r<3;r++)e.fx("bigstar",(t-8+r)%3,n.r+3+3*r,49-3*r-2*(t-8),{anchor:"c",follow:!0})}t>=10&&(e.dx=s||[1,0][t-10]||0)}},bubbleblow:{dir:!0,hit:10,light:17,steps:e=>e?30:23,run(e,t,n){Ut(e,t,n.n),$(t,2,4)&&(e.col=1),$(t,4,10)&&(e.col=2);let[s,a]=n.mouth[2];$(t,4,10)&&e.fx("bubble",t-4,s,a,{anchor:"cl"});let r=n.E?[[10,6,2],[13,5,3],[16,4,2]]:[[10,6,2]];for(let[o,l,c]of r){let u=t-o,p=s+9+2*u,g=a-c*u+u%2;$(u,0,7)&&e.fx("bubble",l,p,g,{anchor:"c"}),$(u,7,9)&&e.fx("pop",u-7,p,g,{anchor:"c"});for(let m=0;m<6&&$(u,8,14);m++){let h=u-8,v=[-3,-2,-1,1,2,3][m];e.fx("droplet",0,p+v*(h+2),g+h*h-3*h-1+m%2*2,{anchor:"c",alpha:h>=5?.5:1})}}}},splash:{hit:8,steps:e=>e?18:15,run(e,t,n){let s=n.E?[-5,-11,-16,-18,-18,-16,-11,-5]:[-4,-9,-13,-15,-13,-9,-4],a=[[1,0],[1,0],...s.map((l,c)=>[c<2||c===s.length-1?2:0,l]),[1,0],[1,0]],r=2+s.length;t<a.length&&([e.col,e.dy]=a[t]);for(let l of n.E?[r,r+2]:[r])$(t-l,0,5)&&e.fx("waterring",t-l,n.cx,51,{anchor:"c",layer:"floor"});let o=t-r;$(o,0,3)&&e.fx("crown",o,n.cx,52,{anchor:"bc"});for(let l=0;l<(n.E?10:8)&&$(o,0,8);l++){let c=[-5,-3,-2,-1,1,2,3,5,-4,4][l],u=6-Math.abs(c)%3;e.fx("droplet",0,n.cx+c*(o+2),46-u*o+o*o,{anchor:"c",alpha:o>=6?.5:1})}}}},Gt=(e,t)=>Bt[e].steps(t),lr=(e,t,n)=>Bt[e].travel?.(t,n)??0,cr=e=>!!(Bt[e].dir||Bt[e].travel),ca=54,ua=16,ur=e=>e.kind==="move"?Gt(e.move,e.encore):e.kind==="hatch"?ga:e.reduced?ua:ca,Mi=(()=>{let e=xi(7);return Array.from({length:16},()=>{let t=e()*4|0,n=e();return[[n*176,-2],[178,n*99*.8],[n*176,-2],[-2,n*99*.8]][t]})})(),ar=[12,20,27,33,38,42];function Ii(e,t,n,s,a,r){if(r){e.evo=t>=12,e.body=t>=12?"new":"old",$(t,4,12)&&(e.fadeNew=[.25,.5,.75,1][t-4>>1]);return}e.evo=t>=44,e.aura=e.extra=t>=46,e.dim=t<10?(t+1)*.06:t<44?.6:[.4,.25,.1][t-44]??0;let o=s+26,l=a+n.mid;t<21&&Mi.forEach(([c,u],p)=>{let g=c+s-62,m=u+a-39,h=Math.min(1,(t+1+p%4)/22)**1.5;h<.92&&e.fx(p%3?"speck":"bigstar",0,Math.round(g+(o-g)*h),Math.round(m+(l-m)*h),{world:!0})}),$(t,10,44)&&(e.col=1),$(t,44,46)&&(e.col=2),$(t,10,22)&&(e.white=[.33,.66][t-10]??(ar.includes(t)?1:.75)),e.body=t<28?"old":t<33?"new":t<37?"old":t<41?"new":t<44?"old":"new",$(t,41,44)&&(e.white=1,e.crack=t-40);for(let c of ar)$(t-c,0,3)&&e.rings.push({d:[2,4,6][t-c],a:[.9,.5,.25][t-c],c:"#ffffff"});$(t,44,49)&&e.fx("burstring",t-44,n.cx,n.mid,{anchor:"c"});for(let c=0;c<8&&$(t,44,52);c++){let u=t-44,[p,g]=Ge(n.cx,n.mid,4+5*u,(c+.5)/8*2*Math.PI);e.fx("shard",c,p,g+(u*u>>1),{anchor:"c",alpha:u>=6?.5:1})}$(t,46,53)&&(e.extraDy=[-20,-14,-8,-3,0,-2,0][t-46])}var gr={prismite:{how:"crack",colour:"frost",moves:["starburst"]},thundrake:{how:"crack",colour:"storm",moves:["zap"]},clockrit:{how:"crack",colour:"gilded",moves:["shockwave"]},wickwisp:{how:"crack",colour:"ember",moves:["firepuff"]},cauldrop:{how:"crack",colour:"moss",moves:["bubbleblow","splash"]},webbit:{how:"thread",colour:"dusk",moves:[]}},ga=24,sr=[2,7,11],Ti=e=>[[15,e.l-3,e.t+3],[17,e.r+2,e.m],[19,e.cx+2,e.t-4]];function Ai(e,t,n,s){if(s==="thread"){e.dy=t<10?-Math.round(92*(1-t/10)**2):[0,-3,-2,-1][t-10]??0,e.col=t<10?2:[1,2][t-10]??0,e.dim=t<10?.3:[.2,.1][t-10]??0,t<14?e.thread=e.dy+n.t+1:t<18&&(e.thread=n.t+1-25*(t-13));for(let[a,r,o]of Ti(n))$(t,a,a+3)&&e.fx("glint",t-a,r,o,{anchor:"c"});return}e.dim=t<6?(t+1)*.07:t<17?.42:[.28,.14][t-17]??0,e.col=t<14?1:$(t,17,19)?2:0,t<17&&(e.white=t<14&&!sr.includes(t)?.85:1),$(t,14,17)&&(e.crack=t-13);for(let a of sr)$(t-a,0,3)&&e.rings.push({d:[2,4,6][t-a],a:[.9,.5,.25][t-a],c:"#ffffff"});$(t,17,22)&&e.fx("burstring",t-17,n.cx,n.mid,{anchor:"c"});for(let a=0;a<8&&$(t,17,24);a++){let r=t-17,[o,l]=Ge(n.cx,n.mid,4+5*r,(a+.5)/8*2*Math.PI);e.fx("shard",a,o,l+(r*r>>1),{anchor:"c",alpha:r>=5?.5:1})}}function dr(e){e.getContext("2d").getImageData(0,0,1,1)}function rr(e,[t,n,s,a],r){let[o,l]=zt(s,a);return l.drawImage(e,t*r,n*r,s*r,a*r,0,0,s,a),o}var aa=new Map;function xn(e){let t=e("sprites/atlas.json"),n=aa.get(t);return n||(n=(async()=>{let s=await fetch(t);if(!s.ok)throw new Error(`atlas ${s.status}`);let a=await s.json(),[r,o]=await Promise.all([Le(e(a.moves.path)),Le(e(a.extras.path))]),l={};for(let[p,g]of Object.entries(a.moves.pieces))l[p]=g.map(m=>rr(r,m,a.scale));let[c,u]=a.extras.artSize;return a.extras.rows.forEach((p,g)=>{l[`x-${p}`]=Array.from({length:a.extras.frames},(m,h)=>rr(o,[h*c,g*u,c,u],a.scale))}),dr(l.bang[0]),{pieces:l,raw:new Set(a.moves.raw)}})(),aa.set(t,n),n.catch(()=>aa.delete(t))),n}function Pi(e){let t=(p,g)=>e[(g*se+p)*4+3]>0,n=[];for(let p=0;p<se;p++)for(let g=0;g<se;g++)if(t(g,p)){n.push(p);break}if(!n.length)return null;let s=n[0],a=n[n.length-1]-s+1,r=new Map;for(let p=s+Math.floor(.3*a);p<=s+Math.floor(.7*a);p++)for(let g=se-1;g>=0;g--)if(t(g,p)){r.set(p,g);break}if(!r.size)return null;let o=Math.max(...r.values()),l=[...r].filter(([,p])=>p>=o-1),[c,u]=l[l.length>>1];return[u+1,c]}var Dt=new Map;function pr(e,t,n,s=null){let a=JSON.stringify([e,t,n,s]),r=Dt.get(a);return r||(Dt.size>32&&Dt.clear(),r=(async()=>{let[o,l]=zt(se*3,se*2);for(let[u,p]of[[e,0],[t??e,se]]){let g=await Le(u.src),m=g.naturalHeight/u.rows;for(let h=0;h<3;h++){let v=u.frames===3?g.naturalWidth/3*h:0,y=u.frames===3?g.naturalWidth/3:g.naturalWidth;l.save(),n&&(l.translate((2*h+1)*se,0),l.scale(-1,1)),l.drawImage(g,v,u.row*m,y,m,h*se,p,se,se),l.restore()}}dr(o);let c=null;if(s)c=[s,s,s];else if(t){let u=[0,1,2].map(p=>Pi(l.getImageData(p*se,se,se,se).data));c=u.every(Boolean)?u:null}return{img:o,mouths:c}})(),Dt.set(a,r),r.catch(()=>Dt.delete(a))),r}var _i=[0,.35,.8,.35],Oi=[[-2,.5],[-3,-1],[-3,-1],[-3,.5],[-2,1],[-1,1]],Fi={rise:e=>[[e.l-4,e.m+12],[e.r-1,e.m+8],[e.r-6,e.m+18]],fall:e=>[[e.l-3,e.t-2],[e.r-2,e.t+2],[e.r+1,e.m+2]],twinkle:e=>[[e.l-5,e.t+2],[e.r-1,e.m+6],[e.l-3,e.m+15]]},Li=[[0,0],[1,-2],[0,-4],[-1,-6],[0,-8],[1,-10],[0,-12],[-1,-14]],$i=[[0,0],[1,2],[2,4],[1,6],[0,8],[1,10],[2,12],[1,14]];function Hi(e,t){let n=Math.floor(t/3);return e==="rise"?{frame:[0,0,0,1,1,1,2,2][n],d:Li[n]}:e==="fall"?{frame:[0,1,2,1,0,1,2,1][n],d:$i[n]}:n<3?{frame:n,d:[0,0]}:null}function mr(e,t,n,s){let{ctx:a,art:r,body:o,colour:l,dir:c,X:u,Y0:p}=e,{width:g,height:m}=a.canvas,h=Ri(e.stage),v=l==="storm"?"spark":l,y=ki[l],d=new sa,b=-99,T=-99;if(t?.kind==="move"){let S=Bt[t.move],I=S.steps(t.encore),D=o.mouths??[0,1,2].map(()=>[h.r,h.m]);S.run(d,n,{...h,mouth:D,E:t.encore,spot:t.spot,n:I,travel:t.travel}),b=n-S.hit,T=n-(S.light??S.hit)}else t?.kind==="hatch"?(Ai(d,n,h,t.how),b=T=n-(t.how==="thread"?10:17)):t&&(Ii(d,n,h,u,p,t.reduced),b=n-46,T=n-44);let k=!e.plain&&(d.evo??!0),A=t?.kind==="move"&&t.encore,L=(S,I)=>c>0?u+S:u+se-S-I,U=L(d.dx,se),x=p+d.dy,w=(S,I,D,H=0)=>{let G=r.pieces[S],j=G[(I%G.length+G.length)%G.length];return r.raw.has(S)||D===null?j:na(j,D,H)},E=(S,I,D)=>{let[H,G,j]=ia(S),ee=U+26,re=p+30,te=a.createRadialGradient(ee,re,4,ee,re,D?200:95);te.addColorStop(0,`rgba(${H},${G},${j},${I})`),D&&te.addColorStop(D,`rgba(${H},${G},${j},${I})`),te.addColorStop(1,`rgba(${H},${G},${j},0)`),a.fillStyle=te,a.fillRect(0,0,g,m)};if(a.save(),a.clearRect(0,0,g,m),d.shake&&a.translate(d.shake,0),e.lit&&d.dim&&E("#000000",d.dim,.55),e.lit&&t&&(k||e.plain)&&$(T,0,6)){let S=[1,1,.75,.5,.3,.15][T]*(A?1.4:1);l==="shade"?E("#000000",.38*S,0):E(y,.24*S,0)}let O=t?`${t.at}|${n}`:e.drawn;if(O!==e.drawn){e.drawn=O;for(let S of d.marks){let I=w(S.name,S.frame,S.ramp===void 0?v:S.ramp),[D,H]=nr(S,I);e.marks.push({img:I,wx:L(D,I.width),wy:p+H,flip:c<0,born:s,life:S.life})}}e.marks=e.marks.filter(S=>s-S.born<S.life);for(let S of e.marks){let I=S.life-(s-S.born);Ne(a,S.img,S.wx,S.wy,S.flip,I<=3?I/4:1)}if(!t)return a.restore(),e.marks.length>0;let B=S=>{let I=w(S.name,S.frame,S.ramp===void 0?v:S.ramp),[D,H]=nr(S,I);S.follow&&(D+=d.dx,H+=d.dy),S.world?Ne(a,I,D,H,!1,S.alpha??1):Ne(a,I,L(D,I.width),p+H,c<0,S.alpha??1)};d.list.filter(S=>S.layer==="floor").forEach(B),d.list.filter(S=>S.layer==="back").forEach(B);let R=d.col*se,N=d.view==="side"?se:0,M=c<0!==d.flip,P=o.img,C=[R,N,se,se];d.thread!==null&&p+d.thread>0&&(a.fillStyle=or[3],a.globalAlpha=.8,a.fillRect(L(h.cx+d.dx,1),0,1,p+d.thread),a.globalAlpha=1);for(let S of d.after)Ne(a,vt(P,R,N,0,y),L(S.dx,se),x,M,S.alpha);if(!d.hide){for(let D of d.rings)Ne(a,vt(P,R,N,D.d,D.c),U-D.d,x-D.d,M,d.alpha*D.a);let S=d.ringA??(k?_i[s%24/6|0]:0);S&&Ne(a,vt(P,R,N,2,y),U-2,x-2,M,d.alpha*S),k&&Ne(a,vt(P,R,N,1,y),U-1,x-1,M,d.alpha);let I=(d.body??(k?"new":"old"))==="new";if(Ne(a,I?na(P,l,d.boost):P,U,x,M,d.alpha,se,C),d.fadeNew&&Ne(a,na(P,l),U,x,M,d.fadeNew,se,C),d.white){let D=d.crack?Ci(P,R,N,d.crack,h,kn[v][2]):vt(P,R,N,0,"#ffffff");Ne(a,D,U,x,M,d.alpha*d.white)}}d.list.filter(S=>!S.layer||S.layer==="front").forEach(B);let z=c>0?u+d.dx:u-d.dx;if(k&&d.aura&&!d.hide){let S=lt[l].aura,I=oa[S],D=$(b,0,12);for(let[H,G]of D?[[0,!1],[4,!0]]:[[0,!1]])Fi[I](h).forEach(([j,ee],re)=>{let te=Hi(I,(s+re*8+H)%24);if(!te)return;let fe=w(S,te.frame,v,D?.25:0),ue=(G?se-j-7:j)+te.d[0]+(7-fe.width>>1),he=ee+te.d[1]+(7-fe.height>>1);Ne(a,fe,z+ue,x+he,!1,d.alpha)})}if(k&&d.extra&&!d.hide){let S=12,I=!1,D=(s%24>=12?-1:0)+d.extraDy;if(t.kind==="move"&&$(b,0,6)){let[G,j]=Oi[b];D+=G,S=Math.round(12*Math.abs(j)),I=j<0}let H=w(`x-${e.extra}`,s%12>=6?1:0,v);Ne(a,H,z+20+(12-S>>1),x+h.t-13+D,I,d.alpha,S)}return a.restore(),e.marks.length>0}var En=52,Ui=1200,Di={feed:[{sprite:"tomato",motion:"feed"}],play:[{sprite:"sparkle",motion:"play-a"},{sprite:"sparkle",motion:"play-b"}],rest:[{sprite:"z",motion:"rest-a"},{sprite:"z",motion:"rest-b"}],pet:[{sprite:"heart",motion:"pet"}]},fr={stage:{x:176,top:80,bottom:24},spot:{x:48,top:56,bottom:8}},Bi={note:[{sprite:"note",motion:"cue-note"}],question:[{sprite:"question",motion:"cue-question"}],bang:[{sprite:"bang",motion:"cue-bang"}],nap:[{sprite:"z",motion:"nap-a"},{sprite:"z",motion:"nap-b"}]},zi="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0",da=(e,t)=>e.map(n=>(parseInt(n.slice(1+t*2,3+t*2),16)/255).toFixed(3)).join(" ");function yr(){return i("svg",{"aria-hidden":"true",width:"0",height:"0",style:{position:"absolute"},children:i("defs",{children:Object.entries(kn).map(([e,t])=>f("filter",{id:`sl-ramp-${e}`,colorInterpolationFilters:"sRGB",children:[i("feColorMatrix",{type:"matrix",values:zi}),f("feComponentTransfer",{children:[i("feFuncR",{type:"table",tableValues:da(t,0)}),i("feFuncG",{type:"table",tableValues:da(t,1)}),i("feFuncB",{type:"table",tableValues:da(t,2)})]})]},e))})})}function Cn(){let[e,t]=F(null),n=Q(void 0);V(()=>()=>window.clearTimeout(n.current),[]);let s=me(a=>{window.clearTimeout(n.current),t({action:a,at:Date.now()}),n.current=window.setTimeout(()=>t(null),Ui)},[]);return[e,s]}var Gi={egg:{w:22,h:30},hatchling:{w:26,h:32},juvenile:{w:32,h:40},adult:{w:36,h:46},elder:{w:36,h:46}};function hr(e,t,n){if(e)return{backgroundImage:`url("${e}")`};if(t)return{backgroundImage:`url("${n(t.path)}")`,backgroundSize:`300% ${st*100}%`,backgroundPositionY:`${t.row/(st-1)*100}%`}}function br(e,t,n){let s=t&&As(e);if(!s)return;let a=st*$t,r=o=>`${(o*st+t.row)/(a-1)*100}%`;return{backgroundImage:`url("${n(s.path)}")`,backgroundSize:`300% ${a*100}%`,"--sl-live-y0":r(0),"--sl-live-y1":r($t),animationDuration:`${s.ms*$t}ms`,animationTimingFunction:`steps(${$t}, end)`}}function Ki({act:e,player:t,look:n,plain:s,stage:a,facing:r,scale:o}){let[l,c]=F(null),[u,p]=F(e);e!==u&&(p(e),c(e?null:u));let g=e??l,m=g?.kind==="move"&&g.spot,h=m?fr.spot:fr.stage,v=h.x*2+En,y=h.top+En+h.bottom,d=Q(null),b=Q(null),{colour:T,extra:k}=n;return je(()=>{let A=d.current?.getContext("2d");if(!A||!g)return;A.imageSmoothingEnabled=!1;let L={ctx:A,...t,colour:T,extra:k,stage:a,dir:r==="right"?1:-1,X:h.x,Y0:h.top,lit:!m,plain:s};b.current?.ctx===A?Object.assign(b.current,L):b.current={...L,marks:[],drawn:""};let U=b.current,x=0,w="",E=()=>{let O=Date.now(),B=Math.floor(O/Ke),R=e?Math.min(ur(e)-1,Math.max(0,Math.floor((O-e.at)/Ke))):0,N=`${R}|${B}`;if(N!==w&&(w=N,!mr(U,e,R,B)&&!e))return c(null);x=requestAnimationFrame(E)};return E(),()=>cancelAnimationFrame(x)},[e,g,t,T,k,a,r,h,m,s]),g?i("canvas",{ref:d,"aria-hidden":"true",className:"sl-move-canvas",width:v,height:y,style:{left:`${-h.x*o}px`,top:`${-h.top*o}px`,width:`${v*o}px`,height:`${y*o}px`}}):null}function wt({species:e,stage:t,mood:n,assetUrl:s,alt:a,scale:r,still:o=!1,reaction:l=null,pose:c=null,cue:u=null,customSrc:p=null,sideSrc:g=null,frames:m=3,silhouette:h=!1,look:v=null,act:y=null,facing:d="right",flipped:b=!1}){let T=t==="egg"?null:ra[t],k=!!p,A=k&&m===1,L=!k&&h,U=k||L?null:$e(e,t,n),x=hr(k?p:null,U,s),w=U&&$e(e,t,"side"),E=hr(k?g:null,w,s),O=t==="egg"?void 0:br(e,U,s),B=t==="egg"?void 0:br(e,w,s),R=o?"sl-live":"sl-live sl-live--on",N=O?i("span",{className:R,style:O}):null,M=B?i("span",{className:R,style:B}):null,P=O?{...x,backgroundImage:"none"}:x,C=B?{...E,backgroundImage:"none"}:E,z=!!E&&c==="walk"&&!l&&t!=="egg",S=l?`sl-react-${t==="egg"?"egg":l.action}`:c&&t!=="egg"?`sl-pose-${c}`:o?"":A||L?"sl-idle sl-idle-custom":`sl-idle sl-idle-${t==="egg"?"egg":n}`,I=!v&&y&&y.kind!=="moment"?y.colour:void 0,D=v??(I?{colour:I,extra:Rt[0]}:null),H=!!D&&t!=="egg"&&!L,G=H?$e(e,t,"happy"):null,j=H?$e(e,t,"side"):null,ee=H?JSON.stringify(k?[{src:p,row:0,rows:1,frames:m},g?{src:g,row:0,rows:1,frames:m}:null,b,null]:[{src:s(G.path),row:G.row,rows:st,frames:3},j?{src:s(j.path),row:j.row,rows:st,frames:3}:null,b,b?null:ir[`${e}:${t}`]??null]):"",[re,te]=F(null),fe=Q(s);V(()=>{fe.current=s}),V(()=>{if(!ee)return;let ae=!0,[ve,_e,He,Ue]=JSON.parse(ee);return Promise.all([xn(fe.current),pr(ve,_e,He,Ue)]).then(([kt,Ze])=>ae&&te({key:ee,art:kt,body:Ze}),()=>ae&&te(null)),()=>{ae=!1}},[ee]);let ue=re&&re.key===ee&&D&&t!=="egg"?re:null,he=Gi[t],ke={width:`${En*r}px`,height:`${En*r}px`,"--sl-px":`${r}px`,...T?{"--sl-t":T.t,"--sl-l":T.l,"--sl-r":T.r,"--sl-m":T.m}:{},...L?{"--sl-sil-w":he.w,"--sl-sil-h":he.h}:{}},we=A?"sl-sprite-frames sl-sprite-frames--single":L?"sl-sprite-frames sl-sprite-frames--silhouette":"sl-sprite-frames",J=v?lt[v.colour].aura:null,le=y&&(ue||I)?" sl-sprite--canvas":"";return f("span",{className:v?`sl-sprite sl-evo sl-evo--${v.colour}${le}`:`sl-sprite${le}`,role:"img","aria-label":a,style:ke,children:[ue&&D&&t!=="egg"?i(Ki,{act:y,player:ue,look:D,plain:!v,stage:t,facing:d,scale:r}):null,v?i("span",{"aria-hidden":"true",className:"sl-evo-ring",children:i("span",{className:z?"sl-sprite-frames sl-pose-walk-side":`${we} ${S}`,style:z?C:P,children:z?M:N},l?.at)}):null,i("span",{className:`${we} ${z?"sl-sprite-frames--hidden":S}`,style:P,children:N},l?.at),E?i("span",{className:`sl-sprite-frames ${z?"sl-pose-walk-side":"sl-sprite-frames--hidden"}`,style:C,children:M}):null,l&&T?(Di[l.action]??[]).map(ae=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ae.sprite} sl-fx-${ae.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ae.sprite}.webp`)}")`}},`${l.at}-${ae.motion}`)):null,u&&T&&!l?Bi[u.kind].map(ae=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ae.sprite} sl-fx-${ae.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ae.sprite}.webp`)}")`}},`${u.at}-${ae.motion}`)):null,v&&J&&T?f(ie,{children:[["a","b","c"].map(ae=>i("span",{"aria-hidden":"true",className:`sl-evo-aura sl-evo-aura--${oa[J]} sl-evo-aura-${ae}`,style:{backgroundImage:`url("${s("sprites/fx-auras.webp")}")`,backgroundSize:`300% ${nn.length*100}%`,backgroundPositionY:`${nn.indexOf(J)/(nn.length-1)*100}%`}},ae)),i("span",{"aria-hidden":"true",className:"sl-evo-extra",style:{backgroundImage:`url("${s("sprites/fx-extras.webp")}")`,backgroundSize:`200% ${Rt.length*100}%`,backgroundPositionY:`${Rt.indexOf(v.extra)/(Rt.length-1)*100}%`}})]}):null]})}var St=(e,t=!1)=>({queryKey:["saucelings","form",e,t?"front":"all"],queryFn:()=>q(`/form/${encodeURIComponent(e)}${t?"?strips=front":""}`),staleTime:1/0});function Ae({art:e,frontOnly:t=!1,...n}){let s=Fs(e,n.stage),a=s.kind==="form"?s.formId:null,r=ce({...St(a??"",t),enabled:a!==null}),o=a?r.data??null:null,l=o?(n.mood==="content"?null:o[n.mood])??o.image:null,c=!l&&(s.kind==="silhouette"||a!==null&&e.design?.origin==="found");return i(wt,{...n,customSrc:l,sideSrc:o?.side??null,frames:o?.frames??1,silhouette:c,look:e.evolution?.look??null})}var qi=1024,wr=1024;function Sr(e,t=!1){let n=e?e.lockedStage??e.stage:null;if(!e?.design||!n||!e.design.stages[n])return null;let s=t||Object.keys(e.forms).length===0?"sheet":"stage";return{petId:e.id,species:e.species,design:e.design,forms:e.forms,stage:n,kind:s}}var Vi=e=>e&&!e.forms[e.stage]?e:null,kr=e=>["saucelings","paint",e],ji=e=>e.kind==="sheet"?"sheet":e.stage,Qi=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;async function pa(e,t,n,s,a){return(await Re("/api/characters/avatar-generation","POST",{connectionId:e,name:"sauceling-form",appearance:t,promptOverrides:[{id:"avatar:sauceling-form",prompt:t,negativePrompt:n}],styleProfileId:"off",width:s,height:s,...a.length>0?{referenceImages:a}:{}})).image}async function xr(e,t,n,s,a){let{design:r,stage:o}=e,l=Be.slice(0,Be.indexOf(o)).reverse().map(m=>e.forms[m]).find(Boolean),c=null,u=null;if(l)c=await n.fetchQuery(St(l,!0)).then(m=>nt(m.image)).catch(()=>null),u=c?"earlier":null;else if(r.origin==="evolved"){let m=$e(e.species,o,"content");c=await nt(s(m.path),m.row).catch(()=>null),u=c?"before":null}let p=await pa(t,Ys(r,o,u),qs(o),qi,c?[c]:[]),g=await ws(p,o);if(!g)throw new Error(a);return q("/form","POST",{stage:o,image:g,petId:e.petId})}async function Wi(e,t,n,s,a){let r=$e(e.species,"adult","content"),o=e.design.origin==="evolved"?await nt(s(r.path),r.row).catch(()=>null):null,l=ea(e.design),c=await pa(t,Xs(e.design,o?"before":null),zs,wr,o?[o]:[]),u=await Ss(c,l);return u?q("/form/sheet","POST",{petId:e.petId,forms:u}):xr({...e,kind:"stage"},t,n,s,a)}function Er(e,t,n){let{t:s}=X(),a=pe(),r=t.world.settings.portraitConnectionId;return ne({mutationKey:e?kr(e.petId):["saucelings","paint"],mutationFn:async({target:o})=>{if(!r)throw new Error(s("saucelings.album.needsConnection"));return await q("/form/start","POST",{petId:o.petId,key:ji(o),token:Qi}),(o.kind==="sheet"?Wi:xr)(o,r,a,n,s("saucelings.form.failed"))},onSuccess:o=>{a.setQueryData(["saucelings","state"],o),a.invalidateQueries({queryKey:["saucelings","menagerie"]})}}).mutate}function Cr(e){let n=$a({filters:{mutationKey:e,exact:!0},select:s=>s.state}).at(-1);return{pending:n?.status==="pending",error:n?.error??null}}var ma=e=>Cr(kr(e)),Rr="saucelings-paint-asked",Nr=new Set;function Mr(){try{let e=JSON.parse(localStorage.getItem(Rr)??"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}catch{return[]}}var Yi=e=>Nr.has(e)||Mr().includes(e);function Xi(e){Nr.add(e);try{localStorage.setItem(Rr,JSON.stringify([...Mr().filter(t=>t!==e),e].slice(-100)))}catch{}}function Ji({isEgg:e,name:t,onAnswer:n}){let{t:s}=X(),a=Q(null);return V(()=>{let r=a.current;return r&&!r.open&&r.showModal(),r?.querySelector(".sl-btn--primary")?.focus(),()=>r?.close()},[]),f("dialog",{ref:a,className:"sl-dialog","aria-labelledby":"sl-paint-offer-title",onCancel:r=>{r.preventDefault(),n(!1)},children:[i("h2",{id:"sl-paint-offer-title",children:e?s("saucelings.form.offerEggTitle"):s("saucelings.form.offerTitle",{name:t})}),i("p",{children:e?s("saucelings.form.offerEggBody"):s("saucelings.form.offerBody",{name:t})}),f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(!1),children:s("saucelings.form.offerNotNow")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>n(!0),children:s("saucelings.form.offerPaint")})]})]})}function Ir({petId:e}){let{t}=X(),{pending:n,error:s}=ma(e);return n?i("span",{role:"status",style:{fontSize:"0.8rem",opacity:.8},children:t("saucelings.form.paintingEgg")}):s?i("span",{role:"alert",className:"sl-error",children:t("saucelings.form.eggFailed",{error:tn(s,t).message})}):null}function Rn({state:e,assetUrl:t}){let{t:n}=X(),s=e.world.activePet,a=Vi(Sr(s)),r=Er(a,e,t),{pending:o,error:l}=ma(a?.petId??""),[,c]=F(0),u=e.world.settings;if(!s||!a||!u.portraitEnabled||!u.portraitConnectionId)return null;let p=s.stage==="egg",g=`${a.petId}/${a.stage}`,m=h=>{Xi(g),c(v=>v+1),h&&r({target:a})};return f("div",{className:"sl-care-row",children:[!o&&!Yi(g)?i(Ji,{isEgg:p,name:s.name,onAnswer:m}):null,i("button",{type:"button",className:"sl-btn",disabled:o,onClick:()=>r({target:a}),children:o?n("saucelings.form.painting"):`\u{1F3A8} ${p?n("saucelings.form.paintEgg"):n("saucelings.form.paint",{name:s.name,stage:n(`saucelings.stage.${a.stage}`)})}`}),i("span",{className:"sl-care-note",role:"status",children:n(o?"saucelings.form.paintingNote":"saucelings.form.needed")}),l&&!o?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:l})}):null]})}function Tr({state:e,assetUrl:t}){let{t:n}=X(),s=pe(),[a,r]=F(!1),o=e.world.activePet,l=Sr(o,!0),c=Er(l,e,t),{pending:u,error:p}=ma(l?.petId??""),g=ne({mutationFn:async d=>{let b=await q("/form/undo","POST",{petId:d});return await Promise.all(Object.values(b.world.activePet?.forms??{}).map(T=>s.prefetchQuery(St(T)))),b},onSuccess:d=>{s.setQueryData(["saucelings","state"],d),s.invalidateQueries({queryKey:["saucelings","menagerie"]})}}),m=e.world.settings;if(!o||!l||!l.forms[l.stage]||!m.portraitEnabled)return null;let h=!!m.portraitConnectionId,v=Object.keys(o.savedForms).length>0;if(!h&&!v)return null;let y=o.stage==="egg"?n("saucelings.form.repaintEgg"):n("saucelings.form.repaint",{name:o.name});return f("div",{className:"sl-about-row",children:[a?f(ie,{children:[i("span",{className:"sl-care-note",children:n("saucelings.form.repaintNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>{r(!1),c({target:l})},children:n("saucelings.form.repaintConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>r(!1),children:n("saucelings.common.cancel")})]}):f(ie,{children:[u?i("button",{type:"button",className:"sl-btn",disabled:!0,children:n("saucelings.form.painting")}):h?i(Ee,{text:n("saucelings.form.repaintHint"),label:n("saucelings.help.label",{action:y}),children:f("button",{type:"button",className:"sl-btn",onClick:()=>r(!0),children:["\u{1F3A8} ",y]})}):null,v?i(Ee,{text:n("saucelings.form.undoRepaintHint"),label:n("saucelings.help.label",{action:n("saucelings.form.undoRepaint")}),children:f("button",{type:"button",className:"sl-btn",disabled:u||g.isPending,onClick:()=>g.mutate(o.id),children:["\u21B6 ",n("saucelings.form.undoRepaint")]})}):null,i("span",{className:"sl-care-note",role:"status",children:u?n("saucelings.form.paintingNote"):null})]}),p&&!u?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:p})}):null,g.error&&!g.isPending?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:g.error})}):null]})}function Ar({name:e,flipped:t,request:n}){let{t:s}=X(),a=pe(),r=ne({mutationFn:()=>n(!t),onSuccess:o=>a.setQueryData(["saucelings","state"],o)});return f("div",{className:"sl-about-row",children:[i(Ee,{text:s("saucelings.flip.note",{name:e}),label:s("saucelings.help.label",{action:s("saucelings.flip.label",{name:e})}),children:f("button",{type:"button",className:"sl-btn","aria-pressed":t,disabled:r.isPending,onClick:()=>r.mutate(),children:["\u2194 ",s("saucelings.flip.label",{name:e})]})}),r.error&&!r.isPending?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:r.error})}):null]})}function Pr({state:e}){let{t}=X(),n=e.world.activePet;return n?i(Ar,{name:n.stage==="egg"?t("saucelings.egg.name"):n.name,flipped:n.flipped,request:s=>q("/pet","PATCH",{flipped:s})}):null}function _r({state:e,characterId:t,name:n}){return i(Ar,{name:n,flipped:e.world.flippedCaretakers.includes(t),request:s=>q("/caretaker/flip","PATCH",{characterId:t,flipped:s})})}var vr=e=>["saucelings","figure-paint",e];function Or({state:e,characterId:t,name:n,sprites:s}){let{t:a}=X(),r=pe(),[o,l]=F(!1),c=e.world.settings,u=c.portraitConnectionId,p=ft(e.world.caretakerFigures[t]),g=({next:k,image:A,frames:L})=>{let U=k.world.caretakerFigures[t];U&&r.setQueryData(["saucelings","figure",U],{image:A,frames:L}),r.setQueryData(["saucelings","state"],k)},m=ne({mutationKey:vr(t),mutationFn:async()=>{if(!u)throw new Error(a("saucelings.album.needsConnection"));let k=await r.fetchQuery(Wn(t)),A=[k.avatar,Jn(s,"neutral")].filter(w=>!!w),L=(await Promise.all(A.map(w=>Es(w).catch(()=>null)))).filter(w=>w!==null),U=null;for(let w of Qs(n,k.appearance,L,c.threeDrawingFallback)){let E=await pa(u,w.prompt,Gs,wr,w.references);if(U=await ks(E),U)break}if(!U)throw new Error(a("saucelings.figure.failed",{name:n}));return{next:await q("/figure","POST",{characterId:t,image:U.image}),...U}},onSuccess:g}).mutate,h=ne({mutationFn:async()=>{let k=await q("/figure/undo","POST",{characterId:t}),A=k.world.caretakerFigures[t];return A&&await r.prefetchQuery({queryKey:["saucelings","figure",A],queryFn:()=>q(`/figure/${encodeURIComponent(A)}`),staleTime:1/0}),k},onSuccess:k=>r.setQueryData(["saucelings","state"],k)}),{pending:v,error:y}=Cr(vr(t));if(!c.portraitEnabled)return null;let d=!!e.world.caretakerFigures[t],b=!!(d&&e.world.savedFigures[t]);if(!u&&!b)return null;let T=v||h.isPending;return i(ie,{children:f("div",{className:"sl-about-row",children:[o?f(ie,{children:[i("span",{className:"sl-care-note",children:a("saucelings.figure.confirmNote",{name:n})}),i("button",{type:"button",className:"sl-btn",onClick:()=>{l(!1),m()},children:a("saucelings.figure.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>l(!1),children:a("saucelings.common.cancel")})]}):f(ie,{children:[v?i("button",{type:"button",className:"sl-btn",disabled:!0,children:a("saucelings.form.painting")}):u?i(Ee,{text:a("saucelings.figure.hint"),label:a("saucelings.help.label",{action:d?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:T,onClick:()=>l(!0),children:["\u{1F3A8} ",d?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})]})}):null,b?i(Ee,{text:a("saucelings.figure.undoHint"),label:a("saucelings.help.label",{action:a("saucelings.figure.undoRepaint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:T,onClick:()=>h.mutate(),children:["\u21B6 ",a("saucelings.figure.undoRepaint",{name:n})]})}):null,i("span",{className:"sl-care-note",role:"status",children:v?a("saucelings.form.paintingNote"):p?.frames===3?a("saucelings.figure.threePoses",{name:n}):null})]}),y&&!v?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:y})}):null,h.error&&!h.isPending?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:h.error})}):null]})})}function Fr({keepsake:e,assetUrl:t,large:n=!1}){let{t:s}=X(),{backgroundId:a}=e,r=ce({queryKey:["saucelings","background",a],queryFn:()=>q(`/background/${encodeURIComponent(a??"")}`),enabled:a!==null,staleTime:1/0}),o=a?r.data?.image??null:t(bt({species:e.species,stage:e.stage})),c=[{art:{...e.art,evolution:{...e.art.evolution,look:null}},label:s("saucelings.album.before")},{art:e.art,label:s("saucelings.album.after")}];return f("span",{className:`sl-keepsake${n?" sl-keepsake--large":""}`,children:[o?i("img",{className:`sl-stage-bg ${a?"":"sl-stage-bg--pixel"}`,src:o,alt:""}):null,c.map(u=>f("span",{className:"sl-keepsake-side",children:[i(Ae,{art:u.art,species:e.species,stage:e.stage,mood:"happy",assetUrl:t,alt:"",scale:n?2:1,still:!0,frontOnly:!0}),n?i("span",{className:"sl-keepsake-label",children:u.label}):null]},u.label))]})}function Lr({id:e,className:t,alt:n}){let{t:s}=X(),a=ce({queryKey:["saucelings","portrait",e],queryFn:()=>q(`/portrait/${encodeURIComponent(e)}`),staleTime:1/0});return a.data?i("img",{className:t,src:a.data.image,alt:n}):i("span",{className:`${t} sl-gallery-blank`,children:a.isError?s("saucelings.album.missing"):null})}function $r({state:e,packageId:t,packageVersion:n}){let{t:s}=X(),a=C=>Qe(t,C,n),r=pe(),o=e.world.activePet,l=e.world.settings,[c,u]=F(null),[p,g]=F(null),[m,h]=F(!1),[v,y]=F(!1),[d,b]=F(""),T=Q(null);V(()=>{(c||p)&&T.current?.focus()},[c,p]);let k=ce({queryKey:["saucelings","portraits"],queryFn:()=>q("/portraits"),refetchOnMount:"always"}),A=k.data?.portraits??[],L=ce({queryKey:["saucelings","menagerie"],queryFn:()=>q("/menagerie"),enabled:e.menagerieCount>0}),U=[];if(o?.evolution.look&&o.stage!=="egg"){let C=rt(o).stage;U.push({petId:o.id,name:o.name,home:"nook",art:o,species:o.species,stage:C==="egg"?"hatchling":C,backgroundId:o.backgroundId,form:o.evolution.look.form,at:o.evolution.at})}for(let C of L.data?.menagerie??[]){let z=C.reachedElder?"elder":C.lockedStage??C.stageAtRetirement;!C.evolution.look||z==="egg"||U.push({petId:C.id,name:C.name,home:"menagerie",art:C,species:C.species,stage:z,backgroundId:C.backgroundId,form:C.evolution.look.form,at:C.evolution.at})}let x=C=>{r.setQueryData(["saucelings","state"],C),r.invalidateQueries({queryKey:["saucelings","portraits"]})},w=ne({mutationFn:async C=>{if(!l.portraitConnectionId)throw new Error(s("saucelings.album.needsConnection"));let z=rt(C).stage,S=C.forms[z],I=$e(C.species,z,"content"),D=S?r.fetchQuery(St(S,!0)).then(te=>nt(te.image)):C.design?null:nt(a(I.path),I.row),H=D?await D.catch(()=>null):null,G=v?d.replace(/\s+/gu," ").trim():"",j=Vs(C,H!==null,G),ee=await Re("/api/characters/avatar-generation","POST",{connectionId:l.portraitConnectionId,name:"sauceling-portrait",appearance:j,promptOverrides:[{id:"avatar:sauceling-portrait",prompt:j,negativePrompt:Ds(G)}],styleProfileId:"off",...H?{referenceImages:[H]}:{}}),re=await Cs(ee.image).catch(()=>ee.image);return q("/portrait","POST",{petId:C.id,image:re,instructions:G})},onSuccess:x}),E=ne({mutationFn:C=>q(`/portrait/${encodeURIComponent(C)}/delete`,"POST",{}),onSuccess:C=>{u(null),h(!1),x(C)}}),O=new Map;for(let C of A){let z=O.get(C.petId)??{petId:C.petId,name:C.petName,home:C.home,keepsake:null,paintings:[]};z.paintings.push(C),O.set(C.petId,z)}for(let C of U){let z=O.get(C.petId);z?z.keepsake=C:O.set(C.petId,{petId:C.petId,name:C.name,home:C.home,keepsake:C,paintings:[]})}let B=[...O.values()].sort((C,z)=>+(z.home==="nook")-+(C.home==="nook")),R=A.find(C=>C.id===c)??null,N=U.find(C=>C.petId===p)??null,M=w.error??E.error??k.error,P=l.portraitEnabled?o?o.stage==="egg"?s("saucelings.album.egg"):e.portraitCount>=Bn?s("saucelings.album.full",{limit:Bn}):null:s("saucelings.album.noPet"):s("saucelings.album.off");return f("div",{style:{display:"grid",gap:"1rem"},children:[f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem",justifyItems:"start"},children:[P||!o?i("span",{style:{fontSize:"0.85rem",opacity:.8},children:P}):f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:w.isPending,onClick:()=>w.mutate(o),children:w.isPending?s("saucelings.album.painting"):`\u{1F3A8} ${s("saucelings.album.paint",{name:o.name})}`}),i("button",{type:"button",className:"sl-link",disabled:w.isPending,onClick:()=>y(!v),children:s(v?"saucelings.album.removeInstructions":"saucelings.album.addInstructions")}),v?f("div",{style:{display:"grid",gap:"0.3rem",width:"100%"},children:[i("label",{className:"sl-picker-label",htmlFor:"sl-paint-instructions",children:s("saucelings.album.instructionsLabel")}),i("textarea",{id:"sl-paint-instructions",className:"sl-input sl-picker-prompt",rows:2,maxLength:Wa,placeholder:s("saucelings.album.instructionsPlaceholder"),disabled:w.isPending,value:d,onChange:C=>b(C.target.value)}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:s("saucelings.album.instructionsNote")})]}):null]}),M?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:M})}):null,o&&!P?i(Rn,{state:e,assetUrl:a}):null]}),N?f("div",{className:"sl-card sl-viewer",ref:T,tabIndex:-1,children:[i(Fr,{keepsake:N,assetUrl:a,large:!0}),i("div",{style:{fontSize:"0.85rem"},children:s("saucelings.album.keepsakeCaption",{name:N.name,form:N.form,date:N.at?new Date(N.at).toLocaleDateString():""})}),i("div",{style:{fontSize:"0.8rem",opacity:.75},children:s("saucelings.album.keepsakeNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:s("saucelings.album.close")})]}):null,R?f("div",{className:"sl-card sl-viewer",ref:T,tabIndex:-1,children:[i(Lr,{id:R.id,className:"sl-viewer-image",alt:s("saucelings.album.alt",{name:R.petName})}),f("div",{style:{fontSize:"0.85rem"},children:[i("strong",{children:R.petName})," ",i("span",{style:{opacity:.75},children:s("saucelings.album.caption",{stage:s(`saucelings.stage.${R.stage}`),date:new Date(R.savedAt).toLocaleDateString()})}),R.instructions?i("div",{style:{fontStyle:"italic",opacity:.75},children:s("saucelings.album.instructionsCaption",{instructions:R.instructions})}):null]}),i("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem"},children:m?f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:E.isPending,onClick:()=>E.mutate(R.id),children:s("saucelings.album.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>h(!1),children:s("saucelings.common.cancel")})]}):f(ie,{children:[i("button",{type:"button",className:"sl-btn",onClick:()=>h(!0),children:s("saucelings.album.delete")}),i("button",{type:"button",className:"sl-btn",onClick:()=>u(null),children:s("saucelings.album.close")})]})})]}):null,k.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.loading")}):B.length===0?f("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:[s("saucelings.album.empty"),o&&!P?` ${s("saucelings.album.emptyHint")}`:null]}):B.map(C=>f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem"},children:[f("div",{style:{fontSize:"0.9rem"},children:[i("strong",{children:C.name})," ",i("span",{style:{opacity:.7},children:C.home==="menagerie"?s("saucelings.album.inMenagerie"):C.home==="released"?s("saucelings.album.released"):""})]}),f("div",{className:"sl-gallery",children:[C.keepsake?i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.keepsakeLabel",{name:C.name}),"aria-pressed":C.petId===p,onClick:()=>{u(null),g(C.petId)},children:i(Fr,{keepsake:C.keepsake,assetUrl:a})}):null,C.paintings.map(z=>i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.alt",{name:z.petName}),"aria-pressed":z.id===c,onClick:()=>{h(!1),g(null),u(z.id)},children:i(Lr,{id:z.id,className:"sl-gallery-image",alt:""})},z.id))]})]},C.petId))]})}var Hr="saucelings-journal-seen";function Zi(){try{return localStorage.getItem(Hr)}catch{return null}}function el(e){let t=[];for(let n of e){let s=new Date(n.createdAt),a=s.toDateString(),r=t[t.length-1];r?.key===a?r.events.push(n):t.push({key:a,at:s,events:[n]})}return t}function Ur({state:e,onOpenNook:t}){let{t:n}=X(),s=e.world.activePet,a=s?.journal??[],r=a[0]?.createdAt??null,[o]=F(Zi);V(()=>{if(r)try{localStorage.setItem(Hr,r)}catch{}},[r]);let l=o?a.filter(p=>p.createdAt>o).length:0;if(!s||a.length===0)return f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem",justifyItems:"center",padding:"2rem"},children:[i("span",{style:{opacity:.75},children:s?n("saucelings.journal.empty",{name:s.name}):n("saucelings.empty.title")}),s?null:i("button",{type:"button",className:"sl-btn",onClick:t,children:n("saucelings.journal.toNook")})]});let c=new Date().toDateString(),u=new Date(Date.now()-864e5).toDateString();return f("div",{style:{display:"grid",gap:"0.65rem"},children:[l>0?i("p",{role:"status",style:{margin:0,fontSize:"0.8rem",fontWeight:600},children:n("saucelings.journal.new",{count:l})}):null,el(a).map(p=>f("section",{style:{display:"grid",gap:"0.65rem"},children:[i("h3",{style:{margin:"0.35rem 0 0",fontSize:"0.8rem",fontWeight:600,opacity:.75},children:p.key===c?n("saucelings.journal.today"):p.key===u?n("saucelings.journal.yesterday"):p.at.toLocaleDateString()}),p.events.map(g=>f("div",{className:"sl-card",style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"1rem"},children:[f("div",{style:{display:"grid",gap:"0.25rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.72rem",opacity:.7},children:[i("span",{style:{textTransform:"uppercase",fontWeight:600},children:n(`saucelings.event.${g.kind}`)}),g.generated?i("span",{className:"sl-pill sl-pill--ai",children:n("saucelings.journal.generated")}):null]}),f("p",{style:{margin:0,fontSize:"0.875rem",lineHeight:1.45},children:[g.speaker?i("strong",{children:n("saucelings.journal.speaker",{name:g.speaker})}):null,g.speaker?" ":null,g.text]})]}),i("time",{dateTime:g.createdAt,title:new Date(g.createdAt).toLocaleString(),style:{fontSize:"0.72rem",opacity:.6,whiteSpace:"nowrap"},children:new Date(g.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})})]},g.id))]},p.key))]})}function fa(e){return e.design?null:Ga.includes(e.species)?"special":Ka.includes(e.species)?"halloween":null}var tl={special:{rows:["....K....","...KYK...","KKKKYKKKK","KYYYWYYYK",".KYYYYYK.","..KYYYK..",".KYYKYYK.",".KYK.KYK.",".KK...KK."],colours:{K:"#4a2c0a",Y:"#ffd84a",W:"#fff6c2"}},halloween:{rows:[".....gg..","....gG...",".KKKgKKK.","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK",".KOOOOOK.","..KKKKK.."],colours:{K:"#5a2008",O:"#ff8a28",o:"#c95212",g:"#2f5e1e",G:"#7fd35a"}}},nl=Object.fromEntries(Object.entries(tl).map(([e,{rows:t,colours:n}])=>[e,t.flatMap((s,a)=>[...s.matchAll(/([^.])\1*/gu)].map(r=>({x:r.index,y:a,w:r[0].length,fill:n[r[1]]})))]));function Kt({pet:e,labelled:t=!0}){let{t:n}=X(),s=fa(e);return s?i("svg",{className:"sl-rare-mark",viewBox:"0 0 9 9",width:"18",height:"18",shapeRendering:"crispEdges",...t?{role:"img","aria-label":n(`saucelings.pet.rare.${s}`)}:{"aria-hidden":!0},children:nl[s].map(a=>i("rect",{x:a.x,y:a.y,width:a.w,height:1,fill:a.fill},`${a.x},${a.y}`))}):null}function Dr(e){let t=ze(e)?.sauce;return t?{"--sl-sauce-accent":t.accentColor,"--sl-sauce-bg":t.badgeBg}:{}}function Br({state:e,packageId:t,packageVersion:n,onRestored:s}){let{t:a}=X(),r=M=>Qe(t,M,n),o=pe(),l=ce({queryKey:["saucelings","menagerie"],queryFn:()=>q("/menagerie"),refetchOnMount:"always"}),c=l.data?.menagerie??[],u=e.world.activePet,p=u?u.stage==="egg"?a("saucelings.menagerie.activeEgg"):u.name:"",[g,m]=F({}),[h,v]=F({}),y=M=>h[M.id]??(M.farewellScene?M.caretakerId:e.characters.find(P=>P.id===M.foundBy)?.id??""),[d,b]=F(null),[T,k]=F(null),A=Q(null),L=Q(new Map),U=Q(null);V(()=>{d?A.current?.focus():U.current&&L.current.get(U.current)?.focus(),U.current=null},[d]);let x=ne({mutationFn:M=>q(`/menagerie/${encodeURIComponent(M.id)}/restore`,"POST",{stage:M.stage,swap:M.swap,caretakerId:M.caretakerId}),onSuccess:(M,P)=>{k(null),o.setQueryData(["saucelings","state"],M),s(P.caretakerId)}}),w=ne({mutationFn:M=>q(`/menagerie/${encodeURIComponent(M)}/release`,"POST",{}),onSuccess:M=>{k(null),b(null),o.setQueryData(["saucelings","state"],M),o.invalidateQueries({queryKey:["saucelings","menagerie"]}),o.invalidateQueries({queryKey:["saucelings","portraits"]})}}),E=x.error??w.error??l.error,O=x.isPending||w.isPending,B=c.find(M=>M.id===d)??null,R=M=>{k(null),b(M)},N=()=>{U.current=d,k(null),b(null)};return l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.loading")}):c.length===0&&!E?f("div",{className:"sl-card",style:{display:"grid",gap:"0.5rem",textAlign:"center",padding:"2.5rem"},children:[i("span",{style:{opacity:.75},children:a("saucelings.menagerie.empty")}),i("span",{style:{fontSize:"0.8rem",opacity:.65},children:a("saucelings.menagerie.emptyHow")})]}):f("div",{style:{display:"grid",gap:"1rem"},children:[E?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(ge,{error:E})}):null,B?i(al,{entry:B,cardRef:A,assetUrl:r,chosenStage:g[B.id]??"elder",onPickStage:M=>m(P=>({...P,[B.id]:M})),characters:e.characters,caretakerId:y(B),onPickCaretaker:M=>v(P=>({...P,[B.id]:M})),activeName:p,hasActivePet:!!u,confirming:T,setConfirming:k,pending:O,onRestore:(M,P)=>x.mutate({id:B.id,stage:M,swap:P,caretakerId:y(B)}),onRelease:()=>w.mutate(B.id),onClose:N},B.id):null,Ps(c).map(M=>f("section",{className:"sl-menagerie-section",children:[f("h3",{className:"sl-menagerie-heading",children:[a(`saucelings.menagerie.section.${M.stage}`),i("span",{className:"sl-menagerie-count",children:M.entries.length})]}),i("div",{className:"sl-gallery sl-gallery--pets",children:M.entries.map(P=>{let C=P.stageAtRetirement==="egg",z=C?a("saucelings.egg.name"):P.name,S=C?null:fa(P);return f("button",{ref:I=>{I?L.current.set(P.id,I):L.current.delete(P.id)},type:"button",className:"sl-gallery-tile",style:Dr(P),"aria-label":S?`${z}, ${a(`saucelings.pet.rare.${S}`)}`:z,"aria-pressed":P.id===d,onClick:()=>R(P.id),children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:P,species:P.species,stage:P.reachedElder?g[P.id]??"elder":P.lockedStage??P.stageAtRetirement,mood:"happy",assetUrl:r,alt:"",scale:2,still:!0,frontOnly:!0})}),C?null:f("span",{className:"sl-pet-tile-name",children:[i(Kt,{pet:P,labelled:!1}),P.name]})]},P.id)})})]},M.stage))]})}function al({entry:e,cardRef:t,assetUrl:n,chosenStage:s,onPickStage:a,characters:r,caretakerId:o,onPickCaretaker:l,activeName:c,hasActivePet:u,confirming:p,setConfirming:g,pending:m,onRestore:h,onRelease:v,onClose:y}){let{t:d}=X(),[b,T]=F(!1),k=Q(null),A=Xe(e),L=e.stageAtRetirement==="egg",U=L?d("saucelings.egg.name"):e.name,x=L?d("saucelings.menagerie.thisEgg"):e.name,w=ze(e),E=e.reachedElder?s:e.lockedStage??e.stageAtRetirement,O=R=>h(e.reachedElder?s:void 0,R),B=r.length>0?r.map(R=>({id:R.id,name:R.name})):[{id:"caretaker",name:d("saucelings.empty.houseCaretaker")}];return e.farewellScene&&!B.some(R=>R.id===e.caretakerId)&&B.unshift({id:e.caretakerId,name:e.careProfile.characterName}),f("div",{ref:t,tabIndex:-1,className:"sl-card sl-viewer",style:{display:"grid",gap:"0.75rem",justifyItems:"stretch",...Dr(e)},children:[f("div",{style:{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"},children:[i("div",{className:"sl-sprite-stage",style:{width:"7.5rem",height:"7.5rem"},children:i(Ae,{art:e,species:e.species,stage:E,mood:"happy",assetUrl:n,alt:U,scale:2,still:!0,frontOnly:!0})}),f("div",{style:{flex:"1 1 16rem",display:"grid",gap:"0.35rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"1.1rem"},children:U}),L?null:i(Kt,{pet:e}),L||!w?null:i("span",{className:"sl-badge",title:w.readsAs,children:w.sauce?d("saucelings.pet.sauce",{sauce:w.name}):d("saucelings.pet.temperament",{temperament:w.name})}),i("span",{className:"sl-badge",children:d("saucelings.menagerie.foundBy",{name:e.finder.name})}),!L&&e.evolution?.at?i("span",{className:"sl-badge",children:d("saucelings.menagerie.evolved")}):null,f("span",{style:{fontSize:"0.8rem",opacity:.75},children:[L?"":`${A.name} \xB7 `,e.farewellScene?d("saucelings.menagerie.retiredAs",{stage:d(`saucelings.stage.${e.stageAtRetirement}`),name:e.careProfile.characterName}):""]})]}),e.farewellScene?i("p",{style:{margin:0,fontSize:"0.825rem",opacity:.85},children:e.farewellScene}):null,L&&e.design?i(Ir,{petId:e.id}):null]})]}),f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem",flexWrap:"wrap"},children:[i("span",{children:d("saucelings.menagerie.lookedAfterBy")}),f("select",{ref:k,className:"sl-select",value:o,disabled:m,onChange:R=>l(R.target.value),children:[o?null:i("option",{value:"",disabled:!0,children:d("saucelings.menagerie.chooseCaretaker")}),B.map(R=>i("option",{value:R.id,children:R.name},R.id))]}),b&&!o?i("span",{className:"sl-care-note",role:"status",children:d("saucelings.menagerie.chooseFirst")}):null]}),f("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem",borderTop:"1px solid var(--border, rgba(255,255,255,0.08))",paddingTop:"0.65rem"},children:[p?f(ie,{children:[i("span",{style:{fontSize:"0.8rem"},children:p==="release"?L?d("saucelings.menagerie.releaseNoteEgg"):d("saucelings.menagerie.releaseNote",{name:e.name}):d("saucelings.menagerie.swapNote",{name:x,active:c})}),f("div",{style:{display:"flex",gap:"0.5rem"},children:[p==="release"?i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:m,onClick:v,children:d("saucelings.menagerie.releaseConfirm")}):i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m||!o,onClick:()=>O(!0),children:d("saucelings.menagerie.swapConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(null),children:d("saucelings.common.cancel")})]})]}):e.reachedElder?i(Ee,{text:d("saucelings.menagerie.lockStageHelp"),label:d("saucelings.help.label",{action:d("saucelings.menagerie.lockStage")}),children:f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem"},children:[i("span",{children:d("saucelings.menagerie.lockStage")}),i("select",{className:"sl-select",value:s,onChange:R=>a(R.target.value),children:Va.map(R=>i("option",{value:R,children:d(`saucelings.stage.${R}`)},R))})]})}):e.farewellScene?null:f("span",{style:{fontSize:"0.75rem",opacity:.7},children:[d("saucelings.menagerie.returnsAt")," ",i("strong",{children:d(`saucelings.stage.${e.stageAtRetirement}`)})]}),p?null:f("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginLeft:"auto"},children:[i("button",{type:"button",className:"sl-btn",onClick:y,children:d("saucelings.menagerie.close")}),i("button",{type:"button",className:"sl-btn",disabled:m,onClick:()=>g("release"),children:d("saucelings.menagerie.release")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m,"aria-disabled":!o||void 0,onClick:()=>{o?u?g("swap"):O(!1):(T(!0),k.current?.focus())},children:d("saucelings.menagerie.bringBack")})]})]})]})}var Gr=1280,Kr=720,sl=20*1024*1024;async function zr(e){let t=await Le(e),n=Math.min(t.naturalWidth,t.naturalHeight*16/9),s=n*9/16,a=document.createElement("canvas");a.width=Math.min(Gr,Math.round(n)),a.height=Math.min(Kr,Math.round(a.width*9/16));let r=a.getContext("2d");if(!r)throw new Error("This browser cannot resize pictures.");r.imageSmoothingQuality="high",r.drawImage(t,(t.naturalWidth-n)/2,(t.naturalHeight-s)/2,n,s,0,0,a.width,a.height);let o=a.toDataURL("image/webp",.85);return o.startsWith("data:image/webp")?o:a.toDataURL("image/jpeg",.88)}function rl({id:e}){let{t}=X(),n=ce({queryKey:["saucelings","background",e],queryFn:()=>q(`/background/${encodeURIComponent(e)}`),staleTime:1/0});return n.data?i("img",{className:"sl-gallery-image",src:n.data.image,alt:""}):i("span",{className:"sl-gallery-image sl-gallery-blank",children:n.isError?t("saucelings.background.missing"):null})}function qr({pet:e,settings:t,assetUrl:n,onClose:s}){let{t:a}=X(),r=pe(),o=Q(null),[l,c]=F(()=>ta(e)),[u,p]=F(null),g=ce({queryKey:["saucelings","backgrounds"],queryFn:()=>q("/backgrounds"),refetchOnMount:"always"}),m=g.data?.backgrounds??[],h=m.length>=Dn,v=w=>w.label||a("saucelings.background.earlier"),y=w=>{r.setQueryData(["saucelings","state"],w),r.invalidateQueries({queryKey:["saucelings","backgrounds"]})},d=ne({mutationFn:async w=>{if(w.size>sl)throw new Error(a("saucelings.background.tooBig"));let E=URL.createObjectURL(w);try{let O=await zr(E),B=w.name.replace(/\.[^.]+$/u,"").slice(0,120);return await q("/background","POST",{image:O,label:B,source:"upload"})}finally{URL.revokeObjectURL(E)}},onSuccess:y}),b=ne({mutationFn:async()=>{if(!t.portraitConnectionId)throw new Error(a("saucelings.background.noConnection"));let w=Js(l),E=await Re("/api/characters/avatar-generation","POST",{connectionId:t.portraitConnectionId,name:"sauceling-background",appearance:w,width:Gr,height:Kr,styleProfileId:"off",promptOverrides:[{id:"avatar:sauceling-background",prompt:w,negativePrompt:Ks}]}),O=await zr(E.image);return q("/background","POST",{image:O,label:l.trim().slice(0,120),source:"generated"})},onSuccess:y}),T=ne({mutationFn:()=>q("/background/suggest","POST",{}),onSuccess:({scene:w})=>c(w??ta(e))}),k=ne({mutationFn:w=>q(w?`/background/${encodeURIComponent(w)}/select`:"/background/clear","POST",{}),onSuccess:y}),A=ne({mutationFn:w=>q(`/background/${encodeURIComponent(w)}/delete`,"POST",{}),onSuccess:w=>{p(null),y(w)}}),L=d.isPending||b.isPending||T.isPending||k.isPending||A.isPending,U=d.error??b.error??T.error??k.error??A.error??g.error,x=t.portraitEnabled?t.portraitConnectionId?null:a("saucelings.background.noConnection"):a("saucelings.background.off");return f("section",{className:"sl-card sl-picker","aria-label":a("saucelings.background.title"),children:[i("strong",{children:a("saucelings.background.title")}),f("div",{className:"sl-gallery sl-gallery--wide",role:"group","aria-label":a("saucelings.background.library"),children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.useBuiltIn"),title:a("saucelings.background.useBuiltIn"),"aria-pressed":e.backgroundId===null,disabled:L,onClick:()=>e.backgroundId!==null&&k.mutate(null),children:i("img",{className:"sl-gallery-image sl-stage-bg--pixel",src:n(bt(e)),alt:""})}),m.map(w=>f("div",{className:"sl-gallery-item",children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.tileAlt",{label:v(w)}),title:v(w),"aria-pressed":e.backgroundId===w.id,disabled:L,onClick:()=>e.backgroundId!==w.id&&k.mutate(w.id),children:i(rl,{id:w.id})}),i("button",{type:"button",className:"sl-gallery-remove","aria-label":a("saucelings.background.delete",{label:v(w)}),title:a("saucelings.background.delete",{label:v(w)}),disabled:L,onClick:()=>p(w),children:"\xD7"})]},w.id))]}),i("span",{className:"sl-box-note",children:a("saucelings.background.sharedNote")}),u?f("div",{className:"sl-picker-row",role:"group","aria-label":a("saucelings.background.delete",{label:v(u)}),children:[i("span",{className:"sl-box-note",children:a("saucelings.background.deleteNote",{label:v(u)})}),i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:L,onClick:()=>A.mutate(u.id),children:a("saucelings.background.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>p(null),children:a("saucelings.common.cancel")})]}):null,f("div",{className:"sl-picker-row",children:[i("input",{ref:o,type:"file",className:"sl-sr-only",accept:"image/png,image/jpeg,image/webp",tabIndex:-1,onChange:w=>{let E=w.target.files?.[0];w.target.value="",E&&d.mutate(E)}}),i("button",{type:"button",className:"sl-btn",disabled:L||h,onClick:()=>o.current?.click(),children:d.isPending?a("saucelings.background.uploading"):`\u2B06 ${a("saucelings.background.upload")}`}),i("button",{type:"button",className:"sl-btn",onClick:s,children:a("saucelings.album.close")}),h?i("span",{className:"sl-box-note",children:a("saucelings.background.full",{limit:Dn})}):null]}),i("label",{className:"sl-picker-label",htmlFor:"sl-background-prompt",children:a("saucelings.background.promptLabel")}),i("textarea",{id:"sl-background-prompt",className:"sl-input sl-picker-prompt",rows:3,maxLength:600,value:l,onChange:w=>{c(w.target.value),T.reset()}}),f("div",{className:"sl-picker-row",children:[i("button",{type:"button",className:"sl-btn",disabled:L||x!==null,onClick:()=>T.mutate(),children:T.isPending?a("saucelings.background.suggesting"):`\u270D ${e.stage==="egg"?a("saucelings.background.suggestEgg"):a("saucelings.background.suggest",{name:e.name})}`}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:L||h||x!==null||!l.trim(),onClick:()=>b.mutate(),children:b.isPending?a("saucelings.background.generating"):`\u2728 ${a("saucelings.background.generate")}`}),x?i("span",{className:"sl-box-note",children:x}):null,T.data?.scene===null?i("span",{className:"sl-box-note",children:a("saucelings.background.suggestPlain")}):null]}),U?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:U})}):null]})}function ha(e,t=e*9/16){let n=Math.round(Math.max(e/176,t/99));return n>=4?4:n<=2?2:3}var ba=["rigamuffin","fluttino","burrowl"],ol=["shellbini","lentino","puddlepip"],Vr=["fluttino","wickwisp"],il={grumpy:6,content:10,happy:14};function ll(e){return e>=22||e<7}function cl(e,t,n,s=!1){let a=ba.includes(t)?2:1,r=ol.includes(t)?3:1;if(e==="grumpy")return{wander:2,idle:3,look:1,hop:0,hum:0,nap:0,huff:3,signature:0};if(e==="happy")return{wander:4,idle:3,look:a,hop:1,hum:r,nap:0,huff:0,signature:s?1:0};let o=ll(n)?4:1;return{wander:4,idle:3,look:a,hop:0,hum:r,nap:o,huff:0,signature:s?.5:0}}function jr(e,t,n,s,a=!1){let r=cl(e,t,n,a),o=Object.keys(r).filter(u=>r[u]>0),l=o.reduce((u,p)=>u+r[p],0),c=Math.min(Math.max(s,0),.999999)*l;for(let u of o)if(c-=r[u],c<0)return u;return o[o.length-1]}function ya(e,t,n){return e==="huff"?"grumpy":e==="hop"||e==="hum"||e==="signature"?t==="grumpy"?null:"happy":e!=="idle"?null:t==="happy"?n<.6?"happy":null:t==="content"?n<.25?"happy":null:n<.3?"content":null}function Nn(e,t,n){return t==="rest"?"content":t?e==="grumpy"?"content":"happy":n??(e==="happy"?"content":e)}function qt(e){return{min:-6,max:Math.max(-6,Math.floor(e)-52+6)}}function ot(e,t){let{min:n,max:s}=qt(t);return Math.round(Math.min(Math.max(e,n),s))}var ul=.3;function Qr(e,t){return t?Math.floor(e*(1-ul)):e}function va(e){return ot((e-52)/2,e)}function Wr(e,t){return Math.max(200,Math.round(Math.abs(e)/il[t]*1e3))}var gl=48,dl=1e3;function Yr(e){return Math.min(dl,Math.max(200,Math.round(Math.abs(e)/gl*1e3)))}var Mn=(e,t)=>e+Math.random()*(t-e);function Pe(){if(typeof document>"u")return!0;let e=document.documentElement;return e.dataset.marinaraReducedEffects==="true"||e.dataset.marinaraEffectsPaused==="true"||document.hidden||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Xr({stageArtWidth:e,mood:t,species:n,enabled:s,busy:a,paused:r=!1,move:o=null,measureX:l}){let[c,u]=F(()=>({x:va(e),facing:"right",pose:null,cue:null,moveMs:0,steps:1,face:null,act:null})),p=s&&!a&&!r&&e>0,g=Q({actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p});g.current={actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p};let m=Q([]),h=Q(null),v=me(N=>u(M=>({...M,...N})),[]),y=me((N,M)=>{m.current.push(window.setTimeout(M,N))},[]),d=me(()=>{for(let M of m.current)window.clearTimeout(M);m.current=[];let N=h.current;h.current=null,N?.()},[]),b=me(()=>{let N=g.current.measureX(),M=g.current.stageArtWidth;u(P=>({...P,x:N===null||M<=0?P.x:ot(N,M),moveMs:0,steps:1,pose:null,cue:null,face:null,act:null}))},[]),T=Q(()=>{}),k=me(()=>y(Mn(2500,7e3),()=>T.current()),[y]),A=me((N,M,P=!1)=>{let{actor:C,mood:z}=g.current,S=ot(N,g.current.stageArtWidth),I=S-C.x;if(Math.abs(I)<4)return M();let D=P?Yr(I):Wr(I,z);v({x:S,facing:I>0?"right":"left",pose:"walk",moveMs:D,steps:Math.abs(I)}),y(D+60,()=>{v({pose:null,moveMs:0,steps:1}),M()})},[y,v]),L=me((N,M,P,C,z)=>{let{actor:S,stageArtWidth:I}=g.current,D=ot(g.current.measureX()??S.x,I),H=z!==void 0||Math.random()<1/8,G=cr(N)?P??(D+52/2<=I/2?"right":"left"):S.facing,j=G==="right"?1:-1,ee=Math.abs(ot(D+j*lr(N,H,!1),I)-D);v({x:D,moveMs:0,steps:1,facing:G,face:M,act:{kind:"move",move:N,encore:H,travel:ee,spot:!1,at:Date.now(),...z?{colour:z}:{}}}),y(Gt(N,H)*Ke,()=>{v({act:null,x:D+j*ee,face:null}),C()})},[y,v]),U=me(()=>{if(Pe())return k();let{actor:N,mood:M,species:P,stageArtWidth:C,move:z}=g.current,S=jr(M,P,new Date().getHours(),Math.random(),!!z),I=ya(S,M,Math.random()),D=Date.now();switch(S){case"wander":{let{min:H,max:G}=qt(C);return A(Mn(H,G),k)}case"idle":return v({face:I}),y(Mn(3e3,6e3),()=>{v({face:null}),k()});case"look":{let H=N.facing;return v({facing:H==="right"?"left":"right",cue:ba.includes(P)?{kind:"question",at:D}:null,face:I}),y(1400,()=>{v({facing:H,cue:null,face:null}),k()})}case"hop":return v({pose:"hop",face:I}),y(700,()=>{v({pose:null,face:null}),k()});case"hum":return v({cue:{kind:"note",at:D},face:I}),y(2200,()=>{v({cue:null,face:null}),k()});case"nap":return v({pose:"nap",cue:{kind:"nap",at:D},face:I}),y(Mn(4e3,6e3),()=>{v({pose:null,cue:null,face:null}),k()});case"huff":return v({pose:"huff",face:I}),y(1300,()=>{v({pose:null,face:null}),k()});case"signature":return z?L(z,I,null,k):k()}},[y,k,v,L,A]);T.current=U,V(()=>{if(p)return k(),()=>{d(),b()}},[p,k,d,b]);let x=Q(!1);V(()=>{if(e<=0)return;let N=!x.current;N&&(x.current=!0),u(M=>{let P=s&&!N?ot(M.x,e):va(e);return P===M.x?M:{...M,x:P,moveMs:0,steps:1}})},[e,s]);let w=me(N=>{if(!s||a||r||Pe())return;d(),b();let M=Date.now(),P=g.current.measureX()??g.current.actor.x,C=N>=P+52/2?"right":"left",{move:z,mood:S}=g.current;if(z&&S==="happy"&&Math.random()<.4)return L(z,"happy",C,k);v({facing:C,pose:"hop",cue:{kind:"bang",at:M}}),y(700,()=>{v({pose:null,cue:null}),A(N-52/2,k)})},[y,k,a,s,r,b,v,L,d,A]),E=me(N=>{d(),b();let M=Pe();v({act:{kind:"moment",reduced:M,at:Date.now()}});let P=()=>{g.current.running&&k()};y((M?ua:ca)*Ke,()=>{v({act:null}),M?P():L(N,"happy",null,P)})},[y,k,b,v,L,d]),O=me((N,M,P,C)=>{d(),b(),v({act:{kind:"hatch",how:N,colour:M,at:Date.now()}});let z=S=>S<P.length?L(P[S],"happy",null,()=>z(S+1),M):C();y(ga*Ke,()=>{v({act:null}),z(0)})},[y,b,v,L,d]),B=me(N=>{if(!s||a||r||h.current||Pe())return;d(),b();let M=()=>{v({facing:N?"right":g.current.actor.facing,pose:"hop",face:ya("hop",g.current.mood,0)}),y(700,()=>{v({pose:null,face:null}),k()})};if(!N)return M();v({facing:"right"}),y(300,()=>A(qt(g.current.stageArtWidth).max,M))},[y,k,a,s,r,b,v,d,A]),R=me(N=>new Promise(M=>{if(!N||!s||a||r||Pe()||g.current.stageArtWidth<=0)return M();d(),b(),h.current=M;let P=0,C=()=>{if(g.current.measureX()!==g.current.actor.x&&P++<8)return y(50,C);h.current=null,M(),k()},z=g.current.actor.facing!=="right";v({facing:"right"}),y(z?250:60,()=>A(qt(g.current.stageArtWidth).max,C,!0))}),[y,k,a,s,r,b,v,d,A]);return{actor:c,poke:w,listen:B,comeOver:R,celebrate:E,hatch:O}}var pl=8,ml=2,fl=44;function Jr({lines:e,fallbackLine:t,caretakerId:n,caretakerName:s,isCharacter:a,meals:r,isEgg:o,writing:l,standing:c,onTyping:u,children:p}){let{t:g}=X(),m=e.slice(0,pl),[h,v]=F(0),y=m[0]?.id;V(()=>v(0),[y]);let d=Math.min(h,Math.max(0,m.length-1)),b=m[d]??null,T=mt(n,a&&!c),k=b&&l.includes(b.id)?g("saucelings.checkIn.pending",{name:b.speaker??s}):b?.text??t,A=m[0]&&!l.includes(m[0].id)?m[0]:null,L=A?`${A.id}:${A.text}`:null,U=Q(L),[x,w]=F(null);V(()=>{!L||L===U.current||(U.current=L,w(Pe()?null:0))},[L]);let E=Array.from(k),O=x!==null&&d===0&&b===A&&x<E.length;V(()=>{if(!O)return;let R=window.setTimeout(()=>w(N=>N===null?null:N+ml),fl);return()=>window.clearTimeout(R)},[O,x]),V(()=>u?.(O),[u,O]);let B=R=>{w(null),v(R)};return f("section",{className:`sl-box sl-box--joined ${c?"sl-box--standing":""}`,"aria-label":g("saucelings.caretaker.says",{name:s}),children:[c?null:i(ht,{box:!0,name:s,src:T}),f("div",{className:"sl-box-plate",children:[i("strong",{children:b?.speaker??s}),r.total>0?i("span",{className:"sl-pill",title:g(o?"saucelings.pet.keptWarmTitle":"saucelings.pet.mealsTitle",{name:s}),children:g(o?"saucelings.pet.keptWarm":"saucelings.pet.meals",r)}):null,b?.generated?i("span",{className:"sl-pill sl-pill--ai",children:g("saucelings.journal.generated")}):null]}),f("p",{className:`sl-box-line ${O?"sl-box-line--typing":""}`,"aria-live":"polite",onClick:()=>w(null),children:[f("span",{className:"sl-box-typed","aria-hidden":"true",children:[i("span",{className:"sl-box-ghost",children:k}),i("span",{children:O?E.slice(0,x).join(""):k})]}),i("span",{className:"sl-sr-only",children:k})]}),b?f("div",{className:"sl-box-nav",children:[m.length>1?f(ie,{children:[i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":g("saucelings.caretaker.previous"),disabled:d>=m.length-1,onClick:()=>B(d+1),children:"\u25C0"}),i("span",{children:g("saucelings.caretaker.position",{index:m.length-d,count:m.length})}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":g("saucelings.caretaker.next"),disabled:d===0,onClick:()=>B(d-1),children:"\u25B6"})]}):null,i("time",{className:"sl-box-time",children:new Date(b.createdAt).toLocaleString()})]}):null,p]})}function Zr({state:e,assetUrl:t}){let{t:n}=X(),[s,a]=F(!1),r=e.world.activePet;return!r||r.stage==="egg"||r.evolution.offer!=="offered"||r.evolution.look?null:f("div",{className:"sl-about-row",children:[f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>a(!0),children:["\u2728 ",n("saucelings.evolve.button")]}),i("span",{className:"sl-care-note",children:n("saucelings.evolve.note",{name:r.name})}),s?i(bl,{pet:r,assetUrl:t,onClose:()=>a(!1)}):null]})}function eo({state:e}){let{t}=X(),n=pe(),s=ne({mutationFn:()=>q("/evolve/undo","POST",{}),onSuccess:r=>n.setQueryData(["saucelings","state"],r)}),a=e.world.activePet;return a?.evolution.look?f("div",{className:"sl-about-row",children:[i(Ee,{text:t("saucelings.evolve.undoNote",{name:a.name}),label:t("saucelings.help.label",{action:t("saucelings.evolve.undo")}),children:f("button",{type:"button",className:"sl-btn",disabled:s.isPending,onClick:()=>s.mutate(),children:["\u21A9 ",t("saucelings.evolve.undo")]})}),s.error&&!s.isPending?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:s.error})}):null]}):null}function hl(e){let[t,n]=F(null),s=e.join(" ");return V(()=>{if(!s)return;let a=Math.max(...s.split(" ").map(l=>Gt(l,!1)))*Ke,r=0,o=l=>{n(l&&!Pe()?Date.now():null),r=window.setTimeout(()=>o(!l),l?a:2100)};return r=window.setTimeout(()=>o(!0),1200),()=>window.clearTimeout(r)},[s]),Zt(()=>s.split(" ").map(a=>t===null?null:{kind:"move",move:a,encore:!1,travel:0,spot:!0,at:t}),[s,t])}function bl({pet:e,assetUrl:t,onClose:n}){let{t:s}=X(),a=pe(),r=Q(null),[o,l]=F(!1),c=e.careProfile.characterName,u=b=>{a.setQueryData(["saucelings","state"],b)},p=ne({mutationFn:()=>q("/evolve/options","POST",{}),onSuccess:u}),g=ne({mutationFn:b=>q("/evolve/choose","POST",{index:b}),onSuccess:b=>{u(b),n()}}),m=ne({mutationFn:()=>q("/evolve/decline","POST",{}),onSuccess:b=>{u(b),n()}}),h=e.evolution.choices,v=hl(h?.map(b=>b.move)??[]),y=p.isPending||g.isPending||m.isPending,d=p.error??g.error??m.error;return V(()=>{let b=r.current;return b&&!b.open&&b.showModal(),b?.focus(),()=>b?.close()},[]),V(()=>{h||p.mutate()},[]),f("dialog",{ref:r,className:"sl-dialog sl-dialog--wide",tabIndex:-1,"aria-labelledby":"sl-evolve-title",onCancel:b=>{b.preventDefault(),o?l(!1):y||n()},children:[i("h2",{id:"sl-evolve-title",children:o?s("saucelings.evolve.declineConfirm",{name:e.name}):s("saucelings.evolve.title",{name:e.name})}),o?f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",autoFocus:!0,onClick:()=>l(!1),children:s("saucelings.common.cancel")}),i("button",{type:"button",className:"sl-btn",disabled:y,onClick:()=>m.mutate(),children:s("saucelings.evolve.decline")})]}):f(ie,{children:[h?i("div",{className:"sl-evolve-choices",children:h.map((b,T)=>f("div",{className:"sl-evolve-choice",children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Ae,{art:{...e,evolution:{...e.evolution,look:b}},species:e.species,stage:e.stage,mood:"happy",act:v[T]??null,facing:e.flipped?"left":"right",flipped:e.flipped,assetUrl:t,alt:"",scale:2})}),i("h3",{children:b.form}),i("p",{children:b.description}),i("p",{className:"sl-evolve-from",children:s("saucelings.evolve.from",{from:b.from})}),i("p",{children:s("saucelings.evolve.move",{move:s(`saucelings.evolve.moves.${b.move}`)})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:y,onClick:()=>g.mutate(T),children:s("saucelings.evolve.become",{form:b.form})})]},b.form))}):i("p",{role:"status",children:p.isPending||!d?s("saucelings.evolve.writing",{caretaker:c,name:e.name}):null}),d&&!y?i("p",{role:"alert",className:"sl-error",children:i(ge,{error:d})}):null,f("div",{className:"sl-dialog-actions",children:[d&&!h&&!y?i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>p.mutate(),children:s("saucelings.error.retry")}):null,i("button",{type:"button",className:"sl-btn",disabled:y,onClick:n,children:s("saucelings.evolve.keep")})]}),f("p",{className:"sl-evolve-decline",children:[i("button",{type:"button",className:"sl-link",disabled:y,onClick:()=>l(!0),children:s("saucelings.evolve.decline")})," ",s("saucelings.evolve.declineNote",{name:e.name})]})]})]})}var to="saucelings-tour-seen";function wa(){try{return localStorage.getItem(to)==="1"}catch{return!1}}function yl(){try{localStorage.setItem(to,"1")}catch{}}function Sa(e){return`/sprites/mari/basic/pose-${e}.webp?v=39c2`}var In=[{title:"saucelings.tour.eggTitle",body:"saucelings.tour.eggBody",target:null,pose:"greet"},{title:"saucelings.tour.metersTitle",body:"saucelings.tour.metersBody",target:"meters",pose:"point-up"},{title:"saucelings.tour.careTitle",body:"saucelings.tour.careBody",target:"care",pose:"point-down"},{title:"saucelings.tour.caretakerTitle",body:"saucelings.tour.caretakerBody",target:"caretaker",pose:"explaining"},{title:"saucelings.tour.aboutTitle",body:"saucelings.tour.aboutBody",target:"about",pose:"point-down"},{title:"saucelings.tour.tabsTitle",body:"saucelings.tour.tabsBody",target:"tabs",pose:"point-up"}],vl={...In[0],title:"saucelings.tour.petTitle",body:"saucelings.tour.petBody"};function no({caretaker:e,hatched:t,onClose:n}){let{t:s}=X(),[a,r]=F(0),[o,l]=F(!0),c=Q(null),u=Jt(),p=a===0&&t?vl:In[a],g=a===In.length-1;return V(yl,[]),V(()=>{let m=c.current?.closest(".sl-shell")??document,h=p.target?[...m.querySelectorAll(`[data-sl-tour="${p.target}"]`)]:[];if(!h.length)return;for(let y of h)y.classList.add("sl-tour-target");let v=window.matchMedia("(prefers-reduced-motion: reduce)").matches;return h[0].scrollIntoView({block:"center",behavior:v?"auto":"smooth"}),()=>h.forEach(y=>y.classList.remove("sl-tour-target"))},[p.target]),f("div",{ref:c,className:"sl-tour",role:"dialog","aria-labelledby":u,onKeyDown:m=>{m.key==="Escape"&&(m.stopPropagation(),n())},children:[o?i("img",{className:"sl-tour-mari",src:Sa(p.pose),alt:"",onError:()=>l(!1)}):null,f("div",{className:"sl-tour-text",children:[i("strong",{id:u,children:s(p.title,{caretaker:e})}),i("p",{children:s(p.body,{caretaker:e})}),f("div",{className:"sl-tour-foot",children:[i("span",{className:"sl-tour-dots","aria-hidden":"true",children:In.map((m,h)=>i("span",{className:h===a?"sl-tour-dot sl-tour-dot--on":"sl-tour-dot"},m.title))}),g?null:i("button",{type:"button",className:"sl-link",onClick:n,children:s("saucelings.tour.skip")}),a>0?i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>r(a-1),children:s("saucelings.tour.back")}):null,i("button",{type:"button",className:"sl-btn sl-btn--small sl-btn--primary",autoFocus:!0,onClick:()=>g?n():r(a+1),children:s(g?"saucelings.tour.done":"saucelings.tour.next")})]})]})]})}var ao=8,wl=10,Sl={x:.5,y:.69},ka=2,so=32,xa=13;function kl(e,t,n){let s=Math.max(e/n.width,t/n.height);return{left:(e-n.width*s)/2,top:(t-n.height*s)/2,width:n.width*s,height:n.height*s}}var xl=22;function El(){let e=Q(null),[t,n]=F({width:0,height:0});return V(()=>{let s=e.current;if(!s||typeof ResizeObserver>"u")return;let a=()=>n(o=>o.width===s.clientWidth&&o.height===s.clientHeight?o:{width:s.clientWidth,height:s.clientHeight});a();let r=new ResizeObserver(a);return r.observe(s),()=>r.disconnect()},[]),[e,t]}function Tn({pet:e,reaction:t,assetUrl:n,backgroundSrc:s,paused:a=!1,caretaker:r=null,caretakerFlipped:o=!1,listenKey:l=null,handle:c,onMoveEgg:u,scaleByWidth:p=!1}){let{t:g}=X(),[m,{width:h,height:v}]=El(),y=Q(null),d=p?ha(h):ha(h,v),b=h/d,T=rt(e),k=e.stage==="egg",A=s!==null,L=me(()=>{let W=m.current,Z=y.current;return!W||!Z?null:Math.round((Z.getBoundingClientRect().left-W.getBoundingClientRect().left)/d)},[d,m]),U=e.design?void 0:gr[e.species],[x,w]=F({id:e.id,isEgg:k}),[E,O]=F(!1);(x.id!==e.id||x.isEgg!==k)&&(w({id:e.id,isEgg:k}),O(x.id===e.id&&!k&&!!U&&!a&&!Pe()));let B=E?null:t;V(()=>{k&&U&&xn(n).catch(()=>{})},[k,U,n]);let R=r!==null,{actor:N,poke:M,listen:P,comeOver:C,celebrate:z,hatch:S}=Xr({stageArtWidth:Qr(b,R),mood:T.mood,species:e.species,enabled:!k,busy:E||t!==null,paused:a,move:e.evolution.look?.move??null,measureX:L}),I=e.evolution.look?.colour??null,D=Q(I);V(()=>{I!==D.current&&(D.current=I,I&&z(lt[I].moves[0]))},[I,z]),je(()=>{E&&U&&S(U.how,U.colour,U.moves,()=>O(!1))},[E,U,S]),Ba(c,()=>({comeOver:()=>C(R)}),[C,R]);let H=Q(l);V(()=>{l!==H.current&&(H.current=l,l&&P(R))},[l,P,R]);let G=W=>{let Z=m.current;Z&&M((W.clientX-Z.getBoundingClientRect().left)/d)},[j,ee]=F({width:16,height:9}),[re,te]=F(null),fe=e.eggSpot?.backgroundId===(A?e.backgroundId:null)?e.eggSpot:null,ue=k?re??fe??(A?null:Sl):null,he=kl(h,v,j),ke=v/d,we=k&&u!==void 0&&h>0,J=(W,Z)=>{let be=(52/2-xa)*d,xe=Math.min(h-be,Math.max(be,W)),Oe=Math.min(v,Math.max(so*d,Z));return{x:(xe-he.left)/he.width,y:(Oe-he.top)/he.height}},le=W=>({px:he.left+W.x*he.width,py:he.top+W.y*he.height}),ae=Q(void 0),ve=Q(null);V(()=>()=>{window.clearTimeout(ae.current),ve.current&&u?.(ve.current).catch(()=>{})},[]);let _e=(W,Z)=>{te(W),ve.current=W,window.clearTimeout(ae.current),ae.current=window.setTimeout(()=>{ve.current=null,u?.(W).catch(()=>{}).finally(()=>te(be=>be===W?null:be))},Z)},He=Q(null),Ue=W=>{let Z=m.current?.getBoundingClientRect();return Z?{px:W.clientX-Z.left,py:W.clientY-Z.top}:null},kt=we?{onPointerDown:W=>{let Z=Ue(W);if(!Z||!ue||W.button!==0)return;W.stopPropagation(),W.currentTarget.setPointerCapture(W.pointerId);let be=le(ue);He.current={pointer:W.pointerId,dx:Z.px-be.px,dy:Z.py-be.py,to:null}},onPointerMove:W=>{let Z=He.current,be=Ue(W);if(!Z||Z.pointer!==W.pointerId||!be)return;let xe=J(be.px-Z.dx,be.py-Z.dy),Oe=le(ue??xe),Ve=le(xe);!Z.to&&Math.hypot(Ve.px-Oe.px,Ve.py-Oe.py)<4||(Z.to=xe,te(xe))},onPointerUp:W=>{let Z=He.current;He.current=null,Z?.to&&_e(Z.to,0),W.stopPropagation()},onPointerCancel:()=>{He.current=null,te(null)},onKeyDown:W=>{let Z=(W.shiftKey?8:2)*d,[be,xe]=W.key==="ArrowLeft"?[-Z,0]:W.key==="ArrowRight"?[Z,0]:W.key==="ArrowUp"?[0,-Z]:W.key==="ArrowDown"?[0,Z]:[0,0];if(!be&&!xe||!ue)return;W.preventDefault();let Oe=le(ue);_e(J(Oe.px+be,Oe.py+xe),500)}}:{},Ze=W=>{let Z=Ue(W);!we||!Z||y.current?.contains(W.target)||_e(J(Z.px,Z.py),0)},Me=ue?le(ue):null,Qt=Me?Math.min(b-52+xa,Math.max(-xa,Math.round(Me.px/d-52/2))):N.x,Pn=Me?`${Math.min(ke-so-ka,Math.max(-ka,Math.round(ke-Me.py/d-ka)))*d}px`:`${ao}%`,_n={"--sl-px":`${d}px`,"--sl-x":Qt,"--sl-move-ms":`${Me?0:N.moveMs}ms`,"--sl-steps":N.steps,bottom:Pn,width:`${52*d}px`,height:`${52*d}px`},xt=Nn(T.mood,B?.action??null,N.face),De=Vr.includes(e.species)&&!e.design&&!k;return f("div",{ref:m,className:"sl-stage","data-paused":a?"true":void 0,onPointerDown:G,onClick:Ze,style:{"--sl-hover":wl,"--sl-px":`${d}px`},children:[i("img",{className:`sl-stage-bg ${A?"":"sl-stage-bg--pixel"}`,src:A?s:n(bt(e)),alt:"",draggable:!1,onLoad:W=>{let{naturalWidth:Z,naturalHeight:be}=W.currentTarget;Z>0&&be>0&&ee({width:Z,height:be})}}),r&&"figure"in r?i("div",{className:"sl-stage-figure","aria-hidden":"true","data-breathes":r.rows===2?"true":void 0,"data-flipped":o?"true":void 0,style:{backgroundImage:`url("${r.figure}")`,backgroundSize:`${r.frames*Fe*d}px ${r.rows*Fe*d}px`,backgroundPositionX:`${-r.frame*Fe*d}px`,width:`${Fe*d}px`,height:`${Fe*d}px`,right:`${-xl*d}px`,bottom:`calc(${ao}% + ${2*d}px)`},children:r.blink?i("div",{className:"sl-stage-blink",style:{backgroundImage:`url("${r.blink}")`}}):null}):r?i("img",{className:"sl-stage-caretaker","data-flipped":o?"true":void 0,src:r.src,alt:"",draggable:!1}):null,i("div",{ref:y,className:"sl-stage-actor","data-facing":e.flipped===(N.facing==="left")?"right":"left","data-hover":De?"true":void 0,"data-movable":we?"true":void 0,style:_n,...we?{tabIndex:0,role:"img","aria-label":g("saucelings.egg.moveLabel"),title:g("saucelings.egg.moveHint")}:{},...kt,children:h>0?i(Ae,{art:e,species:e.species,stage:T.stage,mood:xt,assetUrl:n,alt:k?g("saucelings.egg.name"):`${e.name} (${Xe(e).name})`,scale:d,still:a,reaction:B,pose:N.pose,cue:N.cue,act:k?null:N.act,facing:N.facing,flipped:e.flipped}):null}),k?null:i("span",{className:"sl-sr-only",children:g("saucelings.stage.tapHint",{name:e.name})})]})}function io({characters:e,defaultCaretakerId:t,submitLabel:n,pending:s,onSubmit:a,onCancel:r}){let{t:o}=X(),[l,c]=F(t),u=e.find(g=>g.id===l),p=mt(l,!!u);return f("div",{className:"sl-egg-form",style:{display:"flex",flexWrap:"wrap",gap:"0.6rem",justifyContent:"center",alignItems:"center",marginTop:"0.5rem"},children:[i(ht,{name:u?.name??o("saucelings.empty.houseCaretaker"),src:p}),i("select",{className:"sl-select",value:l,onChange:g=>c(g.target.value),"aria-label":o("saucelings.empty.pickCaretaker"),children:e.length===0?i("option",{value:"caretaker",children:o("saucelings.empty.houseCaretaker")}):e.map(g=>i("option",{value:g.id,children:g.name},g.id))}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:s,onClick:()=>a({characterId:l}),children:s?o("saucelings.empty.bringingEgg"):n}),r?i("button",{type:"button",className:"sl-btn",onClick:r,children:o("saucelings.common.cancel")}):null,e.length===0?i("p",{style:{flexBasis:"100%",margin:0,fontSize:"0.8rem",opacity:.7,textAlign:"center"},children:o("saucelings.empty.houseCaretakerNote")}):null]})}function lo({unlocks:e}){let{t}=X(),n=["prismite","thundrake","clockrit"],s=n.filter(a=>e[a].done).length+(e.halloween?1:0);return f("details",{className:"sl-unlocks",children:[i("summary",{children:t("saucelings.unlocks.title",{have:s,total:n.length+1})}),f("ul",{children:[n.map(a=>i("li",{children:e[a].done?t("saucelings.unlocks.done",{name:bn[a].name}):t(`saucelings.unlocks.${a}`,{...e[a]})},a)),i("li",{children:e.halloween?t("saucelings.unlocks.halloweenNow"):t("saucelings.unlocks.halloween")})]})]})}function Vt({label:e,help:t,value:n,gapLabel:s,keepGap:a=!1}){return f("div",{className:`sl-meter-box ${s?"sl-meter-box--gap":""}`,title:s??void 0,children:[f("div",{className:"sl-meter-head",children:[i(Ee,{text:t,trigger:e}),f("span",{className:"sl-meter-value",children:[n,"%"]})]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})}),s?i("div",{className:`sl-meter-gap ${a?"sl-meter-gap--keep":""}`,children:s}):null]})}var co=null,Cl=4e3,Rl=["hatch","stage-up","evolve-offer","evolve"],Nl=48;function Ml({label:e,children:t}){let n=Q(null);V(()=>{let a=r=>{n.current&&!n.current.contains(r.target)&&(n.current.open=!1)};return document.addEventListener("pointerdown",a),()=>document.removeEventListener("pointerdown",a)},[]);let s=()=>{n.current&&(n.current.open=!1)};return f("details",{ref:n,className:"sl-menu",onKeyDown:a=>{a.key==="Escape"&&(s(),n.current?.querySelector("summary")?.focus())},onClick:a=>{a.target.closest(".sl-menu-list button")&&s()},children:[i("summary",{className:"sl-btn sl-btn--small","aria-label":e,title:e,children:"\u22EF"}),i("div",{className:"sl-menu-list",children:t})]})}function uo({state:e,packageId:t,packageVersion:n,askVoice:s}){let{t:a}=X(),r=pe(),o=e.world.activePet,l=e.characters,[c,u]=F(!1),[p,g]=F(!1),[m,h]=F(null),[v,y]=F(!1),[d,b]=F(""),[T,k]=F(null),[A,L]=F("feedReliability"),[U,x]=F(null),[w,E]=Cn(),O=Q(null),[B,R]=dn(15e3),N=_=>Qe(t,_,n),M=o?.backgroundId??null,P=ce({queryKey:["saucelings","background",M],queryFn:()=>q(`/background/${encodeURIComponent(M??"")}`),enabled:M!==null,staleTime:1/0}),C=M?P.data?.image??null:null,[z,S]=F(!1),I=o?.journal.find(_=>_.kind==="user-care"||_.kind==="nudge")??null,D=I?.id,H=I?.text,G=Q(D),[j,ee]=F({text:"",shown:!1}),re=Q(0),te=_=>{ee({text:_,shown:!0}),window.clearTimeout(re.current),re.current=window.setTimeout(()=>ee(de=>({...de,shown:!1})),6e3)};V(()=>()=>window.clearTimeout(re.current),[]),V(()=>{!D||D===G.current||(G.current=D,te(H??""))},[D,H]);let[fe,ue]=Ts(Nl),he=hn(o?.caretakerId??"",l.some(_=>_.id===o?.caretakerId)),ke=o?e.world.caretakerFigures[o.caretakerId]:void 0,we=ft(ke),J=fn(ke,we),le=o?.journal.find(_=>Xn.includes(_.kind))??null,ae=le&&!e.writing.includes(le.id)?le:null,ve=ae?.kind==="caretaker-care"?$s(ae.outcome):null,_e=ve?ae?.id??null:null,[He,Ue]=at(pn);V(()=>{!ve||!_e||_e===co||(co=_e,(O.current?.comeOver()??Promise.resolve()).then(()=>{E(ve),Ue(ve)}))},[ve,_e,E,Ue]);let[kt,Ze]=at(Cl),Me=ae&&Rl.includes(ae.kind)?ae.id:null,Qt=Q(Me);V(()=>{!Me||Me===Qt.current||(Qt.current=Me,Ze(!0))},[Me,Ze]);let[Pn,_n]=F(!1),xt=Is(o);V(()=>{if(xt===null)return;let _=window.setTimeout(()=>{r.invalidateQueries({queryKey:["saucelings","state"]})},Math.max(0,xt-Date.now())+1e3);return()=>window.clearTimeout(_)},[xt,r]);let De=_=>{k(null),r.setQueryData(["saucelings","state"],_)},W=_=>k(_??new Error(a("saucelings.error.request"))),Z=ne({mutationFn:_=>q("/adopt","POST",_),onSuccess:_=>{u(!1),De(_)},onError:W}),be=ne({mutationFn:_=>q("/action","POST",{action:_}),onMutate:()=>({arrived:O.current?.comeOver()??Promise.resolve()}),onSuccess:(_,de,it)=>{De(_),R(),it.arrived.then(()=>{E(de),de!=="talk"&&Ue(de)})},onError:W}),xe=ne({mutationFn:()=>q("/check-in","POST",{}),onSuccess:De,onError:W}),Oe=ne({mutationFn:_=>q("/nudge","POST",{tendency:_}),onSuccess:_=>{De(_),R()},onError:W}),Ve=ne({mutationFn:_=>q("/pet","PATCH",_),onSuccess:(_,de)=>{y(!1),h(null),De(_),de.caretakerId&&s(de.caretakerId)},onError:W}),On=ne({mutationFn:({characterId:_,name:de})=>q("/voice","POST",{characterId:_}).catch(()=>{throw new Error(a("saucelings.voice.failed",{name:de}))}),onSuccess:De,onError:W}),Ca=_=>Z.mutate(_,{onSuccess:()=>{let de=()=>s(_.characterId);_.swap||wa()?de():x({then:de})}}),Ra=ne({mutationFn:()=>q("/retire","POST",{}),onSuccess:_=>{g(!1),De(_)},onError:W});if(!o)return f("div",{className:"sl-card",style:{display:"grid",gap:"1rem",textAlign:"center",padding:"2rem"},children:[i("div",{style:{display:"flex",justifyContent:"center"},children:i(wt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:N,alt:a("saucelings.empty.eggAlt"),scale:2})}),i("h2",{style:{fontSize:"1.125rem",fontWeight:600,margin:0},children:a("saucelings.empty.title")}),i("p",{style:{fontSize:"0.85rem",opacity:.8,maxWidth:"32rem",margin:"0 auto"},children:a("saucelings.empty.body")}),wa()?null:f("div",{className:"sl-mari-line",children:[i("img",{src:Sa("wave"),alt:"",onError:_=>_.currentTarget.hidden=!0}),i("p",{children:a("saucelings.empty.mari")})]}),i(io,{characters:l,defaultCaretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.empty.bringEgg"),pending:Z.isPending,onSubmit:Ca}),i(lo,{unlocks:e.unlocks}),T?i("p",{role:"alert",className:"sl-error",style:{margin:0},children:i(ge,{error:T})}):null]});let Se=o.stage==="egg",Fn=Xe(o),et=ze(o),Ie=et?.sauce??null,Ln=o.name===Fn.name,Ce=o.careProfile.characterName,Et=l.some(_=>_.id===o.caretakerId),Na=Lt(o,B),Ma=!o.lockedStage&&o.stage!=="elder"&&o.meters.hunger<Qa,vo=Ie?{"--sl-sauce-accent":Ie.accentColor,"--sl-sauce-bg":Ie.badgeBg}:{},Wt=Se?[{tendency:"feedReliability",label:a("saucelings.nudge.warm")},{tendency:"affection",label:a("saucelings.nudge.talk")}]:[{tendency:"feedReliability",label:a("saucelings.nudge.meals")},{tendency:"overfeeding",label:a("saucelings.nudge.portions")},{tendency:"playfulness",label:a("saucelings.nudge.play")},{tendency:"affection",label:a("saucelings.nudge.cuddles")}],Ia=Wt.some(_=>_.tendency===A)?A:Wt[0].tendency,Ta=Wt.flatMap(_=>{let de=o.nudges.find(Oa=>Oa.tendency===_.tendency&&Date.parse(Oa.expiresAt)>B);if(!de)return[];let it=Math.ceil((Date.parse(de.expiresAt)-B)/36e5);return[a("saucelings.nudge.left",{ask:_.label,hours:it})]}),wo=o.journal.filter(_=>Xn.includes(_.kind)),So=yn({gaps:e.gaps,line:le,speaking:Pn||le!==null&&e.writing.includes(le.id),cheering:kt!==null,caring:He}),Aa=vn(we,he,So,J),Pa=()=>{b(Ln?"":o.name),y(!0)},_a=f(ie,{children:[i("div",{className:"sl-care-row","data-sl-tour":"caretaker",children:i("button",{type:"button",className:"sl-btn",disabled:xe.isPending,onClick:()=>xe.mutate(),children:xe.isPending?a("saucelings.checkIn.pending",{name:Ce}):`\u{1F4AC} ${a("saucelings.checkIn.button",{name:Ce})}`})}),f("details",{className:"sl-ask","data-sl-tour":"caretaker",children:[f("summary",{children:[a("saucelings.nudge.heading",{name:Ce}),"\u2026",Ta.length>0?f("span",{className:"sl-care-note",children:[" ",a("saucelings.nudge.active",{asks:Ta.join(", ")})]}):null]}),f("div",{className:"sl-care-row sl-ask-row",children:[i("select",{id:"sl-nudge-pick",className:"sl-select sl-select--small","aria-label":a("saucelings.nudge.heading",{name:Ce}),value:Ia,onChange:_=>L(_.target.value),children:Wt.map(_=>i("option",{value:_.tendency,children:_.label},_.tendency))}),i("button",{type:"button",className:"sl-btn sl-btn--small",disabled:Oe.isPending,onClick:()=>Oe.mutate(Ia),children:a("saucelings.nudge.ask")}),i("span",{className:"sl-care-note",children:a("saucelings.nudge.note")})]})]})]});return f("div",{ref:fe,className:"sl-nook",style:vo,children:[T?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(ge,{error:T})}):null,o.retireReady?i("div",{className:"sl-card sl-retire",children:p?f(ie,{children:[i("span",{children:a("saucelings.retire.confirmNote",{name:o.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:Ra.isPending,onClick:()=>Ra.mutate(),children:a("saucelings.retire.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>g(!1),children:a("saucelings.common.cancel")})]}):f(ie,{children:[i("span",{children:a("saucelings.retire.ready",{name:o.name})}),f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>g(!0),children:["\u{1F4D6} ",a("saucelings.retire.button")]})]})}):null,f("div",{className:"sl-nook-main",children:[f("div",{className:"sl-card sl-stage-card",children:[f("div",{className:"sl-stage-bar",children:[v?f("div",{className:"sl-rename",children:[i("input",{className:"sl-input",style:{flex:"1 1 8rem",width:"100%"},value:d,maxLength:40,placeholder:a("saucelings.pet.namePlaceholder"),"aria-label":a("saucelings.pet.namePlaceholder"),onChange:_=>b(_.target.value)}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:!d.trim()||Ve.isPending,onClick:()=>Ve.mutate({name:d}),children:a("saucelings.common.save")}),i("button",{type:"button",className:"sl-btn",onClick:()=>y(!1),children:a("saucelings.common.cancel")})]}):f("div",{className:"sl-stage-title",children:[f("div",{className:"sl-stage-name",children:[i("h2",{style:{fontSize:"1.35rem",fontWeight:700,margin:0,overflowWrap:"anywhere"},children:Se?a("saucelings.egg.name"):o.name}),Se?null:i(Kt,{pet:o}),Se||!Ln?null:i("button",{type:"button",className:"sl-btn sl-btn--small sl-btn--primary",onClick:Pa,children:a("saucelings.pet.nameIt")})]}),Se?null:f("div",{className:"sl-stage-sub",title:Ie?`${Ie.origin} \u2014 ${Ie.readsAs}`:et?.readsAs,children:[et?`${Ie?a("saucelings.pet.sauce",{sauce:Ie.name}):a("saucelings.pet.temperament",{temperament:et.name})} \xB7 `:null,Fn.name," \xB7"," ",o.lockedStage?a("saucelings.pet.locked",{stage:a(`saucelings.stage.${o.lockedStage}`)}):a(`saucelings.stage.${o.stage}`)]})]}),v?null:f(Ml,{label:a("saucelings.nook.menu"),children:[Se||Ln?null:f("button",{type:"button",className:"sl-btn sl-btn--small",onClick:Pa,children:["\u270F\uFE0F ",a("saucelings.pet.rename")]}),f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":z,onClick:()=>S(_=>!_),children:["\u{1F5BC} ",a("saucelings.nook.background")]}),i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>x({}),children:a("saucelings.tour.link")})]})]}),f("div",{className:"sl-scene",children:[i(Tn,{pet:o,reaction:w,assetUrl:N,backgroundSrc:C,caretaker:Aa,caretakerFlipped:e.world.flippedCaretakers.includes(o.caretakerId),listenKey:ae?.id??null,handle:O,onMoveEgg:_=>Ve.mutateAsync({eggSpot:_})}),i(Jr,{lines:wo,fallbackLine:Se?a("saucelings.caretaker.idleEgg"):a("saucelings.caretaker.idle",{name:o.name}),caretakerId:o.caretakerId,caretakerName:Ce,isCharacter:Et,meals:e.gaps.meals,isEgg:Se,writing:e.writing,standing:Aa!==null||we===void 0,onTyping:_n,children:ue?_a:null})]})]}),f("div",{className:"sl-card sl-care-card",children:[f("div",{className:"sl-meters sl-meters--strip","data-sl-tour":"meters",children:[Se?f(ie,{children:[i(Vt,{label:a("saucelings.meter.warmth"),help:a("saucelings.meter.warmthHelp"),value:Ft(o),gapLabel:e.gaps.warmth?a("saucelings.meter.warmthGap"):null}),i(Vt,{label:a("saucelings.meter.hatching"),help:a("saucelings.meter.hatchingHelp"),value:Na,gapLabel:Na>=100&&o.careActionCount<1?a("saucelings.meter.hatchingGap"):null})]}):f(ie,{children:[i(Vt,{label:a("saucelings.meter.hunger"),help:a("saucelings.meter.hungerHelp"),value:o.meters.hunger,gapLabel:Ma?a("saucelings.pet.growthPaused"):e.gaps.hunger?a("saucelings.meter.hungerGap"):null,keepGap:Ma}),i(Vt,{label:a("saucelings.meter.mood"),help:a("saucelings.meter.moodHelp"),value:o.meters.mood,gapLabel:e.gaps.mood?a("saucelings.meter.moodGap"):null})]}),i(Vt,{label:a("saucelings.meter.bond"),help:a("saucelings.meter.bondHelp"),value:o.meters.bond})]}),i("div",{className:"sl-actions","data-sl-tour":"care",children:_t(o).map(_=>{let de=mn(o,_,B),it=Ot(_,e.gaps);return f("button",{type:"button",className:`sl-btn ${it?"sl-btn--gap":""}`,disabled:be.isPending,"aria-disabled":de>0||void 0,onClick:()=>de>0?te(a("saucelings.action.resting",{action:a(Pt[_]),minutes:de})):be.mutate(_,{onSuccess:()=>{it&&Ze(!0)}}),children:[gn[_]," ",a(Pt[_]),de>0?` \xB7 ${a("saucelings.action.wait",{minutes:de})}`:""]},_)})}),i("p",{className:`sl-action-note ${j.shown?"sl-action-note--shown":""}`,"aria-live":"polite",children:j.text}),i(Rn,{state:e,assetUrl:N}),i(Zr,{state:e,assetUrl:N}),ue?null:_a]})]}),z?i(qr,{pet:o,settings:e.world.settings,assetUrl:N,onClose:()=>S(!1)}):null,f("details",{className:"sl-card sl-about","data-sl-tour":"about",children:[i("summary",{children:Se?a("saucelings.about.egg"):a("saucelings.about.summary",{name:o.name})}),f("div",{className:"sl-about-body",children:[Se?i("p",{children:a("saucelings.egg.about")}):f(ie,{children:[f("p",{children:[Fn.look," \u2014 ",i("em",{children:o.quirk})]}),i("p",{children:Ie?a("saucelings.pet.sauceAbout",{sauce:Ie.name,readsAs:Ie.readsAs}):et&&o.ownTemperament?a("saucelings.pet.temperamentAbout",{temperament:et.name,readsAs:et.readsAs,after:o.ownTemperament.takesAfter.name}):a("saucelings.pet.temperamentForming")}),o.evolution.look?i("p",{title:o.evolution.look.description,children:a("saucelings.evolve.into",{form:o.evolution.look.form})}):null,o.evolution.look?i("p",{children:a("saucelings.evolve.move",{move:a(`saucelings.evolve.moves.${o.evolution.look.move}`)})}):null,i("div",{className:"sl-traits",children:o.traits.map(_=>f("span",{className:"sl-trait",children:["#",_]},_))})]}),i("p",{children:a("saucelings.menagerie.foundBy",{name:o.finder.name})}),f("div",{className:"sl-about-groups",children:[l.length>1||Et?f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.caretakerGroup")}),l.length>1?f("label",{className:"sl-about-row",children:[i("span",{children:a(Se?"saucelings.pet.eggCaretaker":"saucelings.pet.caretaker")}),i("select",{className:"sl-select sl-select--small","aria-label":a("saucelings.empty.pickCaretaker"),value:m?.id??o.caretakerId,onChange:_=>h(l.find(de=>de.id===_.target.value)??null),children:l.map(_=>i("option",{value:_.id,children:_.name},_.id))})]}):null,m&&m.id!==o.caretakerId?f("div",{className:"sl-about-row",role:"group",children:[i("span",{children:Se?a("saucelings.about.handOverEggNote",{caretaker:m.name}):a("saucelings.about.handOverNote",{name:o.name,caretaker:m.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:Ve.isPending,onClick:()=>Ve.mutate({caretakerId:m.id}),children:a("saucelings.about.handOver")}),i("button",{type:"button",className:"sl-btn",onClick:()=>h(null),children:a("saucelings.common.cancel")})]}):null,Et?i("div",{className:"sl-about-row",children:i(Ee,{text:a("saucelings.about.refreshVoiceNote"),label:a("saucelings.help.label",{action:a("saucelings.about.refreshVoice",{name:Ce})}),children:i("button",{type:"button",className:"sl-btn",disabled:On.isPending,onClick:()=>On.mutate({characterId:o.caretakerId,name:Ce}),children:On.isPending?a("saucelings.about.refreshingVoice",{name:Ce}):`\u{1F504} ${a("saucelings.about.refreshVoice",{name:Ce})}`})})}):null,Et?i(Or,{state:e,characterId:o.caretakerId,name:Ce,sprites:he}):null,Et?i(_r,{state:e,characterId:o.caretakerId,name:Ce}):null]}):null,f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.looksGroup")}),i(Tr,{state:e,assetUrl:N}),i(Pr,{state:e}),i(eo,{state:e})]}),f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.newEggGroup")}),i("div",{className:"sl-about-row",children:f("button",{type:"button",className:"sl-btn","aria-expanded":c,onClick:()=>u(_=>!_),children:["\u{1F95A} ",a("saucelings.swap.button")]})}),c?f("div",{style:{display:"grid",gap:"0.5rem",textAlign:"center"},children:[i("p",{style:{margin:0,fontSize:"0.85rem"},children:Se?a("saucelings.swap.noteEgg"):a("saucelings.swap.note",{name:o.name})}),i(io,{characters:l,defaultCaretakerId:l.some(_=>_.id===o.caretakerId)?o.caretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.swap.confirm"),pending:Z.isPending,onSubmit:_=>Ca({..._,swap:!0}),onCancel:()=>u(!1)}),i(lo,{unlocks:e.unlocks})]}):null]})]})]})]}),U?i(no,{caretaker:Ce,hatched:o.stage!=="egg",onClose:()=>{x(null),U.then?.()}}):null]})}var Il=new Set(["image_generation","video_generation","audio","decision"]);function go({value:e,min:t,max:n,onSave:s}){let[a,r]=F(String(e));return V(()=>r(String(e)),[e]),i("input",{type:"number",className:"sl-input",min:t,max:n,style:{width:"5rem",flexShrink:0},value:a,onChange:l=>r(l.target.value),onBlur:()=>{let l=a.trim()===""?Number.NaN:Number(a);if(!Number.isFinite(l))return r(String(e));let c=Math.min(n,Math.max(t,Math.round(l)));r(String(c)),c!==e&&s(c)},onKeyDown:l=>{l.key==="Enter"&&l.currentTarget.blur()}})}function Je({title:e,note:t,tick:n,stack:s,children:a}){return f("label",{className:`sl-setting ${s?"sl-setting--stack":""}`,children:[f("span",{className:"sl-setting-text",children:[f("span",{className:"sl-setting-title",children:[e," ",n]}),t?i("span",{className:"sl-setting-note",children:t}):null]}),a]})}function po({state:e}){let{t}=X(),n=pe(),s=e.world.settings,a=e.world.budget,[r,o]=F(!1),l=ce({queryKey:["saucelings","connections"],queryFn:()=>Re("/api/connections")}),c=(l.data??[]).filter(b=>!Il.has(b.provider)),u=l.data?.filter(b=>b.provider==="image_generation"),p=ne({mutationFn:b=>q("/settings","PATCH",b),onSuccess:b=>n.setQueryData(["saucelings","state"],b)}),[g,m]=at(2e3),h=b=>p.mutate(b,{onSuccess:()=>m(Object.keys(b)[0])}),v=b=>g===b?i("span",{className:"sl-saved",role:"status",children:t("saucelings.settings.saved")}):null,y=ne({mutationFn:()=>q("/reset","POST",{}),onSuccess:b=>{o(!1),n.setQueryData(["saucelings","state"],b)}}),d=b=>i("input",{type:"checkbox",checked:s[b],onChange:T=>h({[b]:T.target.checked})});return f("div",{className:"sl-card sl-settings",children:[f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.visitsGroup")}),i(Je,{title:t("saucelings.settings.careWindow"),note:t("saucelings.settings.careWindowNote"),tick:v("careWindowHours"),children:i(go,{value:s.careWindowHours,min:1,max:24,onSave:b=>h({careWindowHours:b})})}),i(Je,{title:t("saucelings.settings.eggHunting"),note:t("saucelings.settings.eggHuntingNote"),tick:v("eggHunting"),children:d("eggHunting")})]}),f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.writingGroup")}),i(Je,{stack:!0,title:t("saucelings.settings.connection"),note:t("saucelings.settings.connectionNote"),tick:v("connectionId"),children:f("select",{className:"sl-input",value:s.connectionId??"",onChange:b=>h({connectionId:b.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.connectionDefault")}),c.map(b=>i("option",{value:b.id,children:b.name},b.id)),s.connectionId&&l.data&&!c.some(b=>b.id===s.connectionId)?i("option",{value:s.connectionId,children:t("saucelings.settings.connectionMissing")}):null]})}),i(Je,{title:t("saucelings.settings.dailyBudget"),note:`${t("saucelings.settings.budgetUsed",{used:a.used,limit:s.dailyGenerationBudget})} \u2014 ${t("saucelings.settings.budgetNote")}`,tick:v("dailyGenerationBudget"),children:i(go,{value:s.dailyGenerationBudget,min:0,max:30,onSave:b=>h({dailyGenerationBudget:b})})}),i(Je,{title:t("saucelings.settings.writeEveryLine"),note:t("saucelings.settings.writeEveryLineNote"),tick:v("writeEveryLine"),children:d("writeEveryLine")})]}),f("section",{className:"sl-settings-group",children:[i("h3",{children:t("saucelings.settings.picturesGroup")}),i(Je,{title:t("saucelings.settings.images"),note:t("saucelings.settings.imagesNote"),tick:v("portraitEnabled"),children:d("portraitEnabled")}),s.portraitEnabled?i(Je,{stack:!u||u.length>0,title:t("saucelings.settings.imageConnection"),note:u&&u.length===0?t("saucelings.settings.imageConnectionEmpty"):null,tick:v("portraitConnectionId"),children:u&&u.length===0?null:f("select",{className:"sl-input",value:s.portraitConnectionId??"",onChange:b=>h({portraitConnectionId:b.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.imageConnectionPick")}),(u??[]).map(b=>i("option",{value:b.id,children:b.name},b.id))]})}):null,s.portraitEnabled?i(Je,{title:t("saucelings.settings.threeDrawingFallback"),note:t("saucelings.settings.threeDrawingFallbackNote"),tick:v("threeDrawingFallback"),children:d("threeDrawingFallback")}):null]}),p.error??y.error?i("span",{role:"alert",className:"sl-error",children:i(ge,{error:p.error??y.error})}):null,f("div",{style:{borderTop:"1px solid var(--border, rgba(255,255,255,0.1))",paddingTop:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"},children:[i("span",{style:{fontSize:"0.8rem",opacity:.75},children:t("saucelings.settings.resetNote")}),r?f("div",{style:{display:"flex",gap:"0.5rem"},children:[i("button",{type:"button",className:"sl-btn sl-btn--danger",disabled:y.isPending,onClick:()=>y.mutate(),children:t("saucelings.settings.resetConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>o(!1),children:t("saucelings.common.cancel")})]}):i("button",{type:"button",className:"sl-btn",onClick:()=>o(!0),children:t("saucelings.settings.reset")})]})]})}function jt({label:e,value:t,gap:n}){return f("div",{children:[f("span",{children:[e," ",t,"%"]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})})]})}var Tl={warmth:"\u{1F525}",hatching:"\u{1F95A}",hunger:"\u{1F35D}",mood:"\u{1F60A}",bond:"\u{1F49B}"};function Al({icon:e,label:t,value:n,gap:s}){return f("div",{className:"sl-widget-bar-row",role:"meter","aria-label":t,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":n,title:`${t} ${n}%`,children:[i("span",{className:"sl-widget-bar-icon","aria-hidden":"true",children:e}),i("span",{className:"sl-widget-bar-name","aria-hidden":"true",children:t}),i("div",{className:"sl-widget-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})})]})}function mo({active:e,compact:t,packageId:n,packageVersion:s,onOpenNoodle:a}){let{t:r}=X(),o=pe(),[l,c]=Cn(),u=Q(null),[p,g]=at(pn),[m,h]=dn(3e4),v=J=>Qe(n,J,s),[y,d]=F(null),b=Q(0),[T,k]=F(!1),A=Q(null),L=J=>{d(J),window.clearTimeout(b.current),b.current=window.setTimeout(()=>d(null),6e3)};V(()=>()=>window.clearTimeout(b.current),[]);let U=ce({queryKey:["saucelings","state"],queryFn:()=>q("/state"),enabled:e,staleTime:1e4,refetchOnMount:"always",refetchInterval:J=>e?J.state.data?.writing.length?2e3:3e4:!1,refetchIntervalInBackground:!1}),x=ne({mutationFn:J=>q("/action","POST",{action:J}),onMutate:()=>({arrived:u.current?.comeOver()??Promise.resolve()}),onSuccess:(J,le,ae)=>{o.setQueryData(["saucelings","state"],J),h(),ae.arrived.then(()=>{c(le),le!=="talk"&&g(le)})}}),w=U.data,E=w?.world.activePet,O=!!(E&&w?.characters.some(J=>J.id===E.caretakerId)),B=mt(E?.caretakerId??"",O),R=hn(E?.caretakerId??"",O&&!t),N=E&&!t?w?.world.caretakerFigures[E.caretakerId]:void 0,M=ft(N),P=fn(N,M),C=E?.backgroundId??null,z=ce({queryKey:["saucelings","background",C],queryFn:()=>q(`/background/${encodeURIComponent(C??"")}`),enabled:e&&!t&&C!==null,staleTime:1/0}),S=C?z.data?.image??null:null;if(!w)return f("div",{className:"sl-widget",style:{display:"grid",gap:"0.5rem",fontSize:"0.8rem"},children:[i("span",{style:{opacity:.75},children:U.isError?r("saucelings.error.load"):r("saucelings.loading")}),U.isError?i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{U.refetch()},children:r("saucelings.error.retry")})}):null]});if(!E)return i("section",{className:"sl-widget","aria-label":r("saucelings.title"),children:f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(wt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:v,alt:r("saucelings.empty.eggAlt"),scale:1,still:!e}),f("div",{children:[i("button",{type:"button",className:"sl-widget-open",style:{fontWeight:600,fontSize:"0.85rem"},onClick:()=>a?.(),children:r("saucelings.empty.title")}),i("div",{style:{fontSize:"0.72rem",opacity:.75},children:r("saucelings.widget.emptyHint")})]})]})});let I=E.stage==="egg",D=Xe(E),H=ze(E),G=H?.sauce??null,j=rt(E),ee=G?{"--sl-sauce-accent":G.accentColor,"--sl-sauce-bg":G.badgeBg}:{},re=E.journal[0],te=I?r("saucelings.egg.name"):E.name,fe=f("div",{style:{minWidth:0,flex:1},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"0.875rem"},children:t?i("button",{type:"button",className:"sl-widget-open","aria-label":r("saucelings.widget.open",{name:te}),onClick:()=>a?.(),children:te}):te}),I||!H?null:i("span",{className:"sl-badge",style:{fontSize:"0.65rem",padding:"0.1rem 0.45rem"},title:H.readsAs,children:G?r("saucelings.pet.sauce",{sauce:G.name}):r("saucelings.pet.temperament",{temperament:H.name})})]}),f("div",{style:{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",marginTop:"0.15rem"},children:[i(ht,{name:E.careProfile.characterName,src:B,small:!0}),i("span",{style:{opacity:.75,minWidth:0},children:I?`${r("saucelings.pet.eggCaretaker")} ${E.careProfile.characterName}`:`${D.name} \xB7 ${r("saucelings.pet.caretaker")} ${E.careProfile.characterName}`})]})]}),ue=f("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"0.4rem",fontSize:"0.68rem"},children:[I?f(ie,{children:[i(jt,{label:r("saucelings.meter.warmth"),value:Ft(E),gap:w?.gaps.warmth}),i(jt,{label:r("saucelings.meter.hatching"),value:Lt(E,m)})]}):f(ie,{children:[i(jt,{label:r("saucelings.meter.hunger"),value:E.meters.hunger,gap:w?.gaps.hunger}),i(jt,{label:r("saucelings.meter.mood"),value:E.meters.mood,gap:w?.gaps.mood})]}),i(jt,{label:r("saucelings.meter.bond"),value:E.meters.bond})]}),he=f("p",{style:{margin:0,fontSize:"0.75rem",opacity:.85,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:t?1:2,WebkitBoxOrient:"vertical"},children:[re?.generated?i("span",{className:"sl-pill sl-pill--ai",style:{marginRight:"0.35rem"},children:r("saucelings.journal.generated")}):null,w?.latestRemark]});if(t)return f("section",{className:"sl-widget",style:ee,"aria-label":te,children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(Ae,{art:E,species:E.species,stage:j.stage,mood:Nn(j.mood,l?.action??null,null),assetUrl:v,alt:I?r("saucelings.egg.name"):E.name,scale:1,still:!e,reaction:l}),fe]}),ue,he]});let ke=w?vn(M,R,yn({gaps:w.gaps,line:null,speaking:!1,cheering:!1,caring:p}),P):null,we=I?[{key:"warmth",label:r("saucelings.meter.warmth"),value:Ft(E),gap:w?.gaps.warmth},{key:"hatching",label:r("saucelings.meter.hatching"),value:Lt(E,m),gap:!1}]:[{key:"hunger",label:r("saucelings.meter.hunger"),value:E.meters.hunger,gap:w?.gaps.hunger},{key:"mood",label:r("saucelings.meter.mood"),value:E.meters.mood,gap:w?.gaps.mood}];return we.push({key:"bond",label:r("saucelings.meter.bond"),value:E.meters.bond,gap:!1}),i("section",{className:"sl-widget sl-widget--stage",style:ee,"aria-label":te,onClick:()=>a?.(),children:f("div",{className:"sl-widget-body",children:[i("div",{className:"sl-widget-stage",onClick:J=>{I||J.stopPropagation()},children:i(Tn,{pet:E,reaction:l,assetUrl:v,backgroundSrc:S,paused:!e,caretaker:ke,caretakerFlipped:w?.world.flippedCaretakers.includes(E.caretakerId),handle:u,scaleByWidth:!0})}),f("div",{className:"sl-widget-remark","aria-live":"polite",children:[y===null&&re?.generated?i("span",{className:"sl-pill sl-pill--ai",children:r("saucelings.journal.generated")}):null,i("p",{children:y??w.latestRemark})]}),f("div",{className:"sl-widget-hud",children:[i("div",{className:"sl-widget-bars",children:we.map(J=>i(Al,{icon:Tl[J.key],label:J.label,value:J.value,gap:J.gap},J.key))}),i("div",{className:"sl-widget-acts",children:i("button",{type:"button",className:"sl-btn sl-widget-act","aria-label":r("saucelings.widget.open",{name:te}),title:r("saucelings.widget.open",{name:te}),onClick:()=>a?.(),children:i("span",{"aria-hidden":"true",children:"\u2197"})})})]}),f("div",{className:"sl-widget-care",onClick:J=>J.stopPropagation(),onKeyDown:J=>{J.key==="Escape"&&T&&(J.stopPropagation(),k(!1),A.current?.focus())},children:[x.error?i("span",{role:"alert",className:"sl-error sl-widget-care-error",children:i(ge,{error:x.error})}):null,f("div",{className:"sl-widget-care-row",children:[T?_t(E).map(J=>{let le=mn(E,J,m),ae=r(Pt[J]),ve=le>0?`${ae} \xB7 ${r("saucelings.action.wait",{minutes:le})}`:ae;return f("button",{type:"button",className:`sl-btn sl-widget-act ${w&&Ot(J,w.gaps)?"sl-btn--gap":""}`,"aria-label":ve,title:ve,disabled:x.isPending,"aria-disabled":le>0||void 0,onClick:()=>le>0?L(r("saucelings.action.resting",{action:ae,minutes:le})):x.mutate(J),children:[i("span",{"aria-hidden":"true",children:gn[J]}),le>0?i("span",{className:"sl-widget-act-wait","aria-hidden":"true",children:le}):null]},J)}):null,i("button",{ref:A,type:"button",className:`sl-btn sl-widget-act ${!T&&w&&_t(E).some(J=>Ot(J,w.gaps))?"sl-btn--gap":""}`,"aria-expanded":T,"aria-label":r("saucelings.widget.care"),title:r("saucelings.widget.care"),onClick:()=>k(J=>!J),children:i("span",{"aria-hidden":"true",children:T?"\u2715":"\u{1F932}"})})]})]})]})})}var fo=`
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
/* Rename, Background and Tour in one menu under the stage bar's "\u22EF". */
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
.sl-about-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr)); gap: 0.75rem; margin-top: 0.25rem; }
.sl-about-group { display: grid; align-content: start; gap: 0.5rem; min-width: 0; padding-top: 0.6rem; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); }
.sl-about-group > h3 { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.7; }
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
.sl-tour-text { display: grid; gap: 0.35rem; min-width: 0; flex: 1; }
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
`;function ho(){let e=pe(),[t,n]=F(null);return{ask:me(a=>{let o=e.getQueryData(["saucelings","state"])?.characters.find(l=>l.id===a);o&&!o.hasVoice&&n({characterId:a,name:o.name})},[e]),dialog:t?i(Pl,{characterId:t.characterId,name:t.name,onFinish:()=>n(null)},t.characterId):null}}function Pl({characterId:e,name:t,onFinish:n}){let{t:s}=X(),a=pe(),r=Q(null),[o,l]=F("ask");V(()=>{let u=r.current;return u&&!u.open&&u.showModal(),u?.querySelector(".sl-btn--primary")?.focus(),()=>u?.close()},[]);let c=async()=>{l("reading"),r.current?.focus();try{let u=await q("/voice","POST",{characterId:e});a.setQueryData(["saucelings","state"],u),n()}catch{l("failed")}};return f("dialog",{ref:r,className:"sl-dialog",tabIndex:-1,"aria-labelledby":"sl-voice-title",onCancel:u=>{u.preventDefault(),o!=="reading"&&n()},children:[i("h2",{id:"sl-voice-title",children:s("saucelings.voice.title",{name:t})}),i("p",{role:"status",children:o==="reading"?s("saucelings.about.refreshingVoice",{name:t}):o==="failed"?s("saucelings.voice.failed",{name:t}):s("saucelings.voice.body",{name:t})}),o==="reading"?null:f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:n,children:s(o==="ask"?"saucelings.voice.notNow":"saucelings.voice.close")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",autoFocus:!0,onClick:()=>{c()},children:o==="ask"?s("saucelings.voice.read",{name:t}):s("saucelings.voice.tryAgain")})]})]})}var _l=new Fa({defaultOptions:{queries:{retry:!1,staleTime:5e3}}}),Ea=class extends Ua.Component{constructor(){super(...arguments);oe(this,"state",{error:null})}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n){let s=n.message||pt(this.props.element.capabilityProps?.localization,"saucelings.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Saucelings client capability stopped",n)}render(){return this.state.error?i("div",{className:"sl-shell",style:{padding:"1.5rem"},role:"alert",children:f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},children:[i("strong",{children:pt(this.props.element.capabilityProps?.localization,"saucelings.error.interface")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:this.state.error.message}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})},children:pt(this.props.element.capabilityProps?.localization,"saucelings.error.retry")})})]})}):this.props.children}},Ol=["nook","journal","album","menagerie","settings"],yo="saucelings-menagerie-seen";function Fl(){try{return localStorage.getItem(yo)}catch{return null}}function Ll({props:e}){let{t}=X(),[n,s]=F("nook"),a=ho(),r=e.focusPostId,o=e.onFocusPostHandled;V(()=>{r&&o?.()},[r,o]);let l=ce({queryKey:["saucelings","state"],queryFn:()=>q("/state"),refetchOnMount:"always",refetchInterval:h=>h.state.data?.writing.length?2e3:!1}),c=l.error?.status===404,u=l.data?.world.lastEggFindDay??null,[p,g]=F(Fl),m=u!==null&&u!==p&&n!=="menagerie";return V(()=>{if(!(n!=="menagerie"||!u)){g(u);try{localStorage.setItem(yo,u)}catch{}}},[n,u]),f("div",{className:"sl-shell",children:[f("header",{className:"sl-header",children:[f("div",{className:"sl-header-title",children:[i("strong",{style:{fontSize:"1rem"},children:t("saucelings.title")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.subtitle")})]}),i("nav",{className:"sl-nav","data-sl-tour":"tabs","aria-label":t("saucelings.nav.label"),children:Ol.map(h=>f("button",{type:"button",className:`sl-tab-btn ${n===h?"sl-tab-btn--active":""}`,"aria-current":n===h?"page":void 0,"aria-label":h==="menagerie"&&m?t("saucelings.tab.menagerieNew"):void 0,onClick:()=>s(h),children:[t(`saucelings.tab.${h}`),h==="album"&&l.data?.portraitCount?f("span",{className:"sl-tab-count",children:[" (",l.data.portraitCount,")"]}):null,h==="menagerie"&&l.data?.menagerieCount?f("span",{className:"sl-tab-count",children:[" (",l.data.menagerieCount,")"]}):null,h==="menagerie"&&m?i("span",{className:"sl-tab-dot","aria-hidden":"true"}):null]},h))})]}),i("main",{className:"sl-body",children:f("div",{className:"sl-container",children:[l.isError&&l.data?i("div",{role:"alert",className:"sl-error",style:{marginBottom:"0.5rem"},children:t("saucelings.error.load")}):null,l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.loading")}):l.data?n==="nook"?i(uo,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,askVoice:a.ask}):n==="journal"?i(Ur,{state:l.data,onOpenNook:()=>s("nook")}):n==="album"?i($r,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion}):n==="menagerie"?i(Br,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,onRestored:h=>{s("nook"),a.ask(h)}}):i(po,{state:l.data}):f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},role:"alert",children:[i("strong",{children:t("saucelings.error.load")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:c?t("saucelings.error.restart"):i(ge,{error:l.error})}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{l.refetch()},children:t("saucelings.error.retry")})})]})]})}),a.dialog]})}function $l({element:e}){let t=e.capabilityProps??{},n=e.getAttribute("view"),s=typeof t.packageId=="string"?t.packageId:"saucelings",a=typeof t.packageVersion=="string"?t.packageVersion:null;return n==="widget"?i(mo,{active:t.active===!0,compact:t.widgetId==="sauceling-compact",packageId:s,packageVersion:a,onOpenNoodle:typeof t.onOpenNoodle=="function"?t.onOpenNoodle:void 0}):i(Ll,{props:t})}function Hl({element:e}){let[,t]=F(0);return V(()=>{let n=()=>t(s=>s+1);return e.addEventListener("marinara-capability-props",n),()=>e.removeEventListener("marinara-capability-props",n)},[e]),f(Ms,{localization:e.capabilityProps?.localization,children:[i("style",{children:fo}),i(yr,{}),i(Ea,{element:e,children:i($l,{element:e})})]})}var An=class extends HTMLElement{constructor(){super(...arguments);oe(this,"__root",null);oe(this,"capabilityProps");oe(this,"capabilityRuntimeError")}attributeChangedCallback(n,s,a){n==="view"&&s!==a&&this.__root&&this.render()}render(){this.__root?.render(i(La,{client:_l,children:i(Hl,{element:this})}))}connectedCallback(){this.__root||(this.__root=za(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};oe(An,"observedAttributes",["view"]);var bo="marinara-capability-saucelings";customElements.get(bo)||customElements.define(bo,An);
