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
}
const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  const lastPriceWsValueBySymbol = useRef<Record<string, number>>({});
  const [signalCount, setSignalCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback(
    (title: string, kind: Toast["kind"] = "success", duration = 7000) => {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items.slice(-2), { id, title, kind }]);
      window.setTimeout(
        () => setToasts((items) => items.filter((t) => t.id !== id)),
        duration,
      );
    },
    [],
  );
  useEffect(() => {
    if (!user?.user_id) return;
    // Keep slower, non-price account counters refreshed independently. Price data
    // is handled by WebSocket; the conditional fallback below only polls when ticks
    // stop arriving, so a stale REST response cannot overwrite a newer live tick.
    const timer = window.setInterval(() => {
      void getSignals()
        .then((signals) => setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length))
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;
    let disposed = false;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (disposed || document.visibilityState === "hidden" || inFlight) return;
      // Normal market activity delivers price ticks at roughly one-second cadence.
      // If no tick reaches the browser for 2.5s, read the shared backend cache as a
      // fallback (the endpoint itself avoids REST calls while the feed is fresh).
      const now = Date.now();
      const staleSymbols = quotesRef.current
        .filter((quote) => now - (lastPriceWsTickAtBySymbol.current[quote.symbol] ?? 0) >= 2500)
        .map((quote) => quote.symbol);
      if (staleSymbols.length === 0) return;
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
  }, [user?.user_id]);

  useEffect(() => {
    void restoreAuthSession()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    void getQuotes()
      .then((latest) => {
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
    void getNotifications()
      .then(setNotifications)
      .catch(() => undefined);
    void getSignals()
      .then((signals) =>
        setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length),
      )
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!user) return;
    void getQuotes()
      .then((latest) => {
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
      .then((signals) => setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length))
      .catch(() => undefined);
  }, [user?.user_id]);
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
    if (!user?.user_id) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;

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
        socket = new WebSocket(endpoint.toString());
        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(String(message.data)) as WsEvent;
            if (event && typeof event.channel === "string" && typeof event.event === "string") emitWs(event);
          } catch {
            // Ignore malformed frames; the REST API remains the source of truth.
          }
        };
        socket.onclose = () => {
          if (!disposed) retryTimer = window.setTimeout(() => void connect(), 3000);
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (!disposed) retryTimer = window.setTimeout(() => void connect(), 5000);
      }
    }

    void connect();
    return () => {
      disposed = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [user?.user_id]);

  useEffect(
    () =>
      subscribeWs((event) => {
        if (event.channel === "signals") {
          const signal = event.payload as SignalState;
          void getSignals().then((signals) => setSignalCount(signals.filter((s) => s.status !== "CANCELLED").length)).catch(() => undefined);
          void getNotifications().then(setNotifications).catch(() => undefined);
          const label = event.event === "signal.new" ? "Nuevo setup" : event.event === "signal.touched" ? "Entrada tocada" : event.event === "signal.tp1" ? "TP1 alcanzado" : event.event === "signal.cancelled" ? "Señal cancelada" : `Operación cerrada ${signal.event?.result || ""}`;
          const title = `${signal.symbol} · ${label}`;
          toast(title, "info", 7000);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try { new Notification(title, { body: `${signal.direction} · evento confirmado por el backend`, tag: `${signal.id || signal.symbol}-${event.event}` }); } catch { /* Browser support varies. */ }
          }
          return;
        }
        if (event.channel === "prices") {
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
          void getNotifications().then(setNotifications).catch(() => undefined);
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
          void getNotifications().then(setNotifications).catch(() => undefined);
          if (!user || !hasAccess(user) || !user.alert_prefs.on || !user.alert_prefs[alert.kind]) return;
          const title = `AVISO · ${alert.symbol || "Mercado"}`;
          toast(title, "info", appConfig.alertDuration * 1000);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try { new Notification(title, { body: alert.text, tag: alert.id }); } catch { /* Browser support varies. */ }
          }
        }
      }),
    [user, toast],
  );
  function readNotification(id: string) {
    void markNotificationRead(id)
      .then(() => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)))
      .catch((error) => toast((error as Error).message || "No se pudo marcar como leída.", "error"));
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
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            {item.kind === "success" ? <Check size={17} /> : <Info size={17} />}
            <span>{item.title}</span>
            <button
              aria-label="Cerrar notificación"
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
