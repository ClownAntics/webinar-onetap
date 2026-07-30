/**
 * Dependency-free SVG line chart (server component). One metric over time.
 */
export interface Point {
  x: number; // epoch ms (webinar date)
  y: number;
}

export default function LineChart({
  title,
  points,
  color = "#3b82c4",
  formatY = (n: number) => String(n),
}: {
  title: string;
  points: Point[];
  color?: string;
  formatY?: (n: number) => string;
}) {
  const W = 460;
  const H = 220;
  const padL = 48;
  const padR = 14;
  const padT = 28;
  const padB = 28;

  const empty = points.length === 0;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = empty ? 0 : Math.min(...xs);
  const xMax = empty ? 1 : Math.max(...xs);
  const yMax = empty ? 1 : Math.max(1, ...ys);

  const xScale = (x: number) =>
    padL + ((x - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
  const yScale = (y: number) => padT + (1 - y / yMax) * (H - padT - padB);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
    .join(" ");

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
        {/* y gridlines */}
        {[0, 0.5, 1].map((t) => {
          const y = padT + t * (H - padT - padB);
          const val = yMax * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f0eee9" />
              <text x={padL - 6} y={y + 3} fontSize="10" fill="#999" textAnchor="end">
                {formatY(Math.round(val))}
              </text>
            </g>
          );
        })}
        {/* x endpoints */}
        {!empty && (
          <>
            <text x={padL} y={H - 8} fontSize="10" fill="#999" textAnchor="start">
              {fmtDate(xMin)}
            </text>
            <text x={W - padR} y={H - 8} fontSize="10" fill="#999" textAnchor="end">
              {fmtDate(xMax)}
            </text>
          </>
        )}
        {empty ? (
          <text x={W / 2} y={H / 2} fontSize="12" fill="#bbb" textAnchor="middle">
            No data yet
          </text>
        ) : (
          <>
            <path d={path} fill="none" stroke={color} strokeWidth={2} />
            {points.map((p, i) => (
              <circle key={i} cx={xScale(p.x)} cy={yScale(p.y)} r={2} fill={color} />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
