import { Link } from "react-router-dom";
import Gauge from "./Gauge.jsx";
import Icon from "./Icon.jsx";
import RichText from "./RichText.jsx";

// Result of an analysis shown in the conversation: verdict, where the model looked, factors, report.
export default function AnalysisCard({ analysis, text }) {
  const { ml, llm } = analysis;
  const suspect = ml.decision === "suspicion_cancer";
  const pct = (v) => `${Math.round(v * 100)} %`;
  const factors = ml.contributions.slice(0, 5);
  const max = Math.max(...factors.map((c) => Math.abs(c.contribution)), 1e-6);
  const concepts = (ml.concepts || []).slice(0, 5);

  return (
    <article className={`acard ${suspect ? "bad" : "good"}`}>
      <header className="acard-head">
        <div className="acard-gauge"><Gauge value={ml.probability} threshold={ml.threshold} /></div>
        <div className="acard-verdict">
          <span className="acard-pill">
            <Icon name={suspect ? "alert" : "check"} size={15} strokeWidth={2.2} />
            {suspect ? "Suspicion de cancer" : "Pas de signe fort de cancer"}
          </span>
          <p className="acard-prob">
            Probabilité estimée <b>{pct(ml.probability)}</b> · seuil de triage <b>{pct(ml.threshold)}</b>
          </p>
          <p className="acard-advice">{suspect ? "Avis dermatologique recommandé." : "Surveillance selon avis médical."}</p>
          <p className="acard-meta">Décision du modèle entraîné · {ml.modelName} · analyse n° {analysis.id}</p>
        </div>
        <Link to={`/analyses/${analysis.id}`} className="btn ghost sm acard-open">Analyse complète <Icon name="arrowRight" size={14} /></Link>
      </header>

      <section className="acard-body">
        <div className="acard-images">
          <figure>
            <img src={`data:image/png;base64,${ml.imagePng}`} alt="Image analysée" />
            <figcaption>Image analysée</figcaption>
          </figure>
          {ml.heatmapPng && (
            <figure>
              <img src={`data:image/png;base64,${ml.heatmapPng}`} alt="Carte d'occlusion" />
              <figcaption>Où le modèle a regardé{ml.location ? ` · ${ml.location}` : ""}</figcaption>
            </figure>
          )}
        </div>

        <div className="acard-factors">
          <h4>Facteurs de la décision</h4>
          <ul>
            {factors.map((c) => {
              const pos = c.contribution > 0;
              return (
                <li key={`${c.type}-${c.key}`}>
                  <span className="f-label">{c.label}{c.value ? <em> · {c.value}</em> : null}</span>
                  <span className="f-track">
                    <span className={`f-bar ${pos ? "pos" : "neg"}`}
                      style={{ width: `${(Math.abs(c.contribution) / max) * 50}%`, [pos ? "left" : "right"]: "50%" }} />
                  </span>
                  <span className={`f-value ${pos ? "pos" : "neg"}`}>{pos ? "+" : ""}{c.contribution.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <div className="acard-legend">
            <span><i className="pos" /> vers « cancer »</span>
            <span><i className="neg" /> vers « non-cancer »</span>
          </div>
          {concepts.length > 0 && (
            <>
              <h4>Caractéristiques visuelles</h4>
              <div className="acard-chips">
                {concepts.map((c) => <span key={c.name} title={`score z = ${c.z}`}>{c.label}</span>)}
              </div>
            </>
          )}
        </div>
      </section>

      {text && (
        <section className="acard-report">
          <div className="acard-report-head">
            <h4>Compte rendu</h4>
            {llm?.text && <span>Reformulé par {llm.model} · n'influence pas la décision</span>}
          </div>
          <RichText text={text} />
        </section>
      )}
    </article>
  );
}
