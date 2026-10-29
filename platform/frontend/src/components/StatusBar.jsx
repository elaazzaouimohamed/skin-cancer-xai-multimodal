import { useEffect, useState } from "react";
import { api } from "../api.js";

// State of the 3 services (Spring Boot API, ML model, local LLM), refreshed every 15 s.
export default function StatusBar() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () => api.status().then((s) => { setStatus(s); setError(false); }).catch(() => setError(true));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="status-pills"><span className="pill down"><i /> API injoignable</span></div>;
  if (!status) return <div className="status-pills"><span className="pill"><i /> Vérification…</span></div>;
  const labels = { [status.backend.name]: "API", [status.ml.name]: "Modèle", [status.llm.name]: "LLM" };
  return (
    <div className="status-pills">
      {[status.backend, status.ml, status.llm].map((s) => (
        <span key={s.name} className={`pill ${s.up ? "up" : "down"}`} title={`${s.name} — ${s.detail}`}>
          <i /> {labels[s.name]}
        </span>
      ))}
    </div>
  );
}
