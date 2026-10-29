import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { DecisionBadge, fmtDateTime, ProbBar, REGION_FR } from "./ui.jsx";

/** Table of analyses; optional columns depending on the role. */
export default function AnalysisTable({ rows, showPatient = false, showOwner = false, onDelete }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Photo</th><th>Date</th>
            {showPatient && <th>Patient</th>}
            {showOwner && <th>Auteur</th>}
            <th>Âge</th><th>Localisation</th><th>Probabilité</th><th>Conclusion</th>
            {onDelete && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="clickable" onClick={() => navigate(`/analyses/${r.id}`)}>
              <td><img className="thumb" src={api.imageUrl(r.id)} alt={`Analyse ${r.id}`} loading="lazy" /></td>
              <td><b>n° {r.id}</b><div className="muted small">{fmtDateTime(r.createdAt)}</div></td>
              {showPatient && (
                <td onClick={(e) => e.stopPropagation()}>
                  {r.patientId ? <Link to={`/patients/${r.patientId}`}>{r.patientName || `Patient ${r.patientId}`}</Link> : <span className="muted">—</span>}
                </td>
              )}
              {showOwner && <td>{r.ownerName || <span className="muted">compte supprimé</span>}</td>}
              <td>{r.age ?? "—"}</td>
              <td>{r.region ? REGION_FR[r.region] || r.region : "—"}</td>
              <td><ProbBar value={r.probability} threshold={r.threshold} /></td>
              <td><DecisionBadge decision={r.decision} /></td>
              {onDelete && (
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="icon-only danger" title="Supprimer" onClick={() => onDelete(r)}><Icon name="trash" size={16} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
