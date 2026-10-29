import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Loading, PageHeader } from "../components/ui.jsx";

// Results measured on Kaggle (version 2, pipeline 01→06, test = 358 images never seen).
const RESULTS = [
  ["Clinique seule (logistique)", "0,842", "validation croisée"],
  ["Image seule — ViT-B/16 ImageNet", "0,862", "validation croisée"],
  ["Image seule — DermLIP (Derm1M)", "0,920", "validation croisée (+0,058 vs ImageNet, IC95 [+0,044 ; +0,072])"],
  ["Concepts cliniques seuls", "0,845", "validation croisée"],
  ["Fusion tardive image + clinique (modèle retenu)", "0,931", "validation croisée"],
  ["Ajustement fin de DermLIP (E9, exploratoire)", "0,937", "validation croisée (+0,012, IC95 [+0,004 ; +0,019])"],
  ["Modèle retenu — ENSEMBLE DE TEST", "0,947 [0,918 ; 0,971]", "+0,051 vs clinique seule, IC95 [+0,012 ; +0,091]"],
];

export default function About() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.modelInfo().then(setInfo).catch((e) => setError(e.message)); }, []);

  return (
    <div className="about">
      <PageHeader title="Modèle & méthode" subtitle="Comment la décision est calculée, évaluée et expliquée." />
      <section className="card">
        <h2>Principe</h2>
        <div className="pipeline">
          <div className="step"><b>Photo</b><span>smartphone</span></div><div className="arrow">→</div>
          <div className="step"><b>DermLIP</b><span>encodeur vision-langage préentraîné sur Derm1M</span></div><div className="arrow">→</div>
          <div className="step"><b>Fusion</b><span>image + âge, localisation, 6 symptômes</span></div><div className="arrow">→</div>
          <div className="step accent"><b>Décision</b><span>probabilité + seuil de triage</span></div><div className="arrow">→</div>
          <div className="step"><b>Explications</b><span>occlusion, contributions, concepts</span></div><div className="arrow">→</div>
          <div className="step"><b>LLM local</b><span>reformulation seulement</span></div>
        </div>
        <p><b>La décision vient du modèle entraîné et évalué ; le LLM ne sert qu'à la présentation.</b> Il reçoit uniquement les valeurs calculées (jamais l'image), un garde-fou vérifie que la probabilité et la conclusion ne sont pas modifiées, et le compte rendu source reste toujours affiché.</p>
      </section>

      <section className="card">
        <h2>Résultats (PAD-UFES-20, découpage par patient)</h2>
        <table className="table">
          <thead><tr><th>Modèle</th><th>AUC</th><th>Remarque</th></tr></thead>
          <tbody>{RESULTS.map(([m, auc, note]) => <tr key={m}><td>{m}</td><td><b>{auc}</b></td><td className="muted">{note}</td></tr>)}</tbody>
        </table>
        <p>Au seuil de triage (fixé sur le développement) : <b>sensibilité 96,8 %</b>, spécificité 78,5 %, calibration ECE 0,059. Détection par type : BCC 99 %, SCC 91 %, mélanome 71 % (7 cas en test).</p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Rigueur méthodologique</h2>
          <ul>
            <li>Découpage <b>groupé par patient</b> (aucun patient dans deux ensembles), test utilisé une seule fois.</li>
            <li>Hyperparamètres choisis par <b>validation croisée imbriquée</b> ; modèle choisi par une règle fixée à l'avance.</li>
            <li>Intervalles de confiance par <b>bootstrap des patients</b>.</li>
            <li>Raccourci détecté et exclu : profil patient manquant pour 0 % des cancers (AUC 0,83 sans image).</li>
            <li>Fidélité des cartes d'occlusion testée statistiquement.</li>
          </ul>
        </section>
        <section className="card">
          <h2>Limites connues</h2>
          <ul>
            <li><b>Biais « encre chirurgicale »</b> : marques sur 15,4 % des mélanomes ; le modèle y prête attention (rapport 1,53).</li>
            <li>Peu de mélanomes (52 au total) et peu de peaux foncées (phototypes IV–VI).</li>
            <li>Un seul centre (Brésil) : validation externe nécessaire.</li>
            <li>DermLIP : licence CC BY-NC-ND 4.0, usage de recherche uniquement.</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <h2>Modèle chargé</h2>
        {error && <div className="alert error">{error}</div>}
        {info ? (
          <ul>
            <li>Modèle : <b>{info.modelName}</b> ({info.modelOrigin})</li>
            <li>Encodeur : {info.encoder} sur {info.device}</li>
            <li>Seuil principal : {info.thresholdName} = {info.threshold.toFixed(3)}</li>
            <li>Concepts cliniques ({info.concepts.length}) : {info.concepts.map((c) => c.label).join(" · ")}</li>
          </ul>
        ) : !error && <Loading />}
      </section>
    </div>
  );
}
