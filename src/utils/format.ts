type NullableNumber = number | null | undefined;
function isFiniteNumber(value: NullableNumber): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function number(value: NullableNumber, digits = 2) {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
export function price(value: NullableNumber) {
  if (!isFiniteNumber(value)) return "—";
  return number(
    value,
    value >= 100 ? 2 : value >= 1 ? 3 : value >= 0.1 ? 4 : 6,
  );
}
export function compact(value: NullableNumber) {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1e9) return `${number(value / 1e9, 2)} mil M`;
  if (Math.abs(value) >= 1e6) return `${number(value / 1e6, 2)} M`;
  if (Math.abs(value) >= 1e3) return `${number(value / 1e3, 1)} mil`;
  return number(value);
}
export function percent(value: NullableNumber, digits = 2) {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${number(value, digits)}%`;
}
export function ago(date: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 60000),
  );
  return minutes < 1
    ? "Ahora"
    : minutes < 60
      ? `Hace ${minutes} min`
      : minutes < 1440
        ? `Hace ${Math.floor(minutes / 60)} h`
        : `Hace ${Math.floor(minutes / 1440)} d`;
}
export function dateTime(date: string, tz = "America/Havana") {
  return new Intl.DateTimeFormat("es", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
export function plainPrice(value: number) {
  return value.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 12,
  });
}
