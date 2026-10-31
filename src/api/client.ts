/** Small fetch client for the real FTrade API.
 * Access tokens are kept only in module memory. The refresh token lives in the
 * server-set HttpOnly cookie; because the web app and the API are on different
 * sites, browsers such as Safari, Brave or in-app browsers drop that cookie, so a
 * copy of the (rotating, revocable) refresh token is also kept in localStorage and
 * sent in the body of /auth/refresh. Without it the user would have to verify with
 * Telegram again on every reload.
 */
import { appConfig } from "./config";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload, fallback: string) {
    super(payload.message || fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

const REFRESH_STORAGE_KEY = "ftrade.rt";

function readStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null | undefined) {
  try {
    if (token) window.localStorage.setItem(REFRESH_STORAGE_KEY, token);
    else window.localStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the cookie may still work.
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

function urlFor(path: string) {
  const base = appConfig.apiUrl.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Falta VITE_API_URL. Configura la URL raíz del backend FastAPI antes de usar FTrade.",
    );
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorPayload = {};
  try {
    const value = await response.json();
    if (value && typeof value === "object") {
      const detail = (value as { detail?: unknown }).detail;
      if (detail && typeof detail === "object") {
        body = detail as ApiErrorPayload;
      } else if (typeof detail === "string") {
        body = { message: detail };
      } else {
        body = value as ApiErrorPayload;
      }
    }
  } catch {
    // A non-JSON response is turned into a regular HTTP error below.
  }
  const fallback = `La solicitud falló (HTTP ${response.status}).`;
  return new ApiError(response.status, body, fallback);
}

async function rawRequest<T>(
  path: string,
  init: RequestInit,
  token: string | null,
  timeoutMs = 9000,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");

  // A stalled Railway/API request must never leave a screen in a loading
  // skeleton forever. Keep the caller's signal when provided and impose a
  // hard upper bound on network + response-body time.
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) abortFromCaller();
    else callerSignal.addEventListener("abort", abortFromCaller, { once: true });
  }
  try {
    const response = await fetch(urlFor(path), {
      ...init,
      signal: controller.signal,
      headers,
      // Required for the refresh cookie. The cookie is HttpOnly and is never read here.
      credentials: "include",
    });

    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(response.status, {}, "El servidor devolvió una respuesta no válida.");
    }
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(`El servidor tardó demasiado en responder (${Math.round(timeoutMs / 1000)} s). Comprueba el backend o vuelve a intentarlo.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

/** Resolves to a new access token, or null when the session is definitively gone
 * (401). Network errors, timeouts and 5xx are thrown instead so that a temporary
 * backend hiccup never signs the user out or discards the stored refresh token. */
async function rotateAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const stored = readStoredRefreshToken();
      const result = await rawRequest<{ access_token: string; refresh_token?: string | null }>(
        "/auth/refresh",
        { method: "POST", ...(stored ? { body: JSON.stringify({ refresh_token: stored }) } : {}) },
        null,
        20000,
      );
      setAccessToken(result.access_token);
      if (result.refresh_token) setStoredRefreshToken(result.refresh_token);
      return result.access_token;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAccessToken();
        setStoredRefreshToken(null);
        return null;
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

const NO_REFRESH_RETRY = [
  "/auth/phone",
  "/auth/register",
  "/auth/login",
  "/auth/recover",
  "/auth/telegram-check",
  "/auth/verify",
  "/auth/resend",
  "/auth/refresh",
  "/auth/logout",
];

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const shouldTryRefresh =
    !NO_REFRESH_RETRY.some((item) => path === item || path.startsWith(`${item}?`));
  const firstToken = accessToken;
  try {
    return await rawRequest<T>(path, init, firstToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !shouldTryRefresh) {
      throw error;
    }
    let refreshed: string | null;
    try {
      refreshed = await rotateAccessToken();
    } catch {
      throw error;
    }
    if (!refreshed) throw error;
    return rawRequest<T>(path, init, refreshed);
  }
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function restoreApiSession<T>(): Promise<T | null> {
  // Retry transient failures (cold-started backend, flaky network) before giving
  // up; only a real 401 means "not signed in".
  let token: string | null = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      token = await rotateAccessToken();
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
  if (!token) return null;
  try {
    return await apiRequest<T>("/auth/me", { method: "GET" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAccessToken();
      return null;
    }
    throw error;
  }
}
