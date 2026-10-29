import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import Icon from "../components/Icon.jsx";
import { Alert } from "../components/ui.jsx";

const ROLES = [
  ["DOCTOR", "stethoscope", "Médecin", "Dossiers patients, suivi, comptes rendus médecin. Validation par un administrateur."],
  ["PATIENT", "user", "Patient", "Analysez vos propres photos et échangez avec l'assistant. Compte actif immédiatement."],
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ role: "DOCTOR", fullName: "", email: "", password: "", confirm: "", specialty: "", institution: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    setError(null);
    try {
      const { confirm, ...body } = form; // eslint-disable-line no-unused-vars
      const r = await register(body);
      if (r.token) navigate("/", { replace: true });
      else navigate("/connexion", { replace: true, state: { message: r.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(form.password)).length;

  return (
    <AuthLayout title="Créer un compte" subtitle="Choisissez votre profil.">
      <Alert onClose={() => setError(null)}>{error}</Alert>
      <form onSubmit={submit} className="form">
        <div className="role-picker">
          {ROLES.map(([value, icon, label, desc]) => (
            <label key={value} className={`role-option ${form.role === value ? "active" : ""}`}>
              <input type="radio" name="role" value={value} checked={form.role === value} onChange={set("role")} />
              <span className="role-icon"><Icon name={icon} size={20} /></span>
              <b>{label}</b>
              <span className="muted small">{desc}</span>
            </label>
          ))}
        </div>
        <label className="field">Nom complet
          <input required maxLength={120} value={form.fullName} onChange={set("fullName")} placeholder={form.role === "DOCTOR" ? "Dr Salma Benali" : "Prénom Nom"} />
        </label>
        <label className="field">E-mail
          <input type="email" required autoComplete="username" value={form.email} onChange={set("email")} placeholder="nom@exemple.ma" />
        </label>
        {form.role === "DOCTOR" && (
          <div className="form-row">
            <label className="field">Spécialité
              <input maxLength={120} value={form.specialty} onChange={set("specialty")} placeholder="Dermatologie" />
            </label>
            <label className="field">Établissement
              <input maxLength={160} value={form.institution} onChange={set("institution")} placeholder="CHU Ibn Rochd" />
            </label>
          </div>
        )}
        <div className="form-row">
          <label className="field">Mot de passe
            <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} />
          </label>
          <label className="field">Confirmation
            <input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
          </label>
        </div>
        <div className="strength" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < strength ? `on s${strength}` : ""} />)}
          <span className="muted small">8 caractères minimum ; majuscule, chiffre et symbole recommandés</span>
        </div>
        <button className="btn primary block lg" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</button>
      </form>
      <p className="auth-switch">Déjà inscrit ? <Link to="/connexion">Se connecter</Link></p>
    </AuthLayout>
  );
}
