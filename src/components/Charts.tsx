import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChartCandlestick,
  ChartNoAxesCombined,
  ChevronDown,
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

function Candles({
  data,
  showLevels = false,
}: {
  data: Candle[];
  showLevels?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(270, entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!data.length) return null;
  const chartWidth = width - 94;
  const height = 258;
  const min = Math.min(...data.map((d) => d.low)) * 0.999;
  const max = Math.max(...data.map((d) => d.high)) * 1.001;
  const y = (value: number) => 14 + (1 - (value - min) / (max - min)) * 181;
  const step = (chartWidth - 18) / data.length;
  const volumeMax = Math.max(...data.map((d) => d.volume));
  const selected = data[hover ?? data.length - 1];
  const last = data[data.length - 1];
  return (
    <div className="candles-wrap" ref={container}>
      <div className="ohlc-line">
        <span>
          O <b>{price(selected.open)}</b>
        </span>
        <span>
          H <b>{price(selected.high)}</b>
        </span>
        <span>
          L <b>{price(selected.low)}</b>
        </span>
        <span>
          C{" "}
          <b
            className={
              selected.close >= selected.open ? "positive" : "negative"
            }
          >
            {price(selected.close)}
          </b>
        </span>
        <span className="chart-volume">
          Vol <b>{compact(selected.volume)}</b>
        </span>
      </div>
      <svg
        className="candle-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico interactivo de velas y volumen del par seleccionado"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setHover((i) => Math.max(0, (i ?? data.length - 1) - 1));
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setHover((i) => Math.min(data.length - 1, (i ?? 0) + 1));
          }
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * width;
          setHover(
            Math.max(0, Math.min(data.length - 1, Math.floor((x - 9) / step))),
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = min + ((max - min) * tick) / 4;
          return (
            <g key={tick}>
              <line
                x1="0"
                x2={chartWidth}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid"
              />
              <text x={chartWidth + 13} y={y(value) + 3} className="chart-axis">
                {price(value)}
              </text>
            </g>
          );
        })}
        {(width < 450 ? [0, 24, 48] : [0, 12, 24, 36, 48, 60]).map((i) => (
          <g key={i}>
            <line
              x1={i * step + 12}
              x2={i * step + 12}
              y1="8"
              y2="237"
              className="chart-grid chart-grid-vertical"
            />
            <text
              x={i * step + 12}
              y="254"
              textAnchor="middle"
              className="chart-axis"
            >
              {data[i]?.time}
            </text>
          </g>
        ))}
        <text
          x={chartWidth * 0.27}
          y="118"
          className="chart-watermark"
          style={{ fontSize: width < 450 ? 25 : 41 }}
        >
          FTRADE
        </text>
        {showLevels && (
          <>
            <line
              x1="0"
              x2={chartWidth}
              y1={y(last.close * 0.993)}
              y2={y(last.close * 0.993)}
              stroke="var(--blue)"
              strokeDasharray="4 5"
              opacity=".55"
            />
            <text
              x="12"
              y={y(last.close * 0.993) - 6}
              fill="var(--blue)"
              fontSize="9"
            >
              ZONA DE LIQUIDEZ 15M
            </text>
          </>
        )}
        {data.map((d, i) => {
          const x = 9 + step * i;
          const up = d.close >= d.open;
          return (
            <g key={d.timestamp} className={up ? "candle-up" : "candle-down"}>
              <line
                x1={x + step * 0.27}
                x2={x + step * 0.27}
                y1={y(d.high)}
                y2={y(d.low)}
                stroke="currentColor"
                strokeWidth="1"
              />
              <rect
                x={x}
                y={Math.min(y(d.open), y(d.close))}
                width={step * 0.55}
                height={Math.max(1.8, Math.abs(y(d.open) - y(d.close)))}
                fill="currentColor"
                rx=".7"
              />
              <rect
                x={x}
                y={237 - (d.volume / volumeMax) * 30}
                width={step * 0.55}
                height={(d.volume / volumeMax) * 30}
                fill="currentColor"
                opacity=".18"
                rx=".5"
              />
            </g>
          );
        })}
        <line
          x1="0"
          x2={chartWidth}
          y1={y(last.close)}
          y2={y(last.close)}
          stroke="var(--accent)"
          strokeWidth=".7"
          strokeDasharray="3 4"
          opacity=".65"
        />
        <rect
          x={chartWidth + 4}
          y={y(last.close) - 10}
          width="88"
          height="20"
          rx="3"
          fill="var(--accent)"
        />
        <text
          x={chartWidth + 48}
          y={y(last.close) + 3}
          textAnchor="middle"
          fill="var(--accent-ink)"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fontWeight="500"
        >
          {price(last.close)}
        </text>
        {hover !== null && (
          <>
            <line
              x1={9 + step * hover + step * 0.27}
              x2={9 + step * hover + step * 0.27}
              y1="8"
              y2="237"
              stroke="var(--text-secondary)"
              strokeDasharray="3 3"
              opacity=".6"
            />
            <circle
              cx={9 + step * hover + step * 0.27}
              cy={y(selected.close)}
              r="3"
              fill="var(--accent)"
            />
          </>
        )}
      </svg>
    </div>
  );
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
  const [view, setView] = useState<"candles" | "line">(
    panorama ? "line" : "candles",
  );
  const { data, loading, error, refresh } = useApi(
    () => getCandles(symbol, timeframe, user?.tz),
    [symbol, timeframe, user?.tz],
  );
  const quote = quotes.find((q) => q.symbol === symbol);
  return (
    <section
      className={`chart-panel panel ${panorama ? "panorama-chart" : ""}`}
    >
      <div className="chart-heading">
        <div className="chart-pair">
          <AssetIcon symbol={symbol} size={34} />
          <div>
            <div className="symbol-select-wrap">
              <select
                aria-label="Par del gráfico"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {quotes.map((q) => (
                  <option key={q.symbol} value={q.symbol}>
                    {q.symbol.replace("USDT", " / USDT")}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <span>
              Perpetuo <span className="separator-dot">·</span> Binance Futures
            </span>
          </div>
        </div>
        <Link
          className="icon-button"
          title="Ver flujo del par"
          aria-label={`Ver flujo de ${symbol}`}
          to={`/mercado/flujo/${symbol}`}
        >
          <Maximize2 size={15} />
        </Link>
      </div>
      <div className="chart-price-row">
        <div className="chart-price">
          {quote ? price(quote.price) : "—"}
          <span>USDT</span>
        </div>
        {quote && (
          <span
            className={`chart-change ${quote.change_pct == null ? "muted" : quote.change_pct >= 0 ? "positive" : "negative"}`}
          >
            <ArrowUpRight size={13} />
            {percent(quote.change_pct)}
            <span>24h</span>
          </span>
        )}
      </div>
      <div className="chart-toolbar">
        <div className="timeframes">
          {["15m", "1h", "4h", "1D"].map((tf) => (
            <button
              key={tf}
              className={tf === timeframe ? "active" : ""}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="chart-view-toggle">
          <button
            className={view === "candles" ? "active" : ""}
            aria-label="Gráfico de velas"
            title="Velas"
            onClick={() => setView("candles")}
          >
            <ChartCandlestick size={15} />
          </button>
          <button
            className={view === "line" ? "active" : ""}
            aria-label="Gráfico de línea"
            title="Línea"
            onClick={() => setView("line")}
          >
            <ChartNoAxesCombined size={15} />
          </button>
        </div>
      </div>
      {loading || error || !data ? (
        <div className="chart-loading">
          <ResourceState loading={loading} error={error} retry={refresh} />
        </div>
      ) : view === "candles" ? (
        <Candles data={data} />
      ) : (
        <HistoryChart
          data={data}
          dataKey="close"
          xKey="time"
          label="Precio (USDT)"
          height={228}
        />
      )}
      <div className="chart-footer">
        <span>
          <span className="live-dot" />{" "}
          {panorama ? "Precio y participación" : "Precio y volumen"}
        </span>
        <span>
          Fuente: backend <span className="separator-dot">·</span>{" "}
          {timeframe}
        </span>
      </div>
    </section>
  );
}
