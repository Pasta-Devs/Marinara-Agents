var Oa=Object.defineProperty;var Ea=(t,a,o)=>a in t?Oa(t,a,{enumerable:!0,configurable:!0,writable:!0,value:o}):t[a]=o;var ne=(t,a,o)=>Ea(t,typeof a!="symbol"?a+"":a,o);var Te=globalThis.__MARINARA_HOST__,f=Te&&Te.version===1&&Te.modules?Te.modules.react:void 0;if(!f)throw new Error("Marinara Engine does not provide react; this package needs capability API 1.341 or newer.");var At=f.Activity,Rt=f.Children,Tt=f.Component,Bt=f.Fragment,Dt=f.Profiler,Ft=f.PureComponent,qt=f.StrictMode,Ht=f.Suspense,Ot=f.ViewTransition,Et=f.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Ut=f.__COMPILER_RUNTIME,zt=f.act,Gt=f.addTransitionType,Vt=f.cache,_t=f.cacheSignal,Wt=f.captureOwnerStack,Xt=f.cloneElement,$e=f.createContext,me=f.createElement,jt=f.createRef,Ye=f.default,Be=f.forwardRef,Kt=f.isValidElement,Qt=f.lazy,Zt=f.memo,Jt=f.startTransition,$t=f.unstable_useCacheRefresh,Yt=f.use,eo=f.useActionState,De=f.useCallback,ea=f.useContext,ao=f.useDebugValue,to=f.useDeferredValue,P=f.useEffect,oo=f.useEffectEvent,ro=f.useId,so=f.useImperativeHandle,lo=f.useInsertionEffect,aa=f.useLayoutEffect,j=f.useMemo,uo=f.useOptimistic,no=f.useReducer,R=f.useRef,L=f.useState,io=f.useSyncExternalStore,fo=f.useTransition,co=f.version;var Fe=globalThis.__MARINARA_HOST__,pe=Fe&&Fe.version===1&&Fe.modules?Fe.modules["react-dom/client"]:void 0;if(!pe)throw new Error("Marinara Engine does not provide react-dom/client; this package needs capability API 1.341 or newer.");var ta=pe.createRoot,po=pe.default,go=pe.hydrateRoot,Lo=pe.version;var qe=globalThis.__MARINARA_HOST__,l=qe&&qe.version===1&&qe.modules?qe.modules["@tanstack/react-query"]:void 0;if(!l)throw new Error("Marinara Engine does not provide @tanstack/react-query; this package needs capability API 1.341 or newer.");var Io=l.CancelledError,xo=l.HydrationBoundary,yo=l.InfiniteQueryObserver,Co=l.IsRestoringProvider,vo=l.Mutation,No=l.MutationCache,So=l.MutationObserver,ko=l.QueriesObserver,wo=l.Query,bo=l.QueryCache,Po=l.QueryClient,Mo=l.QueryClientContext,oa=l.QueryClientProvider,Ao=l.QueryErrorResetBoundary,Ro=l.QueryObserver,To=l.dataTagErrorSymbol,Bo=l.dataTagSymbol,Do=l.defaultScheduler,Fo=l.defaultShouldDehydrateMutation,qo=l.defaultShouldDehydrateQuery,Ho=l.dehydrate,Oo=l.dehydrateQuery,Eo=l.environmentManager,Uo=l.experimental_streamedQuery,zo=l.focusManager,Go=l.hashKey,Vo=l.hydrate,_o=l.infiniteQueryOptions,Wo=l.isCancelledError,Xo=l.isServer,jo=l.keepPreviousData,Ko=l.matchMutation,Qo=l.matchQuery,Zo=l.mutationOptions,Jo=l.noop,$o=l.notifyManager,Yo=l.onlineManager,er=l.partialMatchKey,ar=l.queryOptions,tr=l.replaceEqualDeep,or=l.shouldThrowError,rr=l.skipToken,sr=l.timeoutManager,lr=l.unsetMarker,ur=l.useInfiniteQuery,dr=l.useIsFetching,nr=l.useIsMutating,ir=l.useIsRestoring,fr=l.useMutation,cr=l.useMutationState,mr=l.usePrefetchInfiniteQuery,pr=l.usePrefetchQuery,gr=l.useQueries,K=l.useQuery,Lr=l.useQueryClient,hr=l.useQueryErrorResetBoundary,Ir=l.useSuspenseInfiniteQuery,xr=l.useSuspenseQueries,yr=l.useSuspenseQuery;var He=globalThis.__MARINARA_HOST__;if(!He||He.version!==1||!He.queryClient)throw new Error("Marinara Engine does not provide its query client; this package needs capability API 1.341 or newer.");var Xe=He.queryClient;var ra={_meta:{locale:"ar",direction:"rtl"},"memoryNag.error.interface":"\u062A\u0648\u0642\u0641 Memory Nag.","memoryNag.error.retry":"\u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649","memoryNag.error.noChat":"\u0627\u0641\u062A\u062D \u0645\u062D\u0627\u062F\u062B\u0629 \u062A\u0642\u0645\u0651\u0635 \u0623\u062F\u0648\u0627\u0631 \u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 Memory Nag.","memoryNag.settings.scanConnection":"\u0627\u062A\u0635\u0627\u0644 \u0641\u062D\u0635 \u0627\u0644\u062E\u0632\u0646\u0629","memoryNag.settings.agentConnection":"\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0648\u0643\u064A\u0644","memoryNag.settings.connectionHelp":"\u062A\u0633\u062A\u062E\u062F\u0645 \u0639\u0645\u0644\u064A\u0627\u062A \u0641\u062D\u0635 \u0627\u0644\u062E\u0632\u0646\u0629 \u0627\u0644\u062F\u0641\u0639\u064A\u0629 \u0647\u0630\u0627 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0641\u0642\u0637. \u0648\u064A\u0638\u0644 \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621 \u0641\u064A \u0643\u0644 \u062F\u0648\u0631 \u064A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0645\u062D\u062F\u062F \u0641\u064A \u0645\u062D\u0631\u0631 \u0627\u0644\u0648\u0643\u064A\u0644.","memoryNag.settings.vaultPrompt":"\u0645\u0648\u062C\u0651\u0647 \u0625\u0646\u0634\u0627\u0621 \u0630\u0643\u0631\u064A\u0627\u062A \u0627\u0644\u062E\u0632\u0646\u0629","memoryNag.settings.vaultPromptHelp":"\u0639\u062F\u0651\u0644 \u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A. \u062A\u064F\u0636\u0627\u0641 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0641\u0639\u0629 \u0648\u0645\u0639\u0631\u0651\u0641\u0627\u062A \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A \u0648\u0627\u0644\u062D\u062F \u0648\u062A\u0646\u0633\u064A\u0642 JSON \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627.","memoryNag.settings.resetPrompt":"\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0627\u0644\u0645\u0648\u062C\u0651\u0647","memoryNag.settings.expandPrompt":"\u062A\u0648\u0633\u064A\u0639 \u0645\u062D\u0631\u0631 \u0627\u0644\u0645\u0648\u062C\u0651\u0647","memoryNag.settings.closePrompt":"\u0625\u063A\u0644\u0627\u0642 \u0645\u062D\u0631\u0631 \u0627\u0644\u0645\u0648\u062C\u0651\u0647","memoryNag.settings.macroReference":"\u0645\u0631\u062C\u0639 \u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0627\u0643\u0631\u0648","memoryNag.settings.macroReferenceHelp":"\u0648\u062D\u062F\u0627\u062A \u0645\u0627\u0643\u0631\u0648 \u0634\u0627\u0626\u0639\u0629 \u064A\u0645\u0643\u0646\u0643 \u0643\u062A\u0627\u0628\u062A\u0647\u0627 \u0641\u064A \u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u0648\u062C\u0651\u0647.","memoryNag.settings.closeMacros":"\u0625\u063A\u0644\u0627\u0642 \u0645\u0631\u062C\u0639 \u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0627\u0643\u0631\u0648","memoryNag.settings.messagesPerBatch":"\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0641\u064A \u0643\u0644 \u062F\u0641\u0639\u0629","memoryNag.settings.messagesPerBatchHelp":"\u064A\u062A\u062D\u0643\u0645 \u0623\u064A\u0636\u064B\u0627 \u0641\u064A \u0645\u0639\u062F\u0644 \u062A\u0634\u063A\u064A\u0644 \u0641\u062D\u0635 \u0627\u0644\u062E\u0632\u0646\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A.","memoryNag.settings.memoriesPerCharacter":"\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0630\u0643\u0631\u064A\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0644\u0643\u0644 \u0634\u062E\u0635\u064A\u0629","memoryNag.settings.memoriesPerCharacterHelp":"\u0644\u0643\u0644 \u062F\u0641\u0639\u0629. \u0642\u062F \u064A\u0646\u0634\u0626 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0639\u062F\u062F\u064B\u0627 \u0623\u0642\u0644 \u0623\u0648 \u0644\u0627 \u064A\u0646\u0634\u0626 \u0634\u064A\u0626\u064B\u0627.","memoryNag.settings.memoriesToConsider":"\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0630\u0643\u0631\u064A\u0627\u062A \u0627\u0644\u0645\u062F\u0631\u0648\u0633\u0629 \u0644\u0643\u0644 \u0634\u062E\u0635\u064A\u0629","memoryNag.settings.memoriesToConsiderHelp":"\u062A\u064F\u0631\u0633\u0644 \u0642\u0627\u0626\u0645\u0629 \u0645\u062E\u062A\u0635\u0631\u0629 \u0645\u062D\u062F\u062F\u0629 \u0625\u0644\u0649 \u0627\u0644\u0645\u062A\u062A\u0628\u0639 \u0641\u064A \u0643\u0644 \u062F\u0648\u0631.","memoryNag.settings.memoriesToInject":"\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0630\u0643\u0631\u064A\u0627\u062A \u0627\u0644\u0645\u062F\u0631\u062C\u0629","memoryNag.settings.memoriesToInjectHelp":"\u0642\u062F \u064A\u062E\u062A\u0627\u0631 \u0627\u0644\u0645\u062A\u062A\u0628\u0639 \u0639\u062F\u062F\u064B\u0627 \u0623\u0642\u0644 \u0623\u0648 \u064A\u0642\u0631\u0631 \u0623\u0646 \u0644\u0627 \u062A\u0630\u0643\u064A\u0631 \u0645\u0646\u0627\u0633\u0628.","memoryNag.settings.save":"\u062D\u0641\u0638 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A","memoryNag.settings.saved":"\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A.","memoryNag.settings.scan":"\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A","memoryNag.settings.scanning":"\u062C\u0627\u0631\u064D \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A\u2026","memoryNag.settings.stop":"\u0625\u064A\u0642\u0627\u0641","memoryNag.settings.vault":"\u0641\u062A\u062D \u0627\u0644\u062E\u0632\u0646\u0629","memoryNag.settings.progressTitle":"\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A","memoryNag.settings.preparing":"\u062C\u0627\u0631\u064D \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649\u2026","memoryNag.settings.closeProgress":"\u0625\u063A\u0644\u0627\u0642","memoryNag.settings.progress":"\u062A\u0645\u062A \u0645\u0639\u0627\u0644\u062C\u0629 {{processed}} \u0645\u0646 {{total}} \u0631\u0633\u0627\u0644\u0629 \xB7 \u0623\u064F\u0636\u064A\u0641\u062A {{created}} \xB7 \u062D\u064F\u0644\u0651\u062A {{resolved}}","memoryNag.settings.complete":"\u0627\u0643\u062A\u0645\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A.","memoryNag.settings.stalled":"\u062A\u0648\u0642\u0641 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627 \u0644\u0623\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0644\u0645 \u062A\u062A\u0642\u062F\u0645. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.","memoryNag.settings.stopped":"\u062A\u0648\u0642\u0641 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A.","memoryNag.vault.title":"\u062E\u0632\u0646\u0629 Memory Nag","memoryNag.vault.loading":"\u062C\u0627\u0631\u064D \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062E\u0632\u0646\u0629\u2026","memoryNag.vault.expandedTitle":"\u0645\u062D\u0631\u0631 \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0648\u0633\u0651\u0639","memoryNag.vault.close":"\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062E\u0632\u0646\u0629","memoryNag.vault.active":"\u0646\u0634\u0637\u0629","memoryNag.vault.resolved":"\u0645\u062D\u0644\u0648\u0644\u0629","memoryNag.vault.allCharacters":"\u0643\u0644 \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A","memoryNag.vault.pastParticipant":"\u0633\u0627\u0628\u0642","memoryNag.vault.search":"\u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A","memoryNag.vault.add":"\u0625\u0636\u0627\u0641\u0629 \u0630\u0643\u0631\u0649","memoryNag.vault.empty":"\u0644\u0627 \u062A\u0648\u062C\u062F \u0630\u0643\u0631\u064A\u0627\u062A \u0645\u0637\u0627\u0628\u0642\u0629.","memoryNag.vault.edit":"\u062A\u0639\u062F\u064A\u0644","memoryNag.vault.resolve":"\u062D\u0644\u0651","memoryNag.vault.restore":"\u0627\u0633\u062A\u0639\u0627\u062F\u0629","memoryNag.vault.delete":"\u062D\u0630\u0641","memoryNag.vault.deleteTitle":"\u062D\u0630\u0641 \u0627\u0644\u0630\u0643\u0631\u0649\u061F","memoryNag.vault.deleteMessage":"\u0633\u064A\u0624\u062F\u064A \u0647\u0630\u0627 \u0625\u0644\u0649 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0630\u0643\u0631\u0649 \u0646\u0647\u0627\u0626\u064A\u064B\u0627 \u0645\u0646 \u062E\u0632\u0646\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629.","memoryNag.vault.editorNew":"\u0630\u0643\u0631\u0649 \u062C\u062F\u064A\u062F\u0629","memoryNag.vault.editorEdit":"\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0630\u0643\u0631\u0649","memoryNag.vault.memory":"\u0627\u0644\u0630\u0643\u0631\u0649","memoryNag.vault.memoryPlaceholder":"\u062A\u0641\u0635\u064A\u0644 \u0642\u0635\u064A\u0631 \u064A\u0633\u062A\u062D\u0642 \u0623\u0646 \u0646\u0644\u062D\u0651 \u0639\u0644\u064A\u0647\u0645 \u0628\u0634\u0623\u0646\u0647\u2026","memoryNag.vault.characters":"\u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A","memoryNag.vault.chooseCharacter":"\u0627\u062E\u062A\u0631 \u0634\u062E\u0635\u064A\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.","memoryNag.vault.macros":"\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0627\u0643\u0631\u0648","memoryNag.vault.expand":"\u062A\u0648\u0633\u064A\u0639 \u0627\u0644\u0645\u062D\u0631\u0631","memoryNag.vault.collapse":"\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0645\u062D\u0631\u0631 \u0627\u0644\u0645\u0648\u0633\u0651\u0639","memoryNag.vault.cancel":"\u0625\u0644\u063A\u0627\u0621","memoryNag.vault.save":"\u062D\u0641\u0638 \u0627\u0644\u0630\u0643\u0631\u0649","memoryNag.toolbar.label":"\u062A\u0630\u0643\u064A\u0631\u0627\u062A \u0645\u0644\u062D\u0651\u0629","memoryNag.toolbar.regenerate":"\u0625\u0639\u0627\u062F\u0629 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062A\u0630\u0643\u064A\u0631\u0627\u062A","memoryNag.toolbar.lock":"\u062A\u0634\u063A\u064A\u0644 \u0648\u0636\u0639 \u0642\u0641\u0644 \u0627\u0644\u0645\u062A\u062A\u0628\u0639\u0627\u062A","memoryNag.toolbar.unlock":"\u0625\u0646\u0647\u0627\u0621 \u0648\u0636\u0639 \u0642\u0641\u0644 \u0627\u0644\u0645\u062A\u062A\u0628\u0639\u0627\u062A","memoryNag.toolbar.emptyWord":"\u0627\u0644\u0631\u0623\u0633 \u0641\u0627\u0631\u063A\u060C \u0644\u0627 \u0623\u0641\u0643\u0627\u0631","memoryNag.toolbar.none":"\u0644\u0627 \u062A\u0630\u0643\u064A\u0631\u0627\u062A \u0647\u0630\u0647 \u0627\u0644\u0645\u0631\u0629.","memoryNag.tracker.title":"\u062A\u0630\u0643\u064A\u0631\u0627\u062A \u0645\u0644\u062D\u0651\u0629","memoryNag.tracker.none":"\u0644\u0645 \u062A\u064F\u0633\u062A\u062F\u0639\u064E \u0623\u064A \u0630\u0643\u0631\u064A\u0627\u062A \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0648\u0631."};var sa={_meta:{locale:"de",direction:"ltr"},"memoryNag.error.interface":"Memory Nag wurde angehalten.","memoryNag.error.retry":"Erneut versuchen","memoryNag.error.noChat":"\xD6ffne einen Rollenspiel-Chat, um Memory Nag zu verwenden.","memoryNag.settings.scanConnection":"Verbindung f\xFCr Tresor-Scan","memoryNag.settings.agentConnection":"Agentenverbindung verwenden","memoryNag.settings.connectionHelp":"Nur Tresor-Stapelscans verwenden diese Verbindung. Der Abruf pro Zug nutzt weiterhin die im Agenteneditor festgelegte Verbindung.","memoryNag.settings.vaultPrompt":"Prompt f\xFCr Tresor-Erinnerungen","memoryNag.settings.vaultPromptHelp":"Bearbeite die Anweisungen zum Erstellen von Erinnerungen. Stapeldaten, Charakter-IDs, Limit und JSON-Format werden automatisch erg\xE4nzt.","memoryNag.settings.resetPrompt":"Prompt zur\xFCcksetzen","memoryNag.settings.expandPrompt":"Prompt-Editor erweitern","memoryNag.settings.closePrompt":"Prompt-Editor schlie\xDFen","memoryNag.settings.macroReference":"Makroreferenz","memoryNag.settings.macroReferenceHelp":"H\xE4ufige Makros, die du in Prompt-Feldern verwenden kannst.","memoryNag.settings.closeMacros":"Makroreferenz schlie\xDFen","memoryNag.settings.messagesPerBatch":"Nachrichten pro Stapel","memoryNag.settings.messagesPerBatchHelp":"Bestimmt auch, wie oft automatische Tresor-Scans laufen.","memoryNag.settings.memoriesPerCharacter":"Maximal erstellte Erinnerungen pro Charakter","memoryNag.settings.memoriesPerCharacterHelp":"Pro Stapel. Das Modell kann weniger oder keine erstellen.","memoryNag.settings.memoriesToConsider":"Maximal ber\xFCcksichtigte Erinnerungen pro Charakter","memoryNag.settings.memoriesToConsiderHelp":"Pro Zug wird eine deterministisch ausgew\xE4hlte Liste an den Tracker gesendet.","memoryNag.settings.memoriesToInject":"Maximal eingef\xFCgte Erinnerungen","memoryNag.settings.memoriesToInjectHelp":"Der Tracker kann weniger w\xE4hlen oder entscheiden, dass keine Erinnerung passt.","memoryNag.settings.save":"Einstellungen speichern","memoryNag.settings.saved":"Einstellungen gespeichert.","memoryNag.settings.scan":"Erinnerungen erstellen","memoryNag.settings.scanning":"Erinnerungen werden erstellt\u2026","memoryNag.settings.stop":"Anhalten","memoryNag.settings.vault":"Tresor \xF6ffnen","memoryNag.settings.progressTitle":"Erinnerungen erstellen","memoryNag.settings.preparing":"Erster Stapel wird vorbereitet\u2026","memoryNag.settings.closeProgress":"Schlie\xDFen","memoryNag.settings.progress":"{{processed}} von {{total}} Nachrichten verarbeitet \xB7 {{created}} hinzugef\xFCgt \xB7 {{resolved}} erledigt","memoryNag.settings.complete":"Erinnerungen wurden erstellt.","memoryNag.settings.stalled":"Das Erstellen wurde angehalten, weil der Chat nicht fortgeschritten ist. Versuche es erneut.","memoryNag.settings.stopped":"Erinnerungserstellung gestoppt.","memoryNag.vault.title":"Memory-Nag-Tresor","memoryNag.vault.loading":"Tresor wird geladen\u2026","memoryNag.vault.expandedTitle":"Erweiterter Erinnerungseditor","memoryNag.vault.close":"Tresor schlie\xDFen","memoryNag.vault.active":"Aktiv","memoryNag.vault.resolved":"Erledigt","memoryNag.vault.allCharacters":"Alle Charaktere","memoryNag.vault.pastParticipant":"fr\xFCher","memoryNag.vault.search":"Erinnerungen durchsuchen","memoryNag.vault.add":"Erinnerung hinzuf\xFCgen","memoryNag.vault.empty":"Keine passenden Erinnerungen.","memoryNag.vault.edit":"Bearbeiten","memoryNag.vault.resolve":"Erledigen","memoryNag.vault.restore":"Wiederherstellen","memoryNag.vault.delete":"L\xF6schen","memoryNag.vault.deleteTitle":"Erinnerung l\xF6schen?","memoryNag.vault.deleteMessage":"Dadurch wird die Erinnerung dauerhaft aus dem Tresor dieses Chats entfernt.","memoryNag.vault.editorNew":"Neue Erinnerung","memoryNag.vault.editorEdit":"Erinnerung bearbeiten","memoryNag.vault.memory":"Erinnerung","memoryNag.vault.memoryPlaceholder":"Ein kurzes Detail, an das sie erinnert werden sollten\u2026","memoryNag.vault.characters":"Charaktere","memoryNag.vault.chooseCharacter":"W\xE4hle mindestens einen Charakter.","memoryNag.vault.macros":"Makros","memoryNag.vault.expand":"Editor erweitern","memoryNag.vault.collapse":"Erweiterten Editor schlie\xDFen","memoryNag.vault.cancel":"Abbrechen","memoryNag.vault.save":"Erinnerung speichern","memoryNag.toolbar.label":"Erinnerungsstupser","memoryNag.toolbar.regenerate":"Erinnerungsstupser neu erzeugen","memoryNag.toolbar.lock":"Tracker-Sperrmodus aktivieren","memoryNag.toolbar.unlock":"Tracker-Sperrmodus beenden","memoryNag.toolbar.emptyWord":"Kopf leer, keine Gedanken","memoryNag.toolbar.none":"Diesmal keine Erinnerung.","memoryNag.tracker.title":"Erinnerungsstupser","memoryNag.tracker.none":"F\xFCr diesen Zug wurde keine Erinnerung abgerufen."};var la={_meta:{locale:"en",direction:"ltr"},"memoryNag.error.interface":"Memory Nag stopped.","memoryNag.error.retry":"Try again","memoryNag.error.noChat":"Open a Roleplay chat to use Memory Nag.","memoryNag.settings.scanConnection":"Vault scan connection","memoryNag.settings.agentConnection":"Use agent connection","memoryNag.settings.connectionHelp":"Only vault batch scans use this connection. Turn-by-turn recall keeps using the connection specified in the agent editor.","memoryNag.settings.vaultPrompt":"Vault memory prompt","memoryNag.settings.vaultPromptHelp":"Edit the instructions used to create memories. The batch data, character IDs, limit, and JSON format are added automatically.","memoryNag.settings.resetPrompt":"Reset prompt","memoryNag.settings.expandPrompt":"Expand prompt editor","memoryNag.settings.closePrompt":"Close prompt editor","memoryNag.settings.macroReference":"Macro reference","memoryNag.settings.macroReferenceHelp":"Common macros you can type into prompt fields.","memoryNag.settings.closeMacros":"Close macro reference","memoryNag.settings.messagesPerBatch":"Messages per batch","memoryNag.settings.messagesPerBatchHelp":"Also controls how often automatic vault scans run.","memoryNag.settings.memoriesPerCharacter":"Maximum memories created per character","memoryNag.settings.memoriesPerCharacterHelp":"Per batch. The model may create fewer or none.","memoryNag.settings.memoriesToConsider":"Maximum memories considered per character","memoryNag.settings.memoriesToConsiderHelp":"A deterministic shortlist is sent to the tracker each turn.","memoryNag.settings.memoriesToInject":"Maximum memories injected","memoryNag.settings.memoriesToInjectHelp":"The tracker may choose fewer or decide no nag is appropriate.","memoryNag.settings.save":"Save settings","memoryNag.settings.saved":"Settings saved.","memoryNag.settings.scan":"Create Memories","memoryNag.settings.scanning":"Creating memories\u2026","memoryNag.settings.stop":"Stop","memoryNag.settings.vault":"Open vault","memoryNag.settings.progressTitle":"Creating Memories","memoryNag.settings.preparing":"Preparing the first batch\u2026","memoryNag.settings.closeProgress":"Close","memoryNag.settings.progress":"Processed {{processed}} of {{total}} messages \xB7 {{created}} added \xB7 {{resolved}} resolved","memoryNag.settings.complete":"Memory creation complete.","memoryNag.settings.stalled":"Memory creation paused because the chat did not advance. Try again.","memoryNag.settings.stopped":"Memory creation stopped.","memoryNag.vault.title":"Memory Nag Vault","memoryNag.vault.loading":"Loading vault\u2026","memoryNag.vault.expandedTitle":"Expanded memory editor","memoryNag.vault.close":"Close vault","memoryNag.vault.active":"Active","memoryNag.vault.resolved":"Resolved","memoryNag.vault.allCharacters":"All characters","memoryNag.vault.pastParticipant":"past","memoryNag.vault.search":"Search memories","memoryNag.vault.add":"Add memory","memoryNag.vault.empty":"No matching memories.","memoryNag.vault.edit":"Edit","memoryNag.vault.resolve":"Resolve","memoryNag.vault.restore":"Restore","memoryNag.vault.delete":"Delete","memoryNag.vault.deleteTitle":"Delete memory?","memoryNag.vault.deleteMessage":"This permanently removes the memory from this chat's vault.","memoryNag.vault.editorNew":"New memory","memoryNag.vault.editorEdit":"Edit memory","memoryNag.vault.memory":"Memory","memoryNag.vault.memoryPlaceholder":"One short detail worth nagging them about\u2026","memoryNag.vault.characters":"Characters","memoryNag.vault.chooseCharacter":"Choose at least one character.","memoryNag.vault.macros":"Macros","memoryNag.vault.expand":"Expand editor","memoryNag.vault.collapse":"Close expanded editor","memoryNag.vault.cancel":"Cancel","memoryNag.vault.save":"Save memory","memoryNag.toolbar.label":"Memory Nags","memoryNag.toolbar.regenerate":"Regenerate Memory Nags","memoryNag.toolbar.lock":"Enter tracker lock mode","memoryNag.toolbar.unlock":"Exit tracker lock mode","memoryNag.toolbar.emptyWord":"head empty no thoughts","memoryNag.toolbar.none":"No nags this time.","memoryNag.tracker.title":"Memory Nags","memoryNag.tracker.none":"No nags recalled for this turn.","memoryNag.settings.scanScope":"Messages to process","memoryNag.settings.scanAll":"All unprocessed messages","memoryNag.settings.scanRange":"Message range","memoryNag.settings.rangeStart":"First message","memoryNag.settings.rangeEnd":"Last message","memoryNag.settings.rangeHelp":"Count user and character messages from 1, including both ends. Earlier messages are skipped; future automatic scans continue after the furthest processed message. Existing memories are kept.","memoryNag.settings.rangeInvalid":"Choose whole message numbers from 1 to {{count}}, with the last message at or after the first."};var ua={_meta:{locale:"es",direction:"ltr"},"memoryNag.error.interface":"Memory Nag se detuvo.","memoryNag.error.retry":"Intentar de nuevo","memoryNag.error.noChat":"Abre un chat de Rol para usar Memory Nag.","memoryNag.settings.scanConnection":"Conexi\xF3n para escanear la b\xF3veda","memoryNag.settings.agentConnection":"Usar la conexi\xF3n del agente","memoryNag.settings.connectionHelp":"Solo los escaneos por lotes de la b\xF3veda usan esta conexi\xF3n. La recuperaci\xF3n por turno sigue usando la conexi\xF3n indicada en el editor del agente.","memoryNag.settings.vaultPrompt":"Prompt de recuerdos de la b\xF3veda","memoryNag.settings.vaultPromptHelp":"Edita las instrucciones para crear recuerdos. Los datos del lote, IDs de personajes, l\xEDmite y formato JSON se a\xF1aden autom\xE1ticamente.","memoryNag.settings.resetPrompt":"Restablecer prompt","memoryNag.settings.expandPrompt":"Ampliar editor del prompt","memoryNag.settings.closePrompt":"Cerrar editor del prompt","memoryNag.settings.macroReference":"Referencia de macros","memoryNag.settings.macroReferenceHelp":"Macros comunes que puedes escribir en los campos de prompt.","memoryNag.settings.closeMacros":"Cerrar referencia de macros","memoryNag.settings.messagesPerBatch":"Mensajes por lote","memoryNag.settings.messagesPerBatchHelp":"Tambi\xE9n controla la frecuencia de los escaneos autom\xE1ticos de la b\xF3veda.","memoryNag.settings.memoriesPerCharacter":"M\xE1ximo de recuerdos creados por personaje","memoryNag.settings.memoriesPerCharacterHelp":"Por lote. El modelo puede crear menos o ninguno.","memoryNag.settings.memoriesToConsider":"M\xE1ximo de recuerdos considerados por personaje","memoryNag.settings.memoriesToConsiderHelp":"En cada turno se env\xEDa al rastreador una lista determinista.","memoryNag.settings.memoriesToInject":"M\xE1ximo de recuerdos inyectados","memoryNag.settings.memoriesToInjectHelp":"El rastreador puede elegir menos o decidir que ning\xFAn recuerdo es apropiado.","memoryNag.settings.save":"Guardar ajustes","memoryNag.settings.saved":"Ajustes guardados.","memoryNag.settings.scan":"Crear recuerdos","memoryNag.settings.scanning":"Creando recuerdos\u2026","memoryNag.settings.stop":"Detener","memoryNag.settings.vault":"Abrir b\xF3veda","memoryNag.settings.progressTitle":"Creando recuerdos","memoryNag.settings.preparing":"Preparando el primer lote\u2026","memoryNag.settings.closeProgress":"Cerrar","memoryNag.settings.progress":"{{processed}} de {{total}} mensajes procesados \xB7 {{created}} a\xF1adidos \xB7 {{resolved}} resueltos","memoryNag.settings.complete":"Creaci\xF3n de recuerdos completada.","memoryNag.settings.stalled":"La creaci\xF3n de recuerdos se paus\xF3 porque el chat no avanz\xF3. Int\xE9ntalo de nuevo.","memoryNag.settings.stopped":"Creaci\xF3n de recuerdos detenida.","memoryNag.vault.title":"B\xF3veda de Memory Nag","memoryNag.vault.loading":"Cargando b\xF3veda\u2026","memoryNag.vault.expandedTitle":"Editor de recuerdos ampliado","memoryNag.vault.close":"Cerrar b\xF3veda","memoryNag.vault.active":"Activos","memoryNag.vault.resolved":"Resueltos","memoryNag.vault.allCharacters":"Todos los personajes","memoryNag.vault.pastParticipant":"anterior","memoryNag.vault.search":"Buscar recuerdos","memoryNag.vault.add":"A\xF1adir recuerdo","memoryNag.vault.empty":"No hay recuerdos que coincidan.","memoryNag.vault.edit":"Editar","memoryNag.vault.resolve":"Resolver","memoryNag.vault.restore":"Restaurar","memoryNag.vault.delete":"Eliminar","memoryNag.vault.deleteTitle":"\xBFEliminar recuerdo?","memoryNag.vault.deleteMessage":"Esto elimina permanentemente el recuerdo de la b\xF3veda de este chat.","memoryNag.vault.editorNew":"Nuevo recuerdo","memoryNag.vault.editorEdit":"Editar recuerdo","memoryNag.vault.memory":"Recuerdo","memoryNag.vault.memoryPlaceholder":"Un detalle breve que valga la pena recordarles\u2026","memoryNag.vault.characters":"Personajes","memoryNag.vault.chooseCharacter":"Elige al menos un personaje.","memoryNag.vault.macros":"Macros","memoryNag.vault.expand":"Ampliar editor","memoryNag.vault.collapse":"Cerrar editor ampliado","memoryNag.vault.cancel":"Cancelar","memoryNag.vault.save":"Guardar recuerdo","memoryNag.toolbar.label":"Recordatorios","memoryNag.toolbar.regenerate":"Regenerar recordatorios","memoryNag.toolbar.lock":"Activar el modo de bloqueo de rastreadores","memoryNag.toolbar.unlock":"Salir del modo de bloqueo de rastreadores","memoryNag.toolbar.emptyWord":"cabeza vac\xEDa, sin pensamientos","memoryNag.toolbar.none":"No hay recordatorios esta vez.","memoryNag.tracker.title":"Recordatorios","memoryNag.tracker.none":"No se recuperaron recuerdos para este turno."};var da={_meta:{locale:"fr",direction:"ltr"},"memoryNag.error.interface":"Memory Nag s\u2019est arr\xEAt\xE9.","memoryNag.error.retry":"R\xE9essayer","memoryNag.error.noChat":"Ouvrez un chat de jeu de r\xF4le pour utiliser Memory Nag.","memoryNag.settings.scanConnection":"Connexion d\u2019analyse du coffre","memoryNag.settings.agentConnection":"Utiliser la connexion de l\u2019agent","memoryNag.settings.connectionHelp":"Seules les analyses par lots du coffre utilisent cette connexion. Le rappel \xE0 chaque tour continue d\u2019utiliser la connexion d\xE9finie dans l\u2019\xE9diteur de l\u2019agent.","memoryNag.settings.vaultPrompt":"Prompt de cr\xE9ation des souvenirs","memoryNag.settings.vaultPromptHelp":"Modifiez les instructions de cr\xE9ation des souvenirs. Les donn\xE9es du lot, identifiants des personnages, limite et format JSON sont ajout\xE9s automatiquement.","memoryNag.settings.resetPrompt":"R\xE9initialiser le prompt","memoryNag.settings.expandPrompt":"Agrandir l\u2019\xE9diteur de prompt","memoryNag.settings.closePrompt":"Fermer l\u2019\xE9diteur de prompt","memoryNag.settings.macroReference":"R\xE9f\xE9rence des macros","memoryNag.settings.macroReferenceHelp":"Macros courantes que vous pouvez saisir dans les champs de prompt.","memoryNag.settings.closeMacros":"Fermer la r\xE9f\xE9rence des macros","memoryNag.settings.messagesPerBatch":"Messages par lot","memoryNag.settings.messagesPerBatchHelp":"Contr\xF4le aussi la fr\xE9quence des analyses automatiques du coffre.","memoryNag.settings.memoriesPerCharacter":"Nombre maximal de souvenirs cr\xE9\xE9s par personnage","memoryNag.settings.memoriesPerCharacterHelp":"Par lot. Le mod\xE8le peut en cr\xE9er moins ou aucun.","memoryNag.settings.memoriesToConsider":"Nombre maximal de souvenirs examin\xE9s par personnage","memoryNag.settings.memoriesToConsiderHelp":"Une liste d\xE9terministe est envoy\xE9e au suivi \xE0 chaque tour.","memoryNag.settings.memoriesToInject":"Nombre maximal de souvenirs inject\xE9s","memoryNag.settings.memoriesToInjectHelp":"Le suivi peut en choisir moins ou d\xE9cider qu\u2019aucun rappel n\u2019est appropri\xE9.","memoryNag.settings.save":"Enregistrer les param\xE8tres","memoryNag.settings.saved":"Param\xE8tres enregistr\xE9s.","memoryNag.settings.scan":"Cr\xE9er des souvenirs","memoryNag.settings.scanning":"Cr\xE9ation des souvenirs\u2026","memoryNag.settings.stop":"Arr\xEAter","memoryNag.settings.vault":"Ouvrir le coffre","memoryNag.settings.progressTitle":"Cr\xE9ation des souvenirs","memoryNag.settings.preparing":"Pr\xE9paration du premier lot\u2026","memoryNag.settings.closeProgress":"Fermer","memoryNag.settings.progress":"{{processed}} messages trait\xE9s sur {{total}} \xB7 {{created}} ajout\xE9s \xB7 {{resolved}} r\xE9solus","memoryNag.settings.complete":"Cr\xE9ation des souvenirs termin\xE9e.","memoryNag.settings.stalled":"La cr\xE9ation des souvenirs est en pause car le chat n\u2019a pas avanc\xE9. R\xE9essayez.","memoryNag.settings.stopped":"Cr\xE9ation des souvenirs arr\xEAt\xE9e.","memoryNag.vault.title":"Coffre de Memory Nag","memoryNag.vault.loading":"Chargement du coffre\u2026","memoryNag.vault.expandedTitle":"\xC9diteur de souvenir agrandi","memoryNag.vault.close":"Fermer le coffre","memoryNag.vault.active":"Actifs","memoryNag.vault.resolved":"R\xE9solus","memoryNag.vault.allCharacters":"Tous les personnages","memoryNag.vault.pastParticipant":"ancien","memoryNag.vault.search":"Rechercher des souvenirs","memoryNag.vault.add":"Ajouter un souvenir","memoryNag.vault.empty":"Aucun souvenir correspondant.","memoryNag.vault.edit":"Modifier","memoryNag.vault.resolve":"R\xE9soudre","memoryNag.vault.restore":"Restaurer","memoryNag.vault.delete":"Supprimer","memoryNag.vault.deleteTitle":"Supprimer le souvenir ?","memoryNag.vault.deleteMessage":"Cette action supprime d\xE9finitivement le souvenir du coffre de ce chat.","memoryNag.vault.editorNew":"Nouveau souvenir","memoryNag.vault.editorEdit":"Modifier le souvenir","memoryNag.vault.memory":"Souvenir","memoryNag.vault.memoryPlaceholder":"Un bref d\xE9tail qui m\xE9rite de les tourmenter\u2026","memoryNag.vault.characters":"Personnages","memoryNag.vault.chooseCharacter":"Choisissez au moins un personnage.","memoryNag.vault.macros":"Macros","memoryNag.vault.expand":"Agrandir l\u2019\xE9diteur","memoryNag.vault.collapse":"Fermer l\u2019\xE9diteur agrandi","memoryNag.vault.cancel":"Annuler","memoryNag.vault.save":"Enregistrer le souvenir","memoryNag.toolbar.label":"Rappels insistants","memoryNag.toolbar.regenerate":"R\xE9g\xE9n\xE9rer les rappels","memoryNag.toolbar.lock":"Activer le mode de verrouillage des suivis","memoryNag.toolbar.unlock":"Quitter le mode de verrouillage des suivis","memoryNag.toolbar.emptyWord":"t\xEAte vide, aucune pens\xE9e","memoryNag.toolbar.none":"Aucun rappel cette fois.","memoryNag.tracker.title":"Rappels insistants","memoryNag.tracker.none":"Aucun souvenir rappel\xE9 pour ce tour."};var na={_meta:{locale:"hi",direction:"ltr"},"memoryNag.error.interface":"Memory Nag \u0930\u0941\u0915 \u0917\u092F\u093E\u0964","memoryNag.error.retry":"\u092B\u093F\u0930 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902","memoryNag.error.noChat":"Memory Nag \u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u0930\u094B\u0932\u092A\u094D\u0932\u0947 \u091A\u0948\u091F \u0916\u094B\u0932\u0947\u0902\u0964","memoryNag.settings.scanConnection":"\u0924\u093F\u091C\u094B\u0930\u0940 \u0938\u094D\u0915\u0948\u0928 \u0915\u0928\u0947\u0915\u094D\u0936\u0928","memoryNag.settings.agentConnection":"\u090F\u091C\u0947\u0902\u091F \u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0947\u0902","memoryNag.settings.connectionHelp":"\u0915\u0947\u0935\u0932 \u0924\u093F\u091C\u094B\u0930\u0940 \u0915\u0947 \u092C\u0948\u091A \u0938\u094D\u0915\u0948\u0928 \u0907\u0938 \u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 \u0939\u0930 \u092C\u093E\u0930\u0940 \u0915\u0940 \u092F\u093E\u0926 \u0915\u0947 \u0932\u093F\u090F \u090F\u091C\u0947\u0902\u091F \u0938\u0902\u092A\u093E\u0926\u0915 \u092E\u0947\u0902 \u091A\u0941\u0928\u093E \u0917\u092F\u093E \u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0939\u0940 \u0909\u092A\u092F\u094B\u0917 \u0939\u094B\u0924\u093E \u0939\u0948\u0964","memoryNag.settings.vaultPrompt":"\u0924\u093F\u091C\u094B\u0930\u0940 \u092F\u093E\u0926\u094B\u0902 \u0915\u093E \u092A\u094D\u0930\u0949\u092E\u094D\u092A\u094D\u091F","memoryNag.settings.vaultPromptHelp":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0928\u0947 \u0915\u0947 \u0928\u093F\u0930\u094D\u0926\u0947\u0936 \u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902\u0964 \u092C\u0948\u091A \u0921\u0947\u091F\u093E, \u092A\u093E\u0924\u094D\u0930 ID, \u0938\u0940\u092E\u093E \u0914\u0930 JSON \u092A\u094D\u0930\u093E\u0930\u0942\u092A \u0905\u092A\u0928\u0947 \u0906\u092A \u091C\u094B\u0921\u093C\u0947 \u091C\u093E\u0924\u0947 \u0939\u0948\u0902\u0964","memoryNag.settings.resetPrompt":"\u092A\u094D\u0930\u0949\u092E\u094D\u092A\u094D\u091F \u0930\u0940\u0938\u0947\u091F \u0915\u0930\u0947\u0902","memoryNag.settings.expandPrompt":"\u092A\u094D\u0930\u0949\u092E\u094D\u092A\u094D\u091F \u0938\u0902\u092A\u093E\u0926\u0915 \u092C\u0921\u093C\u093E \u0915\u0930\u0947\u0902","memoryNag.settings.closePrompt":"\u092A\u094D\u0930\u0949\u092E\u094D\u092A\u094D\u091F \u0938\u0902\u092A\u093E\u0926\u0915 \u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.settings.macroReference":"\u092E\u0948\u0915\u094D\u0930\u094B \u0938\u0902\u0926\u0930\u094D\u092D","memoryNag.settings.macroReferenceHelp":"\u092A\u094D\u0930\u0949\u092E\u094D\u092A\u094D\u091F \u092B\u093C\u0940\u0932\u094D\u0921 \u092E\u0947\u0902 \u0932\u093F\u0916\u0947 \u091C\u093E \u0938\u0915\u0928\u0947 \u0935\u093E\u0932\u0947 \u0938\u093E\u092E\u093E\u0928\u094D\u092F \u092E\u0948\u0915\u094D\u0930\u094B\u0964","memoryNag.settings.closeMacros":"\u092E\u0948\u0915\u094D\u0930\u094B \u0938\u0902\u0926\u0930\u094D\u092D \u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.settings.messagesPerBatch":"\u0939\u0930 \u092C\u0948\u091A \u092E\u0947\u0902 \u0938\u0902\u0926\u0947\u0936","memoryNag.settings.messagesPerBatchHelp":"\u092F\u0939 \u0938\u094D\u0935\u091A\u093E\u0932\u093F\u0924 \u0924\u093F\u091C\u094B\u0930\u0940 \u0938\u094D\u0915\u0948\u0928 \u0915\u0940 \u0906\u0935\u0943\u0924\u094D\u0924\u093F \u092D\u0940 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0924\u093E \u0939\u0948\u0964","memoryNag.settings.memoriesPerCharacter":"\u0939\u0930 \u092A\u093E\u0924\u094D\u0930 \u0915\u0947 \u0932\u093F\u090F \u092C\u0928\u093E\u0908 \u091C\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u0905\u0927\u093F\u0915\u0924\u092E \u092F\u093E\u0926\u0947\u0902","memoryNag.settings.memoriesPerCharacterHelp":"\u0939\u0930 \u092C\u0948\u091A \u092E\u0947\u0902\u0964 \u092E\u0949\u0921\u0932 \u0915\u092E \u092F\u093E \u0915\u094B\u0908 \u092F\u093E\u0926 \u0928\u0939\u0940\u0902 \u092C\u0928\u093E \u0938\u0915\u0924\u093E \u0939\u0948\u0964","memoryNag.settings.memoriesToConsider":"\u0939\u0930 \u092A\u093E\u0924\u094D\u0930 \u0915\u0947 \u0932\u093F\u090F \u0935\u093F\u091A\u093E\u0930 \u0915\u0940 \u091C\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u0905\u0927\u093F\u0915\u0924\u092E \u092F\u093E\u0926\u0947\u0902","memoryNag.settings.memoriesToConsiderHelp":"\u0939\u0930 \u092C\u093E\u0930\u0940 \u092E\u0947\u0902 \u091F\u094D\u0930\u0948\u0915\u0930 \u0915\u094B \u0928\u093F\u092F\u092E\u092C\u0926\u094D\u0927 \u0922\u0902\u0917 \u0938\u0947 \u091A\u0941\u0928\u0940 \u0917\u0908 \u0938\u0902\u0915\u094D\u0937\u093F\u092A\u094D\u0924 \u0938\u0942\u091A\u0940 \u092D\u0947\u091C\u0940 \u091C\u093E\u0924\u0940 \u0939\u0948\u0964","memoryNag.settings.memoriesToInject":"\u091C\u094B\u0921\u093C\u0940 \u091C\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u0905\u0927\u093F\u0915\u0924\u092E \u092F\u093E\u0926\u0947\u0902","memoryNag.settings.memoriesToInjectHelp":"\u091F\u094D\u0930\u0948\u0915\u0930 \u0915\u092E \u092F\u093E\u0926\u0947\u0902 \u091A\u0941\u0928 \u0938\u0915\u0924\u093E \u0939\u0948 \u092F\u093E \u0924\u092F \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0948 \u0915\u093F \u0915\u094B\u0908 \u092F\u093E\u0926 \u0909\u091A\u093F\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964","memoryNag.settings.save":"\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938 \u0938\u0939\u0947\u091C\u0947\u0902","memoryNag.settings.saved":"\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938 \u0938\u0939\u0947\u091C\u0940 \u0917\u0908\u0902\u0964","memoryNag.settings.scan":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u090F\u0901","memoryNag.settings.scanning":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0908 \u091C\u093E \u0930\u0939\u0940 \u0939\u0948\u0902\u2026","memoryNag.settings.stop":"\u0930\u094B\u0915\u0947\u0902","memoryNag.settings.vault":"\u0924\u093F\u091C\u094B\u0930\u0940 \u0916\u094B\u0932\u0947\u0902","memoryNag.settings.progressTitle":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0908 \u091C\u093E \u0930\u0939\u0940 \u0939\u0948\u0902","memoryNag.settings.preparing":"\u092A\u0939\u0932\u093E \u092C\u0948\u091A \u0924\u0948\u092F\u093E\u0930 \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u2026","memoryNag.settings.closeProgress":"\u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.settings.progress":"{{total}} \u092E\u0947\u0902 \u0938\u0947 {{processed}} \u0938\u0902\u0926\u0947\u0936 \u0938\u0902\u0938\u093E\u0927\u093F\u0924 \u0939\u0941\u090F \xB7 {{created}} \u091C\u094B\u0921\u093C\u0947 \u0917\u090F \xB7 {{resolved}} \u0938\u0941\u0932\u091D\u0947","memoryNag.settings.complete":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0928\u093E \u092A\u0942\u0930\u093E \u0939\u0941\u0906\u0964","memoryNag.settings.stalled":"\u091A\u0948\u091F \u0906\u0917\u0947 \u0928 \u092C\u0922\u093C\u0928\u0947 \u0915\u0947 \u0915\u093E\u0930\u0923 \u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0928\u093E \u0930\u0941\u0915\u093E \u0939\u0941\u0906 \u0939\u0948\u0964 \u092B\u093F\u0930 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964","memoryNag.settings.stopped":"\u092F\u093E\u0926\u0947\u0902 \u092C\u0928\u093E\u0928\u093E \u0930\u094B\u0915 \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964","memoryNag.vault.title":"Memory Nag \u0924\u093F\u091C\u094B\u0930\u0940","memoryNag.vault.loading":"\u0924\u093F\u091C\u094B\u0930\u0940 \u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u0940 \u0939\u0948\u2026","memoryNag.vault.expandedTitle":"\u0935\u093F\u0938\u094D\u0924\u0943\u0924 \u092F\u093E\u0926 \u0938\u0902\u092A\u093E\u0926\u0915","memoryNag.vault.close":"\u0924\u093F\u091C\u094B\u0930\u0940 \u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.vault.active":"\u0938\u0915\u094D\u0930\u093F\u092F","memoryNag.vault.resolved":"\u0938\u0941\u0932\u091D\u0940 \u0939\u0941\u0908","memoryNag.vault.allCharacters":"\u0938\u092D\u0940 \u092A\u093E\u0924\u094D\u0930","memoryNag.vault.pastParticipant":"\u092A\u0942\u0930\u094D\u0935","memoryNag.vault.search":"\u092F\u093E\u0926\u0947\u0902 \u0916\u094B\u091C\u0947\u0902","memoryNag.vault.add":"\u092F\u093E\u0926 \u091C\u094B\u0921\u093C\u0947\u0902","memoryNag.vault.empty":"\u0915\u094B\u0908 \u092E\u093F\u0932\u0924\u0940 \u0939\u0941\u0908 \u092F\u093E\u0926 \u0928\u0939\u0940\u0902\u0964","memoryNag.vault.edit":"\u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902","memoryNag.vault.resolve":"\u0938\u0941\u0932\u091D\u093E\u090F\u0901","memoryNag.vault.restore":"\u092C\u0939\u093E\u0932 \u0915\u0930\u0947\u0902","memoryNag.vault.delete":"\u0939\u091F\u093E\u090F\u0901","memoryNag.vault.deleteTitle":"\u092F\u093E\u0926 \u0939\u091F\u093E\u090F\u0901?","memoryNag.vault.deleteMessage":"\u092F\u0939 \u0907\u0938 \u091A\u0948\u091F \u0915\u0940 \u0924\u093F\u091C\u094B\u0930\u0940 \u0938\u0947 \u092F\u093E\u0926 \u0915\u094B \u0938\u094D\u0925\u093E\u092F\u0940 \u0930\u0942\u092A \u0938\u0947 \u0939\u091F\u093E \u0926\u0947\u0917\u093E\u0964","memoryNag.vault.editorNew":"\u0928\u0908 \u092F\u093E\u0926","memoryNag.vault.editorEdit":"\u092F\u093E\u0926 \u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902","memoryNag.vault.memory":"\u092F\u093E\u0926","memoryNag.vault.memoryPlaceholder":"\u090F\u0915 \u091B\u094B\u091F\u093E \u0935\u093F\u0935\u0930\u0923 \u091C\u093F\u0938\u0915\u0940 \u092F\u093E\u0926 \u0926\u093F\u0932\u093E\u0928\u093E \u0909\u091A\u093F\u0924 \u0939\u094B\u2026","memoryNag.vault.characters":"\u092A\u093E\u0924\u094D\u0930","memoryNag.vault.chooseCharacter":"\u0915\u092E \u0938\u0947 \u0915\u092E \u090F\u0915 \u092A\u093E\u0924\u094D\u0930 \u091A\u0941\u0928\u0947\u0902\u0964","memoryNag.vault.macros":"\u092E\u0948\u0915\u094D\u0930\u094B","memoryNag.vault.expand":"\u0938\u0902\u092A\u093E\u0926\u0915 \u092B\u0948\u0932\u093E\u090F\u0901","memoryNag.vault.collapse":"\u0935\u093F\u0938\u094D\u0924\u0943\u0924 \u0938\u0902\u092A\u093E\u0926\u0915 \u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.vault.cancel":"\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902","memoryNag.vault.save":"\u092F\u093E\u0926 \u0938\u0939\u0947\u091C\u0947\u0902","memoryNag.toolbar.label":"\u092F\u093E\u0926 \u0926\u093F\u0932\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u092C\u093E\u0924\u0947\u0902","memoryNag.toolbar.regenerate":"\u092F\u093E\u0926 \u0926\u093F\u0932\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u092C\u093E\u0924\u0947\u0902 \u092B\u093F\u0930 \u092C\u0928\u093E\u090F\u0901","memoryNag.toolbar.lock":"\u091F\u094D\u0930\u0948\u0915\u0930 \u0932\u0949\u0915 \u092E\u094B\u0921 \u091A\u093E\u0932\u0942 \u0915\u0930\u0947\u0902","memoryNag.toolbar.unlock":"\u091F\u094D\u0930\u0948\u0915\u0930 \u0932\u0949\u0915 \u092E\u094B\u0921 \u092C\u0902\u0926 \u0915\u0930\u0947\u0902","memoryNag.toolbar.emptyWord":"\u0926\u093F\u092E\u093E\u0917 \u0916\u093E\u0932\u0940, \u0915\u094B\u0908 \u0935\u093F\u091A\u093E\u0930 \u0928\u0939\u0940\u0902","memoryNag.toolbar.none":"\u0907\u0938 \u092C\u093E\u0930 \u0915\u094B\u0908 \u092F\u093E\u0926 \u0928\u0939\u0940\u0902\u0964","memoryNag.tracker.title":"\u092F\u093E\u0926 \u0926\u093F\u0932\u093E\u0928\u0947 \u0935\u093E\u0932\u0940 \u092C\u093E\u0924\u0947\u0902","memoryNag.tracker.none":"\u0907\u0938 \u092C\u093E\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u092F\u093E\u0926 \u0928\u0939\u0940\u0902 \u0932\u093E\u0908 \u0917\u0908\u0964"};var ia={_meta:{locale:"ja",direction:"ltr"},"memoryNag.error.interface":"Memory Nag \u304C\u505C\u6B62\u3057\u307E\u3057\u305F\u3002","memoryNag.error.retry":"\u518D\u8A66\u884C","memoryNag.error.noChat":"Memory Nag \u3092\u4F7F\u7528\u3059\u308B\u306B\u306F\u30ED\u30FC\u30EB\u30D7\u30EC\u30A4\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002","memoryNag.settings.scanConnection":"\u8A18\u61B6\u5EAB\u30B9\u30AD\u30E3\u30F3\u306E\u63A5\u7D9A","memoryNag.settings.agentConnection":"\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u63A5\u7D9A\u3092\u4F7F\u7528","memoryNag.settings.connectionHelp":"\u3053\u306E\u63A5\u7D9A\u306F\u8A18\u61B6\u5EAB\u306E\u30D0\u30C3\u30C1\u30B9\u30AD\u30E3\u30F3\u3060\u3051\u306B\u4F7F\u308F\u308C\u307E\u3059\u3002\u30BF\u30FC\u30F3\u3054\u3068\u306E\u547C\u3073\u51FA\u3057\u306B\u306F\u5F15\u304D\u7D9A\u304D\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u30A8\u30C7\u30A3\u30BF\u30FC\u3067\u6307\u5B9A\u3057\u305F\u63A5\u7D9A\u304C\u4F7F\u308F\u308C\u307E\u3059\u3002","memoryNag.settings.vaultPrompt":"\u8A18\u61B6\u4F5C\u6210\u30D7\u30ED\u30F3\u30D7\u30C8","memoryNag.settings.vaultPromptHelp":"\u8A18\u61B6\u3092\u4F5C\u6210\u3059\u308B\u6307\u793A\u3092\u7DE8\u96C6\u3057\u307E\u3059\u3002\u30D0\u30C3\u30C1\u30C7\u30FC\u30BF\u3001\u30AD\u30E3\u30E9\u30AF\u30BF\u30FCID\u3001\u4E0A\u9650\u3001JSON\u5F62\u5F0F\u306F\u81EA\u52D5\u3067\u8FFD\u52A0\u3055\u308C\u307E\u3059\u3002","memoryNag.settings.resetPrompt":"\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u30EA\u30BB\u30C3\u30C8","memoryNag.settings.expandPrompt":"\u30D7\u30ED\u30F3\u30D7\u30C8\u30A8\u30C7\u30A3\u30BF\u30FC\u3092\u62E1\u5927","memoryNag.settings.closePrompt":"\u30D7\u30ED\u30F3\u30D7\u30C8\u30A8\u30C7\u30A3\u30BF\u30FC\u3092\u9589\u3058\u308B","memoryNag.settings.macroReference":"\u30DE\u30AF\u30ED\u30EA\u30D5\u30A1\u30EC\u30F3\u30B9","memoryNag.settings.macroReferenceHelp":"\u30D7\u30ED\u30F3\u30D7\u30C8\u6B04\u3067\u4F7F\u7528\u3067\u304D\u308B\u4E00\u822C\u7684\u306A\u30DE\u30AF\u30ED\u3067\u3059\u3002","memoryNag.settings.closeMacros":"\u30DE\u30AF\u30ED\u30EA\u30D5\u30A1\u30EC\u30F3\u30B9\u3092\u9589\u3058\u308B","memoryNag.settings.messagesPerBatch":"\u30D0\u30C3\u30C1\u3042\u305F\u308A\u306E\u30E1\u30C3\u30BB\u30FC\u30B8\u6570","memoryNag.settings.messagesPerBatchHelp":"\u8A18\u61B6\u5EAB\u306E\u81EA\u52D5\u30B9\u30AD\u30E3\u30F3\u983B\u5EA6\u3082\u5236\u5FA1\u3057\u307E\u3059\u3002","memoryNag.settings.memoriesPerCharacter":"\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3054\u3068\u306E\u6700\u5927\u4F5C\u6210\u8A18\u61B6\u6570","memoryNag.settings.memoriesPerCharacterHelp":"\u30D0\u30C3\u30C1\u3054\u3068\u306E\u4E0A\u9650\u3067\u3059\u3002\u30E2\u30C7\u30EB\u304C\u4F5C\u6210\u3059\u308B\u6570\u306F\u5C11\u306A\u3044\u5834\u5408\u3084\u30BC\u30ED\u306E\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002","memoryNag.settings.memoriesToConsider":"\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3054\u3068\u306E\u6700\u5927\u691C\u8A0E\u8A18\u61B6\u6570","memoryNag.settings.memoriesToConsiderHelp":"\u5404\u30BF\u30FC\u30F3\u306B\u3001\u6C7A\u5B9A\u7684\u306B\u9078\u3070\u308C\u305F\u5019\u88DC\u30EA\u30B9\u30C8\u304C\u30C8\u30E9\u30C3\u30AB\u30FC\u3078\u9001\u4FE1\u3055\u308C\u307E\u3059\u3002","memoryNag.settings.memoriesToInject":"\u633F\u5165\u3059\u308B\u6700\u5927\u8A18\u61B6\u6570","memoryNag.settings.memoriesToInjectHelp":"\u30C8\u30E9\u30C3\u30AB\u30FC\u306F\u6570\u3092\u6E1B\u3089\u3057\u305F\u308A\u3001\u9069\u5207\u306A\u8A18\u61B6\u304C\u306A\u3044\u3068\u5224\u65AD\u3057\u305F\u308A\u3067\u304D\u307E\u3059\u3002","memoryNag.settings.save":"\u8A2D\u5B9A\u3092\u4FDD\u5B58","memoryNag.settings.saved":"\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002","memoryNag.settings.scan":"\u8A18\u61B6\u3092\u4F5C\u6210","memoryNag.settings.scanning":"\u8A18\u61B6\u3092\u4F5C\u6210\u4E2D\u2026","memoryNag.settings.stop":"\u505C\u6B62","memoryNag.settings.vault":"\u8A18\u61B6\u5EAB\u3092\u958B\u304F","memoryNag.settings.progressTitle":"\u8A18\u61B6\u3092\u4F5C\u6210\u4E2D","memoryNag.settings.preparing":"\u6700\u521D\u306E\u30D0\u30C3\u30C1\u3092\u6E96\u5099\u4E2D\u2026","memoryNag.settings.closeProgress":"\u9589\u3058\u308B","memoryNag.settings.progress":"{{total}}\u4EF6\u4E2D{{processed}}\u4EF6\u306E\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u51E6\u7406 \xB7 {{created}}\u4EF6\u8FFD\u52A0 \xB7 {{resolved}}\u4EF6\u89E3\u6C7A","memoryNag.settings.complete":"\u8A18\u61B6\u306E\u4F5C\u6210\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002","memoryNag.settings.stalled":"\u30C1\u30E3\u30C3\u30C8\u304C\u9032\u307E\u306A\u304B\u3063\u305F\u305F\u3081\u3001\u8A18\u61B6\u306E\u4F5C\u6210\u3092\u4E00\u6642\u505C\u6B62\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002","memoryNag.settings.stopped":"\u8A18\u61B6\u306E\u4F5C\u6210\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002","memoryNag.vault.title":"Memory Nag \u8A18\u61B6\u5EAB","memoryNag.vault.loading":"\u8A18\u61B6\u5EAB\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026","memoryNag.vault.expandedTitle":"\u62E1\u5927\u3057\u305F\u8A18\u61B6\u30A8\u30C7\u30A3\u30BF\u30FC","memoryNag.vault.close":"\u8A18\u61B6\u5EAB\u3092\u9589\u3058\u308B","memoryNag.vault.active":"\u6709\u52B9","memoryNag.vault.resolved":"\u89E3\u6C7A\u6E08\u307F","memoryNag.vault.allCharacters":"\u3059\u3079\u3066\u306E\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC","memoryNag.vault.pastParticipant":"\u904E\u53BB","memoryNag.vault.search":"\u8A18\u61B6\u3092\u691C\u7D22","memoryNag.vault.add":"\u8A18\u61B6\u3092\u8FFD\u52A0","memoryNag.vault.empty":"\u4E00\u81F4\u3059\u308B\u8A18\u61B6\u306F\u3042\u308A\u307E\u305B\u3093\u3002","memoryNag.vault.edit":"\u7DE8\u96C6","memoryNag.vault.resolve":"\u89E3\u6C7A\u6E08\u307F\u306B\u3059\u308B","memoryNag.vault.restore":"\u5FA9\u5143","memoryNag.vault.delete":"\u524A\u9664","memoryNag.vault.deleteTitle":"\u8A18\u61B6\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F","memoryNag.vault.deleteMessage":"\u3053\u306E\u30C1\u30E3\u30C3\u30C8\u306E\u8A18\u61B6\u5EAB\u304B\u3089\u3001\u3053\u306E\u8A18\u61B6\u3092\u5B8C\u5168\u306B\u524A\u9664\u3057\u307E\u3059\u3002","memoryNag.vault.editorNew":"\u65B0\u3057\u3044\u8A18\u61B6","memoryNag.vault.editorEdit":"\u8A18\u61B6\u3092\u7DE8\u96C6","memoryNag.vault.memory":"\u8A18\u61B6","memoryNag.vault.memoryPlaceholder":"\u3057\u3064\u3053\u304F\u601D\u3044\u51FA\u3055\u305B\u308B\u4FA1\u5024\u306E\u3042\u308B\u77ED\u3044\u51FA\u6765\u4E8B\u2026","memoryNag.vault.characters":"\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC","memoryNag.vault.chooseCharacter":"\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u30921\u4EBA\u4EE5\u4E0A\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002","memoryNag.vault.macros":"\u30DE\u30AF\u30ED","memoryNag.vault.expand":"\u30A8\u30C7\u30A3\u30BF\u30FC\u3092\u62E1\u5927","memoryNag.vault.collapse":"\u62E1\u5927\u3057\u305F\u30A8\u30C7\u30A3\u30BF\u30FC\u3092\u9589\u3058\u308B","memoryNag.vault.cancel":"\u30AD\u30E3\u30F3\u30BB\u30EB","memoryNag.vault.save":"\u8A18\u61B6\u3092\u4FDD\u5B58","memoryNag.toolbar.label":"\u8A18\u61B6\u306E\u3055\u3055\u3084\u304D","memoryNag.toolbar.regenerate":"\u8A18\u61B6\u306E\u3055\u3055\u3084\u304D\u3092\u518D\u751F\u6210","memoryNag.toolbar.lock":"\u30C8\u30E9\u30C3\u30AB\u30FC\u30ED\u30C3\u30AF\u30E2\u30FC\u30C9\u3092\u6709\u52B9\u5316","memoryNag.toolbar.unlock":"\u30C8\u30E9\u30C3\u30AB\u30FC\u30ED\u30C3\u30AF\u30E2\u30FC\u30C9\u3092\u7D42\u4E86","memoryNag.toolbar.emptyWord":"\u982D\u306F\u7A7A\u3063\u307D\u3001\u8003\u3048\u306A\u3057","memoryNag.toolbar.none":"\u4ECA\u56DE\u306F\u601D\u3044\u51FA\u3059\u3053\u3068\u306F\u3042\u308A\u307E\u305B\u3093\u3002","memoryNag.tracker.title":"\u8A18\u61B6\u306E\u3055\u3055\u3084\u304D","memoryNag.tracker.none":"\u3053\u306E\u30BF\u30FC\u30F3\u306B\u547C\u3073\u51FA\u3055\u308C\u305F\u8A18\u61B6\u306F\u3042\u308A\u307E\u305B\u3093\u3002"};var fa={_meta:{locale:"ko",direction:"ltr"},"memoryNag.error.interface":"Memory Nag\uAC00 \uC911\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.","memoryNag.error.retry":"\uB2E4\uC2DC \uC2DC\uB3C4","memoryNag.error.noChat":"Memory Nag\uB97C \uC0AC\uC6A9\uD558\uB824\uBA74 \uB864\uD50C\uB808\uC774 \uCC44\uD305\uC744 \uC5EC\uC138\uC694.","memoryNag.settings.scanConnection":"\uBCF4\uAD00\uD568 \uC2A4\uCE94 \uC5F0\uACB0","memoryNag.settings.agentConnection":"\uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uC0AC\uC6A9","memoryNag.settings.connectionHelp":"\uBCF4\uAD00\uD568 \uC77C\uAD04 \uC2A4\uCE94\uB9CC \uC774 \uC5F0\uACB0\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uD134\uBCC4 \uD68C\uC0C1\uC5D0\uB294 \uACC4\uC18D \uC5D0\uC774\uC804\uD2B8 \uD3B8\uC9D1\uAE30\uC5D0\uC11C \uC9C0\uC815\uD55C \uC5F0\uACB0\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.","memoryNag.settings.vaultPrompt":"\uBCF4\uAD00\uD568 \uAE30\uC5B5 \uD504\uB86C\uD504\uD2B8","memoryNag.settings.vaultPromptHelp":"\uAE30\uC5B5 \uC0DD\uC131 \uC9C0\uCE68\uC744 \uD3B8\uC9D1\uD569\uB2C8\uB2E4. \uBC30\uCE58 \uB370\uC774\uD130, \uCE90\uB9AD\uD130 ID, \uD55C\uB3C4, JSON \uD615\uC2DD\uC740 \uC790\uB3D9\uC73C\uB85C \uCD94\uAC00\uB429\uB2C8\uB2E4.","memoryNag.settings.resetPrompt":"\uD504\uB86C\uD504\uD2B8 \uCD08\uAE30\uD654","memoryNag.settings.expandPrompt":"\uD504\uB86C\uD504\uD2B8 \uD3B8\uC9D1\uAE30 \uD655\uC7A5","memoryNag.settings.closePrompt":"\uD504\uB86C\uD504\uD2B8 \uD3B8\uC9D1\uAE30 \uB2EB\uAE30","memoryNag.settings.macroReference":"\uB9E4\uD06C\uB85C \uCC38\uC870","memoryNag.settings.macroReferenceHelp":"\uD504\uB86C\uD504\uD2B8 \uD544\uB4DC\uC5D0 \uC785\uB825\uD560 \uC218 \uC788\uB294 \uC77C\uBC18\uC801\uC778 \uB9E4\uD06C\uB85C\uC785\uB2C8\uB2E4.","memoryNag.settings.closeMacros":"\uB9E4\uD06C\uB85C \uCC38\uC870 \uB2EB\uAE30","memoryNag.settings.messagesPerBatch":"\uBC30\uCE58\uB2F9 \uBA54\uC2DC\uC9C0 \uC218","memoryNag.settings.messagesPerBatchHelp":"\uC790\uB3D9 \uBCF4\uAD00\uD568 \uC2A4\uCE94 \uC8FC\uAE30\uB3C4 \uC81C\uC5B4\uD569\uB2C8\uB2E4.","memoryNag.settings.memoriesPerCharacter":"\uCE90\uB9AD\uD130\uB2F9 \uC0DD\uC131\uD560 \uCD5C\uB300 \uAE30\uC5B5 \uC218","memoryNag.settings.memoriesPerCharacterHelp":"\uBC30\uCE58\uB2F9 \uD55C\uB3C4\uC785\uB2C8\uB2E4. \uBAA8\uB378\uC774 \uB354 \uC801\uAC8C \uB9CC\uB4E4\uAC70\uB098 \uB9CC\uB4E4\uC9C0 \uC54A\uC744 \uC218\uB3C4 \uC788\uC2B5\uB2C8\uB2E4.","memoryNag.settings.memoriesToConsider":"\uCE90\uB9AD\uD130\uB2F9 \uAC80\uD1A0\uD560 \uCD5C\uB300 \uAE30\uC5B5 \uC218","memoryNag.settings.memoriesToConsiderHelp":"\uB9E4 \uD134 \uADDC\uCE59\uC5D0 \uB530\uB77C \uCD94\uB9B0 \uBAA9\uB85D\uC744 \uD2B8\uB798\uCEE4\uB85C \uBCF4\uB0C5\uB2C8\uB2E4.","memoryNag.settings.memoriesToInject":"\uC0BD\uC785\uD560 \uCD5C\uB300 \uAE30\uC5B5 \uC218","memoryNag.settings.memoriesToInjectHelp":"\uD2B8\uB798\uCEE4\uAC00 \uB354 \uC801\uAC8C \uACE0\uB974\uAC70\uB098 \uC801\uC808\uD55C \uAE30\uC5B5\uC774 \uC5C6\uB2E4\uACE0 \uD310\uB2E8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.","memoryNag.settings.save":"\uC124\uC815 \uC800\uC7A5","memoryNag.settings.saved":"\uC124\uC815\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.","memoryNag.settings.scan":"\uAE30\uC5B5 \uB9CC\uB4E4\uAE30","memoryNag.settings.scanning":"\uAE30\uC5B5 \uB9CC\uB4DC\uB294 \uC911\u2026","memoryNag.settings.stop":"\uC911\uC9C0","memoryNag.settings.vault":"\uBCF4\uAD00\uD568 \uC5F4\uAE30","memoryNag.settings.progressTitle":"\uAE30\uC5B5 \uB9CC\uB4DC\uB294 \uC911","memoryNag.settings.preparing":"\uCCAB \uBC88\uC9F8 \uBC30\uCE58 \uC900\uBE44 \uC911\u2026","memoryNag.settings.closeProgress":"\uB2EB\uAE30","memoryNag.settings.progress":"\uBA54\uC2DC\uC9C0 {{total}}\uAC1C \uC911 {{processed}}\uAC1C \uCC98\uB9AC \xB7 {{created}}\uAC1C \uCD94\uAC00 \xB7 {{resolved}}\uAC1C \uD574\uACB0","memoryNag.settings.complete":"\uAE30\uC5B5 \uB9CC\uB4E4\uAE30\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.","memoryNag.settings.stalled":"\uCC44\uD305\uC774 \uC9C4\uD589\uB418\uC9C0 \uC54A\uC544 \uAE30\uC5B5 \uB9CC\uB4E4\uAE30\uB97C \uC77C\uC2DC \uC911\uC9C0\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.","memoryNag.settings.stopped":"\uAE30\uC5B5 \uB9CC\uB4E4\uAE30\uB97C \uC911\uC9C0\uD588\uC2B5\uB2C8\uB2E4.","memoryNag.vault.title":"Memory Nag \uBCF4\uAD00\uD568","memoryNag.vault.loading":"\uBCF4\uAD00\uD568 \uBD88\uB7EC\uC624\uB294 \uC911\u2026","memoryNag.vault.expandedTitle":"\uD655\uC7A5\uB41C \uAE30\uC5B5 \uD3B8\uC9D1\uAE30","memoryNag.vault.close":"\uBCF4\uAD00\uD568 \uB2EB\uAE30","memoryNag.vault.active":"\uD65C\uC131","memoryNag.vault.resolved":"\uD574\uACB0\uB428","memoryNag.vault.allCharacters":"\uBAA8\uB4E0 \uCE90\uB9AD\uD130","memoryNag.vault.pastParticipant":"\uACFC\uAC70","memoryNag.vault.search":"\uAE30\uC5B5 \uAC80\uC0C9","memoryNag.vault.add":"\uAE30\uC5B5 \uCD94\uAC00","memoryNag.vault.empty":"\uC77C\uCE58\uD558\uB294 \uAE30\uC5B5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.","memoryNag.vault.edit":"\uD3B8\uC9D1","memoryNag.vault.resolve":"\uD574\uACB0","memoryNag.vault.restore":"\uBCF5\uC6D0","memoryNag.vault.delete":"\uC0AD\uC81C","memoryNag.vault.deleteTitle":"\uAE30\uC5B5\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?","memoryNag.vault.deleteMessage":"\uC774 \uCC44\uD305\uC758 \uBCF4\uAD00\uD568\uC5D0\uC11C \uAE30\uC5B5\uC744 \uC601\uAD6C\uC801\uC73C\uB85C \uC0AD\uC81C\uD569\uB2C8\uB2E4.","memoryNag.vault.editorNew":"\uC0C8 \uAE30\uC5B5","memoryNag.vault.editorEdit":"\uAE30\uC5B5 \uD3B8\uC9D1","memoryNag.vault.memory":"\uAE30\uC5B5","memoryNag.vault.memoryPlaceholder":"\uACC4\uC18D \uC0C1\uAE30\uC2DC\uD0AC \uB9CC\uD55C \uC9E7\uC740 \uB0B4\uC6A9\u2026","memoryNag.vault.characters":"\uCE90\uB9AD\uD130","memoryNag.vault.chooseCharacter":"\uCE90\uB9AD\uD130\uB97C \uD55C \uBA85 \uC774\uC0C1 \uC120\uD0DD\uD558\uC138\uC694.","memoryNag.vault.macros":"\uB9E4\uD06C\uB85C","memoryNag.vault.expand":"\uD3B8\uC9D1\uAE30 \uD655\uC7A5","memoryNag.vault.collapse":"\uD655\uC7A5\uB41C \uD3B8\uC9D1\uAE30 \uB2EB\uAE30","memoryNag.vault.cancel":"\uCDE8\uC18C","memoryNag.vault.save":"\uAE30\uC5B5 \uC800\uC7A5","memoryNag.toolbar.label":"\uAE30\uC5B5 \uC794\uC18C\uB9AC","memoryNag.toolbar.regenerate":"\uAE30\uC5B5 \uC794\uC18C\uB9AC \uB2E4\uC2DC \uC0DD\uC131","memoryNag.toolbar.lock":"\uD2B8\uB798\uCEE4 \uC7A0\uAE08 \uBAA8\uB4DC \uCF1C\uAE30","memoryNag.toolbar.unlock":"\uD2B8\uB798\uCEE4 \uC7A0\uAE08 \uBAA8\uB4DC \uC885\uB8CC","memoryNag.toolbar.emptyWord":"\uBA38\uB9BF\uC18D \uD145 \uBE54, \uC544\uBB34 \uC0DD\uAC01 \uC5C6\uC74C","memoryNag.toolbar.none":"\uC774\uBC88\uC5D0\uB294 \uC794\uC18C\uB9AC\uD560 \uAE30\uC5B5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.","memoryNag.tracker.title":"\uAE30\uC5B5 \uC794\uC18C\uB9AC","memoryNag.tracker.none":"\uC774\uBC88 \uD134\uC5D0 \uB5A0\uC62C\uB9B0 \uAE30\uC5B5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."};var ca={_meta:{locale:"pl",direction:"ltr"},"memoryNag.error.interface":"Memory Nag zosta\u0142 zatrzymany.","memoryNag.error.retry":"Spr\xF3buj ponownie","memoryNag.error.noChat":"Otw\xF3rz czat Roleplay, aby u\u017Cy\u0107 Memory Nag.","memoryNag.settings.scanConnection":"Po\u0142\u0105czenie do skanowania skarbca","memoryNag.settings.agentConnection":"U\u017Cyj po\u0142\u0105czenia agenta","memoryNag.settings.connectionHelp":"Tylko wsadowe skany skarbca u\u017Cywaj\u0105 tego po\u0142\u0105czenia. Przywo\u0142ywanie w ka\u017Cdej turze nadal korzysta z po\u0142\u0105czenia okre\u015Blonego w edytorze agenta.","memoryNag.settings.vaultPrompt":"Prompt tworzenia wspomnie\u0144","memoryNag.settings.vaultPromptHelp":"Edytuj instrukcje u\u017Cywane do tworzenia wspomnie\u0144. Dane partii, identyfikatory postaci, limit i format JSON s\u0105 dodawane automatycznie.","memoryNag.settings.resetPrompt":"Przywr\xF3\u0107 prompt","memoryNag.settings.expandPrompt":"Rozwi\u0144 edytor promptu","memoryNag.settings.closePrompt":"Zamknij edytor promptu","memoryNag.settings.macroReference":"Lista makr","memoryNag.settings.macroReferenceHelp":"Popularne makra, kt\xF3rych mo\u017Cna u\u017Cywa\u0107 w polach promptu.","memoryNag.settings.closeMacros":"Zamknij list\u0119 makr","memoryNag.settings.messagesPerBatch":"Wiadomo\u015Bci na parti\u0119","memoryNag.settings.messagesPerBatchHelp":"Okre\u015Bla te\u017C cz\u0119stotliwo\u015B\u0107 automatycznego skanowania skarbca.","memoryNag.settings.memoriesPerCharacter":"Maksymalna liczba wspomnie\u0144 tworzonych dla postaci","memoryNag.settings.memoriesPerCharacterHelp":"Na parti\u0119. Model mo\u017Ce utworzy\u0107 mniej wspomnie\u0144 lub nie utworzy\u0107 \u017Cadnego.","memoryNag.settings.memoriesToConsider":"Maksymalna liczba rozwa\u017Canych wspomnie\u0144 dla postaci","memoryNag.settings.memoriesToConsiderHelp":"W ka\u017Cdej turze do trackera trafia deterministycznie wybrana kr\xF3tka lista.","memoryNag.settings.memoriesToInject":"Maksymalna liczba wstrzykiwanych wspomnie\u0144","memoryNag.settings.memoriesToInjectHelp":"Tracker mo\u017Ce wybra\u0107 mniej lub uzna\u0107, \u017Ce \u017Cadne przypomnienie nie pasuje.","memoryNag.settings.save":"Zapisz ustawienia","memoryNag.settings.saved":"Ustawienia zapisane.","memoryNag.settings.scan":"Utw\xF3rz wspomnienia","memoryNag.settings.scanning":"Tworzenie wspomnie\u0144\u2026","memoryNag.settings.stop":"Zatrzymaj","memoryNag.settings.vault":"Otw\xF3rz skarbiec","memoryNag.settings.progressTitle":"Tworzenie wspomnie\u0144","memoryNag.settings.preparing":"Przygotowywanie pierwszej partii\u2026","memoryNag.settings.closeProgress":"Zamknij","memoryNag.settings.progress":"Przetworzono {{processed}} z {{total}} wiadomo\u015Bci \xB7 dodano {{created}} \xB7 rozwi\u0105zano {{resolved}}","memoryNag.settings.complete":"Tworzenie wspomnie\u0144 zako\u0144czone.","memoryNag.settings.stalled":"Tworzenie wspomnie\u0144 wstrzymano, poniewa\u017C czat nie posun\u0105\u0142 si\u0119 naprz\xF3d. Spr\xF3buj ponownie.","memoryNag.settings.stopped":"Tworzenie wspomnie\u0144 zatrzymane.","memoryNag.vault.title":"Skarbiec Memory Nag","memoryNag.vault.loading":"\u0141adowanie skarbca\u2026","memoryNag.vault.expandedTitle":"Rozszerzony edytor wspomnienia","memoryNag.vault.close":"Zamknij skarbiec","memoryNag.vault.active":"Aktywne","memoryNag.vault.resolved":"Rozwi\u0105zane","memoryNag.vault.allCharacters":"Wszystkie postacie","memoryNag.vault.pastParticipant":"dawniej","memoryNag.vault.search":"Szukaj wspomnie\u0144","memoryNag.vault.add":"Dodaj wspomnienie","memoryNag.vault.empty":"Brak pasuj\u0105cych wspomnie\u0144.","memoryNag.vault.edit":"Edytuj","memoryNag.vault.resolve":"Oznacz jako rozwi\u0105zane","memoryNag.vault.restore":"Przywr\xF3\u0107","memoryNag.vault.delete":"Usu\u0144","memoryNag.vault.deleteTitle":"Usun\u0105\u0107 wspomnienie?","memoryNag.vault.deleteMessage":"Spowoduje to trwa\u0142e usuni\u0119cie wspomnienia ze skarbca tego czatu.","memoryNag.vault.editorNew":"Nowe wspomnienie","memoryNag.vault.editorEdit":"Edytuj wspomnienie","memoryNag.vault.memory":"Wspomnienie","memoryNag.vault.memoryPlaceholder":"Jeden kr\xF3tki szczeg\xF3\u0142, o kt\xF3ry warto ich m\u0119czy\u0107\u2026","memoryNag.vault.characters":"Postacie","memoryNag.vault.chooseCharacter":"Wybierz co najmniej jedn\u0105 posta\u0107.","memoryNag.vault.macros":"Makra","memoryNag.vault.expand":"Rozwi\u0144 edytor","memoryNag.vault.collapse":"Zamknij rozszerzony edytor","memoryNag.vault.cancel":"Anuluj","memoryNag.vault.save":"Zapisz wspomnienie","memoryNag.toolbar.label":"Natr\u0119tne wspomnienia","memoryNag.toolbar.regenerate":"Wygeneruj natr\u0119tne wspomnienia ponownie","memoryNag.toolbar.lock":"W\u0142\u0105cz tryb blokowania tracker\xF3w","memoryNag.toolbar.unlock":"Wy\u0142\u0105cz tryb blokowania tracker\xF3w","memoryNag.toolbar.emptyWord":"w g\u0142owie pusto, \u017Cadnych my\u015Bli","memoryNag.toolbar.none":"Tym razem bez natr\u0119tnych wspomnie\u0144.","memoryNag.tracker.title":"Natr\u0119tne wspomnienia","memoryNag.tracker.none":"W tej turze nie przywo\u0142ano \u017Cadnych wspomnie\u0144.","memoryNag.settings.scanScope":"Wiadomo\u015Bci do przetworzenia","memoryNag.settings.scanAll":"Wszystkie nieprzetworzone wiadomo\u015Bci","memoryNag.settings.scanRange":"Zakres wiadomo\u015Bci","memoryNag.settings.rangeStart":"Pierwsza wiadomo\u015B\u0107","memoryNag.settings.rangeEnd":"Ostatnia wiadomo\u015B\u0107","memoryNag.settings.rangeHelp":"Licz wiadomo\u015Bci u\u017Cytkownika i postaci od 1. Oba ko\u0144ce zakresu s\u0105 uwzgl\u0119dniane. Wcze\u015Bniejsze wiadomo\u015Bci zostan\u0105 pomini\u0119te, a kolejne skany automatyczne zaczn\u0105 si\u0119 po ostatniej przetworzonej wiadomo\u015Bci. Istniej\u0105ce wspomnienia zostan\u0105 zachowane.","memoryNag.settings.rangeInvalid":"Wybierz ca\u0142kowite numery wiadomo\u015Bci od 1 do {{count}}. Ostatnia wiadomo\u015B\u0107 nie mo\u017Ce poprzedza\u0107 pierwszej."};var ma={_meta:{locale:"pt-BR",direction:"ltr"},"memoryNag.error.interface":"O Memory Nag parou.","memoryNag.error.retry":"Tentar novamente","memoryNag.error.noChat":"Abra um chat de Roleplay para usar o Memory Nag.","memoryNag.settings.scanConnection":"Conex\xE3o da varredura do cofre","memoryNag.settings.agentConnection":"Usar conex\xE3o do agente","memoryNag.settings.connectionHelp":"Somente as varreduras em lote do cofre usam esta conex\xE3o. A lembran\xE7a por turno continua usando a conex\xE3o definida no editor do agente.","memoryNag.settings.vaultPrompt":"Prompt de mem\xF3rias do cofre","memoryNag.settings.vaultPromptHelp":"Edite as instru\xE7\xF5es usadas para criar mem\xF3rias. Dados do lote, IDs dos personagens, limite e formato JSON s\xE3o adicionados automaticamente.","memoryNag.settings.resetPrompt":"Redefinir prompt","memoryNag.settings.expandPrompt":"Expandir editor do prompt","memoryNag.settings.closePrompt":"Fechar editor do prompt","memoryNag.settings.macroReference":"Refer\xEAncia de macros","memoryNag.settings.macroReferenceHelp":"Macros comuns que voc\xEA pode digitar nos campos de prompt.","memoryNag.settings.closeMacros":"Fechar refer\xEAncia de macros","memoryNag.settings.messagesPerBatch":"Mensagens por lote","memoryNag.settings.messagesPerBatchHelp":"Tamb\xE9m controla a frequ\xEAncia das varreduras autom\xE1ticas do cofre.","memoryNag.settings.memoriesPerCharacter":"M\xE1ximo de mem\xF3rias criadas por personagem","memoryNag.settings.memoriesPerCharacterHelp":"Por lote. O modelo pode criar menos ou nenhuma.","memoryNag.settings.memoriesToConsider":"M\xE1ximo de mem\xF3rias consideradas por personagem","memoryNag.settings.memoriesToConsiderHelp":"Uma lista determin\xEDstica \xE9 enviada ao rastreador a cada turno.","memoryNag.settings.memoriesToInject":"M\xE1ximo de mem\xF3rias inseridas","memoryNag.settings.memoriesToInjectHelp":"O rastreador pode escolher menos ou decidir que nenhum lembrete \xE9 apropriado.","memoryNag.settings.save":"Salvar configura\xE7\xF5es","memoryNag.settings.saved":"Configura\xE7\xF5es salvas.","memoryNag.settings.scan":"Criar mem\xF3rias","memoryNag.settings.scanning":"Criando mem\xF3rias\u2026","memoryNag.settings.stop":"Parar","memoryNag.settings.vault":"Abrir cofre","memoryNag.settings.progressTitle":"Criando mem\xF3rias","memoryNag.settings.preparing":"Preparando o primeiro lote\u2026","memoryNag.settings.closeProgress":"Fechar","memoryNag.settings.progress":"{{processed}} de {{total}} mensagens processadas \xB7 {{created}} adicionadas \xB7 {{resolved}} resolvidas","memoryNag.settings.complete":"Cria\xE7\xE3o de mem\xF3rias conclu\xEDda.","memoryNag.settings.stalled":"A cria\xE7\xE3o de mem\xF3rias foi pausada porque o chat n\xE3o avan\xE7ou. Tente novamente.","memoryNag.settings.stopped":"Cria\xE7\xE3o de mem\xF3rias interrompida.","memoryNag.vault.title":"Cofre do Memory Nag","memoryNag.vault.loading":"Carregando cofre\u2026","memoryNag.vault.expandedTitle":"Editor de mem\xF3ria expandido","memoryNag.vault.close":"Fechar cofre","memoryNag.vault.active":"Ativas","memoryNag.vault.resolved":"Resolvidas","memoryNag.vault.allCharacters":"Todos os personagens","memoryNag.vault.pastParticipant":"anterior","memoryNag.vault.search":"Pesquisar mem\xF3rias","memoryNag.vault.add":"Adicionar mem\xF3ria","memoryNag.vault.empty":"Nenhuma mem\xF3ria correspondente.","memoryNag.vault.edit":"Editar","memoryNag.vault.resolve":"Resolver","memoryNag.vault.restore":"Restaurar","memoryNag.vault.delete":"Excluir","memoryNag.vault.deleteTitle":"Excluir mem\xF3ria?","memoryNag.vault.deleteMessage":"Isso remove permanentemente a mem\xF3ria do cofre deste chat.","memoryNag.vault.editorNew":"Nova mem\xF3ria","memoryNag.vault.editorEdit":"Editar mem\xF3ria","memoryNag.vault.memory":"Mem\xF3ria","memoryNag.vault.memoryPlaceholder":"Um detalhe curto que vale a pena lembrar sem parar\u2026","memoryNag.vault.characters":"Personagens","memoryNag.vault.chooseCharacter":"Escolha pelo menos um personagem.","memoryNag.vault.macros":"Macros","memoryNag.vault.expand":"Expandir editor","memoryNag.vault.collapse":"Fechar editor expandido","memoryNag.vault.cancel":"Cancelar","memoryNag.vault.save":"Salvar mem\xF3ria","memoryNag.toolbar.label":"Lembretes insistentes","memoryNag.toolbar.regenerate":"Gerar lembretes novamente","memoryNag.toolbar.lock":"Ativar o modo de bloqueio dos rastreadores","memoryNag.toolbar.unlock":"Sair do modo de bloqueio dos rastreadores","memoryNag.toolbar.emptyWord":"cabe\xE7a vazia, sem pensamentos","memoryNag.toolbar.none":"Nenhum lembrete desta vez.","memoryNag.tracker.title":"Lembretes insistentes","memoryNag.tracker.none":"Nenhuma mem\xF3ria recuperada neste turno."};var pa={_meta:{locale:"ru",direction:"ltr"},"memoryNag.error.interface":"Memory Nag \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.","memoryNag.error.retry":"\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C","memoryNag.error.noChat":"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u043E\u043B\u0435\u0432\u043E\u0439 \u0447\u0430\u0442, \u0447\u0442\u043E\u0431\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C Memory Nag.","memoryNag.settings.scanConnection":"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430","memoryNag.settings.agentConnection":"\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0430\u0433\u0435\u043D\u0442\u0430","memoryNag.settings.connectionHelp":"\u042D\u0442\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u043F\u0430\u043A\u0435\u0442\u043D\u043E\u0433\u043E \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430. \u0414\u043B\u044F \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u0432 \u043A\u0430\u0436\u0434\u043E\u043C \u0445\u043E\u0434\u0435 \u043F\u043E-\u043F\u0440\u0435\u0436\u043D\u0435\u043C\u0443 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435, \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u0435 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 \u0430\u0433\u0435\u043D\u0442\u0430.","memoryNag.settings.vaultPrompt":"\u041F\u0440\u043E\u043C\u043F\u0442 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439","memoryNag.settings.vaultPromptHelp":"\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u0434\u043B\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0430\u043A\u0435\u0442\u0430, ID \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439, \u043B\u0438\u043C\u0438\u0442 \u0438 \u0444\u043E\u0440\u043C\u0430\u0442 JSON \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.","memoryNag.settings.resetPrompt":"\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0440\u043E\u043C\u043F\u0442","memoryNag.settings.expandPrompt":"\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043F\u0440\u043E\u043C\u043F\u0442\u0430","memoryNag.settings.closePrompt":"\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043F\u0440\u043E\u043C\u043F\u0442\u0430","memoryNag.settings.macroReference":"\u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E \u043C\u0430\u043A\u0440\u043E\u0441\u0430\u043C","memoryNag.settings.macroReferenceHelp":"\u0420\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043C\u0430\u043A\u0440\u043E\u0441\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0436\u043D\u043E \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u0432 \u043F\u043E\u043B\u044F \u043F\u0440\u043E\u043C\u043F\u0442\u0430.","memoryNag.settings.closeMacros":"\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0441\u043F\u0440\u0430\u0432\u043A\u0443 \u043F\u043E \u043C\u0430\u043A\u0440\u043E\u0441\u0430\u043C","memoryNag.settings.messagesPerBatch":"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0432 \u043F\u0430\u043A\u0435\u0442\u0435","memoryNag.settings.messagesPerBatchHelp":"\u0422\u0430\u043A\u0436\u0435 \u0437\u0430\u0434\u0430\u0451\u0442 \u0447\u0430\u0441\u0442\u043E\u0442\u0443 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430.","memoryNag.settings.memoriesPerCharacter":"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0435\u043C\u044B\u0445 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u043D\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430","memoryNag.settings.memoriesPerCharacterHelp":"\u041D\u0430 \u043E\u0434\u0438\u043D \u043F\u0430\u043A\u0435\u0442. \u041C\u043E\u0434\u0435\u043B\u044C \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0438\u043B\u0438 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E.","memoryNag.settings.memoriesToConsider":"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0440\u0430\u0441\u0441\u043C\u0430\u0442\u0440\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u043D\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430","memoryNag.settings.memoriesToConsiderHelp":"\u0412 \u043A\u0430\u0436\u0434\u043E\u043C \u0445\u043E\u0434\u0435 \u0442\u0440\u0435\u043A\u0435\u0440\u0443 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u043F\u0438\u0441\u043E\u043A, \u043E\u0442\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u043C \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C.","memoryNag.settings.memoriesToInject":"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u043C\u044B\u0445 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439","memoryNag.settings.memoriesToInjectHelp":"\u0422\u0440\u0435\u043A\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0438\u043B\u0438 \u0440\u0435\u0448\u0438\u0442\u044C, \u0447\u0442\u043E \u043D\u0438 \u043E\u0434\u043D\u043E \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442.","memoryNag.settings.save":"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438","memoryNag.settings.saved":"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.","memoryNag.settings.scan":"\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F","memoryNag.settings.scanning":"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439\u2026","memoryNag.settings.stop":"\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C","memoryNag.settings.vault":"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435","memoryNag.settings.progressTitle":"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439","memoryNag.settings.preparing":"\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u043F\u0430\u043A\u0435\u0442\u0430\u2026","memoryNag.settings.closeProgress":"\u0417\u0430\u043A\u0440\u044B\u0442\u044C","memoryNag.settings.progress":"\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E {{processed}} \u0438\u0437 {{total}} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \xB7 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E {{created}} \xB7 \u0440\u0435\u0448\u0435\u043D\u043E {{resolved}}","memoryNag.settings.complete":"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E.","memoryNag.settings.stalled":"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u043F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u0447\u0430\u0442 \u043D\u0435 \u043F\u0440\u043E\u0434\u0432\u0438\u043D\u0443\u043B\u0441\u044F. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.","memoryNag.settings.stopped":"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E.","memoryNag.vault.title":"\u0425\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 Memory Nag","memoryNag.vault.loading":"\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430\u2026","memoryNag.vault.expandedTitle":"\u0420\u0430\u0437\u0432\u0451\u0440\u043D\u0443\u0442\u044B\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F","memoryNag.vault.close":"\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435","memoryNag.vault.active":"\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435","memoryNag.vault.resolved":"\u0420\u0435\u0448\u0451\u043D\u043D\u044B\u0435","memoryNag.vault.allCharacters":"\u0412\u0441\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0438","memoryNag.vault.pastParticipant":"\u0431\u044B\u0432\u0448\u0438\u0439","memoryNag.vault.search":"\u0418\u0441\u043A\u0430\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F","memoryNag.vault.add":"\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435","memoryNag.vault.empty":"\u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439 \u043D\u0435\u0442.","memoryNag.vault.edit":"\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C","memoryNag.vault.resolve":"\u0420\u0435\u0448\u0438\u0442\u044C","memoryNag.vault.restore":"\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C","memoryNag.vault.delete":"\u0423\u0434\u0430\u043B\u0438\u0442\u044C","memoryNag.vault.deleteTitle":"\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435?","memoryNag.vault.deleteMessage":"\u0412\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435 \u0431\u0443\u0434\u0435\u0442 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0438\u0437 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430 \u044D\u0442\u043E\u0433\u043E \u0447\u0430\u0442\u0430.","memoryNag.vault.editorNew":"\u041D\u043E\u0432\u043E\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435","memoryNag.vault.editorEdit":"\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435","memoryNag.vault.memory":"\u0412\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435","memoryNag.vault.memoryPlaceholder":"\u041A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u0434\u0435\u0442\u0430\u043B\u044C, \u043E \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u0441\u0442\u043E\u0438\u0442 \u0438\u043C \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0442\u044C\u2026","memoryNag.vault.characters":"\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0438","memoryNag.vault.chooseCharacter":"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.","memoryNag.vault.macros":"\u041C\u0430\u043A\u0440\u043E\u0441\u044B","memoryNag.vault.expand":"\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440","memoryNag.vault.collapse":"\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0440\u0430\u0437\u0432\u0451\u0440\u043D\u0443\u0442\u044B\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440","memoryNag.vault.cancel":"\u041E\u0442\u043C\u0435\u043D\u0430","memoryNag.vault.save":"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435","memoryNag.toolbar.label":"\u041D\u0430\u0432\u044F\u0437\u0447\u0438\u0432\u044B\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F","memoryNag.toolbar.regenerate":"\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u0437\u0430\u043D\u043E\u0432\u043E","memoryNag.toolbar.lock":"\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0436\u0438\u043C \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u0442\u0440\u0435\u043A\u0435\u0440\u043E\u0432","memoryNag.toolbar.unlock":"\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u0440\u0435\u0436\u0438\u043C\u0430 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u0442\u0440\u0435\u043A\u0435\u0440\u043E\u0432","memoryNag.toolbar.emptyWord":"\u0432 \u0433\u043E\u043B\u043E\u0432\u0435 \u043F\u0443\u0441\u0442\u043E, \u043D\u0438\u043A\u0430\u043A\u0438\u0445 \u043C\u044B\u0441\u043B\u0435\u0439","memoryNag.toolbar.none":"\u0412 \u044D\u0442\u043E\u0442 \u0440\u0430\u0437 \u0431\u0435\u0437 \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439.","memoryNag.tracker.title":"\u041D\u0430\u0432\u044F\u0437\u0447\u0438\u0432\u044B\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F","memoryNag.tracker.none":"\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0445\u043E\u0434\u0430 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043D\u0435 \u0432\u044B\u0437\u0432\u0430\u043D\u044B."};var ga={_meta:{locale:"zh-Hans",direction:"ltr"},"memoryNag.error.interface":"Memory Nag \u5DF2\u505C\u6B62\u3002","memoryNag.error.retry":"\u91CD\u8BD5","memoryNag.error.noChat":"\u8BF7\u6253\u5F00\u4E00\u4E2A\u89D2\u8272\u626E\u6F14\u804A\u5929\u4EE5\u4F7F\u7528 Memory Nag\u3002","memoryNag.settings.scanConnection":"\u8BB0\u5FC6\u5E93\u626B\u63CF\u8FDE\u63A5","memoryNag.settings.agentConnection":"\u4F7F\u7528\u667A\u80FD\u4F53\u8FDE\u63A5","memoryNag.settings.connectionHelp":"\u53EA\u6709\u8BB0\u5FC6\u5E93\u6279\u91CF\u626B\u63CF\u4F7F\u7528\u6B64\u8FDE\u63A5\u3002\u9010\u8F6E\u56DE\u5FC6\u4ECD\u4F7F\u7528\u667A\u80FD\u4F53\u7F16\u8F91\u5668\u4E2D\u6307\u5B9A\u7684\u8FDE\u63A5\u3002","memoryNag.settings.vaultPrompt":"\u8BB0\u5FC6\u5E93\u751F\u6210\u63D0\u793A\u8BCD","memoryNag.settings.vaultPromptHelp":"\u7F16\u8F91\u7528\u4E8E\u521B\u5EFA\u8BB0\u5FC6\u7684\u6307\u4EE4\u3002\u6279\u6B21\u6570\u636E\u3001\u89D2\u8272 ID\u3001\u6570\u91CF\u4E0A\u9650\u548C JSON \u683C\u5F0F\u4F1A\u81EA\u52A8\u6DFB\u52A0\u3002","memoryNag.settings.resetPrompt":"\u91CD\u7F6E\u63D0\u793A\u8BCD","memoryNag.settings.expandPrompt":"\u5C55\u5F00\u63D0\u793A\u8BCD\u7F16\u8F91\u5668","memoryNag.settings.closePrompt":"\u5173\u95ED\u63D0\u793A\u8BCD\u7F16\u8F91\u5668","memoryNag.settings.macroReference":"\u5B8F\u53C2\u8003","memoryNag.settings.macroReferenceHelp":"\u53EF\u5728\u63D0\u793A\u8BCD\u5B57\u6BB5\u4E2D\u8F93\u5165\u7684\u5E38\u7528\u5B8F\u3002","memoryNag.settings.closeMacros":"\u5173\u95ED\u5B8F\u53C2\u8003","memoryNag.settings.messagesPerBatch":"\u6BCF\u6279\u6D88\u606F\u6570","memoryNag.settings.messagesPerBatchHelp":"\u4E5F\u7528\u4E8E\u63A7\u5236\u81EA\u52A8\u626B\u63CF\u8BB0\u5FC6\u5E93\u7684\u9891\u7387\u3002","memoryNag.settings.memoriesPerCharacter":"\u6BCF\u4E2A\u89D2\u8272\u6700\u591A\u521B\u5EFA\u7684\u8BB0\u5FC6\u6570","memoryNag.settings.memoriesPerCharacterHelp":"\u6BCF\u6279\u4E0A\u9650\u3002\u6A21\u578B\u53EF\u4EE5\u521B\u5EFA\u66F4\u5C11\uFF0C\u4E5F\u53EF\u4EE5\u4E0D\u521B\u5EFA\u3002","memoryNag.settings.memoriesToConsider":"\u6BCF\u4E2A\u89D2\u8272\u6700\u591A\u8003\u8651\u7684\u8BB0\u5FC6\u6570","memoryNag.settings.memoriesToConsiderHelp":"\u6BCF\u8F6E\u4F1A\u5411\u8FFD\u8E2A\u5668\u53D1\u9001\u4E00\u4EFD\u6309\u786E\u5B9A\u89C4\u5219\u7B5B\u9009\u7684\u5019\u9009\u5217\u8868\u3002","memoryNag.settings.memoriesToInject":"\u6700\u591A\u6CE8\u5165\u7684\u8BB0\u5FC6\u6570","memoryNag.settings.memoriesToInjectHelp":"\u8FFD\u8E2A\u5668\u53EF\u4EE5\u5C11\u9009\uFF0C\u6216\u5224\u65AD\u5F53\u524D\u4E0D\u9002\u5408\u63D0\u9192\u4EFB\u4F55\u8BB0\u5FC6\u3002","memoryNag.settings.save":"\u4FDD\u5B58\u8BBE\u7F6E","memoryNag.settings.saved":"\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002","memoryNag.settings.scan":"\u521B\u5EFA\u8BB0\u5FC6","memoryNag.settings.scanning":"\u6B63\u5728\u521B\u5EFA\u8BB0\u5FC6\u2026","memoryNag.settings.stop":"\u505C\u6B62","memoryNag.settings.vault":"\u6253\u5F00\u8BB0\u5FC6\u5E93","memoryNag.settings.progressTitle":"\u6B63\u5728\u521B\u5EFA\u8BB0\u5FC6","memoryNag.settings.preparing":"\u6B63\u5728\u51C6\u5907\u7B2C\u4E00\u6279\u2026","memoryNag.settings.closeProgress":"\u5173\u95ED","memoryNag.settings.progress":"\u5DF2\u5904\u7406 {{processed}}/{{total}} \u6761\u6D88\u606F \xB7 \u65B0\u589E {{created}} \u6761 \xB7 \u5DF2\u89E3\u51B3 {{resolved}} \u6761","memoryNag.settings.complete":"\u8BB0\u5FC6\u521B\u5EFA\u5B8C\u6210\u3002","memoryNag.settings.stalled":"\u804A\u5929\u6CA1\u6709\u63A8\u8FDB\uFF0C\u8BB0\u5FC6\u521B\u5EFA\u5DF2\u6682\u505C\u3002\u8BF7\u91CD\u8BD5\u3002","memoryNag.settings.stopped":"\u8BB0\u5FC6\u521B\u5EFA\u5DF2\u505C\u6B62\u3002","memoryNag.vault.title":"Memory Nag \u8BB0\u5FC6\u5E93","memoryNag.vault.loading":"\u6B63\u5728\u52A0\u8F7D\u8BB0\u5FC6\u5E93\u2026","memoryNag.vault.expandedTitle":"\u5C55\u5F00\u7684\u8BB0\u5FC6\u7F16\u8F91\u5668","memoryNag.vault.close":"\u5173\u95ED\u8BB0\u5FC6\u5E93","memoryNag.vault.active":"\u6D3B\u8DC3","memoryNag.vault.resolved":"\u5DF2\u89E3\u51B3","memoryNag.vault.allCharacters":"\u6240\u6709\u89D2\u8272","memoryNag.vault.pastParticipant":"\u8FC7\u53BB","memoryNag.vault.search":"\u641C\u7D22\u8BB0\u5FC6","memoryNag.vault.add":"\u6DFB\u52A0\u8BB0\u5FC6","memoryNag.vault.empty":"\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6\u3002","memoryNag.vault.edit":"\u7F16\u8F91","memoryNag.vault.resolve":"\u6807\u4E3A\u5DF2\u89E3\u51B3","memoryNag.vault.restore":"\u6062\u590D","memoryNag.vault.delete":"\u5220\u9664","memoryNag.vault.deleteTitle":"\u5220\u9664\u8BB0\u5FC6\uFF1F","memoryNag.vault.deleteMessage":"\u8FD9\u4F1A\u4ECE\u6B64\u804A\u5929\u7684\u8BB0\u5FC6\u5E93\u4E2D\u6C38\u4E45\u5220\u9664\u8BE5\u8BB0\u5FC6\u3002","memoryNag.vault.editorNew":"\u65B0\u8BB0\u5FC6","memoryNag.vault.editorEdit":"\u7F16\u8F91\u8BB0\u5FC6","memoryNag.vault.memory":"\u8BB0\u5FC6","memoryNag.vault.memoryPlaceholder":"\u4E00\u4E2A\u503C\u5F97\u4E0D\u65AD\u63D0\u9192\u4ED6\u4EEC\u7684\u7B80\u77ED\u7EC6\u8282\u2026","memoryNag.vault.characters":"\u89D2\u8272","memoryNag.vault.chooseCharacter":"\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u89D2\u8272\u3002","memoryNag.vault.macros":"\u5B8F","memoryNag.vault.expand":"\u5C55\u5F00\u7F16\u8F91\u5668","memoryNag.vault.collapse":"\u5173\u95ED\u5C55\u5F00\u7684\u7F16\u8F91\u5668","memoryNag.vault.cancel":"\u53D6\u6D88","memoryNag.vault.save":"\u4FDD\u5B58\u8BB0\u5FC6","memoryNag.toolbar.label":"\u8BB0\u5FC6\u63D0\u9192","memoryNag.toolbar.regenerate":"\u91CD\u65B0\u751F\u6210\u8BB0\u5FC6\u63D0\u9192","memoryNag.toolbar.lock":"\u542F\u7528\u8FFD\u8E2A\u5668\u9501\u5B9A\u6A21\u5F0F","memoryNag.toolbar.unlock":"\u9000\u51FA\u8FFD\u8E2A\u5668\u9501\u5B9A\u6A21\u5F0F","memoryNag.toolbar.emptyWord":"\u8111\u888B\u7A7A\u7A7A\uFF0C\u6CA1\u6709\u60F3\u6CD5","memoryNag.toolbar.none":"\u8FD9\u6B21\u6CA1\u6709\u63D0\u9192\u3002","memoryNag.tracker.title":"\u8BB0\u5FC6\u63D0\u9192","memoryNag.tracker.none":"\u672C\u8F6E\u6CA1\u6709\u56DE\u60F3\u8D77\u4EFB\u4F55\u8BB0\u5FC6\u3002"};var Oe=globalThis.__MARINARA_HOST__,ge=Oe&&Oe.version===1&&Oe.modules?Oe.modules["react/jsx-runtime"]:void 0;if(!ge)throw new Error("Marinara Engine does not provide react/jsx-runtime; this package needs capability API 1.341 or newer.");var Le=ge.Fragment,Fr=ge.default,e=ge.jsx,r=ge.jsxs;function E(t){return Object.fromEntries(Object.entries(t).filter(([a,o])=>a!=="_meta"&&typeof o=="string"))}var he={ar:E(ra),de:E(sa),en:E(la),es:E(ua),fr:E(da),hi:E(na),ja:E(ia),ko:E(fa),pl:E(ca),"pt-br":E(ma),ru:E(pa),"zh-hans":E(ga)};function La(t){return t?.trim().replaceAll("_","-")||"en"}function $a(t){let a=he[t]??he[t.toLowerCase()];return a||(he[t.split("-")[0].toLowerCase()]??he.en)}function Ya(t,a){return a?t.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g,(o,s)=>{let d=a[s];return d==null?o:String(d)}):t}function Ee(t,a,o){let s=$a(La(t?.locale));return Ya(s[a]??he.en[a]??a,o)}var ha=$e({direction:"ltr",t:(t,a)=>Ee(void 0,t,a)});function Ia({localization:t,children:a}){let o=La(t?.locale),s=t?.direction==="rtl"?"rtl":"ltr",d=j(()=>({direction:s,t:(h,c)=>Ee({locale:o},h,c)}),[s,o]);return e(ha.Provider,{value:d,children:e("div",{dir:s,style:{display:"contents"},children:a})})}function z(){return ea(ha)}var xa=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),et=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,o,s)=>s?s.toUpperCase():o.toLowerCase()),je=t=>{let a=et(t);return a.charAt(0).toUpperCase()+a.slice(1)},Ue=(...t)=>t.filter((a,o,s)=>!!a&&a.trim()!==""&&s.indexOf(a)===o).join(" ").trim(),ya=t=>{for(let a in t)if(a.startsWith("aria-")||a==="role"||a==="title")return!0};var Ca={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};var va=Be(({color:t="currentColor",size:a=24,strokeWidth:o=2,absoluteStrokeWidth:s,className:d="",children:h,iconNode:c,...m},y)=>me("svg",{ref:y,...Ca,width:a,height:a,stroke:t,strokeWidth:s?Number(o)*24/Number(a):o,className:Ue("lucide",d),...!h&&!ya(m)&&{"aria-hidden":"true"},...m},[...c.map(([S,u])=>me(S,u)),...Array.isArray(h)?h:[h]]));var g=(t,a)=>{let o=Be(({className:s,...d},h)=>me(va,{ref:h,iconNode:a,className:Ue(`lucide-${xa(je(t))}`,`lucide-${t}`,s),...d}));return o.displayName=je(t),o};var at=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],ae=g("book-open",at);var tt=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],ie=g("check",tt);var ot=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],Ie=g("chevron-down",ot);var rt=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],xe=g("chevron-left",rt);var st=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]],te=g("database",st);var lt=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],J=g("loader-circle",lt);var ut=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 9.9-1",key:"1mm8w8"}]],$=g("lock-open",ut);var dt=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],ye=g("lock",dt);var nt=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"m21 3-7 7",key:"1l2asr"}],["path",{d:"m3 21 7-7",key:"tjx5ai"}],["path",{d:"M9 21H3v-6",key:"wtvkvv"}]],oe=g("maximize-2",nt);var it=[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}],["path",{d:"M8 12a2 2 0 0 0 2-2V8H8",key:"1jfesj"}],["path",{d:"M14 12a2 2 0 0 0 2-2V8h-2",key:"1dq9mh"}]],V=g("message-square-quote",it);var ft=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],Ce=g("pencil",ft);var ct=[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]],ve=g("play",ct);var mt=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],Ne=g("plus",mt);var pt=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],Se=g("refresh-cw",pt);var gt=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],re=g("rotate-ccw",gt);var Lt=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],ke=g("square",Lt);var ht=[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]],we=g("trash-2",ht);var It=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],_=g("x",It);var ze=globalThis.__MARINARA_HOST__,M=ze&&ze.version===1&&ze.modules?ze.modules["react-dom"]:void 0;if(!M)throw new Error("Marinara Engine does not provide react-dom; this package needs capability API 1.341 or newer.");var nl=M.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,il=M.browser,Q=M.createPortal,fl=M.default,cl=M.flushSync,ml=M.preconnect,pl=M.prefetchDNS,gl=M.preinit,Ll=M.preinitModule,hl=M.preload,Il=M.preloadModule,xl=M.requestFormReset,yl=M.unstable_batchedUpdates,Cl=M.useFormState,vl=M.useFormStatus,Nl=M.version;var Ge=`You are a memory handler. Read the roleplay batch below and save only details worth nagging a character about later or resolve those that have already been addressed:
- Keep each memory to up to three short sentences.
- Capture promises, meaningful actions, relationship changes, mistakes, debts, injuries, and memorable admissions.
- A memory can belong to more than one character.
- Skip the user unless they asked a character to remember, promise, or do something, but that memory is bounded to the character (or characters) they directed it to.
- You may quote a short dialogue line verbatim when its exact wording matters, then name the speaker and rough context. Example: "I promise to keep you safe," Dottore promised to Mari after her panic attack at the lab.
- Resolve an existing memory only when this batch clearly settles it.
- Do not duplicate existing memories.
- Never invent character IDs.`;var Ke=Object.freeze({scanConnectionId:null,vaultPrompt:Ge,messagesPerBatch:20,memoriesPerCharacter:10,memoriesToConsider:5,memoriesToInject:3});var xt="/api/memory-nag",yt="x-marinara-csrf";var Ct="marinara_admin_secret";function vt(){if(typeof window>"u")return{};try{let t=window.localStorage.getItem(Ct)?.trim();return t?{"X-Admin-Secret":t}:{}}catch{return{}}}async function A(t,a="GET",o,s){let d=new Headers(vt());a!=="GET"&&d.set(yt,"1"),o!==void 0&&d.set("Content-Type","application/json");let h=await fetch(`${xt}${t}`,{method:a,headers:d,signal:s,cache:"no-store",credentials:"same-origin",...o===void 0?{}:{body:JSON.stringify(o)}});if(!h.ok){let c=await h.json().catch(()=>null),m=typeof c?.error=="string"?c.error:typeof c?.message=="string"?c.message:h.statusText;throw new Error(m||"Memory Nag request failed")}return h.json()}var Na='button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';function fe(t,a,o,s=!0){let d=R(null),h=R(a);return h.current=a,P(()=>{if(!t)return;let c=document.activeElement instanceof HTMLElement?document.activeElement:null,m=d.current;if(!m)return;let y=requestAnimationFrame(()=>(m.querySelector(Na)??m).focus()),S=u=>{if(u.key==="Escape"){u.preventDefault(),h.current();return}if(u.key!=="Tab")return;let C=[...m.querySelectorAll(Na)];if(!m.contains(document.activeElement)){u.preventDefault(),(C[0]??m).focus();return}if(C.length===0){u.preventDefault(),m.focus();return}let x=C[0],N=C.at(-1);u.shiftKey&&document.activeElement===x?(u.preventDefault(),N.focus()):!u.shiftKey&&document.activeElement===N&&(u.preventDefault(),x.focus())};return document.addEventListener("keydown",S),()=>{cancelAnimationFrame(y),document.removeEventListener("keydown",S),s&&requestAnimationFrame(()=>{let u=o?document.querySelector(o):c;(u?.isConnected===!0?u:document.querySelector('.mn-modal[role="dialog"]'))?.focus()})}},[t,s,o]),d}function Nt({chatId:t,participants:a,memory:o,onClose:s,onExpandedChange:d,onSaved:h}){let{t:c}=z(),[m,y]=L({id:o?.id,text:o?.text??"",characterIds:o?.characterIds??[]}),[S,u]=L(!1),[C,x]=L(!1),[N,w]=L(!1),[b,T]=L(""),p=R(null),v=fe(S,()=>u(!1),"#mn-memory-nag-expand-button");P(()=>d(S),[S,d]);let B=I=>{let H=p.current,n=H?.selectionStart??m.text.length,k=H?.selectionEnd??n,O=`${m.text.slice(0,n)}${I}${m.text.slice(k)}`;y(Y=>({...Y,text:O})),requestAnimationFrame(()=>{p.current?.focus(),p.current?.setSelectionRange(n+I.length,n+I.length)})},U=async()=>{if(m.text.trim()){if(m.characterIds.length===0){T(c("memoryNag.vault.chooseCharacter"));return}w(!0),T("");try{let I=m.id?`/memories/${encodeURIComponent(t)}/${encodeURIComponent(m.id)}`:`/memories/${encodeURIComponent(t)}`;await A(I,m.id?"PATCH":"POST",{text:m.text,characterIds:m.characterIds}),await h(),s()}catch(I){T(I instanceof Error?I.message:String(I))}finally{w(!1)}}},W=r("div",{className:"mn-stack",children:[r("div",{className:"mn-row mn-between",children:[e("strong",{children:c(o?"memoryNag.vault.editorEdit":"memoryNag.vault.editorNew")}),e("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small mn-modal-close",onClick:s,"aria-label":c("memoryNag.vault.cancel"),children:e(_,{className:"mn-icon","aria-hidden":"true"})})]}),r("div",{className:"mn-label",children:[e("span",{children:c("memoryNag.vault.memory")}),r("div",{className:"mn-prompt-field",children:[e("textarea",{ref:p,className:"mari-chrome-field mn-field mn-textarea mn-vault-textarea",value:m.text,maxLength:500,placeholder:c("memoryNag.vault.memoryPlaceholder"),onChange:I=>y(H=>({...H,text:I.target.value}))}),r("div",{className:"mn-prompt-tools",children:[S?null:e("button",{id:"mn-memory-nag-expand-button",type:"button",className:"mn-prompt-tool",onClick:()=>{x(!1),u(!0)},title:c("memoryNag.vault.expand"),"aria-label":c("memoryNag.vault.expand"),children:e(oe,{className:"mn-icon","aria-hidden":"true"})}),e("button",{type:"button",className:"mn-prompt-tool",onClick:()=>x(I=>!I),title:c("memoryNag.vault.macros"),"aria-label":c("memoryNag.vault.macros"),"aria-expanded":C,children:e(ae,{className:"mn-icon","aria-hidden":"true"})})]}),C?e("div",{className:"mn-vault-macro-menu","aria-label":c("memoryNag.vault.macros"),children:["{{char}}","{{user}}"].map(I=>e("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",onClick:()=>{B(I),x(!1)},children:I},I))}):null]})]}),r("fieldset",{className:"mn-stack",children:[e("legend",{className:"mn-muted",children:c("memoryNag.vault.characters")}),e("div",{className:"mn-checks",children:a.map(I=>r("label",{className:"mn-check",children:[e("input",{type:"checkbox",checked:m.characterIds.includes(I.id),onChange:H=>y(n=>({...n,characterIds:H.target.checked?[...new Set([...n.characterIds,I.id])]:n.characterIds.filter(k=>k!==I.id)}))}),e("span",{children:I.name}),I.current?null:r("small",{children:["(",c("memoryNag.vault.pastParticipant"),")"]})]},I.id))})]}),b?e("div",{className:"mn-status",role:"alert",children:b}):null,r("div",{className:"mn-actions",children:[r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--primary mari-chrome-control--small",disabled:N,onClick:()=>{U()},children:[e(ie,{className:"mn-icon","aria-hidden":"true"}),c("memoryNag.vault.save")]}),e("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",disabled:N,onClick:s,children:c("memoryNag.vault.cancel")})]})]});return S?Q(e("div",{className:"mn-overlay mari-modal",role:"presentation","data-chat-floating-panel":!0,onClick:()=>u(!1),children:r("section",{ref:v,className:"mn-modal mn-shell mari-modal-panel marinara-chat-popover",role:"dialog","aria-modal":"true","aria-label":c("memoryNag.vault.expandedTitle"),tabIndex:-1,onClick:I=>I.stopPropagation(),children:[r("div",{className:"mn-modal-head marinara-chat-popover__header",children:[e("strong",{children:c("memoryNag.vault.expandedTitle")}),r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",onClick:()=>u(!1),children:[e(xe,{className:"mn-icon","aria-hidden":"true"}),c("memoryNag.vault.collapse")]})]}),e("div",{className:"mn-modal-body marinara-chat-popover__scroll",children:W})]})}),document.body):e("section",{className:"mn-panel",children:W})}function Sa({props:t,onClose:a}){let{t:o}=z(),s=t.chatId??"",[d,h]=L("active"),[c,m]=L(""),[y,S]=L(""),[u,C]=L(null),[x,N]=L(!1),[w,b]=L(""),T=fe(!x,a,void 0,!1);P(()=>{let n=document.activeElement instanceof HTMLElement?document.activeElement:null;return()=>{requestAnimationFrame(()=>{n?.isConnected&&n.focus()})}},[]);let p=K({enabled:!!s,queryKey:["memory-nag","vault",s],queryFn:()=>A(`/vault/${encodeURIComponent(s)}`)}),v=K({enabled:!!s,queryKey:["memory-nag","participants",s],queryFn:()=>A(`/participants/${encodeURIComponent(s)}`)}),B=j(()=>v.data??p.data?.participants??[],[v.data,p.data?.participants]),U=j(()=>new Map(B.map(n=>[n.id,n])),[B]),W=j(()=>{let n=y.trim().toLocaleLowerCase();return(p.data?.memories??[]).filter(k=>k.status===d&&(!c||k.characterIds.includes(c))&&(!n||k.text.toLocaleLowerCase().includes(n)))},[c,y,d,p.data?.memories]),I=async(n,k)=>{b("");try{await A(`/memories/${encodeURIComponent(s)}/${encodeURIComponent(n.id)}`,"PATCH",k),await p.refetch()}catch(O){b(O instanceof Error?O.message:String(O))}},H=async n=>{if(t.confirmAction?await t.confirmAction({title:o("memoryNag.vault.deleteTitle"),message:o("memoryNag.vault.deleteMessage"),confirmLabel:o("memoryNag.vault.delete"),tone:"destructive"}):window.confirm(o("memoryNag.vault.deleteMessage"))){b("");try{await A(`/memories/${encodeURIComponent(s)}/${encodeURIComponent(n.id)}`,"DELETE"),await p.refetch()}catch(O){b(O instanceof Error?O.message:String(O))}}};return Q(e("div",{className:"mn-overlay mari-modal",role:"presentation","data-chat-floating-panel":!0,children:r("section",{ref:T,className:"mn-modal mn-shell mari-modal-panel marinara-chat-popover",role:x?void 0:"dialog","aria-modal":x?void 0:!0,"aria-hidden":x||void 0,"aria-label":x?void 0:o("memoryNag.vault.title"),tabIndex:x?void 0:-1,children:[r("div",{className:"mn-modal-head marinara-chat-popover__header",children:[r("div",{className:"mn-row mn-modal-title marinara-chat-popover__title",children:[e(V,{className:"mn-icon","aria-hidden":"true"}),e("strong",{children:o("memoryNag.vault.title")})]}),e("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small mn-modal-close",onClick:a,"aria-label":o("memoryNag.vault.close"),children:e(_,{className:"mn-icon","aria-hidden":"true"})})]}),r("div",{className:"mn-modal-body mn-stack marinara-chat-popover__scroll",children:[r("div",{className:"mn-row mn-between",children:[e("div",{className:"mn-tabs",role:"tablist",children:["active","resolved"].map(n=>e("button",{type:"button",role:"tab","aria-selected":d===n,className:"mari-chrome-control mari-chrome-control--small mn-tab",onClick:()=>h(n),children:o(`memoryNag.vault.${n}`)},n))}),r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--primary mari-chrome-control--small",onClick:()=>C("new"),children:[e(Ne,{className:"mn-icon","aria-hidden":"true"}),o("memoryNag.vault.add")]})]}),r("div",{className:"mn-grid",children:[r("select",{className:"mari-chrome-field mn-field",value:c,onChange:n=>m(n.target.value),children:[e("option",{value:"",children:o("memoryNag.vault.allCharacters")}),B.map(n=>r("option",{value:n.id,children:[n.name,n.current?"":` (${o("memoryNag.vault.pastParticipant")})`]},n.id))]}),e("input",{type:"search",className:"mari-chrome-field mn-field",value:y,placeholder:o("memoryNag.vault.search"),onChange:n=>S(n.target.value)})]}),u?e(Nt,{chatId:s,participants:B,memory:u==="new"?null:u,onClose:()=>{C(null),N(!1)},onExpandedChange:N,onSaved:async()=>{await p.refetch()}},u==="new"?"new":u.id):null,w?e("div",{className:"mn-status",role:"alert",children:w}):null,p.isLoading?e("div",{className:"mn-status",children:o("memoryNag.vault.loading")}):null,!p.isLoading&&W.length===0?e("div",{className:"mn-status",children:o("memoryNag.vault.empty")}):null,W.map(n=>r("article",{className:"mn-memory",children:[e("div",{className:"mn-memory-text",children:n.text}),e("div",{className:"mn-tags",children:n.characterIds.map(k=>e("span",{className:"mn-tag",children:U.get(k)?.name??k},k))}),r("div",{className:"mn-actions",children:[r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",onClick:()=>C(n),children:[e(Ce,{className:"mn-icon","aria-hidden":"true"}),o("memoryNag.vault.edit")]}),r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",onClick:()=>{I(n,{status:n.status==="active"?"resolved":"active"})},children:[n.status==="active"?e(ie,{className:"mn-icon","aria-hidden":"true"}):e(re,{className:"mn-icon","aria-hidden":"true"}),o(n.status==="active"?"memoryNag.vault.resolve":"memoryNag.vault.restore")]}),r("button",{type:"button",className:"mari-chrome-control mari-chrome-control--danger mari-chrome-control--small",onClick:()=>{H(n)},children:[e(we,{className:"mn-icon","aria-hidden":"true"}),o("memoryNag.vault.delete")]})]})]},n.id))]})]})}),document.body)}var ba=[{key:"messagesPerBatch",label:"memoryNag.settings.messagesPerBatch",help:"memoryNag.settings.messagesPerBatchHelp",min:5,max:200},{key:"memoriesPerCharacter",label:"memoryNag.settings.memoriesPerCharacter",help:"memoryNag.settings.memoriesPerCharacterHelp",min:1,max:50},{key:"memoriesToConsider",label:"memoryNag.settings.memoriesToConsider",help:"memoryNag.settings.memoriesToConsiderHelp",min:1,max:50},{key:"memoriesToInject",label:"memoryNag.settings.memoriesToInject",help:"memoryNag.settings.memoriesToInjectHelp",min:1,max:20}];function wa(t){let a={...t};for(let o of ba)a[o.key]=Math.min(o.max,Math.max(o.min,Math.trunc(a[o.key])));return a}function Pa({props:t}){let{t:a}=z(),{onDirtyChange:o}=t,s=t.chatId??"",[d,h]=L({...Ke}),[c,m]=L(!1),[y,S]=L(!1),[u,C]=L(!1),[x,N]=L(!1),[w,b]=L("all"),[T,p]=L("1"),[v,B]=L(""),[U,W]=L(!1),[I,H]=L(!1),[n,k]=L(""),[O,Y]=L(""),[Z,Ze]=L(null),ce=R(null),se=R(null),ee=R({...Ke}),le=R(0),be=R(0),Pe=R(0),Me=R(0),Je=R(o),Ba=fe(x,()=>{u||N(!1)},"#mn-memory-nag-create-button"),Da=fe(U,()=>W(!1),"#mn-memory-nag-expand-prompt"),Fa=fe(I,()=>H(!1),"#mn-memory-nag-prompt-macros"),ue=K({enabled:!!s,queryKey:["memory-nag","settings",s],queryFn:()=>A(`/vault/${encodeURIComponent(s)}`)});P(()=>{!ue.data||ue.data.chatId!==s||se.current===s||(se.current=s,ee.current=ue.data.settings,le.current=0,be.current=0,Pe.current=0,Me.current=0,h(ue.data.settings),o?.(!1))},[s,o,ue.data]),P(()=>{Je.current=o},[o]),P(()=>()=>{ce.current?.abort(),Je.current?.(!1)},[]);let de=i=>{let D={...ee.current,...i};ee.current=D,le.current+=1,h(D),k(""),o?.(!0)},_e=De(async()=>{let i=s,D=le.current,q=wa(ee.current);ee.current=q,h(q),S(!0),k("");try{let X=await A(`/settings/${encodeURIComponent(i)}`,"PATCH",q);se.current===i&&(be.current=Math.max(be.current,D),Pe.current=0,Me.current=0),se.current===i&&le.current===D&&(ee.current=X.settings,h(X.settings),o?.(!1))}catch(X){throw se.current===i&&le.current===D&&(Me.current+=1,Me.current>=2&&(Pe.current=D)),X}finally{S(!1)}},[s,o]);P(()=>{let i=le.current;if(!s||se.current!==s||y||u||be.current>=i||Pe.current>=i)return;let D=window.setTimeout(()=>{_e().catch(q=>k(q instanceof Error?q.message:String(q)))},500);return()=>window.clearTimeout(D)},[s,_e,y,u,d]);let qa=async()=>{let i=new AbortController;ce.current=i,C(!0),N(!0),k(""),Y(""),Ze(null);let D=0,q=0,X,We=null;try{await _e();let G;if(w==="range"){let F=Number(T),Ae=Number(v),{messageIds:Re}=await A(`/scan/${encodeURIComponent(s)}`,"GET",void 0,i.signal);if(!Number.isSafeInteger(F)||!Number.isSafeInteger(Ae)||F<1||Ae<F||Ae>Re.length)throw new Error(a("memoryNag.settings.rangeInvalid",{count:Re.length}));G={startMessageId:Re[F-1],endMessageId:Re[Ae-1]},X=(await A(`/scan/${encodeURIComponent(s)}/range`,"POST",G,i.signal)).scanId,G.scanId=X}for(;!i.signal.aborted;){let F=await A(`/scan/${encodeURIComponent(s)}`,"POST",G,i.signal);if(D+=F.created,q+=F.resolved,Ze({...F,created:D,resolved:q}),F.done){Y(a("memoryNag.settings.complete"));break}if(We?.checkpointMessageId===F.checkpointMessageId&&We.processed===F.processed){Y(a("memoryNag.settings.stalled"));break}We=F,G&&F.checkpointMessageId&&(G.afterMessageId=F.checkpointMessageId)}await ue.refetch()}catch(G){i.signal.aborted||Y(G instanceof Error?G.message:String(G))}finally{X&&await A(`/scan/${encodeURIComponent(s)}/range/${encodeURIComponent(X)}`,"DELETE",void 0,AbortSignal.timeout(5e3)).catch(()=>{}),ce.current===i&&(ce.current=null),C(!1)}},Ha=()=>{Y(a("memoryNag.settings.stopped")),ce.current?.abort()};return!s||t.chatMode!=="roleplay"?e("div",{className:"mn-status",children:a("memoryNag.error.noChat")}):r("section",{className:"mn-shell mn-stack",children:[r("label",{className:"mn-label",children:[e("span",{children:a("memoryNag.settings.scanConnection")}),r("select",{className:"mari-chrome-field mn-field",disabled:u,value:d.scanConnectionId??"",onChange:i=>de({scanConnectionId:i.target.value||null}),children:[e("option",{value:"",children:a("memoryNag.settings.agentConnection")}),(t.connections??[]).map(i=>r("option",{value:i.id,children:[i.name,i.model?` \xB7 ${i.model}`:""]},i.id))]}),e("small",{children:a("memoryNag.settings.connectionHelp")})]}),r("div",{className:"mn-label",children:[e("label",{className:"mn-label-title",htmlFor:"mn-memory-nag-vault-prompt",children:a("memoryNag.settings.vaultPrompt")}),e("small",{children:a("memoryNag.settings.vaultPromptHelp")}),r("div",{className:"mn-prompt-field",children:[e("textarea",{id:"mn-memory-nag-vault-prompt",className:"mari-chrome-field mn-field mn-textarea mn-prompt-textarea",disabled:u,maxLength:12e3,rows:3,value:d.vaultPrompt,onChange:i=>de({vaultPrompt:i.target.value})}),r("div",{className:"mn-prompt-tools",children:[e("button",{id:"mn-memory-nag-expand-prompt",type:"button",className:"mn-prompt-tool",onClick:()=>W(!0),title:a("memoryNag.settings.expandPrompt"),"aria-label":a("memoryNag.settings.expandPrompt"),children:e(oe,{className:"mn-icon","aria-hidden":"true"})}),e("button",{id:"mn-memory-nag-prompt-macros",type:"button",className:"mn-prompt-tool",onClick:()=>H(!0),title:a("memoryNag.settings.macroReference"),"aria-label":a("memoryNag.settings.macroReference"),children:e(ae,{className:"mn-icon","aria-hidden":"true"})}),e("button",{type:"button",className:"mn-prompt-tool",disabled:u||d.vaultPrompt===Ge,onClick:()=>de({vaultPrompt:Ge}),title:a("memoryNag.settings.resetPrompt"),"aria-label":a("memoryNag.settings.resetPrompt"),children:e(re,{className:"mn-icon","aria-hidden":"true"})})]})]})]}),e("div",{className:"mn-number-grid",children:ba.map(i=>r("label",{className:"mn-number-field",children:[r("span",{className:"mn-number-copy",children:[e("strong",{children:a(i.label)}),e("small",{children:a(i.help)})]}),e("input",{className:"mari-chrome-field mn-field mn-number-input",type:"number",min:i.min,max:i.max,disabled:u,value:d[i.key],onChange:D=>{let q=Number.parseInt(D.target.value,10);Number.isFinite(q)&&de({[i.key]:q})},onBlur:()=>de({[i.key]:wa(ee.current)[i.key]})})]},i.key))}),n?e("div",{className:"mn-status",role:"status",children:n}):null,r("label",{className:"mn-label",children:[e("span",{children:a("memoryNag.settings.scanScope")}),r("select",{className:"mari-chrome-field mn-field",disabled:u,value:w,onChange:i=>b(i.target.value),children:[e("option",{value:"all",children:a("memoryNag.settings.scanAll")}),e("option",{value:"range",children:a("memoryNag.settings.scanRange")})]})]}),w==="range"?r("div",{className:"mn-stack",children:[e("p",{className:"mn-muted",children:a("memoryNag.settings.rangeHelp")}),r("div",{className:"mn-number-grid",children:[r("label",{className:"mn-label",children:[e("span",{children:a("memoryNag.settings.rangeStart")}),e("input",{type:"number",min:1,step:1,className:"mari-chrome-field mn-field",disabled:u,value:T,onChange:i=>p(i.target.value)})]}),r("label",{className:"mn-label",children:[e("span",{children:a("memoryNag.settings.rangeEnd")}),e("input",{type:"number",min:Number(T)||1,step:1,className:"mari-chrome-field mn-field",disabled:u,value:v,onChange:i=>B(i.target.value)})]})]})]}):null,r("div",{className:"mn-actions",children:[r("button",{id:"mn-memory-nag-create-button",type:"button",className:"mari-agent-settings-action",disabled:y||u,onClick:()=>{qa()},children:[e(ve,{className:"mn-icon","aria-hidden":"true"}),a("memoryNag.settings.scan")]}),r("button",{type:"button",className:"mari-agent-settings-action",onClick:()=>m(!0),children:[e(te,{className:"mn-icon","aria-hidden":"true"}),a("memoryNag.settings.vault")]})]}),c?e(Sa,{props:t,onClose:()=>m(!1)}):null,U?Q(e("div",{className:"mn-overlay",role:"presentation","data-chat-floating-panel":!0,children:r("section",{ref:Da,className:"mn-modal mn-prompt-modal mn-shell",role:"dialog","aria-modal":"true","aria-labelledby":"mn-memory-nag-prompt-title",tabIndex:-1,children:[r("div",{className:"mn-modal-head",children:[e("strong",{id:"mn-memory-nag-prompt-title",children:a("memoryNag.settings.vaultPrompt")}),e("button",{type:"button",className:"mari-agent-settings-action mari-agent-settings-action--icon",onClick:()=>W(!1),"aria-label":a("memoryNag.settings.closePrompt"),children:e(_,{className:"mn-icon","aria-hidden":"true"})})]}),e("div",{className:"mn-modal-body",children:e("textarea",{className:"mari-chrome-field mn-field mn-expanded-prompt",disabled:u,maxLength:12e3,value:d.vaultPrompt,onChange:i=>de({vaultPrompt:i.target.value})})})]})}),document.body):null,I?Q(e("div",{className:"mn-overlay",role:"presentation","data-chat-floating-panel":!0,children:r("section",{ref:Fa,className:"mn-modal mn-macro-modal mn-shell",role:"dialog","aria-modal":"true","aria-labelledby":"mn-memory-nag-macros-title",tabIndex:-1,children:[r("div",{className:"mn-modal-head",children:[e("strong",{id:"mn-memory-nag-macros-title",children:a("memoryNag.settings.macroReference")}),e("button",{type:"button",className:"mari-agent-settings-action mari-agent-settings-action--icon",onClick:()=>H(!1),"aria-label":a("memoryNag.settings.closeMacros"),children:e(_,{className:"mn-icon","aria-hidden":"true"})})]}),r("div",{className:"mn-modal-body mn-stack",children:[e("p",{className:"mn-muted",children:a("memoryNag.settings.macroReferenceHelp")}),e("div",{className:"mn-macro-list",children:["{{user}}","{{char}}","{{characters}}","{{input}}","{{date}}","{{time}}"].map(i=>e("code",{children:i},i))})]})]})}),document.body):null,x?Q(e("div",{className:"mn-overlay",role:"presentation","data-chat-floating-panel":!0,children:r("section",{ref:Ba,className:"mn-modal mn-progress-modal mn-shell",role:"dialog","aria-modal":"true","aria-labelledby":"mn-memory-nag-progress-title",tabIndex:-1,children:[r("div",{className:"mn-modal-head",children:[r("div",{className:"mn-row",children:[u?e(J,{className:"mn-icon mn-spin","aria-hidden":"true"}):e(te,{className:"mn-icon","aria-hidden":"true"}),e("strong",{id:"mn-memory-nag-progress-title",children:a("memoryNag.settings.progressTitle")})]}),u?null:e("button",{type:"button",className:"mari-agent-settings-action mari-agent-settings-action--icon mn-icon-button",onClick:()=>N(!1),"aria-label":a("memoryNag.settings.closeProgress"),children:e(_,{className:"mn-icon","aria-hidden":"true"})})]}),r("div",{className:"mn-modal-body mn-stack",children:[Z?r(Le,{children:[e("progress",{className:"mn-progress",max:Math.max(Z.total,1),value:Math.min(Z.processed,Z.total)}),e("div",{className:"mn-status",role:"status",children:a("memoryNag.settings.progress",{processed:Z.processed,total:Z.total,created:Z.created,resolved:Z.resolved})})]}):u?e("div",{className:"mn-status",role:"status",children:a("memoryNag.settings.preparing")}):null,O?e("div",{className:"mn-status",role:"status",children:O}):null,e("div",{className:"mn-actions mn-actions-end",children:u?r("button",{type:"button",className:"mari-agent-settings-action",onClick:Ha,children:[e(ke,{className:"mn-icon","aria-hidden":"true"}),a("memoryNag.settings.stop")]}):r(Le,{children:[e("button",{type:"button",className:"mari-agent-settings-action",onClick:()=>N(!1),children:a("memoryNag.settings.closeProgress")}),r("button",{type:"button",className:"mari-agent-settings-action mari-agent-settings-action--primary",onClick:()=>{N(!1),m(!0)},children:[e(te,{className:"mn-icon","aria-hidden":"true"}),a("memoryNag.settings.vault")]})]})})]})]})}),document.body):null]})}function St(t,a){let o=(d,h)=>d.split(/[^\p{L}\p{N}\p{M}'’-]+/u).filter(c=>c.length>=h&&/[\p{L}\p{N}]/u.test(c)),s=o(t.join(" "),3);return s.length>0?s:o(a,1)}function Ma({props:t}){let{t:a}=z(),o=t.chatId??"",s=t.chatMode==="roleplay"&&!!o,[d,h]=L(!1),c=R(null),m=R(null),[y,S]=L(null),[u,C]=L(0),x=K({enabled:s,queryKey:["memory-nag","recall",o],queryFn:()=>A(`/recall/${encodeURIComponent(o)}`),refetchInterval:2500}),N=x.data!==void 0&&x.data!==null,w=j(()=>x.data?.nags??[],[x.data?.nags]),b=j(()=>St(w,a("memoryNag.toolbar.emptyWord")),[w,a]);P(()=>{if(!N||b.length===0)return;C(w.length>0?Math.floor(Math.random()*b.length):0);let p=window.setInterval(()=>{C(v=>w.length>0?Math.floor(Math.random()*b.length):(v+1)%b.length)},3e3);return()=>window.clearInterval(p)},[N,w.length,b]);let T=De(()=>{let p=c.current?.getBoundingClientRect();if(!p)return null;let v=m.current?.offsetWidth??288,B=m.current?.offsetHeight??160,U=window.innerWidth<768?Math.round((window.innerWidth-v)/2):Math.min(p.left,window.innerWidth-v-8);return{top:Math.max(8,Math.min(p.bottom+4,window.innerHeight-B-8)),left:Math.max(8,Math.min(U,window.innerWidth-v-8))}},[]);return aa(()=>{d&&S(T())},[d,T]),P(()=>{if(!d)return;let p=()=>S(T());window.addEventListener("resize",p),window.addEventListener("scroll",p,!0);let v=new ResizeObserver(p);return m.current&&v.observe(m.current),()=>{window.removeEventListener("resize",p),window.removeEventListener("scroll",p,!0),v.disconnect()}},[d,T]),P(()=>{if(!d)return;let p=B=>{let U=B.target;!c.current?.contains(U)&&!m.current?.contains(U)&&h(!1)},v=B=>{B.key==="Escape"&&h(!1)};return document.addEventListener("pointerdown",p),document.addEventListener("keydown",v),()=>{document.removeEventListener("pointerdown",p),document.removeEventListener("keydown",v)}},[d]),s?r("div",{className:"mn-shell mn-toolbar",children:[e("button",{ref:c,type:"button",className:`${t.toolbarButtonClass??"mari-chrome-control mari-chrome-control--small mn-toolbar-button--fallback"} mn-toolbar-button`,"aria-expanded":d,"aria-label":a("memoryNag.toolbar.label"),onClick:()=>h(p=>!p),children:N?e("span",{className:"mn-toolbar-word","aria-hidden":"true",children:b[u]??b[0]}):e(V,{className:"mn-toolbar-initial-icon","aria-hidden":"true"})}),d?Q(r("div",{ref:m,"data-chat-floating-panel":!0,className:"mn-shell mn-popover",style:y?{position:"fixed",top:y.top,left:y.left}:{position:"fixed",top:-9999,left:-9999},children:[r("div",{className:"mn-popover-header",children:[r("strong",{className:"mn-popover-title",children:[e(V,{className:"mn-popover-title-icon","aria-hidden":"true"}),a("memoryNag.toolbar.label")]}),r("div",{className:"mn-popover-actions",children:[t.onRerunTracker?e("button",{type:"button",className:"mn-popover-action",disabled:t.trackerRetryBusy,title:a("memoryNag.toolbar.regenerate"),"aria-label":a("memoryNag.toolbar.regenerate"),onClick:t.onRerunTracker,children:e(Se,{className:`mn-popover-action-icon${t.trackerRetryBusy?" mn-spin":""}`,"aria-hidden":"true"})}):null,t.onToggleLockMode?e("button",{type:"button",className:`mn-popover-action${t.lockMode?" mn-popover-action--active":""}`,title:a(t.lockMode?"memoryNag.toolbar.unlock":"memoryNag.toolbar.lock"),"aria-label":a(t.lockMode?"memoryNag.toolbar.unlock":"memoryNag.toolbar.lock"),"aria-pressed":t.lockMode===!0,onClick:t.onToggleLockMode,children:t.lockMode?e(ye,{className:"mn-popover-action-icon","aria-hidden":"true"}):e($,{className:"mn-popover-action-icon","aria-hidden":"true"})}):null]})]}),e("div",{className:"mn-popover-body",children:w.length>0?e("ul",{className:"mn-popover-list",children:w.map((p,v)=>e("li",{children:p},`${v}-${p}`))}):e("p",{className:"mn-popover-empty",children:a("memoryNag.toolbar.none")})})]}),document.body):null]}):null}function Aa({props:t}){let{t:a}=z(),o=t.chatId??"",s=t.chatMode==="roleplay"&&!!o,d=t.mobileCompact===!0,[h,c]=L(0),[m,y]=L(!1),u=K({enabled:s,queryKey:["memory-nag","recall",o],queryFn:()=>A(`/recall/${encodeURIComponent(o)}`),refetchInterval:2500}).data?.nags??[];if(P(()=>{if(c(0),u.length<2)return;let x=window.setInterval(()=>c(N=>(N+1)%u.length),4e3);return()=>window.clearInterval(x)},[u.length]),!s)return null;let C=r(Le,{children:[d?null:e("span",{className:"mn-tracker-chevron-frame","aria-hidden":"true",children:e(Ie,{className:`mn-tracker-chevron${m?" mn-tracker-chevron--collapsed":""}`})}),e("span",{className:"mn-tracker-icon","aria-hidden":"true",children:e(V,{className:"mn-tracker-panel-icon"})}),e("strong",{className:"mn-tracker-title",children:a("memoryNag.tracker.title")})]});return r("section",{className:`mn-shell mn-tracker${d?" mn-tracker--mobile-compact":""}`,children:[d?null:e("div",{className:"mn-tracker-veil","aria-hidden":"true"}),r("div",{className:"mn-tracker-content",children:[e("div",{className:"mn-tracker-header",children:d?e("div",{className:"mn-tracker-toggle mn-tracker-toggle--static",children:C}):e("button",{type:"button",className:"mn-tracker-toggle","aria-expanded":!m,"aria-label":a("memoryNag.tracker.title"),onClick:()=>y(x=>!x),children:C})}),d||!m?e("div",{className:`mn-tracker-value${u.length===0?" mn-tracker-value--empty":""}`,children:u[h]??a("memoryNag.tracker.none")}):null]})]})}var Ra=`
.mn-shell {
  --mn-chroma: var(--marinara-chat-chrome-accent, var(--foreground));
  --accent: var(--marinara-chat-chrome-highlight-bg);
  --accent-foreground: var(--marinara-chat-chrome-highlight-text);
  --background: var(--marinara-chat-chrome-panel-bg);
  --border: var(--marinara-chat-chrome-panel-border);
  --card: var(--marinara-chat-chrome-panel-bg);
  --foreground: var(--marinara-chat-chrome-panel-text);
  --input: var(--marinara-chat-chrome-input-border);
  --muted: var(--marinara-chat-chrome-highlight-bg);
  --muted-foreground: var(--marinara-chat-chrome-panel-muted);
  --popover: var(--marinara-chat-chrome-panel-bg);
  --popover-foreground: var(--marinara-chat-chrome-panel-text);
  --primary: var(--marinara-chat-chrome-highlight-text);
  --primary-foreground: var(--marinara-chat-chrome-panel-bg);
  --ring: var(--marinara-chat-chrome-focus-ring);
  --secondary: var(--marinara-chat-chrome-highlight-bg);
  color: var(--marinara-chat-chrome-panel-text);
  font: inherit;
}

.mn-panel {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  padding: 0.75rem;
}

.mn-stack {
  display: grid;
  gap: 0.65rem;
}

.mn-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mn-between {
  justify-content: space-between;
}

.mn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.mn-number-grid {
  display: grid;
  gap: 0.5rem;
}

.mn-number-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--muted-foreground);
}

.mn-number-copy {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.mn-number-copy strong {
  color: var(--foreground);
  font-size: 0.625rem;
  font-weight: 500;
}

.mn-number-copy small {
  color: var(--muted-foreground);
  font-size: 0.59375rem;
  line-height: 1.35;
}

.mn-label {
  display: grid;
  gap: 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.625rem;
}

.mn-label > span:first-child,
.mn-label-title {
  color: var(--foreground);
  font-weight: 500;
}

.mn-label small {
  font-size: 0.59375rem;
  line-height: 1.35;
}

.mn-field {
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.625rem;
  font: inherit;
  font-size: 0.75rem;
}

.mn-number-input {
  height: 2.25rem;
  min-height: 2.25rem;
  font-variant-numeric: tabular-nums;
}

.mn-textarea {
  min-height: 7rem;
  resize: vertical;
  line-height: 1.45;
}

.mn-vault-textarea {
  padding-right: 2rem;
}

.mn-prompt-textarea {
  min-height: 3.25rem;
  border-radius: 0.375rem;
  padding: 0.5rem 2rem 0.5rem 0.625rem;
  font-size: 0.75rem;
  line-height: 1.625;
}

.mn-prompt-field {
  position: relative;
}

.mn-prompt-tools {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mn-prompt-tool {
  display: flex;
  height: 1.25rem;
  width: 1.25rem;
  min-height: 1.25rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0.25rem;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease;
}

.mn-prompt-tool:not(:disabled):hover {
  background: var(--accent);
  color: var(--foreground);
}

.mn-prompt-tool:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.mn-prompt-tool:disabled {
  cursor: default;
  opacity: 0.4;
}

.mn-prompt-tool .mn-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.mn-vault-macro-menu {
  position: absolute;
  z-index: 1;
  top: 1.75rem;
  right: 0.375rem;
  display: flex;
  gap: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--popover);
  padding: 0.25rem;
  box-shadow: 0 0.5rem 1.25rem rgb(0 0 0 / 0.2);
}

.mn-prompt-modal {
  width: min(64rem, calc(100vw - 2rem));
}

.mn-expanded-prompt {
  min-height: min(70vh, 42rem);
  resize: vertical;
  padding: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.55;
}

.mn-macro-modal {
  width: min(30rem, calc(100vw - 2rem));
}

.mn-macro-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.4rem;
}

.mn-macro-list code {
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--muted);
  padding: 0.45rem 0.55rem;
  color: var(--foreground);
  font-size: 0.7rem;
}

.mn-icon-button {
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
}

.mn-muted {
  color: var(--muted-foreground);
  font-size: 0.68rem;
  line-height: 1.4;
}

.mn-status {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--muted);
  padding: 0.5rem 0.6rem;
  font-size: 0.7rem;
}

.mn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.mn-actions-end {
  justify-content: flex-end;
}

.mn-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
}

.mn-overlay::before {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(2px);
  content: "";
}

.mn-modal {
  position: relative;
  display: flex;
  width: min(48rem, 100%);
  max-height: min(85dvh, 52rem);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--marinara-chat-chrome-panel-border);
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-panel-bg);
  color: var(--marinara-chat-chrome-panel-text);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 40%);
  backdrop-filter: blur(12px);
}

.mn-progress-modal {
  width: min(30rem, 100%);
}

.mn-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider);
  padding: 0.625rem 0.75rem;
  color: var(--marinara-chat-chrome-panel-title);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-modal-title {
  min-width: 0;
  color: var(--marinara-chat-chrome-panel-title);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem;
  scrollbar-color: var(--marinara-chat-chrome-panel-scrollbar) transparent;
  scrollbar-width: thin;
}

.mn-modal-close {
  width: 1.75rem;
  min-width: 1.75rem;
  height: 1.75rem;
  min-height: 1.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  padding: 0.375rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

.mn-modal-close .mn-icon {
  width: 1rem;
  height: 1rem;
}

.mn-modal-close:hover {
  background: var(--marinara-chat-chrome-highlight-bg-hover);
  color: var(--marinara-chat-chrome-highlight-text);
}

.mn-progress {
  width: 100%;
  height: 0.55rem;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: var(--muted);
  accent-color: var(--mn-chroma);
}

.mn-progress::-webkit-progress-bar {
  background: var(--muted);
}

.mn-progress::-webkit-progress-value {
  background: var(--mn-chroma);
}

.mn-progress::-moz-progress-bar {
  background: var(--mn-chroma);
}

.mn-tabs {
  display: flex;
  gap: 0.35rem;
}

.mn-tab[aria-selected="true"] {
  border-color: var(--marinara-chat-chrome-button-border-active);
  background: var(--marinara-chat-chrome-button-bg-active);
  color: var(--marinara-chat-chrome-button-text-active);
}

.mn-memory {
  display: grid;
  gap: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  padding: 0.65rem;
}

.mn-memory-text {
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.mn-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.mn-tag {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.16rem 0.42rem;
  color: var(--muted-foreground);
  font-size: 0.62rem;
}

.mn-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mn-check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.3rem 0.45rem;
  font-size: 0.68rem;
}

.mn-toolbar {
  display: inline-flex;
  flex: none;
}

.mn-toolbar-button {
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
}

.mn-toolbar-button--fallback {
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0.25rem;
}

.mn-toolbar-word {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 0.375rem;
  font-weight: 600;
  line-height: 0.5rem;
  letter-spacing: -0.02em;
  text-align: center;
  text-overflow: clip;
  white-space: nowrap;
}

.mn-toolbar-initial-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
}

.mn-popover {
  z-index: 9999;
  box-sizing: border-box;
  width: 18rem;
  min-width: 15rem;
  min-height: 6rem;
  max-width: calc(100vw - 1rem);
  max-height: min(24rem, calc(100vh - 1rem));
  overflow: auto;
  resize: both;
  border: 1px solid var(--marinara-chat-chrome-panel-border, var(--border));
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-panel-bg, var(--popover, var(--background)));
  color: var(--marinara-chat-chrome-panel-text, var(--foreground));
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 40%);
  backdrop-filter: blur(12px);
}

