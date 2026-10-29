import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import AnalysisTable from "../components/AnalysisTable.jsx";
import { ActivityChart, RegionBars } from "../components/Charts.jsx";
import Icon from "../components/Icon.jsx";
import { Alert, Avatar, DecisionBadge, Empty, fmtDate, fmtPct, Loading, PageHeader, StatCard } from "../components/ui.jsx";

function greeting() {
  const h = new Date().getHours();
  return h < 18 ? "Bonjour" : "Bonsoir";
}

export default function Dashboard() {
  const { user, isDoctor } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.dashboard().then(setData).catch((e) => setError(e.message)); }, []);

  const name = isDoctor && !/^dr\.?\s/i.test(user.fullName) ? `Dr ${user.fullName}` : user.fullName;

  return (
    <>
      <PageHeader title={`${greeting()}, ${name}`}
        subtitle={isDoctor ? "Vue d'ensemble de votre activité et des patients à revoir." : "Votre espace personnel de suivi."}>
        {isDoctor && <Link to="/patients?nouveau=1" className="btn ghost"><Icon name="plus" /> Nouveau patient</Link>}
        <Link to="/analyse" className="btn primary"><Icon name="scan" /> Nouvelle analyse</Link>
      </PageHeader>
      <Alert>{error}</Alert>
      {!data ? !error && <Loading /> : (
        <>
          <div className="stats">
            {isDoctor && <StatCard icon="folder" label="Patients suivis" value={data.patients} to="/patients" />}
            <StatCard icon="scan" label="Analyses réalisées" value={data.analyses} to="/historique" />
            <StatCard icon="alert" tone="bad" label="Suspicions de cancer" value={data.suspicions}
              hint={data.analyses ? `${fmtPct(data.suspicionRate)} des analyses` : null} />
            <StatCard icon="chat" tone="soft" label="Conversations" value={data.chats} to="/chat" />
          </div>

          <div className="grid-main">
            <section className="card">
              <div className="card-head"><h3>Activité des 14 derniers jours</h3></div>
              <ActivityChart days={data.last14Days} />
            </section>

            {isDoctor ? (
              <section className="card">
                <div className="card-head"><h3>Patients à revoir en priorité</h3><Link to="/patients" className="small">Tous les patients →</Link></div>
                {data.toReview.length === 0 ? (
                  <Empty icon="check" title="Aucun patient à revoir">Aucun dossier dont la dernière analyse est une suspicion.</Empty>
                ) : (
                  <ul className="person-list">
                    {data.toReview.map((p) => (
                      <li key={p.id}>
                        <Link to={`/patients/${p.id}`}>
                          <Avatar name={`${p.firstName} ${p.lastName}`} size={38} tone="bad" />
                          <span className="person-main"><b>{p.firstName} {p.lastName}</b>
                            <span className="muted small">{p.age != null ? `${p.age} ans · ` : ""}dernière analyse le {fmtDate(p.lastAnalysisAt)}</span></span>
                          <DecisionBadge decision={p.lastDecision} probability={p.lastProbability} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section className="card quick">
                <h3>Que souhaitez-vous faire ?</h3>
                <Link to="/analyse" className="quick-action"><Icon name="scan" size={22} /><span><b>Analyser une photo</b><span className="muted small">Photo nette, lésion centrée, avec vos symptômes</span></span><Icon name="chevronRight" /></Link>
                <Link to="/chat" className="quick-action"><Icon name="chat" size={22} /><span><b>Discuter avec DermAI</b><span className="muted small">Décrivez la lésion, posez vos questions</span></span><Icon name="chevronRight" /></Link>
                <Link to="/historique" className="quick-action"><Icon name="history" size={22} /><span><b>Mes analyses</b><span className="muted small">Retrouvez vos résultats et comptes rendus</span></span><Icon name="chevronRight" /></Link>
                <Alert kind="info">En cas de suspicion, de lésion qui saigne ou qui change rapidement : consultez un dermatologue.</Alert>
              </section>
            )}
          </div>

          <div className="grid-main">
            <section className="card">
              <div className="card-head"><h3>Dernières analyses</h3><Link to="/historique" className="small">Historique complet →</Link></div>
              {data.recent.length === 0
                ? <Empty icon="scan" title="Aucune analyse pour le moment"><Link to="/analyse">Lancer une première analyse</Link></Empty>
                : <AnalysisTable rows={data.recent} showPatient={isDoctor} />}
            </section>
            <section className="card">
              <div className="card-head"><h3>Localisations les plus fréquentes</h3></div>
              {data.regions.length === 0 ? <Empty icon="activity" title="Pas encore de données" /> : <RegionBars items={data.regions} />}
            </section>
          </div>
        </>
      )}
    </>
  );
}
