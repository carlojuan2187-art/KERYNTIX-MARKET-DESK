/** Small fetch client for the real FTrade API.
 * Access tokens are kept only in module memory; the refresh token remains in
 * the server-set HttpOnly cookie and is never read by JavaScript.
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
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");

  const response = await fetch(urlFor(path), {
    ...init,
    headers,
    // Required for the refresh cookie. The cookie is HttpOnly and is not
    // exposed to this client.
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
}

async function rotateAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await rawRequest<{ access_token: string }>(
        "/auth/refresh",
        { method: "POST" },
        null,
      );
      setAccessToken(result.access_token);
      return result.access_token;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

const NO_REFRESH_RETRY = [
  "/auth/phone",
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
    const refreshed = await rotateAccessToken();
    if (!refreshed) throw error;
    return rawRequest<T>(path, init, refreshed);
  }
}

export async function restoreApiSession<T>(): Promise<T | null> {
  const token = await rotateAccessToken();
  if (!token) return null;
  try {
    return await apiRequest<T>("/auth/me", { method: "GET" });
  } catch (error) {
    clearAccessToken();
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