.mn-popover-header {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider, var(--border));
  padding: 0.625rem 0.75rem;
}

.mn-popover-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
  color: var(--marinara-chat-chrome-panel-title, var(--foreground));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-popover-title-icon {
  width: 0.625rem;
  height: 0.625rem;
  flex: none;
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
}

.mn-popover-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
}

.mn-popover-action {
  display: inline-flex;
  width: 1.5rem;
  min-width: 1.5rem;
  height: 1.5rem;
  min-height: 1.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0;
  color: var(--marinara-chat-chrome-panel-muted, var(--muted-foreground));
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.mn-popover-action:hover,
.mn-popover-action--active {
  border-color: var(--marinara-chat-chrome-button-border, var(--border));
  background: var(--marinara-chat-chrome-highlight-bg, var(--accent));
  color: var(--marinara-chat-chrome-button-text-active, var(--foreground));
}

.mn-popover-action:focus-visible {
  outline: 1px solid var(--marinara-chat-chrome-focus-ring, var(--ring));
  outline-offset: 1px;
}

.mn-popover-action:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.mn-popover-action-icon {
  width: 0.6875rem;
  height: 0.6875rem;
}

.mn-popover-body {
  padding: 0.5rem;
}

.mn-popover-list {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.375rem;
  list-style: none;
}

.mn-popover-list li {
  border: 1px solid color-mix(in srgb, var(--marinara-chat-chrome-panel-border, var(--border)) 55%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--marinara-chat-chrome-highlight-bg, var(--muted)) 32%, transparent);
  padding: 0.5rem;
  font-size: 0.7rem;
  line-height: 1.4;
}

