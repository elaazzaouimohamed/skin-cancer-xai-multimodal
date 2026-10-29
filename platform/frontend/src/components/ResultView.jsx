import { useState } from "react";
import Gauge from "./Gauge.jsx";
import RichText from "./RichText.jsx";
import { api } from "../api.js";

function Contributions({ items }) {
  const max = Math.max(...items.map((c) => Math.abs(c.contribution)), 1e-6);
  return (
    <ul className="bars">
      {items.map((c) => (
        <li key={`${c.type}-${c.key}`}>
          <span className="bar-label">
            {c.label}{c.value ? <em> : {c.value}</em> : null}
          </span>
          <span className="bar-track">
            <span className={`bar ${c.contribution > 0 ? "pos" : "neg"}`}
              style={{ width: `${(Math.abs(c.contribution) / max) * 50}%`, [c.contribution > 0 ? "left" : "right"]: "50%" }} />
          </span>
          <span className={`bar-value ${c.contribution > 0 ? "pos" : "neg"}`}>
            {c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ResultView({ data, onUpdate }) {
  const { ml, llm } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const suspect = ml.decision === "suspicion_cancer";

  const regenerate = async (style) => {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.regenerate(data.id, style));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="result">
      <section className={`card decision ${suspect ? "bad" : "good"}`}>
        <Gauge value={ml.probability} threshold={ml.threshold} />
        <div>
          <div className="decision-title">{suspect ? "Suspicion de cancer" : "Pas de signe fort de cancer"}</div>
          <p>{suspect ? "Avis dermatologique recommandé." : "Surveillance selon avis médical."}</p>
          <p className="muted small">
            Décision prise par le modèle entraîné <b>{ml.modelName}</b> au seuil de triage
            ({ml.thresholdName}). Inférence : {(ml.inferenceMs / 1000).toFixed(1)} s.
          </p>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>Où le modèle a regardé</h3>
          <div className="images">
            <figure><img src={`data:image/png;base64,${ml.imagePng}`} alt="Image analysée (224×224)" /><figcaption>Image analysée</figcaption></figure>
            {ml.heatmapPng ? (
              <figure><img src={`data:image/png;base64,${ml.heatmapPng}`} alt="Carte d'occlusion" />
                <figcaption><span className="swatch pos" /> vers « cancer » · <span className="swatch neg" /> vers « non-cancer »</figcaption></figure>
            ) : <p className="muted">Carte d'occlusion non demandée.</p>}
          </div>
          {ml.location && <p>Zone la plus déterminante : <b>{ml.location}</b>.</p>}
          <p className="muted small">Méthode : chaque zone (8×8) est masquée tour à tour ; on mesure la baisse de probabilité du modèle final. Fidélité testée : baisse moyenne de 0,29 contre 0,01 pour des zones au hasard (p = 1,8·10⁻¹²).</p>
        </section>

        <section className="card">
          <h3>Facteurs qui ont influencé la décision</h3>
          <Contributions items={ml.contributions} />
          <p className="muted small">Contribution au logit : on remplace chaque élément par une valeur de référence et on mesure la variation (équivalent SHAP pour un modèle linéaire).</p>
          <h3>Caractéristiques visuelles détectées</h3>
          <div className="chips">
            {ml.concepts.map((c) => <span key={c.name} className="chip" title={`score z = ${c.z}`}>{c.label}</span>)}
          </div>
          <p className="muted small">Concepts cliniques mesurés par DermLIP (similarité image / texte), à titre descriptif.</p>
        </section>
      </div>

      <section className="card">
        <div className="report-head">
          <h3>Compte rendu</h3>
          <div className="segmented">
            <button disabled={busy} className={data.reportStyle === "medecin" ? "active" : ""} onClick={() => regenerate("medecin")}>Médecin</button>
            <button disabled={busy} className={data.reportStyle === "patient" ? "active" : ""} onClick={() => regenerate("patient")}>Patient</button>
          </div>
        </div>
        {busy && <div className="loading"><div className="spinner" /> Reformulation par le LLM local…</div>}
        {error && <div className="alert error">{error}</div>}
        {llm?.text ? (
          <>
            <div className="llm-tag">Reformulé par le LLM local <b>{llm.model}</b> (LM Studio, {((llm.durationMs || 0) / 1000).toFixed(1)} s) — le LLM ne voit pas l'image et ne modifie pas la décision.</div>
            <RichText className="report" text={llm.text} />
          </>
        ) : (
          <div className="alert info">LLM non disponible ({llm?.status || "—"}) : compte rendu par gabarit ci-dessous.</div>
        )}
        <details open={!llm?.text}>
          <summary>Compte rendu source (gabarit calculé à partir des sorties du modèle)</summary>
          <pre className="report">{ml.templateReport}</pre>
        </details>
      </section>
    </div>
  );
}
