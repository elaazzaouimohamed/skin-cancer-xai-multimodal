import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, protectedUrl } from "../api.js";
import { useAuth } from "../auth.jsx";
import AnalysisCard from "../components/AnalysisCard.jsx";
import Icon from "../components/Icon.jsx";
import Logo from "../components/Logo.jsx";
import RichText from "../components/RichText.jsx";
import { Alert, REGION_FR, Segmented } from "../components/ui.jsx";

const FACT_LABELS = { itch: "démangeaison", grew: "a grossi", hurt: "douleur", changed: "a changé", bleed: "saigne", elevation: "en relief" };

const SUGGESTIONS = {
  PATIENT: [
    "J'ai 45 ans, un grain de beauté sur le dos qui a changé de couleur.",
    "Comment prendre une bonne photo de ma lésion ?",
    "Que signifie « pas de signe fort de cancer » ?",
    "Quand dois-je consulter un dermatologue ?",
  ],
  STAFF: [
    "Patient de 68 ans, lésion du nez qui saigne et a grossi.",
    "Quels facteurs ont le plus pesé dans la dernière analyse ?",
    "Explique la carte d'occlusion de cette analyse.",
    "Quelles sont les limites du modèle pour les phototypes foncés ?",
  ],
};

function FactChips({ facts }) {
  if (!facts) return null;
  const chips = Object.entries(facts).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => {
    if (k === "age") return `${v} ans`;
    if (k === "region") return REGION_FR[v] || v;
    return `${FACT_LABELS[k] || k} : ${v ? "oui" : "non"}`;
  });
  if (chips.length === 0) return null;
  return <div className="chips">{chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>;
}

const time = (d) => (d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "");

function dayGroup(d) {
  const date = new Date(d);
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86400000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return "7 derniers jours";
  return "Plus ancien";
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return <button className="msg-tool" onClick={copy} title="Copier">{done ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}{done ? "Copié" : "Copier"}</button>;
}

