import { t } from "@/i18n/translation";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import guideData from "@/assets/guide.json";
import { PageHeader, Tag } from "@/components/ui";
import { useApp } from "@/context/AppContext";

export default function GuiaPage() {
  const { tema } = useParams();
  const { language } = useApp();
  void language; // Re-render this page whenever the account language changes.
  const current = guideData.find((g) => g.key === tema);
  if (tema && !current)
    return (
      <div className="resource-state">
        <h1>{t("Este tema no existe")}</h1>
        <Link className="btn btn-primary" to="/guia">
          {t("Volver a la guía")}</Link>
      </div>
    );
  return (
    <div>
      <PageHeader
        eyebrow={t("ENTENDER TAMBIÉN ES UNA VENTAJA")}
        title={current ? t(current.label) : t("El contexto se aprende.")}
        description={
          current
            ? t("Conceptos claros para una operativa más consciente.")
            : t("Ideas breves para interpretar señales, gestionar el riesgo y leer el mercado.")
        }
      >
        {current && (
          <Link className="btn btn-secondary" to="/guia">
            <ArrowLeft size={12} />
            {t("Todos los temas")}</Link>
        )}
      </PageHeader>
      {current ? (
        <article className="guide-article">
          <Tag tone="blue">
            <BookOpen size={11} />
            {t("Lectura de 1 minuto")}</Tag>
          <p>{t(current.text)}</p>
          {["riesgo", "r_r", "estados"].includes(current.key) ? (
            <Link className="btn btn-primary" to="/calculadora">
              {t("Llevarlo a la calculadora")}<ArrowRight size={13} />
            </Link>
          ) : (
            <Link
              className="btn btn-blue"
              to={
                current.key === "derivados"
                  ? "/derivados"
                  : current.key === "calendario"
                    ? "/calendario"
                    : current.key === "referidos"
                      ? "/referidos"
                      : "/mercado"
              }
            >
              {t("Explorar con datos")}<ArrowRight size={13} />
            </Link>
          )}
          <div className="guide-next">
            {guideData[guideData.findIndex((g) => g.key === tema) + 1] && (
              <Link
                className="link-subtle"
                to={`/guia/${guideData[guideData.findIndex((g) => g.key === tema) + 1].key}`}
              >
                {t("Siguiente tema")}<ChevronRight size={13} />
              </Link>
            )}
          </div>
        </article>
      ) : (
        <div className="guide-index">
          {guideData.map((guide, index) => (
            <Link key={guide.key} to={`/guia/${guide.key}`}>
              <span className="guide-index-number mono">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{t(guide.label)}</h2>
                <p>{t(guide.text).slice(0, 100)}...</p>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      )}
      <p className="slim-note">
        {t("Contenido educativo. Los ejemplos descritos son conceptuales y no representan señales activas ni recomendaciones.")}</p>
    </div>
  );
}
