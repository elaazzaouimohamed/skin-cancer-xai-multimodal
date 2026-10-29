// Semi-circular gauge: probability of cancer, with the triage threshold marked.
export default function Gauge({ value, threshold }) {
  const r = 80, cx = 100, cy = 95;
  const point = (v) => {
    const a = Math.PI * (1 - v);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  // A half-gauge never exceeds 180°: large-arc-flag always 0 (otherwise the arc goes the long way round)
  const arc = (from, to) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  // threshold tick across the whole thickness of the track (stroke 16 → ±8)
  const ta = Math.PI * (1 - threshold);
  const [tx, ty] = [cx + (r - 12) * Math.cos(ta), cy - (r - 12) * Math.sin(ta)];
  const [tx2, ty2] = [cx + (r + 12) * Math.cos(ta), cy - (r + 12) * Math.sin(ta)];
  const suspect = value >= threshold;
  return (
    <svg viewBox="0 0 200 120" className="gauge" role="img" aria-label={`Probabilité ${Math.round(value * 100)} %`}>
      <path d={arc(0, 1)} className="gauge-track" />
      <path d={arc(0, Math.max(0.001, Math.min(value, 0.999)))} className={`gauge-value ${suspect ? "bad" : "good"}`} />
      <line x1={tx} y1={ty} x2={tx2} y2={ty2} className="gauge-threshold" />
      <text x={cx} y={cy - 10} textAnchor="middle" className="gauge-text">{Math.round(value * 100)} %</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="gauge-sub">seuil {Math.round(threshold * 100)} %</text>
    </svg>
  );
}
