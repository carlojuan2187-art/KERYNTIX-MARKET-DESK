import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Check, Info, X } from "lucide-react";
import { getMe, getSignals, subscribeWs, emitWs, type TickData, type WsEvent } from "@/api";
import { apiRequest } from "@/api/client";
import { restoreAuthSession } from "@/api/account";
import {
  getNotifications,
  getQuotes,
  markNotificationRead,
  type AppNotification,
  type AssetQuote,
} from "@/api/terminal";
import type { AlertItem, SignalState, User } from "@/api/types";
import { hasAccess, nextAccountDeadline } from "@/api/access";
import { appConfig } from "@/api/config";
import { getStoredLanguage, translate, type Language } from "@/i18n/translation";

type Variant = "terminal" | "panorama";
type Theme = "dark" | "light";
interface Toast {
  id: number;
  title: string;
  kind: "success" | "info" | "error";
}
interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  variant: Variant;
  setVariant: (variant: Variant) => void;
  theme: Theme;
  toggleTheme: () => void;
  quotes: AssetQuote[];
  signalCount: number;
  notifications: AppNotification[];
  readNotification: (id: string) => void;
  toast: (title: string, kind?: Toast["kind"], duration?: number) => void;
  loading: boolean;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (value: string) => string;
}
const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());
  const t = useCallback((value: string) => translate(value, language), [language]);
  const [variant, updateVariant] = useState<Variant>(() =>
    localStorage.getItem("ftrade.variant") === "panorama"
      ? "panorama"
      : "terminal",
  );
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("ftrade.theme") === "light" ? "light" : "dark",
  );
  const [quotes, setQuotes] = useState<AssetQuote[]>([]);
  const quotesRef = useRef<AssetQuote[]>([]);
  useEffect(() => { quotesRef.current = quotes; }, [quotes]);
  // Timestamp of the last actual price tick received over the real-time channel.
  // It activates the short REST fallback only when the WebSocket is quiet/broken.
  const lastPriceWsTickAt = useRef(0);
  // Freshness is tracked per symbol: BTC activity must not mask a stalled ETH feed.
  const lastPriceWsTickAtBySymbol = useRef<Record<string, number>>({});
  const lastQuotesFallbackAt = useRef(0);
  const lastQuotesEventRefreshAt = useRef(0);
  const lastPriceWsValueBySymbol = useRef<Record<string, number>>({});
  const [signalCount, setSignalCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback(
    (title: string, kind: Toast["kind"] = "success", duration = 7000) => {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items.slice(-2), { id, title: translate(title, language), kind }]);
      window.setTimeout(
        () => setToasts((items) => items.filter((t) => t.id !== id)),
        duration,
      );
    },
    [language],
  );
  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    try { window.localStorage.setItem("ftrade.language", next); } catch { /* Browser storage may be disabled. */ }
    if (!user?.user_id) return;
    try {
      const updated = await apiRequest<User>("/auth/me", { method: "PATCH", body: JSON.stringify({ language: next }) });
      setUser(updated);
    } catch {
      // Keep the local preference even when account synchronization is temporarily unavailable.
    }
  }, [user?.user_id]);
  useEffect(() => {
    if (user?.language === "en" || user?.language === "es") {
      setLanguageState(user.language);
      try { window.localStorage.setItem("ftrade.language", user.language); } catch { /* Browser storage may be disabled. */ }
    }
  }, [user?.user_id, user?.language]);
  useEffect(() => {
    if (!user?.user_id || !hasAccess(user)) return;
    // Keep slower, non-price account counters refreshed independently. Price data
    // is handled by WebSocket; the conditional fallback below only polls when ticks
    // stop arriving, so a stale REST response cannot overwrite a newer live tick.
    const refreshCount = () => {
      // A tab may stay open across the exact trial/plan expiry boundary.
      // Stop background signal polling as soon as the entitlement expires.
      if (!hasAccess(user)) return;
      void getSignals()
        .then((signals) => setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length))
        .catch(() => undefined);
    };
    // Hidden tabs do not poll (signal events still arrive over the WebSocket);
    // the counter is refreshed as soon as the tab becomes visible again.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refreshCount();
    }, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.user_id, user?.plan, user?.plan_end, user?.trial_end, user?.is_admin, user?.banned, user?.ban_until]);

  useEffect(() => {
    if (!user?.user_id || !hasAccess(user)) return;
    let disposed = false;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (disposed || !hasAccess(user) || document.visibilityState === "hidden" || inFlight) return;
      // Normal market activity delivers price ticks at roughly one-second cadence.
      // If no tick reaches the browser for 2.5s, read the shared backend cache as a
      // fallback (the endpoint itself avoids REST calls while the feed is fresh).
      const now = Date.now();
      // The all-market stream only carries contracts that traded, so illiquid pairs
      // legitimately stay silent for long periods. Treating any silent pair as a
      // failure made every browser download the whole quote list every 2 s. Fallback
      // now triggers when (a) the stream as a whole is quiet, or (b) a liquid pair
      // (top 40 by volume, which trades constantly) went stale, at most every 10 s.
      const wsQuiet = now - lastPriceWsTickAt.current >= 2500;
      let needFallback = wsQuiet;
      if (!needFallback) {
        if (now - lastQuotesFallbackAt.current < 10_000) return;
        const liquid = [...quotesRef.current]
          .filter((quote) => typeof quote.volume_24h === "number")
          .sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0))
          .slice(0, 40);
        needFallback = liquid.some((quote) => now - (lastPriceWsTickAtBySymbol.current[quote.symbol] ?? 0) >= 2500);
      }
      if (!needFallback) return;
      lastQuotesFallbackAt.current = now;
      const startedAt = now;
      inFlight = true;
      void getQuotes()
        .then((latest) => {
          if (disposed) return;
          setQuotes((current) => {
            const currentBySymbol = new Map(current.map((quote) => [quote.symbol, quote]));
            const latestBySymbol = new Map(latest.map((quote) => [quote.symbol, quote]));
            const merged = current.map((currentQuote) => {
              const fallback = latestBySymbol.get(currentQuote.symbol);
              if (!fallback) return currentQuote;
              const lastWsAt = lastPriceWsTickAtBySymbol.current[currentQuote.symbol] ?? 0;
              // Never let a REST response started before a newer WebSocket tick overwrite it.
              if (lastWsAt > startedAt) return currentQuote;
              // REST may refresh a stalled symbol, but it must not erase the last tick
              // direction or pretend that the browser received a new live tick.
              return { ...fallback, price_direction: currentQuote.price_direction, price_tick_at: currentQuote.price_tick_at };
            });
            for (const fallback of latest) {
              if (!currentBySymbol.has(fallback.symbol)) merged.push(fallback);
            }
            return merged;
          });
        })
        .catch(() => undefined)
        .finally(() => { inFlight = false; });
    }, 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [user?.user_id, user?.plan, user?.plan_end, user?.trial_end, user?.is_admin, user?.banned, user?.ban_until]);

  useEffect(() => {
    let disposed = false;
    void restoreAuthSession()
      .then((me) => { if (!disposed) setUser(me); })
      .catch(() => { if (!disposed) setUser(null); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!user?.user_id || !hasAccess(user)) {
      setQuotes([]);
      setSignalCount(0);
      setNotifications([]);
      return;
    }
    let disposed = false;
    void getQuotes()
      .then((latest) => {
        if (disposed || !hasAccess(user)) return;
        setQuotes((current) => {
          const currentBySymbol = new Map(current.map((quote) => [quote.symbol, quote]));
          const latestSymbols = new Set(latest.map((quote) => quote.symbol));
          const merged = latest.map((fallback) => {
            const previous = currentBySymbol.get(fallback.symbol);
            if (!previous || !(lastPriceWsTickAtBySymbol.current[fallback.symbol] > 0)) return fallback;
            return { ...fallback, price: previous.price, price_direction: previous.price_direction, price_tick_at: previous.price_tick_at, sparkline: previous.sparkline };
          });
          return [...merged, ...current.filter((quote) => !latestSymbols.has(quote.symbol))];
        });
      })
      .catch(() => undefined);
    void getSignals()
      .then((signals) => { if (!disposed && hasAccess(user)) setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length); })
      .catch(() => undefined);
    if (user.alert_prefs?.in_app === false) {
      setNotifications([]);
    } else {
      void getNotifications()
        .then((items) => { if (!disposed && hasAccess(user)) setNotifications(items); })
        .catch(() => undefined);
    }
    return () => { disposed = true; };
  }, [user?.user_id, user?.plan, user?.plan_end, user?.trial_end, user?.is_admin, user?.banned, user?.ban_until, user?.alert_prefs?.in_app]);
  useEffect(() => {
    if (!user) return;
    const deadline = nextAccountDeadline(user);
    if (!deadline) return;
    // Browsers clamp longer delays to about 24.8 days.
    const delay = Math.min(Math.max(0, deadline - Date.now()) + 30, 2147000000);
    const timer = window.setTimeout(() => {
      setUser((current) => (current ? { ...current } : null));
    }, delay);
    return () => clearTimeout(timer);
  }, [user]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.variant = variant;
    localStorage.setItem("ftrade.theme", theme);
    localStorage.setItem("ftrade.variant", variant);
  }, [theme, variant]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "es"
      ? "KERYNTIX MARKET DESK | Inteligencia de mercado"
      : "KERYNTIX MARKET DESK | Intelligent Market Platform";
  }, [language]);
  useEffect(() => {
    if (!user?.user_id) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let pauseTimer: number | undefined;

    function sendPriceStreamState(enabled: boolean) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ op: "prices", enabled })); } catch { /* The close handler reconnects. */ }
      }
    }
    // A hidden tab keeps receiving signals, alerts and account events, but the heavy
    // all-market price stream is paused after 15 s and resumed when the tab returns
    // (the quote fallback below refreshes anything missed in the meantime).
    function onVisibilityChange() {
      if (pauseTimer !== undefined) { window.clearTimeout(pauseTimer); pauseTimer = undefined; }
      if (document.visibilityState === "hidden") {
        pauseTimer = window.setTimeout(() => sendPriceStreamState(false), 15_000);
      } else {
        lastQuotesFallbackAt.current = 0;
        sendPriceStreamState(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    async function connect() {
      try {
        const ticket = await apiRequest<{ ticket: string; websocket_path?: string }>("/events/ticket", { method: "POST" });
        if (disposed) return;
        const rawUrl = appConfig.websocketUrl || `${appConfig.apiUrl.replace(/^http/, "ws")}/ws/events`;
        if (!rawUrl) throw new Error("No se ha configurado el canal WebSocket.");
        const endpoint = new URL(rawUrl);
        if (!endpoint.pathname || endpoint.pathname === "/" || endpoint.pathname === "/live") {
          endpoint.pathname = ticket.websocket_path || "/ws/events";
        }
        endpoint.search = "";
        endpoint.searchParams.set("ticket", ticket.ticket);
        // batch=1: the server sends one "tick.batch" frame per snapshot instead of one
        // frame per symbol (far less bandwidth and CPU on both ends).
        endpoint.searchParams.set("batch", "1");
        const currentSocket = new WebSocket(endpoint.toString());
        socket = currentSocket;
        currentSocket.onopen = () => {
          // Reconnecting while hidden must not re-enable the heavy price stream.
          if (document.visibilityState === "hidden") sendPriceStreamState(false);
        };
        currentSocket.onmessage = (message) => {
          try {
            const event = JSON.parse(String(message.data)) as WsEvent;
            if (!event || typeof event.channel !== "string" || typeof event.event !== "string") return;
            if (event.channel === "prices" && event.event === "tick.batch") {
              if (!Array.isArray(event.payload)) return;
              // Re-emit as individual ticks so every existing listener keeps working.
              for (const row of event.payload as TickData[]) {
                emitWs({ channel: "prices", event: "tick", payload: row, ts: event.ts });
              }
              return;
            }
            emitWs(event);
          } catch {
            // Ignore malformed frames; the REST API remains the source of truth.
          }
        };
        currentSocket.onclose = () => {
          if (!disposed) retryTimer = window.setTimeout(() => void connect(), 3000);
        };
        currentSocket.onerror = () => currentSocket.close();
      } catch {
        if (!disposed) retryTimer = window.setTimeout(() => void connect(), 5000);
      }
    }

    void connect();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pauseTimer !== undefined) window.clearTimeout(pauseTimer);
      if (retryTimer != null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [user?.user_id]);

  useEffect(
    () =>
      subscribeWs((event) => {
        if (event.channel === "signals") {
          if (!user || !hasAccess(user)) return;
          const signal = event.payload as SignalState;
          void getSignals().then((signals) => setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length)).catch(() => undefined);
          // Keep live counters current, but honor the user's notification switches
          // before showing an in-app toast. OS notifications are delivered by the
          // backend Web Push worker to avoid duplicates while the tab is open.
          const signalAlertsEnabled = Boolean(
            user && hasAccess(user) && user.alert_prefs?.on && user.alert_prefs?.signals !== false,
          );
          if (!signalAlertsEnabled) return;
          const signalPrefs = user?.alert_prefs;
          const showInApp = Boolean(signalPrefs && signalPrefs.in_app !== false);
          if (showInApp) void getNotifications().then(setNotifications).catch(() => undefined);
          const label = event.event === "signal.new" ? t("Nuevo setup") : event.event === "signal.touched" ? t("Entrada tocada") : event.event === "signal.tp1" ? t("TP1 alcanzado") : event.event === "signal.cancelled" ? t("Señal cancelada") : `${t("Operación cerrada")} ${signal.event?.result || ""}`;
          const title = `${signal.symbol} · ${label}`;
          if (showInApp) toast(title, "info", 7000);
          // OS notifications are sent by the backend Web Push worker through
          // public/sw.js. Do not create a second Notification from the open tab:
          // that would duplicate the same push when this browser is active.
          return;
        }
        if (event.channel === "prices") {
          if (!user || !hasAccess(user)) return;
          const tick = event.payload as TickData;
          if (!tick || !tick.symbol) return;
          if (event.event === "tick") {
            const livePrice = tick.price;
            if (typeof livePrice !== "number" || !Number.isFinite(livePrice) || livePrice <= 0) return;
            const receivedAt = Date.now();
            lastPriceWsTickAt.current = receivedAt;
            lastPriceWsTickAtBySymbol.current[tick.symbol] = receivedAt;
            const previousLivePrice = lastPriceWsValueBySymbol.current[tick.symbol];
            lastPriceWsValueBySymbol.current[tick.symbol] = livePrice;
            setQuotes((items) => {
              let found = false;
              const updated = items.map((q) => {
                if (q.symbol !== tick.symbol) return q;
                found = true;
                const previousPrice = previousLivePrice ?? q.price;
                const direction = livePrice > previousPrice ? "up" : livePrice < previousPrice ? "down" : q.price_direction ?? "unchanged";
                const sparkline = [...(Array.isArray(q.sparkline) ? q.sparkline : [])];
                if (sparkline[sparkline.length - 1] !== livePrice) sparkline.push(livePrice);
                return {
                  ...q,
                  price: livePrice,
                  price_direction: direction,
                  price_tick_at: receivedAt,
                  change_pct: typeof tick.change_pct === "number" && Number.isFinite(tick.change_pct) ? tick.change_pct : q.change_pct,
                  volume_24h: typeof tick.volume_24h === "number" && Number.isFinite(tick.volume_24h) ? tick.volume_24h : q.volume_24h,
                  high_24h: typeof tick.high_24h === "number" && Number.isFinite(tick.high_24h) ? tick.high_24h : q.high_24h,
                  low_24h: typeof tick.low_24h === "number" && Number.isFinite(tick.low_24h) ? tick.low_24h : q.low_24h,
                  sparkline: sparkline.slice(-60),
                };
              });
              if (found) return updated;
              // A tick can arrive before the initial REST quote list. Keep it instead of
              // silently dropping it because the symbol is not in the current state yet.
              return [...updated, {
                symbol: tick.symbol,
                name: tick.symbol.replace(/USDT$/, ""),
                price: livePrice,
                price_direction: "unchanged",
                price_tick_at: receivedAt,
                change_pct: typeof tick.change_pct === "number" && Number.isFinite(tick.change_pct) ? tick.change_pct : null,
                volume_24h: typeof tick.volume_24h === "number" && Number.isFinite(tick.volume_24h) ? tick.volume_24h : null,
                high_24h: typeof tick.high_24h === "number" && Number.isFinite(tick.high_24h) ? tick.high_24h : null,
                low_24h: typeof tick.low_24h === "number" && Number.isFinite(tick.low_24h) ? tick.low_24h : null,
                funding_rate: null, open_interest: null, buy_pct: null, volume_ratio: null, score: null,
                trend: { "15M": null, "1H": null, "4H": null }, sparkline: [livePrice], liquidity_sweep: null,
              }];
            });
            return;
          }
          const fundingRate = tick.funding_rate;
          if (event.event === "funding.tick" && typeof fundingRate === "number" && Number.isFinite(fundingRate)) {
            setQuotes((items) => items.map((q) => q.symbol === tick.symbol ? { ...q, funding_rate: fundingRate } : q));
          }
          return;
        }
        if (event.channel === "market.liquidations" || event.channel === "market.movers") {
          if (!user || !hasAccess(user)) return;
          // Prices already stream over the WebSocket; this refresh only picks up
          // slow-moving enrichment fields, so one full download per 15 s is plenty
          // (liquidation events can arrive several times per second).
          if (Date.now() - lastQuotesEventRefreshAt.current < 15_000) return;
          lastQuotesEventRefreshAt.current = Date.now();
          const quotesRequestStartedAt = Date.now();
          void getQuotes().then((latest) => {
            setQuotes((current) => {
              const currentBySymbol = new Map(current.map((quote) => [quote.symbol, quote]));
              return latest.map((fallback) => {
                const previous = currentBySymbol.get(fallback.symbol);
                if (!previous) return fallback;
                const lastWsAt = lastPriceWsTickAtBySymbol.current[fallback.symbol] ?? 0;
                if (lastWsAt > quotesRequestStartedAt) return previous;
                return { ...fallback, price_direction: previous.price_direction, price_tick_at: previous.price_tick_at };
              });
            });
          }).catch(() => undefined);
          return;
        }
        if (event.channel === "account" && event.event === "plan.changed") {
          void getMe().then(setUser).catch(() => undefined);
          return;
        }
        if (event.channel === "account" && event.event === "ban.changed") {
          const payload = event.payload as { user_id?: string; banned?: boolean; ban_until?: string };
          if (user && (!payload.user_id || payload.user_id === user.user_id)) {
            setUser({ ...user, banned: Boolean(payload.banned), ban_until: payload.ban_until });
          }
          return;
        }
        if (event.channel === "alerts") {
          const alert = event.payload as AlertItem;
          const accessActive = Boolean(user && hasAccess(user));
          const isPlanNotice = alert.kind === "plans";
          if (!user || (!accessActive && !isPlanNotice)) return;
          // Expired users can receive renewal notices, but the protected inbox is
          // intentionally unavailable until access is restored.
          if (!user.alert_prefs.on || !user.alert_prefs[alert.kind]) return;
          const showInApp = user.alert_prefs.in_app !== false;
          if (accessActive && showInApp) void getNotifications().then(setNotifications).catch(() => undefined);
          const title = `${t("AVISO ·")} ${alert.symbol || t("Mercado")}`;
          if (showInApp) toast(title, "info", appConfig.alertDuration * 1000);
          // Web Push delivery is centralized in the service worker so a push
          // received with the tab open is not duplicated by a page notification.
        }
      }),
    [user, toast, t],
  );
  function readNotification(id: string) {
    void markNotificationRead(id)
      .then(() => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)))
      .catch((error) => toast(t((error as Error).message || "No se pudo marcar como leída."), "error"));
  }
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        loading,
        variant,
        setVariant: updateVariant,
        theme,
        toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        quotes,
        signalCount,
        notifications,
        readNotification,
        toast,
        language,
        setLanguage,
        t,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            {item.kind === "success" ? <Check size={17} /> : <Info size={17} />}
            <span>{item.title}</span>
            <button
              aria-label={t("Cerrar notificación")}
              onClick={() =>
                setToasts((items) => items.filter((t) => t.id !== item.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider es obligatorio.");
  return value;
}
