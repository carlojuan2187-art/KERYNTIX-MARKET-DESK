import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import { compact, number, percent, price } from "@/utils/format";
import { AssetIcon, ResourceState } from "./ui";

export function Sparkline({
  values,
  positive = true,
  width = 84,
  height = 30,
  fill = false,
}: {
  values: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map(
    (v, i) =>
      `${(i / (values.length - 1)) * width},${height - 4 - ((v - min) / (max - min || 1)) * (height - 8)}`,
  );
  return (
    <svg
      className={`sparkline ${positive ? "positive" : "negative"}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={`M${points.join(" L")} L${width},${height} L0,${height} Z`}
          fill={`url(#${id})`}
        />
      )}
      <path
        d={`M${points.join(" L")}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
    <div className="indicator-pane-title"><strong>{mode === "rsi" ? "RSI 14" : mode === "atr" ? "ATR 14" : "MACD 12 · 26 · 9"}</strong><span>{mode === "rsi" ? "30 / 50 / 70" : mode === "atr" ? `Volatilidad · ${data[data.length - 1]?.atr == null ? "—" : price(data[data.length - 1].atr!)}` : "Línea · señal · histograma"}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={mode === "rsi" ? "RSI de 14 periodos" : mode === "atr" ? "ATR de 14 periodos" : "MACD 12 26 9"}>
      {mode === "rsi" ? [30, 50, 70].map((level) => <g key={level}><line x1={left} x2={width - right} y1={yFor(level)} y2={yFor(level)} className={level === 50 ? "chart-grid" : "indicator-threshold"} /><text x={width - right} y={yFor(level) - 2} textAnchor="end" className="chart-axis">{level}</text></g>) : mode === "macd" ? <line x1={left} x2={width - right} y1={yFor(0)} y2={yFor(0)} className="chart-grid" /> : null}
      {mode === "rsi" ? path("rsi").map((points, i) => <polyline key={i} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.6" />) : mode === "atr" ? path("atr").map((points, i) => <polyline key={i} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.6" />) : <>
        {data.map((item, i) => { if (item.macdHistogram == null) return null; const x = xFor(i), zero = yFor(0), valueY = yFor(item.macdHistogram); return <rect key={item.timestamp} x={x - Math.max(.6, plotWidth / data.length * .3)} y={Math.min(zero, valueY)} width={Math.max(1, plotWidth / data.length * .6)} height={Math.max(.7, Math.abs(valueY - zero))} fill={item.macdHistogram >= 0 ? "var(--green)" : "var(--red)"} opacity=".55" />; })}
        {path("macd").map((points, i) => <polyline key={`m${i}`} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.5" />)}
        {path("macdSignal").map((points, i) => <polyline key={`s${i}`} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.4" />)}
      </>}
    </svg>
  </div>;
}

function Candles({ data, livePrice, timeframe, view, indicators, tradeLevels }: {
  data: TechnicalCandle[]; livePrice?: number; timeframe: string; view: "candles" | "line"; indicators: IndicatorOptions;
  tradeLevels?: { entry: number; stop: number; target: number; direction: "LONG" | "SHORT" };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(270, entry.contentRect.width)));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  if (!data.length) return null;
  const chartWidth = width - 94, height = 258;
  const duration = TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS["1h"];
  const activeStart = Math.floor(Date.now() / duration) * duration;
  const last = data[data.length - 1];
  const liveValue = typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0 ? livePrice : null;
  const lows = data.map((item) => item.low), highs = data.map((item) => item.high);
  if (liveValue != null) { lows.push(liveValue); highs.push(liveValue); }
  if (tradeLevels) { lows.push(tradeLevels.entry, tradeLevels.stop, tradeLevels.target); highs.push(tradeLevels.entry, tradeLevels.stop, tradeLevels.target); }
  const priceKeys: (keyof TechnicalCandle)[] = [];
  if (indicators.ema9) priceKeys.push("ema9"); if (indicators.ema21) priceKeys.push("ema21"); if (indicators.ema50) priceKeys.push("ema50"); if (indicators.ema200) priceKeys.push("ema200"); if (indicators.vwap) priceKeys.push("vwap");
  if (indicators.bollinger) priceKeys.push("bbUpper", "bbLower");
  for (const key of priceKeys) for (const item of data) { const value = item[key]; if (typeof value === "number") { lows.push(value); highs.push(value); } }
  const rawMin = Math.min(...lows), rawMax = Math.max(...highs);
  const pad = Math.max((rawMax - rawMin) * .055, rawMax * .0002), min = rawMin - pad, max = rawMax + pad;
  const y = (value: number) => 14 + (1 - (value - min) / (max - min || 1)) * 181;
  const step = (chartWidth - 18) / data.length;
  const xFor = (index: number) => 9 + step * index + step * .275;
  const volumeMax = Math.max(1, ...data.map((item) => item.volume));
  const selected = data[hover ?? data.length - 1];
  const tickPositions = width < 450 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, Math.floor((data.length - 1) / 4), Math.floor((data.length - 1) / 2), Math.floor(3 * (data.length - 1) / 4), data.length - 1];
  const ticks = [...new Set(tickPositions)];
  const path = (key: keyof TechnicalCandle) => lineSegments(data, key, xFor, y);
  const linePoints = data.map((item, index) => `${xFor(index)},${y(item.close)}`).join(" ") + (liveValue != null ? ` ${chartWidth - 2},${y(liveValue)}` : "");
  const activeCandle = last.timestamp === activeStart;
  return <div className="candles-wrap" ref={container}>
    <div className="ohlc-line">
      <span>O <b>{price(selected.open)}</b></span><span>H <b>{price(selected.high)}</b></span><span>L <b>{price(selected.low)}</b></span>
      <span>C <b className={selected.close >= selected.open ? "positive" : "negative"}>{price(selected.close)}</b></span>
      {indicators.volume && <span className="chart-volume">Vol <b>{compact(selected.volume)}</b></span>}
      {liveValue != null && <span className="chart-live-reading"><span className="live-dot" /> LIVE <b>{price(liveValue)}</b></span>}
    </div>
    <svg className="candle-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${view === "candles" ? "Velas" : "Línea de precio"}; último precio vivo del backend`} tabIndex={0}
      onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setHover((index) => Math.max(0, (index ?? data.length - 1) - 1)); } if (event.key === "ArrowRight") { event.preventDefault(); setHover((index) => Math.min(data.length - 1, (index ?? 0) + 1)); } }}
      onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * width; setHover(Math.max(0, Math.min(data.length - 1, Math.floor((x - 9) / Math.max(step, .1))))); }} onMouseLeave={() => setHover(null)}>
      {[0, 1, 2, 3, 4].map((tick) => { const value = min + (max - min) * tick / 4; return <g key={tick}><line x1="0" x2={chartWidth} y1={y(value)} y2={y(value)} className="chart-grid" /><text x={chartWidth + 13} y={y(value) + 3} className="chart-axis">{price(value)}</text></g>; })}
      {ticks.map((index) => <g key={index}><line x1={xFor(index)} x2={xFor(index)} y1="8" y2="237" className="chart-grid chart-grid-vertical" /><text x={xFor(index)} y="254" textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} className="chart-axis">{timeframe === "1D" ? data[index]?.time.slice(5, 10) : data[index]?.time.slice(-5)}</text></g>)}
      <text x={chartWidth * .27} y="118" className="chart-watermark" style={{ fontSize: width < 450 ? 25 : 41 }}>FTRADE</text>
      {indicators.volume && data.map((candle, index) => { const barHeight = candle.volume / volumeMax * 30, x = 9 + step * index; return <rect key={`vol-${candle.timestamp}`} x={x} y={237 - barHeight} width={Math.max(.45, step * .55)} height={barHeight} fill={candle.close >= candle.open ? "var(--green)" : "var(--red)"} opacity=".34" rx=".5" />; })}
      {view === "candles" ? data.map((candle, index) => { const x = 9 + step * index, up = candle.close >= candle.open; return <g key={candle.timestamp} className={up ? "candle-up" : "candle-down"}><line x1={x + step * .275} x2={x + step * .275} y1={y(candle.high)} y2={y(candle.low)} stroke="currentColor" strokeWidth="1" /><rect x={x} y={Math.min(y(candle.open), y(candle.close))} width={Math.max(.45, step * .55)} height={Math.max(1.2, Math.abs(y(candle.open) - y(candle.close)))} fill="currentColor" rx=".7" /></g>; }) : <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />}
      {indicators.ema9 && path("ema9").map((points, i) => <polyline key={`ema9-${i}`} points={points} fill="none" stroke="var(--accent)" strokeWidth="1.25" />)}
      {indicators.ema21 && path("ema21").map((points, i) => <polyline key={`ema21-${i}`} points={points} fill="none" stroke="var(--blue)" strokeWidth="1.25" />)}
      {indicators.ema50 && path("ema50").map((points, i) => <polyline key={`ema50-${i}`} points={points} fill="none" stroke="var(--amber)" strokeWidth="1.25" />)}
      {indicators.ema200 && path("ema200").map((points, i) => <polyline key={`ema200-${i}`} points={points} fill="none" stroke="var(--red)" strokeWidth="1.4" />)}
      {indicators.vwap && path("vwap").map((points, i) => <polyline key={`vwap-${i}`} points={points} fill="none" stroke="var(--text-secondary)" strokeWidth="1.3" strokeDasharray="4 3" />)}
      {indicators.bollinger && <>{path("bbUpper").map((points, i) => <polyline key={`bb-u-${i}`} points={points} fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />)}{path("bbLower").map((points, i) => <polyline key={`bb-l-${i}`} points={points} fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />)}</>}
      {tradeLevels && <>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.entry)} y2={y(tradeLevels.entry)} stroke="var(--blue)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.entry) - 4)} fill="var(--blue)" fontSize="8">ENTRADA {price(tradeLevels.entry)}</text>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.stop)} y2={y(tradeLevels.stop)} stroke="var(--red)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.stop) - 4)} fill="var(--red)" fontSize="8">STOP {price(tradeLevels.stop)}</text>
        <line x1="0" x2={chartWidth} y1={y(tradeLevels.target)} y2={y(tradeLevels.target)} stroke="var(--green)" strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
        <text x="5" y={Math.max(10, y(tradeLevels.target) - 4)} fill="var(--green)" fontSize="8">OBJETIVO {price(tradeLevels.target)}</text>
      </>}
      {liveValue != null && <><line x1="0" x2={chartWidth} y1={y(liveValue)} y2={y(liveValue)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity=".95" /><rect x={chartWidth + 4} y={Math.max(3, Math.min(232, y(liveValue) - 10))} width="88" height="20" rx="3" fill="var(--accent)" /><text x={chartWidth + 48} y={Math.max(3, Math.min(232, y(liveValue) - 10)) + 8} textAnchor="middle" fill="var(--accent-ink)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">{price(liveValue)}</text></>}
      {hover !== null && <><line x1={xFor(hover)} x2={xFor(hover)} y1="8" y2="237" stroke="var(--text-secondary)" strokeDasharray="3 3" opacity=".65" /><circle cx={xFor(hover)} cy={y(selected.close)} r="3" fill="var(--accent)" /></>}
    </svg>
    {indicators.rsi && <IndicatorPane data={data} mode="rsi" />}
    {indicators.macd && <IndicatorPane data={data} mode="macd" />}
    {indicators.atr && <IndicatorPane data={data} mode="atr" />}
    {!activeCandle && liveValue != null && <p className="chart-data-note">La línea LIVE refleja el precio WebSocket; la vela histórica está cerrada.</p>}
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
    () => getCandles(symbol, timeframe, user?.tz, 300),
    [symbol, timeframe, user?.tz],
  );
  const quote = quotes.find((item) => item.symbol === symbol);
  const calculated = useMemo(() => technicalSeries(mergeLivePrice(data ?? [], quote?.price, timeframe)), [data, quote?.price, timeframe]);
  // EMA200 needs warm-up history. Draw only the newest 120 bars for legibility on mobile.
  const chartData = useMemo(() => calculated.slice(-120), [calculated]);
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
              <select aria-label="Par del gráfico" value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                {quotes.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol.replace("USDT", " / USDT")}</option>)}
              </select>
              <ChevronDown size={13} />
            </div>
            <span>Perpetuo <span className="separator-dot">·</span> Binance Futures</span>
          </div>
        </div>
        <Link className="icon-button" title="Ver flujo del par" aria-label={`Ver flujo de ${symbol}`} to={`/mercado/flujo/${symbol}`}>
          <Maximize2 size={15} />
        </Link>
      </div>
      <div className="chart-price-row">
        <div className="chart-price">{quote ? price(quote.price) : "—"}<span>USDT</span></div>
        {quote && <span className={`chart-change ${quote.change_pct == null ? "muted" : quote.change_pct >= 0 ? "positive" : "negative"}`}>
          <ArrowUpRight size={13} />{percent(quote.change_pct)}<span>24h</span>
        </span>}
        <span className="chart-live-status"><span className="live-dot" /> Precio en vivo</span>
      </div>
      <div className="chart-toolbar">
        <div className="timeframes" aria-label="Temporalidad del gráfico">
          {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => <button key={tf} className={tf === timeframe ? "active" : ""} aria-pressed={tf === timeframe} onClick={() => setTimeframe(tf)}>{tf}</button>)}
        </div>
        <div className="chart-view-toggle">
          <button className={view === "candles" ? "active" : ""} aria-label="Gráfico de velas" aria-pressed={view === "candles"} title="Velas" onClick={() => setView("candles")}><ChartCandlestick size={15} /></button>
          <button className={view === "line" ? "active" : ""} aria-label="Gráfico de línea" aria-pressed={view === "line"} title="Línea" onClick={() => setView("line")}><ChartNoAxesCombined size={15} /></button>
          <button className="icon-button chart-refresh" onClick={() => void refresh()} aria-label="Actualizar velas" title="Actualizar velas"><span className={loading ? "refresh-spinning" : "refresh-symbol"}>↻</span></button>
        </div>
      </div>
      <div className="chart-action-row">
        <button type="button" className={`indicator-toggle ${plannerOpen ? "active" : ""}`} aria-expanded={plannerOpen} onClick={() => setPlannerOpen((open) => !open)}><Calculator size={12} /> Calcular operación</button>
        <span>El precio LIVE sigue las cotizaciones del backend</span>
      </div>
      {plannerOpen && <div className="trade-calculator">
        <div className="trade-calculator-head"><strong>Plan de operación</strong><span>estimación, no envío de órdenes</span></div>
        <div className="trade-direction-row">
          <button type="button" className={tradeDirection === "LONG" ? "active long" : ""} onClick={() => setTradeDirection("LONG")} aria-pressed={tradeDirection === "LONG"}>LONG</button>
          <button type="button" className={tradeDirection === "SHORT" ? "active short" : ""} onClick={() => setTradeDirection("SHORT")} aria-pressed={tradeDirection === "SHORT"}>SHORT</button>
        </div>
        <div className="trade-input-grid">
          <label>Entrada (USDT)<input type="number" min="0" step="any" value={entryInput} placeholder={entry == null ? "Precio actual" : price(entry)} onChange={(event) => setEntryInput(event.target.value)} /></label>
          <label>Stop loss (USDT)<input type="number" min="0" step="any" value={stopInput} placeholder={defaultStop == null ? "Automático -1%" : price(defaultStop)} onChange={(event) => setStopInput(event.target.value)} /></label>
          <label>Objetivo (USDT)<input type="number" min="0" step="any" value={targetInput} placeholder={defaultTarget == null ? "Automático +2%" : price(defaultTarget)} onChange={(event) => setTargetInput(event.target.value)} /></label>
          <label>Capital (USDT)<input type="number" min="0" step="any" value={capitalInput} onChange={(event) => setCapitalInput(event.target.value)} /></label>
          <label>Riesgo (%)<input type="number" min="0" max="100" step="0.1" value={riskInput} onChange={(event) => setRiskInput(event.target.value)} /></label>
          <label>Apalancamiento (x)<input type="number" min="1" step="1" value={leverageInput} onChange={(event) => setLeverageInput(event.target.value)} /></label>
        </div>
        <p className="trade-auto-note">Si dejas el stop y el objetivo vacíos, se usan valores iniciales automáticos del 1% y 2% según LONG/SHORT. Puedes cambiarlos manualmente.</p>
        {levelsValid ? <div className="trade-result-grid">
          <div><span>Riesgo estimado</span><strong>{number(riskBudget, 2)} USDT</strong></div>
          <div><span>Tamaño</span><strong>{number(quantity, 5)} unidades</strong></div>
          <div><span>Exposición</span><strong>{number(notional, 2)} USDT</strong></div>
          <div><span>Margen estimado</span><strong>{number(margin, 2)} USDT</strong></div>
          <div><span>Beneficio al objetivo</span><strong className="positive">{number(reward, 2)} USDT</strong></div>
          <div><span>Ratio R/B</span><strong>{number(riskReward, 2)} : 1</strong></div>
        </div> : <p className="trade-validation">Revisa los niveles: en LONG el stop debe estar debajo de la entrada y el objetivo arriba; en SHORT, al revés.</p>}
        <p className="chart-disclaimer">El cálculo no incluye comisiones, funding, deslizamiento ni precio de liquidación. No coloca operaciones en Binance.</p>
      </div>}
      <div className="indicator-controls" aria-label="Indicadores técnicos">
        {controls.map((control) => <button key={control.key} type="button" className={`indicator-toggle ${indicators[control.key] ? "active" : ""}`} aria-pressed={indicators[control.key]} onClick={() => toggleIndicator(control.key)} title={control.key === "vwap" ? "VWAP calculado sobre las 300 velas cargadas" : control.label}>
          <span className="indicator-swatch" style={{ background: control.color }} />{control.label}
        </button>)}
      </div>
      <div className="indicator-legend">
        {controls.filter((control) => indicators[control.key] && ["ema9", "ema21", "ema50", "ema200", "vwap", "bollinger"].includes(control.key)).map((control) => {
          const last = chartData[chartData.length - 1];
          const key = control.key === "bollinger" ? null : control.key as keyof TechnicalCandle;
          const value = key && last ? last[key] : null;
          return <span key={control.key}><i style={{ background: control.color }} />{control.label}{typeof value === "number" ? ` ${price(value)}` : ""}</span>;
        })}
      </div>
      {loading || error || !data ? <div className="chart-loading"><ResourceState loading={loading} error={error} retry={refresh} /></div> : chartData.length ? <Candles data={chartData} livePrice={quote?.price} timeframe={timeframe} view={view} indicators={indicators} tradeLevels={tradeLevels} /> : <div className="chart-loading slim-note">No hay velas disponibles para este par.</div>}
      <div className="chart-footer">
        <span><span className="live-dot" />{view === "candles" ? "Velas OHLC" : "Precio de cierre"}{indicators.volume ? " y volumen" : ""}</span>
        <span>Binance Futures <span className="separator-dot">·</span> {timeframe} <span className="separator-dot">·</span> EMA/RSI/MACD locales</span>
      </div>
      <p className="chart-disclaimer">Indicadores técnicos informativos; no garantizan resultados. VWAP* se calcula sobre las 300 velas cargadas, no sobre toda la sesión.</p>
    </section>
  );
}

