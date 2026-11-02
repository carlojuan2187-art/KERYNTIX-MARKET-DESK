/* KERYNTIX MARKET DESK Web Push worker. No market data or credentials are cached here. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "KERYNTIX MARKET DESK", body: "Tienes una nueva actualización." };
  }
  const title = String(payload.title || "KERYNTIX MARKET DESK").slice(0, 120);
  const body = String(payload.body || "Tienes una nueva actualización en KERYNTIX MARKET DESK.").slice(0, 240);
  const data = {
    url: typeof payload.url === "string" ? payload.url : "/",
    kind: typeof payload.kind === "string" ? payload.kind : "general",
    symbol: typeof payload.symbol === "string" ? payload.symbol : "",
  };
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/keryntix-mark-192.png",
    badge: "/keryntix-mark-32.png",
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 120) : `ftrade:${payload.id || Date.now()}`,
    data,
    renotify: false,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  let target = "/";
  try {
    const parsed = new URL(requested, self.location.origin);
    if (parsed.origin === self.location.origin) target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    target = "/";
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
    return undefined;
  })());
});
