var vo=Object.defineProperty;var wo=(e,t,n)=>t in e?vo(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var se=(e,t,n)=>wo(e,typeof t!="symbol"?t+"":t,n);var jt=globalThis.__MARINARA_HOST__,K=jt&&jt.version===1&&jt.modules?jt.modules["@tanstack/react-query"]:void 0;if(!K)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var Fl=K.CancelledError,Ll=K.HydrationBoundary,$l=K.InfiniteQueryObserver,Hl=K.IsRestoringProvider,Ul=K.Mutation,Dl=K.MutationCache,zl=K.MutationObserver,Bl=K.QueriesObserver,Gl=K.Query,Kl=K.QueryCache,Pa=K.QueryClient,ql=K.QueryClientContext,_a=K.QueryClientProvider,Vl=K.QueryErrorResetBoundary,jl=K.QueryObserver,Wl=K.dataTagErrorSymbol,Ql=K.dataTagSymbol,Yl=K.defaultScheduler,Xl=K.defaultShouldDehydrateMutation,Jl=K.defaultShouldDehydrateQuery,Zl=K.dehydrate,ec=K.dehydrateQuery,tc=K.environmentManager,nc=K.experimental_streamedQuery,ac=K.focusManager,sc=K.hashKey,rc=K.hydrate,oc=K.infiniteQueryOptions,ic=K.isCancelledError,lc=K.isServer,cc=K.keepPreviousData,uc=K.matchMutation,gc=K.matchQuery,dc=K.mutationOptions,pc=K.noop,mc=K.notifyManager,fc=K.onlineManager,hc=K.partialMatchKey,bc=K.queryOptions,yc=K.replaceEqualDeep,vc=K.shouldThrowError,wc=K.skipToken,Sc=K.timeoutManager,kc=K.unsetMarker,xc=K.useInfiniteQuery,Ec=K.useIsFetching,Cc=K.useIsMutating,Rc=K.useIsRestoring,te=K.useMutation,Oa=K.useMutationState,Mc=K.usePrefetchInfiniteQuery,Ic=K.usePrefetchQuery,Nc=K.useQueries,le=K.useQuery,de=K.useQueryClient,Tc=K.useQueryErrorResetBoundary,Ac=K.useSuspenseInfiniteQuery,Pc=K.useSuspenseQueries,_c=K.useSuspenseQuery;var Wt=globalThis.__MARINARA_HOST__,X=Wt&&Wt.version===1&&Wt.modules?Wt.modules.react:void 0;if(!X)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var Fc=X.Activity,Lc=X.Children,$c=X.Component,Hc=X.Fragment,Uc=X.Profiler,Dc=X.PureComponent,zc=X.StrictMode,Bc=X.Suspense,Gc=X.ViewTransition,Kc=X.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,qc=X.__COMPILER_RUNTIME,Vc=X.act,jc=X.addTransitionType,Wc=X.cache,Qc=X.cacheSignal,Yc=X.captureOwnerStack,Xc=X.cloneElement,Fa=X.createContext,Jc=X.createElement,Zc=X.createRef,La=X.default,eu=X.forwardRef,tu=X.isValidElement,nu=X.lazy,au=X.memo,su=X.startTransition,ru=X.unstable_useCacheRefresh,ou=X.use,iu=X.useActionState,pe=X.useCallback,$a=X.useContext,lu=X.useDebugValue,cu=X.useDeferredValue,W=X.useEffect,uu=X.useEffectEvent,Qt=X.useId,Ha=X.useImperativeHandle,gu=X.useInsertionEffect,Ge=X.useLayoutEffect,Yt=X.useMemo,du=X.useOptimistic,pu=X.useReducer,Q=X.useRef,U=X.useState,mu=X.useSyncExternalStore,fu=X.useTransition,hu=X.version;var Xt=globalThis.__MARINARA_HOST__,Et=Xt&&Xt.version===1&&Xt.modules?Xt.modules["react-dom/client"]:void 0;if(!Et)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var Ua=Et.createRoot,yu=Et.default,vu=Et.hydrateRoot,wu=Et.version;var So="/api/saucelings",ko="x-marinara-csrf";var xo="marinara_admin_secret";function Eo(){if(typeof window>"u")return{};try{let e=window.localStorage.getItem(xo)?.trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function V(e,t="GET",n,s){return xe(`${So}${e}`,t,n,s)}async function xe(e,t="GET",n,s){let a=new Headers(Eo());t!=="GET"&&a.set(ko,"1"),n!==void 0&&a.set("Content-Type","application/json");let r=await fetch(e,{method:t,headers:a,signal:s,cache:"no-store",credentials:"same-origin",...n===void 0?{}:{body:JSON.stringify(n)}});if(!r.ok){let o=await r.json().catch(()=>null),l=typeof o?.error=="string"?o.error:typeof o?.message=="string"?o.message:r.statusText;throw Object.assign(new Error(l||"Saucelings request failed"),{status:r.status})}return r.json()}function Jt(e,t){let n=e instanceof Error?e.message:"",s=e?.status,a=e instanceof Error?e.name:"",r=a==="AbortError"||a==="TimeoutError"?"saucelings.error.timeout":e instanceof TypeError&&s===void 0&&/fetch|network|load failed/i.test(n)?"saucelings.error.network":s===502?"saucelings.error.writing":s===404&&n==="Not Found"?"saucelings.error.restart":typeof s=="number"&&s>=500&&(!n||/^internal server error$/i.test(n))?"saucelings.error.engine":null;return r?{message:t(r),details:n||null}:{message:n||t("saucelings.error.request"),details:null}}function Ke(e="saucelings",t,n){let s=`/api/capability-packages/${encodeURIComponent(e)}/assets/${t}`;return n?`${s}?v=${encodeURIComponent(n)}`:s}var Da=["prismite","thundrake","clockrit"],za=["wickwisp","cauldrop","webbit"],Ba=["rigamuffin","fluttino","lentino","shellbini","tortellump"];var He=["egg","hatchling","juvenile","adult","elder"],Ga=["hatchling","juvenile","adult","elder"];var Ln=["feed","play","rest","pet"],$n=["warm","talk","listen"],xu=[...Ln,...$n],Hn=1800*1e3,Ka=70,qa=35;var Co=["feed","fedBadly","overfed","forgot","play","cuddle","milestone","warmEgg","letCool","chatEgg","hatch","stageUp"],Ro=["hello","farewell","checkInEgg","checkInContent","checkInHungry","checkInSad","backSoon","backLong","returnHome","eggFound","eggFoundTalking","anotherEgg","eggFoundByOther","evolveOffer","evolve","temperamentShift","takesAfter","eggFarewell","eggReturn"],Eu=[...Co,...Ro];var Ct=["halo","crown","star","flame","moon","leaf","gem","snowflake","cloud","bolt","feather","heart","mushroom","orb","bow","flower","shell"],Zt=["embers","snow","leaves","petals","stars","glints","wisps","sparks","bubbles"];var rt={ember:{aura:"embers",extras:["flame","star","crown"],moves:["firepuff","roar"]},frost:{aura:"snow",extras:["snowflake","gem","moon"],moves:["icicles","twirl"]},moss:{aura:"leaves",extras:["leaf","mushroom","feather"],moves:["leafwhirl","wiggle"]},dusk:{aura:"stars",extras:["moon","star","orb"],moves:["starburst","float"]},gilded:{aura:"glints",extras:["crown","halo","gem"],moves:["coinshower","sparkle","shine"]},shade:{aura:"wisps",extras:["moon","orb","feather"],moves:["shockwave","vanish"]},bloom:{aura:"petals",extras:["flower","heart","bow"],moves:["petalshower","triplehop"]},storm:{aura:"sparks",extras:["bolt","cloud","orb"],moves:["zap","dash"]},tide:{aura:"bubbles",extras:["shell","gem","orb"],moves:["bubbleblow","splash"]}},Va=200,Un=24,Dn=24;var es={egg:32,hatchling:29,juvenile:37,adult:45,elder:46},Ae=(e,t)=>({data:new Uint8ClampedArray(e*t*4),width:e,height:t}),en=(e,t,n,s)=>{let a=[0,0,0],r=0;for(let o=n;o<Math.min(n+s,e.height);o++)for(let l=t;l<Math.min(t+s,e.width);l++){let c=(o*e.width+l)*4;a[0]+=e.data[c],a[1]+=e.data[c+1],a[2]+=e.data[c+2],r++}return[Math.round(a[0]/r),Math.round(a[1]/r),Math.round(a[2]/r)]};function qn(e,t=48){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s};if(n===0||s===0)return a;let r=4,o=[en(e,0,0,r),en(e,Math.max(0,n-r),0,r),en(e,0,Math.max(0,s-r),r),en(e,Math.max(0,n-r),Math.max(0,s-r),r)],l=(h,g)=>Math.max(Math.abs(h[0]-g[0]),Math.abs(h[1]-g[1]),Math.abs(h[2]-g[2]))<=t,c=o[0],u=0;for(let h of o){let g=o.filter(v=>l(h,v)).length;g>u&&(u=g,c=h)}let p=h=>{let g=h*4;return e.data[g+3]<16||l([e.data[g],e.data[g+1],e.data[g+2]],c)},d=new Uint8Array(n*s),m=new Int32Array(n*s),b=0,y=h=>{d[h]||!p(h)||(d[h]=1,m[b++]=h)};for(let h=0;h<n;h++)y(h),y((s-1)*n+h);for(let h=0;h<s;h++)y(h*n),y(h*n+n-1);for(;b>0;){let h=m[--b];a.data[h*4+3]=0;let g=h%n;g>0&&y(h-1),g<n-1&&y(h+1),h>=n&&y(h-n),h<n*(s-1)&&y(h+n)}return a}function Rt(e,t=128){let n=e.width,s=e.height,a=-1,r=-1;for(let o=0;o<e.height;o++)for(let l=0;l<e.width;l++)e.data[(o*e.width+l)*4+3]<t||(l<n&&(n=l),l>a&&(a=l),o<s&&(s=o),o>r&&(r=o));return a<0?null:{x:n,y:s,width:a-n+1,height:r-s+1}}var tn=(e,t,n,s,a,r)=>{let o=Ae(s,s),l=Math.max(1,Math.round(t.width*n)),c=Math.max(1,Math.round(t.height*n)),u=r===void 0?Math.floor((s-l)/2):r-l,p=s-a-c,d=n<1;for(let m=0;m<c;m++)if(!(p+m<0||p+m>=s))for(let b=0;b<l;b++){if(u+b<0||u+b>=s)continue;let y=b*t.width/l,h=(b+1)*t.width/l,g=m*t.height/c,v=(m+1)*t.height/c,k=0,x=0,_=0,P=0,B=0,C=Math.floor(y),S=Math.floor(g),$=d?Math.ceil(h):C+1,O=d?Math.ceil(v):S+1;for(let E=S;E<Math.min(O,t.height);E++)for(let I=C;I<Math.min($,t.width);I++){let R=d?(Math.min(I+1,h)-Math.max(I,y))*(Math.min(E+1,v)-Math.max(E,g)):1,T=((t.y+E)*e.width+t.x+I)*4,M=e.data[T+3];k+=R,x+=R*M,_+=R*M*e.data[T],P+=R*M*e.data[T+1],B+=R*M*e.data[T+2]}if(x<=0||x/k<128)continue;let L=((p+m)*s+u+b)*4;o.data[L]=Math.round(_/x),o.data[L+1]=Math.round(P/x),o.data[L+2]=Math.round(B/x),o.data[L+3]=255}return o};function Mo(e,t,n=52,s=2,a){let r=Rt(e);return r?tn(e,r,a??Math.min(t/r.height,(n-4)/r.width),n,s):Ae(n,n)}function Io(e,t){let n=Math.max(1,Math.floor(t)),s=Ae(e.width*n,e.height*n);for(let a=0;a<s.height;a++)for(let r=0;r<s.width;r++){let o=(Math.floor(a/n)*e.width+Math.floor(r/n))*4;s.data.set(e.data.subarray(o,o+4),(a*s.width+r)*4)}return s}var ts=e=>{let t=-1,n=-1;for(let s=0;s<e.height;s++)for(let a=0;a<e.width;a++)if(e.data[(s*e.width+a)*4+3]!==0){t<0&&(t=s),n=s;break}return t<0?null:{top:t,bottom:n}},nn=(e,t,n,s)=>{let a=e.width*4;n.data.set(e.data.subarray(t*a,t*a+a),s*a)};function ns(e){let t=1/0,n=[0,0,0];for(let s=0;s<e.data.length;s+=4){if(e.data[s+3]===0)continue;let a=e.data[s]+e.data[s+1]+e.data[s+2];a<t&&(t=a,n=[e.data[s],e.data[s+1],e.data[s+2]])}return n}function Mt(e,t){let{width:n,height:s}=e,a={data:new Uint8ClampedArray(e.data),width:n,height:s},r=(o,l)=>o>=0&&l>=0&&o<n&&l<s&&e.data[(l*n+o)*4+3]>0;for(let o=0;o<s;o++)for(let l=0;l<n;l++)!r(l,o)||r(l-1,o)&&r(l+1,o)&&r(l,o-1)&&r(l,o+1)||a.data.set([t[0],t[1],t[2]],(o*n+l)*4);return a}function as(e){let t=ts(e);if(!t)return 0;let n=Math.max(1,t.top+Math.floor((t.bottom-t.top)/2)),s=t.bottom-2,a=Math.min(n,t.bottom),r=1/0,o=e.width*4;for(let l=n;l<=s;l++){let c=0;for(let u=0;u<e.width;u++){let p=l*o+u*4,d=p-o;(e.data[p]!==e.data[d]||e.data[p+1]!==e.data[d+1]||e.data[p+2]!==e.data[d+2]||e.data[p+3]!==e.data[d+3])&&c++}c<=r&&(r=c,a=l)}return a}function ss(e,t){let n=Ae(e.width,e.height);for(let s=0;s<e.height;s++)s!==0&&(s<=t?nn(e,s-1,n,s):nn(e,s,n,s));return n}function No(e,t){let n=Ae(e.width,e.height);for(let s=0;s<e.height;s++)s<t-1?nn(e,s+1,n,s):nn(e,s,n,s);return n}function ja(e,t){let n=Ae(e.width,e.height),s=ts(e);if(!s)return n;let a=s.bottom-s.top+1;for(let r=0;r<e.height;r++){let o=t*(r<s.top+a/3?2:r<s.top+2*a/3?1:0);for(let l=0;l<e.width;l++){let c=l+o;if(c<0||c>=e.width)continue;let u=(r*e.width+l)*4;n.data.set(e.data.subarray(u,u+4),(r*e.width+c)*4)}}return n}function rs(e){let t=ns(e),n=as(e);return[e,Mt(ss(e,n),t),Mt(No(e,n),t)]}function os(e){let t=ns(e);return[e,Mt(ja(e,-1),t),Mt(ja(e,1),t)]}function It(e,t=2){let n=e.reduce((r,o)=>r+o.width,0),s=Ae(n,e[0]?.height??0),a=0;for(let r of e){for(let o=0;o<r.height;o++)s.data.set(r.data.subarray(o*r.width*4,(o+1)*r.width*4),(o*n+a)*4);a+=r.width}return Io(s,t)}var To=e=>{let{width:t,height:n}=e,s=new Uint8Array(t*n),a=(r,o)=>r>=0&&o>=0&&r<t&&o<n&&e.data[(o*t+r)*4+3]>=128?1:0;for(let r=0;r<n;r++)for(let o=0;o<t;o++){if(!a(o,r))continue;let l=0;for(let c=-1;c<=1;c++)for(let u=-1;u<=1;u++)(u||c)&&(l+=a(o+u,r+c));l>=2&&(s[r*t+o]=1)}return s};function Vn(e,t=16){let n=e.map(To),s=new Int32Array(4096),a=new Int32Array(4096),r=[];e.forEach((m,b)=>{for(let y=0;y<m.width*m.height;y++){if(!n[b][y])continue;let h=m.data[y*4],g=m.data[y*4+1],v=m.data[y*4+2],k=h>>4<<8|g>>4<<4|v>>4;s[k]++===0&&(a[k]=h<<16|g<<8|v,r.push(k))}});let o=r.map(m=>({c:[a[m]>>16,a[m]>>8&255,a[m]&255],w:Math.ceil(Math.sqrt(s[m]))})),l=m=>{let b=-1,y=0;for(let h=0;h<3;h++){let g=255,v=0;for(let k of m)g=Math.min(g,k.c[h]),v=Math.max(v,k.c[h]);v-g>b&&(b=v-g,y=h)}return{spread:b,channel:y}},c=o.length?[o]:[];for(;c.length<t;){let m=-1,b=0;if(c.forEach((_,P)=>{if(_.length<2)return;let{spread:B}=l(_);B>b&&(b=B,m=P)}),m<0)break;let y=c[m],{channel:h}=l(y),g=[...y].sort((_,P)=>_.c[h]-P.c[h]),v=g.reduce((_,P)=>_+P.w,0)/2,k=0,x=1;for(let _=0;_<g.length-1&&(k+=g[_].w,x=_+1,!(k>=v));_++);c.splice(m,1,g.slice(0,x),g.slice(x))}let u=c.map(m=>{let b=m.reduce((y,h)=>y+h.w,0);return[0,1,2].map(y=>Math.round(m.reduce((h,g)=>h+g.w*g.c[y],0)/b))}),p=u[0]??[0,0,0];for(let m of u)m[0]+m[1]+m[2]<p[0]+p[1]+p[2]&&(p=m);let d=new Map;return e.map((m,b)=>{let y=Ae(m.width,m.height);for(let h=0;h<m.width*m.height;h++){if(!n[b][h])continue;let g=m.data[h*4],v=m.data[h*4+1],k=m.data[h*4+2],x=g<<16|v<<8|k,_=d.get(x);if(_===void 0){let P=1/0;_=0,u.forEach((B,C)=>{let S=(B[0]-g)**2+(B[1]-v)**2+(B[2]-k)**2;S<P&&(P=S,_=C)}),d.set(x,_)}y.data.set([...u[_],255],h*4)}return Mt(y,p)})}var zn=(e,t,n)=>{let s=[],a=-1,r=-1;for(let o=0;o<e.length;o++)e[o]&&(a>=0&&o-r>t&&(s.push([a,r+1]),a=-1),a<0&&(a=o),r=o);return a>=0&&s.push([a,r+1]),s.filter(([o,l])=>l-o>=n)},is=e=>e.map(t=>t==="egg"?2:4);function an(e,t,n=!0,s=!1){let a=qn(e),{width:r,height:o}=a,l=new Uint8Array(r*o);for(let C=0;C<l.length;C++)l[C]=a.data[C*4+3]>=128?1:0;let c=Math.max(r,o)/1024,u=Math.round(10*c),p=Math.round(16*c),d=[],m=(C,S,$,O)=>{let L=new Int32Array(o);for(let E=$;E<O;E++)for(let I=C;I<S;I++)L[E]+=l[E*r+I];return L},b=(C,S,$,O)=>{let L=new Int32Array(r);for(let E=$;E<O;E++)for(let I=C;I<S;I++)L[I]+=l[E*r+I];return L},y=(C,S,$)=>{let O=S;for(let L=S;L<$;L++)C[L]<C[O]&&(O=L);return O},h=(C,S,$)=>{let O=C.r-C.l,L=C.b-C.t,E=new Int32Array(O*L).fill(-1),I=[],R=(w,N)=>l[(C.t+N)*r+C.l+w]===1;for(let w=0;w<O*L;w++){if(E[w]!==-1||!R(w%O,Math.floor(w/O)))continue;let N={size:0,l:O,t:L,r:0,b:0};E[w]=I.length;let H=[w];for(;H.length;){let D=H.pop(),q=D%O,j=(D-q)/O;N.size++,N.l=Math.min(N.l,q),N.r=Math.max(N.r,q+1),N.t=Math.min(N.t,j),N.b=Math.max(N.b,j+1);for(let[z,ee]of[[q-1,j],[q+1,j],[q,j-1],[q,j+1]]){let ne=ee*O+z;z>=0&&ee>=0&&z<O&&ee<L&&E[ne]===-1&&R(z,ee)&&(E[ne]=I.length,H.push(ne))}}I.push(N)}let T=Math.max(...I.map(w=>w.size)),M=I.map(w=>w.size!==T&&(C.l+w.l===S||C.l+w.r===$));for(let w=0;w<O*L;w++)E[w]>=0&&M[E[w]]&&(a.data[((C.t+Math.floor(w/O))*r+C.l+w%O)*4+3]=0);let G=I.filter((w,N)=>!M[N]);return{l:C.l+Math.min(...G.map(w=>w.l)),t:C.t+Math.min(...G.map(w=>w.t)),r:C.l+Math.max(...G.map(w=>w.r)),b:C.t+Math.max(...G.map(w=>w.b))}},g=m(0,r,0,o),v=zn(g,u,p);if(!v.length)return null;let k=()=>v.map(([C,S])=>S-C).sort((C,S)=>C-S)[Math.floor(v.length/2)],x=.3*k();for(v=v.filter(([C,S])=>S-C>=x),s&&(v=v.slice(0,t.length));v.length<t.length;){let C=0;v.forEach(([I,R],T)=>{R-I>v[C][1]-v[C][0]&&(C=T)});let[S,$]=v[C];if($-S<1.4*k())return null;let O=S+Math.floor(.3*($-S)),L=S+Math.floor(.7*($-S));if(L<=O)return null;let E=y(g,O,L);if(E<=S)return null;v.splice(C,1,[S,E],[E,$])}if(v.length!==t.length)return null;let _=[];for(let C=0;C<v.length;C++){let[S,$]=v[C],O=t[C],L=b(0,r,S,$),E=zn(L,u,p);if(!E.length)return null;let I=E.map(([w,N])=>{let H=m(w,N,S,$),D=S;for(;!H[D];)D++;let q=$-1;for(;!H[q];)q--;return{h:q-D+1,w:N-w}}),R=Math.max(...I.map(w=>w.h)),T=Math.max(...I.map(w=>w.w));if(E=E.filter((w,N)=>I[N].h>=.6*R||I[N].w>=.6*T),E.length>2*O)return null;let M=!1;if(E.length>O)d.push(`row ${C+1}: ${E.length} drawings, first ${O} used`),E=E.slice(0,O);else if(E.length<O){if(!n)return null;let w=E[0][0],N=E[E.length-1][1],H=(N-w)/O;if(!E.some(([q,j])=>j-q>1.5*H))return null;let D=[w];for(let q=1;q<O;q++)D.push(y(L,Math.floor(w+(q-.15)*H),Math.floor(w+(q+.15)*H)));D.push(N),E=D.slice(0,-1).map((q,j)=>[q,D[j+1]]),M=!0,d.push(`row ${C+1}: drawings touch, split at ${D.slice(1,-1).join(", ")}`)}let G=[];for(let[w,N]of E){let H=(j,z)=>{let ee=m(w,N,j,z),ne=b(w,N,j,z),oe=j;for(;oe<z&&!ee[oe];)oe++;if(oe===z)return null;let ue=z-1;for(;!ee[ue];)ue--;let he=w;for(;!ne[he];)he++;let ye=N-1;for(;!ne[ye];)ye--;return{l:he,t:oe,r:ye+1,b:ue+1,rows:ee}},D=H(S,$);if(!D)return null;let q=zn(D.rows.subarray(0,D.b),1,1).filter(([,j])=>j>D.t);if(q.length>1){let[j,z]=q[q.length-1],ee=b(w,N,j,z),ne=w;for(;!ee[ne];)ne++;let oe=N-1;for(;!ee[oe];)oe--;let ue=oe-ne+1;z-j<=.12*(D.b-D.t)&&ue>=4*(z-j)&&ue>=.4*(D.r-D.l)&&(D=H(S,q[q.length-2][1])??D)}if(M){let j=w===E[0][0]?-1:w,z=N===E[E.length-1][1]?-1:N;D={...D,...h(D,j,z)}}G.push({x:D.l,y:D.t,width:D.r-D.l,height:D.b-D.t})}_.push(G)}let P=t.length===5?0:-1;if(P===0&&_[0].length>1){let[C,S]=[_[0][0].height,_[0][1].height];Math.abs(C-S)>.25*Math.max(C,S)&&d.push(`egg row sizes differ: ${C} vs ${S}`)}let B=C=>C[C.length>=4?1:0];for(let C=P+2;C<_.length;C++){let[S,$]=[B(_[C]).height,B(_[C-1]).height];S<$*.95&&d.push(`row ${C+1} (${S}) smaller than row ${C} (${$})`)}for(let C=P+1;C<_.length;C++){let S=_[C];if(S.length<2)continue;let[$,O]=[B(S).height,S[S.length-1].height];Math.abs($-O)>.3*Math.max($,O)&&d.push(`row ${C+1}: front ${$} vs side ${O}`)}return{cells:_,notes:d,keyed:a}}function ls(e,t,n){let s=t.keyed??qn(e),a=t.cells.map((c,u)=>{let p=n[u];if(!p)return[];let d=Math.min(es[p]/Math.max(...c.map(m=>m.height)),48/Math.max(...c.map(m=>m.width)));return c.map(m=>tn(s,m,d,52,2))}),r=Vn(a.flat()),o={},l=0;return a.forEach((c,u)=>{let p=r.slice(l,l+c.length);l+=c.length;let d=n[u];if(!d||!p.length)return;let m=b=>It(d==="egg"?os(p[b]):rs(p[b]));d==="egg"?o[d]={image:m(0)}:p.length>=4?o[d]={image:m(1),happy:m(0),grumpy:m(2),side:m(3)}:o[d]=p.length>1?{image:m(0),side:m(1)}:{image:m(0)}}),o}var Fe=96,Je=[5,3],Ao=80,Po=48;function _o(e){let t=[[[...Je],!1],[[4,4],!1],[[...Je],!0]];for(let[s,a]of t){let r=an(e,s,a),o=r?.cells.flat();if(r&&o)return{front:o.slice(0,Je[0]),facing:o.slice(Je[0]),keyed:r.keyed}}let n=an(e,[3],!1,!0);return n?{front:n.cells[0],facing:[],keyed:n.keyed}:null}function cs(e){let t=_o(e);if(!t)return null;let{front:n,facing:s,keyed:a}=t,r=Math.max(...n.map(d=>d.width)),o=Math.max(...s.map(d=>d.width))-r/2,l=Math.min(Ao/Math.max(...[...n,...s].map(d=>d.height)),Po/r,o>0?(Fe/2-2)/o:1/0),c=Math.max(1,Math.round(r*l)),u=Math.floor((Fe-c)/2)+c,p=Vn([...n.map(d=>tn(a,d,l,Fe,0)),...s.map(d=>tn(a,d,l,Fe,0,u))]);return p.every(d=>Rt(d))?It(p,1):null}var sn=(e,t)=>{let n=e.height,s=Ae(n,n);for(let a=0;a<n;a++){let r=(a*e.width+t*n)*4;s.data.set(e.data.subarray(r,r+n*4),a*n*4)}return s},Wa=[.12,.42],Oo=50,Fo=45,Qa=50,Lo=.04,ot=e=>e>>16,it=e=>e>>8&255,lt=e=>e&255,qe=e=>.299*ot(e)+.587*it(e)+.114*lt(e),Ya=e=>Math.max(ot(e),it(e),lt(e))-Math.min(ot(e),it(e),lt(e)),Bn=(e,t)=>Math.hypot(ot(e)-ot(t),it(e)-it(t),lt(e)-lt(t)),Gn=e=>e.reduce((t,n)=>qe(n)<qe(t)?n:t);function $o(e){let t=Rt(e);if(!t)return null;let{width:n,height:s,data:a}=e,r=new Int32Array(n*s).fill(-1);for(let u=0;u<n*s;u++)a[u*4+3]>=128&&(r[u]=a[u*4]<<16|a[u*4+1]<<8|a[u*4+2]);let o=t.y+Math.round(t.height*Wa[0]),l=t.y+Math.round(t.height*Wa[1]),c=new Map;for(let u=o*n;u<l*n;u++){let p=r[u];p>=0&&c.set(p,(c.get(p)??0)+1)}return{colours:r,width:n,z0:o,z1:l,counts:c}}var Kn=(e,t)=>{let n=e.map(a=>a%t),s=e.map(a=>Math.floor(a/t));return{x0:Math.min(...n),x1:Math.max(...n),y0:Math.min(...s),y1:Math.max(...s)}};function us(e,t,n){let{colours:s,width:a,z0:r,z1:o}=e,l=n?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]],c=new Uint8Array(s.length),u=[];for(let p=r*a;p<o*a;p++){if(c[p]||s[p]<0||!t(s[p]))continue;c[p]=1;let d=[p],m=[],b=!1;for(;d.length;){let y=d.pop();m.push(y);for(let[h,g]of l){let v=y%a+h,k=Math.floor(y/a)+g,x=k*a+v;v<0||v>=a||k<r||k>=o||s[x]<0?b=!0:!c[x]&&t(s[x])&&(c[x]=1,d.push(x))}}u.push({pixels:m,open:b})}return u}var gs=(e,t)=>e.x1-e.x0<10&&e.y1-e.y0<8&&e.y1-e.y0+1>=t;function Ho(e){return[...e.counts].filter(([,n])=>n>=30).sort((n,s)=>s[1]-n[1]).slice(0,4).map(([n])=>n).flatMap(n=>us(e,s=>Bn(s,n)>Oo,!1).flatMap(({pixels:s,open:a})=>{let r=Kn(s,e.width),o=s.map(c=>e.colours[c]);if(a||s.length<2||s.length>40||!gs(r,2))return[];if(Math.max(...o.map(c=>Bn(c,n)))<90)return[];let l=Gn(o);return[{pixels:s,...r,fill:n,lid:qe(n)>qe(l)+40?l:null}]}))}function Uo(e){let t=[...e.counts.values()].reduce((l,c)=>l+c,0),n=[...e.counts].filter(([,l])=>l>=t*Lo).map(([l])=>l);if(!n.length)return[];let s=l=>l>=0&&n.every(c=>Bn(l,c)>Fo),a=Gn(n),{width:r,colours:o}=e;return us(e,l=>Ya(l)>=Qa&&s(l),!0).flatMap(({pixels:l})=>{if(l.length<2||l.length>36)return[];let c=Kn(l,r),u=new Set(l),p=[...l];for(;p.length;){let h=p.pop();for(let g of[1,-1,r,-r,r+1,r-1,1-r,-1-r]){let v=h+g,k=v%r,x=Math.floor(v/r);u.has(v)||k<c.x0-1||k>c.x1+1||x<c.y0-1||x>c.y1+1||x<e.z0||x>=e.z1||!s(o[v])||(u.add(v),p.push(v))}}let d=[...u],m=Kn(d,r);if(!gs(m,1))return[];let b=new Map;for(let h of d){let g=h+r;for(;u.has(g);)g+=r;let v=o[g]??-1;v>=0&&b.set(v,(b.get(v)??0)+1)}let y=[...b].sort((h,g)=>g[1]-h[1])[0]?.[0];return y===void 0||Ya(y)>=Qa&&!n.includes(y)?[]:Math.abs(qe(y)-qe(Gn(d.map(h=>o[h]))))<60?[]:[{pixels:d,...m,fill:y,lid:qe(y)>qe(a)+60?a:null}]})}function Xa(e){let t=null;for(let n of e)for(let s of e){let a=s.x0-n.x1-1,r=Math.abs(n.y0+n.y1-s.y0-s.y1)/2,o=Math.max(n.pixels.length,s.pixels.length)/Math.min(n.pixels.length,s.pixels.length);if(a<2||a>20||r>1.5||o>2.5||Math.abs(n.y1-n.y0-(s.y1-s.y0))>2)continue;let l=n.pixels.length+s.pixels.length-r*4-o*3;(!t||l>t.score)&&(t={pair:[n,s],score:l})}return t?.pair??null}function Ja(e){let t=$o(e);return t?Xa(Ho(t))??Xa(Uo(t)):null}var Do=(e,t)=>e.every((n,s)=>Math.abs(n.y0+n.y1-t[s].y0-t[s].y1)<=4&&Math.abs(n.x1-n.x0-(t[s].x1-t[s].x0))<=2)&&Math.abs(e[1].x0-e[0].x1-(t[1].x0-t[0].x1))<=2;function zo(e){let t=e.height,n=Math.floor(e.width/t),s=n===Je[0]+Je[1]?Je[0]:Math.min(n,3),a=n?Ja(sn(e,0)):null;if(!a)return null;let r=Array.from({length:n},(o,l)=>{let c=Ae(t,t),u=l<s?Ja(sn(e,l)):null;if(!u||!Do(u,a))return c;let p=(d,m)=>c.data.set([ot(m),it(m),lt(m),255],d*4);for(let d of u){for(let b of d.pixels)p(b,d.fill);if(d.lid===null)continue;let m=d.y0+Math.floor((d.y1-d.y0+1)*.6);for(let b=d.x0;b<=d.x1;b++)p(m*t+b,d.lid)}return c});return It(r,1)}var Za=(e,t)=>{let n=Ae(e.width,e.height+t.height);return n.data.set(e.data),n.data.set(t.data,e.data.length),n};function ds(e){let t=Math.floor(e.width/e.height),n=Array.from({length:t},(r,o)=>as(sn(e,o))),s=r=>It(n.map((o,l)=>ss(sn(r,l),o)),1),a=zo(e);return{body:Za(e,s(e)),blink:a?Za(a,s(a)):null}}var Bo=.25,Go=20;function Ko(e){let{width:t,height:n,data:s}=e,a=u=>s[u*4+3]>0,r=0,o=0,l=0,c=0;for(let u=0;u<n;u++)for(let p=0;p<t;p++){let d=u*t+p,m=p===0||u===0||p===t-1||u===n-1;m&&r++,a(d)&&(l++,m&&o++,(p>0&&!a(d-1)||p<t-1&&!a(d+1)||u>0&&!a(d-t)||u<n-1&&!a(d+t))&&c++)}return o<=r*Bo&&c<=Math.sqrt(l)*Go}function ps(e,t){let n=qn(e);if(!Rt(n)||!Ko(n))return null;let s=Vn([Mo(n,es[t])])[0];return Rt(s)?It(t==="egg"?os(s):rs(s)):null}var ms=104,ct=416,fs="#ececec",qo=512,hs=1024,Vo=512,jo=1024;function Le(e){return new Promise((t,n)=>{let s=new Image;s.onload=()=>t(s),s.onerror=()=>n(new Error("That file is not a picture this browser can open.")),s.src=e})}function Nt(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d");if(!s)throw new Error("This browser cannot draw pictures.");return{canvas:n,context:s}}function Ve(e){let{canvas:t,context:n}=Nt(e.width,e.height);return n.putImageData(new ImageData(new Uint8ClampedArray(e.data),e.width,e.height),0,0),t.toDataURL("image/png")}function jn(e,t){let n=Math.min(1,t/Math.max(e.naturalWidth,e.naturalHeight));return{width:Math.max(1,Math.round(e.naturalWidth*n)),height:Math.max(1,Math.round(e.naturalHeight*n))}}async function rn(e,t){let n=await Le(e),{width:s,height:a}=jn(n,t),r=Nt(s,a);return r.context.drawImage(n,0,0,s,a),r.context.getImageData(0,0,s,a)}async function bs(e,t){let n=ps(await rn(e,qo),t);return n?Ve(n):null}async function ys(e,t){let n=await rn(e,hs),s=an(n,is(t));if(!s)return null;let a={};for(let[r,o]of Object.entries(ls(n,s,t)))a[r]={image:Ve(o.image),...o.side?{side:Ve(o.side)}:{},...o.happy?{happy:Ve(o.happy)}:{},...o.grumpy?{grumpy:Ve(o.grumpy)}:{}};return a}async function vs(e){let t=cs(await rn(e,hs));return t?{image:Ve(t),frames:t.width/t.height}:null}async function ws(e){let{body:t,blink:n}=ds(await rn(e,1/0));return{body:Ve(t),blink:n?Ve(n):null}}async function Ss(e){let t=await Le(e),{width:n,height:s}=jn(t,Vo),{canvas:a,context:r}=Nt(n,s);return r.fillStyle=fs,r.fillRect(0,0,n,s),r.drawImage(t,0,0,n,s),a.toDataURL("image/jpeg",.9)}async function ks(e){let t=await Le(e),{width:n,height:s}=jn(t,jo),{canvas:a,context:r}=Nt(n,s);r.drawImage(t,0,0,n,s);let o=a.toDataURL("image/webp",.9);return o.length<e.length?o:e}async function Ze(e,t=0){let n=await Le(e),s=Math.min(n.naturalHeight,ms),{canvas:a,context:r}=Nt(ct,ct);return r.fillStyle=fs,r.fillRect(0,0,ct,ct),r.imageSmoothingEnabled=!1,r.drawImage(n,0,t*ms,s,s,0,0,ct,ct),a.toDataURL("image/png")}var xs={_meta:{locale:"en",direction:"ltr"},"saucelings.title":"Saucelings","saucelings.subtitle":"Your characters look after a little companion; you cover the gaps.","saucelings.loading":"Loading Saucelings\u2026","saucelings.nav.label":"Saucelings views","saucelings.tab.nook":"Nook","saucelings.tab.journal":"Journal","saucelings.tab.album":"Album","saucelings.tab.menagerie":"Menagerie","saucelings.tab.menagerieNew":"Menagerie, a new egg is waiting","saucelings.tab.settings":"Settings","saucelings.empty.title":"No sauceling in the nook yet","saucelings.empty.body":"Pick a character to look after a sauceling. They'll bring an egg that looks like something they would find.","saucelings.empty.pickCaretaker":"Choose caretaker","saucelings.empty.bringEgg":"Have caretaker bring an egg","saucelings.empty.bringingEgg":"Bringing egg\u2026","saucelings.empty.houseCaretaker":"House Caretaker","saucelings.empty.houseCaretakerNote":"You have no characters yet, so the House Caretaker looks after it. Make a character to choose your own.","saucelings.empty.mari":"Ooh, an empty nook! Pick a character and they'll bring you an egg to raise together (I can't wait to see what hatches).","saucelings.empty.eggAlt":"Egg","saucelings.egg.name":"Egg","saucelings.egg.about":"Nobody knows what is inside yet. Keep it warm and talk to it. Once someone has cared for it, it hatches in about half an hour.","saucelings.egg.moveLabel":"Egg. Drag it, or use the arrow keys, to move it.","saucelings.egg.moveHint":"Drag the egg to move it, or tap where it should go.","saucelings.pet.rename":"Rename","saucelings.pet.nameIt":"Name it","saucelings.pet.namePlaceholder":"Give it a name","saucelings.pet.sauce":"Sauce: {{sauce}}","saucelings.pet.rare.special":"Special sauceling","saucelings.pet.rare.halloween":"Halloween sauceling","saucelings.pet.sauceAbout":"{{sauce}} sauce: {{readsAs}}. Its sauce changes with how it is looked after.","saucelings.pet.temperament":"Temperament: {{temperament}}","saucelings.pet.temperamentAbout":"{{temperament}}: {{readsAs}}. It takes after {{after}}, and slowly picks up the ways of whoever looks after it.","saucelings.pet.temperamentForming":"Its temperament is still taking shape.","saucelings.pet.locked":"{{stage}} (locked)","saucelings.pet.growthPaused":"Growing paused: hungry","saucelings.pet.caretaker":"Caretaker:","saucelings.pet.eggCaretaker":"Keeping it warm:","saucelings.pet.meals":"Meals: {{given}} of {{total}} this week","saucelings.pet.mealsTitle":"Meals {{name}} gave in the last 7 days","saucelings.pet.keptWarm":"Kept warm: {{given}} of {{total}} this week","saucelings.pet.keptWarmTitle":"Times {{name}} kept the egg warm in the last 7 days","saucelings.stage.egg":"egg","saucelings.stage.hatchling":"hatchling","saucelings.stage.juvenile":"juvenile","saucelings.stage.adult":"adult","saucelings.stage.elder":"elder","saucelings.meter.hunger":"Hunger","saucelings.meter.mood":"Mood","saucelings.meter.bond":"Bond","saucelings.meter.hungerGap":"Needs attention","saucelings.meter.moodGap":"Low spirits","saucelings.meter.warmth":"Warmth","saucelings.meter.warmthGap":"Getting cold","saucelings.meter.hatching":"Hatching","saucelings.meter.hatchingGap":"Needs care first","saucelings.meter.warmthHelp":"Eggs need to stay warm. Use Warm when it gets cold.","saucelings.meter.hatchingHelp":"Fills up on its own. Once someone has cared for the egg, it hatches about half an hour after it arrived.","saucelings.meter.hungerHelp":"Feed it to keep this up. A hungry sauceling stops growing until it's fed.","saucelings.meter.moodHelp":"Play and cuddles lift it. A happy sauceling may get the chance to evolve once in its life.","saucelings.meter.bondHelp":"Grows every time anyone cares for it. It needs enough bond to grow into its next stage.","saucelings.action.feed":"Feed","saucelings.action.play":"Play","saucelings.action.rest":"Rest","saucelings.action.pet":"Cuddle","saucelings.action.warm":"Warm","saucelings.action.talk":"Talk","saucelings.action.listen":"Listen","saucelings.action.wait":"{{minutes}}m","saucelings.action.resting":"{{action}} is ready again in {{minutes}} min.","saucelings.nudge.heading":"Ask {{name}} to","saucelings.nudge.ask":"Ask","saucelings.nudge.note":"Lasts 48 hours.","saucelings.nudge.active":"Asked: {{asks}}","saucelings.nudge.left":"{{ask}} ({{hours}} h left)","saucelings.nudge.meals":"remember meals","saucelings.nudge.portions":"go easy on portions","saucelings.nudge.play":"play more","saucelings.nudge.cuddles":"give extra cuddles","saucelings.nudge.warm":"keep it warm","saucelings.nudge.talk":"talk to it more","saucelings.retire.button":"Retire to the Menagerie","saucelings.retire.confirmNote":"Retire {{name}} to the Menagerie? The nook will be free for a new egg, and you can bring {{name}} back later.","saucelings.retire.confirm":"Retire","saucelings.checkIn.button":"Check in with {{name}}","saucelings.checkIn.pending":"{{name}} is writing\u2026","saucelings.swap.button":"Swap for a new egg","saucelings.swap.note":"{{name}} will move to the Menagerie, and the caretaker you pick brings a new egg.","saucelings.swap.noteEgg":"The egg will move to the Menagerie, and the caretaker you pick brings a new one.","saucelings.swap.confirm":"Swap","saucelings.unlocks.title":"Special saucelings \xB7 {{have}} of {{total}} unlocked","saucelings.unlocks.prismite":"Prismite: raise {{need}} saucelings to elder or evolve them ({{have}} so far).","saucelings.unlocks.thundrake":"Thundrake: care for your saucelings {{need}} times ({{have}} so far).","saucelings.unlocks.clockrit":"Clockrit: care for a sauceling on {{need}} different days ({{have}} so far).","saucelings.unlocks.done":"{{name}}: unlocked. A new egg may be one.","saucelings.unlocks.halloween":"Wickwisp, Cauldrop and Webbit: October only.","saucelings.unlocks.halloweenNow":"Wickwisp, Cauldrop and Webbit: it's October, so a new egg may be one.","saucelings.menagerie.empty":"No saucelings in the Menagerie yet.","saucelings.menagerie.emptyHow":"Saucelings come here when you retire them or swap them for a new egg. Eggs your characters find while chatting wait here too.","saucelings.menagerie.bringBack":"Bring back to Nook","saucelings.menagerie.lockStage":"Lock stage at:","saucelings.menagerie.lockStageHelp":"It grew all the way up, so it can come back at any age it reached. It stays that age from then on.","saucelings.menagerie.retiredAs":"Retired as {{stage}} with {{name}}","saucelings.menagerie.returnsAt":"Returns at stage:","saucelings.menagerie.release":"Release","saucelings.menagerie.releaseNote":"Release {{name}} for good? It leaves the Menagerie and can't come back. Its paintings stay in the Album.","saucelings.menagerie.releaseNoteEgg":"Release this egg for good? It leaves the Menagerie and can't come back.","saucelings.menagerie.releaseConfirm":"Release for good","saucelings.menagerie.swapNote":"{{active}} will move to the Menagerie, and {{name}} comes back to the nook.","saucelings.menagerie.swapConfirm":"Swap them","saucelings.menagerie.activeEgg":"The egg in the nook","saucelings.menagerie.thisEgg":"this egg","saucelings.menagerie.foundBy":"Found by {{name}}","saucelings.menagerie.evolved":"Evolved","saucelings.menagerie.close":"Close","saucelings.menagerie.lookedAfterBy":"Looked after by","saucelings.menagerie.chooseCaretaker":"Choose who looks after it","saucelings.menagerie.chooseFirst":"Choose who looks after it first.","saucelings.menagerie.section.elder":"Elders","saucelings.menagerie.section.adult":"Adults","saucelings.menagerie.section.juvenile":"Juveniles","saucelings.menagerie.section.hatchling":"Hatchlings","saucelings.menagerie.section.egg":"Eggs","saucelings.album.paint":"Paint {{name}}","saucelings.album.painting":"Painting\u2026","saucelings.album.needsConnection":"Pick an image connection in Saucelings settings first.","saucelings.album.off":"Turn on image generation in Settings to paint your sauceling.","saucelings.album.egg":"Paint it once it hatches.","saucelings.album.noPet":"Bring a sauceling into the nook to paint it.","saucelings.album.full":"The Album is full at {{limit}} paintings. Delete one to paint another.","saucelings.album.empty":"No paintings yet.","saucelings.album.emptyHint":"Use the Paint button above to make the first one.","saucelings.album.inMenagerie":"(in the Menagerie)","saucelings.album.released":"(released)","saucelings.album.caption":"{{stage}}, {{date}}","saucelings.album.alt":"Painting of {{name}}","saucelings.album.missing":"This painting could not be loaded.","saucelings.album.delete":"Delete","saucelings.album.deleteConfirm":"Delete for good","saucelings.album.close":"Close","saucelings.album.keepsakeLabel":"{{name}} before and after evolving","saucelings.album.keepsakeCaption":"{{name}} became {{form}}, {{date}}","saucelings.album.keepsakeNote":"Kept when a sauceling evolves: how it looked before and after.","saucelings.album.before":"Before","saucelings.album.after":"After","saucelings.album.addInstructions":"Add instructions","saucelings.album.removeInstructions":"Remove instructions","saucelings.album.instructionsLabel":"What should the painting show?","saucelings.album.instructionsPlaceholder":"e.g. sitting in a teacup at a caf\xE9, rain outside","saucelings.album.instructionsNote":"Your words replace the plain background. Leave it empty for a plain portrait.","saucelings.album.instructionsCaption":"\u201C{{instructions}}\u201D","saucelings.form.paint":"Paint {{name}}'s {{stage}} form","saucelings.form.paintEgg":"Paint the egg","saucelings.form.painting":"Painting\u2026","saucelings.form.paintingNote":"Painting it now with your image connection.","saucelings.form.paintingEgg":"Painting the egg\u2026","saucelings.form.repaint":"Repaint all of {{name}}'s forms","saucelings.form.repaintEgg":"Repaint the egg","saucelings.form.repaintHint":"For when the picture came out wrong.","saucelings.form.repaintNote":"Paint every stage again in one new picture? The one you see now stays until the new one is ready.","saucelings.form.repaintConfirm":"Repaint","saucelings.form.undoRepaint":"Undo repaint","saucelings.form.undoRepaintHint":"Goes back to the pictures from before the last repaint. Press it again to bring the repaint back.","saucelings.form.eggFailed":"The egg could not be painted: {{error}} Bring it to the nook to paint it there.","saucelings.form.needed":"Its caretaker invented it, so this stage has no picture until one is painted.","saucelings.form.failed":"The painting could not be cut out into a form. Try again.","saucelings.form.offerEggTitle":"Paint the egg?","saucelings.form.offerEggBody":"This egg has no picture yet. Painting it uses your image connection.","saucelings.form.offerTitle":"Paint {{name}}?","saucelings.form.offerBody":"{{name}} has no picture for this stage yet. Painting it uses your image connection.","saucelings.form.offerNotNow":"Not now","saucelings.form.offerPaint":"Paint it","saucelings.figure.paint":"Paint {{name}} for the Nook","saucelings.figure.repaint":"Repaint {{name}} for the Nook","saucelings.figure.hint":"Draws them in eight poses as a pixel figure in the pets' style, from their avatar and card.","saucelings.figure.confirmNote":"Paint {{name}} as a pixel figure with your image connection? It takes one image request, and what the Nook shows now stays until it is ready.","saucelings.figure.confirm":"Paint","saucelings.figure.failed":"The picture could not be read as drawings of {{name}}. Try again.","saucelings.figure.threePoses":"{{name}} has three poses so far. Repaint for all eight.","saucelings.figure.undoRepaint":"Undo {{name}}'s repaint","saucelings.figure.undoHint":"Goes back to the figure from before the last repaint. Press it again to bring the repaint back.","saucelings.flip.label":"Flip {{name}}","saucelings.flip.note":"Turns {{name}} to face the other way in the Nook. Nothing is repainted.","saucelings.settings.careWindow":"Time between caretaker visits (hours)","saucelings.settings.careWindowNote":"How often the caretaker may feed, play or cuddle (default 6 h).","saucelings.settings.connection":"Writing connection","saucelings.settings.connectionNote":"The connection the caretaker writes journal lines and check-ins with.","saucelings.settings.connectionDefault":"Engine default","saucelings.settings.connectionMissing":"Deleted connection: pick another","saucelings.settings.dailyBudget":"Written lines per day","saucelings.settings.budgetUsed":"Used today: {{used}} / {{limit}}","saucelings.settings.budgetNote":"Lines you ask for with a click (Check in, a new caretaker's hello, a welcome back, a farewell) don't count. Past the limit, the caretaker uses their own saved lines instead.","saucelings.settings.writeEveryLine":"Caretaker writes every line","saucelings.settings.writeEveryLineNote":"Every caretaker line comes from the model instead of the phrasebook. Uses more model calls; the daily limit doesn't apply.","saucelings.settings.images":"Enable image generation","saucelings.settings.imagesNote":"Adds a Paint button to the Album tab and a Generate button for the Nook background, and paints each creature a caretaker invents as soon as Saucelings is open, all with the image connection you pick.","saucelings.settings.threeDrawingFallback":"Simpler caretaker figures","saucelings.settings.threeDrawingFallbackNote":"If a caretaker's figure doesn't come out, ask once more for just three drawings in one row. Helps weaker image models, but uses an extra image call.","saucelings.settings.eggHunting":"Egg hunting","saucelings.settings.eggHuntingNote":"When a character replies in a chat, they may find an egg, which waits in the Menagerie and is mentioned by the caretaker. Only a chance is rolled: no chat text is read and nothing is added to the prompt.","saucelings.settings.imageConnection":"Image connection","saucelings.settings.imageConnectionPick":"Choose an image connection","saucelings.settings.imageConnectionEmpty":"No image generation connection yet. Add one under Connections.","saucelings.settings.reset":"Reset Saucelings","saucelings.settings.resetNote":"Clear the nook, the Menagerie, the Album, saved backgrounds, caretakers' voices and painted figures, and special-egg progress. Your settings stay.","saucelings.settings.resetConfirm":"Confirm Reset","saucelings.settings.saved":"\u2713 Saved","saucelings.journal.generated":"AI","saucelings.journal.speaker":"{{name}}:","saucelings.journal.toNook":"Go to the Nook","saucelings.journal.today":"Today","saucelings.journal.yesterday":"Yesterday","saucelings.event.egg-found":"Egg found","saucelings.event.hatch":"Hatched","saucelings.event.caretaker-care":"Caretaker","saucelings.event.user-care":"Your care","saucelings.event.nudge":"Nudge","saucelings.event.absence":"While you were away","saucelings.event.stage-up":"Grew up","saucelings.event.temperament-shift":"New sauce","saucelings.event.farewell":"Farewell","saucelings.event.return-from-album":"Back from the Menagerie","saucelings.event.check-in":"Check-in","saucelings.event.evolve":"Evolved","saucelings.event.evolve-offer":"Ready to evolve","saucelings.event.caretaker-change":"New caretaker","saucelings.widget.emptyHint":"Tap to open Saucelings and pick a caretaker.","saucelings.error.interface":"Saucelings encountered an interface error.","saucelings.error.load":"Could not load Saucelings Nook.","saucelings.error.request":"Request failed","saucelings.error.retry":"Try again","saucelings.error.restart":"Restart Marinara Engine to finish installing Saucelings.","saucelings.error.network":"Couldn't reach Marinara Engine. Check that it's running, then try again.","saucelings.error.timeout":"That took too long. Try again in a moment.","saucelings.error.writing":"The writing connection didn't answer. Check it in Settings, or try again in a moment.","saucelings.error.engine":"Something went wrong on the Engine side. Try again in a moment.","saucelings.error.details":"Details","saucelings.common.cancel":"Cancel","saucelings.common.save":"Save","saucelings.nook.background":"Background","saucelings.background.title":"Nook background","saucelings.background.upload":"Upload a picture","saucelings.background.uploading":"Uploading\u2026","saucelings.background.generate":"Generate a background","saucelings.background.generating":"Generating\u2026","saucelings.background.promptLabel":"What the background shows","saucelings.background.suggest":"Suggest one for {{name}}","saucelings.background.suggestEgg":"Suggest one for the egg","saucelings.background.suggesting":"Writing\u2026","saucelings.background.suggestPlain":"No writing connection answered, so this is a plain starting point. Edit it as you like.","saucelings.background.useBuiltIn":"Use the built-in background","saucelings.background.tooBig":"That picture is too big.","saucelings.background.off":"Turn on image generation in Settings to generate a background.","saucelings.background.noConnection":"Pick an image connection in Saucelings settings first.","saucelings.background.library":"Saved backgrounds","saucelings.background.sharedNote":"Saved backgrounds are shared by all your saucelings.","saucelings.background.tileAlt":"Background: {{label}}","saucelings.background.earlier":"An earlier background","saucelings.background.missing":"Could not load","saucelings.background.delete":"Delete {{label}}","saucelings.background.deleteNote":"Delete \u201C{{label}}\u201D for good? Saucelings showing it go back to their built-in background.","saucelings.background.deleteConfirm":"Delete for good","saucelings.background.full":"The library is full at {{limit}}. Delete a background to save another.","saucelings.caretaker.says":"{{name}} says","saucelings.caretaker.previous":"Earlier line","saucelings.caretaker.next":"Later line","saucelings.caretaker.position":"{{index}} of {{count}}","saucelings.caretaker.idle":"I'm keeping an eye on {{name}}.","saucelings.caretaker.idleEgg":"I'm keeping an eye on the egg.","saucelings.about.summary":"About {{name}}","saucelings.about.egg":"About the egg","saucelings.about.refreshVoice":"Refresh {{name}}'s voice from their card","saucelings.about.refreshingVoice":"{{name}} is reading their card\u2026","saucelings.about.refreshVoiceNote":"Reads their character card again, so their lines sound like them.","saucelings.about.caretakerGroup":"Caretaker","saucelings.about.looksGroup":"Looks","saucelings.about.newEggGroup":"New egg","saucelings.about.handOverNote":"Hand {{name}} over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOverEggNote":"Hand the egg over to {{caretaker}}? They'll do the caring from now on.","saucelings.about.handOver":"Hand over","saucelings.help.label":"Show help: {{action}}","saucelings.evolve.button":"Evolve\u2026","saucelings.evolve.note":"{{name}} can become something new, once in its life. You choose, or keep it as it is.","saucelings.evolve.undo":"Undo evolution","saucelings.evolve.undoNote":"{{name}} goes back to how it looked before. Evolve\u2026 comes back with the same two choices.","saucelings.evolve.title":"What could {{name}} become?","saucelings.evolve.writing":"{{caretaker}} is thinking about what {{name}} could become\u2026","saucelings.evolve.from":"From: {{from}}","saucelings.evolve.become":"Become {{form}}","saucelings.evolve.keep":"Keep it as it is","saucelings.evolve.decline":"Not interested","saucelings.evolve.declineNote":"Hides Evolve\u2026 for {{name}} for good.","saucelings.evolve.declineConfirm":"Never offer {{name}} an evolution again?","saucelings.evolve.into":"Evolved into: {{form}}","saucelings.evolve.move":"Signature move: {{move}}","saucelings.evolve.moves.twirl":"Twirl","saucelings.evolve.moves.float":"Float","saucelings.evolve.moves.shine":"Shine","saucelings.evolve.moves.roar":"Roar","saucelings.evolve.moves.sparkle":"Sparkle","saucelings.evolve.moves.firepuff":"Fire Puff","saucelings.evolve.moves.icicles":"Icicles","saucelings.evolve.moves.leafwhirl":"Leaf Whirl","saucelings.evolve.moves.wiggle":"Wiggle","saucelings.evolve.moves.petalshower":"Petal Shower","saucelings.evolve.moves.triplehop":"Triple Hop","saucelings.evolve.moves.starburst":"Star Burst","saucelings.evolve.moves.coinshower":"Coin Shower","saucelings.evolve.moves.shockwave":"Shockwave","saucelings.evolve.moves.vanish":"Vanish","saucelings.evolve.moves.zap":"Lightning Zap","saucelings.evolve.moves.dash":"Dash","saucelings.evolve.moves.bubbleblow":"Bubble Blow","saucelings.evolve.moves.splash":"Splash","saucelings.voice.title":"Give {{name}} their own voice?","saucelings.voice.body":"{{name}} has no voice of their own yet, so their stock lines are generic. Saucelings can read their character card once with your writing connection to learn how they talk, what they call your pet and what they say at mealtimes.","saucelings.voice.read":"Read {{name}}'s card","saucelings.voice.notNow":"Not now","saucelings.voice.failed":"Couldn't make {{name}}'s voice: the writing connection didn't answer.","saucelings.voice.tryAgain":"Try again","saucelings.voice.close":"Close","saucelings.retire.ready":"{{name}} is old enough to retire.","saucelings.stage.tapHint":"Tap the stage and {{name}} comes over.","saucelings.tour.link":"Tour","saucelings.tour.next":"Next","saucelings.tour.back":"Back","saucelings.tour.skip":"Skip","saucelings.tour.done":"Done","saucelings.tour.eggTitle":"Your first egg.","saucelings.tour.eggBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.petTitle":"Your sauceling.","saucelings.tour.petBody":"{{caretaker}} looks after it while you're away. When something runs low, it's your turn to help.","saucelings.tour.metersTitle":"How it's doing.","saucelings.tour.metersBody":"These bars show how it feels. Tap a name to see what it means.","saucelings.tour.careTitle":"Your care.","saucelings.tour.careBody":"Use these when a bar runs low. Each one rests for a while after you use it.","saucelings.tour.caretakerTitle":"Talk to {{caretaker}}.","saucelings.tour.caretakerBody":"Check in to hear how things are going, or Ask them to care for it differently.","saucelings.tour.aboutTitle":"More options.","saucelings.tour.aboutBody":"Name it, change its look, or change who looks after it here.","saucelings.tour.tabsTitle":"The rest of Saucelings.","saucelings.tour.tabsBody":"The Journal keeps a diary, the Album holds paintings, the Menagerie keeps retired saucelings, and Settings has your connections."};var on=globalThis.__MARINARA_HOST__,Tt=on&&on.version===1&&on.modules?on.modules["react/jsx-runtime"]:void 0;if(!Tt)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var re=Tt.Fragment,Tu=Tt.default,i=Tt.jsx,f=Tt.jsxs;var Qo=Object.fromEntries(Object.entries(xs).filter(([e,t])=>e!=="_meta"&&typeof t=="string"));function Yo(e,t){return t?e.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(n,s)=>{let a=t[s];return a==null?n:String(a)}):e}function ut(e,t,n){return Yo(Qo[t]??t,n)}var Es=Fa({direction:"ltr",t:(e,t)=>ut(void 0,e,t)});function Cs({localization:e,children:t}){let n=e?.direction==="rtl"?"rtl":"ltr",s=Yt(()=>({direction:n,t:(a,r)=>ut(e,a,r)}),[n,e]);return i(Es.Provider,{value:s,children:i("div",{dir:n,style:{display:"contents"},children:t})})}function Z(){return $a(Es)}var ln={feed:"\u{1F35D}",play:"\u{1F3B2}",rest:"\u{1F319}",pet:"\u{1F49B}",warm:"\u{1F9E3}",talk:"\u{1F4AC}",listen:"\u{1F442}"},At={feed:"saucelings.action.feed",play:"saucelings.action.play",rest:"saucelings.action.rest",pet:"saucelings.action.pet",warm:"saucelings.action.warm",talk:"saucelings.action.talk",listen:"saucelings.action.listen"};function cn(e){return e.stage==="egg"?$n:Ln}function un(e,t){return e==="feed"&&t.hunger||e==="play"&&t.mood||e==="warm"&&t.warmth}function gn(e){let[t,n]=U(()=>Date.now());return W(()=>{let s=window.setInterval(()=>n(Date.now()),e);return()=>window.clearInterval(s)},[e]),[t,pe(()=>n(Date.now()),[])]}function et(e){let[t,n]=U(null),s=Q(void 0);W(()=>()=>window.clearTimeout(s.current),[]);let a=pe(r=>{window.clearTimeout(s.current),n(r),s.current=window.setTimeout(()=>n(null),e)},[e]);return[t,a]}var dn=2e3;function pn(e,t,n){let s=e.actionCooldowns[t],a=s?Date.parse(s)-n:0;return a>0?Math.ceil(a/6e4):0}function Pt(e){return e.meters.warmth??Ka}function _t(e,t){let n=t-Date.parse(e.createdAt);return Math.max(0,Math.min(100,Math.floor(n/Hn*100)))}function Rs(e){return e?.stage!=="egg"||e.careActionCount<1?null:Date.parse(e.createdAt)+Hn}function Xo(e){let t=e;if(typeof t=="string")try{t=JSON.parse(t)}catch{return""}let n=t?.extensions,s=n?.imageAppearanceEnabled===!0?n.imageAppearance:null,a=typeof s=="string"&&s.trim()?s:n?.appearance;return typeof a=="string"?a:""}function Wn(e){return{queryKey:["saucelings","caretaker-card",e],queryFn:async()=>{let t=await xe(`/api/characters/${encodeURIComponent(e)}`);return{avatar:typeof t.avatarPath=="string"&&/^\/(?![/\\])/u.test(t.avatarPath)?t.avatarPath:null,appearance:Xo(t.data)}},staleTime:5*6e4,retry:!1}}function gt(e,t){return le({...Wn(e),enabled:t}).data?.avatar??null}function dt(e){let t=le({queryKey:["saucelings","figure",e],queryFn:()=>V(`/figure/${encodeURIComponent(e??"")}`),enabled:!!e,staleTime:1/0,retry:!1});return!e||t.isError?null:t.data?t.data.image?t.data:null:void 0}function mn(e,t){let n=t?.image;return le({queryKey:["saucelings","figure-motion",e],queryFn:()=>ws(n??""),enabled:!!(e&&n),staleTime:1/0,retry:!1}).data??null}function Ms(e){let[t,n]=U(null),[s,a]=U(!1);return Ge(()=>{let r=t?.closest(".sl-shell")??t;if(!r||typeof ResizeObserver>"u")return;let o=()=>a(r.clientWidth>=e*parseFloat(getComputedStyle(document.documentElement).fontSize));o();let l=new ResizeObserver(o);return l.observe(r),()=>l.disconnect()},[t,e]),[n,s]}var Jo=[];function fn(e,t){let n=le({queryKey:["saucelings","caretaker-sprites",e],queryFn:async()=>{let s=await xe(`/api/sprites/${encodeURIComponent(e)}`);return(Array.isArray(s)?s:[]).flatMap(a=>{let r=a;return typeof r.expression=="string"&&typeof r.url=="string"&&/^\/api\/sprites\//u.test(r.url)?[{expression:r.expression,url:r.url}]:[]})},enabled:t,staleTime:3e5,retry:!1});return t&&n.data||Jo}function pt({name:e,src:t,small:n,box:s}){let a=s?"sl-avatar sl-avatar--box":n?"sl-avatar sl-avatar--small":"sl-avatar";return t?i("img",{className:a,src:t,alt:""}):i("span",{className:a,"aria-hidden":"true",children:e.trim().charAt(0).toUpperCase()||"?"})}function ce({error:e}){let{t}=Z(),[n,s]=U(!1),{message:a,details:r}=Jt(e,t);return f(re,{children:[a,r?f(re,{children:[" ",i("button",{type:"button",className:"sl-link","aria-expanded":n,onClick:()=>s(o=>!o),children:t("saucelings.error.details")}),n?i("span",{className:"sl-error-details",children:r}):null]}):null]})}var hn={rigamuffin:{id:"rigamuffin",name:"Rigamuffin",origin:"rigatoni + ragamuffin",look:"scruffy little tube with ridges, always slightly grubby",defaultTraits:["ridged-hide","crumb-collector","sturdy","curious"]},fluttino:{id:"fluttino",name:"Fluttino",origin:"farfalle + flutter",look:"bow-shaped wings, hovers, never quite lands",defaultTraits:["hover-drift","bow-winged","breezy","restless"]},lentino:{id:"lentino",name:"Lentino",origin:"linguine / lentil + -ino",look:"long, thin, loops itself into knots when happy",defaultTraits:["knot-tier","slender","springy","affectionate"]},shellbini:{id:"shellbini",name:"Shellbini",origin:"conchiglie + shell",look:"shelled, hides inside when sulky",defaultTraits:["pocket-shell","peeker","shy-sweet","echo-hum"]},tortellump:{id:"tortellump",name:"Tortellump",origin:"tortellini + lump",look:"plump folded dumpling with a pinched dimple on top, rolls instead of walking",defaultTraits:["roly-poly","stuffed-snug","dimpled","homebody"]},mossaboo:{id:"mossaboo",name:"Mossaboo",origin:"moss + peekaboo",look:"round mossy stone on stubby legs, a tiny mushroom on top, never in a hurry",defaultTraits:["moss-backed","slow","patient","cosy"]},puddlepip:{id:"puddlepip",name:"Puddlepip",origin:"puddle + pip",look:"clear-blue raindrop frog in a lily-pad hat, ripples when it giggles",defaultTraits:["raindrop-headed","splashy","happy","noisy"]},snufflump:{id:"snufflump",name:"Snufflump",origin:"snuffle + lump",look:"round ball of beige fluff with floppy ears, puffs up when startled",defaultTraits:["fluff-ball","sleepy","cuddly","nervous"]},burrowl:{id:"burrowl",name:"Burrowl",origin:"burrow + owl",look:"round brown owl with goggle eyes and big pink digging paws",defaultTraits:["big-pawed","busy","wise","messy"]},prismite:{id:"prismite",name:"Prismite",origin:"prism + -ite",look:"cluster of clear crystal spikes that splits light into rainbows",defaultTraits:["faceted","proud","sparkly","aloof"]},thundrake:{id:"thundrake",name:"Thundrake",origin:"thunder + drake",look:"little storm-cloud dragon with lightning horns and a rainy tail",defaultTraits:["spark-horned","stormy","bold","moody"]},clockrit:{id:"clockrit",name:"Clockrit",origin:"clock + critter",look:"brass wind-up critter with a clock-face belly and a pendulum tail",defaultTraits:["wind-up","punctual","fussy","kind"]},wickwisp:{id:"wickwisp",name:"Wickwisp",origin:"wick + will-o'-the-wisp",look:"stub of dripping candle wax with a little flame floating over its head",defaultTraits:["flame-crowned","flickery","timid","warm-hearted"]},cauldrop:{id:"cauldrop",name:"Cauldrop",origin:"cauldron + drop",look:"small iron cauldron on three legs, brim-full of bubbling purple potion",defaultTraits:["brim-bubbler","bubbly","mischievous","greedy"]},webbit:{id:"webbit",name:"Webbit",origin:"web + -bit",look:"fluffy cobweb spider whose round belly glows like a paper lantern",defaultTraits:["lantern-bellied","tidy","patient","clingy"]}},Zo={marinara:{id:"marinara",name:"Marinara",origin:"house sauce",readsAs:"freshly hatched, open-hearted, still finding its flavor",grownBy:"hatching and balanced early days",accentColor:"#e05246",badgeBg:"rgba(224, 82, 70, 0.16)"},zesto:{id:"zesto",name:"Zesto",origin:"pesto + zest",readsAs:"bright, bouncy, chatty",grownBy:"steady feeding and play, good bond",accentColor:"#48b868",badgeBg:"rgba(72, 184, 104, 0.16)"},carbonuzzle:{id:"carbonuzzle",name:"Carbonuzzle",origin:"carbonara + nuzzle",readsAs:"warm, clingy, golden",grownBy:"lots of cuddles and affection",accentColor:"#f0b449",badgeBg:"rgba(240, 180, 73, 0.18)"},rabbratty:{id:"rabbratty",name:"Rabbratty",origin:"arrabbiata + bratty",readsAs:"feisty, demanding, quick-tempered",grownBy:"erratic care, missed meals then spoiling",accentColor:"#f25c3b",badgeBg:"rgba(242, 92, 59, 0.18)"},seppy:{id:"seppy",name:"Seppy",origin:"seppia + sulky",readsAs:"gloomy, brooding, dramatic",grownBy:"neglect, long absences, low mood",accentColor:"#7882a4",badgeBg:"rgba(120, 130, 164, 0.2)"},alfredoze:{id:"alfredoze",name:"Alfredoze",origin:"alfredo + doze",readsAs:"mellow, sleepy, content",grownBy:"over-feeding, little play",accentColor:"#d9ceb8",badgeBg:"rgba(217, 206, 184, 0.2)"},truffoddity:{id:"truffoddity",name:"Truffoddity",origin:"truffle + oddity",readsAs:"strange, brilliant, unsettling",grownBy:"milestones noticed, no affection",accentColor:"#a978e8",badgeBg:"rgba(169, 120, 232, 0.18)"}};function ei(e,t){return Math.min(e,t)<42?"grumpy":e>=68&&t>=68?"happy":"content"}var Qn=["happy","content","grumpy","side"],tt=1+(He.length-1)*Qn.length;function $e(e,t,n){let s=`sprites/${e}.webp`;return t==="egg"?n==="side"?null:{path:s,row:0}:{path:s,row:1+(He.indexOf(t)-1)*Qn.length+Qn.indexOf(n)}}var Ot=6,ti={thundrake:140,wickwisp:140,cauldrop:180,clockrit:1e3,webbit:220,prismite:180};function Is(e){let t=ti[e];return t?{path:`sprites/${e}-live.webp`,ms:t}:null}var Yn=["egg-found","hatch","caretaker-care","absence","stage-up","temperament-shift","farewell","return-from-album","check-in","evolve","evolve-offer","caretaker-change"];function Ft(e){return`${/^[aeiou]/iu.test(e)?"an":"a"} ${e}`}function je(e){return e.design?{name:e.design.kind,look:e.design.look}:{name:hn[e.species].name,look:hn[e.species].look}}function ni(e){return!e.design&&Ba.includes(e.species)}function Ue(e){if(ni(e)){let t=Zo[e.temperament];return{name:t.name,readsAs:t.readsAs,sauce:t}}return e.ownTemperament?{name:e.ownTemperament.name,readsAs:e.ownTemperament.readsAs,sauce:null}:null}function Ns(e){return[...He].reverse().map(t=>({stage:t,entries:e.filter(n=>(n.reachedElder?"elder":n.stageAtRetirement)===t)})).filter(t=>t.entries.length>0)}var Ts={rigamuffin:"a cosy Italian kitchen counter: a tiled wall of cream and terracotta tiles, a bubbling red tomato-sauce pot on a small stove, a hanging ladle and a string of garlic, a wooden shelf with jars",fluttino:"a bright windowsill in the morning: an open window with white shutters, a soft sky-blue sky with a few clouds and distant green hills, pale pink curtains, a pot of basil and a small vase of flowers",lentino:"a pantry shelf: dark wooden shelves with glass jars of dried pasta, tins and bottles, long strands of linguine hanging to dry on a wooden rack, a small sack of flour, a green-and-white checked cloth",shellbini:"a sunny rock pool by the sea: blue-green water, a bright sky with a few clouds, rounded grey and purple rocks, small seashells, pebbles and a bit of seaweed, flat pale sand along the edge",tortellump:"a hearth in a cosy cottage: a stone fireplace with a warm crackling fire, a rounded brick arch, wooden beams, a copper pot hanging at the side, plump cushions, a woven red-and-cream rug",mossaboo:"a shady forest glade: tall mossy tree trunks, ferns and small red-capped mushrooms at the edges, soft green light through the leaves, a few round mossy stones, a flat mossy forest floor",puddlepip:"a rainy garden pond: lily pads and pink water lilies on calm blue water, tall reeds at the sides, gentle rain from a soft grey sky, a few smooth stepping stones, a flat muddy bank",snufflump:"a cosy corner under a bed: a soft patchwork quilt hanging down at the top, an old slipper, a lost button and a ball of yarn at the sides, warm lamplight from one side, a soft beige carpet",burrowl:"an underground burrow: warm brown earth walls with tree roots poking through, a small round tunnel opening, a lantern hanging from a root, a few pebbles and fallen leaves, a flat packed-earth floor",prismite:"a sparkling crystal cave: deep blue rock walls studded with clusters of clear and pale violet crystals, thin beams of light splitting into rainbow flecks, a few glowing stones, a smooth pale stone floor",thundrake:"a windy hilltop under a stormy sky: dark rolling storm clouds with a distant flash of lightning, a few slanting raindrops, wind-bent grass and a lone crooked tree at one side, a flat grassy ridge",clockrit:"a clockmaker's workshop: a wall of brass gears and ticking clock faces, a tall pendulum clock at one side, tiny tools on a rack, a small magnifying lamp, a polished wooden bench top",wickwisp:"a dim candlelit attic: sloping dark wooden beams, a small round window with a crescent moon, old trunks and a stack of books, candle stubs dripping wax on a shelf, soft violet shadows",cauldrop:"a witch's cottage corner: a stone wall with shelves of glass bottles of purple and green potion, bundles of dried herbs hanging from a beam, a small hearth with glowing embers, a broom leaning by the wall",webbit:"a quiet porch at dusk: weathered wooden planks and railing, big silvery cobwebs in the corners, a glowing paper lantern hanging from the eaves, a deep blue night sky with a few stars, dry autumn leaves"},As="a warm, cosy nest corner: a pale wooden wall with a small round window, a folded checked tea towel, a wide shallow empty nest of golden straw and cream cloth in the centre, a soft straw-coloured mat";function mt(e){return e.stage==="egg"?"sprites/scene-nest.webp":`sprites/scene-${e.species}.webp`}function nt(e){return{stage:e.lockedStage??e.stage,mood:ei(e.meters.hunger,e.meters.mood)}}function Ps(e,t){let n=e.forms[t];return n?{kind:"form",formId:n}:e.design?.origin==="found"?{kind:"silhouette"}:{kind:"species"}}var ai=["calm","happy","worried","talking","waving","feeding","playing","tending"],si={worried:["worried","concerned","sad","anxious"],happy:["happy","smile","laugh","joy"],neutral:["neutral","idle","default","calm"]},ri=/^full[_-]/iu;function oi(e,t){for(let n of t==="neutral"?["neutral"]:[t,"neutral"])for(let s of si[n]){let a=e.find(r=>r.expression.toLowerCase().includes(s));if(a)return a.url}return null}function Xn(e,t){let n=e.filter(a=>!ri.test(a.expression)),s=n.length>0?n:e;return oi(s,t)??s[0]?.url??null}var ii={feed:"feeding",play:"playing",rest:"tending",pet:"tending",warm:"tending",talk:"talking"};function bn({gaps:e,line:t,speaking:n,cheering:s,caring:a}){let r=a&&ii[a];return r||(n&&(t?.kind==="caretaker-change"||t?.kind==="return-from-album")?"waving":s?"happy":n?"talking":e.hunger||e.mood||e.warmth||t?.kind==="absence"?"worried":"calm")}function yn(e,t,n,s=null){if(e)return{figure:s?.body??e.image,rows:s?2:1,frames:e.frames,frame:li(n,e.frames),blink:s?.blink??null};let a=e===null?Xn(t,_s(n)):null;return a?{src:a}:null}function _s(e){return e==="worried"?"worried":e==="calm"||e==="talking"?"neutral":"happy"}function li(e,t){let n=ai.indexOf(e);return n<t?n:["neutral","happy","worried"].indexOf(_s(e))}var ci={"fed-fine":"feed","fed-badly":"feed",overfed:"feed",played:"play",cuddled:"pet","kept-warm":"warm",chatted:"talk"};function Os(e){return(e&&ci[e])??null}var ui={rigamuffin:"a little living rigatoni pasta tube: a short, upright, ridged tube of golden-yellow semolina pasta with a face on the front, tiny stubby arms and little feet, scruffy, with a couple of small tomato-sauce smudges",fluttino:"a little living farfalle (bow-tie) pasta in soft pink: its two pinched bow halves are its wings, with ruffled edges, and the face sits on the pinched middle; it hovers and never quite lands",lentino:"a little living linguine ribbon: one long, flat, green ribbon of pasta with a face near the top, its tail looped into a knot like a bow",shellbini:"a little living conchiglie (shell) pasta: a round, ridged, indigo-blue pasta shell with a soft pale-blue creature peeking out of the opening",tortellump:"a plump little living tortellini dumpling in tomato red: a folded, rounded dumpling with a pinched top fold, a face on the front and tiny arms",mossaboo:"a little mossy stone tortoise: a round grey stone lump on four stubby legs, its back covered in soft green moss, with a tiny red-capped mushroom growing on top, and a sleepy stone face with small dark eyes; its colours are stone grey, moss green, mushroom red",puddlepip:"a little raindrop frog: a small round frog made of clear-blue water, with a shiny raindrop-shaped head that comes to a point on top, big black eyes, little webbed feet and a floppy lily-pad hat; its colours are rain blue, lily green, sky white",snufflump:"a little woolly dust bunny: a soft round ball of beige fluff with two long floppy ears, a small pink nose, two button eyes nearly hidden in the fluff, and tiny feet poking out underneath; its colours are dust beige, nose pink, shadow brown",burrowl:"a little digging owl-mole: a round brown owl with big round goggle-like eyes, a short beak, soft feather tufts, and oversized pink mole paws for digging, with a bit of earth on its head; its colours are earth brown, paw pink, feather cream",prismite:"a little living crystal prism: a creature cut from clear faceted gemstone, its body a cluster of sharp translucent crystal spikes through which light splits into rainbow slivers, with two small bright eyes set in the largest facet and tiny crystal feet; its colours are clear crystal white, rainbow slivers, deep gem blue",thundrake:"a little storm-cloud dragon: a small four-legged dragon standing on four short legs, whose body is a dark puffy storm cloud, with two jagged yellow lightning-bolt horns, a long cloud tail that drips rain, bright electric eyes, and a few detached sparks crackling around it; its colours are storm grey, lightning yellow, rain blue",clockrit:"a little clockwork critter: a small round brass clockwork animal, like a wind-up toy mouse, with a big round ivory clock-face on its belly with two hands, a wind-up key on its back, two small bead eyes and a thin pendulum tail; its colours are brass gold, clock-face ivory, gear copper",wickwisp:"a little candle ghost: a small stub of pale dripping candle wax with two hollow dark eyes and a tiny mouth, and a little flame floating just above its head in place of hair, trailing a wisp of smoke; its colours are candle cream, flame orange, shadow violet",cauldrop:"a little walking cauldron: a small black iron cauldron on three stubby legs, brim-full of bubbling bright-purple potion, with a slimy potion face peering over the rim and bubbles popping above it; its colours are iron black, potion purple, bubble green",webbit:"a little cobweb spider with a lantern belly: a fluffy grey spider spun from cobweb thread, with eight thin legs, several small shining eyes, and a round belly that glows like a paper lantern in amber light; its colours are cobweb grey, lantern amber, night black"},vn="Pixel art, 16-bit game sprite, chunky square pixels, thick dark outline, flat colours, limited palette.",Ls="Simple, bold, readable face with small eyes and a small mouth.",Jn="Plain flat white background.",ft="text, letters, numbers, labels, watermark, signature, border, frame, grid lines, UI, photo, realistic, 3D render, painting, smooth vector art, blurry, soft shading, gradient, anti-aliasing, dithering",gi=`${ft}, human, person, cropped`,$s=e=>e.trim()?`${ft}, cropped`:gi,Hs=`${ft}, shadow, ground, floor, scenery, multiple creatures, human, person`,di=`${Hs}, face, eyes, mouth, nest`,Us=`${ft}, shadow, ground, scenery, overlapping drawings, human, person`,Ds=`${ft}, animal, pet, creature, shadow, ground, scenery, extra people, cropped`,zs=`${ft}, characters, people, person, creatures, animals, pets`,Bs=e=>e==="egg"?di:Hs,pi="Same creature as the reference image: keep its shape, colours and markings.";function Gs(e,t,n=""){let s=Ue(e),a=n.replace(/\s+/gu," ").trim(),r=e.lockedStage??e.stage,o=e.design,l=o?`${Ft(o.kind)}: ${(o.stages[r]??o.look).replace(/[.\s]+$/u,"")}; its colours are ${o.colours.join(", ")}`:ui[e.species],c=o?"":r==="elder"?", wearing little round spectacles and a few white whiskers":r==="hatchling"?", small and round":"";return[vn,`A little virtual pet creature: ${l}.`,`${s?`Its face and pose look ${s.readsAs}. `:""}Life stage: ${r}${c}.`,t?pi:"",Ls,...a?[`Full body. ${a.charAt(0).toUpperCase()}${a.slice(1)}${/[.!?]$/u.test(a)?"":"."}`]:["One single creature, full body, centred.",Jn]].filter(Boolean).join(" ")}var mi=400;function Ks(e,t,n,s){let a=t.replace(/\s+/gu," ").trim().slice(0,mi).replace(/[.\s]+$/u,"");return[vn,...s,"Each one full body, standing, in the same outfit, with chibi game-sprite proportions: a big head, about three heads tall.",a?`What ${e} looks like: ${a}.`:"",n>0?`Keep ${e}'s hair, face, outfit and colours from the reference image${n>1?"s":""}.`:"",Jn].filter(Boolean).join(" ")}function Fs(e,t,n){return Ks(e,t,n,[`Eight drawings of the same character, ${e}, in two rows, all the same size and evenly spaced, with a wide gap of white around each one so no hair, tail, hand or held thing touches the next drawing.`,"The top row has five, seen from the front: calm; happy and smiling; worried; talking, mouth open and one hand raised a little; waving hello.","The bottom row has three, seen from the side, facing the left edge of the picture and looking down: holding out a small bowl; holding out a small toy; reaching down gently with both hands."])}function fi(e,t,n){return Ks(e,t,n,[`Three drawings of the same character, ${e}, in one row, seen from the front, all the same size and evenly spaced, with a wide gap of white around each one so nothing touches the next drawing: calm; happy and smiling; worried.`])}function qs(e,t,n,s){let a=[{prompt:Fs(e,t,n.length),references:n}];return n.length>0&&a.push({prompt:Fs(e,t,0),references:[]}),s&&a.push({prompt:fi(e,t,0),references:[]}),a}var Vs={earlier:"Same creature as the reference image, at an earlier stage: keep its colours and markings as it grows.",before:"The reference image shows what this creature was before it evolved: keep a hint of its colours."};function js(e,t,n){let s=(e.stages[t]??e.look).replace(/[.\s]+$/u,"");return[vn,t==="egg"?`The egg of a small creature, ${Ft(e.kind)}: ${s}.`:`A small creature, ${Ft(e.kind)}, at its ${t} stage: ${s}.`,`Its colours are ${e.colours.join(", ")}.`,n?Vs[n]:"",t==="egg"?"One single egg with no face, upright and centred, filling most of the picture.":`${Ls} One single creature, full body, seen from the front and centred, filling most of the picture.`,Jn].filter(Boolean).join(" ")}function Zn(e){return He.filter(t=>e.stages[t])}var hi="The same pixel size, palette and line weight in every drawing. Simple, bold, readable faces with small eyes and a small mouth.",bi="Plain flat white background everywhere.";function Ws(e,t){let n=Zn(e),s=c=>(e.stages[c]??e.look).replace(/[.\s]+$/u,""),a=n[0]==="egg",r=n.reduce((c,u)=>c+(u==="egg"?2:4),0),o=n.map((c,u)=>c==="egg"?`Row ${u+1}, the egg, only two drawings. Left: the whole egg, ${s(c)}. Next to it: the same egg beginning to crack, with one jagged crack and a small chip lifting off; nothing shows through. Both eggs have NO face: no eyes, no mouth, no expression, and they are the same size.`:`Row ${u+1}, ${c}, four drawings: ${s(c)}.`),l="and no more, never a repeat, evenly spaced, with wide empty white gaps between every drawing and between the rows, so nothing in one row touches the row above or below (flames, drips and tails included).";return[`${vn} A sprite sheet of one small creature, ${Ft(e.kind)}: ${e.look} Its colours are ${e.colours.join(", ")}.${t?` ${Vs[t]}`:""}`,"",a?`Lay out ${r} drawings in ${n.length} rows: exactly two drawings in row 1 and exactly four drawings in each of rows 2 to ${n.length}, ${l}`:`Lay out ${r} drawings in ${n.length} rows: exactly four drawings in each row, ${l}`,...o,"",`${a?`In rows 2 to ${n.length}`:"In every row"}, left to right: first the creature happy, seen from the front, with a big smile and its arms or limbs raised, feet on the ground; second the creature content, seen from the front, standing upright and calm with a small smile; third the creature grumpy, seen from the front, frowning and cross; fourth the same creature calm, seen in side profile facing right, like a walking game sprite, so one eye and one side show. Do not write these words or any label on the picture. All four drawings in a row are the same creature at the same stage, in the same colours, at the same size and with the same body shape; only the face and pose change. ${a?"Growth must read clearly: the hatchling is small and round and the elder is full size.":"The elder is as big as the adult and looks older."}`,"",hi,"",bi].join(`
`)}function ea(e){if(e.stage==="egg")return As;if(!e.design)return Ts[e.species];let[t,n,s]=e.design.colours;return`a cosy little room in ${t}, ${n} and ${s} tones: a small round window, a low shelf of curious trinkets, soft cushions and a woven rug`}var yi="Pixel art, 16-bit game background, chunky square pixels, flat colours, limited palette.";function Qs(e){return`${yi} A wide side-on scene of ${e.trim().replace(/[.\s]+$/u,"")}, seen like a stage set: the back wall and scenery across the top, and an empty, flat, evenly lit floor along the bottom from edge to edge.`}var wn=globalThis.__MARINARA_HOST__,fe=wn&&wn.version===1&&wn.modules?wn.modules["react-dom"]:void 0;if(!fe)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var Yu=fe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Xu=fe.browser,Ys=fe.createPortal,Ju=fe.default,Zu=fe.flushSync,eg=fe.preconnect,tg=fe.prefetchDNS,ng=fe.preinit,ag=fe.preinitModule,sg=fe.preload,rg=fe.preloadModule,og=fe.requestFormReset,ig=fe.unstable_batchedUpdates,lg=fe.useFormState,cg=fe.useFormStatus,ug=fe.version;function be({text:e,label:t,trigger:n,children:s}){let[a,r]=U(null),[o,l]=U(null),c=Q(null),u=Q(null),p=Qt();Ge(()=>{let b=c.current?.getBoundingClientRect(),y=u.current?.getBoundingClientRect();if(!a||!b||!y){l(null);return}let h=8,g=b.top-6-y.height;l({top:g>=h?g:b.bottom+6,left:Math.max(h,Math.min(b.left+b.width/2-y.width/2,window.innerWidth-h-y.width))})},[a]),W(()=>{if(!a)return;let b=h=>{let g=h.target;!c.current?.contains(g)&&!u.current?.contains(g)&&r(null)},y=h=>h.key==="Escape"&&r(null);return document.addEventListener("pointerdown",b),document.addEventListener("keydown",y),()=>{document.removeEventListener("pointerdown",b),document.removeEventListener("keydown",y)}},[a]);let d=()=>r(b=>b??"shown"),m=()=>r(b=>b==="shown"?null:b);return f("span",{className:"sl-with-help",children:[s,i("button",{ref:c,type:"button",className:n?"sl-help sl-help--text":"sl-help","aria-label":t,"aria-expanded":a!==null,"aria-describedby":a?p:void 0,onMouseEnter:d,onMouseLeave:m,onFocus:d,onBlur:m,onKeyDown:b=>{b.key!=="Escape"||!a||(b.preventDefault(),b.stopPropagation(),r(null))},onClick:()=>r(b=>b==="pinned"?null:"pinned"),children:n??f("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:[i("circle",{cx:"12",cy:"12",r:"10"}),i("path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}),i("path",{d:"M12 17h.01"})]})}),a?Ys(i("div",{ref:u,id:p,role:"tooltip",className:"sl-help-tip",style:o?{top:o.top,left:o.left}:{top:0,left:0,visibility:"hidden"},children:e}),document.body):null]})}var ae=52,ze=100,Xs=[4,6,8,10,12,14,16,19,22],sa={hatchling:{t:21,l:12,r:39,m:30},juvenile:{t:13,l:9,r:42,m:25},adult:{t:5,l:7,r:44,m:19},elder:{t:4,l:7,r:44,m:19}},ra={embers:"rise",wisps:"rise",bubbles:"rise",snow:"fall",leaves:"fall",petals:"fall",stars:"twinkle",glints:"twinkle",sparks:"twinkle"},Sn={ember:["#2a0f0a","#8a2a12","#d9581e","#ff9a3c","#ffe08a"],frost:["#0f1a33","#2c5a9a","#5fa0e0","#a8dcff","#f2fbff"],moss:["#10220f","#2f5e1e","#5c9a2e","#9fd35a","#e4f7a8"],dusk:["#170f2e","#46287a","#7d4fc4","#b58cff","#ecdcff"],gilded:["#2a1a05","#7a5410","#c99a1e","#ffd84a","#fff6c2"],shade:["#0e0c14","#2e2a3c","#575070","#8f86ad","#cfc8e6"],bloom:["#2e0f1e","#8a3060","#d9609a","#ff9fcb","#ffe6f2"],storm:["#12141f","#2e3550","#56607f","#8d96b5","#d6dcef"],tide:["#08202a","#145a6a","#2a9a9a","#6ad8c8","#d8fff4"],spark:["#2a1f05","#8a6a10","#e0c020","#fff050","#ffffe0"]},ar=["#1c1917","#57534e","#a8a29e","#e7e5e4","#fafaf9"],vi={ember:"#ff7a3d",frost:"#8fd8ff",moss:"#7fd35a",dusk:"#b58cff",gilded:"#ffd84a",shade:"#a99cc8",bloom:"#ff9fcb",storm:"#f5ec5a",tide:"#5fe0d0"};var sr={"webbit:elder":[42,33]};function Ut(e,t){let n=document.createElement("canvas");n.width=e,n.height=t;let s=n.getContext("2d",{willReadFrequently:!0});if(!s)throw new Error("No 2D canvas.");return s.imageSmoothingEnabled=!1,[n,s]}var oa=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),Js=new WeakMap;function ia(e,t,n){let s=Js.get(e);s||Js.set(e,s=new Map);let a=s.get(t);return a||s.set(t,a=n()),a}function wi(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function ta(e,t,n=0){return ia(e,`t|${t}|${n}`,()=>{let s=(t==="neutral"?ar:Sn[t]).map(oa),[a,r]=Ut(e.width,e.height);r.drawImage(e,0,0);let o=r.getImageData(0,0,a.width,a.height),l=o.data;for(let c=0;c<l.length;c+=4){if(!l[c+3])continue;let u=Math.min(1,(.2126*l[c]+.7152*l[c+1]+.0722*l[c+2])/255+n),p=Math.min(3,Math.floor(u*4)),d=(u-p/4)*4;for(let m=0;m<3;m++)l[c+m]=Math.round(s[p][m]+d*(s[p+1][m]-s[p][m]))}return r.putImageData(o,0,0),a})}function ht(e,t,n,s,a){return ia(e,`s|${t}|${n}|${s}|${a}`,()=>{let r=e.getContext("2d").getImageData(t,n,ae,ae).data,o=ae+2*s,l=ae+2*s,c=new Uint8Array(o*l);for(let h=0;h<ae;h++)for(let g=0;g<ae;g++)c[(h+s)*o+g+s]=r[(h*ae+g)*4+3]?1:0;for(let h=0;h<s;h++){let g=c.slice();for(let v=0;v<l;v++)for(let k=0;k<o;k++){let x=v*o+k;!c[x]&&(k>0&&c[x-1]||k<o-1&&c[x+1]||v>0&&c[x-o]||v<l-1&&c[x+o])&&(g[x]=1)}c=g}let[u,p]=Ut(o,l),d=p.createImageData(o,l),[m,b,y]=oa(a);for(let h=0;h<c.length;h++)c[h]&&d.data.set([m,b,y,255],h*4);return p.putImageData(d,0,0),u})}var Si=[[[0,0],[-1,-1],[-1,-2],[-2,-3],[-2,-4],[-3,-5],[-3,-6],[-4,-7]],[[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]],[[0,0],[0,1],[-1,2],[-1,3],[0,4],[-1,5],[-1,6],[-2,7]]];function ki(e,t,n,s,a,r){return ia(e,`c|${t}|${n}|${s}|${r}|${a.cx}|${a.mid}`,()=>{let[o,l]=Ut(ae,ae);l.drawImage(ht(e,t,n,0,"#ffffff"),0,0),l.globalCompositeOperation="source-atop",l.fillStyle=r;for(let c=0;c<s;c++)for(let[u,p]of Si[c])l.fillRect(a.cx+u,a.mid+p,1,1);return o})}function Ee(e,t,n,s,a,r=1,o,l){if(r<=0)return;let c=l?l[2]:t.width,u=l?l[3]:t.height,p=o??c;e.save(),e.globalAlpha*=r,a&&(e.translate(2*n+p,0),e.scale(-1,1)),l?e.drawImage(t,l[0],l[1],c,u,n,s,p,u):e.drawImage(t,n,s,p,u),e.restore()}var xi=e=>{let t=sa[e];return{...t,cx:t.l+t.r>>1,mid:t.t+51>>1}},aa=class{constructor(){se(this,"view","happy");se(this,"col",0);se(this,"dx",0);se(this,"dy",0);se(this,"flip",!1);se(this,"alpha",1);se(this,"hide",!1);se(this,"boost",0);se(this,"white",0);se(this,"crack",0);se(this,"ringA",null);se(this,"evo",null);se(this,"body",null);se(this,"fadeNew",0);se(this,"aura",!0);se(this,"extra",!0);se(this,"extraDy",0);se(this,"dim",0);se(this,"shake",0);se(this,"thread",null);se(this,"list",[]);se(this,"marks",[]);se(this,"after",[]);se(this,"rings",[])}fx(t,n,s,a,r={}){this.list.push({name:t,frame:n,x:s,y:a,...r})}mark(t,n,s,a,r={}){this.marks.push({name:t,frame:n,x:s,y:a,life:16,anchor:"bc",...r})}};function Zs(e,t){let n=t.width,s=t.height;switch(e.anchor){case"c":return[e.x-(n>>1),e.y-(s>>1)];case"bc":return[e.x-(n>>1),e.y-s];case"bl":return[e.x,e.y-s];case"cl":return[e.x,e.y-(s>>1)];default:return[e.x,e.y]}}var F=(e,t,n)=>e>=t&&e<n,Lt=(e,t,n)=>{e.view=t>=1&&t<n-1?"side":"happy"},De=(e,t,n,s,a=1)=>[e+Math.round(Math.cos(s)*n),t+Math.round(Math.sin(s)*n*a)];function Ei(e,t,n,s,a){let r=[9,6,3][t-2];for(let[o,l]of[[1,-1],[1.3,0],[1,1]])e.fx(n,t,s+Math.round(r*o),a+Math.round(r*l),{anchor:"c"})}var Ht={firepuff:{dir:!0,hit:5,steps:e=>e?17:15,run(e,t,n){Lt(e,t,n.n);let s=n.E?[0,1,2,4,4,3]:[0,1,2,3];F(t,2,5)&&(e.col=1),F(t,5,7)&&(e.col=2,e.dx=-1);let[a,r]=n.mouth[e.col];F(t,2,5)&&Ei(e,t,"embers",a,r),F(t,5,5+s.length)&&e.fx("flamepuff",s[t-5],a+(t-5===s.length-1?2:0),r,{anchor:"cl",follow:t<7});for(let o of n.E?[4+s.length,6+s.length]:[4+s.length]){let l=t-o;F(l,0,4)&&e.fx("smokering",l,a+20+3*l,r-3-2*l,{anchor:"c",ramp:"neutral"})}}},roar:{hit:6,steps:e=>e?18:15,run(e,t,n){let s=n.E?15:12;F(t,3,6)&&(e.col=1),F(t,6,s)&&(e.col=2,e.dx=t%2?2:-2,e.shake=t%2?1:-1,e.fx("bang",0,n.r+2,n.m-8,{follow:!0,ramp:null})),F(t,6,10)&&e.fx("burstring",t-6,n.r+4+3*(t-6),n.m,{anchor:"c",alpha:[1,.7,.45,.25][t-6]});let a=[n.l+3,n.r-3,n.cx,n.l+8,n.r-8,n.cx-5];for(let r=0;r<(n.E?6:3);r++){let o=t-6-r;F(o,0,7)&&e.fx("wisp",o>>1,a[r]+o%2,49-3*o,{anchor:"c",alpha:o>=5?.5:1})}}},icicles:{dir:!0,hit:4,steps:e=>e?21:17,run(e,t,n){Lt(e,t,n.n);let s=[[0,0],[2,-1],[2,-2],[2,-3],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]);let a=n.E?[2,4,5,7,8]:[2,4,6],r=n.E?16:13;F(t,4,6)&&e.fx("snow",t-4,n.r+2,50,{anchor:"c"}),a.forEach((o,l)=>{let c=n.r+7+9*l,u=t-4-2*l;F(u,0,3)&&t<r?e.fx("icicle",o-2+u,c,52,{anchor:"bc"}):u>=3&&t<r&&e.fx("icicle",o,c,52,{anchor:"bc"}),t===r&&e.fx("icicle",o,c,52,{anchor:"bc",alpha:.5}),l===a.length-1&&F(u,3,7)&&e.fx("glint",u-3,c-1,55-Xs[o],{anchor:"c"});for(let p=0;p<3&&F(t-r,0,3);p++){let d=t-r,m=Xs[o];e.fx("shard",(l+p)%4,c+(p-1)*(2+2*d),52-m+4*p+d*d+2*d,{anchor:"c",alpha:d===2?.5:1})}}),t===r&&e.mark("frostpatch",1,n.r+4,52,{anchor:"bl",life:18}),n.E&&t===r&&e.mark("frostpatch",1,n.r+22,52,{anchor:"bl",life:18})}},twirl:{hit:4,steps:e=>e?16:12,run(e,t,n){let s=n.E?[[1,0],[1,0],[2,-2],[2,-3],[0,-4],[0,-5],[0,-5],[0,-5],[0,-4],[0,-3],[2,-2],[2,-1],[1,0],[1,0]]:[[1,0],[1,0],[2,-2],[2,-2],[0,-3],[0,-3],[0,-3],[0,-2],[2,-2],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),F(t,2,s.length-1)&&(e.view=(t-2)%2?"side":"happy",e.flip=(t-2>>1)%2===1);let a=n.E?6:4,r=t-4;for(let o=0;o<a&&F(r,0,8);o++){let[l,c]=De(n.cx,n.mid,6+3*r,o/a*2*Math.PI+.4,.5);e.fx("snow",r+o,l,c+r,{anchor:"c"})}}},leafwhirl:{hit:3,steps:e=>e?22:18,run(e,t,n){let s=n.n-4;F(t,1,3)&&(e.col=1),F(t,3,s)&&(e.col=t===3?2:0,e.dy=t===3?-1:n.E?-3:-2),t===s&&(e.dy=-1),t===s+1&&(e.col=1);let a=n.E?8:6,r=(n.r-n.l)/2+4,o=s-3;for(let l=0;l<a&&F(t,3,s+3);l++){let c=(t-3)*(Math.PI/3.5)+l/a*2*Math.PI,u=Math.max(0,Math.min(1,(t-3-l*.5)/(o-2))),p=50-Math.round(u*(50-n.t+6)),d=t-s,[m,b]=De(n.cx,p,r,c,.25);d>=0&&([m,b]=[m+Math.round(Math.cos(c)*6*(d+1)),b-2*(d+1)+d*d]),e.fx("leaf",(t+l)%3,m,b,{anchor:"c",follow:d<0,alpha:d>=1?.5:1,layer:Math.sin(c)<0&&d<0?"back":"front"})}}},wiggle:{hit:4,steps:e=>e?16:12,run(e,t,n){F(t,2,n.n-2)&&(e.dx=t%2?1:-1,e.col=t%2?1:0),(n.E?[n.r+7,n.l-7]:[n.r+7]).forEach((a,r)=>{let o=t-4-2*r;F(o,0,2)&&e.fx("sprout",o,a,52,{anchor:"bc"}),o===2&&e.mark("sprout",2,a,52,{life:18})})}},petalshower:{hit:3,steps:e=>e?28:25,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0);let s=n.E?12:8,a=t-3,r=n.t-3;for(let o=0;o<s&&a>=0;o++){let l=o%2?1:-1,c=l*(4+2*((o>>1)%3)),u=(o>>1)%2*3,p,d;if(a<=3)[p,d]=[n.cx+c*a,r-[0,5,9,11][a]-u];else{let m=a-3;[p,d]=[n.cx+c*3+l*Math.floor(m/3)+((m>>1)%2?2:-2),r-11-u+3*m]}d<49&&e.fx("petal",(a+o)%3,p,d,{anchor:"c"})}t===9&&e.mark("flower",0,n.r+7,52,{life:20}),n.E&&t===11&&e.mark("flower",0,n.l-7,52,{life:18})}},triplehop:{hit:13,steps:()=>18,run(e,t,n){let s=n.E?[5,9,14]:[4,7,11],a=[[1,0]],r=[];for(let o of s){let l=Math.ceil(o/2);a.push([2,-l],[2,-o],[0,-o],[0,-l],[1,0]),r.push(a.length-1)}t<a.length&&([e.col,e.dy]=a[t]),r.forEach((o,l)=>{let c=t-o,u=l===2?8:4;for(let p=0;p<u&&F(c,0,4);p++){let d=p%2===0,m=p>>1;e.fx("petal",(c+p)%3,d?n.l+1-2*c-4*m:n.r-1+2*c+4*m,49-2*c-2*m+(c*c>>1),{anchor:"c",alpha:c===3?.5:1})}if(F(c,0,2))for(let p of[n.l,n.r])e.fx("dust",c,p,52,{anchor:"bc",ramp:"neutral"})})}},starburst:{hit:6,steps:e=>e?16:14,run(e,t,n){if(F(t,3,6)&&(e.col=1),F(t,6,8)&&(e.col=2),t<6)for(let a=0;a<6;a++){let[r,o]=De(n.cx,n.mid,[28,23,18,13,9,5][t],(a+.5)/6*2*Math.PI+t*.15);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}let s=n.E?[[6,0,7],[8,.5,9]]:[[6,0,7]];for(let[a,r,o]of s){let l=t-a;for(let c=0;c<6&&F(l,0,6);c++){let[u,p]=De(n.cx,n.mid,8+o*l,(c+r)/6*2*Math.PI);e.fx("bigstar",[2,3,2,3,1,0][l],u,p,{anchor:"c",alpha:l>=4?.5:1})}}}},float:{hit:4,steps:e=>e?18:16,run(e,t,n){let s=n.E?-14:-10,a=[0,-1,-4,-8],r=n.n-4;t<4?e.dy=Math.max(s,a[t]):t<r?e.dy=s+Math.floor((t-4)/3)%2:e.dy=[-6,-2,0,0][t-r],e.dy<0&&e.fx("shadow",Math.min(3,Math.floor(-e.dy/3)),n.cx,51,{anchor:"c",layer:"floor",ramp:"neutral",alpha:.5}),t===n.n-2&&(e.col=1);for(let o=0;o<5;o++){let l=4+2*o,c=t-l;l>=r||!F(c,0,5)||e.fx("bigstar",[1,2,1,0,0][c],n.cx+[-8,6,-3,9,1][o],50+s+2*c,{anchor:"c",alpha:c===4?.5:1})}}},coinshower:{hit:3,steps:e=>e?24:22,run(e,t,n){F(t,1,3)&&(e.col=1),F(t,3,5)&&(e.col=2,e.dy=t===3?-1:0),(n.E?[-2.6,-2,-1.5,1.5,2,2.6,-3.2,3.2]:[-2.4,-1.7,1.7,2.4]).forEach((a,r)=>{let o=t-3-r%3;if(o<0)return;let l=n.cx+Math.sign(a)*6,c=n.t+4,u=a,p=-4-r%2,d=!1,m=-1;for(let y=0;y<o&&m<0;y++)l+=u,p+=1,c+=p,c>=47&&(c=47,d&&(m=y+1),p=d?0:-3,u/=2,d=!0);let b=Math.round(l);m<0?e.fx("coin",o,b,c,{anchor:"c"}):(m===o&&e.mark("coinflat",0,b,52,{life:14}),o-m<4&&e.fx("glint",o-m,b+3,45,{anchor:"c"}))})}},sparkle:{hit:2,steps:e=>e?18:14,run(e,t,n){t===1&&(e.col=1),t===2&&(e.col=2),[[n.l-6,n.t+4],[n.r+5,n.t+9],[n.l-3,n.m+13],[n.r+3,n.m+18],[n.cx+4,n.t-6],[n.l-9,n.m+2],[n.r+8,n.m],[n.cx-7,n.m+24]].slice(0,n.E?8:4).forEach(([a,r],o)=>{let l=t-4-2*(o%4)-(o>=4?1:0);F(l,0,5)&&e.fx("glint",l,a,r,{anchor:"c"})});for(let a=0;a<6&&F(t,2,5);a++){let[r,o]=De(n.cx,n.mid,10+7*(t-2),(a+.5)/6*2*Math.PI);e.fx("bigstar",[1,2,0][t-2],r,o,{anchor:"c",alpha:t===4?.5:1})}}},shine:{hit:2,steps:e=>e?18:14,run(e,t,n){for(let s of n.E?[2,7,12]:[2,8]){let a=t-s;F(a,0,3)&&(e.boost=.25,e.ringA=a===1?.8:.35),F(a,0,4)&&e.fx("glint",[1,2,3,4][a],n.r-4,n.t+3,{anchor:"c"});for(let r=0;r<8&&F(a,0,3);r++){let[o,l]=De(n.cx,n.mid,(n.r-n.l)/2+3+3*a,r/8*2*Math.PI,.9);e.fx("bigstar",[0,1,0][a],o,l,{anchor:"c",alpha:a===2?.5:1})}}t===1&&(e.col=1),t===2&&(e.col=2)}},shockwave:{hit:5,steps:e=>e?17:14,run(e,t,n){let s=[[0,0],[1,0],[2,-1],[2,-3],[2,-4],[1,0],[1,0]];t<s.length&&([e.col,e.dy]=s[t]),t===5&&(e.shake=1),t===6&&(e.shake=-1);for(let a of n.E?[5,7]:[5])F(t-a,0,6)&&e.fx("shockring",t-a,n.cx,51,{anchor:"c",layer:"floor"});if(F(t,5,8))for(let[a,r]of[[n.l-3,-1],[n.r+3,1]])e.fx("dust",Math.min(1,t-5),a+3*r*(t-5),52,{anchor:"bc",ramp:"neutral",alpha:t===7?.5:1})}},vanish:{hit:10,steps:()=>14,travel:(e,t)=>t?0:e?40:24,run(e,t,n){let s=n.travel;F(t,1,4)&&(e.col=1),e.alpha={2:.66,3:.33,9:.33,10:.66}[t]??1,F(t,4,9)&&(e.hide=!0),t>=9&&(e.dx=s),F(t,10,12)&&(e.col=2);for(let a=0;a<(n.E?8:6);a++){let r=[-8,8,-3,4,-12,11,0,-6][a],o=[2,0,8,12,10,6,-2,16][a],l,c;if(F(t,2,5))[l,c]=[n.cx+r,n.mid+o-2*(t-2)];else if(F(t,5,9)){let u=t-5,p=s?0:Math.round(4*Math.cos((u+a)*Math.PI/2));[l,c]=[n.cx+r+Math.round(s*(u+1)/5)+p,n.mid+o-6+(u+a)%2]}else if(F(t,9,11))[l,c]=[n.cx+s+Math.round(r*(1-(t-9)/2)),n.mid+o-4+2*(t-9)];else continue;e.fx(a%2?"wisps":"wisp",t+a,l,c,{anchor:"c"})}}},zap:{dir:!0,hit:6,steps:e=>e?15:12,run(e,t,n){if(Lt(e,t,n.n),F(t,2,6))for(let a=0;a<4;a++){let[r,o]=De(n.cx,n.t-1,[20,15,10,5][t-2],(a+.5)/4*2*Math.PI+t*.3,.6);e.fx("bigstar",(t+a)%2+1,r,o,{anchor:"c"})}F(t,4,6)&&(e.col=1),F(t,6,8)&&(e.col=2);let s=n.E?[[6,n.r+16],[9,n.r+34]]:[[6,n.r+16]];for(let[a,r]of s){let o=t-a;F(o,0,3)&&e.fx("bolt",o===1?1:0,r,52,{anchor:"bc",alpha:o===2?.5:1}),o===1&&e.mark("scorch",0,r,52,{ramp:"neutral",life:18});for(let l=0;l<6&&F(o,1,5);l++)e.fx("bigstar",[2,1,1,0][o-1],r+(l%2?1:-1)*(3+3*o+2*(l>>1)),50-2*o-(l>>1)*3+(o*o>>1),{anchor:"c"})}}},dash:{dir:!0,hit:4,steps:()=>13,travel:(e,t)=>t?0:e?44:30,run(e,t,n){Lt(e,t,n.n);let s=n.travel,a=s?[0,Math.round(s*.3),Math.round(s*.65),s]:[1,2,3,3];if(F(t,2,4)&&(e.col=1,e.dx=-1),F(t,4,8)){let r=t-4;e.col=r<2?2:0,e.dx=a[r];for(let o=1;o<=(n.E?3:2);o++){let l=s?a[r-o]:a[r]-3*o;l!==void 0&&l!==a[r]&&e.after.push({dx:l,alpha:[.5,.3,.15][o-1]})}}if(F(t,8,10)){e.col=1,e.dx=(s||3)+1,e.fx("dust",t-8,n.l-3,52,{anchor:"bc",follow:!0,ramp:"neutral"}),e.fx("dust",t-8,n.l-11-2*(t-8),52,{anchor:"bc",follow:!0,ramp:"neutral",alpha:.6});for(let r=0;r<3;r++)e.fx("bigstar",(t-8+r)%3,n.r+3+3*r,49-3*r-2*(t-8),{anchor:"c",follow:!0})}t>=10&&(e.dx=s||[1,0][t-10]||0)}},bubbleblow:{dir:!0,hit:10,light:17,steps:e=>e?30:23,run(e,t,n){Lt(e,t,n.n),F(t,2,4)&&(e.col=1),F(t,4,10)&&(e.col=2);let[s,a]=n.mouth[2];F(t,4,10)&&e.fx("bubble",t-4,s,a,{anchor:"cl"});let r=n.E?[[10,6,2],[13,5,3],[16,4,2]]:[[10,6,2]];for(let[o,l,c]of r){let u=t-o,p=s+9+2*u,d=a-c*u+u%2;F(u,0,7)&&e.fx("bubble",l,p,d,{anchor:"c"}),F(u,7,9)&&e.fx("pop",u-7,p,d,{anchor:"c"});for(let m=0;m<6&&F(u,8,14);m++){let b=u-8,y=[-3,-2,-1,1,2,3][m];e.fx("droplet",0,p+y*(b+2),d+b*b-3*b-1+m%2*2,{anchor:"c",alpha:b>=5?.5:1})}}}},splash:{hit:8,steps:e=>e?18:15,run(e,t,n){let s=n.E?[-5,-11,-16,-18,-18,-16,-11,-5]:[-4,-9,-13,-15,-13,-9,-4],a=[[1,0],[1,0],...s.map((l,c)=>[c<2||c===s.length-1?2:0,l]),[1,0],[1,0]],r=2+s.length;t<a.length&&([e.col,e.dy]=a[t]);for(let l of n.E?[r,r+2]:[r])F(t-l,0,5)&&e.fx("waterring",t-l,n.cx,51,{anchor:"c",layer:"floor"});let o=t-r;F(o,0,3)&&e.fx("crown",o,n.cx,52,{anchor:"bc"});for(let l=0;l<(n.E?10:8)&&F(o,0,8);l++){let c=[-5,-3,-2,-1,1,2,3,5,-4,4][l],u=6-Math.abs(c)%3;e.fx("droplet",0,n.cx+c*(o+2),46-u*o+o*o,{anchor:"c",alpha:o>=6?.5:1})}}}},Dt=(e,t)=>Ht[e].steps(t),rr=(e,t,n)=>Ht[e].travel?.(t,n)??0,or=e=>!!(Ht[e].dir||Ht[e].travel),la=54,ca=16,ir=e=>e.kind==="move"?Dt(e.move,e.encore):e.kind==="hatch"?ua:e.reduced?ca:la,Ci=(()=>{let e=wi(7);return Array.from({length:16},()=>{let t=e()*4|0,n=e();return[[n*176,-2],[178,n*99*.8],[n*176,-2],[-2,n*99*.8]][t]})})(),er=[12,20,27,33,38,42];function Ri(e,t,n,s,a,r){if(r){e.evo=t>=12,e.body=t>=12?"new":"old",F(t,4,12)&&(e.fadeNew=[.25,.5,.75,1][t-4>>1]);return}e.evo=t>=44,e.aura=e.extra=t>=46,e.dim=t<10?(t+1)*.06:t<44?.6:[.4,.25,.1][t-44]??0;let o=s+26,l=a+n.mid;t<21&&Ci.forEach(([c,u],p)=>{let d=c+s-62,m=u+a-39,b=Math.min(1,(t+1+p%4)/22)**1.5;b<.92&&e.fx(p%3?"speck":"bigstar",0,Math.round(d+(o-d)*b),Math.round(m+(l-m)*b),{world:!0})}),F(t,10,44)&&(e.col=1),F(t,44,46)&&(e.col=2),F(t,10,22)&&(e.white=[.33,.66][t-10]??(er.includes(t)?1:.75)),e.body=t<28?"old":t<33?"new":t<37?"old":t<41?"new":t<44?"old":"new",F(t,41,44)&&(e.white=1,e.crack=t-40);for(let c of er)F(t-c,0,3)&&e.rings.push({d:[2,4,6][t-c],a:[.9,.5,.25][t-c],c:"#ffffff"});F(t,44,49)&&e.fx("burstring",t-44,n.cx,n.mid,{anchor:"c"});for(let c=0;c<8&&F(t,44,52);c++){let u=t-44,[p,d]=De(n.cx,n.mid,4+5*u,(c+.5)/8*2*Math.PI);e.fx("shard",c,p,d+(u*u>>1),{anchor:"c",alpha:u>=6?.5:1})}F(t,46,53)&&(e.extraDy=[-20,-14,-8,-3,0,-2,0][t-46])}var lr={prismite:{how:"crack",colour:"frost",moves:["starburst"]},thundrake:{how:"crack",colour:"storm",moves:["zap"]},clockrit:{how:"crack",colour:"gilded",moves:["shockwave"]},wickwisp:{how:"crack",colour:"ember",moves:["firepuff"]},cauldrop:{how:"crack",colour:"moss",moves:["bubbleblow","splash"]},webbit:{how:"thread",colour:"dusk",moves:[]}},ua=24,tr=[2,7,11],Mi=e=>[[15,e.l-3,e.t+3],[17,e.r+2,e.m],[19,e.cx+2,e.t-4]];function Ii(e,t,n,s){if(s==="thread"){e.dy=t<10?-Math.round(92*(1-t/10)**2):[0,-3,-2,-1][t-10]??0,e.col=t<10?2:[1,2][t-10]??0,e.dim=t<10?.3:[.2,.1][t-10]??0,t<14?e.thread=e.dy+n.t+1:t<18&&(e.thread=n.t+1-25*(t-13));for(let[a,r,o]of Mi(n))F(t,a,a+3)&&e.fx("glint",t-a,r,o,{anchor:"c"});return}e.dim=t<6?(t+1)*.07:t<17?.42:[.28,.14][t-17]??0,e.col=t<14?1:F(t,17,19)?2:0,t<17&&(e.white=t<14&&!tr.includes(t)?.85:1),F(t,14,17)&&(e.crack=t-13);for(let a of tr)F(t-a,0,3)&&e.rings.push({d:[2,4,6][t-a],a:[.9,.5,.25][t-a],c:"#ffffff"});F(t,17,22)&&e.fx("burstring",t-17,n.cx,n.mid,{anchor:"c"});for(let a=0;a<8&&F(t,17,24);a++){let r=t-17,[o,l]=De(n.cx,n.mid,4+5*r,(a+.5)/8*2*Math.PI);e.fx("shard",a,o,l+(r*r>>1),{anchor:"c",alpha:r>=5?.5:1})}}function cr(e){e.getContext("2d").getImageData(0,0,1,1)}function nr(e,[t,n,s,a],r){let[o,l]=Ut(s,a);return l.drawImage(e,t*r,n*r,s*r,a*r,0,0,s,a),o}var na=new Map;function kn(e){let t=e("sprites/atlas.json"),n=na.get(t);return n||(n=(async()=>{let s=await fetch(t);if(!s.ok)throw new Error(`atlas ${s.status}`);let a=await s.json(),[r,o]=await Promise.all([Le(e(a.moves.path)),Le(e(a.extras.path))]),l={};for(let[p,d]of Object.entries(a.moves.pieces))l[p]=d.map(m=>nr(r,m,a.scale));let[c,u]=a.extras.artSize;return a.extras.rows.forEach((p,d)=>{l[`x-${p}`]=Array.from({length:a.extras.frames},(m,b)=>nr(o,[b*c,d*u,c,u],a.scale))}),cr(l.bang[0]),{pieces:l,raw:new Set(a.moves.raw)}})(),na.set(t,n),n.catch(()=>na.delete(t))),n}function Ni(e){let t=(p,d)=>e[(d*ae+p)*4+3]>0,n=[];for(let p=0;p<ae;p++)for(let d=0;d<ae;d++)if(t(d,p)){n.push(p);break}if(!n.length)return null;let s=n[0],a=n[n.length-1]-s+1,r=new Map;for(let p=s+Math.floor(.3*a);p<=s+Math.floor(.7*a);p++)for(let d=ae-1;d>=0;d--)if(t(d,p)){r.set(p,d);break}if(!r.size)return null;let o=Math.max(...r.values()),l=[...r].filter(([,p])=>p>=o-1),[c,u]=l[l.length>>1];return[u+1,c]}var $t=new Map;function ur(e,t,n,s=null){let a=JSON.stringify([e,t,n,s]),r=$t.get(a);return r||($t.size>32&&$t.clear(),r=(async()=>{let[o,l]=Ut(ae*3,ae*2);for(let[u,p]of[[e,0],[t??e,ae]]){let d=await Le(u.src),m=d.naturalHeight/u.rows;for(let b=0;b<3;b++){let y=u.frames===3?d.naturalWidth/3*b:0,h=u.frames===3?d.naturalWidth/3:d.naturalWidth;l.save(),n&&(l.translate((2*b+1)*ae,0),l.scale(-1,1)),l.drawImage(d,y,u.row*m,h,m,b*ae,p,ae,ae),l.restore()}}cr(o);let c=null;if(s)c=[s,s,s];else if(t){let u=[0,1,2].map(p=>Ni(l.getImageData(p*ae,ae,ae,ae).data));c=u.every(Boolean)?u:null}return{img:o,mouths:c}})(),$t.set(a,r),r.catch(()=>$t.delete(a))),r}var Ti=[0,.35,.8,.35],Ai=[[-2,.5],[-3,-1],[-3,-1],[-3,.5],[-2,1],[-1,1]],Pi={rise:e=>[[e.l-4,e.m+12],[e.r-1,e.m+8],[e.r-6,e.m+18]],fall:e=>[[e.l-3,e.t-2],[e.r-2,e.t+2],[e.r+1,e.m+2]],twinkle:e=>[[e.l-5,e.t+2],[e.r-1,e.m+6],[e.l-3,e.m+15]]},_i=[[0,0],[1,-2],[0,-4],[-1,-6],[0,-8],[1,-10],[0,-12],[-1,-14]],Oi=[[0,0],[1,2],[2,4],[1,6],[0,8],[1,10],[2,12],[1,14]];function Fi(e,t){let n=Math.floor(t/3);return e==="rise"?{frame:[0,0,0,1,1,1,2,2][n],d:_i[n]}:e==="fall"?{frame:[0,1,2,1,0,1,2,1][n],d:Oi[n]}:n<3?{frame:n,d:[0,0]}:null}function gr(e,t,n,s){let{ctx:a,art:r,body:o,colour:l,dir:c,X:u,Y0:p}=e,{width:d,height:m}=a.canvas,b=xi(e.stage),y=l==="storm"?"spark":l,h=vi[l],g=new aa,v=-99,k=-99;if(t?.kind==="move"){let w=Ht[t.move],N=w.steps(t.encore),H=o.mouths??[0,1,2].map(()=>[b.r,b.m]);w.run(g,n,{...b,mouth:H,E:t.encore,spot:t.spot,n:N,travel:t.travel}),v=n-w.hit,k=n-(w.light??w.hit)}else t?.kind==="hatch"?(Ii(g,n,b,t.how),v=k=n-(t.how==="thread"?10:17)):t&&(Ri(g,n,b,u,p,t.reduced),v=n-46,k=n-44);let x=!e.plain&&(g.evo??!0),_=t?.kind==="move"&&t.encore,P=(w,N)=>c>0?u+w:u+ae-w-N,B=P(g.dx,ae),C=p+g.dy,S=(w,N,H,D=0)=>{let q=r.pieces[w],j=q[(N%q.length+q.length)%q.length];return r.raw.has(w)||H===null?j:ta(j,H,D)},$=(w,N,H)=>{let[D,q,j]=oa(w),z=B+26,ee=p+30,ne=a.createRadialGradient(z,ee,4,z,ee,H?200:95);ne.addColorStop(0,`rgba(${D},${q},${j},${N})`),H&&ne.addColorStop(H,`rgba(${D},${q},${j},${N})`),ne.addColorStop(1,`rgba(${D},${q},${j},0)`),a.fillStyle=ne,a.fillRect(0,0,d,m)};if(a.save(),a.clearRect(0,0,d,m),g.shake&&a.translate(g.shake,0),e.lit&&g.dim&&$("#000000",g.dim,.55),e.lit&&t&&(x||e.plain)&&F(k,0,6)){let w=[1,1,.75,.5,.3,.15][k]*(_?1.4:1);l==="shade"?$("#000000",.38*w,0):$(h,.24*w,0)}let O=t?`${t.at}|${n}`:e.drawn;if(O!==e.drawn){e.drawn=O;for(let w of g.marks){let N=S(w.name,w.frame,w.ramp===void 0?y:w.ramp),[H,D]=Zs(w,N);e.marks.push({img:N,wx:P(H,N.width),wy:p+D,flip:c<0,born:s,life:w.life})}}e.marks=e.marks.filter(w=>s-w.born<w.life);for(let w of e.marks){let N=w.life-(s-w.born);Ee(a,w.img,w.wx,w.wy,w.flip,N<=3?N/4:1)}if(!t)return a.restore(),e.marks.length>0;let L=w=>{let N=S(w.name,w.frame,w.ramp===void 0?y:w.ramp),[H,D]=Zs(w,N);w.follow&&(H+=g.dx,D+=g.dy),w.world?Ee(a,N,H,D,!1,w.alpha??1):Ee(a,N,P(H,N.width),p+D,c<0,w.alpha??1)};g.list.filter(w=>w.layer==="floor").forEach(L),g.list.filter(w=>w.layer==="back").forEach(L);let E=g.col*ae,I=g.view==="side"?ae:0,R=c<0!==g.flip,T=o.img,M=[E,I,ae,ae];g.thread!==null&&p+g.thread>0&&(a.fillStyle=ar[3],a.globalAlpha=.8,a.fillRect(P(b.cx+g.dx,1),0,1,p+g.thread),a.globalAlpha=1);for(let w of g.after)Ee(a,ht(T,E,I,0,h),P(w.dx,ae),C,R,w.alpha);if(!g.hide){for(let H of g.rings)Ee(a,ht(T,E,I,H.d,H.c),B-H.d,C-H.d,R,g.alpha*H.a);let w=g.ringA??(x?Ti[s%24/6|0]:0);w&&Ee(a,ht(T,E,I,2,h),B-2,C-2,R,g.alpha*w),x&&Ee(a,ht(T,E,I,1,h),B-1,C-1,R,g.alpha);let N=(g.body??(x?"new":"old"))==="new";if(Ee(a,N?ta(T,l,g.boost):T,B,C,R,g.alpha,ae,M),g.fadeNew&&Ee(a,ta(T,l),B,C,R,g.fadeNew,ae,M),g.white){let H=g.crack?ki(T,E,I,g.crack,b,Sn[y][2]):ht(T,E,I,0,"#ffffff");Ee(a,H,B,C,R,g.alpha*g.white)}}g.list.filter(w=>!w.layer||w.layer==="front").forEach(L);let G=c>0?u+g.dx:u-g.dx;if(x&&g.aura&&!g.hide){let w=rt[l].aura,N=ra[w],H=F(v,0,12);for(let[D,q]of H?[[0,!1],[4,!0]]:[[0,!1]])Pi[N](b).forEach(([j,z],ee)=>{let ne=Fi(N,(s+ee*8+D)%24);if(!ne)return;let oe=S(w,ne.frame,y,H?.25:0),ue=(q?ae-j-7:j)+ne.d[0]+(7-oe.width>>1),he=z+ne.d[1]+(7-oe.height>>1);Ee(a,oe,G+ue,C+he,!1,g.alpha)})}if(x&&g.extra&&!g.hide){let w=12,N=!1,H=(s%24>=12?-1:0)+g.extraDy;if(t.kind==="move"&&F(v,0,6)){let[q,j]=Ai[v];H+=q,w=Math.round(12*Math.abs(j)),N=j<0}let D=S(`x-${e.extra}`,s%12>=6?1:0,y);Ee(a,D,G+20+(12-w>>1),C+b.t-13+H,N,g.alpha,w)}return a.restore(),e.marks.length>0}var xn=52,Li=1200,$i={feed:[{sprite:"tomato",motion:"feed"}],play:[{sprite:"sparkle",motion:"play-a"},{sprite:"sparkle",motion:"play-b"}],rest:[{sprite:"z",motion:"rest-a"},{sprite:"z",motion:"rest-b"}],pet:[{sprite:"heart",motion:"pet"}]},dr={stage:{x:176,top:80,bottom:24},spot:{x:48,top:56,bottom:8}},Hi={note:[{sprite:"note",motion:"cue-note"}],question:[{sprite:"question",motion:"cue-question"}],bang:[{sprite:"bang",motion:"cue-bang"}],nap:[{sprite:"z",motion:"nap-a"},{sprite:"z",motion:"nap-b"}]},Ui="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0",ga=(e,t)=>e.map(n=>(parseInt(n.slice(1+t*2,3+t*2),16)/255).toFixed(3)).join(" ");function fr(){return i("svg",{"aria-hidden":"true",width:"0",height:"0",style:{position:"absolute"},children:i("defs",{children:Object.entries(Sn).map(([e,t])=>f("filter",{id:`sl-ramp-${e}`,colorInterpolationFilters:"sRGB",children:[i("feColorMatrix",{type:"matrix",values:Ui}),f("feComponentTransfer",{children:[i("feFuncR",{type:"table",tableValues:ga(t,0)}),i("feFuncG",{type:"table",tableValues:ga(t,1)}),i("feFuncB",{type:"table",tableValues:ga(t,2)})]})]},e))})})}function En(){let[e,t]=U(null),n=Q(void 0);W(()=>()=>window.clearTimeout(n.current),[]);let s=pe(a=>{window.clearTimeout(n.current),t({action:a,at:Date.now()}),n.current=window.setTimeout(()=>t(null),Li)},[]);return[e,s]}var Di={egg:{w:22,h:30},hatchling:{w:26,h:32},juvenile:{w:32,h:40},adult:{w:36,h:46},elder:{w:36,h:46}};function pr(e,t,n){if(e)return{backgroundImage:`url("${e}")`};if(t)return{backgroundImage:`url("${n(t.path)}")`,backgroundSize:`300% ${tt*100}%`,backgroundPositionY:`${t.row/(tt-1)*100}%`}}function mr(e,t,n){let s=t&&Is(e);if(!s)return;let a=tt*Ot,r=o=>`${(o*tt+t.row)/(a-1)*100}%`;return{backgroundImage:`url("${n(s.path)}")`,backgroundSize:`300% ${a*100}%`,"--sl-live-y0":r(0),"--sl-live-y1":r(Ot),animationDuration:`${s.ms*Ot}ms`,animationTimingFunction:`steps(${Ot}, end)`}}function zi({act:e,player:t,look:n,plain:s,stage:a,facing:r,scale:o}){let[l,c]=U(null),[u,p]=U(e);e!==u&&(p(e),c(e?null:u));let d=e??l,m=d?.kind==="move"&&d.spot,b=m?dr.spot:dr.stage,y=b.x*2+xn,h=b.top+xn+b.bottom,g=Q(null),v=Q(null),{colour:k,extra:x}=n;return Ge(()=>{let _=g.current?.getContext("2d");if(!_||!d)return;_.imageSmoothingEnabled=!1;let P={ctx:_,...t,colour:k,extra:x,stage:a,dir:r==="right"?1:-1,X:b.x,Y0:b.top,lit:!m,plain:s};v.current?.ctx===_?Object.assign(v.current,P):v.current={...P,marks:[],drawn:""};let B=v.current,C=0,S="",$=()=>{let O=Date.now(),L=Math.floor(O/ze),E=e?Math.min(ir(e)-1,Math.max(0,Math.floor((O-e.at)/ze))):0,I=`${E}|${L}`;if(I!==S&&(S=I,!gr(B,e,E,L)&&!e))return c(null);C=requestAnimationFrame($)};return $(),()=>cancelAnimationFrame(C)},[e,d,t,k,x,a,r,b,m,s]),d?i("canvas",{ref:g,"aria-hidden":"true",className:"sl-move-canvas",width:y,height:h,style:{left:`${-b.x*o}px`,top:`${-b.top*o}px`,width:`${y*o}px`,height:`${h*o}px`}}):null}function bt({species:e,stage:t,mood:n,assetUrl:s,alt:a,scale:r,still:o=!1,reaction:l=null,pose:c=null,cue:u=null,customSrc:p=null,sideSrc:d=null,frames:m=3,silhouette:b=!1,look:y=null,act:h=null,facing:g="right",flipped:v=!1}){let k=t==="egg"?null:sa[t],x=!!p,_=x&&m===1,P=!x&&b,B=x||P?null:$e(e,t,n),C=pr(x?p:null,B,s),S=B&&$e(e,t,"side"),$=pr(x?d:null,S,s),O=t==="egg"?void 0:mr(e,B,s),L=t==="egg"?void 0:mr(e,S,s),E=o?"sl-live":"sl-live sl-live--on",I=O?i("span",{className:E,style:O}):null,R=L?i("span",{className:E,style:L}):null,T=O?{...C,backgroundImage:"none"}:C,M=L?{...$,backgroundImage:"none"}:$,G=!!$&&c==="walk"&&!l&&t!=="egg",w=l?`sl-react-${t==="egg"?"egg":l.action}`:c&&t!=="egg"?`sl-pose-${c}`:o?"":_||P?"sl-idle sl-idle-custom":`sl-idle sl-idle-${t==="egg"?"egg":n}`,N=!y&&h&&h.kind!=="moment"?h.colour:void 0,H=y??(N?{colour:N,extra:Ct[0]}:null),D=!!H&&t!=="egg"&&!P,q=D?$e(e,t,"happy"):null,j=D?$e(e,t,"side"):null,z=D?JSON.stringify(x?[{src:p,row:0,rows:1,frames:m},d?{src:d,row:0,rows:1,frames:m}:null,v,null]:[{src:s(q.path),row:q.row,rows:tt,frames:3},j?{src:s(j.path),row:j.row,rows:tt,frames:3}:null,v,v?null:sr[`${e}:${t}`]??null]):"",[ee,ne]=U(null),oe=Q(s);W(()=>{oe.current=s}),W(()=>{if(!z)return;let ie=!0,[Re,Se,We,Qe]=JSON.parse(z);return Promise.all([kn(oe.current),ur(Re,Se,We,Qe)]).then(([vt,Me])=>ie&&ne({key:z,art:vt,body:Me}),()=>ie&&ne(null)),()=>{ie=!1}},[z]);let ue=ee&&ee.key===z&&H&&t!=="egg"?ee:null,he=Di[t],ye={width:`${xn*r}px`,height:`${xn*r}px`,"--sl-px":`${r}px`,...k?{"--sl-t":k.t,"--sl-l":k.l,"--sl-r":k.r,"--sl-m":k.m}:{},...P?{"--sl-sil-w":he.w,"--sl-sil-h":he.h}:{}},Oe=_?"sl-sprite-frames sl-sprite-frames--single":P?"sl-sprite-frames sl-sprite-frames--silhouette":"sl-sprite-frames",Ce=y?rt[y.colour].aura:null,ve=h&&(ue||N)?" sl-sprite--canvas":"";return f("span",{className:y?`sl-sprite sl-evo sl-evo--${y.colour}${ve}`:`sl-sprite${ve}`,role:"img","aria-label":a,style:ye,children:[ue&&H&&t!=="egg"?i(zi,{act:h,player:ue,look:H,plain:!y,stage:t,facing:g,scale:r}):null,y?i("span",{"aria-hidden":"true",className:"sl-evo-ring",children:i("span",{className:G?"sl-sprite-frames sl-pose-walk-side":`${Oe} ${w}`,style:G?M:T,children:G?R:I},l?.at)}):null,i("span",{className:`${Oe} ${G?"sl-sprite-frames--hidden":w}`,style:T,children:I},l?.at),$?i("span",{className:`sl-sprite-frames ${G?"sl-pose-walk-side":"sl-sprite-frames--hidden"}`,style:M,children:R}):null,l&&k?($i[l.action]??[]).map(ie=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ie.sprite} sl-fx-${ie.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ie.sprite}.webp`)}")`}},`${l.at}-${ie.motion}`)):null,u&&k&&!l?Hi[u.kind].map(ie=>i("span",{"aria-hidden":"true",className:`sl-fx sl-fx-${ie.sprite} sl-fx-${ie.motion}`,style:{backgroundImage:`url("${s(`sprites/fx-${ie.sprite}.webp`)}")`}},`${u.at}-${ie.motion}`)):null,y&&Ce&&k?f(re,{children:[["a","b","c"].map(ie=>i("span",{"aria-hidden":"true",className:`sl-evo-aura sl-evo-aura--${ra[Ce]} sl-evo-aura-${ie}`,style:{backgroundImage:`url("${s("sprites/fx-auras.webp")}")`,backgroundSize:`300% ${Zt.length*100}%`,backgroundPositionY:`${Zt.indexOf(Ce)/(Zt.length-1)*100}%`}},ie)),i("span",{"aria-hidden":"true",className:"sl-evo-extra",style:{backgroundImage:`url("${s("sprites/fx-extras.webp")}")`,backgroundSize:`200% ${Ct.length*100}%`,backgroundPositionY:`${Ct.indexOf(y.extra)/(Ct.length-1)*100}%`}})]}):null]})}var yt=(e,t=!1)=>({queryKey:["saucelings","form",e,t?"front":"all"],queryFn:()=>V(`/form/${encodeURIComponent(e)}${t?"?strips=front":""}`),staleTime:1/0});function Pe({art:e,frontOnly:t=!1,...n}){let s=Ps(e,n.stage),a=s.kind==="form"?s.formId:null,r=le({...yt(a??"",t),enabled:a!==null}),o=a?r.data??null:null,l=o?(n.mood==="content"?null:o[n.mood])??o.image:null,c=!l&&(s.kind==="silhouette"||a!==null&&e.design?.origin==="found");return i(bt,{...n,customSrc:l,sideSrc:o?.side??null,frames:o?.frames??1,silhouette:c,look:e.evolution?.look??null})}var Bi=1024,br=1024;function yr(e,t=!1){let n=e?e.lockedStage??e.stage:null;if(!e?.design||!n||!e.design.stages[n])return null;let s=t||Object.keys(e.forms).length===0?"sheet":"stage";return{petId:e.id,species:e.species,design:e.design,forms:e.forms,stage:n,kind:s}}var Gi=e=>e&&!e.forms[e.stage]?e:null,vr=e=>["saucelings","paint",e],Ki=e=>e.kind==="sheet"?"sheet":e.stage,qi=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;async function da(e,t,n,s,a){return(await xe("/api/characters/avatar-generation","POST",{connectionId:e,name:"sauceling-form",appearance:t,promptOverrides:[{id:"avatar:sauceling-form",prompt:t,negativePrompt:n}],styleProfileId:"off",width:s,height:s,...a.length>0?{referenceImages:a}:{}})).image}async function wr(e,t,n,s,a){let{design:r,stage:o}=e,l=He.slice(0,He.indexOf(o)).reverse().map(m=>e.forms[m]).find(Boolean),c=null,u=null;if(l)c=await n.fetchQuery(yt(l,!0)).then(m=>Ze(m.image)).catch(()=>null),u=c?"earlier":null;else if(r.origin==="evolved"){let m=$e(e.species,o,"content");c=await Ze(s(m.path),m.row).catch(()=>null),u=c?"before":null}let p=await da(t,js(r,o,u),Bs(o),Bi,c?[c]:[]),d=await bs(p,o);if(!d)throw new Error(a);return V("/form","POST",{stage:o,image:d,petId:e.petId})}async function Vi(e,t,n,s,a){let r=$e(e.species,"adult","content"),o=e.design.origin==="evolved"?await Ze(s(r.path),r.row).catch(()=>null):null,l=Zn(e.design),c=await da(t,Ws(e.design,o?"before":null),Us,br,o?[o]:[]),u=await ys(c,l);return u?V("/form/sheet","POST",{petId:e.petId,forms:u}):wr({...e,kind:"stage"},t,n,s,a)}function Sr(e,t,n){let{t:s}=Z(),a=de(),r=t.world.settings.portraitConnectionId;return te({mutationKey:e?vr(e.petId):["saucelings","paint"],mutationFn:async({target:o})=>{if(!r)throw new Error(s("saucelings.album.needsConnection"));return await V("/form/start","POST",{petId:o.petId,key:Ki(o),token:qi}),(o.kind==="sheet"?Vi:wr)(o,r,a,n,s("saucelings.form.failed"))},onSuccess:o=>{a.setQueryData(["saucelings","state"],o),a.invalidateQueries({queryKey:["saucelings","menagerie"]})}}).mutate}function kr(e){let n=Oa({filters:{mutationKey:e,exact:!0},select:s=>s.state}).at(-1);return{pending:n?.status==="pending",error:n?.error??null}}var pa=e=>kr(vr(e)),xr="saucelings-paint-asked",Er=new Set;function Cr(){try{let e=JSON.parse(localStorage.getItem(xr)??"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}catch{return[]}}var ji=e=>Er.has(e)||Cr().includes(e);function Wi(e){Er.add(e);try{localStorage.setItem(xr,JSON.stringify([...Cr().filter(t=>t!==e),e].slice(-100)))}catch{}}function Qi({isEgg:e,name:t,onAnswer:n}){let{t:s}=Z(),a=Q(null);return W(()=>{let r=a.current;return r&&!r.open&&r.showModal(),r?.querySelector(".sl-btn--primary")?.focus(),()=>r?.close()},[]),f("dialog",{ref:a,className:"sl-dialog","aria-labelledby":"sl-paint-offer-title",onCancel:r=>{r.preventDefault(),n(!1)},children:[i("h2",{id:"sl-paint-offer-title",children:e?s("saucelings.form.offerEggTitle"):s("saucelings.form.offerTitle",{name:t})}),i("p",{children:e?s("saucelings.form.offerEggBody"):s("saucelings.form.offerBody",{name:t})}),f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:()=>n(!1),children:s("saucelings.form.offerNotNow")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>n(!0),children:s("saucelings.form.offerPaint")})]})]})}function Rr({petId:e}){let{t}=Z(),{pending:n,error:s}=pa(e);return n?i("span",{role:"status",style:{fontSize:"0.8rem",opacity:.8},children:t("saucelings.form.paintingEgg")}):s?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:t("saucelings.form.eggFailed",{error:Jt(s,t).message})}):null}function Cn({state:e,assetUrl:t}){let{t:n}=Z(),s=e.world.activePet,a=Gi(yr(s)),r=Sr(a,e,t),{pending:o,error:l}=pa(a?.petId??""),[,c]=U(0),u=e.world.settings;if(!s||!a||!u.portraitEnabled||!u.portraitConnectionId)return null;let p=s.stage==="egg",d=`${a.petId}/${a.stage}`,m=b=>{Wi(d),c(y=>y+1),b&&r({target:a})};return f("div",{className:"sl-care-row",children:[!o&&!ji(d)?i(Qi,{isEgg:p,name:s.name,onAnswer:m}):null,i("button",{type:"button",className:"sl-btn",disabled:o,onClick:()=>r({target:a}),children:o?n("saucelings.form.painting"):`\u{1F3A8} ${p?n("saucelings.form.paintEgg"):n("saucelings.form.paint",{name:s.name,stage:n(`saucelings.stage.${a.stage}`)})}`}),i("span",{className:"sl-care-note",role:"status",children:n(o?"saucelings.form.paintingNote":"saucelings.form.needed")}),l&&!o?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:l})}):null]})}function Mr({state:e,assetUrl:t}){let{t:n}=Z(),s=de(),[a,r]=U(!1),o=e.world.activePet,l=yr(o,!0),c=Sr(l,e,t),{pending:u,error:p}=pa(l?.petId??""),d=te({mutationFn:async g=>{let v=await V("/form/undo","POST",{petId:g});return await Promise.all(Object.values(v.world.activePet?.forms??{}).map(k=>s.prefetchQuery(yt(k)))),v},onSuccess:g=>{s.setQueryData(["saucelings","state"],g),s.invalidateQueries({queryKey:["saucelings","menagerie"]})}}),m=e.world.settings;if(!o||!l||!l.forms[l.stage]||!m.portraitEnabled)return null;let b=!!m.portraitConnectionId,y=Object.keys(o.savedForms).length>0;if(!b&&!y)return null;let h=o.stage==="egg"?n("saucelings.form.repaintEgg"):n("saucelings.form.repaint",{name:o.name});return f("div",{className:"sl-about-row",children:[a?f(re,{children:[i("span",{className:"sl-care-note",children:n("saucelings.form.repaintNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>{r(!1),c({target:l})},children:n("saucelings.form.repaintConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>r(!1),children:n("saucelings.common.cancel")})]}):f(re,{children:[u?i("button",{type:"button",className:"sl-btn",disabled:!0,children:n("saucelings.form.painting")}):b?i(be,{text:n("saucelings.form.repaintHint"),label:n("saucelings.help.label",{action:h}),children:f("button",{type:"button",className:"sl-btn",onClick:()=>r(!0),children:["\u{1F3A8} ",h]})}):null,y?i(be,{text:n("saucelings.form.undoRepaintHint"),label:n("saucelings.help.label",{action:n("saucelings.form.undoRepaint")}),children:f("button",{type:"button",className:"sl-btn",disabled:u||d.isPending,onClick:()=>d.mutate(o.id),children:["\u21B6 ",n("saucelings.form.undoRepaint")]})}):null,i("span",{className:"sl-care-note",role:"status",children:u?n("saucelings.form.paintingNote"):null})]}),p&&!u?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:p})}):null,d.error&&!d.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:d.error})}):null]})}function Ir({name:e,flipped:t,request:n}){let{t:s}=Z(),a=de(),r=te({mutationFn:()=>n(!t),onSuccess:o=>a.setQueryData(["saucelings","state"],o)});return f("div",{className:"sl-about-row",children:[i(be,{text:s("saucelings.flip.note",{name:e}),label:s("saucelings.help.label",{action:s("saucelings.flip.label",{name:e})}),children:f("button",{type:"button",className:"sl-btn","aria-pressed":t,disabled:r.isPending,onClick:()=>r.mutate(),children:["\u2194 ",s("saucelings.flip.label",{name:e})]})}),r.error&&!r.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:r.error})}):null]})}function Nr({state:e}){let{t}=Z(),n=e.world.activePet;return n?i(Ir,{name:n.stage==="egg"?t("saucelings.egg.name"):n.name,flipped:n.flipped,request:s=>V("/pet","PATCH",{flipped:s})}):null}function Tr({state:e,characterId:t,name:n}){return i(Ir,{name:n,flipped:e.world.flippedCaretakers.includes(t),request:s=>V("/caretaker/flip","PATCH",{characterId:t,flipped:s})})}var hr=e=>["saucelings","figure-paint",e];function Ar({state:e,characterId:t,name:n,sprites:s}){let{t:a}=Z(),r=de(),[o,l]=U(!1),c=e.world.settings,u=c.portraitConnectionId,p=dt(e.world.caretakerFigures[t]),d=({next:x,image:_,frames:P})=>{let B=x.world.caretakerFigures[t];B&&r.setQueryData(["saucelings","figure",B],{image:_,frames:P}),r.setQueryData(["saucelings","state"],x)},m=te({mutationKey:hr(t),mutationFn:async()=>{if(!u)throw new Error(a("saucelings.album.needsConnection"));let x=await r.fetchQuery(Wn(t)),_=[x.avatar,Xn(s,"neutral")].filter(S=>!!S),P=(await Promise.all(_.map(S=>Ss(S).catch(()=>null)))).filter(S=>S!==null),B=null;for(let S of qs(n,x.appearance,P,c.threeDrawingFallback)){let $=await da(u,S.prompt,Ds,br,S.references);if(B=await vs($),B)break}if(!B)throw new Error(a("saucelings.figure.failed",{name:n}));return{next:await V("/figure","POST",{characterId:t,image:B.image}),...B}},onSuccess:d}).mutate,b=te({mutationFn:async()=>{let x=await V("/figure/undo","POST",{characterId:t}),_=x.world.caretakerFigures[t];return _&&await r.prefetchQuery({queryKey:["saucelings","figure",_],queryFn:()=>V(`/figure/${encodeURIComponent(_)}`),staleTime:1/0}),x},onSuccess:x=>r.setQueryData(["saucelings","state"],x)}),{pending:y,error:h}=kr(hr(t));if(!c.portraitEnabled)return null;let g=!!e.world.caretakerFigures[t],v=!!(g&&e.world.savedFigures[t]);if(!u&&!v)return null;let k=y||b.isPending;return i(re,{children:f("div",{className:"sl-about-row",children:[o?f(re,{children:[i("span",{className:"sl-care-note",children:a("saucelings.figure.confirmNote",{name:n})}),i("button",{type:"button",className:"sl-btn",onClick:()=>{l(!1),m()},children:a("saucelings.figure.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>l(!1),children:a("saucelings.common.cancel")})]}):f(re,{children:[y?i("button",{type:"button",className:"sl-btn",disabled:!0,children:a("saucelings.form.painting")}):u?i(be,{text:a("saucelings.figure.hint"),label:a("saucelings.help.label",{action:g?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>l(!0),children:["\u{1F3A8} ",g?a("saucelings.figure.repaint",{name:n}):a("saucelings.figure.paint",{name:n})]})}):null,v?i(be,{text:a("saucelings.figure.undoHint"),label:a("saucelings.help.label",{action:a("saucelings.figure.undoRepaint",{name:n})}),children:f("button",{type:"button",className:"sl-btn",disabled:k,onClick:()=>b.mutate(),children:["\u21B6 ",a("saucelings.figure.undoRepaint",{name:n})]})}):null,i("span",{className:"sl-care-note",role:"status",children:y?a("saucelings.form.paintingNote"):p?.frames===3?a("saucelings.figure.threePoses",{name:n}):null})]}),h&&!y?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:h})}):null,b.error&&!b.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:b.error})}):null]})})}function Pr({keepsake:e,assetUrl:t,large:n=!1}){let{t:s}=Z(),{backgroundId:a}=e,r=le({queryKey:["saucelings","background",a],queryFn:()=>V(`/background/${encodeURIComponent(a??"")}`),enabled:a!==null,staleTime:1/0}),o=a?r.data?.image??null:t(mt({species:e.species,stage:e.stage})),c=[{art:{...e.art,evolution:{...e.art.evolution,look:null}},label:s("saucelings.album.before")},{art:e.art,label:s("saucelings.album.after")}];return f("span",{className:`sl-keepsake${n?" sl-keepsake--large":""}`,children:[o?i("img",{className:`sl-stage-bg ${a?"":"sl-stage-bg--pixel"}`,src:o,alt:""}):null,c.map(u=>f("span",{className:"sl-keepsake-side",children:[i(Pe,{art:u.art,species:e.species,stage:e.stage,mood:"happy",assetUrl:t,alt:"",scale:n?2:1,still:!0,frontOnly:!0}),n?i("span",{className:"sl-keepsake-label",children:u.label}):null]},u.label))]})}function _r({id:e,className:t,alt:n}){let{t:s}=Z(),a=le({queryKey:["saucelings","portrait",e],queryFn:()=>V(`/portrait/${encodeURIComponent(e)}`),staleTime:1/0});return a.data?i("img",{className:t,src:a.data.image,alt:n}):i("span",{className:`${t} sl-gallery-blank`,children:a.isError?s("saucelings.album.missing"):null})}function Or({state:e,packageId:t,packageVersion:n}){let{t:s}=Z(),a=M=>Ke(t,M,n),r=de(),o=e.world.activePet,l=e.world.settings,[c,u]=U(null),[p,d]=U(null),[m,b]=U(!1),[y,h]=U(!1),[g,v]=U(""),k=Q(null);W(()=>{(c||p)&&k.current?.focus()},[c,p]);let x=le({queryKey:["saucelings","portraits"],queryFn:()=>V("/portraits"),refetchOnMount:"always"}),_=x.data?.portraits??[],P=le({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),enabled:e.menagerieCount>0}),B=[];if(o?.evolution.look&&o.stage!=="egg"){let M=nt(o).stage;B.push({petId:o.id,name:o.name,home:"nook",art:o,species:o.species,stage:M==="egg"?"hatchling":M,backgroundId:o.backgroundId,form:o.evolution.look.form,at:o.evolution.at})}for(let M of P.data?.menagerie??[]){let G=M.reachedElder?"elder":M.lockedStage??M.stageAtRetirement;!M.evolution.look||G==="egg"||B.push({petId:M.id,name:M.name,home:"menagerie",art:M,species:M.species,stage:G,backgroundId:M.backgroundId,form:M.evolution.look.form,at:M.evolution.at})}let C=M=>{r.setQueryData(["saucelings","state"],M),r.invalidateQueries({queryKey:["saucelings","portraits"]})},S=te({mutationFn:async M=>{if(!l.portraitConnectionId)throw new Error(s("saucelings.album.needsConnection"));let G=nt(M).stage,w=M.forms[G],N=$e(M.species,G,"content"),H=w?r.fetchQuery(yt(w,!0)).then(ne=>Ze(ne.image)):M.design?null:Ze(a(N.path),N.row),D=H?await H.catch(()=>null):null,q=y?g.replace(/\s+/gu," ").trim():"",j=Gs(M,D!==null,q),z=await xe("/api/characters/avatar-generation","POST",{connectionId:l.portraitConnectionId,name:"sauceling-portrait",appearance:j,promptOverrides:[{id:"avatar:sauceling-portrait",prompt:j,negativePrompt:$s(q)}],styleProfileId:"off",...D?{referenceImages:[D]}:{}}),ee=await ks(z.image).catch(()=>z.image);return V("/portrait","POST",{petId:M.id,image:ee,instructions:q})},onSuccess:C}),$=te({mutationFn:M=>V(`/portrait/${encodeURIComponent(M)}/delete`,"POST",{}),onSuccess:M=>{u(null),b(!1),C(M)}}),O=new Map;for(let M of _){let G=O.get(M.petId)??{petId:M.petId,name:M.petName,home:M.home,keepsake:null,paintings:[]};G.paintings.push(M),O.set(M.petId,G)}for(let M of B){let G=O.get(M.petId);G?G.keepsake=M:O.set(M.petId,{petId:M.petId,name:M.name,home:M.home,keepsake:M,paintings:[]})}let L=[...O.values()].sort((M,G)=>+(G.home==="nook")-+(M.home==="nook")),E=_.find(M=>M.id===c)??null,I=B.find(M=>M.petId===p)??null,R=S.error??$.error??x.error,T=l.portraitEnabled?o?o.stage==="egg"?s("saucelings.album.egg"):e.portraitCount>=Dn?s("saucelings.album.full",{limit:Dn}):null:s("saucelings.album.noPet"):s("saucelings.album.off");return f("div",{style:{display:"grid",gap:"1rem"},children:[f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem",justifyItems:"start"},children:[T||!o?i("span",{style:{fontSize:"0.85rem",opacity:.8},children:T}):f(re,{children:[i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:S.isPending,onClick:()=>S.mutate(o),children:S.isPending?s("saucelings.album.painting"):`\u{1F3A8} ${s("saucelings.album.paint",{name:o.name})}`}),i("button",{type:"button",className:"sl-link",disabled:S.isPending,onClick:()=>h(!y),children:s(y?"saucelings.album.removeInstructions":"saucelings.album.addInstructions")}),y?f("div",{style:{display:"grid",gap:"0.3rem",width:"100%"},children:[i("label",{className:"sl-picker-label",htmlFor:"sl-paint-instructions",children:s("saucelings.album.instructionsLabel")}),i("textarea",{id:"sl-paint-instructions",className:"sl-input sl-picker-prompt",rows:2,maxLength:Va,placeholder:s("saucelings.album.instructionsPlaceholder"),disabled:S.isPending,value:g,onChange:M=>v(M.target.value)}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:s("saucelings.album.instructionsNote")})]}):null]}),R?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:R})}):null,o&&!T?i(Cn,{state:e,assetUrl:a}):null]}),I?f("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(Pr,{keepsake:I,assetUrl:a,large:!0}),i("div",{style:{fontSize:"0.85rem"},children:s("saucelings.album.keepsakeCaption",{name:I.name,form:I.form,date:I.at?new Date(I.at).toLocaleDateString():""})}),i("div",{style:{fontSize:"0.8rem",opacity:.75},children:s("saucelings.album.keepsakeNote")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:s("saucelings.album.close")})]}):null,E?f("div",{className:"sl-card sl-viewer",ref:k,tabIndex:-1,children:[i(_r,{id:E.id,className:"sl-viewer-image",alt:s("saucelings.album.alt",{name:E.petName})}),f("div",{style:{fontSize:"0.85rem"},children:[i("strong",{children:E.petName})," ",i("span",{style:{opacity:.75},children:s("saucelings.album.caption",{stage:s(`saucelings.stage.${E.stage}`),date:new Date(E.savedAt).toLocaleDateString()})}),E.instructions?i("div",{style:{fontStyle:"italic",opacity:.75},children:s("saucelings.album.instructionsCaption",{instructions:E.instructions})}):null]}),i("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem"},children:m?f(re,{children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:$.isPending,onClick:()=>$.mutate(E.id),children:s("saucelings.album.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>b(!1),children:s("saucelings.common.cancel")})]}):f(re,{children:[i("button",{type:"button",className:"sl-btn",onClick:()=>b(!0),children:s("saucelings.album.delete")}),i("button",{type:"button",className:"sl-btn",onClick:()=>u(null),children:s("saucelings.album.close")})]})})]}):null,x.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:s("saucelings.loading")}):L.length===0?f("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:[s("saucelings.album.empty"),o&&!T?` ${s("saucelings.album.emptyHint")}`:null]}):L.map(M=>f("div",{className:"sl-card",style:{display:"grid",gap:"0.6rem"},children:[f("div",{style:{fontSize:"0.9rem"},children:[i("strong",{children:M.name})," ",i("span",{style:{opacity:.7},children:M.home==="menagerie"?s("saucelings.album.inMenagerie"):M.home==="released"?s("saucelings.album.released"):""})]}),f("div",{className:"sl-gallery",children:[M.keepsake?i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.keepsakeLabel",{name:M.name}),"aria-pressed":M.petId===p,onClick:()=>{u(null),d(M.petId)},children:i(Pr,{keepsake:M.keepsake,assetUrl:a})}):null,M.paintings.map(G=>i("button",{type:"button",className:"sl-gallery-tile","aria-label":s("saucelings.album.alt",{name:G.petName}),"aria-pressed":G.id===c,onClick:()=>{b(!1),d(null),u(G.id)},children:i(_r,{id:G.id,className:"sl-gallery-image",alt:""})},G.id))]})]},M.petId))]})}function Yi(e){let t=[];for(let n of e){let s=new Date(n.createdAt),a=s.toDateString(),r=t[t.length-1];r?.key===a?r.events.push(n):t.push({key:a,at:s,events:[n]})}return t}function Fr({state:e,onOpenNook:t}){let{t:n}=Z(),s=e.world.activePet,a=s?.journal??[];if(!s||a.length===0)return f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem",justifyItems:"center",padding:"2rem"},children:[i("span",{style:{opacity:.75},children:n("saucelings.empty.title")}),s?null:i("button",{type:"button",className:"sl-btn",onClick:t,children:n("saucelings.journal.toNook")})]});let r=new Date().toDateString(),o=new Date(Date.now()-864e5).toDateString();return i("div",{style:{display:"grid",gap:"0.65rem"},children:Yi(a).map(l=>f("section",{style:{display:"grid",gap:"0.65rem"},children:[i("h3",{style:{margin:"0.35rem 0 0",fontSize:"0.8rem",fontWeight:600,opacity:.75},children:l.key===r?n("saucelings.journal.today"):l.key===o?n("saucelings.journal.yesterday"):l.at.toLocaleDateString()}),l.events.map(c=>f("div",{className:"sl-card",style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"1rem"},children:[f("div",{style:{display:"grid",gap:"0.25rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.72rem",opacity:.7},children:[i("span",{style:{textTransform:"uppercase",fontWeight:600},children:n(`saucelings.event.${c.kind}`)}),c.generated?i("span",{style:{padding:"0.05rem 0.4rem",borderRadius:"999px",background:"rgba(169,120,232,0.2)",color:"#d8b4fe"},children:n("saucelings.journal.generated")}):null]}),f("p",{style:{margin:0,fontSize:"0.875rem",lineHeight:1.45},children:[c.speaker?i("strong",{children:n("saucelings.journal.speaker",{name:c.speaker})}):null,c.speaker?" ":null,c.text]})]}),i("time",{dateTime:c.createdAt,title:new Date(c.createdAt).toLocaleString(),style:{fontSize:"0.72rem",opacity:.6,whiteSpace:"nowrap"},children:new Date(c.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})})]},c.id))]},l.key))})}function ma(e){return e.design?null:Da.includes(e.species)?"special":za.includes(e.species)?"halloween":null}var Xi={special:{rows:["....K....","...KYK...","KKKKYKKKK","KYYYWYYYK",".KYYYYYK.","..KYYYK..",".KYYKYYK.",".KYK.KYK.",".KK...KK."],colours:{K:"#4a2c0a",Y:"#ffd84a",W:"#fff6c2"}},halloween:{rows:[".....gg..","....gG...",".KKKgKKK.","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK","KOOoOoOOK",".KOOOOOK.","..KKKKK.."],colours:{K:"#5a2008",O:"#ff8a28",o:"#c95212",g:"#2f5e1e",G:"#7fd35a"}}},Ji=Object.fromEntries(Object.entries(Xi).map(([e,{rows:t,colours:n}])=>[e,t.flatMap((s,a)=>[...s.matchAll(/([^.])\1*/gu)].map(r=>({x:r.index,y:a,w:r[0].length,fill:n[r[1]]})))]));function zt({pet:e,labelled:t=!0}){let{t:n}=Z(),s=ma(e);return s?i("svg",{className:"sl-rare-mark",viewBox:"0 0 9 9",width:"18",height:"18",shapeRendering:"crispEdges",...t?{role:"img","aria-label":n(`saucelings.pet.rare.${s}`)}:{"aria-hidden":!0},children:Ji[s].map(a=>i("rect",{x:a.x,y:a.y,width:a.w,height:1,fill:a.fill},`${a.x},${a.y}`))}):null}function Lr(e){let t=Ue(e)?.sauce;return t?{"--sl-sauce-accent":t.accentColor,"--sl-sauce-bg":t.badgeBg}:{}}function $r({state:e,packageId:t,packageVersion:n,onRestored:s}){let{t:a}=Z(),r=R=>Ke(t,R,n),o=de(),l=le({queryKey:["saucelings","menagerie"],queryFn:()=>V("/menagerie"),refetchOnMount:"always"}),c=l.data?.menagerie??[],u=e.world.activePet,p=u?u.stage==="egg"?a("saucelings.menagerie.activeEgg"):u.name:"",[d,m]=U({}),[b,y]=U({}),h=R=>b[R.id]??(R.farewellScene?R.caretakerId:e.characters.find(T=>T.id===R.foundBy)?.id??""),[g,v]=U(null),[k,x]=U(null),_=Q(null),P=Q(new Map),B=Q(null);W(()=>{g?_.current?.focus():B.current&&P.current.get(B.current)?.focus(),B.current=null},[g]);let C=te({mutationFn:R=>V(`/menagerie/${encodeURIComponent(R.id)}/restore`,"POST",{stage:R.stage,swap:R.swap,caretakerId:R.caretakerId}),onSuccess:(R,T)=>{x(null),o.setQueryData(["saucelings","state"],R),s(T.caretakerId)}}),S=te({mutationFn:R=>V(`/menagerie/${encodeURIComponent(R)}/release`,"POST",{}),onSuccess:R=>{x(null),v(null),o.setQueryData(["saucelings","state"],R),o.invalidateQueries({queryKey:["saucelings","menagerie"]}),o.invalidateQueries({queryKey:["saucelings","portraits"]})}}),$=C.error??S.error??l.error,O=C.isPending||S.isPending,L=c.find(R=>R.id===g)??null,E=R=>{x(null),v(R)},I=()=>{B.current=g,x(null),v(null)};return l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2.5rem",opacity:.75},children:a("saucelings.loading")}):c.length===0&&!$?f("div",{className:"sl-card",style:{display:"grid",gap:"0.5rem",textAlign:"center",padding:"2.5rem"},children:[i("span",{style:{opacity:.75},children:a("saucelings.menagerie.empty")}),i("span",{style:{fontSize:"0.8rem",opacity:.65},children:a("saucelings.menagerie.emptyHow")})]}):f("div",{style:{display:"grid",gap:"1rem"},children:[$?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(ce,{error:$})}):null,L?i(Zi,{entry:L,cardRef:_,assetUrl:r,chosenStage:d[L.id]??"elder",onPickStage:R=>m(T=>({...T,[L.id]:R})),characters:e.characters,caretakerId:h(L),onPickCaretaker:R=>y(T=>({...T,[L.id]:R})),activeName:p,hasActivePet:!!u,confirming:k,setConfirming:x,pending:O,onRestore:(R,T)=>C.mutate({id:L.id,stage:R,swap:T,caretakerId:h(L)}),onRelease:()=>S.mutate(L.id),onClose:I},L.id):null,Ns(c).map(R=>f("section",{className:"sl-menagerie-section",children:[f("h3",{className:"sl-menagerie-heading",children:[a(`saucelings.menagerie.section.${R.stage}`),i("span",{className:"sl-menagerie-count",children:R.entries.length})]}),i("div",{className:"sl-gallery sl-gallery--pets",children:R.entries.map(T=>{let M=T.stageAtRetirement==="egg",G=M?a("saucelings.egg.name"):T.name,w=M?null:ma(T);return f("button",{ref:N=>{N?P.current.set(T.id,N):P.current.delete(T.id)},type:"button",className:"sl-gallery-tile",style:Lr(T),"aria-label":w?`${G}, ${a(`saucelings.pet.rare.${w}`)}`:G,"aria-pressed":T.id===g,onClick:()=>E(T.id),children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Pe,{art:T,species:T.species,stage:T.reachedElder?d[T.id]??"elder":T.lockedStage??T.stageAtRetirement,mood:"happy",assetUrl:r,alt:"",scale:2,still:!0,frontOnly:!0})}),M?null:f("span",{className:"sl-pet-tile-name",children:[i(zt,{pet:T,labelled:!1}),T.name]})]},T.id)})})]},R.stage))]})}function Zi({entry:e,cardRef:t,assetUrl:n,chosenStage:s,onPickStage:a,characters:r,caretakerId:o,onPickCaretaker:l,activeName:c,hasActivePet:u,confirming:p,setConfirming:d,pending:m,onRestore:b,onRelease:y,onClose:h}){let{t:g}=Z(),[v,k]=U(!1),x=Q(null),_=je(e),P=e.stageAtRetirement==="egg",B=P?g("saucelings.egg.name"):e.name,C=P?g("saucelings.menagerie.thisEgg"):e.name,S=Ue(e),$=e.reachedElder?s:e.lockedStage??e.stageAtRetirement,O=E=>b(e.reachedElder?s:void 0,E),L=r.length>0?r.map(E=>({id:E.id,name:E.name})):[{id:"caretaker",name:g("saucelings.empty.houseCaretaker")}];return e.farewellScene&&!L.some(E=>E.id===e.caretakerId)&&L.unshift({id:e.caretakerId,name:e.careProfile.characterName}),f("div",{ref:t,tabIndex:-1,className:"sl-card sl-viewer",style:{display:"grid",gap:"0.75rem",justifyItems:"stretch",...Lr(e)},children:[f("div",{style:{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"},children:[i("div",{className:"sl-sprite-stage",style:{width:"7.5rem",height:"7.5rem"},children:i(Pe,{art:e,species:e.species,stage:$,mood:"happy",assetUrl:n,alt:B,scale:2,still:!0,frontOnly:!0})}),f("div",{style:{flex:"1 1 16rem",display:"grid",gap:"0.35rem"},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"1.1rem"},children:B}),P?null:i(zt,{pet:e}),P||!S?null:i("span",{className:"sl-badge",title:S.readsAs,children:S.sauce?g("saucelings.pet.sauce",{sauce:S.name}):g("saucelings.pet.temperament",{temperament:S.name})}),i("span",{className:"sl-badge",children:g("saucelings.menagerie.foundBy",{name:e.finder.name})}),!P&&e.evolution?.at?i("span",{className:"sl-badge",children:g("saucelings.menagerie.evolved")}):null,f("span",{style:{fontSize:"0.8rem",opacity:.75},children:[P?"":`${_.name} \xB7 `,e.farewellScene?g("saucelings.menagerie.retiredAs",{stage:g(`saucelings.stage.${e.stageAtRetirement}`),name:e.careProfile.characterName}):""]})]}),e.farewellScene?i("p",{style:{margin:0,fontSize:"0.825rem",opacity:.85},children:e.farewellScene}):null,P&&e.design?i(Rr,{petId:e.id}):null]})]}),f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem",flexWrap:"wrap"},children:[i("span",{children:g("saucelings.menagerie.lookedAfterBy")}),f("select",{ref:x,className:"sl-select",value:o,disabled:m,onChange:E=>l(E.target.value),children:[o?null:i("option",{value:"",disabled:!0,children:g("saucelings.menagerie.chooseCaretaker")}),L.map(E=>i("option",{value:E.id,children:E.name},E.id))]}),v&&!o?i("span",{className:"sl-care-note",role:"status",children:g("saucelings.menagerie.chooseFirst")}):null]}),f("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem",borderTop:"1px solid var(--border, rgba(255,255,255,0.08))",paddingTop:"0.65rem"},children:[p?f(re,{children:[i("span",{style:{fontSize:"0.8rem"},children:p==="release"?P?g("saucelings.menagerie.releaseNoteEgg"):g("saucelings.menagerie.releaseNote",{name:e.name}):g("saucelings.menagerie.swapNote",{name:C,active:c})}),f("div",{style:{display:"flex",gap:"0.5rem"},children:[p==="release"?i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:m,onClick:y,children:g("saucelings.menagerie.releaseConfirm")}):i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m||!o,onClick:()=>O(!0),children:g("saucelings.menagerie.swapConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(null),children:g("saucelings.common.cancel")})]})]}):e.reachedElder?i(be,{text:g("saucelings.menagerie.lockStageHelp"),label:g("saucelings.help.label",{action:g("saucelings.menagerie.lockStage")}),children:f("label",{style:{display:"flex",alignItems:"center",gap:"0.45rem",fontSize:"0.8rem"},children:[i("span",{children:g("saucelings.menagerie.lockStage")}),i("select",{className:"sl-select",value:s,onChange:E=>a(E.target.value),children:Ga.map(E=>i("option",{value:E,children:g(`saucelings.stage.${E}`)},E))})]})}):e.farewellScene?null:f("span",{style:{fontSize:"0.75rem",opacity:.7},children:[g("saucelings.menagerie.returnsAt")," ",i("strong",{children:g(`saucelings.stage.${e.stageAtRetirement}`)})]}),p?null:f("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginLeft:"auto"},children:[i("button",{type:"button",className:"sl-btn",onClick:h,children:g("saucelings.menagerie.close")}),i("button",{type:"button",className:"sl-btn",disabled:m,onClick:()=>d("release"),children:g("saucelings.menagerie.release")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:m,"aria-disabled":!o||void 0,onClick:()=>{o?u?d("swap"):O(!1):(k(!0),x.current?.focus())},children:g("saucelings.menagerie.bringBack")})]})]})]})}var Ur=1280,Dr=720,el=20*1024*1024;async function Hr(e){let t=await Le(e),n=Math.min(t.naturalWidth,t.naturalHeight*16/9),s=n*9/16,a=document.createElement("canvas");a.width=Math.min(Ur,Math.round(n)),a.height=Math.min(Dr,Math.round(a.width*9/16));let r=a.getContext("2d");if(!r)throw new Error("This browser cannot resize pictures.");r.imageSmoothingQuality="high",r.drawImage(t,(t.naturalWidth-n)/2,(t.naturalHeight-s)/2,n,s,0,0,a.width,a.height);let o=a.toDataURL("image/webp",.85);return o.startsWith("data:image/webp")?o:a.toDataURL("image/jpeg",.88)}function tl({id:e}){let{t}=Z(),n=le({queryKey:["saucelings","background",e],queryFn:()=>V(`/background/${encodeURIComponent(e)}`),staleTime:1/0});return n.data?i("img",{className:"sl-gallery-image",src:n.data.image,alt:""}):i("span",{className:"sl-gallery-image sl-gallery-blank",children:n.isError?t("saucelings.background.missing"):null})}function zr({pet:e,settings:t,assetUrl:n,onClose:s}){let{t:a}=Z(),r=de(),o=Q(null),[l,c]=U(()=>ea(e)),[u,p]=U(null),d=le({queryKey:["saucelings","backgrounds"],queryFn:()=>V("/backgrounds"),refetchOnMount:"always"}),m=d.data?.backgrounds??[],b=m.length>=Un,y=S=>S.label||a("saucelings.background.earlier"),h=S=>{r.setQueryData(["saucelings","state"],S),r.invalidateQueries({queryKey:["saucelings","backgrounds"]})},g=te({mutationFn:async S=>{if(S.size>el)throw new Error(a("saucelings.background.tooBig"));let $=URL.createObjectURL(S);try{let O=await Hr($),L=S.name.replace(/\.[^.]+$/u,"").slice(0,120);return await V("/background","POST",{image:O,label:L,source:"upload"})}finally{URL.revokeObjectURL($)}},onSuccess:h}),v=te({mutationFn:async()=>{if(!t.portraitConnectionId)throw new Error(a("saucelings.background.noConnection"));let S=Qs(l),$=await xe("/api/characters/avatar-generation","POST",{connectionId:t.portraitConnectionId,name:"sauceling-background",appearance:S,width:Ur,height:Dr,styleProfileId:"off",promptOverrides:[{id:"avatar:sauceling-background",prompt:S,negativePrompt:zs}]}),O=await Hr($.image);return V("/background","POST",{image:O,label:l.trim().slice(0,120),source:"generated"})},onSuccess:h}),k=te({mutationFn:()=>V("/background/suggest","POST",{}),onSuccess:({scene:S})=>c(S??ea(e))}),x=te({mutationFn:S=>V(S?`/background/${encodeURIComponent(S)}/select`:"/background/clear","POST",{}),onSuccess:h}),_=te({mutationFn:S=>V(`/background/${encodeURIComponent(S)}/delete`,"POST",{}),onSuccess:S=>{p(null),h(S)}}),P=g.isPending||v.isPending||k.isPending||x.isPending||_.isPending,B=g.error??v.error??k.error??x.error??_.error??d.error,C=t.portraitEnabled?t.portraitConnectionId?null:a("saucelings.background.noConnection"):a("saucelings.background.off");return f("section",{className:"sl-card sl-picker","aria-label":a("saucelings.background.title"),children:[i("strong",{children:a("saucelings.background.title")}),f("div",{className:"sl-gallery sl-gallery--wide",role:"group","aria-label":a("saucelings.background.library"),children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.useBuiltIn"),title:a("saucelings.background.useBuiltIn"),"aria-pressed":e.backgroundId===null,disabled:P,onClick:()=>e.backgroundId!==null&&x.mutate(null),children:i("img",{className:"sl-gallery-image sl-stage-bg--pixel",src:n(mt(e)),alt:""})}),m.map(S=>f("div",{className:"sl-gallery-item",children:[i("button",{type:"button",className:"sl-gallery-tile","aria-label":a("saucelings.background.tileAlt",{label:y(S)}),title:y(S),"aria-pressed":e.backgroundId===S.id,disabled:P,onClick:()=>e.backgroundId!==S.id&&x.mutate(S.id),children:i(tl,{id:S.id})}),i("button",{type:"button",className:"sl-gallery-remove","aria-label":a("saucelings.background.delete",{label:y(S)}),title:a("saucelings.background.delete",{label:y(S)}),disabled:P,onClick:()=>p(S),children:"\xD7"})]},S.id))]}),i("span",{className:"sl-box-note",children:a("saucelings.background.sharedNote")}),u?f("div",{className:"sl-picker-row",role:"group","aria-label":a("saucelings.background.delete",{label:y(u)}),children:[i("span",{className:"sl-box-note",children:a("saucelings.background.deleteNote",{label:y(u)})}),i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:P,onClick:()=>_.mutate(u.id),children:a("saucelings.background.deleteConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>p(null),children:a("saucelings.common.cancel")})]}):null,f("div",{className:"sl-picker-row",children:[i("input",{ref:o,type:"file",className:"sl-sr-only",accept:"image/png,image/jpeg,image/webp",tabIndex:-1,onChange:S=>{let $=S.target.files?.[0];S.target.value="",$&&g.mutate($)}}),i("button",{type:"button",className:"sl-btn",disabled:P||b,onClick:()=>o.current?.click(),children:g.isPending?a("saucelings.background.uploading"):`\u2B06 ${a("saucelings.background.upload")}`}),i("button",{type:"button",className:"sl-btn",onClick:s,children:a("saucelings.album.close")}),b?i("span",{className:"sl-box-note",children:a("saucelings.background.full",{limit:Un})}):null]}),i("label",{className:"sl-picker-label",htmlFor:"sl-background-prompt",children:a("saucelings.background.promptLabel")}),i("textarea",{id:"sl-background-prompt",className:"sl-input sl-picker-prompt",rows:3,maxLength:600,value:l,onChange:S=>{c(S.target.value),k.reset()}}),f("div",{className:"sl-picker-row",children:[i("button",{type:"button",className:"sl-btn",disabled:P||C!==null,onClick:()=>k.mutate(),children:k.isPending?a("saucelings.background.suggesting"):`\u270D ${e.stage==="egg"?a("saucelings.background.suggestEgg"):a("saucelings.background.suggest",{name:e.name})}`}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:P||b||C!==null||!l.trim(),onClick:()=>v.mutate(),children:v.isPending?a("saucelings.background.generating"):`\u2728 ${a("saucelings.background.generate")}`}),C?i("span",{className:"sl-box-note",children:C}):null,k.data?.scene===null?i("span",{className:"sl-box-note",children:a("saucelings.background.suggestPlain")}):null]}),B?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:B})}):null]})}function Br(e,t=e*9/16){let n=Math.round(Math.max(e/176,t/99));return n>=4?4:n<=2?2:3}var fa=["rigamuffin","fluttino","burrowl"],nl=["shellbini","lentino","puddlepip"],Gr=["fluttino","wickwisp"],al={grumpy:6,content:10,happy:14};function sl(e){return e>=22||e<7}function rl(e,t,n,s=!1){let a=fa.includes(t)?2:1,r=nl.includes(t)?3:1;if(e==="grumpy")return{wander:2,idle:3,look:1,hop:0,hum:0,nap:0,huff:3,signature:0};if(e==="happy")return{wander:4,idle:3,look:a,hop:1,hum:r,nap:0,huff:0,signature:s?1:0};let o=sl(n)?4:1;return{wander:4,idle:3,look:a,hop:0,hum:r,nap:o,huff:0,signature:s?.5:0}}function Kr(e,t,n,s,a=!1){let r=rl(e,t,n,a),o=Object.keys(r).filter(u=>r[u]>0),l=o.reduce((u,p)=>u+r[p],0),c=Math.min(Math.max(s,0),.999999)*l;for(let u of o)if(c-=r[u],c<0)return u;return o[o.length-1]}function ha(e,t,n){return e==="huff"?"grumpy":e==="hop"||e==="hum"||e==="signature"?t==="grumpy"?null:"happy":e!=="idle"?null:t==="happy"?n<.6?"happy":null:t==="content"?n<.25?"happy":null:n<.3?"content":null}function Rn(e,t,n){return t==="rest"?"content":t?e==="grumpy"?"content":"happy":n??(e==="happy"?"content":e)}function Bt(e){return{min:-6,max:Math.max(-6,Math.floor(e)-52+6)}}function at(e,t){let{min:n,max:s}=Bt(t);return Math.round(Math.min(Math.max(e,n),s))}var ol=.3;function qr(e,t){return t?Math.floor(e*(1-ol)):e}function ba(e){return at((e-52)/2,e)}function Vr(e,t){return Math.max(200,Math.round(Math.abs(e)/al[t]*1e3))}var il=48,ll=1e3;function jr(e){return Math.min(ll,Math.max(200,Math.round(Math.abs(e)/il*1e3)))}var Mn=(e,t)=>e+Math.random()*(t-e);function _e(){if(typeof document>"u")return!0;let e=document.documentElement;return e.dataset.marinaraReducedEffects==="true"||e.dataset.marinaraEffectsPaused==="true"||document.hidden||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Wr({stageArtWidth:e,mood:t,species:n,enabled:s,busy:a,paused:r=!1,move:o=null,measureX:l}){let[c,u]=U(()=>({x:ba(e),facing:"right",pose:null,cue:null,moveMs:0,steps:1,face:null,act:null})),p=s&&!a&&!r&&e>0,d=Q({actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p});d.current={actor:c,stageArtWidth:e,mood:t,species:n,move:o,measureX:l,running:p};let m=Q([]),b=Q(null),y=pe(I=>u(R=>({...R,...I})),[]),h=pe((I,R)=>{m.current.push(window.setTimeout(R,I))},[]),g=pe(()=>{for(let R of m.current)window.clearTimeout(R);m.current=[];let I=b.current;b.current=null,I?.()},[]),v=pe(()=>{let I=d.current.measureX(),R=d.current.stageArtWidth;u(T=>({...T,x:I===null||R<=0?T.x:at(I,R),moveMs:0,steps:1,pose:null,cue:null,face:null,act:null}))},[]),k=Q(()=>{}),x=pe(()=>h(Mn(2500,7e3),()=>k.current()),[h]),_=pe((I,R,T=!1)=>{let{actor:M,mood:G}=d.current,w=at(I,d.current.stageArtWidth),N=w-M.x;if(Math.abs(N)<4)return R();let H=T?jr(N):Vr(N,G);y({x:w,facing:N>0?"right":"left",pose:"walk",moveMs:H,steps:Math.abs(N)}),h(H+60,()=>{y({pose:null,moveMs:0,steps:1}),R()})},[h,y]),P=pe((I,R,T,M,G)=>{let{actor:w,stageArtWidth:N}=d.current,H=at(d.current.measureX()??w.x,N),D=G!==void 0||Math.random()<1/8,q=or(I)?T??(H+52/2<=N/2?"right":"left"):w.facing,j=q==="right"?1:-1,z=Math.abs(at(H+j*rr(I,D,!1),N)-H);y({x:H,moveMs:0,steps:1,facing:q,face:R,act:{kind:"move",move:I,encore:D,travel:z,spot:!1,at:Date.now(),...G?{colour:G}:{}}}),h(Dt(I,D)*ze,()=>{y({act:null,x:H+j*z,face:null}),M()})},[h,y]),B=pe(()=>{if(_e())return x();let{actor:I,mood:R,species:T,stageArtWidth:M,move:G}=d.current,w=Kr(R,T,new Date().getHours(),Math.random(),!!G),N=ha(w,R,Math.random()),H=Date.now();switch(w){case"wander":{let{min:D,max:q}=Bt(M);return _(Mn(D,q),x)}case"idle":return y({face:N}),h(Mn(3e3,6e3),()=>{y({face:null}),x()});case"look":{let D=I.facing;return y({facing:D==="right"?"left":"right",cue:fa.includes(T)?{kind:"question",at:H}:null,face:N}),h(1400,()=>{y({facing:D,cue:null,face:null}),x()})}case"hop":return y({pose:"hop",face:N}),h(700,()=>{y({pose:null,face:null}),x()});case"hum":return y({cue:{kind:"note",at:H},face:N}),h(2200,()=>{y({cue:null,face:null}),x()});case"nap":return y({pose:"nap",cue:{kind:"nap",at:H},face:N}),h(Mn(4e3,6e3),()=>{y({pose:null,cue:null,face:null}),x()});case"huff":return y({pose:"huff",face:N}),h(1300,()=>{y({pose:null,face:null}),x()});case"signature":return G?P(G,N,null,x):x()}},[h,x,y,P,_]);k.current=B,W(()=>{if(p)return x(),()=>{g(),v()}},[p,x,g,v]);let C=Q(!1);W(()=>{if(e<=0)return;let I=!C.current;I&&(C.current=!0),u(R=>{let T=s&&!I?at(R.x,e):ba(e);return T===R.x?R:{...R,x:T,moveMs:0,steps:1}})},[e,s]);let S=pe(I=>{if(!s||a||r||_e())return;g(),v();let R=Date.now(),T=d.current.measureX()??d.current.actor.x,M=I>=T+52/2?"right":"left",{move:G,mood:w}=d.current;if(G&&w==="happy"&&Math.random()<.4)return P(G,"happy",M,x);y({facing:M,pose:"hop",cue:{kind:"bang",at:R}}),h(700,()=>{y({pose:null,cue:null}),_(I-52/2,x)})},[h,x,a,s,r,v,y,P,g,_]),$=pe(I=>{g(),v();let R=_e();y({act:{kind:"moment",reduced:R,at:Date.now()}});let T=()=>{d.current.running&&x()};h((R?ca:la)*ze,()=>{y({act:null}),R?T():P(I,"happy",null,T)})},[h,x,v,y,P,g]),O=pe((I,R,T,M)=>{g(),v(),y({act:{kind:"hatch",how:I,colour:R,at:Date.now()}});let G=w=>w<T.length?P(T[w],"happy",null,()=>G(w+1),R):M();h(ua*ze,()=>{y({act:null}),G(0)})},[h,v,y,P,g]),L=pe(I=>{if(!s||a||r||b.current||_e())return;g(),v();let R=()=>{y({facing:I?"right":d.current.actor.facing,pose:"hop",face:ha("hop",d.current.mood,0)}),h(700,()=>{y({pose:null,face:null}),x()})};if(!I)return R();y({facing:"right"}),h(300,()=>_(Bt(d.current.stageArtWidth).max,R))},[h,x,a,s,r,v,y,g,_]),E=pe(I=>new Promise(R=>{if(!I||!s||a||r||_e()||d.current.stageArtWidth<=0)return R();g(),v(),b.current=R;let T=0,M=()=>{if(d.current.measureX()!==d.current.actor.x&&T++<8)return h(50,M);b.current=null,R(),x()},G=d.current.actor.facing!=="right";y({facing:"right"}),h(G?250:60,()=>_(Bt(d.current.stageArtWidth).max,M,!0))}),[h,x,a,s,r,v,y,g,_]);return{actor:c,poke:S,listen:L,comeOver:E,celebrate:$,hatch:O}}var cl=8,ul=2,gl=44;function Qr({lines:e,fallbackLine:t,caretakerId:n,caretakerName:s,isCharacter:a,meals:r,isEgg:o,writing:l,standing:c,onTyping:u,children:p}){let{t:d}=Z(),m=e.slice(0,cl),[b,y]=U(0),h=m[0]?.id;W(()=>y(0),[h]);let g=Math.min(b,Math.max(0,m.length-1)),v=m[g]??null,k=gt(n,a&&!c),x=v&&l.includes(v.id)?d("saucelings.checkIn.pending",{name:v.speaker??s}):v?.text??t,_=m[0]&&!l.includes(m[0].id)?m[0]:null,P=_?`${_.id}:${_.text}`:null,B=Q(P),[C,S]=U(null);W(()=>{!P||P===B.current||(B.current=P,S(_e()?null:0))},[P]);let $=Array.from(x),O=C!==null&&g===0&&v===_&&C<$.length;W(()=>{if(!O)return;let E=window.setTimeout(()=>S(I=>I===null?null:I+ul),gl);return()=>window.clearTimeout(E)},[O,C]),W(()=>u?.(O),[u,O]);let L=E=>{S(null),y(E)};return f("section",{className:`sl-box sl-box--joined ${c?"sl-box--standing":""}`,"aria-label":d("saucelings.caretaker.says",{name:s}),children:[c?null:i(pt,{box:!0,name:s,src:k}),f("div",{className:"sl-box-plate",children:[i("strong",{children:v?.speaker??s}),r.total>0?i("span",{className:"sl-pill",title:d(o?"saucelings.pet.keptWarmTitle":"saucelings.pet.mealsTitle",{name:s}),children:d(o?"saucelings.pet.keptWarm":"saucelings.pet.meals",r)}):null,v?.generated?i("span",{className:"sl-pill sl-pill--ai",children:d("saucelings.journal.generated")}):null]}),f("p",{className:`sl-box-line ${O?"sl-box-line--typing":""}`,"aria-live":"polite",onClick:()=>S(null),children:[f("span",{className:"sl-box-typed","aria-hidden":"true",children:[i("span",{className:"sl-box-ghost",children:x}),i("span",{children:O?$.slice(0,C).join(""):x})]}),i("span",{className:"sl-sr-only",children:x})]}),v?f("div",{className:"sl-box-nav",children:[m.length>1?f(re,{children:[i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.previous"),disabled:g>=m.length-1,onClick:()=>L(g+1),children:"\u25C0"}),i("span",{children:d("saucelings.caretaker.position",{index:m.length-g,count:m.length})}),i("button",{type:"button",className:"sl-btn sl-btn--small","aria-label":d("saucelings.caretaker.next"),disabled:g===0,onClick:()=>L(g-1),children:"\u25B6"})]}):null,i("time",{className:"sl-box-time",children:new Date(v.createdAt).toLocaleString()})]}):null,p]})}function Yr({state:e,assetUrl:t}){let{t:n}=Z(),[s,a]=U(!1),r=e.world.activePet;return!r||r.stage==="egg"||r.evolution.offer!=="offered"||r.evolution.look?null:f("div",{className:"sl-about-row",children:[i(be,{text:n("saucelings.evolve.note",{name:r.name}),label:n("saucelings.help.label",{action:n("saucelings.evolve.button")}),children:f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>a(!0),children:["\u2728 ",n("saucelings.evolve.button")]})}),s?i(pl,{pet:r,assetUrl:t,onClose:()=>a(!1)}):null]})}function Xr({state:e}){let{t}=Z(),n=de(),s=te({mutationFn:()=>V("/evolve/undo","POST",{}),onSuccess:r=>n.setQueryData(["saucelings","state"],r)}),a=e.world.activePet;return a?.evolution.look?f("div",{className:"sl-about-row",children:[i(be,{text:t("saucelings.evolve.undoNote",{name:a.name}),label:t("saucelings.help.label",{action:t("saucelings.evolve.undo")}),children:f("button",{type:"button",className:"sl-btn",disabled:s.isPending,onClick:()=>s.mutate(),children:["\u21A9 ",t("saucelings.evolve.undo")]})}),s.error&&!s.isPending?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:s.error})}):null]}):null}function dl(e){let[t,n]=U(null),s=e.join(" ");return W(()=>{if(!s)return;let a=Math.max(...s.split(" ").map(l=>Dt(l,!1)))*ze,r=0,o=l=>{n(l&&!_e()?Date.now():null),r=window.setTimeout(()=>o(!l),l?a:2100)};return r=window.setTimeout(()=>o(!0),1200),()=>window.clearTimeout(r)},[s]),Yt(()=>s.split(" ").map(a=>t===null?null:{kind:"move",move:a,encore:!1,travel:0,spot:!0,at:t}),[s,t])}function pl({pet:e,assetUrl:t,onClose:n}){let{t:s}=Z(),a=de(),r=Q(null),[o,l]=U(!1),c=e.careProfile.characterName,u=v=>{a.setQueryData(["saucelings","state"],v)},p=te({mutationFn:()=>V("/evolve/options","POST",{}),onSuccess:u}),d=te({mutationFn:v=>V("/evolve/choose","POST",{index:v}),onSuccess:v=>{u(v),n()}}),m=te({mutationFn:()=>V("/evolve/decline","POST",{}),onSuccess:v=>{u(v),n()}}),b=e.evolution.choices,y=dl(b?.map(v=>v.move)??[]),h=p.isPending||d.isPending||m.isPending,g=p.error??d.error??m.error;return W(()=>{let v=r.current;return v&&!v.open&&v.showModal(),v?.focus(),()=>v?.close()},[]),W(()=>{b||p.mutate()},[]),f("dialog",{ref:r,className:"sl-dialog sl-dialog--wide",tabIndex:-1,"aria-labelledby":"sl-evolve-title",onCancel:v=>{v.preventDefault(),o?l(!1):h||n()},children:[i("h2",{id:"sl-evolve-title",children:o?s("saucelings.evolve.declineConfirm",{name:e.name}):s("saucelings.evolve.title",{name:e.name})}),o?f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",autoFocus:!0,onClick:()=>l(!1),children:s("saucelings.common.cancel")}),i("button",{type:"button",className:"sl-btn",disabled:h,onClick:()=>m.mutate(),children:s("saucelings.evolve.decline")})]}):f(re,{children:[b?i("div",{className:"sl-evolve-choices",children:b.map((v,k)=>f("div",{className:"sl-evolve-choice",children:[i("span",{className:"sl-sprite-stage sl-sprite-stage--tile",children:i(Pe,{art:{...e,evolution:{...e.evolution,look:v}},species:e.species,stage:e.stage,mood:"happy",act:y[k]??null,facing:e.flipped?"left":"right",flipped:e.flipped,assetUrl:t,alt:"",scale:2})}),i("h3",{children:v.form}),i("p",{children:v.description}),i("p",{className:"sl-evolve-from",children:s("saucelings.evolve.from",{from:v.from})}),i("p",{children:s("saucelings.evolve.move",{move:s(`saucelings.evolve.moves.${v.move}`)})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:h,onClick:()=>d.mutate(k),children:s("saucelings.evolve.become",{form:v.form})})]},v.form))}):i("p",{role:"status",children:p.isPending||!g?s("saucelings.evolve.writing",{caretaker:c,name:e.name}):null}),g&&!h?i("p",{role:"alert",style:{color:"#f87171"},children:i(ce,{error:g})}):null,f("div",{className:"sl-dialog-actions",children:[g&&!b&&!h?i("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>p.mutate(),children:s("saucelings.error.retry")}):null,i("button",{type:"button",className:"sl-btn",disabled:h,onClick:n,children:s("saucelings.evolve.keep")})]}),f("p",{className:"sl-evolve-decline",children:[i("button",{type:"button",className:"sl-link",disabled:h,onClick:()=>l(!0),children:s("saucelings.evolve.decline")})," ",s("saucelings.evolve.declineNote",{name:e.name})]})]})]})}var Jr="saucelings-tour-seen";function ya(){try{return localStorage.getItem(Jr)==="1"}catch{return!1}}function ml(){try{localStorage.setItem(Jr,"1")}catch{}}function va(e){return`/sprites/mari/basic/pose-${e}.webp?v=39c2`}var In=[{title:"saucelings.tour.eggTitle",body:"saucelings.tour.eggBody",target:null,pose:"greet"},{title:"saucelings.tour.metersTitle",body:"saucelings.tour.metersBody",target:"meters",pose:"point-up"},{title:"saucelings.tour.careTitle",body:"saucelings.tour.careBody",target:"care",pose:"point-down"},{title:"saucelings.tour.caretakerTitle",body:"saucelings.tour.caretakerBody",target:"caretaker",pose:"explaining"},{title:"saucelings.tour.aboutTitle",body:"saucelings.tour.aboutBody",target:"about",pose:"point-down"},{title:"saucelings.tour.tabsTitle",body:"saucelings.tour.tabsBody",target:"tabs",pose:"point-up"}],fl={...In[0],title:"saucelings.tour.petTitle",body:"saucelings.tour.petBody"};function Zr({caretaker:e,hatched:t,onClose:n}){let{t:s}=Z(),[a,r]=U(0),[o,l]=U(!0),c=Q(null),u=Qt(),p=a===0&&t?fl:In[a],d=a===In.length-1;return W(ml,[]),W(()=>{let m=c.current?.closest(".sl-shell")??document,b=p.target?[...m.querySelectorAll(`[data-sl-tour="${p.target}"]`)]:[];if(!b.length)return;for(let h of b)h.classList.add("sl-tour-target");let y=window.matchMedia("(prefers-reduced-motion: reduce)").matches;return b[0].scrollIntoView({block:"center",behavior:y?"auto":"smooth"}),()=>b.forEach(h=>h.classList.remove("sl-tour-target"))},[p.target]),f("div",{ref:c,className:"sl-tour",role:"dialog","aria-labelledby":u,onKeyDown:m=>{m.key==="Escape"&&(m.stopPropagation(),n())},children:[o?i("img",{className:"sl-tour-mari",src:va(p.pose),alt:"",onError:()=>l(!1)}):null,f("div",{className:"sl-tour-text",children:[i("strong",{id:u,children:s(p.title,{caretaker:e})}),i("p",{children:s(p.body,{caretaker:e})}),f("div",{className:"sl-tour-foot",children:[i("span",{className:"sl-tour-dots","aria-hidden":"true",children:In.map((m,b)=>i("span",{className:b===a?"sl-tour-dot sl-tour-dot--on":"sl-tour-dot"},m.title))}),d?null:i("button",{type:"button",className:"sl-link",onClick:n,children:s("saucelings.tour.skip")}),a>0?i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>r(a-1),children:s("saucelings.tour.back")}):null,i("button",{type:"button",className:"sl-btn sl-btn--small sl-btn--primary",autoFocus:!0,onClick:()=>d?n():r(a+1),children:s(d?"saucelings.tour.done":"saucelings.tour.next")})]})]})]})}var eo=8,hl=10,bl={x:.5,y:.69},wa=2,to=32,Sa=13;function yl(e,t,n){let s=Math.max(e/n.width,t/n.height);return{left:(e-n.width*s)/2,top:(t-n.height*s)/2,width:n.width*s,height:n.height*s}}var vl=22;function wl(){let e=Q(null),[t,n]=U({width:0,height:0});return W(()=>{let s=e.current;if(!s||typeof ResizeObserver>"u")return;let a=()=>n(o=>o.width===s.clientWidth&&o.height===s.clientHeight?o:{width:s.clientWidth,height:s.clientHeight});a();let r=new ResizeObserver(a);return r.observe(s),()=>r.disconnect()},[]),[e,t]}function Nn({pet:e,reaction:t,assetUrl:n,backgroundSrc:s,paused:a=!1,caretaker:r=null,caretakerFlipped:o=!1,listenKey:l=null,handle:c,onMoveEgg:u}){let{t:p}=Z(),[d,{width:m,height:b}]=wl(),y=Q(null),h=Br(m,b),g=m/h,v=nt(e),k=e.stage==="egg",x=s!==null,_=pe(()=>{let Y=d.current,J=y.current;return!Y||!J?null:Math.round((J.getBoundingClientRect().left-Y.getBoundingClientRect().left)/h)},[h,d]),P=e.design?void 0:lr[e.species],[B,C]=U({id:e.id,isEgg:k}),[S,$]=U(!1);(B.id!==e.id||B.isEgg!==k)&&(C({id:e.id,isEgg:k}),$(B.id===e.id&&!k&&!!P&&!a&&!_e()));let O=S?null:t;W(()=>{k&&P&&kn(n).catch(()=>{})},[k,P,n]);let L=r!==null,{actor:E,poke:I,listen:R,comeOver:T,celebrate:M,hatch:G}=Wr({stageArtWidth:qr(g,L),mood:v.mood,species:e.species,enabled:!k,busy:S||t!==null,paused:a,move:e.evolution.look?.move??null,measureX:_}),w=e.evolution.look?.colour??null,N=Q(w);W(()=>{w!==N.current&&(N.current=w,w&&M(rt[w].moves[0]))},[w,M]),Ge(()=>{S&&P&&G(P.how,P.colour,P.moves,()=>$(!1))},[S,P,G]),Ha(c,()=>({comeOver:()=>T(L)}),[T,L]);let H=Q(l);W(()=>{l!==H.current&&(H.current=l,l&&R(L))},[l,R,L]);let D=Y=>{let J=d.current;J&&I((Y.clientX-J.getBoundingClientRect().left)/h)},[q,j]=U({width:16,height:9}),[z,ee]=U(null),ne=e.eggSpot?.backgroundId===(x?e.backgroundId:null)?e.eggSpot:null,oe=k?z??ne??(x?null:bl):null,ue=yl(m,b,q),he=b/h,ye=k&&u!==void 0&&m>0,Oe=(Y,J)=>{let me=(52/2-Sa)*h,ke=Math.min(m-me,Math.max(me,Y)),Ie=Math.min(b,Math.max(to*h,J));return{x:(ke-ue.left)/ue.width,y:(Ie-ue.top)/ue.height}},Ce=Y=>({px:ue.left+Y.x*ue.width,py:ue.top+Y.y*ue.height}),ve=Q(void 0),ie=Q(null);W(()=>()=>{window.clearTimeout(ve.current),ie.current&&u?.(ie.current).catch(()=>{})},[]);let Re=(Y,J)=>{ee(Y),ie.current=Y,window.clearTimeout(ve.current),ve.current=window.setTimeout(()=>{ie.current=null,u?.(Y).catch(()=>{}).finally(()=>ee(me=>me===Y?null:me))},J)},Se=Q(null),We=Y=>{let J=d.current?.getBoundingClientRect();return J?{px:Y.clientX-J.left,py:Y.clientY-J.top}:null},Qe=ye?{onPointerDown:Y=>{let J=We(Y);if(!J||!oe||Y.button!==0)return;Y.stopPropagation(),Y.currentTarget.setPointerCapture(Y.pointerId);let me=Ce(oe);Se.current={pointer:Y.pointerId,dx:J.px-me.px,dy:J.py-me.py,to:null}},onPointerMove:Y=>{let J=Se.current,me=We(Y);if(!J||J.pointer!==Y.pointerId||!me)return;let ke=Oe(me.px-J.dx,me.py-J.dy),Ie=Ce(oe??ke),St=Ce(ke);!J.to&&Math.hypot(St.px-Ie.px,St.py-Ie.py)<4||(J.to=ke,ee(ke))},onPointerUp:Y=>{let J=Se.current;Se.current=null,J?.to&&Re(J.to,0),Y.stopPropagation()},onPointerCancel:()=>{Se.current=null,ee(null)},onKeyDown:Y=>{let J=(Y.shiftKey?8:2)*h,[me,ke]=Y.key==="ArrowLeft"?[-J,0]:Y.key==="ArrowRight"?[J,0]:Y.key==="ArrowUp"?[0,-J]:Y.key==="ArrowDown"?[0,J]:[0,0];if(!me&&!ke||!oe)return;Y.preventDefault();let Ie=Ce(oe);Re(Oe(Ie.px+me,Ie.py+ke),500)}}:{},vt=Y=>{let J=We(Y);!ye||!J||y.current?.contains(Y.target)||Re(Oe(J.px,J.py),0)},Me=oe?Ce(oe):null,Ye=Me?Math.min(g-52+Sa,Math.max(-Sa,Math.round(Me.px/h-52/2))):E.x,qt=Me?`${Math.min(he-to-wa,Math.max(-wa,Math.round(he-Me.py/h-wa)))*h}px`:`${eo}%`,An={"--sl-px":`${h}px`,"--sl-x":Ye,"--sl-move-ms":`${Me?0:E.moveMs}ms`,"--sl-steps":E.steps,bottom:qt,width:`${52*h}px`,height:`${52*h}px`},Pn=Rn(v.mood,O?.action??null,E.face),wt=Gr.includes(e.species)&&!e.design&&!k;return f("div",{ref:d,className:"sl-stage","data-paused":a?"true":void 0,onPointerDown:D,onClick:vt,style:{"--sl-hover":hl,"--sl-px":`${h}px`},children:[i("img",{className:`sl-stage-bg ${x?"":"sl-stage-bg--pixel"}`,src:x?s:n(mt(e)),alt:"",draggable:!1,onLoad:Y=>{let{naturalWidth:J,naturalHeight:me}=Y.currentTarget;J>0&&me>0&&j({width:J,height:me})}}),r&&"figure"in r?i("div",{className:"sl-stage-figure","aria-hidden":"true","data-breathes":r.rows===2?"true":void 0,"data-flipped":o?"true":void 0,style:{backgroundImage:`url("${r.figure}")`,backgroundSize:`${r.frames*Fe*h}px ${r.rows*Fe*h}px`,backgroundPositionX:`${-r.frame*Fe*h}px`,width:`${Fe*h}px`,height:`${Fe*h}px`,right:`${-vl*h}px`,bottom:`calc(${eo}% + ${2*h}px)`},children:r.blink?i("div",{className:"sl-stage-blink",style:{backgroundImage:`url("${r.blink}")`}}):null}):r?i("img",{className:"sl-stage-caretaker","data-flipped":o?"true":void 0,src:r.src,alt:"",draggable:!1}):null,i("div",{ref:y,className:"sl-stage-actor","data-facing":e.flipped===(E.facing==="left")?"right":"left","data-hover":wt?"true":void 0,"data-movable":ye?"true":void 0,style:An,...ye?{tabIndex:0,role:"img","aria-label":p("saucelings.egg.moveLabel"),title:p("saucelings.egg.moveHint")}:{},...Qe,children:m>0?i(Pe,{art:e,species:e.species,stage:v.stage,mood:Pn,assetUrl:n,alt:k?p("saucelings.egg.name"):`${e.name} (${je(e).name})`,scale:h,still:a,reaction:O,pose:E.pose,cue:E.cue,act:k?null:E.act,facing:E.facing,flipped:e.flipped}):null}),k?null:i("span",{className:"sl-sr-only",children:p("saucelings.stage.tapHint",{name:e.name})})]})}function so({characters:e,defaultCaretakerId:t,submitLabel:n,pending:s,onSubmit:a,onCancel:r}){let{t:o}=Z(),[l,c]=U(t),u=e.find(d=>d.id===l),p=gt(l,!!u);return f("div",{className:"sl-egg-form",style:{display:"flex",flexWrap:"wrap",gap:"0.6rem",justifyContent:"center",alignItems:"center",marginTop:"0.5rem"},children:[i(pt,{name:u?.name??o("saucelings.empty.houseCaretaker"),src:p}),i("select",{className:"sl-select",value:l,onChange:d=>c(d.target.value),"aria-label":o("saucelings.empty.pickCaretaker"),children:e.length===0?i("option",{value:"caretaker",children:o("saucelings.empty.houseCaretaker")}):e.map(d=>i("option",{value:d.id,children:d.name},d.id))}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:s,onClick:()=>a({characterId:l}),children:s?o("saucelings.empty.bringingEgg"):n}),r?i("button",{type:"button",className:"sl-btn",onClick:r,children:o("saucelings.common.cancel")}):null,e.length===0?i("p",{style:{flexBasis:"100%",margin:0,fontSize:"0.8rem",opacity:.7,textAlign:"center"},children:o("saucelings.empty.houseCaretakerNote")}):null]})}function ro({unlocks:e}){let{t}=Z(),n=["prismite","thundrake","clockrit"],s=n.filter(a=>e[a].done).length+(e.halloween?1:0);return f("details",{className:"sl-unlocks",children:[i("summary",{children:t("saucelings.unlocks.title",{have:s,total:n.length+1})}),f("ul",{children:[n.map(a=>i("li",{children:e[a].done?t("saucelings.unlocks.done",{name:hn[a].name}):t(`saucelings.unlocks.${a}`,{...e[a]})},a)),i("li",{children:e.halloween?t("saucelings.unlocks.halloweenNow"):t("saucelings.unlocks.halloween")})]})]})}function Gt({label:e,help:t,value:n,gapLabel:s,keepGap:a=!1}){return f("div",{className:`sl-meter-box ${s?"sl-meter-box--gap":""}`,title:s??void 0,children:[f("div",{className:"sl-meter-head",children:[i(be,{text:t,trigger:e}),f("span",{className:"sl-meter-value",children:[n,"%"]})]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})}),s?i("div",{className:`sl-meter-gap ${a?"sl-meter-gap--keep":""}`,children:s}):null]})}var oo=null,Sl=4e3,kl=["hatch","stage-up","evolve-offer","evolve"],xl=48;function io({state:e,packageId:t,packageVersion:n,askVoice:s}){let{t:a}=Z(),r=de(),o=e.world.activePet,l=e.characters,[c,u]=U(!1),[p,d]=U(!1),[m,b]=U(null),[y,h]=U(!1),[g,v]=U(""),[k,x]=U(null),[_,P]=U("feedReliability"),[B,C]=U(null),[S,$]=En(),O=Q(null),[L,E]=gn(15e3),I=A=>Ke(t,A,n),R=o?.backgroundId??null,T=le({queryKey:["saucelings","background",R],queryFn:()=>V(`/background/${encodeURIComponent(R??"")}`),enabled:R!==null,staleTime:1/0}),M=R?T.data?.image??null:null,[G,w]=U(!1),N=o?.journal.find(A=>A.kind==="user-care"||A.kind==="nudge")??null,H=N?.id,D=N?.text,q=Q(H),[j,z]=U({text:"",shown:!1}),ee=Q(0),ne=A=>{z({text:A,shown:!0}),window.clearTimeout(ee.current),ee.current=window.setTimeout(()=>z(ge=>({...ge,shown:!1})),6e3)};W(()=>()=>window.clearTimeout(ee.current),[]),W(()=>{!H||H===q.current||(q.current=H,ne(D??""))},[H,D]);let[oe,ue]=Ms(xl),he=fn(o?.caretakerId??"",l.some(A=>A.id===o?.caretakerId)),ye=o?e.world.caretakerFigures[o.caretakerId]:void 0,Oe=dt(ye),Ce=mn(ye,Oe),ve=o?.journal.find(A=>Yn.includes(A.kind))??null,ie=ve&&!e.writing.includes(ve.id)?ve:null,Re=ie?.kind==="caretaker-care"?Os(ie.outcome):null,Se=Re?ie?.id??null:null,[We,Qe]=et(dn);W(()=>{!Re||!Se||Se===oo||(oo=Se,(O.current?.comeOver()??Promise.resolve()).then(()=>{$(Re),Qe(Re)}))},[Re,Se,$,Qe]);let[vt,Me]=et(Sl),Ye=ie&&kl.includes(ie.kind)?ie.id:null,qt=Q(Ye);W(()=>{!Ye||Ye===qt.current||(qt.current=Ye,Me(!0))},[Ye,Me]);let[An,Pn]=U(!1),wt=Rs(o);W(()=>{if(wt===null)return;let A=window.setTimeout(()=>{r.invalidateQueries({queryKey:["saucelings","state"]})},Math.max(0,wt-Date.now())+1e3);return()=>window.clearTimeout(A)},[wt,r]);let Y=A=>{x(null),r.setQueryData(["saucelings","state"],A)},J=A=>x(A??new Error(a("saucelings.error.request"))),me=te({mutationFn:A=>V("/adopt","POST",A),onSuccess:A=>{u(!1),Y(A)},onError:J}),ke=te({mutationFn:A=>V("/action","POST",{action:A}),onMutate:()=>({arrived:O.current?.comeOver()??Promise.resolve()}),onSuccess:(A,ge,st)=>{Y(A),E(),st.arrived.then(()=>{$(ge),ge!=="talk"&&Qe(ge)})},onError:J}),Ie=te({mutationFn:()=>V("/check-in","POST",{}),onSuccess:Y,onError:J}),St=te({mutationFn:A=>V("/nudge","POST",{tendency:A}),onSuccess:A=>{Y(A),E()},onError:J}),kt=te({mutationFn:A=>V("/pet","PATCH",A),onSuccess:(A,ge)=>{h(!1),b(null),Y(A),ge.caretakerId&&s(ge.caretakerId)},onError:J}),_n=te({mutationFn:({characterId:A,name:ge})=>V("/voice","POST",{characterId:A}).catch(()=>{throw new Error(a("saucelings.voice.failed",{name:ge}))}),onSuccess:Y,onError:J}),xa=A=>me.mutate(A,{onSuccess:()=>{let ge=()=>s(A.characterId);A.swap||ya()?ge():C({then:ge})}}),Ea=te({mutationFn:()=>V("/retire","POST",{}),onSuccess:A=>{d(!1),Y(A)},onError:J});if(!o)return f("div",{className:"sl-card",style:{display:"grid",gap:"1rem",textAlign:"center",padding:"2rem"},children:[i("div",{style:{display:"flex",justifyContent:"center"},children:i(bt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:I,alt:a("saucelings.empty.eggAlt"),scale:2})}),i("h2",{style:{fontSize:"1.125rem",fontWeight:600,margin:0},children:a("saucelings.empty.title")}),i("p",{style:{fontSize:"0.85rem",opacity:.8,maxWidth:"32rem",margin:"0 auto"},children:a("saucelings.empty.body")}),ya()?null:f("div",{className:"sl-mari-line",children:[i("img",{src:va("wave"),alt:"",onError:A=>A.currentTarget.hidden=!0}),i("p",{children:a("saucelings.empty.mari")})]}),i(so,{characters:l,defaultCaretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.empty.bringEgg"),pending:me.isPending,onSubmit:xa}),i(ro,{unlocks:e.unlocks}),k?i("p",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem",margin:0},children:i(ce,{error:k})}):null]});let we=o.stage==="egg",On=je(o),Xe=Ue(o),Ne=Xe?.sauce??null,Fn=o.name===On.name,Te=o.careProfile.characterName,xt=l.some(A=>A.id===o.caretakerId),Ca=_t(o,L),Ra=!o.lockedStage&&o.stage!=="elder"&&o.meters.hunger<qa,ho=Ne?{"--sl-sauce-accent":Ne.accentColor,"--sl-sauce-bg":Ne.badgeBg}:{},Vt=we?[{tendency:"feedReliability",label:a("saucelings.nudge.warm")},{tendency:"affection",label:a("saucelings.nudge.talk")}]:[{tendency:"feedReliability",label:a("saucelings.nudge.meals")},{tendency:"overfeeding",label:a("saucelings.nudge.portions")},{tendency:"playfulness",label:a("saucelings.nudge.play")},{tendency:"affection",label:a("saucelings.nudge.cuddles")}],Ma=Vt.some(A=>A.tendency===_)?_:Vt[0].tendency,Ia=Vt.flatMap(A=>{let ge=o.nudges.find(Aa=>Aa.tendency===A.tendency&&Date.parse(Aa.expiresAt)>L);if(!ge)return[];let st=Math.ceil((Date.parse(ge.expiresAt)-L)/36e5);return[a("saucelings.nudge.left",{ask:A.label,hours:st})]}),bo=o.journal.filter(A=>Yn.includes(A.kind)),yo=bn({gaps:e.gaps,line:ve,speaking:An||ve!==null&&e.writing.includes(ve.id),cheering:vt!==null,caring:We}),Na=yn(Oe,he,yo,Ce),Ta=f(re,{children:[i("div",{className:"sl-care-row","data-sl-tour":"caretaker",children:i("button",{type:"button",className:"sl-btn",disabled:Ie.isPending,onClick:()=>Ie.mutate(),children:Ie.isPending?a("saucelings.checkIn.pending",{name:Te}):`\u{1F4AC} ${a("saucelings.checkIn.button",{name:Te})}`})}),f("div",{className:"sl-care-row sl-ask-row","data-sl-tour":"caretaker",children:[i("label",{htmlFor:"sl-nudge-pick",className:"sl-care-ask",children:a("saucelings.nudge.heading",{name:Te})}),i("select",{id:"sl-nudge-pick",className:"sl-select sl-select--small",value:Ma,onChange:A=>P(A.target.value),children:Vt.map(A=>i("option",{value:A.tendency,children:A.label},A.tendency))}),i("button",{type:"button",className:"sl-btn sl-btn--small",disabled:St.isPending,onClick:()=>St.mutate(Ma),children:a("saucelings.nudge.ask")}),i("span",{className:"sl-care-note",children:Ia.length>0?a("saucelings.nudge.active",{asks:Ia.join(", ")}):a("saucelings.nudge.note")})]})]});return f("div",{ref:oe,className:"sl-nook",style:ho,children:[k?i("div",{role:"alert",className:"sl-card",style:{borderColor:"#ef4444",color:"#fca5a5",fontSize:"0.8125rem",padding:"0.65rem 1rem"},children:i(ce,{error:k})}):null,o.retireReady?i("div",{className:"sl-card sl-retire",children:p?f(re,{children:[i("span",{children:a("saucelings.retire.confirmNote",{name:o.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:Ea.isPending,onClick:()=>Ea.mutate(),children:a("saucelings.retire.confirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>d(!1),children:a("saucelings.common.cancel")})]}):f(re,{children:[i("span",{children:a("saucelings.retire.ready",{name:o.name})}),f("button",{type:"button",className:"sl-btn sl-btn--primary",onClick:()=>d(!0),children:["\u{1F4D6} ",a("saucelings.retire.button")]})]})}):null,f("div",{className:"sl-nook-main",children:[f("div",{className:"sl-card sl-stage-card",children:[f("div",{className:"sl-stage-bar",children:[y?f("div",{className:"sl-rename",children:[i("input",{className:"sl-input",style:{flex:"1 1 8rem",width:"100%"},value:g,maxLength:40,placeholder:a("saucelings.pet.namePlaceholder"),"aria-label":a("saucelings.pet.namePlaceholder"),onChange:A=>v(A.target.value)}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:!g.trim()||kt.isPending,onClick:()=>kt.mutate({name:g}),children:a("saucelings.common.save")}),i("button",{type:"button",className:"sl-btn",onClick:()=>h(!1),children:a("saucelings.common.cancel")})]}):f("div",{className:"sl-stage-title",children:[f("div",{className:"sl-stage-name",children:[i("h2",{style:{fontSize:"1.35rem",fontWeight:700,margin:0,overflowWrap:"anywhere"},children:we?a("saucelings.egg.name"):o.name}),we?null:i(zt,{pet:o}),we?null:i("button",{type:"button",className:`sl-btn sl-btn--small ${Fn?"sl-btn--primary":""}`,onClick:()=>{v(Fn?"":o.name),h(!0)},children:Fn?a("saucelings.pet.nameIt"):`\u270F\uFE0F ${a("saucelings.pet.rename")}`})]}),we?null:f("div",{className:"sl-stage-sub",title:Ne?`${Ne.origin} \u2014 ${Ne.readsAs}`:Xe?.readsAs,children:[Xe?`${Ne?a("saucelings.pet.sauce",{sauce:Ne.name}):a("saucelings.pet.temperament",{temperament:Xe.name})} \xB7 `:null,On.name," \xB7"," ",o.lockedStage?a("saucelings.pet.locked",{stage:a(`saucelings.stage.${o.lockedStage}`)}):a(`saucelings.stage.${o.stage}`)]})]}),f("button",{type:"button",className:"sl-btn sl-btn--small","aria-expanded":G,"aria-label":a("saucelings.nook.background"),title:a("saucelings.nook.background"),onClick:()=>w(A=>!A),children:["\u{1F5BC}",f("span",{className:"sl-btn-label",children:[" ",a("saucelings.nook.background")]})]}),i("button",{type:"button",className:"sl-btn sl-btn--small",onClick:()=>C({}),children:a("saucelings.tour.link")})]}),f("div",{className:"sl-scene",children:[i(Nn,{pet:o,reaction:S,assetUrl:I,backgroundSrc:M,caretaker:Na,caretakerFlipped:e.world.flippedCaretakers.includes(o.caretakerId),listenKey:ie?.id??null,handle:O,onMoveEgg:A=>kt.mutateAsync({eggSpot:A})}),i(Qr,{lines:bo,fallbackLine:we?a("saucelings.caretaker.idleEgg"):a("saucelings.caretaker.idle",{name:o.name}),caretakerId:o.caretakerId,caretakerName:Te,isCharacter:xt,meals:e.gaps.meals,isEgg:we,writing:e.writing,standing:Na!==null||Oe===void 0,onTyping:Pn,children:ue?Ta:null})]})]}),f("div",{className:"sl-card sl-care-card",children:[f("div",{className:"sl-meters sl-meters--strip","data-sl-tour":"meters",children:[we?f(re,{children:[i(Gt,{label:a("saucelings.meter.warmth"),help:a("saucelings.meter.warmthHelp"),value:Pt(o),gapLabel:e.gaps.warmth?a("saucelings.meter.warmthGap"):null}),i(Gt,{label:a("saucelings.meter.hatching"),help:a("saucelings.meter.hatchingHelp"),value:Ca,gapLabel:Ca>=100&&o.careActionCount<1?a("saucelings.meter.hatchingGap"):null})]}):f(re,{children:[i(Gt,{label:a("saucelings.meter.hunger"),help:a("saucelings.meter.hungerHelp"),value:o.meters.hunger,gapLabel:Ra?a("saucelings.pet.growthPaused"):e.gaps.hunger?a("saucelings.meter.hungerGap"):null,keepGap:Ra}),i(Gt,{label:a("saucelings.meter.mood"),help:a("saucelings.meter.moodHelp"),value:o.meters.mood,gapLabel:e.gaps.mood?a("saucelings.meter.moodGap"):null})]}),i(Gt,{label:a("saucelings.meter.bond"),help:a("saucelings.meter.bondHelp"),value:o.meters.bond})]}),i("div",{className:"sl-actions","data-sl-tour":"care",children:cn(o).map(A=>{let ge=pn(o,A,L),st=un(A,e.gaps);return f("button",{type:"button",className:`sl-btn ${st?"sl-btn--gap":""}`,disabled:ke.isPending,"aria-disabled":ge>0||void 0,onClick:()=>ge>0?ne(a("saucelings.action.resting",{action:a(At[A]),minutes:ge})):ke.mutate(A,{onSuccess:()=>{st&&Me(!0)}}),children:[ln[A]," ",a(At[A]),ge>0?` \xB7 ${a("saucelings.action.wait",{minutes:ge})}`:""]},A)})}),i("p",{className:`sl-action-note ${j.shown?"sl-action-note--shown":""}`,"aria-live":"polite",children:j.text}),i(Cn,{state:e,assetUrl:I}),i(Yr,{state:e,assetUrl:I}),ue?null:Ta]})]}),G?i(zr,{pet:o,settings:e.world.settings,assetUrl:I,onClose:()=>w(!1)}):null,f("details",{className:"sl-card sl-about","data-sl-tour":"about",children:[i("summary",{children:we?a("saucelings.about.egg"):a("saucelings.about.summary",{name:o.name})}),f("div",{className:"sl-about-body",children:[we?i("p",{children:a("saucelings.egg.about")}):f(re,{children:[f("p",{children:[On.look," \u2014 ",i("em",{children:o.quirk})]}),i("p",{children:Ne?a("saucelings.pet.sauceAbout",{sauce:Ne.name,readsAs:Ne.readsAs}):Xe&&o.ownTemperament?a("saucelings.pet.temperamentAbout",{temperament:Xe.name,readsAs:Xe.readsAs,after:o.ownTemperament.takesAfter.name}):a("saucelings.pet.temperamentForming")}),o.evolution.look?i("p",{title:o.evolution.look.description,children:a("saucelings.evolve.into",{form:o.evolution.look.form})}):null,o.evolution.look?i("p",{children:a("saucelings.evolve.move",{move:a(`saucelings.evolve.moves.${o.evolution.look.move}`)})}):null,i("div",{className:"sl-traits",children:o.traits.map(A=>f("span",{className:"sl-trait",children:["#",A]},A))})]}),i("p",{children:a("saucelings.menagerie.foundBy",{name:o.finder.name})}),f("div",{className:"sl-about-groups",children:[l.length>1||xt?f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.caretakerGroup")}),l.length>1?f("label",{className:"sl-about-row",children:[i("span",{children:a(we?"saucelings.pet.eggCaretaker":"saucelings.pet.caretaker")}),i("select",{className:"sl-select sl-select--small","aria-label":a("saucelings.empty.pickCaretaker"),value:m?.id??o.caretakerId,onChange:A=>b(l.find(ge=>ge.id===A.target.value)??null),children:l.map(A=>i("option",{value:A.id,children:A.name},A.id))})]}):null,m&&m.id!==o.caretakerId?f("div",{className:"sl-about-row",role:"group",children:[i("span",{children:we?a("saucelings.about.handOverEggNote",{caretaker:m.name}):a("saucelings.about.handOverNote",{name:o.name,caretaker:m.name})}),i("button",{type:"button",className:"sl-btn sl-btn--primary",disabled:kt.isPending,onClick:()=>kt.mutate({caretakerId:m.id}),children:a("saucelings.about.handOver")}),i("button",{type:"button",className:"sl-btn",onClick:()=>b(null),children:a("saucelings.common.cancel")})]}):null,xt?i("div",{className:"sl-about-row",children:i(be,{text:a("saucelings.about.refreshVoiceNote"),label:a("saucelings.help.label",{action:a("saucelings.about.refreshVoice",{name:Te})}),children:i("button",{type:"button",className:"sl-btn",disabled:_n.isPending,onClick:()=>_n.mutate({characterId:o.caretakerId,name:Te}),children:_n.isPending?a("saucelings.about.refreshingVoice",{name:Te}):`\u{1F504} ${a("saucelings.about.refreshVoice",{name:Te})}`})})}):null,xt?i(Ar,{state:e,characterId:o.caretakerId,name:Te,sprites:he}):null,xt?i(Tr,{state:e,characterId:o.caretakerId,name:Te}):null]}):null,f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.looksGroup")}),i(Mr,{state:e,assetUrl:I}),i(Nr,{state:e}),i(Xr,{state:e})]}),f("section",{className:"sl-about-group",children:[i("h3",{children:a("saucelings.about.newEggGroup")}),i("div",{className:"sl-about-row",children:f("button",{type:"button",className:"sl-btn","aria-expanded":c,onClick:()=>u(A=>!A),children:["\u{1F95A} ",a("saucelings.swap.button")]})}),c?f("div",{style:{display:"grid",gap:"0.5rem",textAlign:"center"},children:[i("p",{style:{margin:0,fontSize:"0.85rem"},children:we?a("saucelings.swap.noteEgg"):a("saucelings.swap.note",{name:o.name})}),i(so,{characters:l,defaultCaretakerId:l.some(A=>A.id===o.caretakerId)?o.caretakerId:l[0]?.id??"caretaker",submitLabel:a("saucelings.swap.confirm"),pending:me.isPending,onSubmit:A=>xa({...A,swap:!0}),onCancel:()=>u(!1)}),i(ro,{unlocks:e.unlocks})]}):null]})]})]})]}),B?i(Zr,{caretaker:Te,hatched:o.stage!=="egg",onClose:()=>{C(null),B.then?.()}}):null]})}var El=new Set(["image_generation","video_generation","audio","decision"]);function lo({value:e,min:t,max:n,onSave:s}){let[a,r]=U(String(e));return W(()=>r(String(e)),[e]),i("input",{type:"number",className:"sl-input",min:t,max:n,style:{width:"5rem"},value:a,onChange:l=>r(l.target.value),onBlur:()=>{let l=a.trim()===""?Number.NaN:Number(a);if(!Number.isFinite(l))return r(String(e));let c=Math.min(n,Math.max(t,Math.round(l)));r(String(c)),c!==e&&s(c)},onKeyDown:l=>{l.key==="Enter"&&l.currentTarget.blur()}})}function co({state:e}){let{t}=Z(),n=de(),s=e.world.settings,a=e.world.budget,[r,o]=U(!1),l=le({queryKey:["saucelings","connections"],queryFn:()=>xe("/api/connections")}),c=(l.data??[]).filter(g=>!El.has(g.provider)),u=l.data?.filter(g=>g.provider==="image_generation"),p=te({mutationFn:g=>V("/settings","PATCH",g),onSuccess:g=>n.setQueryData(["saucelings","state"],g)}),[d,m]=et(2e3),b=g=>p.mutate(g,{onSuccess:()=>m(Object.keys(g)[0])}),y=g=>d===g?i("span",{className:"sl-saved",role:"status",children:t("saucelings.settings.saved")}):null,h=te({mutationFn:()=>V("/reset","POST",{}),onSuccess:g=>{o(!1),n.setQueryData(["saucelings","state"],g)}});return f("div",{className:"sl-card",style:{display:"grid",gap:"1.15rem"},children:[f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.careWindow")," ",y("careWindowHours")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.careWindowNote")})]}),i(lo,{value:s.careWindowHours,min:1,max:24,onSave:g=>b({careWindowHours:g})})]}),f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.dailyBudget")," ",y("dailyGenerationBudget")]}),f("div",{style:{fontSize:"0.75rem",opacity:.7},children:[t("saucelings.settings.budgetUsed",{used:a.used,limit:s.dailyGenerationBudget})," ","\u2014 ",t("saucelings.settings.budgetNote")]})]}),i(lo,{value:s.dailyGenerationBudget,min:0,max:30,onSave:g=>b({dailyGenerationBudget:g})})]}),f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.connection")," ",y("connectionId")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.connectionNote")})]}),f("select",{className:"sl-input",value:s.connectionId??"",onChange:g=>b({connectionId:g.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.connectionDefault")}),c.map(g=>i("option",{value:g.id,children:g.name},g.id)),s.connectionId&&l.data&&!c.some(g=>g.id===s.connectionId)?i("option",{value:s.connectionId,children:t("saucelings.settings.connectionMissing")}):null]})]}),f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.writeEveryLine")," ",y("writeEveryLine")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.writeEveryLineNote")})]}),i("input",{type:"checkbox",checked:s.writeEveryLine,onChange:g=>b({writeEveryLine:g.target.checked})})]}),f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.images")," ",y("portraitEnabled")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imagesNote")})]}),i("input",{type:"checkbox",checked:s.portraitEnabled,onChange:g=>b({portraitEnabled:g.target.checked})})]}),s.portraitEnabled?f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.imageConnection")," ",y("portraitConnectionId")]}),u&&u.length===0?i("span",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.imageConnectionEmpty")}):f("select",{className:"sl-input",value:s.portraitConnectionId??"",onChange:g=>b({portraitConnectionId:g.target.value||null}),children:[i("option",{value:"",children:t("saucelings.settings.imageConnectionPick")}),(u??[]).map(g=>i("option",{value:g.id,children:g.name},g.id))]})]}):null,s.portraitEnabled?f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.threeDrawingFallback")," ",y("threeDrawingFallback")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.threeDrawingFallbackNote")})]}),i("input",{type:"checkbox",checked:s.threeDrawingFallback,onChange:g=>b({threeDrawingFallback:g.target.checked})})]}):null,f("label",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem"},children:[f("div",{children:[f("div",{style:{fontWeight:600,fontSize:"0.875rem"},children:[t("saucelings.settings.eggHunting")," ",y("eggHunting")]}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.settings.eggHuntingNote")})]}),i("input",{type:"checkbox",checked:s.eggHunting,onChange:g=>b({eggHunting:g.target.checked})})]}),p.error??h.error?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:p.error??h.error})}):null,f("div",{style:{borderTop:"1px solid var(--border, rgba(255,255,255,0.1))",paddingTop:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"},children:[i("span",{style:{fontSize:"0.8rem",opacity:.75},children:t("saucelings.settings.resetNote")}),r?f("div",{style:{display:"flex",gap:"0.5rem"},children:[i("button",{type:"button",className:"sl-btn",style:{background:"#dc2626",borderColor:"#dc2626",color:"#fff"},disabled:h.isPending,onClick:()=>h.mutate(),children:t("saucelings.settings.resetConfirm")}),i("button",{type:"button",className:"sl-btn",onClick:()=>o(!1),children:t("saucelings.common.cancel")})]}):i("button",{type:"button",className:"sl-btn",onClick:()=>o(!0),children:t("saucelings.settings.reset")})]})]})}function Kt({label:e,value:t,gap:n}){return f("div",{children:[f("span",{children:[e," ",t,"%"]}),i("div",{className:"sl-meter-bar",children:i("div",{className:`sl-meter-fill ${n?"sl-meter-fill--gap":""}`,style:{width:`${t}%`}})})]})}var Cl={warmth:"\u{1F525}",hatching:"\u{1F95A}",hunger:"\u{1F35D}",mood:"\u{1F60A}",bond:"\u{1F49B}"};function Rl({icon:e,label:t,value:n,gap:s}){return f("div",{className:"sl-widget-bar-row",role:"meter","aria-label":t,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":n,title:`${t} ${n}%`,children:[i("span",{className:"sl-widget-bar-icon","aria-hidden":"true",children:e}),i("span",{className:"sl-widget-bar-name","aria-hidden":"true",children:t}),i("div",{className:"sl-widget-bar",children:i("div",{className:`sl-meter-fill ${s?"sl-meter-fill--gap":""}`,style:{width:`${n}%`}})})]})}function uo({active:e,compact:t,packageId:n,packageVersion:s,onOpenNoodle:a}){let{t:r}=Z(),o=de(),[l,c]=En(),u=Q(null),[p,d]=et(dn),[m,b]=gn(3e4),y=z=>Ke(n,z,s),h=le({queryKey:["saucelings","state"],queryFn:()=>V("/state"),enabled:e,staleTime:1e4,refetchOnMount:"always",refetchInterval:z=>e?z.state.data?.writing.length?2e3:3e4:!1,refetchIntervalInBackground:!1}),g=te({mutationFn:z=>V("/action","POST",{action:z}),onMutate:()=>({arrived:u.current?.comeOver()??Promise.resolve()}),onSuccess:(z,ee,ne)=>{o.setQueryData(["saucelings","state"],z),b(),ne.arrived.then(()=>{c(ee),ee!=="talk"&&d(ee)})}}),v=h.data,k=v?.world.activePet,x=!!(k&&v?.characters.some(z=>z.id===k.caretakerId)),_=gt(k?.caretakerId??"",x),P=fn(k?.caretakerId??"",x&&!t),B=k&&!t?v?.world.caretakerFigures[k.caretakerId]:void 0,C=dt(B),S=mn(B,C),$=k?.backgroundId??null,O=le({queryKey:["saucelings","background",$],queryFn:()=>V(`/background/${encodeURIComponent($??"")}`),enabled:e&&!t&&$!==null,staleTime:1/0}),L=$?O.data?.image??null:null;if(!v)return f("div",{className:"sl-widget",style:{display:"grid",gap:"0.5rem",fontSize:"0.8rem"},children:[i("span",{style:{opacity:.75},children:h.isError?r("saucelings.error.load"):r("saucelings.loading")}),h.isError?i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{h.refetch()},children:r("saucelings.error.retry")})}):null]});if(!k)return i("div",{className:"sl-widget",role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:z=>{(z.key==="Enter"||z.key===" ")&&a?.()},children:f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(bt,{species:"rigamuffin",stage:"egg",mood:"content",assetUrl:y,alt:r("saucelings.empty.eggAlt"),scale:1,still:!e}),f("div",{children:[i("div",{style:{fontWeight:600,fontSize:"0.85rem"},children:r("saucelings.empty.title")}),i("div",{style:{fontSize:"0.72rem",opacity:.75},children:r("saucelings.widget.emptyHint")})]})]})});let E=k.stage==="egg",I=je(k),R=Ue(k),T=R?.sauce??null,M=nt(k),G=T?{"--sl-sauce-accent":T.accentColor,"--sl-sauce-bg":T.badgeBg}:{},w=f("div",{style:{minWidth:0,flex:1},children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"},children:[i("strong",{style:{fontSize:"0.875rem"},children:E?r("saucelings.egg.name"):k.name}),E||!R?null:i("span",{className:"sl-badge",style:{fontSize:"0.65rem",padding:"0.1rem 0.45rem"},title:R.readsAs,children:T?r("saucelings.pet.sauce",{sauce:T.name}):r("saucelings.pet.temperament",{temperament:R.name})})]}),f("div",{style:{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",marginTop:"0.15rem"},children:[i(pt,{name:k.careProfile.characterName,src:_,small:!0}),i("span",{style:{opacity:.75,minWidth:0},children:E?`${r("saucelings.pet.eggCaretaker")} ${k.careProfile.characterName}`:`${I.name} \xB7 ${r("saucelings.pet.caretaker")} ${k.careProfile.characterName}`})]})]}),N=f("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"0.4rem",fontSize:"0.68rem"},children:[E?f(re,{children:[i(Kt,{label:r("saucelings.meter.warmth"),value:Pt(k),gap:v?.gaps.warmth}),i(Kt,{label:r("saucelings.meter.hatching"),value:_t(k,m)})]}):f(re,{children:[i(Kt,{label:r("saucelings.meter.hunger"),value:k.meters.hunger,gap:v?.gaps.hunger}),i(Kt,{label:r("saucelings.meter.mood"),value:k.meters.mood,gap:v?.gaps.mood})]}),i(Kt,{label:r("saucelings.meter.bond"),value:k.meters.bond})]}),H=i("p",{style:{margin:0,fontSize:"0.75rem",opacity:.85,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:t?1:2,WebkitBoxOrient:"vertical"},children:v?.latestRemark}),D=z=>{(z.key==="Enter"||z.key===" ")&&a?.()};if(t)return f("div",{className:"sl-widget",style:G,role:"button",tabIndex:0,onClick:()=>a?.(),onKeyDown:D,children:[f("div",{style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[i(Pe,{art:k,species:k.species,stage:M.stage,mood:Rn(M.mood,l?.action??null,null),assetUrl:y,alt:E?r("saucelings.egg.name"):k.name,scale:1,still:!e,reaction:l}),w]}),N,H]});let q=v?yn(C,P,bn({gaps:v.gaps,line:null,speaking:!1,cheering:!1,caring:p}),S):null,j=E?[{key:"warmth",label:r("saucelings.meter.warmth"),value:Pt(k),gap:v?.gaps.warmth},{key:"hatching",label:r("saucelings.meter.hatching"),value:_t(k,m),gap:!1}]:[{key:"hunger",label:r("saucelings.meter.hunger"),value:k.meters.hunger,gap:v?.gaps.hunger},{key:"mood",label:r("saucelings.meter.mood"),value:k.meters.mood,gap:v?.gaps.mood}];return j.push({key:"bond",label:r("saucelings.meter.bond"),value:k.meters.bond,gap:!1}),i("div",{className:"sl-widget sl-widget--stage",style:G,role:"button",tabIndex:0,"aria-label":E?r("saucelings.egg.name"):k.name,onClick:()=>a?.(),onKeyDown:D,children:f("div",{className:"sl-widget-body",children:[i("div",{className:"sl-widget-stage",onClick:z=>{E||z.stopPropagation()},children:i(Nn,{pet:k,reaction:l,assetUrl:y,backgroundSrc:L,paused:!e,caretaker:q,caretakerFlipped:v?.world.flippedCaretakers.includes(k.caretakerId),handle:u})}),f("div",{className:"sl-widget-hud",children:[i("div",{className:"sl-widget-bars",children:j.map(z=>i(Rl,{icon:Cl[z.key],label:z.label,value:z.value,gap:z.gap},z.key))}),f("div",{className:"sl-widget-acts",onClick:z=>z.stopPropagation(),onKeyDown:z=>z.stopPropagation(),children:[cn(k).slice(0,2).map(z=>{let ee=pn(k,z,m),ne=r(At[z]),oe=ee>0?`${ne} \xB7 ${r("saucelings.action.wait",{minutes:ee})}`:ne;return f("button",{type:"button",className:`sl-btn sl-widget-act ${v&&un(z,v.gaps)?"sl-btn--gap":""}`,"aria-label":oe,title:oe,disabled:g.isPending||ee>0,onClick:()=>g.mutate(z),children:[i("span",{"aria-hidden":"true",children:ln[z]}),ee>0?i("span",{className:"sl-widget-act-wait","aria-hidden":"true",children:ee}):null]},z)}),g.error?i("span",{role:"alert",style:{color:"#f87171",fontSize:"0.8rem"},children:i(ce,{error:g.error})}):null]})]})]})})}var go=`
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
.sl-about-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr)); gap: 0.75rem; margin-top: 0.25rem; }
.sl-about-group { display: grid; align-content: start; gap: 0.5rem; min-width: 0; padding-top: 0.6rem; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); }
.sl-about-group > h3 { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.7; }
.sl-unlocks { margin: 0 auto; max-width: 32rem; font-size: 0.8rem; text-align: left; }
.sl-unlocks > summary { cursor: pointer; font-weight: 600; opacity: 0.85; }
.sl-unlocks ul { display: grid; gap: 0.15rem; margin: 0.35rem 0 0; padding-left: 1.1rem; opacity: 0.85; }
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
.sl-widget-act { position: relative; width: 2.25rem; height: 2.25rem; padding: 0; border-radius: 50%; font-size: 1.05rem; background: rgba(0,0,0,0.5); }
.sl-widget-act-wait { position: absolute; top: -0.3rem; right: -0.3rem; min-width: 1.1rem; padding: 0.1rem 0.25rem; border-radius: 999px; background: var(--sl-amber); color: #000; font-size: 0.6rem; font-weight: 700; line-height: 1; }
.sl-btn.sl-widget-act:disabled { opacity: 1; }
.sl-widget-act:disabled > span:first-child { opacity: 0.5; }
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
`;function po(){let e=de(),[t,n]=U(null);return{ask:pe(a=>{let o=e.getQueryData(["saucelings","state"])?.characters.find(l=>l.id===a);o&&!o.hasVoice&&n({characterId:a,name:o.name})},[e]),dialog:t?i(Ml,{characterId:t.characterId,name:t.name,onFinish:()=>n(null)},t.characterId):null}}function Ml({characterId:e,name:t,onFinish:n}){let{t:s}=Z(),a=de(),r=Q(null),[o,l]=U("ask");W(()=>{let u=r.current;return u&&!u.open&&u.showModal(),u?.querySelector(".sl-btn--primary")?.focus(),()=>u?.close()},[]);let c=async()=>{l("reading"),r.current?.focus();try{let u=await V("/voice","POST",{characterId:e});a.setQueryData(["saucelings","state"],u),n()}catch{l("failed")}};return f("dialog",{ref:r,className:"sl-dialog",tabIndex:-1,"aria-labelledby":"sl-voice-title",onCancel:u=>{u.preventDefault(),o!=="reading"&&n()},children:[i("h2",{id:"sl-voice-title",children:s("saucelings.voice.title",{name:t})}),i("p",{role:"status",children:o==="reading"?s("saucelings.about.refreshingVoice",{name:t}):o==="failed"?s("saucelings.voice.failed",{name:t}):s("saucelings.voice.body",{name:t})}),o==="reading"?null:f("div",{className:"sl-dialog-actions",children:[i("button",{type:"button",className:"sl-btn",onClick:n,children:s(o==="ask"?"saucelings.voice.notNow":"saucelings.voice.close")}),i("button",{type:"button",className:"sl-btn sl-btn--primary",autoFocus:!0,onClick:()=>{c()},children:o==="ask"?s("saucelings.voice.read",{name:t}):s("saucelings.voice.tryAgain")})]})]})}var Il=new Pa({defaultOptions:{queries:{retry:!1,staleTime:5e3}}}),ka=class extends La.Component{constructor(){super(...arguments);se(this,"state",{error:null})}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n){let s=n.message||ut(this.props.element.capabilityProps?.localization,"saucelings.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Saucelings client capability stopped",n)}render(){return this.state.error?i("div",{className:"sl-shell",style:{padding:"1.5rem"},role:"alert",children:f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},children:[i("strong",{children:ut(this.props.element.capabilityProps?.localization,"saucelings.error.interface")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:this.state.error.message}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})},children:ut(this.props.element.capabilityProps?.localization,"saucelings.error.retry")})})]})}):this.props.children}},Nl=["nook","journal","album","menagerie","settings"],fo="saucelings-menagerie-seen";function Tl(){try{return localStorage.getItem(fo)}catch{return null}}function Al({props:e}){let{t}=Z(),[n,s]=U("nook"),a=po(),r=e.focusPostId,o=e.onFocusPostHandled;W(()=>{r&&o?.()},[r,o]);let l=le({queryKey:["saucelings","state"],queryFn:()=>V("/state"),refetchOnMount:"always",refetchInterval:b=>b.state.data?.writing.length?2e3:!1}),c=l.error?.status===404,u=l.data?.world.lastEggFindDay??null,[p,d]=U(Tl),m=u!==null&&u!==p&&n!=="menagerie";return W(()=>{if(!(n!=="menagerie"||!u)){d(u);try{localStorage.setItem(fo,u)}catch{}}},[n,u]),f("div",{className:"sl-shell",children:[f("header",{className:"sl-header",children:[f("div",{className:"sl-header-title",children:[i("strong",{style:{fontSize:"1rem"},children:t("saucelings.title")}),i("div",{style:{fontSize:"0.75rem",opacity:.7},children:t("saucelings.subtitle")})]}),i("nav",{className:"sl-nav","data-sl-tour":"tabs","aria-label":t("saucelings.nav.label"),children:Nl.map(b=>f("button",{type:"button",className:`sl-tab-btn ${n===b?"sl-tab-btn--active":""}`,"aria-current":n===b?"page":void 0,"aria-label":b==="menagerie"&&m?t("saucelings.tab.menagerieNew"):void 0,onClick:()=>s(b),children:[t(`saucelings.tab.${b}`),b==="album"&&l.data?.portraitCount?f("span",{className:"sl-tab-count",children:[" (",l.data.portraitCount,")"]}):null,b==="menagerie"&&l.data?.menagerieCount?f("span",{className:"sl-tab-count",children:[" (",l.data.menagerieCount,")"]}):null,b==="menagerie"&&m?i("span",{className:"sl-tab-dot","aria-hidden":"true"}):null]},b))})]}),i("main",{className:"sl-body",children:f("div",{className:"sl-container",children:[l.isError&&l.data?i("div",{role:"alert",style:{fontSize:"0.8rem",color:"#f87171",marginBottom:"0.5rem"},children:t("saucelings.error.load")}):null,l.isLoading?i("div",{className:"sl-card",style:{textAlign:"center",padding:"2rem",opacity:.75},children:t("saucelings.loading")}):l.data?n==="nook"?i(io,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,askVoice:a.ask}):n==="journal"?i(Fr,{state:l.data,onOpenNook:()=>s("nook")}):n==="album"?i(Or,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion}):n==="menagerie"?i($r,{state:l.data,packageId:e.packageId,packageVersion:e.packageVersion,onRestored:b=>{s("nook"),a.ask(b)}}):i(co,{state:l.data}):f("div",{className:"sl-card",style:{display:"grid",gap:"0.75rem"},role:"alert",children:[i("strong",{children:t("saucelings.error.load")}),i("span",{style:{fontSize:"0.8rem",opacity:.8},children:c?t("saucelings.error.restart"):i(ce,{error:l.error})}),i("div",{children:i("button",{type:"button",className:"sl-btn",onClick:()=>{l.refetch()},children:t("saucelings.error.retry")})})]})]})}),a.dialog]})}function Pl({element:e}){let t=e.capabilityProps??{},n=e.getAttribute("view"),s=typeof t.packageId=="string"?t.packageId:"saucelings",a=typeof t.packageVersion=="string"?t.packageVersion:null;return n==="widget"?i(uo,{active:t.active===!0,compact:t.widgetId==="sauceling-compact",packageId:s,packageVersion:a,onOpenNoodle:typeof t.onOpenNoodle=="function"?t.onOpenNoodle:void 0}):i(Al,{props:t})}function _l({element:e}){let[,t]=U(0);return W(()=>{let n=()=>t(s=>s+1);return e.addEventListener("marinara-capability-props",n),()=>e.removeEventListener("marinara-capability-props",n)},[e]),f(Cs,{localization:e.capabilityProps?.localization,children:[i("style",{children:go}),i(fr,{}),i(ka,{element:e,children:i(Pl,{element:e})})]})}var Tn=class extends HTMLElement{constructor(){super(...arguments);se(this,"__root",null);se(this,"capabilityProps");se(this,"capabilityRuntimeError")}attributeChangedCallback(n,s,a){n==="view"&&s!==a&&this.__root&&this.render()}render(){this.__root?.render(i(_a,{client:Il,children:i(_l,{element:this})}))}connectedCallback(){this.__root||(this.__root=Ua(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};se(Tn,"observedAttributes",["view"]);var mo="marinara-capability-saucelings";customElements.get(mo)||customElements.define(mo,Tn);
