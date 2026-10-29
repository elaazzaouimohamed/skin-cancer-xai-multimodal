import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import AnalysisTable from "../components/AnalysisTable.jsx";
import { ActivityChart, RegionBars } from "../components/Charts.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, Avatar, Empty, fmtPct, Loading, PageHeader, StatCard } from "../components/ui.jsx";

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.adminStats().then(setS).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <PageHeader title="Administration" subtitle="Pilotage de la plateforme : comptes, dossiers et activité du modèle.">
        <Link to="/admin/utilisateurs" className="btn primary"><Icon name="users" /> Gérer les utilisateurs</Link>
      </PageHeader>
      <Alert>{error}</Alert>
      {!s ? !error && <Loading /> : (
        <>
          {s.pendingDoctors > 0 && (
            <Link to="/admin/utilisateurs?filtre=attente" className="banner">
              <Icon name="alert" /> <span><b>{s.pendingDoctors} compte{s.pendingDoctors > 1 ? "s" : ""} médecin</b> en attente de validation.</span>
              <span className="banner-cta">Valider <Icon name="arrowRight" size={15} /></span>
            </Link>
          )}
          <div className="stats six">
            <StatCard icon="users" label="Comptes" value={s.users} hint={`${s.admins} admin · ${s.doctors} médecins · ${s.patientAccounts} patients`} to="/admin/utilisateurs" />
            <StatCard icon="stethoscope" tone="soft" label="Médecins en attente" value={s.pendingDoctors} to="/admin/utilisateurs?filtre=attente" />
            <StatCard icon="folder" label="Dossiers patients" value={s.patientRecords} to="/patients" />
            <StatCard icon="scan" label="Analyses" value={s.activity.analyses} to="/historique" />
            <StatCard icon="alert" tone="bad" label="Suspicions" value={s.activity.suspicions} hint={`${fmtPct(s.activity.suspicionRate)} des analyses`} />
            <StatCard icon="chat" tone="soft" label="Conversations" value={s.chats} />
          </div>

          <div className="grid-main">
            <section className="card">
              <div className="card-head"><h3>Analyses par jour (toute la plateforme)</h3></div>
              <ActivityChart days={s.activity.last14Days} />
            </section>
            <section className="card">
              <div className="card-head"><h3>Médecins les plus actifs</h3></div>
              {s.topDoctors.length === 0 ? <Empty icon="stethoscope" title="Aucun médecin inscrit" /> : (
                <ul className="person-list">
                  {s.topDoctors.map((d) => (
                    <li key={d.id}>
                      <div>
                        <Avatar name={d.fullName} size={38} />
                        <span className="person-main"><b>{d.fullName}</b><span className="muted small">{d.specialty || "Médecin"}</span></span>
                        <span className="person-figures"><b>{d.analyses}</b> analyses<br /><b>{d.patients}</b> patients</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid-main">
            <section className="card">
              <div className="card-head"><h3>Dernières analyses</h3><Link to="/historique" className="small">Toutes les analyses →</Link></div>
              {s.activity.recent.length === 0 ? <Empty icon="scan" title="Aucune analyse" /> : <AnalysisTable rows={s.activity.recent} showPatient showOwner />}
            </section>
            <section className="card">
              <div className="card-head"><h3>Localisations analysées</h3></div>
              {s.activity.regions.length === 0 ? <Empty icon="activity" title="Pas encore de données" /> : <RegionBars items={s.activity.regions} />}
            </section>
          </div>
        </>
      )}
    </>
  );
}
