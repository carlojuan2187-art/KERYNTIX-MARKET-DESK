import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { loginPhone, verifyCode, verifyTelegramLink, resendCode } from "@/api";
import { appConfig } from "@/api/config";
import { useApp } from "@/context/AppContext";
import { Brand, Countdown } from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";

type Challenge = Awaited<ReturnType<typeof loginPhone>>;
export default function LoginPage() {
  const { setUser, toast, quotes } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "telegram" | "code">("phone");
  const [country, setCountry] = useState("+53");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (step !== "telegram" || !challenge) return;
    const timer = setInterval(() => {
      void verifyTelegramLink(challenge.token)
        .then((response) => {
          if (response.linked) {
            setStep("code");
            setError("");
          }
        })
        .catch((err) => {
          setError((err as Error).message);
          const status = (err as { status?: number }).status;
          if (status === 404 || status === 410) setStep("phone");
        });
    }, 1200);
    return () => clearInterval(timer);
  }, [step, challenge]);
  useEffect(() => {
    if (step === "code") inputs.current[0]?.focus();
  }, [step]);
  const resendRemaining = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resend_at) - now) / 1000))
    : 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "phone") {
        if (!accepted)
          throw new Error("Acepta las condiciones de uso para continuar.");
        if (!appConfig.botUsername)
          throw new Error("Configura VITE_TELEGRAM_BOT_USERNAME con el nombre del bot de autenticación antes de iniciar sesión.");
        const fullPhone = phone.trim().startsWith("+")
          ? phone.replace(/\s/g, "")
          : country + phone.replace(/\D/g, "");
        const value = await loginPhone(fullPhone);
        setChallenge(value);
        setStep("telegram");
      }
      if (step === "code" && challenge) {
        const session = await verifyCode(challenge.phone, code.join(""));
        setUser(session.user);
        if (session.is_new)
          toast(
            `¡Tu acceso GRATIS de ${appConfig.trialDays} días ha comenzado!`,
          );
        navigate("/");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header className="login-header">
        <Brand />
      </header>
      <main className="login-layout">
        <section className="login-story">
          <div className="eyebrow">FUTUROS CRIPTO. UNA NUEVA PERSPECTIVA.</div>
          <h1>
            Menos ruido.
            <br />
            Más <span>contexto.</span>
          </h1>
          <p>
            Señales con un plan, datos que conectan y una forma más clara de
            leer el mercado.
          </p>
          <div className="login-market">
            <div className="status-row">
              <span className="live-dot" />
              EL MERCADO NO SE DETIENE
            </div>
            {quotes[0]?.sparkline?.length ? (
              <Sparkline values={quotes[0].sparkline} width={360} height={115} fill />
            ) : (
              <div className="chart-loading">Esperando cotizaciones del backend…</div>
            )}
            <span>Precio · Volumen · Liquidez · Disciplina</span>
          </div>
          <div className="login-trust">
            <ShieldCheck size={17} />
            <span>
              Sin contraseñas. Sin email.
              <br />
              Tu teléfono es tu acceso.
            </span>
          </div>
        </section>
        <section className="login-form-area">
          <div className="login-steps">
            {["Tu teléfono", "Vinculación", "Verificación"].map(
              (label, index) => (
                <span
                  key={label}
                  className={
                    index <= ["phone", "telegram", "code"].indexOf(step)
                      ? "active"
                      : ""
                  }
                >
                  <i>
                    {index < ["phone", "telegram", "code"].indexOf(step) ? (
                      <Check size={11} />
                    ) : (
                      index + 1
                    )}
                  </i>
                  {label}
                </span>
              ),
            )}
          </div>
          <h2>
            {step === "phone"
              ? "Tu mercado empieza aquí."
              : step === "telegram"
                ? "Una verificación, nada más."
                : "Confirma que eres tú."}
          </h2>
          <p className="login-description">
            {step === "phone"
              ? `Accede con tu teléfono. Las cuentas nuevas reciben ${appConfig.trialDays} días de acceso gratuito.`
              : step === "telegram"
                ? "Abre el bot, comparte tu contacto una vez y recibe tu código. Todo lo demás ocurre aquí, en la web."
                : `Introduce el código de 6 dígitos enviado a través del bot para ${challenge?.phone}.`}
          </p>
          <form className="form-stack" onSubmit={submit}>
            {step === "phone" && (
              <>
                <label className="input-field">
                  <span>Número de teléfono</span>
                  <div className="phone-field">
                    <select
                      aria-label="País"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="+53">Cuba +53</option>
                      <option value="+52">México +52</option>
                      <option value="+34">España +34</option>
                      <option value="+1">EE. UU. +1</option>
                      <option value="+57">Colombia +57</option>
                      <option value="+54">Argentina +54</option>
                    </select>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      aria-label="Número de teléfono"
                      placeholder="5512 3456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <small>
                    Usa el mismo número que compartiste con el bot de Telegram.
                  </small>
                </label>
                <label className="terms-check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    Acepto el uso informativo de FTrade y entiendo que operar
                    futuros implica riesgo de pérdida. No es asesoría
                    financiera.
                  </span>
                </label>
              </>
            )}
            {step === "telegram" && challenge && (
              <>
                {appConfig.botUsername ? (
                  <a
                    className="btn btn-blue"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://t.me/${appConfig.botUsername}?start=verify_${challenge.token}`}
                  >
                    <Send size={15} />
                    Abrir bot de Telegram
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="form-error" role="alert">
                    Falta configurar VITE_TELEGRAM_BOT_USERNAME con el nombre del bot de autenticación.
                  </p>
                )}
                <div className="telegram-wait">
                  <LoaderCircle className="spin" size={15} />
                  <span>Esperando que vincules Telegram…</span>
                </div>

              </>
            )}
            {step === "code" && (
              <>
                <div className="otp-inputs">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        inputs.current[index] = node;
                      }}
                      aria-label={`Dígito ${index + 1}`}
                      value={digit}
                      maxLength={1}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(-1);
                        setCode((old) =>
                          old.map((d, i) => (i === index ? value : d)),
                        );
                        if (value && index < 5)
                          inputs.current[index + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && index > 0)
                          inputs.current[index - 1]?.focus();
                        if (e.key === "ArrowLeft" && index > 0)
                          inputs.current[index - 1]?.focus();
                        if (e.key === "ArrowRight" && index < 5)
                          inputs.current[index + 1]?.focus();
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const value = e.clipboardData
                          .getData("text")
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setCode(
                          Array.from({ length: 6 }, (_, i) => value[i] || ""),
                        );
                        inputs.current[Math.min(value.length, 5)]?.focus();
                      }}
                    />
                  ))}
                </div>
                <div className="otp-meta">
                  <span>
                    Vence en <Countdown until={challenge?.expires_at} />
                  </span>
                  <button
                    type="button"
                    disabled={resendRemaining > 0 || busy}
                    onClick={async () => {
                      if (!challenge) return;
                      try {
                        const dates = await resendCode(challenge.token);
                        setChallenge({ ...challenge, ...dates });
                        setError("");
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    {resendRemaining
                      ? `Reenviar en ${resendRemaining}s`
                      : "Reenviar código"}
                  </button>
                </div>

              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {step !== "telegram" && (
              <button
                className="btn btn-primary login-submit"
                disabled={
                  busy || (step === "code" && code.join("").length !== 6)
                }
                type="submit"
              >
                {busy ? <LoaderCircle className="spin" size={15} /> : null}
                {busy
                  ? "Verificando..."
                  : step === "phone"
                    ? "Continuar con mi teléfono"
                    : "Verificar y entrar"}
                <ArrowRight size={14} />
              </button>
            )}
            {step !== "phone" && (
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError("");
                  setCode(Array(6).fill(""));
                }}
              >
                <ArrowLeft size={12} />
                Usar otro número
              </button>
            )}
          </form>
          <p className="login-privacy">
            <ShieldCheck size={12} />
            Telegram solo verifica tu acceso y entrega notificaciones. Tus
            análisis y herramientas siempre están en la web.
          </p>
        </section>
      </main>
      <footer className="login-footer">
        Informativo. No es asesoría financiera ni garantía de resultados.
      </footer>
    </div>
  );
}
