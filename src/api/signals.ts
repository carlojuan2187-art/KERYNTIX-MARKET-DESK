import type { CancelReason, SignalState } from "./types";

export const cancelReasons: Record<CancelReason, string> = {
  ENTRY_NOT_TOUCHED:
    "La zona de entrada no se tocó dentro de los 15 minutos disponibles.",
  TP_REACHED_BEFORE_ENTRY:
    "El precio alcanzó el objetivo antes de tocar la entrada. La oportunidad ya pasó.",
  AMBIGUOUS_ENTRY_TP_ORDER:
    "No fue posible confirmar si se tocó primero la entrada o el objetivo.",
  PRE_ENTRY_INVALIDATED:
    "La estructura del mercado cambió y el setup dejó de ser válido antes de entrar.",
  AMBIGUOUS_ENTRY_SL_ORDER:
    "No fue posible confirmar el orden entre la entrada y el Stop Loss.",
  STALE_ENTRY_TOUCH:
    "El toque de entrada llegó demasiado tarde para validar el setup.",
  INVALID_GEOMETRY:
    "La relación entre entrada, Stop Loss y objetivos no cumple las reglas de riesgo.",
};
export function signalMetrics(signal: SignalState) {
  const hasEntry = typeof signal.entry_price === "number" && Number.isFinite(signal.entry_price) && signal.entry_price > 0;
  const hasStop = typeof signal.stop_loss === "number" && Number.isFinite(signal.stop_loss) && signal.stop_loss > 0;
  const entry = hasEntry ? signal.entry_price! : 0;
  const stop = hasStop ? signal.stop_loss! : null;
  const risk = hasEntry && stop != null ? Math.abs(entry - stop) : null;
  const direction = signal.direction === "LONG" ? 1 : -1;
  const targets = [signal.tp1, signal.tp2, signal.tp3]
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
    .map((target, index) => ({
      label: `TP${index + 1}`,
      price: target,
      distance_pct: hasEntry ? ((target - entry) / entry) * 100 : null,
      r: risk != null && risk > 0 && hasEntry ? ((target - entry) * direction) / risk : null,
    }));
  const rr = targets[1]?.r ?? targets[0]?.r ?? null;
  return {
    entry,
    risk,
    hasEntry,
    hasStop,
    hasRiskReward: rr != null,
    targets,
    rr,
    stop_distance_pct: hasEntry && stop != null ? ((stop - entry) / entry) * 100 : null,
  };
}
export function signalLabel(signal: SignalState) {
  if (signal.status === "CANCELLED")
    return { label: "Cancelada", tone: "muted" as const };
  if (signal.operation_result === "TP1_HIT")
    return { label: "TP1 alcanzado", tone: "green" as const };
  if (signal.status === "TOUCHED")
    return { label: "Entrada tocada", tone: "green" as const };
  return { label: "Pendiente", tone: "amber" as const };
}
