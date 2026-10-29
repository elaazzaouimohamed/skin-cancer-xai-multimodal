import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Alert, Modal } from "./ui.jsx";

const PHOTOTYPES = [
  [1, "I — très claire, brûle toujours"], [2, "II — claire, brûle facilement"], [3, "III — claire à mate, hâle progressif"],
  [4, "IV — mate, brûle rarement"], [5, "V — foncée"], [6, "VI — noire"],
];

/** Creation / modification of a patient record (modal). */
export default function PatientForm({ patient, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const [f, setF] = useState(() => ({
    firstName: patient?.firstName || "", lastName: patient?.lastName || "", birthYear: patient?.birthYear ?? "",
    sex: patient?.sex || "", phototype: patient?.phototype ?? "", phone: patient?.phone || "", notes: patient?.notes || "",
    doctorId: patient?.doctorId ?? "",
  }));
  const [doctors, setDoctors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAdmin) api.adminUsers().then((u) => setDoctors(u.filter((x) => x.role === "DOCTOR"))).catch(() => {});
  }, [isAdmin]);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...f,
      birthYear: f.birthYear === "" ? null : Number(f.birthYear),
      phototype: f.phototype === "" ? null : Number(f.phototype),
      doctorId: f.doctorId === "" ? null : Number(f.doctorId),
    };
    try {
      const saved = patient ? await api.patientUpdate(patient.id, body) : await api.patientCreate(body);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const year = new Date().getFullYear();
  return (
    <Modal title={patient ? "Modifier le dossier" : "Nouveau patient"} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" form="patient-form" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></>}>
      <Alert>{error}</Alert>
      <form id="patient-form" className="form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">Prénom<input required maxLength={80} value={f.firstName} onChange={set("firstName")} autoFocus /></label>
          <label className="field">Nom<input required maxLength={80} value={f.lastName} onChange={set("lastName")} /></label>
        </div>
        <div className="form-row three">
          <label className="field">Année de naissance<input type="number" min={1900} max={year} value={f.birthYear} onChange={set("birthYear")} placeholder="1964" /></label>
          <label className="field">Sexe
            <select value={f.sex} onChange={set("sex")}><option value="">—</option><option value="F">Femme</option><option value="M">Homme</option></select>
          </label>
          <label className="field">Téléphone<input maxLength={30} value={f.phone} onChange={set("phone")} placeholder="06 …" /></label>
        </div>
        <label className="field">Phototype de Fitzpatrick
          <select value={f.phototype} onChange={set("phototype")}>
            <option value="">— non renseigné —</option>
            {PHOTOTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="hint">Informatif : le modèle ne l'utilise pas (peu de peaux foncées dans les données d'entraînement).</span>
        </label>
        {isAdmin && (
          <label className="field">Médecin référent
            <select required value={f.doctorId} onChange={set("doctorId")}>
              <option value="">— choisir —</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}{d.enabled ? "" : " (inactif)"}</option>)}
            </select>
          </label>
        )}
        <label className="field">Notes cliniques<textarea rows={3} maxLength={4000} value={f.notes} onChange={set("notes")} placeholder="Antécédents, traitements, contexte…" /></label>
      </form>
    </Modal>
  );
}
