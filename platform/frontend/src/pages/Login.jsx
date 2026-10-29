import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import Icon from "../components/Icon.jsx";
import { Alert } from "../components/ui.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace DermAI.">
      {location.state?.message && <Alert kind="info">{location.state.message}</Alert>}
      <Alert onClose={() => setError(null)}>{error}</Alert>
      <form onSubmit={submit} className="form">
        <label className="field">E-mail
          <span className="input-icon"><Icon name="mail" />
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.ma" />
          </span>
        </label>
        <label className="field">Mot de passe
          <span className="input-icon"><Icon name="lock" />
            <input type={show ? "text" : "password"} autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <button type="button" className="input-action" onClick={() => setShow((v) => !v)} aria-label="Afficher le mot de passe"><Icon name="eye" /></button>
          </span>
        </label>
        <button className="btn primary block lg" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
      <p className="auth-switch">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
    </AuthLayout>
  );
}
