// ──────────────────────────────────────────────
// The Engine's API client, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Every package request goes through the Engine's own client (`__MARINARA_HOST__.api`): one admin secret header, one
// CSRF rule, one fallback notice, and one `ApiError` class, so `instanceof ApiError` holds for errors either side throws.
// The feature build stacks this file over the vendored module. On an Engine without it the package does not load.
import { requireHostMember } from "./marinara-host-bridge";

export interface ApiError extends Error {
  status: number;
  payload?: unknown;
}

interface ApiErrorConstructor {
  new (status: number, message: string, payload?: unknown): ApiError;
  readonly prototype: ApiError;
}

/** The Engine's `api` object, as package code calls it. */
export interface HostApiClient {
  raw: (path: string, init?: RequestInit) => Promise<Response>;
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  download: (path: string, fallbackFilename?: string, init?: RequestInit) => Promise<unknown>;
  downloadPost: (path: string, body: unknown, fallbackFilename?: string) => Promise<unknown>;
  streamEvents: (
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    options?: { disconnectOnResume?: boolean; resumeDisconnectGraceMs?: number },
  ) => AsyncGenerator<{ type: string; data: unknown } & Record<string, unknown>>;
  upload: <T>(path: string, formData: FormData) => Promise<T>;
}

interface HostApiModule {
  api: HostApiClient;
  ApiError: ApiErrorConstructor;
  getApiErrorMessage: (value: unknown, fallback: string) => string;
  isJsonRepairApiError: (error: unknown) => boolean;
}

const hostApi = requireHostMember<HostApiModule>("the API client", (host) => host.api);

export const api: HostApiClient = hostApi.api;
export const ApiError: ApiErrorConstructor = hostApi.ApiError;
export const getApiErrorMessage = hostApi.getApiErrorMessage;
export const isJsonRepairApiError = hostApi.isJsonRepairApiError;
