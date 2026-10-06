import { useLayoutEffect, useRef, useState } from 'react';

const FT = 3.28084, MI = 1609.344;
const PAD = { top: 10, right: 12, bottom: 22, left: 44 };

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
}

/**
 * Elevation profile (single series area chart). profile = [[distance_m, elevation_m], ...].
 * Hover/touch shows a crosshair + tooltip and reports the distance via onHover.
 */
export default function ElevationChart({ profile, height = 150, onHover }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  if (!profile?.length || profile.length < 2) {
    return <div ref={wrap} className="elev-empty muted small">Elevation profile appears once the route has two points.</div>;
  }

  const pts = profile.map(([d, e]) => [d / MI, e * FT]);
  const maxX = pts[pts.length - 1][0] || 1;
  const ys = pts.map((p) => p[1]);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxY - minY < 60) { const mid = (maxY + minY) / 2; minY = mid - 30; maxY = mid + 30; }
  const yStep = niceStep(maxY - minY, 3);
  minY = Math.floor(minY / yStep) * yStep; maxY = Math.ceil(maxY / yStep) * yStep;
  const xStep = niceStep(maxX, Math.max(2, Math.floor(width / 110)));

  const iw = width - PAD.left - PAD.right, ih = height - PAD.top - PAD.bottom;
  const sx = (x) => PAD.left + (x / maxX) * iw;
  const sy = (y) => PAD.top + ih - ((y - minY) / (maxY - minY)) * ih;
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  const area = `${line}L${sx(maxX).toFixed(1)},${PAD.top + ih}L${PAD.left},${PAD.top + ih}Z`;
  const yTicks = []; for (let y = minY; y <= maxY + 1e-6; y += yStep) yTicks.push(y);
  const xTicks = []; for (let x = 0; x <= maxX + 1e-6; x += xStep) xTicks.push(x);

  function move(clientX) {
    const r = wrap.current.getBoundingClientRect();
    const x = Math.min(maxX, Math.max(0, ((clientX - r.left - PAD.left) / iw) * maxX));
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - x) < Math.abs(pts[best][0] - x)) best = i;
    setHover(best);
    onHover?.(profile[best][0]);
  }
  const leave = () => { setHover(null); onHover?.(null); };
  const h = hover != null ? pts[hover] : null;
  const fmtMi = (x) => (maxX < 3 ? x.toFixed(1) : Math.round(x * 10) / 10);

  return (
    <div ref={wrap} className="elev-chart" onMouseMove={(e) => move(e.clientX)} onMouseLeave={leave}
      onTouchStart={(e) => move(e.touches[0].clientX)} onTouchMove={(e) => move(e.touches[0].clientX)} onTouchEnd={leave}>
      <svg width={width} height={height} role="img" aria-label={`Elevation profile from ${Math.round(ys[0]).toLocaleString()} to ${Math.round(ys[ys.length - 1]).toLocaleString()} feet over ${maxX.toFixed(1)} miles, ranging ${Math.round(Math.min(...ys)).toLocaleString()}–${Math.round(Math.max(...ys)).toLocaleString()} ft`}>
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(y)} y2={sy(y)} className="elev-grid" />
            <text x={PAD.left - 6} y={sy(y)} className="elev-tick" textAnchor="end" dominantBaseline="middle">{Math.round(y).toLocaleString()}</text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} x={sx(x)} y={height - 6} className="elev-tick" textAnchor={x === 0 ? 'start' : 'middle'}>{fmtMi(x)} mi</text>
        ))}
        <path d={area} className="elev-area" />
        <path d={line} className="elev-line" />
        {h && (
          <>
            <line x1={sx(h[0])} x2={sx(h[0])} y1={PAD.top} y2={PAD.top + ih} className="elev-cross" />
            <circle cx={sx(h[0])} cy={sy(h[1])} r="4.5" className="elev-dot" />
          </>
        )}
      </svg>
      {h && (
        <div className="elev-tip" style={{ left: Math.min(width - 110, Math.max(0, sx(h[0]) - 55)) }}>
          <strong>{Math.round(h[1]).toLocaleString()} ft</strong>
          <span>{h[0].toFixed(2)} mi</span>
        </div>
      )}
    </div>
  );
}
