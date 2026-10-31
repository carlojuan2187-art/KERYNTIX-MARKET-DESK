import { apiRequest } from "./client";

interface VapidPublicKeyResponse {
  public_key: string;
  application_server_key?: string;
}
interface PushSubscriptionResponse {
  id: string;
  endpoint_origin: string;
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(padded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

function sameApplicationKey(current: ArrayBuffer | ArrayBufferView | null, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = current instanceof ArrayBuffer
    ? new Uint8Array(current)
    : new Uint8Array(current.buffer, current.byteOffset, current.byteLength);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export function supportsWebPush(): boolean {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function subscribeCurrentBrowserToPush(): Promise<void> {
  if (!supportsWebPush()) throw new Error("Este navegador no admite notificaciones push seguras.");
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Debes permitir las notificaciones del navegador para activarlas.");

  const keyResponse = await apiRequest<VapidPublicKeyResponse>("/push/vapid-public-key", { method: "GET" });
  const publicKey = keyResponse.public_key || keyResponse.application_server_key;
  if (!publicKey) throw new Error("El servicio Web Push todavía no está configurado en el servidor.");
  const applicationServerKey = base64UrlToUint8Array(publicKey);
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationKey(subscription.options.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Force an ArrayBuffer-backed view for browsers/TypeScript DOM versions
      // that reject Uint8Array<ArrayBufferLike> as BufferSource.
      applicationServerKey: new Uint8Array(applicationServerKey).buffer as ArrayBuffer,
    });
  }
  const body = subscription.toJSON();
  await apiRequest<PushSubscriptionResponse>("/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function unsubscribeCurrentBrowserFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await apiRequest<void>("/push/subscriptions/current", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } finally {
    // Even if the server is temporarily unavailable, stop this browser from receiving pushes.
    await subscription.unsubscribe();
  }
}

export async function currentBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}
