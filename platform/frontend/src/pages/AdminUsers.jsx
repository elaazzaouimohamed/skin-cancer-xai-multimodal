import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, Avatar, Empty, fmtDate, fmtDateTime, Loading, Modal, PageHeader, RoleBadge } from "../components/ui.jsx";

const FILTERS = [
  ["tous", "Tous"], ["attente", "En attente"], ["DOCTOR", "Médecins"], ["PATIENT", "Patients"], ["ADMIN", "Administrateurs"], ["inactifs", "Désactivés"],
];
const EMPTY = { fullName: "", email: "", password: "", role: "DOCTOR", specialty: "", institution: "", enabled: true };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filtre") || "tous";
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [creating, setCreating] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.adminUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const u = users || [];
    return {
      tous: u.length, attente: u.filter((x) => x.role === "DOCTOR" && !x.enabled).length,
      DOCTOR: u.filter((x) => x.role === "DOCTOR").length, PATIENT: u.filter((x) => x.role === "PATIENT").length,
      ADMIN: u.filter((x) => x.role === "ADMIN").length, inactifs: u.filter((x) => !x.enabled).length,
    };
  }, [users]);

  const rows = useMemo(() => {
    let u = users || [];
    if (filter === "attente") u = u.filter((x) => x.role === "DOCTOR" && !x.enabled);
    else if (filter === "inactifs") u = u.filter((x) => !x.enabled);
    else if (filter !== "tous") u = u.filter((x) => x.role === filter);
    const s = q.trim().toLowerCase();
    if (s) u = u.filter((x) => `${x.fullName} ${x.email} ${x.specialty || ""} ${x.institution || ""}`.toLowerCase().includes(s));
    return u;
  }, [users, filter, q]);

  const run = async (fn, okMessage) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const update = (u, body, msg) => run(() => api.adminUpdateUser(u.id, body), msg);
  const remove = (u) => window.confirm(`Supprimer définitivement le compte de ${u.fullName} ? Ses conversations seront supprimées ; ses analyses restent dans l'historique.`)
    && run(() => api.adminDeleteUser(u.id), `Compte de ${u.fullName} supprimé.`);

  const submitCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminCreateUser(creating);
      setCreating(null);
      setNotice(`Compte de ${creating.fullName} créé.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminUpdateUser(resetting.user.id, { password: resetting.password });
      setNotice(`Mot de passe de ${resetting.user.fullName} réinitialisé : communiquez-le par un canal sûr.`);
      setResetting(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setC = (k) => (e) => setCreating((c) => ({ ...c, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Validez les médecins, gérez les rôles et l'accès à la plateforme." back={{ to: "/", label: "Tableau de bord" }}>
        <button className="btn primary" onClick={() => setCreating({ ...EMPTY })}><Icon name="plus" /> Créer un compte</button>
      </PageHeader>
      <Alert onClose={() => setError(null)}>{error}</Alert>
      <Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert>

      <section className="card">
        <div className="toolbar">
          <div className="tabs">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={filter === k ? "active" : ""} onClick={() => setParams(k === "tous" ? {} : { filtre: k })}>
                {label} <span className="count">{counts[k]}</span>
              </button>
            ))}
          </div>
          <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, un e-mail…" /></label>
        </div>

        {!users ? <Loading /> : rows.length === 0 ? <Empty icon="users" title="Aucun compte dans cette vue" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Inscription</th><th>Dernière connexion</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {rows.map((u) => {
                  const self = u.id === me.id;
                  const pending = u.role === "DOCTOR" && !u.enabled;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <Avatar name={u.fullName} size={36} tone={u.role === "ADMIN" ? "dark" : u.role === "PATIENT" ? "soft" : "brand"} />
                          <span><b>{u.fullName}</b>{self && <span className="you">vous</span>}
                            <span className="muted small block">{u.email}</span>
                            {(u.specialty || u.institution) && <span className="muted small block">{[u.specialty, u.institution].filter(Boolean).join(" · ")}</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        {self ? <RoleBadge role={u.role} /> : (
                          <select className="select-sm" value={u.role} onChange={(e) => update(u, { role: e.target.value }, `Rôle de ${u.fullName} modifié.`)}>
                            <option value="DOCTOR">Médecin</option><option value="PATIENT">Patient</option><option value="ADMIN">Administrateur</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {pending ? <span className="status pending">En attente</span>
                          : u.enabled ? <span className="status on">Actif</span> : <span className="status off">Désactivé</span>}
                      </td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="muted">jamais</span>}</td>
                      <td>
                        <div className="row-actions">
                          {pending && <button className="btn success sm" onClick={() => update(u, { enabled: true }, `${u.fullName} peut maintenant se connecter.`)}><Icon name="check" size={15} /> Valider</button>}
                          {!self && !pending && (u.enabled
                            ? <button className="icon-only" title="Désactiver" onClick={() => update(u, { enabled: false }, `Compte de ${u.fullName} désactivé.`)}><Icon name="ban" size={16} /></button>
                            : <button className="icon-only" title="Réactiver" onClick={() => update(u, { enabled: true }, `Compte de ${u.fullName} réactivé.`)}><Icon name="check" size={16} /></button>)}
                          <button className="icon-only" title="Réinitialiser le mot de passe" onClick={() => setResetting({ user: u, password: "" })}><Icon name="key" size={16} /></button>
                          {!self && <button className="icon-only danger" title="Supprimer" onClick={() => remove(u)}><Icon name="trash" size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && (
        <Modal title="Créer un compte" onClose={() => setCreating(null)}
          footer={<><button className="btn ghost" onClick={() => setCreating(null)}>Annuler</button><button className="btn primary" form="create-user" disabled={busy}>Créer</button></>}>
          <form id="create-user" className="form" onSubmit={submitCreate}>
            <div className="form-row">
              <label className="field">Nom complet<input required value={creating.fullName} onChange={setC("fullName")} /></label>
              <label className="field">Rôle
                <select value={creating.role} onChange={setC("role")}>
                  <option value="DOCTOR">Médecin</option><option value="PATIENT">Patient</option><option value="ADMIN">Administrateur</option>
                </select>
              </label>
            </div>
            <label className="field">E-mail<input type="email" required value={creating.email} onChange={setC("email")} /></label>
            <label className="field">Mot de passe provisoire<input type="text" required minLength={8} value={creating.password} onChange={setC("password")} autoComplete="new-password" /></label>
            {creating.role === "DOCTOR" && (
              <div className="form-row">
                <label className="field">Spécialité<input value={creating.specialty} onChange={setC("specialty")} /></label>
                <label className="field">Établissement<input value={creating.institution} onChange={setC("institution")} /></label>
              </div>
            )}
            <label className="check"><input type="checkbox" checked={creating.enabled} onChange={setC("enabled")} /> Compte actif immédiatement</label>
          </form>
        </Modal>
      )}

      {resetting && (
        <Modal title={`Nouveau mot de passe — ${resetting.user.fullName}`} onClose={() => setResetting(null)}
          footer={<><button className="btn ghost" onClick={() => setResetting(null)}>Annuler</button><button className="btn primary" form="reset-pw" disabled={busy}>Enregistrer</button></>}>
          <form id="reset-pw" className="form" onSubmit={submitReset}>
            <label className="field">Mot de passe provisoire (8 caractères minimum)
              <input type="text" required minLength={8} autoComplete="new-password" value={resetting.password}
                onChange={(e) => setResetting((r) => ({ ...r, password: e.target.value }))} />
            </label>
            <p className="muted small">L'utilisateur pourra le changer depuis « Mon profil ».</p>
          </form>
        </Modal>
      )}
    </>
  );
}
