import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, session } from "./api.js";
import Logo from "./components/Logo.jsx";

const AuthContext = createContext(null);

export const ROLE_LABEL = { ADMIN: "Administrateur", DOCTOR: "Médecin", PATIENT: "Patient" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (session.token() ? session.user() : null));
  const [ready, setReady] = useState(() => !session.token());

  // Revalidates the stored session (disabled account, changed role…)
  useEffect(() => {
    if (!session.token()) return;
    api.me()
      .then((u) => { session.setUser(u); setUser(u); })
      .catch((e) => { if (e.status === 401 || e.status === 403) { session.clear(); setUser(null); } })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { session.clear(); setUser(null); };
    window.addEventListener("dermai:unauthorized", onUnauthorized);
    return () => window.removeEventListener("dermai:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.login({ email, password });
    session.save(r.token, r.user);
    setUser(r.user);
    return r.user;
  }, []);

  const register = useCallback(async (data) => {
    const r = await api.register(data);
    if (r.token) {
      session.save(r.token, r.user);
      setUser(r.user);
    }
    return r;
  }, []);

  const logout = useCallback(() => { session.clear(); setUser(null); }, []);
  const refresh = useCallback((u) => { session.setUser(u); setUser(u); }, []);

  const value = useMemo(() => ({
    user, ready, login, register, logout, refresh,
    isAdmin: user?.role === "ADMIN",
    isDoctor: user?.role === "DOCTOR",
    isPatient: user?.role === "PATIENT",
  }), [user, ready, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

function Splash() {
  return (
    <div className="splash">
      <Logo size={48} />
      <div className="spinner" />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to="/" replace />;
}

export function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  return user ? <Navigate to="/" replace /> : children;
}
