import { assertSlurpNotPaused } from "./slp-pause.js";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * A provider that turns a request away for load: HTTP 429 or 529, or the words providers use for it.
 *
 * Pure on purpose, so the rule stays testable. The bundled providers throw plain errors whose
 * message carries the status ("… API error 429: …"), so the message is all there is to read.
 */
const SLP_RATE_LIMIT_PATTERN =
  /\berror (?:429|529)\b|rate.?limit|too many (?:concurrent )?requests|resource.?exhausted|overloaded/iu;

export function slpIsRateLimitError(error: unknown): boolean {
  return error instanceof Error && SLP_RATE_LIMIT_PATTERN.test(error.message);
}

/** DNS answers that often clear on their own: a phone between networks, a flaky or absent resolver (Termux). */
const SLP_TRANSIENT_DNS_CODES = ["EAI_AGAIN", "ENOTFOUND"] as const;
type SlpTransientDnsCode = (typeof SLP_TRANSIENT_DNS_CODES)[number];

/**
 * The DNS code behind a failed call, or null. The Engine's outbound-URL guard (`utils/security.ts`)
 * rejects with the `dns.lookup` error itself ("getaddrinfo EAI_AGAIN host"); a failed connect
 * surfaces as `fetch failed` with the code on its cause.
 */
export function slpTransientNetworkCode(error: unknown): SlpTransientDnsCode | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    const code = SLP_TRANSIENT_DNS_CODES.find(
      (known) =>
        candidate.code === known ||
        (typeof candidate.message === "string" && candidate.message.includes(`getaddrinfo ${known}`)),
    );
    if (code) return code;
    current = candidate.cause;
  }
  return null;
}

/**
 * Run one model call, and wait out a rate limit or a DNS hiccup before sending it again.
 *
 * The Engine pauses and resumes a rate-limited request for chat, role-play and Noodle
 * (`withRateLimitAwareProvider`), keyed by connection. Slurp's bundled provider snapshot has no
 * such wrapper, so a busy free tier, a proxy or a flaky resolver failed Slurp's calls while every
 * other mode worked.
 *
 * Every Slurp call site builds its provider through `slpWithProviderRetry` (G8), so this covers
 * all of Slurp's model calls, not only the bulk draft.
 *
 * ponytail: fixed backoff, no Retry-After and no per-connection pacing. Upgrade path: once the
 * pinned `sources/engine` snapshot carries `withRateLimitAwareProvider`, pass the connection id to
 * `createLLMProvider` in every Slurp call site and keep only the DNS part here.
 */
export async function slpRetryProviderCall<T>(
  run: () => Promise<T>,
  options: {
    delaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    /** Told about each rate limit, and awaited before the wait, so a batch can slow down (`slpSettleAdaptive`). */
    onRateLimit?: () => void | Promise<void>;
  } = {},
): Promise<T> {
  const delaysMs = options.delaysMs ?? [5_000, 15_000, 30_000];
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const delay = delaysMs[attempt];
      const rateLimited = slpIsRateLimitError(error);
      if (delay === undefined || !(rateLimited || slpTransientNetworkCode(error))) throw error;
      if (rateLimited) await options.onRateLimit?.();
      await sleep(delay);
    }
  }
}

/**
 * A worker pool that starts `start` wide and drops to one at a time after the first rate limit.
 * A connection without limits keeps a bulk add fast; one that serves a single request at a time
 * refuses once, the refused call waits until it is the only one running, and the rest go one by
 * one. Settles per item, like the Engine's pool.
 */
export async function slpSettleAdaptive<T, R>(
  items: readonly T[],
  worker: (item: T, slowDown: () => Promise<void>) => Promise<R>,
  start = 2,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let limit = Math.max(1, Math.trunc(start));
  let next = 0;
  let active = 0;
  let wake = () => {};
  let changed = new Promise<void>((resolve) => (wake = resolve));
  const notify = () => {
    const resolve = wake;
    changed = new Promise<void>((next) => (wake = next));
    resolve();
  };
  // The caller is one of the running items: it goes on once every other running item is waiting
  // here too, in arrival order. Waiting for `active > 1` alone deadlocked when two items were
  // refused together: each counted the other as running.
  const waiting: number[] = [];
  let ticket = 0;
  const slowDown = async () => {
    limit = 1;
    const mine = ticket++;
    waiting.push(mine);
    notify();
    while (active > waiting.length || waiting[0] !== mine) await changed;
    waiting.shift();
    notify();
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        if (active >= limit) {
          await changed;
          continue;
        }
        const index = next++;
        active += 1;
        try {
          results[index] = { status: "fulfilled", value: await worker(items[index]!, slowDown) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        } finally {
          active -= 1;
          notify();
        }
      }
    }),
  );
  return results;
}

/**
 * The same provider, with every `chatComplete` run through `slpRetryProviderCall`. Every Slurp
 * model call is a `chatComplete`, so wrapping the provider where it is built covers them all.
 * Other methods and fields still come from the provider (prototype chain), so a caller that reads
 * one sees the real thing.
 */
export function slpWithProviderRetry<P extends { chatComplete: (...args: never[]) => Promise<unknown> }>(
  provider: P,
  options?: Parameters<typeof slpRetryProviderCall>[1],
): P {
  // defineProperty, not assignment: the host's providers carry a read-only `chatComplete`, and a
  // read-only property on the prototype makes plain assignment on the wrapper throw.
  return Object.defineProperty(Object.create(provider) as P, "chatComplete", {
    // "Pause all" (`slp-pause.ts`): not one model call while Slurp is paused.
    // Async, so a paused call rejects like any failed call and a `.catch()` on it still catches it.
    value: async (...args: Parameters<P["chatComplete"]>) => {
      assertSlurpNotPaused();
      return slpRetryProviderCall(() => provider.chatComplete(...args), options);
    },
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Look the writing connection's host up once before a batch, with the same retries.
 *
 * Every model call looks the host up again, so a resolver that is down fails each Creator of a bulk
 * add one by one. Checked once, the batch stops with one clear reason instead. Returns null when the
 * host resolves, is an IP address or localhost, or fails for a reason the call itself should report.
 */
export async function slpCheckProviderHost(
  baseUrl: string,
  options: {
    lookup?: (host: string) => Promise<unknown>;
    delaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<{ host: string; code: SlpTransientDnsCode } | null> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  // Subscription providers use pseudo URLs ("claude-agent-sdk://local"); only a web host is looked up.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  if (!host || isIP(host) || host === "localhost") return null;
  const lookup = options.lookup ?? ((name: string) => dnsLookup(name, { all: true }));
  try {
    await slpRetryProviderCall(() => lookup(host), options);
    return null;
  } catch (error) {
    const code = slpTransientNetworkCode(error);
    return code ? { host, code } : null;
  }
}
