import { t } from "@/i18n/translation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Copy,
  Info,
  Languages,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import ftradeBrandLogo from "@/assets/ftrade-logo-brand.webp";
import ftradeBrandIcon from "@/assets/ftrade-icon.webp";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand${compact ? " brand-compact" : ""}`}>
      <img
        src={compact ? ftradeBrandIcon : ftradeBrandLogo}
        alt={compact ? t("Símbolo de FTrade") : t("FTrade — Analiza, opera, avanza")}
        className="brand-image"
        loading="eager"
        decoding="async"
      />
    </span>
  );
}


export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useApp();
  return (
    <div className={`language-switch ${className}`} role="group" aria-label={t("Idioma")}>
      <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} aria-label={t("English")} onClick={() => void setLanguage("en")}>
        <Languages size={13} /> EN
      </button>
      <button type="button" className={language === "es" ? "active" : ""} aria-pressed={language === "es"} aria-label={t("Español")} onClick={() => void setLanguage("es")}>
        ES
      </button>
    </div>
  );
}

export function AssetIcon({
  symbol,
  size = 32,
}: {
  symbol: string;
  size?: number;
}) {
  const base = symbol.replace("USDT", "");
  return (
    <span
      className={`asset-icon asset-${base.toLowerCase()}`}
      style={{ width: size, height: size, fontSize: size * 0.43 }}
      aria-hidden="true"
    >
      {base === "BTC" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m10 5-3 14m7-14-3 14M7 7h7c5 0 4 6-1 6H6m2 0h6c5 0 4 5-1 5H5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      ) : base === "ETH" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m12 2 7 10-7 4-7-4 7-10Zm0 16 7-4-7 9-7-9 7 4Z"
            fill="currentColor"
          />
          <path d="M12 2v14l7-4-7-10Z" fill="#777993" />
        </svg>
      ) : base === "SOL" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m6 5-3 3h15l3-3H6Zm-3 6 3 3h15l-3-3H3Zm3 6-3 3h15l3-3H6Z"
            fill="currentColor"
          />
        </svg>
      ) : base === "BNB" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m12 2 4 4-4 4-4-4 4-4ZM6 8l4 4-4 4-4-4 4-4Zm12 0 4 4-4 4-4-4 4-4Zm-6 6 4 4-4 4-4-4 4-4Zm0-5 3 3-3 3-3-3 3-3Z"
            fill="currentColor"
          />
        </svg>
      ) : base === "AVAX" ? (
        <svg viewBox="0 0 24 24">
          <path
            d="m11 4 4 7-5 9H2L11 4Zm6 10 4 6h-8l4-6Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        base.slice(0, 1)
      )}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
export function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Tag({
  children,
  tone = "muted",
  dot = false,
}: {
  children: ReactNode;
  tone?: "green" | "red" | "amber" | "blue" | "muted";
  dot?: boolean;
}) {
  return (
    <span className={`tag tag-${tone}`}>
      {dot && <span className="small-dot" />}
      {children}
    </span>
  );
}
export function Countdown({
  until,
  long = false,
}: {
  until?: string;
  long?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!until) return <span>{t("Sin vencimiento")}</span>;
  const seconds = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return (
    <span className="mono">
      {long && days > 0 ? `${days}d ` : ""}
      {(long || seconds >= 3600) &&
        `${String(hours + (long ? 0 : days * 24)).padStart(2, "0")}:`}
      {String(minutes).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
export function CopyButton({
  text,
  label = "Copiar",
  className = "btn btn-quiet",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copiado al portapapeles");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast(
        t("No se pudo copiar. Selecciona el texto y cópialo manualmente."),
        "error",
      );
    }
  }
  return (
    <button className={className} onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copiado" : label}
    </button>
  );
}
export function Reading({
  children,
  title = "La lectura de FTrade",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="market-reading">
      <Sparkles size={17} />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function ResourceState({
  loading,
  error,
  empty = false,
  retry,
  emptyText = "No hay datos para esta vista.",
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  retry?: () => void;
  emptyText?: string;
}) {
  if (loading)
    return (
      <div
        className="resource-skeleton"
        role="status"
        aria-label={t("Cargando datos")}
      >
        <div className="skeleton-shine skeleton-title" />
        <div className="skeleton-shine skeleton-chart" />
        <div className="skeleton-shine skeleton-line" />
      </div>
    );
  if (error || empty)
    return (
      <div className="resource-state">
        {error ? <AlertCircle size={30} /> : <Info size={30} />}
        <h3>
          {t(error ? "No pudimos cargar los datos" : "Todo tranquilo por aquí")}
        </h3>
        <p>{t(error || emptyText)}</p>
        {error && retry && (
          <button className="btn btn-secondary" onClick={retry}>
            <RefreshCw size={15} />
            {t("Reintentar")}</button>
        )}
      </div>
    );
  return null;
}
export function RefreshButton({
  onClick,
  loading = false,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button className="btn btn-secondary" disabled={loading} onClick={onClick}>
      <RefreshCw size={14} className={loading ? "spin" : ""} />
      <span>{t("Actualizar")}</span>
    </button>
  );
}
export function ExternalArrow() {
  return <ArrowUpRight size={15} />;
}

export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    const firstInput = root?.querySelector<HTMLElement>(
      "input:not([disabled]), textarea, select",
    );
    (firstInput || root?.querySelector<HTMLElement>("button, a"))?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && root) {
        const nodes = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]',
        );
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label={t("Cerrar")} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
