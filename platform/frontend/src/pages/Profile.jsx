import { useState } from "react";
import { api } from "../api.js";
import { ROLE_LABEL, useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, Avatar, fmtDate, PageHeader, RoleBadge } from "../components/ui.jsx";

export default function Profile() {
  const { user, refresh, isPatient } = useAuth();
  const [p, setP] = useState({ fullName: user.fullName, specialty: user.specialty || "", institution: user.institution || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      refresh(await api.updateProfile(p));
      setMsg("Profil mis à jour.");
    } catch (err) { setError(err.message); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw.newPassword !== pw.confirm) return setError("Les deux nouveaux mots de passe ne correspondent pas.");
    try {
      await api.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setMsg("Mot de passe modifié.");
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <PageHeader title="Mon profil" subtitle="Informations du compte et sécurité." />
      <Alert onClose={() => setError(null)}>{error}</Alert>
      <Alert kind="success" onClose={() => setMsg(null)}>{msg}</Alert>
      <div className="grid-side">
        <section className="card identity">
          <div className="identity-head">
            <Avatar name={user.fullName} size={64} />
            <div><h2>{user.fullName}</h2><RoleBadge role={user.role} /></div>
          </div>
          <dl className="facts">
            <dt>E-mail</dt><dd>{user.email}</dd>
            <dt>Rôle</dt><dd>{ROLE_LABEL[user.role]}</dd>
            <dt>Membre depuis</dt><dd>{fmtDate(user.createdAt)}</dd>
          </dl>
        </section>
        <div>
          <section className="card">
            <h3><Icon name="user" /> Informations</h3>
            <form className="form" onSubmit={saveProfile}>
              <label className="field">Nom complet<input required maxLength={120} value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} /></label>
              {!isPatient && (
                <div className="form-row">
                  <label className="field">Spécialité<input maxLength={120} value={p.specialty} onChange={(e) => setP({ ...p, specialty: e.target.value })} /></label>
                  <label className="field">Établissement<input maxLength={160} value={p.institution} onChange={(e) => setP({ ...p, institution: e.target.value })} /></label>
                </div>
              )}
              <div><button className="btn primary">Enregistrer</button></div>
            </form>
          </section>
          <section className="card">
            <h3><Icon name="lock" /> Mot de passe</h3>
            <form className="form" onSubmit={savePassword}>
              <label className="field">Mot de passe actuel<input type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
              <div className="form-row">
                <label className="field">Nouveau mot de passe<input type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
                <label className="field">Confirmation<input type="password" required minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></label>
              </div>
              <div><button className="btn primary">Changer le mot de passe</button></div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
