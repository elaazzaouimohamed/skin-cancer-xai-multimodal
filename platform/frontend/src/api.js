// Calls to the Spring Boot backend (proxied by Vite in development), authenticated by a JWT token.

const TOKEN_KEY = "dermai.token";
const USER_KEY = "dermai.user";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export const session = {
  token: () => read(TOKEN_KEY),
  user: () => {
    try { return JSON.parse(read(USER_KEY)); } catch { return null; }
  },
  save: (token, user) => { write(TOKEN_KEY, token); write(USER_KEY, JSON.stringify(user)); },
  setUser: (user) => write(USER_KEY, JSON.stringify(user)),
  clear: () => { write(TOKEN_KEY, null); write(USER_KEY, null); },
};

async function request(url, options = {}) {
  const token = session.token();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.json) };
  }
  const res = await fetch(url, { ...options, headers });
  if (res.ok) return res.status === 204 ? null : res.json();
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    message = body.message || body.detail || message;
  } catch {
    /* non-JSON response */
  }
  if (res.status === 401 && token) window.dispatchEvent(new Event("dermai:unauthorized"));
  const err = new Error(message);
  err.status = res.status;
  throw err;
}

const get = (url) => request(url);
const post = (url, json) => request(url, { method: "POST", json });
const put = (url, json) => request(url, { method: "PUT", json });
const patch = (url, json) => request(url, { method: "PATCH", json });
const del = (url) => request(url, { method: "DELETE" });
const qs = (params) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? `?${new URLSearchParams(p)}` : "";
};

/** URL of a protected image, usable in <img src> (token passed as a parameter). */
export function protectedUrl(url) {
  if (!url) return url;
  const token = session.token();
  return token ? `${url}${url.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}` : url;
}

export const api = {
  // Authentication and profile
  login: (body) => post("/api/auth/login", body),
  register: (body) => post("/api/auth/register", body),
  me: () => get("/api/auth/me"),
  updateProfile: (body) => put("/api/auth/me", body),
  changePassword: (body) => put("/api/auth/password", body),

  // System
  status: () => get("/api/system/status"),
  modelInfo: () => get("/api/system/model-info"),
  dashboard: () => get("/api/dashboard"),

  // Analyses
  history: () => get("/api/analyses"),
  get: (id) => get(`/api/analyses/${id}`),
  remove: (id) => del(`/api/analyses/${id}`),
  regenerate: (id, style) => request(`/api/analyses/${id}/report${qs({ style })}`, { method: "POST" }),
  create: ({ file, clinical, occlusion, style, patientId }) => {
    const form = new FormData();
    form.append("image", file);
    form.append("clinical", JSON.stringify(clinical));
    form.append("occlusion", String(occlusion));
    form.append("style", style);
    if (patientId) form.append("patientId", String(patientId));
    return request("/api/analyses", { method: "POST", body: form });
  },
  imageUrl: (id) => protectedUrl(`/api/analyses/${id}/image`),

  // Patient records (doctor, administrator)
  patients: (q) => get(`/api/patients${qs({ q })}`),
  patient: (id) => get(`/api/patients/${id}`),
  patientCreate: (body) => post("/api/patients", body),
  patientUpdate: (id, body) => put(`/api/patients/${id}`, body),
  patientDelete: (id) => del(`/api/patients/${id}`),

  // Administration
  adminStats: () => get("/api/admin/stats"),
  adminUsers: () => get("/api/admin/users"),
  adminCreateUser: (body) => post("/api/admin/users", body),
  adminUpdateUser: (id, body) => patch(`/api/admin/users/${id}`, body),
  adminDeleteUser: (id) => del(`/api/admin/users/${id}`),

  // Conversational mode
  chatSessions: () => get("/api/chat/sessions"),
  chatCreate: (patientId) => request(`/api/chat/sessions${qs({ patientId })}`, { method: "POST" }),
  chatGet: (id) => get(`/api/chat/sessions/${id}`),
  chatRename: (id, title) => patch(`/api/chat/sessions/${id}`, { title }),
  chatDelete: (id) => del(`/api/chat/sessions/${id}`),
  chatSend: (id, { text, file, occlusion, style }) => {
    const form = new FormData();
    if (text) form.append("text", text);
    if (file) form.append("image", file);
    form.append("occlusion", String(occlusion));
    form.append("style", style);
    return request(`/api/chat/sessions/${id}/messages`, { method: "POST", body: form });
  },
  chatRerun: (id, { occlusion, style }) =>
    request(`/api/chat/sessions/${id}/rerun${qs({ occlusion, style })}`, { method: "POST" }),
};
