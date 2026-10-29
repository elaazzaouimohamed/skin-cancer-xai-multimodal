import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, PageHeader, REGIONS, Segmented } from "../components/ui.jsx";

const SYMPTOMS = [
  ["bleed", "La lésion saigne"], ["grew", "La lésion a grossi"], ["changed", "La lésion a changé d'aspect"],
  ["hurt", "La lésion fait mal"], ["itch", "La lésion démange"], ["elevation", "La lésion est en relief"],
];
const STEPS = [
  "Envoi de la photo et des données cliniques",
  "Encodage de l'image par DermLIP",
  "Calcul de la probabilité par le modèle multimodal",
  "Carte d'occlusion : 64 zones masquées une à une",
  "Reformulation du compte rendu par le LLM local",
];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const { isPatient } = useAuth();
  const [params] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(params.get("patient") || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [age, setAge] = useState("");
  const [region, setRegion] = useState("");
  const [symptoms, setSymptoms] = useState(Object.fromEntries(SYMPTOMS.map(([k]) => [k, null])));
  const [occlusion, setOcclusion] = useState(true);
  const [style, setStyle] = useState(isPatient ? "patient" : "medecin");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isPatient) api.patients().then(setPatients).catch(() => setPatients([]));
  }, [isPatient]);

  // Pre-fills the age from the patient record
  useEffect(() => {
    const p = patients.find((x) => String(x.id) === String(patientId));
    if (p?.age != null) setAge(String(p.age));
  }, [patientId, patients]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4000);
    return () => clearInterval(t);
  }, [busy]);

  // Paste of an image (Ctrl+V)
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) setFile(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Ajoutez une photo de la lésion.");
    setError(null);
    setBusy(true);
    setStep(0);
    try {
      const clinical = { age: age === "" ? null : Number(age), region: region || null, ...symptoms };
      const res = await api.create({ file, clinical, occlusion, style, patientId: patientId || null });
      navigate(`/analyses/${res.id}`, { state: { result: res } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const selected = patients.find((x) => String(x.id) === String(patientId));

  return (
    <>
      <PageHeader title="Nouvelle analyse" subtitle="Photo de la lésion + données cliniques → probabilité calculée par le modèle entraîné, avec explications." />
      <form className="grid-2" onSubmit={submit}>
        <section className="card">
          <div className="step-title"><span>1</span> Photo de la lésion</div>
          <label className={`dropzone ${preview ? "has-image" : ""} ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            {preview ? <img src={preview} alt="Aperçu de la lésion" /> : (
              <span className="dropzone-empty">
                <span className="dropzone-icon"><Icon name="image" size={30} /></span>
                <b>Glissez une photo ici, collez-la (Ctrl+V) ou cliquez pour choisir</b>
                <small>JPEG ou PNG · photo de smartphone · lésion centrée et nette · 15 Mo max.</small>
              </span>
            )}
            <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <div className="file-line">
              <Icon name="image" size={16} /> {file.name} — {(file.size / 1024).toFixed(0)} Ko
              <button type="button" className="link danger" onClick={() => setFile(null)}>Retirer</button>
            </div>
          )}
          <div className="tips">
            <b>Pour une analyse fiable</b>
            <ul>
              <li>Lumière naturelle, sans flash ni reflet.</li>
              <li>Lésion au centre, occupant environ la moitié de l'image.</li>
              <li>Évitez les marques de stylo ou d'encre sur la peau (biais connu du modèle).</li>
            </ul>
          </div>
        </section>

        <section className="card">
          {!isPatient && (
            <>
              <div className="step-title"><span>2</span> Dossier patient</div>
              <label className="field">Rattacher l'analyse à
                <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">— aucun dossier (analyse ponctuelle) —</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.lastName} {p.firstName}{p.age != null ? ` · ${p.age} ans` : ""}</option>)}
                </select>
              </label>
              {selected && <p className="hint">L'âge est pré-rempli d'après l'année de naissance ({selected.birthYear ?? "non renseignée"}).</p>}
            </>
          )}

          <div className="step-title"><span>{isPatient ? 2 : 3}</span> Données cliniques</div>
          <div className="form-row">
            <label className="field">Âge
              <input type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ex. 62" />
            </label>
            <label className="field">Localisation
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">— non renseignée —</option>
                {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="symptoms">
            {SYMPTOMS.map(([key, label]) => (
              <div key={key} className="symptom">
                <span>{label}</span>
                <Segmented value={symptoms[key]} onChange={(v) => setSymptoms((s) => ({ ...s, [key]: v }))}
                  options={[[true, "Oui"], [false, "Non"], [null, "?"]]} />
              </div>
            ))}
          </div>
          <p className="hint">« ? » = non renseigné : la valeur est complétée par le modèle (imputation apprise sur l'entraînement).</p>

          <div className="step-title"><span>{isPatient ? 3 : 4}</span> Options</div>
          <label className="check"><input type="checkbox" checked={occlusion} onChange={(e) => setOcclusion(e.target.checked)} />
            <span>Carte d'occlusion <span className="muted">(zones de l'image qui ont pesé dans la décision, ≈ 10–20 s sur CPU)</span></span></label>
          <div className="inline-field">
            <span>Compte rendu destiné au</span>
            <Segmented value={style} onChange={setStyle} options={[["medecin", "Médecin"], ["patient", "Patient"]]} />
          </div>

          <Alert>{error}</Alert>
          <button className="btn primary block lg" type="submit" disabled={busy}>
            <Icon name="sparkles" /> {busy ? "Analyse en cours…" : "Lancer l'analyse"}
          </button>
          {busy && (
            <ol className="progress-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i < step ? "done" : i === step ? "current" : ""}>
                  {i < step ? <Icon name="check" size={14} /> : i === step ? <span className="spinner sm" /> : <span className="dot-step" />} {s}
                </li>
              ))}
            </ol>
          )}
        </section>
      </form>
    </>
  );
}
