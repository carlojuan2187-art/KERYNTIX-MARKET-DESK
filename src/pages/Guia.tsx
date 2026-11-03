import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import guideData from "@/assets/guide.json";
import { PageHeader, Tag } from "@/components/ui";
import { useApp } from "@/context/AppContext";

export default function GuiaPage() {
  const { tema } = useParams();
  const { language } = useApp();
  const currentIndex = tema ? guideData.findIndex((item) => item.key === tema) : -1;
  const current = currentIndex >= 0 ? guideData[currentIndex] : undefined;
  const content = current ? (language === "en" ? current.en : current.es) : undefined;

  if (tema && !current) {
    return (
      <div className="resource-state">
        <h1>{language === "en" ? "This topic does not exist" : "Este tema no existe"}</h1>
        <Link className="btn btn-primary" to="/guia">
          {language === "en" ? "Back to the guide" : "Volver a la guía"}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={language === "en" ? "LEARN THE TOOLS. READ THE CONTEXT." : "APRENDE LAS HERRAMIENTAS. ENTIENDE EL CONTEXTO."}
        title={content ? content.label : language === "en" ? "KERYNTIX trader guide" : "Guía del trader KERYNTIX"}
        description={content ? content.summary : language === "en"
          ? "A practical guide to signals, market intelligence, risk management, and every major area of the platform."
          : "Una guía práctica sobre señales, inteligencia de mercado, gestión de riesgo y las principales áreas de la plataforma."}
      >
        {content && (
          <Link className="btn btn-secondary" to="/guia">
            <ArrowLeft size={12} />
            {language === "en" ? "All topics" : "Todos los temas"}
          </Link>
        )}
      </PageHeader>

      {content && current ? (
        <article className="guide-article guide-article-expanded">
          <div className="guide-reading-meta">
            <Tag tone="blue">
              <BookOpen size={11} />
              {language === "en" ? `${current.minutes} min read` : `Lectura de ${current.minutes} min`}
            </Tag>
            <span className="guide-topic-count">
              {String(currentIndex + 1).padStart(2, "0")} / {String(guideData.length).padStart(2, "0")}
            </span>
          </div>

          <div className="guide-sections">
            {content.sections.map((section, index) => (
              <section className="guide-section" key={`${current.key}-${index}`}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>

          <aside className="guide-takeaway">
            <div className="guide-takeaway-label">
              <Lightbulb size={14} />
              {language === "en" ? "KEY TAKEAWAY" : "PUNTO CLAVE"}
            </div>
            <p>{content.takeaway}</p>
          </aside>

          {current.route && current.route !== "/" && (
            <div className="guide-apply-row">
              <div>
                <strong>{language === "en" ? "Explore this in the platform" : "Llévalo a la plataforma"}</strong>
                <span>{language === "en" ? "Open the related workspace section." : "Abre la sección relacionada para consultar los datos."}</span>
              </div>
              <Link className="btn btn-primary" to={current.route}>
                {language === "en" ? "Open section" : "Abrir sección"}
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <div className="guide-next guide-next-expanded">
            {currentIndex > 0 ? (
              <Link className="link-subtle" to={`/guia/${guideData[currentIndex - 1].key}`}>
                <ChevronLeft size={13} />
                {language === "en" ? "Previous topic" : "Tema anterior"}
              </Link>
            ) : <span />}
            {guideData[currentIndex + 1] && (
              <Link className="link-subtle" to={`/guia/${guideData[currentIndex + 1].key}`}>
                {language === "en" ? "Next topic" : "Siguiente tema"}
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </article>
      ) : (
        <div className="guide-index guide-index-expanded">
          {guideData.map((guide, index) => {
            const localized = language === "en" ? guide.en : guide.es;
            return (
              <Link key={guide.key} to={`/guia/${guide.key}`}>
                <span className="guide-index-number mono">{String(index + 1).padStart(2, "0")}</span>
                <div className="guide-index-copy">
                  <h2>{localized.label}</h2>
                  <p>{localized.summary}</p>
                  <small>{language === "en" ? `${guide.minutes} min read` : `${guide.minutes} min de lectura`}</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            );
          })}
        </div>
      )}

      <p className="slim-note guide-disclaimer">
        {language === "en"
          ? "Educational content only. Examples are conceptual and do not represent active signals, personal financial advice, or a guarantee of results."
          : "Contenido educativo. Los ejemplos son conceptuales y no representan señales activas, asesoría financiera personalizada ni garantía de resultados."}
      </p>
    </div>
  );
}
