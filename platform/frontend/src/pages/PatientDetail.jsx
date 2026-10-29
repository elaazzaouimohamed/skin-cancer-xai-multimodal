import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import AnalysisTable from "../components/AnalysisTable.jsx";
import { TrendChart } from "../components/Charts.jsx";
import Icon from "../components/Icon.jsx";
import PatientForm from "../components/PatientForm.jsx";
import { Alert, Avatar, DecisionBadge, Empty, fmtDate, Loading, PageHeader, SUSPICION } from "../components/ui.jsx";

export default function PatientDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => api.patient(id).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    if (!window.confirm(`Supprimer le dossier de ${data.patient.firstName} ${data.patient.lastName} et ses ${data.analyses.length} analyse(s) ? Cette action est définitive.`)) return;
    try {
      await api.patientDelete(id);
      navigate("/patients");
    } catch (e) {
      setError(e.message);
    }
  };

  const removeAnalysis = async (a) => {
    if (!window.confirm(`Supprimer l'analyse n° ${a.id} ?`)) return;
    try { await api.remove(a.id); load(); } catch (e) { setError(e.message); }
  };

  if (error && !data) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  const p = data.patient;
  const name = `${p.firstName} ${p.lastName}`;
  const suspect = p.lastDecision === SUSPICION;

  return (
    <>
      <PageHeader title={name} back={{ to: "/patients", label: "Patients" }}>
        <Link to={`/chat?patient=${p.id}`} className="btn ghost"><Icon name="chat" /> Conversation de suivi</Link>
        <Link to={`/analyse?patient=${p.id}`} className="btn primary"><Icon name="scan" /> Nouvelle analyse</Link>
      </PageHeader>
      <Alert onClose={() => setError(null)}>{error}</Alert>

      <div className="grid-side">
        <section className={`card identity ${suspect ? "flag" : ""}`}>
          <div className="identity-head">
            <Avatar name={name} size={64} tone={suspect ? "bad" : "brand"} />
            <div>
              <h2>{name}</h2>
              <DecisionBadge decision={p.lastDecision} probability={p.lastProbability} />
            </div>
          </div>
          <dl className="facts">
            <dt>Âge</dt><dd>{p.age != null ? `${p.age} ans (né·e en ${p.birthYear})` : "—"}</dd>
            <dt>Sexe</dt><dd>{p.sex === "F" ? "Femme" : p.sex === "M" ? "Homme" : "—"}</dd>
            <dt>Phototype</dt><dd>{p.phototype ? `Fitzpatrick ${p.phototype}` : "—"}</dd>
            <dt>Téléphone</dt><dd>{p.phone || "—"}</dd>
            {isAdmin && <><dt>Médecin référent</dt><dd>{p.doctorName || "—"}</dd></>}
            <dt>Dossier créé</dt><dd>{fmtDate(p.createdAt)}</dd>
            <dt>Analyses</dt><dd>{p.analysesCount}</dd>
          </dl>
          {p.notes && <div className="notes"><b>Notes cliniques</b><p>{p.notes}</p></div>}
          <div className="identity-actions">
            <button className="btn ghost sm" onClick={() => setEditing(true)}><Icon name="edit" size={15} /> Modifier</button>
            <button className="btn danger-ghost sm" onClick={remove}><Icon name="trash" size={15} /> Supprimer</button>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Évolution de la probabilité</h3></div>
          {data.analyses.length === 0 ? (
            <Empty icon="activity" title="Aucune analyse dans ce dossier">
              <Link to={`/analyse?patient=${p.id}`} className="btn primary sm"><Icon name="scan" /> Première analyse</Link>
            </Empty>
          ) : (
            <>
              <TrendChart points={data.analyses} threshold={data.analyses[0].threshold} />
              <p className="muted small">Chaque point est une analyse du modèle multimodal ; au-dessus du seuil, la lésion est classée « suspicion ». Comparer des photos de la même lésion permet de suivre son évolution.</p>
            </>
          )}
        </section>
      </div>

      {data.analyses.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Analyses du dossier</h3></div>
          <AnalysisTable rows={data.analyses} onDelete={removeAnalysis} />
        </section>
      )}

      {editing && <PatientForm patient={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </>
  );
}
