import { t } from "@/i18n/translation";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChartCandlestick,
  ChartNoAxesCombined,
  ChevronDown,
  Calculator,
  Maximize2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCandles, type Candle } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { compact, marketPrice, number, percent, price } from "@/utils/format";
import { AssetIcon, ResourceState } from "./ui";

type IndicatorKey = "ema9" | "ema21" | "ema50" | "ema200" | "vwap" | "bollinger" | "volume" | "rsi" | "macd" | "atr";
type IndicatorOptions = Record<IndicatorKey, boolean>;
type TechnicalCandle = Candle & {
  ema9: number | null; ema21: number | null; ema50: number | null; ema200: number | null;
  vwap: number | null; bbUpper: number | null; bbLower: number | null; rsi: number | null;
  macd: number | null; macdSignal: number | null; macdHistogram: number | null; atr: number | null;
};

const TIMEFRAME_MS: Record<string, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1D": 86_400_000 };

function emaSeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period || period < 1) return result;
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = previous;
  const factor = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    previous = values[i] * factor + previous * (1 - factor);
    result[i] = previous;
  }
  return result;
}

function emaNullable(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = Array(values.length).fill(null);
  let seed: number[] = [];
  let previous: number | null = null;
  const factor = 2 / (period + 1);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) {
      if (previous == null) seed = [];
      continue;
    }
    if (previous == null) {
      seed.push(value);
      if (seed.length === period) {
        previous = seed.reduce((sum, item) => sum + item, 0) / period;
        result[i] = previous;
      }
    } else {
      previous = value * factor + previous * (1 - factor);
      result[i] = previous;
    }
  }
  return result;
}

function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = Array(closes.length).fill(null);
  if (closes.length <= period) return result;
  let gain = 0; let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    gain += Math.max(0, change); loss += Math.max(0, -change);
  }
  gain /= period; loss /= period;
  const value = () => loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  result[period] = value();
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(0, change)) / period;
    loss = (loss * (period - 1) + Math.max(0, -change)) / period;
    result[i] = value();
  }
  return result;
}

function technicalSeries(candles: Candle[]): TechnicalCandle[] {
  const closes = candles.map((candle) => candle.close);
  const ema9 = emaSeries(closes, 9), ema21 = emaSeries(closes, 21), ema50 = emaSeries(closes, 50), ema200 = emaSeries(closes, 200);
  const ema12 = emaSeries(closes, 12), ema26 = emaSeries(closes, 26);
  const macd = closes.map((_, index) => ema12[index] != null && ema26[index] != null ? ema12[index]! - ema26[index]! : null);
  const macdSignal = emaNullable(macd, 9);
  const rsi = rsiSeries(closes, 14);
  const trueRanges = candles.map((candle, index) => index === 0 ? candle.high - candle.low : Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - candles[index - 1].close),
    Math.abs(candle.low - candles[index - 1].close),
  ));
  const atr: (number | null)[] = Array(candles.length).fill(null);
  if (trueRanges.length >= 14) {
    let runningAtr = trueRanges.slice(0, 14).reduce((sum, item) => sum + item, 0) / 14;
    atr[13] = runningAtr;
    for (let i = 14; i < trueRanges.length; i++) { runningAtr = (runningAtr * 13 + trueRanges[i]) / 14; atr[i] = runningAtr; }
  }
  let volumeTotal = 0, volumePriceTotal = 0;
  const vwap = candles.map((candle) => {
    volumePriceTotal += ((candle.high + candle.low + candle.close) / 3) * candle.volume;
    volumeTotal += candle.volume;
    return volumeTotal > 0 ? volumePriceTotal / volumeTotal : null;
  });
  const bbUpper: (number | null)[] = Array(candles.length).fill(null);
  const bbLower: (number | null)[] = Array(candles.length).fill(null);
  for (let i = 19; i < closes.length; i++) {
    const sample = closes.slice(i - 19, i + 1);
    const average = sample.reduce((sum, item) => sum + item, 0) / sample.length;
    const deviation = Math.sqrt(sample.reduce((sum, item) => sum + (item - average) ** 2, 0) / sample.length) * 2;
    bbUpper[i] = average + deviation; bbLower[i] = average - deviation;
  }
  return candles.map((candle, i) => ({
    ...candle, ema9: ema9[i], ema21: ema21[i], ema50: ema50[i], ema200: ema200[i], vwap: vwap[i],
    bbUpper: bbUpper[i], bbLower: bbLower[i], rsi: rsi[i], macd: macd[i], macdSignal: macdSignal[i], atr: atr[i],
    macdHistogram: macd[i] != null && macdSignal[i] != null ? macd[i]! - macdSignal[i]! : null,
  }));
}

function mergeLivePrice(candles: Candle[], livePrice: number | undefined, timeframe: string): Candle[] {
  if (!candles.length || !Number.isFinite(livePrice) || !livePrice || livePrice <= 0) return candles;
  const result = candles.map((candle) => ({ ...candle }));
  const duration = TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS["1h"];
  const activeStart = Math.floor(Date.now() / duration) * duration;
  const activeIndex = result.findIndex((candle) => candle.timestamp === activeStart);
  // The open historical candle follows the same WebSocket last price shown above the chart.
  // A closed candle stays immutable; the live reference line below remains authoritative.
  if (activeIndex >= 0) {
    result[activeIndex].close = livePrice;
    result[activeIndex].high = Math.max(result[activeIndex].high, livePrice);
    result[activeIndex].low = Math.min(result[activeIndex].low, livePrice);
  }
  return result;
}

