import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABEL, useAuth } from "../auth.jsx";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";
import StatusBar from "./StatusBar.jsx";
import { Avatar } from "./ui.jsx";

const NAV = {
  ADMIN: [
    ["Pilotage", [["/", "home", "Tableau de bord"], ["/admin/utilisateurs", "users", "Utilisateurs"], ["/patients", "folder", "Dossiers patients"], ["/historique", "history", "Toutes les analyses"]]],
    ["Outils", [["/analyse", "scan", "Nouvelle analyse"], ["/chat", "chat", "Chat DermAI"]]],
  ],
  DOCTOR: [
    ["Cabinet", [["/", "home", "Tableau de bord"], ["/patients", "folder", "Mes patients"], ["/historique", "history", "Historique"]]],
    ["Outils", [["/analyse", "scan", "Nouvelle analyse"], ["/chat", "chat", "Chat DermAI"]]],
  ],
  PATIENT: [
    ["Mon espace", [["/", "home", "Accueil"], ["/analyse", "scan", "Nouvelle analyse"], ["/chat", "chat", "Chat DermAI"], ["/historique", "history", "Mes analyses"]]],
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { setMenuOpen(false); setUserMenu(false); }, [location.pathname]);
  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setUserMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const doLogout = () => { logout(); navigate("/connexion"); };
  const fullHeight = location.pathname.startsWith("/chat");

  return (
    <div className={`shell ${menuOpen ? "menu-open" : ""}`}>
      <aside className="sidebar">
        <Link to="/" className="sidebar-brand"><Logo size={36} light withText /></Link>
        <div className="sidebar-tagline">IA explicable · cancer de la peau</div>
        <nav className="sidebar-nav">
          {(NAV[user.role] || []).map(([section, items]) => (
            <div key={section} className="nav-section">
              <div className="nav-title">{section}</div>
              {items.map(([to, icon, label]) => (
                <NavLink key={to} to={to} end={to === "/"}><Icon name={icon} /> <span>{label}</span></NavLink>
              ))}
            </div>
          ))}
          <div className="nav-section">
            <div className="nav-title">Référence</div>
            <NavLink to="/methode"><Icon name="info" /> <span>Modèle &amp; méthode</span></NavLink>
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="ribbon-note">
            <Logo size={22} light /> <span>Le violet lavande est la couleur de la lutte contre tous les cancers.</span>
          </div>
        </div>
      </aside>
      <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />

      <div className="main-col">
        <header className="topbar">
          <button className="icon-only menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"><Icon name="menu" /></button>
          <StatusBar />
          <div className="topbar-right" ref={menuRef}>
            <button className="user-chip" onClick={() => setUserMenu((v) => !v)} aria-expanded={userMenu}>
              <Avatar name={user.fullName} size={34} />
              <span className="user-chip-text">
                <b>{user.fullName}</b>
                <span>{ROLE_LABEL[user.role]}</span>
              </span>
            </button>
            {userMenu && (
              <div className="dropdown">
                <div className="dropdown-head"><b>{user.fullName}</b><span className="muted small">{user.email}</span></div>
                <Link to="/profil"><Icon name="user" /> Mon profil</Link>
                <button onClick={doLogout}><Icon name="logout" /> Se déconnecter</button>
              </div>
            )}
          </div>
        </header>
        <main className={`content ${fullHeight ? "full" : ""}`}>
          <Outlet />
        </main>
        {!fullHeight && (
          <footer className="footer">
            Outil de recherche — PFA Master Data Science &amp; Big Data, FSBM, Université Hassan II de Casablanca.
            Aide à la décision uniquement : ne remplace ni l'examen clinique ni la biopsie.
          </footer>
        )}
      </div>
    </div>
  );
}