.mn-popover-empty {
  margin: 0;
  padding: 0.5rem;
  color: color-mix(in srgb, var(--marinara-chat-chrome-panel-muted, var(--muted-foreground)) 60%, transparent);
  font-size: 0.625rem;
  line-height: 1rem;
  text-align: center;
}

.mn-tracker {
  position: relative;
  z-index: 10;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  background: var(--tracker-panel-section-background, color-mix(in srgb, var(--card) 5%, transparent));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--foreground) 5%, transparent);
}

.mn-tracker-veil {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--background) var(--tracker-profile-contrast-strong-top, 40%), transparent) 0%,
    color-mix(in srgb, var(--card) var(--tracker-profile-contrast-strong-mid, 30%), transparent) 52%,
    color-mix(in srgb, var(--background) var(--tracker-profile-contrast-strong-bottom, 42%), transparent) 100%
  );
}

.mn-tracker-content {
  position: relative;
  z-index: 10;
}

.mn-tracker-header {
  display: flex;
  min-height: 1.75rem;
  align-items: center;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
  padding: 0.125rem 0.25rem;
}

.mn-tracker-toggle {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  width: 100%;
  flex: 1;
  align-self: stretch;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  border-radius: 0.125rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.mn-tracker-toggle:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.mn-tracker-toggle:focus-visible {
  outline: 1px solid var(--border);
  outline-offset: -1px;
}

.mn-tracker-chevron-frame {
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  flex: none;
  align-items: center;
  justify-content: center;
}

.mn-tracker-chevron {
  width: 0.6875rem;
  height: 0.6875rem;
  flex: none;
  color: var(--tracker-profile-icon, var(--muted-foreground));
  opacity: 0.6;
  transition: transform 150ms ease;
}

.mn-tracker-chevron--collapsed {
  transform: rotate(-90deg);
}

.mn-tracker-icon {
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--tracker-profile-icon, var(--muted-foreground));
  opacity: 0.75;
}

