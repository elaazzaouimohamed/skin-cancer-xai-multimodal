// Line icons (24×24, 1.8 stroke). A string = <path d>, an object = circle / rect.
const ICONS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", { c: [12, 12, 3.5] }],
  chat: ["M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 3"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { c: [9, 7, 4] }, "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  folder: ["M9 3h6v3H9z", "M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2", "M9 12h6", "M9 16h4"],
  shield: ["M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z", "M9 12l2 2 4-4"],
  info: [{ c: [12, 12, 9] }, "M12 11v5", "M12 8h.01"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  plus: ["M12 5v14", "M5 12h14"],
  search: [{ c: [11, 11, 7] }, "M21 21l-4.3-4.3"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  copy: [{ r: [9, 9, 12, 12, 2] }, "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  clip: ["M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"],
  send: ["M22 2 11 13", "M22 2l-7 20-4-9-9-4z"],
  refresh: ["M21 12a9 9 0 1 1-2.6-6.4L21 8", "M21 3v5h-5"],
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
  user: [{ c: [12, 8, 4] }, "M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", { r: [6, 14, 12, 8, 1] }],
  arrowRight: ["M5 12h14", "M12 5l7 7-7 7"],
  arrowLeft: ["M19 12H5", "M12 19l-7-7 7-7"],
  sparkles: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"],
  image: [{ r: [3, 3, 18, 18, 2] }, { c: [9, 9, 2] }, "M21 15l-5-5L5 21"],
  clock: [{ c: [12, 12, 9] }, "M12 7v5l3 2"],
  key: [{ c: [7.5, 15.5, 4.5] }, "M10.7 12.3 20 3", "M17 6l3 3", "M15 8l2 2"],
  stethoscope: ["M5 3v6a5 5 0 0 0 10 0V3", "M10 14v2a5 5 0 0 0 10 0v-2", { c: [20, 12, 2] }],
  lock: [{ r: [4, 11, 16, 10, 2] }, "M8 11V7a4 4 0 0 1 8 0v4"],
  mail: [{ r: [3, 5, 18, 14, 2] }, "M3 7l9 6 9-6"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", { c: [12, 12, 3] }],
  chevronRight: ["M9 18l6-6-6-6"],
  ban: [{ c: [12, 12, 9] }, "M5.6 5.6l12.8 12.8"],
};

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.8, title }) {
  const parts = ICONS[name] || [];
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {parts.map((p, i) => {
        if (typeof p === "string") return <path key={i} d={p} />;
        if (p.c) return <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />;
        return <rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]} />;
      })}
    </svg>
  );
}
