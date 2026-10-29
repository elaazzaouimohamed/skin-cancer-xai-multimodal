// Awareness ribbon in lavender, the colour of the fight against all cancers.
export default function Logo({ size = 36, withText = false, light = false }) {
  return (
    <span className={`logo-mark ${light ? "light" : ""}`}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id="ribbon-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d8ccff" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="40" height="40" rx="11" fill={light ? "rgba(255,255,255,0.14)" : "#2e1065"} />
        <path fill="url(#ribbon-g)"
          d="M20 6.5c-4.1 0-6.9 3.2-6.9 7 0 3 1.7 6 4 9.5L9.6 34l4.4 1.9 6-9.6 6 9.6 4.4-1.9L22.9 23c2.3-3.5 4-6.5 4-9.5 0-3.8-2.8-7-6.9-7Zm0 4c1.7 0 2.9 1.4 2.9 3.1 0 1.7-1.1 3.8-2.9 6.6-1.8-2.8-2.9-4.9-2.9-6.6 0-1.7 1.2-3.1 2.9-3.1Z" />
      </svg>
      {withText && (
        <span className="logo-text">
          <b>DermAI</b><span>-XAI</span>
        </span>
      )}
    </span>
  );
}