function Message({ m, user }) {
  if (m.role === "user") {
    return (
      <div className="msg user">
        <div className="msg-col">
          <div className="bubble">
            {m.imageUrl && (
              <a href={m.pending ? m.imageUrl : protectedUrl(m.imageUrl)} target="_blank" rel="noreferrer">
                <img className="msg-image" src={m.pending ? m.imageUrl : protectedUrl(m.imageUrl)} alt="Photo envoyée" />
              </a>
            )}
            {m.text && <div className="bubble-text">{m.text}</div>}
            {m.facts && <div className="facts-note"><span className="small">Informations comprises :</span><FactChips facts={m.facts} /></div>}
          </div>
          <div className="msg-meta">{m.pending ? "envoi…" : time(m.createdAt)}</div>
        </div>
        <span className="avatar-initials brand msg-avatar">{user.fullName?.[0]?.toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className="msg assistant">
      <span className="msg-avatar bot"><Logo size={32} /></span>
      <div className="msg-col">
        <div className={`bubble ${m.kind === "error" ? "error" : ""} ${m.kind === "analysis" ? "wide" : ""}`}>
          {m.kind === "analysis" && m.analysis ? <AnalysisCard analysis={m.analysis} text={m.text} /> : <RichText text={m.text} />}
        </div>
        <div className="msg-meta">
          DermAI · {time(m.createdAt)}
          {m.text && m.kind !== "error" && <CopyButton text={m.text} />}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { user, isPatient } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [patients, setPatients] = useState([]);
  const [newFor, setNewFor] = useState("");
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [occlusion, setOcclusion] = useState(true);
  const [style, setStyle] = useState(isPatient ? "patient" : "medecin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showList, setShowList] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const started = useRef(false);

  const loadSessions = () => api.chatSessions().then(setSessions).catch((e) => setError(e.message));

  // Opening: conversation for a patient (?patient=), otherwise the most recent one
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const forPatient = params.get("patient");
        const list = await api.chatSessions();
        if (forPatient) {
          setCurrent(await api.chatCreate(forPatient));
          setParams({}, { replace: true });
          loadSessions();
        } else {
          setSessions(list);
          setCurrent(list.length ? await api.chatGet(list[0].id) : await api.chatCreate());
          if (!list.length) loadSessions();
        }
      } catch (e) {
        setError(e.message);
      }
    })();
    if (!isPatient) api.patients().then(setPatients).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [current, busy]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Auto-height of the input field
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s ? sessions.filter((x) => `${x.title} ${x.patientName || ""}`.toLowerCase().includes(s)) : sessions;
    const out = [];
    for (const x of list) {
      const g = dayGroup(x.updatedAt);
      if (!out.length || out[out.length - 1][0] !== g) out.push([g, []]);
      out[out.length - 1][1].push(x);
    }
    return out;
  }, [sessions, search]);

  const open = async (id) => {
    setError(null);
    setShowList(false);
    try { setCurrent(await api.chatGet(id)); } catch (e) { setError(e.message); }
  };

  const newSession = async () => {
    setError(null);
    setShowList(false);
    try {
      setCurrent(await api.chatCreate(newFor || null));
      setNewFor("");
      loadSessions();
      inputRef.current?.focus();
    } catch (e) { setError(e.message); }
  };

  const removeSession = async (id) => {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    try {
      await api.chatDelete(id);
      const list = await api.chatSessions();
      setSessions(list);
      if (current?.id === id) setCurrent(list.length ? await api.chatGet(list[0].id) : await api.chatCreate());
      if (!list.length) loadSessions();
    } catch (e) { setError(e.message); }
  };

  const saveRename = async () => {
    const r = renaming;
    setRenaming(null);
    if (!r || !r.title.trim()) return;
    try {
      const updated = await api.chatRename(r.id, r.title);
      if (current?.id === r.id) setCurrent(updated);
      loadSessions();
    } catch (e) { setError(e.message); }
  };

  const send = async (e, override) => {
    e?.preventDefault();
    const msg = (override ?? text).trim();
    if (busy || (!msg && !file) || !current) return;
    setBusy(true);
    setError(null);
    const pending = { id: "pending", pending: true, role: "user", kind: "text", text: msg, imageUrl: preview };
    setCurrent((c) => ({ ...c, messages: [...c.messages, pending] }));
    const sentFile = file;
    setText("");
    try {
      const updated = await api.chatSend(current.id, { text: msg, file: sentFile, occlusion, style });
      setCurrent(updated);
      setFile(null);
      loadSessions();
    } catch (err) {
      setError(err.message);
      setText(msg);
      setCurrent((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== "pending") }));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const rerun = async () => {
    setBusy(true);
    setError(null);
    try { setCurrent(await api.chatRerun(current.id, { occlusion, style })); loadSessions(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const takeImage = (f) => {
    if (f && f.type.startsWith("image/")) setFile(f);
    else if (f) setError("Le fichier joint doit être une image (JPEG ou PNG).");
  };
  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); setFile(f); }
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    takeImage(e.dataTransfer.files?.[0]);
  };

  const onlyWelcome = current && current.messages.length <= 1 && !busy;
  const suggestions = SUGGESTIONS[isPatient ? "PATIENT" : "STAFF"];

  return (
    <div className={`chat ${showList ? "list-open" : ""}`}>
      <aside className="chat-sidebar">
        <div className="chat-new">
          {!isPatient && patients.length > 0 && (
            <select value={newFor} onChange={(e) => setNewFor(e.target.value)} aria-label="Patient de la nouvelle conversation">
              <option value="">Conversation libre</option>
              {patients.map((p) => <option key={p.id} value={p.id}>Suivi · {p.lastName} {p.firstName}</option>)}
            </select>
          )}
          <button className="btn primary block" onClick={newSession}><Icon name="plus" /> Nouvelle conversation</button>
        </div>
        <label className="search compact"><Icon name="search" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" /></label>
        <div className="session-groups">
          {groups.map(([g, items]) => (
            <div key={g}>
              <div className="session-group">{g}</div>
              <ul className="session-list">
                {items.map((s) => (
                  <li key={s.id} className={current?.id === s.id ? "active" : ""}>
                    {renaming?.id === s.id ? (
                      <input className="rename" autoFocus value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                        onBlur={saveRename} onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(null); }} />
                    ) : (
                      <button className="session-title" onClick={() => open(s.id)} onDoubleClick={() => setRenaming({ id: s.id, title: s.title })}>
                        <span>{s.title}</span>
                        {s.patientName && <small><Icon name="folder" size={12} /> {s.patientName}</small>}
                      </button>
                    )}
                    <span className="session-tools">
                      <button className="icon-only" title="Renommer" onClick={() => setRenaming({ id: s.id, title: s.title })}><Icon name="edit" size={14} /></button>
                      <button className="icon-only danger" title="Supprimer" onClick={() => removeSession(s.id)}><Icon name="trash" size={14} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {sessions.length > 0 && groups.length === 0 && <p className="muted small pad">Aucune conversation trouvée.</p>}
        </div>
        <p className="chat-note"><Icon name="shield" size={15} /> Le texte sert à décrire la lésion et à poser des questions. La probabilité est calculée uniquement par le modèle entraîné, à partir d'une photo.</p>
      </aside>

      <section className={`chat-main ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={onDrop}>
        <header className="chat-head">
          <button className="icon-only chat-list-btn" onClick={() => setShowList((v) => !v)} aria-label="Conversations"><Icon name="menu" /></button>
          <div className="chat-head-title">
            <b>{current?.title || "Chat DermAI"}</b>
            <span className="muted small">
              {current?.patientId ? <Link to={`/patients/${current.patientId}`}><Icon name="folder" size={12} /> {current.patientName}</Link> : "Conversation libre"}
              {" · "}{current?.llmAvailable ? "assistant LLM local actif" : "assistant LLM indisponible (réponses de base)"}
            </span>
          </div>
        </header>

        <div className="chat-messages">
          {current?.messages.map((m) => <Message key={m.id} m={m} user={user} />)}
          {onlyWelcome && (
            <div className="suggestions">
              <span className="muted small">Pour commencer :</span>
              <div className="suggestion-grid">
                <button onClick={() => fileRef.current?.click()} className="suggestion strong"><Icon name="image" /> Joindre une photo de la lésion</button>
                {suggestions.map((s) => <button key={s} className="suggestion" onClick={() => send(null, s)}>{s}</button>)}
              </div>
            </div>
          )}
          {busy && (
            <div className="msg assistant">
              <span className="msg-avatar bot"><Logo size={32} /></span>
              <div className="msg-col"><div className="bubble">
                <div className="typing"><span /><span /><span /></div>
                <span className="muted small">{file ? "Analyse de la photo par le modèle (DermLIP + clinique)…" : "DermAI rédige une réponse…"}</span>
              </div></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {current && (current.clinicalSummary !== "aucune" || current.factsChangedSinceAnalysis) && (
          <div className="facts-bar">
            <span className="facts-label"><Icon name="folder" size={14} /> Informations cliniques</span>
            <FactChips facts={current.clinical} />
            {current.factsChangedSinceAnalysis && (
              <button className="btn primary sm" disabled={busy} onClick={rerun}><Icon name="refresh" size={15} /> Relancer l'analyse avec ces informations</button>
            )}
          </div>
        )}

        {error && <div className="chat-error"><Alert onClose={() => setError(null)}>{error}</Alert></div>}

        <form className="composer" onSubmit={send}>
          {preview && (
            <div className="attachment">
              <img src={preview} alt="Photo jointe" />
              <span className="small"><b>{file?.name}</b><span className="muted block">sera analysée par le modèle</span></span>
              <button type="button" className="icon-only danger" onClick={() => setFile(null)} aria-label="Retirer la photo"><Icon name="x" size={16} /></button>
            </div>
          )}
          <div className="composer-box">
            <button type="button" className="icon-only" title="Joindre une photo" onClick={() => fileRef.current?.click()}><Icon name="clip" size={19} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { takeImage(e.target.files?.[0]); e.target.value = ""; }} />
            <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onPaste={onPaste}
              placeholder="Décrivez la lésion ou posez une question… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" />
            <button className="send" type="submit" disabled={busy || (!text.trim() && !file)} aria-label="Envoyer"><Icon name="send" size={18} /></button>
          </div>
          <div className="composer-options">
            <label className="check small"><input type="checkbox" checked={occlusion} onChange={(e) => setOcclusion(e.target.checked)} /> carte d'occlusion</label>
            <span className="small muted">Compte rendu :</span>
            <Segmented value={style} onChange={setStyle} options={[["medecin", "Médecin"], ["patient", "Patient"]]} />
            <span className="small muted composer-hint">Glissez-déposez ou collez (Ctrl+V) une photo</span>
          </div>
        </form>
        {dragging && <div className="drop-overlay"><Icon name="image" size={34} /> Déposez la photo pour l'analyser</div>}
      </section>
    </div>
  );
}
