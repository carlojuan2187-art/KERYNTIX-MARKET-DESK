import { Link } from "react-router-dom";
import { ArrowRight, Check, Gift, Link2 } from "lucide-react";
import { getReferralSummary } from "@/api/account";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime } from "@/utils/format";
import {
  CopyButton,
  PageHeader,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";

export default function ReferidosPage() {
  const { user } = useApp();
  const { data, loading, error, refresh } = useApi(getReferralSummary);
  return (
    <div>
      <PageHeader
        eyebrow="EL BUEN CONTEXTO SE COMPARTE"
        title="Tu comunidad también suma."
        description="Invita a otros traders. Cinco referidos que activen Premium se convierten en 30 días para ti."
      />
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && !loading && !error && (
        <>
          <div className="referral-main">
            <section className="referral-invite">
              <Link2 size={25} />
              <h2>
                Comparte una mejor forma
                <br />
                de leer el mercado.
              </h2>
              <p>
                Este es tu enlace personal. Tu código se conserva antes del
                registro para asociar cada invitación a tu cuenta.
              </p>
              <div className="referral-link">
                <input
                  aria-label="Tu enlace de referido"
                  value={data.link}
                  readOnly
                />
                <CopyButton
                  text={data.link}
                  label="Copiar enlace"
                  className="btn btn-primary"
                />
              </div>
              <span className="slim-note">
                Solo cuentan las activaciones de Premium. Los registros
                gratuitos no suman al objetivo.
              </span>
            </section>
            <section className="referral-progress panel panel-pad">
              <SectionHeader title="Tu próxima recompensa">
                <Gift size={17} className="positive" />
              </SectionHeader>
              <div className="referral-progress-number">
                <strong>{data.progress.current}</strong>
                <span>/ {data.progress.target}</span>
              </div>
              <p>referidos Premium válidos</p>
              <div className="referral-milestones">
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={index < data.progress.current ? "completed" : ""}
                  >
                    {index < data.progress.current ? (
                      <Check size={16} />
                    ) : (
                      index + 1
                    )}
                  </span>
                ))}
              </div>
              <div className="progress-bar">
                <span
                  style={{
                    width: `${(data.progress.current / data.progress.target) * 100}%`,
                  }}
                />
              </div>
              <p className="referral-reward">
                <Gift size={14} />
                {user?.plan === "premium"
                  ? "+30 días a tu plan Premium"
                  : "30 días de Premium gratis"}
              </p>
              <span className="slim-note">
                Te faltan{" "}
                {Math.max(0, data.progress.target - data.progress.current)}{" "}
                activaciones para tu recompensa.
              </span>
            </section>
          </div>
          <section className="panel">
            <div className="section-padding">
              <SectionHeader
                title="Las personas que se sumaron"
                subtitle={`${data.referrals.length} registros · ${data.progress.current} activaciones Premium`}
              />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trader referido</th>
                    <th>Registro</th>
                    <th>Activación Premium</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((referral) => (
                    <tr key={referral.user_id}>
                      <td>
                        <div className="asset-pair">
                          <span className="avatar">
                            {referral.username.slice(1, 3).toUpperCase()}
                          </span>
                          <strong>{referral.username}</strong>
                        </div>
                      </td>
                      <td className="muted">
                        {dateTime(referral.created_at, user?.tz)}
                      </td>
                      <td className="muted">
                        {referral.activated_premium_at
                          ? dateTime(referral.activated_premium_at, user?.tz)
                          : "Todavía no activado"}
                      </td>
                      <td>
                        <Tag
                          tone={
                            referral.activated_premium_at ? "green" : "muted"
                          }
                          dot
                        >
                          {referral.activated_premium_at
                            ? "Suma a tu objetivo"
                            : "Registro gratuito"}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section style={{ marginTop: 26 }}>
            <SectionHeader title="Recompensas obtenidas" />
            {data.rewards.length ? (
              data.rewards.map((reward) => (
                <div className="detail-row" key={reward.id}>
                  <span>{dateTime(reward.created_at, user?.tz)}</span>
                  <strong className="positive">
                    +{reward.days} días Premium
                  </strong>
                </div>
              ))
            ) : (
              <p className="slim-note">
                Todavía no has completado un grupo de 5 activaciones. Tu primera
                recompensa se mostrará aquí.
              </p>
            )}
            <Link to="/planes" className="btn btn-quiet">
              Ver mi plan
              <ArrowRight size={13} />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
