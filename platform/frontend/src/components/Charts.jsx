import { useState } from "react";
import { fmtDate, fmtPct, REGION_FR } from "./ui.jsx";

// Series colours (validated: ΔE CVD 30, contrast ≥ 3:1 on the light surface).
const C_GOOD = "var(--series-1)";
const C_BAD = "var(--series-bad)";

/** Rectangle with rounded top (data end), square at the baseline. */
function topRounded(x, y, w, h, r) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function ticksFor(max) {
  const step = Math.max(1, Math.ceil(max / 4));
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

/** Analyses per day over 14 days, stacked: "no strong sign" + "suspicion". */
export function ActivityChart({ days }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 220, L = 34, R = 8, T = 14, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const ticks = ticksFor(Math.max(1, ...days.map((d) => d.total)));
  const top = ticks[ticks.length - 1];
  const y = (v) => T + ih - (v / top) * ih;
  const band = iw / days.length;
  const bw = Math.min(24, band * 0.62);
  const total = days.reduce((s, d) => s + d.total, 0);

  return (
    <div className="chart">
      <div className="legend">
        <span><i style={{ background: C_GOOD }} /> Pas de signe fort</span>
        <span><i style={{ background: C_BAD }} /> Suspicion de cancer</span>
        <span className="legend-total">{total} analyse{total > 1 ? "s" : ""} sur 14 jours</span>
      </div>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
          aria-label={`Analyses par jour sur 14 jours, ${total} au total`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = L + i * band + (band - bw) / 2;
            const good = d.total - d.suspicion;
            const hGood = (good / top) * ih;
            const hBad = (d.suspicion / top) * ih;
            const base = T + ih;
            const gap = good > 0 && d.suspicion > 0 ? 2 : 0;
            const label = new Date(d.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
            return (
              <g key={d.day} className={hover === i ? "is-hover" : ""}>
                {good > 0 && (d.suspicion > 0
                  ? <rect x={x} y={base - hGood} width={bw} height={hGood} fill={C_GOOD} />
                  : <path d={topRounded(x, base - hGood, bw, hGood, 4)} fill={C_GOOD} />)}
                {d.suspicion > 0 && <path d={topRounded(x, base - hGood - gap - hBad, bw, hBad, 4)} fill={C_BAD} />}
                {(i % 2 === 1 || days.length <= 7) && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="axis">{label}</text>
                )}
                <rect x={L + i * band} y={T} width={band} height={ih} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} className="baseline" />
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: `${((L + hover * band + band / 2) / W) * 100}%`, top: 8 }}>
            <b>{fmtDate(days[hover].day)}</b>
            <span><i style={{ background: C_GOOD }} /> Pas de signe fort : {days[hover].total - days[hover].suspicion}</span>
            <span><i style={{ background: C_BAD }} /> Suspicion : {days[hover].suspicion}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Evolution of a patient's probability, with the triage threshold. */
export function TrendChart({ points, threshold = 0.375 }) {
  const [hover, setHover] = useState(null);
  const data = [...points].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const W = 640, H = 200, L = 40, R = 16, T = 14, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const t0 = new Date(data[0].createdAt).getTime();
  const t1 = new Date(data[data.length - 1].createdAt).getTime();
  const x = (d) => (t1 === t0 ? L + iw / 2 : L + ((new Date(d.createdAt).getTime() - t0) / (t1 - t0)) * iw);
  const y = (p) => T + ih - p * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(d)},${y(d.probability)}`).join(" ");
  const area = data.length > 1 ? `${line} L${x(data[data.length - 1])},${T + ih} L${x(data[0])},${T + ih} Z` : "";

  return (
    <div className="chart">
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Évolution de la probabilité de cancer">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{Math.round(t * 100)} %</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(threshold)} y2={y(threshold)} className="threshold" />
          <text x={W - R} y={y(threshold) - 6} textAnchor="end" className="axis strong">seuil de triage {fmtPct(threshold)}</text>
          {area && <path d={area} fill="var(--series-1)" opacity="0.1" />}
          {data.length > 1 && <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {data.map((d, i) => (
            <g key={d.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(d)} cy={y(d.probability)} r="12" fill="transparent" />
              <circle cx={x(d)} cy={y(d.probability)} r={hover === i ? 6 : 4.5} fill="var(--series-1)"
                stroke="var(--card)" strokeWidth="2" />
            </g>
          ))}
          <text x={L} y={H - 6} className="axis">{fmtDate(data[0].createdAt)}</text>
          {data.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" className="axis">{fmtDate(data[data.length - 1].createdAt)}</text>}
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: `${(x(data[hover]) / W) * 100}%`, top: `${(y(data[hover].probability) / H) * 100}%` }}>
            <b>Analyse n° {data[hover].id}</b>
            <span>{fmtDate(data[hover].createdAt)}</span>
            <span>Probabilité : {fmtPct(data[hover].probability)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Most frequent locations (single series: no legend, the title names it). */
export function RegionBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="hbars">
      {items.map((r) => (
        <li key={r.label} title={`${REGION_FR[r.label] || r.label} : ${r.count}`}>
          <span className="hbar-label">{REGION_FR[r.label] || r.label}</span>
          <span className="hbar-track"><span className="hbar" style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="hbar-value">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
