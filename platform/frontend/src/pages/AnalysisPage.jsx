import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import ResultView from "../components/ResultView.jsx";
import { Alert, fmtDateTime, Loading, PageHeader } from "../components/ui.jsx";

export default function AnalysisPage() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(location.state?.result || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (data && String(data.id) === id) return;
    api.get(id).then(setData).catch((e) => setError(e.message));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;

  const back = data.patientId
    ? { to: `/patients/${data.patientId}`, label: data.patientName || "Dossier patient" }
    : { to: "/historique", label: "Historique" };
  const subtitle = [fmtDateTime(data.createdAt), data.patientName ? `Patient : ${data.patientName}` : null,
    data.ownerName ? `Réalisée par ${data.ownerName}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title={`Analyse n° ${data.id}`} subtitle={subtitle} back={back}>
        <button className="btn ghost no-print" onClick={() => window.print()}><Icon name="printer" /> Imprimer</button>
        <Link to={data.patientId ? `/analyse?patient=${data.patientId}` : "/analyse"} className="btn primary no-print"><Icon name="scan" /> Nouvelle analyse</Link>
      </PageHeader>
      <ResultView data={data} onUpdate={setData} />
    </>
  );
}