.mn-tracker-panel-icon {
  width: 0.6875rem;
  height: 0.6875rem;
}

.mn-tracker-title {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--foreground) 62%, transparent);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 0.75rem;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.mn-tracker-value {
  min-height: 2.25rem;
  padding: 0.5rem;
  color: color-mix(in srgb, var(--foreground) 78%, transparent);
  font-size: 0.6875rem;
  line-height: 1.4;
}

.mn-tracker-value--empty {
  min-height: 0;
  padding: 0.25rem;
  color: color-mix(in srgb, var(--foreground) 35%, transparent);
  font-size: 0.6875rem;
  line-height: 0.875rem;
}

.mn-tracker--mobile-compact {
  border-bottom: 0;
  background: transparent;
  box-shadow: none;
}

.mn-tracker--mobile-compact .mn-tracker-header {
  min-height: 0;
  border-bottom: 0;
  padding: 0.5rem 0.75rem 0.25rem;
}

.mn-tracker--mobile-compact .mn-tracker-toggle--static {
  align-self: auto;
  cursor: default;
}

.mn-tracker--mobile-compact .mn-tracker-toggle--static:hover {
  background: transparent;
}

.mn-tracker--mobile-compact .mn-tracker-icon {
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
  opacity: 1;
}

.mn-tracker--mobile-compact .mn-tracker-value {
  min-height: 0;
  padding: 0.25rem 0.75rem 0.5rem;
}

