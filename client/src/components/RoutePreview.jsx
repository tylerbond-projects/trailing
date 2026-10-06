// Tiny SVG drawing of a route's shape for list cards.
export default function RoutePreview({ points, size = 72 }) {
  if (!points?.length) return null;
  const lats = points.map((p) => p[0]), lngs = points.map((p) => p[1]);
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const minX = Math.min(...lngs) * k, maxX = Math.max(...lngs) * k, minY = Math.min(...lats), maxY = Math.max(...lats);
  const span = Math.max(maxX - minX, maxY - minY) || 1e-6;
  const pad = 8, inner = size - pad * 2;
  const ox = pad + (inner - ((maxX - minX) / span) * inner) / 2, oy = pad + (inner - ((maxY - minY) / span) * inner) / 2;
  const xy = (p) => [ox + ((p[1] * k - minX) / span) * inner, oy + ((maxY - p[0]) / span) * inner];
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map((n) => n.toFixed(1)).join(',')}`).join('');
  const [sx, sy] = xy(points[0]);
  return (
    <svg className="route-preview" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r="3.5" className="route-preview-start" />
    </svg>
  );
}
