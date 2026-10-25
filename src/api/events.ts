export interface WsEvent {
  channel:
    | "signals"
    | "prices"
    | "market.liquidations"
    | "market.movers"
    | "alerts"
    | "account";
  event: string;
  payload: unknown;
  ts: string;
}
const listeners = new Set<(event: WsEvent) => void>();
export function subscribeWs(listener: (event: WsEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function emitWs(event: WsEvent) {
  listeners.forEach((listener) => listener(event));
}
export function listenerCount() {
  return listeners.size;
}
