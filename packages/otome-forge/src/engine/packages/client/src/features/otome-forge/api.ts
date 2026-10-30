// ──────────────────────────────────────────────
// Otome Forge: requests to the package's routes, through the Engine's own API client
// ──────────────────────────────────────────────
// Every request carries `timeZone` and `debugMode` (in the query for GET, in the body for POST), so the server can work
// out the player's local day and log prompts in debug mode. A POST also says when the player reviews image prompts
// before they are sent, so the paints a story write starts wait for the tap instead. A failed route answers
// `{error, code?}`: the client shows the localized message for `code`; `error` is English text for logs, shown here
// only in debug mode.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api-client";
import { useOtomeProps } from "./props";
import type { OtomeErrorCode } from "./shared/api-types";

const ROUTE_PREFIX = "/otome-forge";

export interface RequestContext {
  timeZone: string;
  debugMode: boolean;
  /** The Engine's reviewImagePromptsBeforeSend (M2b): sent only when on. */
  reviewImagePrompts?: boolean;
}

export type QueryValues = Record<string, string | number | boolean | null | undefined>;
export type RequestBody = Record<string, unknown>;

export function otomeGet<T>(context: RequestContext, path: string, query: QueryValues = {}, init?: RequestInit) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(name, String(value));
  }
  params.set("timeZone", context.timeZone);
  params.set("debugMode", String(context.debugMode));
  return api.get<T>(`${ROUTE_PREFIX}${path}?${params.toString()}`, init);
}

export function otomePost<T>(context: RequestContext, path: string, body: RequestBody = {}, init?: RequestInit) {
  return api.post<T>(
    `${ROUTE_PREFIX}${path}`,
    {
      ...body,
      timeZone: context.timeZone,
      debugMode: context.debugMode,
      ...(context.reviewImagePrompts ? { reviewImagePrompts: true } : {}),
    },
    init,
  );
}

/** Every code the server sends, each with its message: a new code fails the typecheck until it has one. */
const ERROR_MESSAGE_KEYS: Record<OtomeErrorCode, string> = {
  "bad-request": "ui.otomeForge.errors.badRequest",
  "age-gate": "ui.otomeForge.errors.ageGate",
  "not-found": "ui.otomeForge.errors.notFound",
  conflict: "ui.otomeForge.errors.conflict",
  busy: "ui.otomeForge.errors.busy",
  locked: "ui.otomeForge.errors.locked",
  insufficient: "ui.otomeForge.errors.insufficient",
  declined: "ui.otomeForge.errors.declined",
  "bad-format": "ui.otomeForge.errors.badFormat",
  "no-connection": "ui.otomeForge.errors.noConnection",
};

function isErrorCode(value: unknown): value is OtomeErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_MESSAGE_KEYS, value);
}

/**
 * The message for a failed forge step's stored `error`: its route code's, "stopped" after a restart, or the generic
 * one. Each key is a literal, so the locale validator sees it.
 */
export function forgeStepErrorKey(error: string | undefined): string {
  if (isErrorCode(error)) return ERROR_MESSAGE_KEYS[error];
  return error === "stopped" ? "ui.otomeForge.setup.forgeStepStopped" : "ui.otomeForge.errors.unknown";
}

/** The route's error code, or null for a failure without one (network, host gate, a route that threw). */
export function otomeErrorCode(error: unknown): OtomeErrorCode | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload;
  const code = payload && typeof payload === "object" ? (payload as { code?: unknown }).code : undefined;
  return isErrorCode(code) ? code : null;
}

export function otomeErrorMessage(
  translate: (key: string) => string,
  error: unknown,
  options: { debugMode?: boolean; fallbackKey?: string } = {},
): string {
  const code = otomeErrorCode(error);
  const message = code
    ? translate(ERROR_MESSAGE_KEYS[code])
    : error instanceof ApiError && error.status === 403
      ? // The Engine's privileged gate: no admin access from this device.
        translate("ui.otomeForge.errors.adminAccess")
      : translate(options.fallbackKey ?? "ui.otomeForge.errors.unknown");
  const detail = error instanceof Error ? error.message.trim() : "";
  return options.debugMode && detail ? `${message} (${detail})` : message;
}

/** `get`, `post` and `errorMessage`, bound to the current host props. */
export function useOtomeApi() {
  const { timeZone, debugMode, reviewImagePromptsBeforeSend } = useOtomeProps();
  const { t } = useTranslation();
  return useMemo(() => {
    const context: RequestContext = { timeZone, debugMode, reviewImagePrompts: reviewImagePromptsBeforeSend };
    return {
      get: <T>(path: string, query?: QueryValues, init?: RequestInit) => otomeGet<T>(context, path, query, init),
      post: <T>(path: string, body?: RequestBody, init?: RequestInit) => otomePost<T>(context, path, body, init),
      saveImageAppearance: (runKey: string, li: string, identityLine: string) =>
        otomePost<{ identityLine: string }>(
          context,
          `/runs/${encodeURIComponent(runKey)}/lis/${encodeURIComponent(li)}/appearance`,
          { identityLine },
        ),
      errorMessage: (error: unknown, fallbackKey?: string) =>
        otomeErrorMessage((key) => t(key), error, { debugMode, fallbackKey }),
    };
  }, [debugMode, reviewImagePromptsBeforeSend, t, timeZone]);
}
