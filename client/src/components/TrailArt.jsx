// Procedural landscape illustration for trails without photos. Deterministic
// per trail so each one gets a consistent "cover".
const PALETTES = [
  { sky: ['#f7c59f', '#f3e1c7'], far: '#9db4a6', mid: '#5f8a72', near: '#2f5a45' },
  { sky: ['#e8d9b8', '#f6efdf'], far: '#b9b79a', mid: '#8a8c6a', near: '#4f5a3e' },
  { sky: ['#f2a477', '#fbd8b8'], far: '#c79a86', mid: '#9a6a58', near: '#5e3f36' },
  { sky: ['#cbd9c4', '#f2f0e4'], far: '#9fb39a', mid: '#6f8d68', near: '#3f5f3a' },
  { sky: ['#efcfa8', '#f8ecd9'], far: '#c8a98a', mid: '#a07a5c', near: '#5c4a38' },
];

function rng(seed) {
  let s = [...seed].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function ridge(rand, base, amp, peaks, w = 400) {
  const pts = [[0, base]];
  for (let i = 1; i <= peaks; i++) {
    const x = (i / (peaks + 1)) * w + (rand() - 0.5) * 30;
    pts.push([x, base - amp * (0.4 + rand() * 0.6)]);
    pts.push([x + w / (peaks + 1) / 2, base - amp * rand() * 0.3]);
  }
  pts.push([w, base - amp * rand() * 0.4], [w, 200], [0, 200]);
  return pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
}

export default function TrailArt({ trail, className = '' }) {
  const rand = rng(trail.slug || trail.name || 'trail');
  const p = PALETTES[Math.floor(rand() * PALETTES.length)];
  const f = trail.features || [];
  const tall = f.includes('summit') ? 1.4 : 1;
  const id = `g-${trail.slug || trail.id}`;
  const sunX = 60 + rand() * 280;
  return (
    <svg className={`trail-art ${className}`} viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} /><stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id})`} />
      <circle cx={sunX} cy={50 + rand() * 20} r="18" fill="#fff7e6" opacity=".85" />
      <polygon points={ridge(rand, 120, 70 * tall, 3)} fill={p.far} />
      {f.includes('summit') && <polygon points={`${180 + rand() * 40},${36} 214,56 200,54 188,62 172,56`} fill="#fff" opacity=".7" />}
      <polygon points={ridge(rand, 150, 55, 4)} fill={p.mid} />
      {f.includes('waterfall') && <rect x={250 + rand() * 40} y="112" width="5" height="44" rx="2" fill="#e8f4fb" opacity=".9" />}
      {f.includes('lake') && <ellipse cx={140 + rand() * 120} cy="172" rx="70" ry="10" fill="#bfe0ef" opacity=".9" />}
      <polygon points={ridge(rand, 185, 30, 6)} fill={p.near} />
      {(f.includes('shade') || f.includes('fall-colors')) && [...Array(7)].map((_, i) => {
        const x = rand() * 400;
        return <polygon key={i} points={`${x},${165 + rand() * 15} ${x - 7},${195} ${x + 7},${195}`} fill={f.includes('fall-colors') && i % 2 ? '#d98b3a' : p.near} />;
      })}
    </svg>
  );
}