function lineSegments(data: TechnicalCandle[], key: keyof TechnicalCandle, xFor: (index: number) => number, yFor: (value: number) => number): string[] {
  const segments: string[] = []; let points: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const value = data[i][key];
    if (typeof value === "number" && Number.isFinite(value)) points.push(`${xFor(i)},${yFor(value)}`);
    else { if (points.length > 1) segments.push(points.join(" ")); points = []; }
  }
  if (points.length > 1) segments.push(points.join(" "));
  return segments;
}

function IndicatorPane({ data, mode }: { data: TechnicalCandle[]; mode: "rsi" | "macd" | "atr" }) {
  if (data.length < 2) return null;
  const width = 700, height = 90, left = 8, right = 8, top = 8, plotWidth = width - left - right, plotHeight = height - 16;
  const xFor = (index: number) => left + index / Math.max(1, data.length - 1) * plotWidth;
  const values = data.flatMap((item) => mode === "rsi" ? [item.rsi].filter((v): v is number => v != null) : mode === "atr" ? [item.atr].filter((v): v is number => v != null) : [item.macd, item.macdSignal, item.macdHistogram].filter((v): v is number => v != null));
  const bound = mode === "rsi" ? 100 : Math.max(...values.map(Math.abs), 0.000001) * 1.12;
  const yFor = (value: number) => mode === "rsi" ? top + (1 - value / 100) * plotHeight : mode === "atr" ? top + (1 - value / bound) * plotHeight : top + plotHeight / 2 - value / bound * (plotHeight / 2);
  const path = (key: keyof TechnicalCandle) => lineSegments(data, key, xFor, yFor);
  return <div className="indicator-pane">
    <div className="indicator-pane-title"><strong>{mode === "rsi" ? "RSI 14" : mode === "atr" ? "ATR 14" : "MACD 12 · 26 · 9"}</strong><span>{mode === "rsi" ? "30 / 50 / 70" : mode === "atr" ? `${t("Volatilidad")} · ${data[data.length - 1]?.atr == null ? "—" : price(data[data.length - 1].atr!)}` : t("Línea · señal · histograma")}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={t(mode === "rsi" ? "RSI de 14 periodos" : mode === "atr" ? "ATR de 14 periodos" : "MACD 12 26 9")}>
      {mode === "rsi" ? [30, 50, 70].map((level) => <g key={level}><line x1={left} x2={width - right} y1={yFor(level)} y2={yFor(level)} className={level === 50 ? "chart-grid" : "indicator-threshold"} /><text x={width - right} y={yFor(level) - 2} textAnchor="end" className="chart-axis">{level}</text></g>) : mode === "macd" ? <line x1={left} x2={width - right} y1={yFor(0)} y2={yFor(0)} className="chart-grid" /> : null}
      {mode === "rsi" ? path("rsi").map((points, i) => <polyline key={i} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.6" />) : mode === "atr" ? path("atr").map((points, i) => <polyline key={i} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.6" />) : <>
        {data.map((item, i) => { if (item.macdHistogram == null) return null; const x = xFor(i), zero = yFor(0), valueY = yFor(item.macdHistogram); return <rect key={item.timestamp} x={x - Math.max(.6, plotWidth / data.length * .3)} y={Math.min(zero, valueY)} width={Math.max(1, plotWidth / data.length * .6)} height={Math.max(.7, Math.abs(valueY - zero))} fill={item.macdHistogram >= 0 ? "var(--green)" : "var(--red)"} opacity=".55" />; })}
        {path("macd").map((points, i) => <polyline key={`m${i}`} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.5" />)}
        {path("macdSignal").map((points, i) => <polyline key={`s${i}`} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.4" />)}
      </>}
    </svg>
  </div>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type ChartGesture = {
  mode: "pan" | "scale" | "scale-pan" | "resize" | "pinch";
  pointerId: number;
  startX: number;
  startY: number;
  start: number;
  startCount: number;
  startPan: number;
  startHeight: number;
  startZoom: number;
  startDistance?: number;
  anchorFraction?: number;
  anchorIndex?: number;
};

function Candles({ data, livePrice, timeframe, view, indicators, tradeLevels }: {
  data: TechnicalCandle[]; livePrice?: number; timeframe: string; view: "candles" | "line"; indicators: IndicatorOptions;
  tradeLevels?: { entry: number; stop: number; target: number; direction: "LONG" | "SHORT" };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(320);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [requestedStart, setRequestedStart] = useState<number | null>(null);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [verticalPan, setVerticalPan] = useState(0);
  const gestureRef = useRef<ChartGesture | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(270, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!data.length) return null;
  // Auto zoom: aim for ~7px per candle so bodies stay readable on narrow phone screens.
  const autoCount = clamp(Math.round((width - 94 - 18) / 7), 24, 60);
  const count = clamp(visibleCount ?? autoCount, Math.min(12, data.length), data.length);
  const maxStart = Math.max(0, data.length - count);
  const viewStart = requestedStart == null ? maxStart : clamp(requestedStart, 0, maxStart);
  const visibleData = data.slice(viewStart, viewStart + count);
  const chartWidth = width - 94;
  const duration = TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS["1h"];
  const activeStart = Math.floor(Date.now() / duration) * duration;
  const latest = data[data.length - 1];
  const liveValue = typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0 ? livePrice : null;
  const showLiveLine = liveValue != null && viewStart + visibleData.length >= data.length;
  const lows = visibleData.map((item) => item.low), highs = visibleData.map((item) => item.high);
  if (showLiveLine && liveValue != null) { lows.push(liveValue); highs.push(liveValue); }
  const visibleKeys: (keyof TechnicalCandle)[] = [];
  if (indicators.ema9) visibleKeys.push("ema9");
  if (indicators.ema21) visibleKeys.push("ema21");
  if (indicators.ema50) visibleKeys.push("ema50");
  if (indicators.ema200) visibleKeys.push("ema200");
  if (indicators.vwap) visibleKeys.push("vwap");
  if (indicators.bollinger) visibleKeys.push("bbUpper", "bbLower");
  for (const key of visibleKeys) for (const item of visibleData) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) { lows.push(value); highs.push(value); }
  }
  // Include trade levels in the visible scale only when they are near the price action,
  // so a typo in an input cannot flatten the entire market chart.
  const baseLow = Math.min(...lows), baseHigh = Math.max(...highs);
  const baseSpan = Math.max(baseHigh - baseLow, Math.abs(baseHigh) * 0.0002, 1e-8);
  if (tradeLevels && [tradeLevels.entry, tradeLevels.stop, tradeLevels.target].every(Number.isFinite)) {
    for (const value of [tradeLevels.entry, tradeLevels.stop, tradeLevels.target]) {
      if (value >= baseLow - baseSpan * 2 && value <= baseHigh + baseSpan * 2) { lows.push(value); highs.push(value); }
    }
  }
  const rawMin = Math.min(...lows), rawMax = Math.max(...highs);
  const baseRange = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.0002, 1e-8);
  const center = (rawMin + rawMax) / 2 + verticalPan * baseRange;
  const span = baseRange / verticalZoom;
  const pad = Math.max(span * 0.055, Math.abs(center) * 0.00005);
  const min = center - span / 2 - pad, max = center + span / 2 + pad;
  const plotTop = 14;
  const plotBottom = height - 70;
  const volumeBottom = height - 23;
  const volumeTop = plotBottom + 10;
  const volumeHeight = Math.max(12, volumeBottom - volumeTop);
  const y = (value: number) => plotTop + (1 - (value - min) / (max - min || 1)) * (plotBottom - plotTop);
  const step = (chartWidth - 18) / visibleData.length;
  const xFor = (index: number) => 9 + step * index + step * 0.35;
  const volumeMax = Math.max(1, ...visibleData.map((item) => item.volume));
  const hoverIndex = hover == null ? visibleData.length - 1 : clamp(hover, 0, visibleData.length - 1);
  const selected = visibleData[hoverIndex];
  const tickPositions = width < 450
    ? [0, Math.floor((visibleData.length - 1) / 2), visibleData.length - 1]
    : [0, Math.floor((visibleData.length - 1) / 4), Math.floor((visibleData.length - 1) / 2), Math.floor(3 * (visibleData.length - 1) / 4), visibleData.length - 1];
  const ticks = [...new Set(tickPositions)];
  const path = (key: keyof TechnicalCandle) => lineSegments(visibleData, key, xFor, y);
  const linePoints = visibleData.map((item, index) => `${xFor(index)},${y(item.close)}`).join(" ");
  const activeCandle = latest.timestamp === activeStart;
  const resetView = () => {
    setVisibleCount(null);
    setRequestedStart(null);
    setVerticalZoom(1);
    setVerticalPan(0);
    setHover(null);
  };
  const beginChartPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const centerX = ((points[0].x + points[1].x) / 2 - rect.left) / rect.width * width;
      const fraction = clamp((centerX - 9) / Math.max(1, chartWidth - 18), 0, 1);
      gestureRef.current = {
        mode: "pinch", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        start: viewStart, startCount: count, startPan: verticalPan, startHeight: height, startZoom: verticalZoom,
        startDistance: Math.max(1, distance), anchorFraction: fraction, anchorIndex: viewStart + fraction * count,
      };
    } else {
      const localX = (event.clientX - rect.left) / rect.width * width;
      const mode: ChartGesture["mode"] = localX >= chartWidth ? event.shiftKey ? "scale-pan" : "scale" : "pan";
      gestureRef.current = {
        mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        start: viewStart, startCount: count, startPan: verticalPan, startHeight: height, startZoom: verticalZoom,
      };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setHover(null);
  };
  const moveChartPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (gesture?.mode === "pinch") {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...pointersRef.current.values()].slice(0, 2);
      if (points.length === 2) {
        const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
        const nextCount = clamp(Math.round(gesture.startCount * (gesture.startDistance ?? distance) / distance), Math.min(12, data.length), data.length);
        const fraction = gesture.anchorFraction ?? 0.5;
        const anchor = gesture.anchorIndex ?? viewStart + fraction * count;
        setVisibleCount(nextCount);
        setRequestedStart(clamp(Math.round(anchor - fraction * nextCount), 0, Math.max(0, data.length - nextCount)));
      }
      event.preventDefault();
      return;
    }
    if (gesture && gesture.pointerId === event.pointerId) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (gesture.mode === "pan") {
        const rect = event.currentTarget.getBoundingClientRect();
        const barsMoved = Math.round(-dx / rect.width * width / Math.max(step, 0.25));
        setRequestedStart(clamp(gesture.start + barsMoved, 0, Math.max(0, data.length - gesture.startCount)));
      } else if (gesture.mode === "scale") {
        setVerticalZoom(clamp(gesture.startZoom * Math.exp(-dy / 150), 0.25, 12));
      } else if (gesture.mode === "scale-pan") {
        setVerticalPan(clamp(gesture.startPan + dy / Math.max(100, plotBottom - plotTop), -10, 10));
      }
      event.preventDefault();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * width;
    const index = Math.floor((x - 9) / Math.max(step, 0.1));
    setHover(clamp(index, 0, visibleData.length - 1));
  };
  const endChartPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (gestureRef.current?.mode === "pinch") {
      const remaining = [...pointersRef.current.entries()][0];
      if (remaining) {
        gestureRef.current = { mode: "pan", pointerId: remaining[0], startX: remaining[1].x, startY: remaining[1].y, start: viewStart, startCount: count, startPan: verticalPan, startHeight: height, startZoom: verticalZoom };
      } else gestureRef.current = null;
    } else if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
  };
  const zoomAtPointer = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / rect.width * width;
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const delta = event.shiftKey ? event.deltaY : event.deltaX;
      const barsMoved = Math.round(delta / 22);
      setRequestedStart(clamp(viewStart + barsMoved, 0, Math.max(0, data.length - count)));
      return;
    }
    if (localX >= chartWidth) {
      setVerticalZoom((zoom) => clamp(zoom * (event.deltaY > 0 ? 0.9 : 1.11), 0.25, 12));
      return;
    }
    const fraction = clamp((localX - 9) / Math.max(1, chartWidth - 18), 0, 1);
    const anchor = viewStart + fraction * count;
    const nextCount = clamp(Math.round(count * (event.deltaY > 0 ? 1.18 : 0.85)), Math.min(12, data.length), data.length);
    const nextStart = clamp(Math.round(anchor - fraction * nextCount), 0, Math.max(0, data.length - nextCount));
    setVisibleCount(nextCount);
    setRequestedStart(nextStart);
    setHover(null);
  };
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    gestureRef.current = { mode: "resize", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, start: viewStart, startCount: count, startPan: verticalPan, startHeight: height, startZoom: verticalZoom };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.mode !== "resize" || gesture.pointerId !== event.pointerId) return;
    setHeight(clamp(gesture.startHeight + event.clientY - gesture.startY, 220, 720));
    event.preventDefault();
  };
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gestureRef.current?.mode === "resize" && gestureRef.current.pointerId === event.pointerId) gestureRef.current = null;
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
  };

  return <div className="candles-wrap" ref={container}>
    <div className="ohlc-line">
      <span>O <b>{price(selected.open)}</b></span><span>H <b>{price(selected.high)}</b></span><span>L <b>{price(selected.low)}</b></span>
      <span>C <b className={selected.close >= selected.open ? "positive" : "negative"}>{price(selected.close)}</b></span>
      {indicators.volume && <span className="chart-volume">Vol <b>{compact(selected.volume)}</b></span>}
      {liveValue != null && <span className="chart-live-reading"><span className="live-dot" /> LIVE <b>{marketPrice(liveValue)}</b></span>}
    </div>
    <div className="chart-interaction-hint">{t("Arrastra para desplazarte · rueda/pellizco para zoom · arrastra la escala de precios a la derecha · usa la agarradera inferior para cambiar la altura")}</div>
    <svg className="candle-chart" style={{ height }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${t(view === "candles" ? "Velas" : "Línea de precio")}; ${t("gráfico interactivo con zoom y desplazamiento")}`} tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); setRequestedStart(clamp(viewStart - 3, 0, maxStart)); }
        if (event.key === "ArrowRight") { event.preventDefault(); setRequestedStart(clamp(viewStart + 3, 0, maxStart)); }
        if (event.key === "+" || event.key === "=") { event.preventDefault(); setVisibleCount(Math.max(Math.min(12, data.length), Math.round(count * 0.85))); }
        if (event.key === "-") { event.preventDefault(); setVisibleCount(Math.min(data.length, Math.round(count * 1.18))); }
        if (event.key === "Home") { event.preventDefault(); resetView(); }
      }}
      onPointerDown={beginChartPointer}
      onPointerMove={moveChartPointer}
      onPointerUp={endChartPointer}
      onPointerCancel={endChartPointer}
      onPointerLeave={() => { if (!gestureRef.current) setHover(null); }}
      onWheel={zoomAtPointer}>
      {[0, 1, 2, 3, 4].map((tick) => { const value = min + (max - min) * tick / 4; return <g key={tick}><line x1="0" x2={chartWidth} y1={y(value)} y2={y(value)} className="chart-grid" /><text x={chartWidth + 13} y={y(value) + 3} className="chart-axis">{price(value)}</text></g>; })}
      {ticks.map((index) => <g key={index}><line x1={xFor(index)} x2={xFor(index)} y1="8" y2={height - 22} className="chart-grid chart-grid-vertical" /><text x={xFor(index)} y={height - 4} textAnchor={index === 0 ? "start" : index === visibleData.length - 1 ? "end" : "middle"} className="chart-axis">{timeframe === "1D" ? visibleData[index]?.time.slice(5, 10) : visibleData[index]?.time.slice(-5)}</text></g>)}
      <text x={chartWidth * 0.27} y={(plotTop + plotBottom) / 2} className="chart-watermark" style={{ fontSize: width < 450 ? 25 : 41 }}>KERYNTIX</text>
      {indicators.volume && visibleData.map((candle, index) => { const barHeight = candle.volume / volumeMax * Math.min(30, volumeHeight); const x = 9 + step * index; return <rect key={`vol-${candle.timestamp}`} x={x} y={volumeBottom - barHeight} width={Math.max(0.45, step * 0.7)} height={barHeight} fill={candle.close >= candle.open ? "var(--green)" : "var(--red)"} opacity=".34" rx=".5" />; })}
      {view === "candles" ? visibleData.map((candle, index) => { const x = 9 + step * index, up = candle.close >= candle.open; return <g key={candle.timestamp} className={up ? "candle-up" : "candle-down"}><line x1={x + step * 0.35} x2={x + step * 0.35} y1={y(candle.high)} y2={y(candle.low)} stroke="currentColor" strokeWidth="1" /><rect x={x} y={Math.min(y(candle.open), y(candle.close))} width={Math.max(0.6, step * 0.7)} height={Math.max(1.2, Math.abs(y(candle.open) - y(candle.close)))} fill="currentColor" rx=".7" /></g>; }) : <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />}
      {indicators.ema9 && path("ema9").map((points, i) => <polyline key={`ema9-${i}`} points={points} fill="none" stroke="var(--accent)" strokeWidth="1.6" />)}
      {indicators.ema21 && path("ema21").map((points, i) => <polyline key={`ema21-${i}`} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.6" />)}
      {indicators.ema50 && path("ema50").map((points, i) => <polyline key={`ema50-${i}`} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.6" />)}
      {indicators.ema200 && path("ema200").map((points, i) => <polyline key={`ema200-${i}`} points={points} fill="none" stroke="var(--red)" strokeWidth="1.6" />)}
      {indicators.vwap && path("vwap").map((points, i) => <polyline key={`vwap-${i}`} points={points} fill="none" stroke="var(--text-secondary)" strokeWidth="1.3" strokeDasharray="4 3" />)}
      {indicators.bollinger && <>{path("bbUpper").map((points, i) => <polyline key={`bb-u-${i}`} points={points} fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />)}{path("bbLower").map((points, i) => <polyline key={`bb-l-${i}`} points={points} fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />)}</>}
      {tradeLevels && <>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.entry)} y2={y(tradeLevels.entry)} stroke="var(--blue)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.entry) - 4)} fill="var(--blue)" fontSize="8">{t("ENTRADA ")}{price(tradeLevels.entry)}</text>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.stop)} y2={y(tradeLevels.stop)} stroke="var(--red)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.stop) - 4)} fill="var(--red)" fontSize="8">{t("STOP ")}{price(tradeLevels.stop)}</text>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.target)} y2={y(tradeLevels.target)} stroke="var(--green)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.target) - 4)} fill="var(--green)" fontSize="8">{t("OBJETIVO ")}{price(tradeLevels.target)}</text>
      </>}
      {showLiveLine && liveValue != null && <><line x1="0" x2={chartWidth} y1={y(liveValue)} y2={y(liveValue)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity=".95" /><rect x={chartWidth + 4} y={clamp(y(liveValue) - 10, 3, height - 27)} width="88" height="20" rx="3" fill="var(--accent)" /><text x={chartWidth + 48} y={clamp(y(liveValue) - 10, 3, height - 27) + 8} textAnchor="middle" fill="var(--accent-ink)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">{marketPrice(liveValue)}</text></>}
      {hover !== null && <><line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1="8" y2={height - 22} stroke="var(--text-secondary)" strokeDasharray="3 3" opacity=".65" /><circle cx={xFor(hoverIndex)} cy={y(selected.close)} r="3" fill="var(--accent)" /></>}
    </svg>
    <div className="chart-resize-handle" role="separator" aria-orientation="horizontal" aria-label={t("Cambiar altura del gráfico")} tabIndex={0}
      onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
      onKeyDown={(event) => { if (event.key === "ArrowUp") { event.preventDefault(); setHeight((value) => clamp(value - 20, 220, 720)); } if (event.key === "ArrowDown") { event.preventDefault(); setHeight((value) => clamp(value + 20, 220, 720)); } }}>
      <span /><small>{t("Arrastra para cambiar la altura")}</small><span />
    </div>
    {indicators.rsi && <IndicatorPane data={visibleData} mode="rsi" />}
    {indicators.macd && <IndicatorPane data={visibleData} mode="macd" />}
    {indicators.atr && <IndicatorPane data={visibleData} mode="atr" />}
    {!activeCandle && showLiveLine && liveValue != null && <p className="chart-data-note">{t("La línea LIVE refleja el precio WebSocket; la última vela del mercado está cerrada.")}</p>}
    <div className="chart-interaction-footer">
      <span>{t("Mostrando ")}{visibleData.length} {t("de ")}{data.length} {t("velas")}</span>
      <div className="chart-zoom-buttons">
        <button type="button" aria-label={t("Alejar gráfico")} title={t("Mostrar más velas")} onClick={() => { const next = clamp(Math.round(count * 1.2), Math.min(12, data.length), data.length); setVisibleCount(next); setRequestedStart(clamp(viewStart + count - next, 0, Math.max(0, data.length - next))); setHover(null); }}>−</button>
        <button type="button" aria-label={t("Acercar gráfico")} title={t("Mostrar menos velas")} onClick={() => { const next = clamp(Math.round(count * 0.8), Math.min(12, data.length), data.length); setVisibleCount(next); setRequestedStart(clamp(viewStart + count - next, 0, Math.max(0, data.length - next))); setHover(null); }}>+</button>
        <button type="button" onClick={resetView}>{t("Restablecer vista")}</button>
      </div>
    </div>
  </div>;
}
export function HistoryChart({
  data,
  dataKey = "r",
  xKey = "date",
  height = 205,
  color = "var(--accent)",
  label = "R acumulado",
  hideAxis = false,
}: {
  data: object[];
  dataKey?: string;
  xKey?: string;
  height?: number;
  color?: string;
  label?: string;
  hideAxis?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="history-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <AreaChart
          data={data}
          margin={{
            top: 16,
            right: hideAxis ? 0 : 10,
            bottom: 0,
            left: hideAxis ? 0 : -19,
          }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            hide={hideAxis}
            axisLine={false}
            tickLine={false}
            minTickGap={50}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            dy={7}
          />
          <YAxis
            hide={hideAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            tickFormatter={(value) =>
              Math.abs(Number(value)) >= 1000
                ? compact(Number(value))
                : number(Number(value), 0)
            }
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--text-secondary)" }}
            formatter={(value) => [number(Number(value)), label]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            animationDuration={550}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarketChart({
  initialSymbol = "BTCUSDT",
  panorama = false,
}: {
  initialSymbol?: string;
  panorama?: boolean;
}) {
  const { quotes, user } = useApp();
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState("1h");
  const [view, setView] = useState<"candles" | "line">(panorama ? "line" : "candles");
  const [indicators, setIndicators] = useState<IndicatorOptions>({
    ema9: true, ema21: true, ema50: false, ema200: false,
    vwap: false, bollinger: false, volume: true, rsi: false, macd: false,
  });
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<"LONG" | "SHORT">("LONG");
  const [capitalInput, setCapitalInput] = useState("1000");
  const [riskInput, setRiskInput] = useState("1");
  const [leverageInput, setLeverageInput] = useState("3");
  const [entryInput, setEntryInput] = useState("");
  const [stopInput, setStopInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const { data, loading, error, refresh } = useApi(
    () => getCandles(symbol, timeframe, user?.tz, 240),
    [symbol, timeframe, user?.tz],
  );
  // Candle history is separate from the live quote stream. Refresh it in the
  // background while the chart is visible so the chart does not stay frozen
  // on the initial snapshot. Never overlap requests or poll hidden tabs.
  const candleRefreshInFlight = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden" || candleRefreshInFlight.current) return;
      candleRefreshInFlight.current = true;
      void refresh().finally(() => { candleRefreshInFlight.current = false; });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, symbol, timeframe, user?.tz]);
  const quote = quotes.find((item) => item.symbol === symbol);
  // One source of truth for both the prominent quote and the chart live-price marker.
  const liveQuotePrice = typeof quote?.price === "number" && Number.isFinite(quote.price) && quote.price > 0
    ? quote.price
    : undefined;
  const quoteAgeMs = quote?.price_tick_at == null ? null : Math.max(0, clockNow - quote.price_tick_at);
  const quoteIsLive = quoteAgeMs != null && quoteAgeMs <= 8_000;
  const quoteIsRecent = quoteAgeMs != null && quoteAgeMs <= 20_000;
  const calculated = useMemo(() => technicalSeries(mergeLivePrice(data ?? [], quote?.price, timeframe)), [data, quote?.price, timeframe]);
  // Keep the full candle history available to chart pan/zoom; visible bars are windowed interactively.
  const chartData = useMemo(() => calculated, [calculated]);
  const positiveInput = (raw: string): number | null => { const value = Number(raw); return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null; };
  const entry = positiveInput(entryInput) ?? quote?.price ?? null;
  const defaultStop = entry == null ? null : entry * (tradeDirection === "LONG" ? 0.99 : 1.01);
  const defaultTarget = entry == null ? null : entry * (tradeDirection === "LONG" ? 1.02 : 0.98);
  const stop = positiveInput(stopInput) ?? defaultStop;
  const target = positiveInput(targetInput) ?? defaultTarget;
  const capital = positiveInput(capitalInput) ?? 0;
  const riskPercentRaw = Number(riskInput);
  const riskPercent = Number.isFinite(riskPercentRaw) ? Math.max(0, Math.min(100, riskPercentRaw)) : 0;
  const leverage = positiveInput(leverageInput) ?? 1;
  const levelsValid = entry != null && stop != null && target != null &&
    (tradeDirection === "LONG" ? stop < entry && target > entry : stop > entry && target < entry);
  const riskBudget = capital * (riskPercent > 0 ? riskPercent : 0) / 100;
  const quantity = levelsValid && entry != null && stop != null ? riskBudget / Math.abs(entry - stop) : 0;
  const notional = quantity * (entry ?? 0);
  const margin = notional / leverage;
  const reward = levelsValid && entry != null && target != null ? quantity * Math.abs(target - entry) : 0;
  const riskReward = levelsValid && entry != null && stop != null && target != null ? Math.abs(target - entry) / Math.abs(entry - stop) : 0;
  const tradeLevels = plannerOpen && levelsValid && entry != null && stop != null && target != null ? { entry, stop, target, direction: tradeDirection } : undefined;
  const toggleIndicator = (key: IndicatorKey) => setIndicators((current) => ({ ...current, [key]: !current[key] }));
  const controls: { key: IndicatorKey; label: string; color: string }[] = [
    { key: "ema9", label: "EMA 9", color: "var(--accent)" },
    { key: "ema21", label: "EMA 21", color: "var(--blue)" },
    { key: "ema50", label: "EMA 50", color: "var(--amber)" },
    { key: "ema200", label: "EMA 200", color: "var(--red)" },
    { key: "vwap", label: "VWAP*", color: "var(--text-secondary)" },
    { key: "bollinger", label: "Bandas BB", color: "var(--text-muted)" },
    { key: "volume", label: "Volumen", color: "var(--green)" },
    { key: "rsi", label: "RSI 14", color: "var(--blue)" },
    { key: "macd", label: "MACD", color: "var(--amber)" },
    { key: "atr", label: "ATR 14", color: "var(--amber)" },
  ];
  return (
    <section className={`chart-panel panel ${panorama ? "panorama-chart" : ""}`}>
      <div className="chart-heading">
        <div className="chart-pair">
          <AssetIcon symbol={symbol} size={34} />
          <div>
            <div className="symbol-select-wrap">
              <select aria-label={t("Par del gráfico")} value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                {quotes.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol.replace("USDT", " / USDT")}</option>)}
              </select>
              <ChevronDown size={13} />
            </div>
            <span>{t("Perpetuo ")}<span className="separator-dot">·</span> Binance Futures</span>
          </div>
        </div>
        <Link className="icon-button" title={t("Ver flujo del par")} aria-label={`Ver flujo de ${symbol}`} to={`/mercado/flujo/${symbol}`}>
          <Maximize2 size={15} />
        </Link>
      </div>
      <div className="chart-price-row">
        <div className={`chart-price ${quote?.price_direction === "up" ? "price-up" : quote?.price_direction === "down" ? "price-down" : ""}`}>{liveQuotePrice != null ? marketPrice(liveQuotePrice) : "—"}<span>USDT</span></div>
        {quote && <span className={`chart-change ${quote.change_pct == null ? "muted" : quote.change_pct >= 0 ? "positive" : "negative"}`}>
          <ArrowUpRight size={13} />{percent(quote.change_pct)}<span>24h</span>
        </span>}
        <span className={`chart-live-status ${quoteIsLive ? "is-live" : quoteIsRecent ? "is-recent" : "is-stale"}`} title={quoteAgeMs == null ? t("Todavía no se ha recibido un tick WebSocket para este símbolo") : `${t("Último tick WebSocket recibido hace")} ${(quoteAgeMs / 1000).toFixed(1)} ${t("s. Las velas históricas se actualizan cada 30 s; este indicador mide la conexión en vivo, no la antigüedad del snapshot REST.")}`}><span className="live-dot" />{t(quoteIsLive ? "Precio en vivo" : quoteAgeMs == null ? "Esperando tick" : quoteIsRecent ? "WebSocket lento" : "WebSocket sin datos")}</span>
      </div>
      <div className="chart-toolbar">
        <div className="timeframes" aria-label={t("Temporalidad del gráfico")}>
          {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => <button key={tf} className={tf === timeframe ? "active" : ""} aria-pressed={tf === timeframe} onClick={() => setTimeframe(tf)}>{tf}</button>)}
        </div>
        <div className="chart-view-toggle">
          <button className={view === "candles" ? "active" : ""} aria-label={t("Gráfico de velas")} aria-pressed={view === "candles"} title={t("Velas")} onClick={() => setView("candles")}><ChartCandlestick size={15} /></button>
          <button className={view === "line" ? "active" : ""} aria-label={t("Gráfico de línea")} aria-pressed={view === "line"} title={t("Línea")} onClick={() => setView("line")}><ChartNoAxesCombined size={15} /></button>
          <button className="icon-button chart-refresh" onClick={() => void refresh()} aria-label={t("Actualizar velas")} title={t("Actualizar velas")}><span className={loading ? "refresh-spinning" : "refresh-symbol"}>↻</span></button>
        </div>
      </div>
      <div className="chart-action-row">
        <button type="button" className={`indicator-toggle ${plannerOpen ? "active" : ""}`} aria-expanded={plannerOpen} onClick={() => setPlannerOpen((open) => !open)}><Calculator size={12} /> {t("Calcular operación")}</button>
        <span>{t("El precio LIVE sigue las cotizaciones del backend")}</span>
      </div>
      {plannerOpen && <div className="trade-calculator">
        <div className="trade-calculator-head"><strong>{t("Plan de operación")}</strong><span>{t("estimación, no envío de órdenes")}</span></div>
        <div className="trade-direction-row">
          <button type="button" className={tradeDirection === "LONG" ? "active long" : ""} onClick={() => setTradeDirection("LONG")} aria-pressed={tradeDirection === "LONG"}>LONG</button>
          <button type="button" className={tradeDirection === "SHORT" ? "active short" : ""} onClick={() => setTradeDirection("SHORT")} aria-pressed={tradeDirection === "SHORT"}>SHORT</button>
        </div>
        <div className="trade-input-grid">
          <label>{t("Entrada (USDT)")}<input type="number" min="0" step="any" value={entryInput} placeholder={entry == null ? t("Precio actual") : price(entry)} onChange={(event) => setEntryInput(event.target.value)} /></label>
          <label>{t("Stop loss (USDT)")}<input type="number" min="0" step="any" value={stopInput} placeholder={defaultStop == null ? t("Automático -1%") : price(defaultStop)} onChange={(event) => setStopInput(event.target.value)} /></label>
          <label>{t("Objetivo (USDT)")}<input type="number" min="0" step="any" value={targetInput} placeholder={defaultTarget == null ? t("Automático +2%") : price(defaultTarget)} onChange={(event) => setTargetInput(event.target.value)} /></label>
          <label>{t("Capital (USDT)")}<input type="number" min="0" step="any" value={capitalInput} onChange={(event) => setCapitalInput(event.target.value)} /></label>
          <label>{t("Riesgo (%)")}<input type="number" min="0" max="100" step="0.1" value={riskInput} onChange={(event) => setRiskInput(event.target.value)} /></label>
          <label>{t("Apalancamiento (x)")}<input type="number" min="1" step="1" value={leverageInput} onChange={(event) => setLeverageInput(event.target.value)} /></label>
        </div>
        <p className="trade-auto-note">{t("Si dejas el stop y el objetivo vacíos, se usan valores iniciales automáticos del 1% y 2% según LONG/SHORT. Puedes cambiarlos manualmente.")}</p>
        {levelsValid ? <div className="trade-result-grid">
          <div><span>{t("Riesgo estimado")}</span><strong>{number(riskBudget, 2)} USDT</strong></div>
          <div><span>{t("Tamaño")}</span><strong>{number(quantity, 5)} {t("unidades")}</strong></div>
          <div><span>{t("Exposición")}</span><strong>{number(notional, 2)} USDT</strong></div>
          <div><span>{t("Margen estimado")}</span><strong>{number(margin, 2)} USDT</strong></div>
          <div><span>{t("Beneficio al objetivo")}</span><strong className="positive">{number(reward, 2)} USDT</strong></div>
          <div><span>{t("Ratio R/B")}</span><strong>{number(riskReward, 2)} : 1</strong></div>
        </div> : <p className="trade-validation">{t("Revisa los niveles: en LONG el stop debe estar debajo de la entrada y el objetivo arriba; en SHORT, al revés.")}</p>}
        <p className="chart-disclaimer">{t("El cálculo no incluye comisiones, funding, deslizamiento ni precio de liquidación. No coloca operaciones en Binance.")}</p>
      </div>}
      <div className="indicator-controls" aria-label={t("Indicadores técnicos")}>
        {controls.map((control) => <button key={control.key} type="button" className={`indicator-toggle ${indicators[control.key] ? "active" : ""}`} aria-pressed={indicators[control.key]} onClick={() => toggleIndicator(control.key)} title={control.key === "vwap" ? t("VWAP calculado sobre las 300 velas cargadas") : t(control.label)}>
          <span className="indicator-swatch" style={{ background: control.color }} />{t(control.label)}
        </button>)}
      </div>
      <div className="indicator-legend">
        {controls.filter((control) => indicators[control.key] && ["ema9", "ema21", "ema50", "ema200", "vwap", "bollinger"].includes(control.key)).map((control) => {
          const last = chartData[chartData.length - 1];
          const key = control.key === "bollinger" ? null : control.key as keyof TechnicalCandle;
          const value = key && last ? last[key] : null;
          return <span key={control.key}><i style={{ background: control.color }} />{t(control.label)}{typeof value === "number" ? ` ${price(value)}` : ""}</span>;
        })}
      </div>
      {loading || error || !data ? <div className="chart-loading"><ResourceState loading={loading} error={error} retry={refresh} /></div> : chartData.length ? <Candles key={`${symbol}-${timeframe}`} data={chartData} livePrice={liveQuotePrice} timeframe={timeframe} view={view} indicators={indicators} tradeLevels={tradeLevels} /> : <div className="chart-loading slim-note">{t("No hay velas disponibles para este par.")}</div>}
      <div className="chart-footer">
        <span><span className="live-dot" />{t(view === "candles" ? "Velas OHLC" : "Precio de cierre")}{indicators.volume ? ` ${t("y volumen")}` : ""}</span>
        <span>Binance Futures <span className="separator-dot">·</span> {timeframe} <span className="separator-dot">·</span> {t("EMA/RSI/MACD locales")}</span>
      </div>
      <p className="chart-disclaimer">{t("Indicadores técnicos informativos; no garantizan resultados. VWAP* se calcula sobre las 300 velas cargadas, no sobre toda la sesión.")}</p>
    </section>
  );
}

