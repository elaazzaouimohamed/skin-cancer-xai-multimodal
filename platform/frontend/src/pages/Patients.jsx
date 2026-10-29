import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import PatientForm from "../components/PatientForm.jsx";
import { Alert, Avatar, DecisionBadge, Empty, fmtDate, Loading, PageHeader, SUSPICION } from "../components/ui.jsx";

const VIEWS = [["tous", "Tous"], ["suspicion", "À revoir"], ["sans", "Sans analyse"]];

export default function Patients() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState("tous");
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(params.get("nouveau") === "1");

  useEffect(() => { api.patients().then(setList).catch((e) => setError(e.message)); }, []);

  const rows = useMemo(() => {
    let r = list || [];
    if (view === "suspicion") r = r.filter((p) => p.lastDecision === SUSPICION);
    if (view === "sans") r = r.filter((p) => p.analysesCount === 0);
    const s = q.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (s) r = r.filter((p) => `${p.firstName} ${p.lastName} ${p.phone || ""} ${p.doctorName || ""}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(s));
    return r;
  }, [list, q, view]);

  const closeForm = () => { setCreating(false); if (params.get("nouveau")) setParams({}); };

  return (
    <>
      <PageHeader title={isAdmin ? "Dossiers patients" : "Mes patients"}
        subtitle={list ? `${list.length} dossier${list.length > 1 ? "s" : ""}${isAdmin ? " sur la plateforme" : " suivis"}` : null}>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Nouveau patient</button>
      </PageHeader>
      <Alert onClose={() => setError(null)}>{error}</Alert>

      <section className="card">
        <div className="toolbar">
          <div className="tabs">
            {VIEWS.map(([k, label]) => <button key={k} className={view === k ? "active" : ""} onClick={() => setView(k)}>{label}</button>)}
          </div>
          <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un patient…" /></label>
        </div>

        {!list ? <Loading /> : rows.length === 0 ? (
          <Empty icon="folder" title={list.length ? "Aucun patient ne correspond" : "Aucun dossier patient"}>
            {!list.length && <button className="btn primary sm" onClick={() => setCreating(true)}><Icon name="plus" /> Créer le premier dossier</button>}
          </Empty>
        ) : (
          <div className="patient-grid">
            {rows.map((p) => (
              <Link key={p.id} to={`/patients/${p.id}`} className={`patient-card ${p.lastDecision === SUSPICION ? "flag" : ""}`}>
                <div className="patient-card-head">
                  <Avatar name={`${p.firstName} ${p.lastName}`} size={44} tone={p.lastDecision === SUSPICION ? "bad" : "brand"} />
                  <div>
                    <b>{p.firstName} {p.lastName}</b>
                    <span className="muted small block">
                      {[p.age != null ? `${p.age} ans` : null, p.sex === "F" ? "Femme" : p.sex === "M" ? "Homme" : null, p.phototype ? `phototype ${p.phototype}` : null].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                </div>
                <DecisionBadge decision={p.lastDecision} probability={p.lastProbability} />
                <div className="patient-card-foot">
                  <span><Icon name="scan" size={14} /> {p.analysesCount} analyse{p.analysesCount > 1 ? "s" : ""}</span>
                  <span><Icon name="clock" size={14} /> {p.lastAnalysisAt ? fmtDate(p.lastAnalysisAt) : "jamais"}</span>
                </div>
                {isAdmin && <div className="muted small">Référent : {p.doctorName || "—"}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {creating && <PatientForm onClose={closeForm} onSaved={(p) => { closeForm(); navigate(`/patients/${p.id}`); }} />}
    </>
  );
}
