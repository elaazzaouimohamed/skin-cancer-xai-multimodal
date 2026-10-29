import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import AnalysisTable from "../components/AnalysisTable.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, Empty, Loading, PageHeader, SUSPICION } from "../components/ui.jsx";

const FILTERS = [["tous", "Toutes"], ["suspicion", "Suspicions"], ["rassurant", "Pas de signe fort"]];

export default function History() {
  const { isAdmin, isPatient } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("tous");
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);

  const load = () => api.history().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (r) => {
    if (!window.confirm(`Supprimer l'analyse n° ${r.id} ?`)) return;
    try {
      await api.remove(r.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const shown = useMemo(() => {
    let r = rows || [];
    if (filter === "suspicion") r = r.filter((x) => x.decision === SUSPICION);
    if (filter === "rassurant") r = r.filter((x) => x.decision !== SUSPICION);
    const s = q.trim().toLowerCase();
    if (s) r = r.filter((x) => `${x.id} ${x.patientName || ""} ${x.ownerName || ""}`.toLowerCase().includes(s));
    return r;
  }, [rows, filter, q]);

  return (
    <>
      <PageHeader title={isAdmin ? "Toutes les analyses" : isPatient ? "Mes analyses" : "Historique des analyses"}
        subtitle={rows ? `${rows.length} analyse${rows.length > 1 ? "s" : ""} (100 plus récentes)` : null}>
        <Link to="/analyse" className="btn primary"><Icon name="scan" /> Nouvelle analyse</Link>
      </PageHeader>
      <Alert onClose={() => setError(null)}>{error}</Alert>
      <section className="card">
        <div className="toolbar">
          <div className="tabs">
            {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          {!isPatient && <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, patient, auteur…" /></label>}
        </div>
        {!rows ? <Loading /> : shown.length === 0 ? (
          <Empty icon="history" title={rows.length ? "Aucune analyse dans cette vue" : "Aucune analyse pour le moment"}>
            {!rows.length && <Link to="/analyse">Lancer une première analyse</Link>}
          </Empty>
        ) : <AnalysisTable rows={shown} showPatient={!isPatient} showOwner={isAdmin} onDelete={remove} />}
      </section>
    </>
  );
}
