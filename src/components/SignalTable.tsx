import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { SignalState } from "@/api/types";
import { signalLabel, signalMetrics } from "@/api/signals";
import { price, number } from "@/utils/format";
import { AssetIcon, Tag } from "./ui";

export function Score({ value }: { value: number }) {
  return (
    <span className="score-display" title={`Score ${value} de 100`}>
      <span className="score-bars">
        <i />
        <i />
        <i style={{ opacity: value >= 85 ? 1 : 0.35 }} />
      </span>
      <span className="mono">
        {value}
        <span className="muted" style={{ fontSize: 8 }}>
          /100
        </span>
      </span>
    </span>
  );
}
export function SignalTable({ signals }: { signals: SignalState[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Par / Dirección</th>
            <th>Zona de entrada</th>
            <th>Riesgo / Beneficio</th>
            <th>Score</th>
            <th>Estado</th>
            <th aria-label="Ver detalle" />
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => {
            const status = signalLabel(signal);
            const metrics = signalMetrics(signal);
            return (
              <tr key={signal.symbol}>
                <td>
                  <Link
                    className="asset-pair"
                    to={`/senales?par=${signal.symbol}`}
                  >
                    <AssetIcon symbol={signal.symbol} size={29} />
                    <div>
                      <strong>
                        {signal.symbol.replace("USDT", "")}
                        <span className="muted" style={{ fontSize: 8 }}>
                          {" "}
                          / USDT
                        </span>
                      </strong>
                      <small
                        className={
                          signal.direction === "LONG" ? "positive" : "negative"
                        }
                        style={{
                          color:
                            signal.direction === "LONG"
                              ? "var(--green)"
                              : "var(--red)",
                          display: "flex",
                          gap: 3,
                          alignItems: "center",
                        }}
                      >
                        {signal.direction === "LONG" ? (
                          <ArrowUpRight size={10} />
                        ) : (
                          <ArrowDownRight size={10} />
                        )}
                        {signal.direction}{" "}
                        <span className="muted">· {signal.leverage}x</span>
                      </small>
                    </div>
                  </Link>
                </td>
                <td className="mono">
                  {price(signal.entry_low ?? signal.entry_price ?? (metrics.hasEntry ? metrics.entry : null))}
                  {signal.entry_high && (
                    <>
                      <span className="muted"> - </span>
                      {price(signal.entry_high)}
                    </>
                  )}
                </td>
                <td className="mono">{metrics.rr == null ? "—" : `1 : ${number(metrics.rr, 1)}`}</td>
                <td>
                  {signal.score == null ? <span className="muted">—</span> : <Score value={signal.score} />}
                </td>
                <td>
                  <Tag tone={status.tone} dot>
                    {status.label}
                  </Tag>
                </td>
                <td>
                  <Link
                    className="icon-button"
                    aria-label={`Ver señal ${signal.symbol}`}
                    to={`/senales?par=${signal.symbol}`}
                  >
                    <ArrowUpRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
