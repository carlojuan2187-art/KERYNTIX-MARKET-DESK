import { getIntlLocale, t } from "@/i18n/translation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  LogIn,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  loginWithPassword,
  registerPhone,
  startPasswordRecovery,
  verifyCode,
  verifyTelegramLink,
  resendCode,
  setAccountPassword,
  type PhoneChallenge,
} from "@/api";
import { appConfig } from "@/api/config";
import { PHONE_COUNTRIES } from "@/api/countries";
import { useApp } from "@/context/AppContext";
import { Brand, Countdown, LanguageSwitch } from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";

type AuthMode = "login" | "register" | "recover";
type AuthStep = "form" | "telegram" | "code" | "set-password";

function makeE164(countryIso2: string, rawPhone: string): string {
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  const selected = PHONE_COUNTRIES.find((item) => item.iso2 === countryIso2);
  return `${selected?.dialCode || "+1"}${digits}`;
}

export default function LoginPage() {
  const { setUser, toast, quotes, user, loading, t, language } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [country, setCountry] = useState("PR");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const countryNames = new Intl.DisplayNames([getIntlLocale(language)], { type: "region" });
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && user && mode === "login" && step === "form") navigate("/", { replace: true });
  }, [loading, user, mode, step, navigate]);

  useEffect(() => {
    if (step !== "telegram" || !challenge) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      void verifyTelegramLink(challenge.token)
        .then((response) => {
          if (!disposed && response.linked) {
            setStep("code");
            setError("");
          }
        })
        .catch((err) => {
          if (disposed) return;
          setError(t((err as Error).message));
          const status = (err as { status?: number }).status;
          if (status === 404 || status === 410) setStep("form");
        });
    }, 1200);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [step, challenge]);

  useEffect(() => {
    if (step === "code") inputs.current[0]?.focus();
  }, [step]);

  const resendRemaining = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resend_at) - now) / 1000))
    : 0;

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStep("form");
    setChallenge(null);
    setCode(Array(6).fill(""));
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
  }

  function requireTelegramBot() {
    if (!appConfig.botUsername) {
      throw new Error(t("El registro y la recuperación necesitan configurar VITE_TELEGRAM_BOT_USERNAME con el nombre del bot de autenticación."));
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "form") {
        const fullPhone = makeE164(country, phone);
        if (mode === "login") {
          const session = await loginWithPassword(fullPhone, password);
          setUser(session.user);
          navigate("/", { replace: true });
          return;
        }
        if (mode === "register") {
          if (!accepted) throw new Error(t("Acepta las condiciones de uso para crear tu cuenta."));
          if (password.length < 10) throw new Error(t("La contraseña debe tener al menos 10 caracteres."));
          if (password !== confirmPassword) throw new Error(t("Las contraseñas no coinciden."));
          requireTelegramBot();
          const value = await registerPhone(fullPhone, password, language);
          setChallenge(value);
          setStep("telegram");
          return;
        }
        requireTelegramBot();
        const value = await startPasswordRecovery(fullPhone);
        setChallenge(value);
        setStep("telegram");
        return;
      }

      if (step === "code" && challenge) {
        const session = await verifyCode(challenge.phone, code.join(""));
        setUser(session.user);
        if (mode === "recover") {
          setStep("set-password");
          setError("");
          return;
        }
        if (session.is_new) {
          toast(`${t("¡Tu acceso GRATIS de")} ${appConfig.trialDays} ${t("días ha comenzado!")}`);
        }
        navigate("/", { replace: true });
        return;
      }

      if (step === "set-password") {
        if (newPassword.length < 10) throw new Error(t("La contraseña debe tener al menos 10 caracteres."));
        if (newPassword !== confirmNewPassword) throw new Error(t("Las contraseñas no coinciden."));
        await setAccountPassword(newPassword);
        toast(t("Contraseña configurada. La próxima vez podrás entrar sin Telegram."));
        navigate("/", { replace: true });
      }
    } catch (err) {
      const authError = err as Error & { code?: string };
      if (authError.code === "PASSWORD_SETUP_REQUIRED") {
        setError(t("Esta cuenta todavía no tiene contraseña. Configúrala una sola vez mediante la opción «Olvidé mi contraseña / configurar acceso»."));
      } else if (authError.code === "RECOVERY_ACCEPTED") {
        changeMode("login");
        setError(t("Si existe una cuenta con ese teléfono, se han enviado instrucciones para recuperar el acceso."));
      } else {
        setError(t(authError.message || "No se pudo completar la solicitud."));
      }
    } finally {
      setBusy(false);
    }
  }

  const showAuthTabs = step === "form" && mode !== "recover";
  const selectedCountry = PHONE_COUNTRIES.find((item) => item.iso2 === country) || PHONE_COUNTRIES[0];

  return (
    <div className="login-page">
      <header className="login-header">
        <Brand />
        <LanguageSwitch />
      </header>
      <main className="login-layout">
        <section className="login-story">
          <div className="eyebrow">{t("FUTUROS CRIPTO. UNA NUEVA PERSPECTIVA.")}</div>
          <h1>
            {t("Menos ruido.")}<br />
            {t("Más ")}<span>{t("contexto.")}</span>
          </h1>
          <p>
            {t("Señales con un plan, datos que conectan y una forma más clara de leer el mercado.")}</p>
          <div className="login-market">
            <div className="status-row">
              <span className="live-dot" />
              {t("EL MERCADO NO SE DETIENE")}</div>
            {quotes[0]?.sparkline?.length ? (
              <Sparkline values={quotes[0].sparkline} width={360} height={115} fill />
            ) : (
              <div className="chart-loading">{t("Esperando cotizaciones del backend…")}</div>
            )}
            <span>{t("Precio · Volumen · Liquidez · Disciplina")}</span>
          </div>
          <div className="login-trust">
            <ShieldCheck size={17} />
            <span>
              {t("Registro protegido con Telegram.")}<br />
              {t("En tus próximas visitas entra con tu contraseña.")}</span>
          </div>
        </section>

        <section className="login-form-area">
          {showAuthTabs && (
            <div className="auth-tabs" role="tablist" aria-label={t("Tipo de acceso")}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
              >
                <LogIn size={14} /> {t("Iniciar sesión")}</button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => changeMode("register")}
              >
                <UserPlus size={14} /> {t("Crear cuenta")}</button>
            </div>
          )}

          {(step === "telegram" || step === "code") && (
            <div className="login-steps">
              {["Tu teléfono", "Telegram", "Código"].map((label, index) => (
                <span key={label} className={index <= (step === "telegram" ? 1 : 2) ? "active" : ""}>
                  <i>{index < (step === "telegram" ? 1 : 2) ? <Check size={11} /> : index + 1}</i>
                  {t(label)}
                </span>
              ))}
            </div>
          )}

          <h2>
            {step === "telegram"
              ? t("Verifica tu número.")
              : step === "code"
                ? t("Confirma el código.")
                : step === "set-password"
                  ? t("Crea tu contraseña.")
                  : mode === "login"
                    ? t("Bienvenido de nuevo.")
                    : mode === "register"
                      ? t("Crea tu cuenta KERYNTIX MARKET DESK.")
                      : t("Recupera tu acceso.")}
          </h2>
          <p className="login-description">
            {step === "telegram"
              ? t("Abre el bot de Telegram, comparte tu contacto y espera el código de verificación.")
              : step === "code"
                ? `${t("Introduce el código de 6 dígitos enviado por Telegram a")} ${challenge?.phone}.`
                : step === "set-password"
                  ? t("Esta será la contraseña de tu cuenta. Después podrás iniciar sesión directamente sin repetir la verificación de Telegram.")
                  : mode === "login"
                    ? t("Entra con tu número de teléfono y contraseña. No necesitas verificar con Telegram para iniciar sesión.")
                    : mode === "register"
                      ? `${t("Regístrate con tu teléfono y crea una contraseña. Telegram verificará el número una sola vez. Recibirás")} ${appConfig.trialDays} ${t("días gratis.")}`
                      : t("Para proteger tu cuenta, verifica tu número con Telegram y establece una contraseña nueva.")}
          </p>

          <form className="form-stack" onSubmit={submit}>
            {step === "form" && (
              <>
                <label className="input-field">
                  <span>{t("Número de teléfono")}</span>
                  <div className="phone-field">
                    <select
                      aria-label={t("País y prefijo telefónico")}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      {PHONE_COUNTRIES.map((item) => (
                        <option key={item.iso2} value={item.iso2}>
                          {item.flag} {countryNames.of(item.iso2) || item.name} ({item.dialCode})
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      aria-label={t("Número de teléfono")}
                      placeholder="787 555 1234"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <small>
                    {t("Prefijo seleccionado: ")}{selectedCountry?.dialCode}{t(". Puedes introducir el número completo comenzando por +.")}</small>
                </label>

                {mode === "login" && (
                  <label className="input-field">
                    <span>{t("Contraseña")}</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t("Tu contraseña")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </label>
                )}

                {mode === "register" && (
                  <>
                    <label className="input-field">
                      <span>{t("Crear contraseña")}</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        placeholder={t("Mínimo 10 caracteres")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </label>
                    <label className="input-field">
                      <span>{t("Confirmar contraseña")}</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        placeholder={t("Repite tu contraseña")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </label>
                    <label className="terms-check">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      <span>
                        {t("Acepto las condiciones de uso y entiendo que operar futuros implica riesgo de pérdida. KERYNTIX MARKET DESK no es asesoría financiera.")}</span>
                    </label>
                  </>
                )}

                {mode === "recover" && (
                  <p className="auth-recovery-note">
                    {t("Telegram solo se utilizará para recuperar o configurar el acceso. No tendrás que repetir este paso en los inicios de sesión normales.")}</p>
                )}
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
                    {t("Abrir bot de Telegram")}<ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="form-error" role="alert">
                    {t("Falta configurar VITE_TELEGRAM_BOT_USERNAME con el nombre del bot de autenticación.")}</p>
                )}
                <div className="telegram-wait">
                  <LoaderCircle className="spin" size={15} />
                  <span>{t("Esperando que vincules Telegram…")}</span>
                </div>
              </>
            )}

            {step === "code" && (
              <>
                <div className="otp-inputs">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => { inputs.current[index] = node; }}
                      aria-label={`${t("Dígito")} ${index + 1}`}
                      value={digit}
                      maxLength={1}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(-1);
                        setCode((old) => old.map((d, i) => (i === index ? value : d)));
                        if (value && index < 5) inputs.current[index + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus();
                        if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
                        if (e.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const value = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        setCode(Array.from({ length: 6 }, (_, i) => value[i] || ""));
                        inputs.current[Math.min(value.length, 5)]?.focus();
                      }}
                    />
                  ))}
                </div>
                <div className="otp-meta">
                  <span>{t("Vence en ")}<Countdown until={challenge?.expires_at} /></span>
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
                        setError(t((err as Error).message));
                      }
                    }}
                  >
                    {resendRemaining ? `${t("Reenviar en")} ${resendRemaining}s` : t("Reenviar código")}
                  </button>
                </div>
              </>
            )}

            {step === "set-password" && (
              <>
                <label className="input-field">
                  <span>{t("Nueva contraseña")}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("Mínimo 10 caracteres")}
                    required
                  />
                </label>
                <label className="input-field">
                  <span>{t("Confirmar contraseña")}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={t("Repite tu contraseña")}
                    required
                  />
                </label>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            {step !== "telegram" && (
              <button
                className="btn btn-primary login-submit"
                disabled={busy || (step === "code" && code.join("").length !== 6)}
                type="submit"
              >
                {busy ? <LoaderCircle className="spin" size={15} /> : null}
                {busy
                  ? "Procesando…"
                  : step === "code"
                    ? mode === "recover" ? "Verificar y continuar" : "Verificar y crear cuenta"
                    : step === "set-password"
                      ? "Guardar contraseña"
                      : mode === "login"
                        ? "Iniciar sesión"
                        : mode === "register"
                          ? "Continuar con Telegram"
                          : "Recuperar con Telegram"}
                <ArrowRight size={14} />
              </button>
            )}

            {step === "form" && mode === "login" && (
              <button className="auth-text-link" type="button" onClick={() => changeMode("recover")}>
                {t("¿Olvidaste tu contraseña o tienes una cuenta anterior? Configurar acceso con Telegram")}</button>
            )}
            {step === "form" && mode === "recover" && (
              <button className="auth-text-link" type="button" onClick={() => changeMode("login")}>
                <ArrowLeft size={12} /> {t("Volver al inicio de sesión")}</button>
            )}
            {step !== "form" && step !== "set-password" && (
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => {
                  setStep("form");
                  setChallenge(null);
                  setCode(Array(6).fill(""));
                  setError("");
                }}
              >
                <ArrowLeft size={12} /> {t("Cambiar número")}</button>
            )}
          </form>

          <p className="login-privacy">
            <ShieldCheck size={12} />
            {t("El inicio de sesión normal utiliza contraseña. Telegram se reserva para verificar registros y recuperar el acceso.")}</p>
        </section>
      </main>
      <footer className="login-footer">
        {t("Informativo. No es asesoría financiera ni garantía de resultados.")}</footer>
    </div>
  );
}
