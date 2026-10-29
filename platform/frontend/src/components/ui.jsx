import { useEffect } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

export const SUSPICION = "suspicion_cancer";

export const REGIONS = [
  ["FACE", "visage"], ["NOSE", "nez"], ["EAR", "oreille"], ["LIP", "lèvre"], ["SCALP", "cuir chevelu"],
  ["NECK", "cou"], ["CHEST", "thorax"], ["BACK", "dos"], ["ABDOMEN", "abdomen"], ["ARM", "bras"],
  ["FOREARM", "avant-bras"], ["HAND", "main"], ["THIGH", "cuisse"], ["FOOT", "pied"],
];
export const REGION_FR = Object.fromEntries(REGIONS);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtPct = (v) => (v == null ? "—" : `${Math.round(v * 100)} %`);

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

export function Avatar({ name, size = 36, tone = "brand" }) {
  return <span className={`avatar-initials ${tone}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
}

export function DecisionBadge({ decision, probability }) {
  if (!decision) return <span className="badge neutral">Aucune analyse</span>;
  const bad = decision === SUSPICION;
  return (
    <span className={`badge ${bad ? "bad" : "good"}`}>
      <Icon name={bad ? "alert" : "check"} size={13} strokeWidth={2.2} />
      {bad ? "Suspicion" : "Pas de signe fort"}{probability != null && <> · {fmtPct(probability)}</>}
    </span>
  );
}

export function RoleBadge({ role }) {
  const label = { ADMIN: "Administrateur", DOCTOR: "Médecin", PATIENT: "Patient" }[role] || role;
  return <span className={`role-badge ${role?.toLowerCase()}`}>{label}</span>;
}

export function PageHeader({ title, subtitle, children, back }) {
  return (
    <div className="page-header">
      <div>
        {back && <Link to={back.to} className="back-link"><Icon name="arrowLeft" size={15} /> {back.label}</Link>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = "brand", to }) {
  const body = (
    <>
      <span className={`stat-icon ${tone}`}><Icon name={icon} size={20} /></span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </>
  );
  return to ? <Link to={to} className="stat-card link">{body}</Link> : <div className="stat-card">{body}</div>;
}

export function Loading({ label = "Chargement…" }) {
  return <div className="loading"><div className="spinner" /> {label}</div>;
}

export function Empty({ icon = "sparkles", title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Alert({ kind = "error", children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={kind === "error" ? "alert" : "info"} size={16} />
      <span>{children}</span>
      {onClose && <button className="alert-close" onClick={onClose} aria-label="Fermer"><Icon name="x" size={14} /></button>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-only" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Segmented({ value, options, onChange, disabled }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button type="button" key={String(v)} disabled={disabled} className={value === v ? "active" : ""} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

/** Horizontal bar of a probability with the triage threshold marked. */
export function ProbBar({ value, threshold = 0.375 }) {
  const bad = value >= threshold;
  return (
    <span className="probbar" title={`Probabilité ${fmtPct(value)} · seuil ${fmtPct(threshold)}`}>
      <span className="probbar-track">
        <span className={`probbar-fill ${bad ? "bad" : "good"}`} style={{ width: `${Math.max(2, value * 100)}%` }} />
        <span className="probbar-th" style={{ left: `${threshold * 100}%` }} />
      </span>
      <span className="probbar-val">{fmtPct(value)}</span>
    </span>
  );
}