.mn-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
}

.mn-spin {
  animation: mn-spin 0.8s linear infinite;
}

.mn-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@keyframes mn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 640px) {
  .mn-number-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .mn-grid {
    grid-template-columns: 1fr;
  }

  .mn-overlay {
    align-items: stretch;
    padding: 0;
  }

  .mn-modal {
    width: 100%;
    height: 100%;
    max-height: none;
    border: 0;
    border-radius: 0;
  }

  .mn-modal-body {
    padding: 0.75rem;
  }

  .mn-popover {
    resize: none;
  }
}
`;Xe.setQueryDefaults(["memory-nag"],{retry:!1,staleTime:1e3});var Qe=class extends Ye.Component{constructor(){super(...arguments);ne(this,"state",{error:null})}static getDerivedStateFromError(o){return{error:o}}componentDidCatch(o){let s=o.message||Ee(this.props.element.capabilityProps?.localization,"memoryNag.error.interface");this.props.element.capabilityRuntimeError=s,this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:s},bubbles:!0})),console.error("Memory Nag client capability stopped",o)}render(){return this.state.error?e(kt,{onRetry:()=>{this.props.element.capabilityRuntimeError=null,this.setState({error:null})}}):this.props.children}};function kt({onRetry:t}){let{t:a}=z();return r("div",{className:"mn-shell mn-panel mn-stack",role:"alert",children:[e("strong",{children:a("memoryNag.error.interface")}),e("button",{type:"button",className:"mari-chrome-control mari-chrome-control--small",onClick:t,children:a("memoryNag.error.retry")})]})}function wt({element:t}){let a=t.capabilityProps??{},o=t.getAttribute("view");return o==="settings"?e(Pa,{props:a}):o==="toolbar"?e(Ma,{props:a}):o==="tracker"?e(Aa,{props:a}):null}function bt({element:t}){let[,a]=L(0);return P(()=>{let o=()=>a(s=>s+1);return t.addEventListener("marinara-capability-props",o),()=>t.removeEventListener("marinara-capability-props",o)},[t]),r(Ia,{localization:t.capabilityProps?.localization,children:[e("style",{children:Ra}),e(Qe,{element:t,children:e(wt,{element:t})})]})}var Ve=class extends HTMLElement{constructor(){super(...arguments);ne(this,"__root",null);ne(this,"capabilityProps");ne(this,"capabilityRuntimeError")}attributeChangedCallback(o,s,d){o==="view"&&s!==d&&this.__root&&this.render()}render(){this.__root?.render(e(oa,{client:Xe,children:e(bt,{element:this})}))}connectedCallback(){this.__root||(this.__root=ta(this)),this.render()}disconnectedCallback(){queueMicrotask(()=>{!this.isConnected&&this.__root&&(this.__root.unmount(),this.__root=null)})}};ne(Ve,"observedAttributes",["view"]);var Ta="marinara-capability-memory-nag";customElements.get(Ta)||customElements.define(Ta,Ve);
/*! Bundled license information:

lucide-react/dist/esm/shared/src/utils.js:
lucide-react/dist/esm/defaultAttributes.js:
lucide-react/dist/esm/Icon.js:
lucide-react/dist/esm/createLucideIcon.js:
lucide-react/dist/esm/icons/book-open.js:
lucide-react/dist/esm/icons/check.js:
lucide-react/dist/esm/icons/chevron-down.js:
lucide-react/dist/esm/icons/chevron-left.js:
lucide-react/dist/esm/icons/database.js:
lucide-react/dist/esm/icons/loader-circle.js:
lucide-react/dist/esm/icons/lock-open.js:
lucide-react/dist/esm/icons/lock.js:
lucide-react/dist/esm/icons/maximize-2.js:
lucide-react/dist/esm/icons/message-square-quote.js:
lucide-react/dist/esm/icons/pencil.js:
lucide-react/dist/esm/icons/play.js:
lucide-react/dist/esm/icons/plus.js:
lucide-react/dist/esm/icons/refresh-cw.js:
lucide-react/dist/esm/icons/rotate-ccw.js:
lucide-react/dist/esm/icons/square.js:
lucide-react/dist/esm/icons/trash-2.js:
lucide-react/dist/esm/icons/x.js:
lucide-react/dist/esm/lucide-react.js:
  (**
   * @license lucide-react v0.513.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
