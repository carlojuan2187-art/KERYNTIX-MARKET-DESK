import { useId } from "react";

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

