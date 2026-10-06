// Route planning: snaps waypoints to walkable paths/roads (OSRM foot profile on
// the FOSSGIS public server) and samples elevation from the AWS Terrain Tiles
// open dataset (Terrarium PNGs, ~10 m in the US, no key or rate limit), with
// Open-Meteo (90 m DEM) as a fallback.
// Both are free public services with fair-use limits; swap them here if you
// move to a paid provider (Mapbox, Stadia, GraphHopper, …).
const FOOT_ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
import { decode as decodePng } from 'fast-png';

const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const UA = 'Trailing/1.0 (route planner)';
export const MAX_WAYPOINTS = 60;

const toRad = (d) => (d * Math.PI) / 180;
export function haversineM([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

export function pathLength(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineM(path[i - 1], path[i]);
  return d;
}

const round5 = (n) => Math.round(n * 1e5) / 1e5;

export function cleanWaypoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]))
    .map(([lat, lng]) => [round5(+lat), round5(+lng)])
    .filter(([lat, lng]) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
    .slice(0, MAX_WAYPOINTS);
}

/** Follow paths/roads between waypoints. Returns null if the router can't help. */
async function snapPath(waypoints) {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  try {
    const res = await fetch(`${FOOT_ROUTER}/${coords}?overview=full&geometries=geojson&continue_straight=false`, {
      headers: { 'User-Agent': UA }, cf: { cacheTtl: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const line = data.routes?.[0]?.geometry?.coordinates;
    return data.code === 'Ok' && line?.length ? line.map(([lng, lat]) => [round5(lat), round5(lng)]) : null;
  } catch {
    return null;
  }
}

/** Points every `step` metres along a path, with their cumulative distance. */
function resample(path, count) {
  const total = pathLength(path);
  if (path.length < 2 || total === 0) return path.map((p) => ({ p, d: 0 }));
  const step = total / (count - 1);
  const out = [{ p: path[0], d: 0 }];
  let seg = 1, segStart = 0, segLen = haversineM(path[0], path[1]);
  for (let i = 1; i < count - 1; i++) {
    const target = i * step;
    while (segStart + segLen < target && seg < path.length - 1) {
      segStart += segLen; seg++; segLen = haversineM(path[seg - 1], path[seg]);
    }
    const t = segLen ? (target - segStart) / segLen : 0;
    const [a, b] = [path[seg - 1], path[seg]];
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: target });
  }
  out.push({ p: path[path.length - 1], d: total });
  return out;
}

// ---- Terrain tiles -------------------------------------------------------------
function tileXY(lat, lng, z) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.floor((x % 1) * 256), py: Math.floor((y % 1) * 256) };
}

async function terrainElevations(points) {
  const span = pathLength(points.map((x) => x.p));
  const z = span < 25000 ? 14 : span < 80000 ? 13 : 12;
  const tiles = new Map();
  const coords = points.map(({ p }) => tileXY(p[0], p[1], z));
  const keys = [...new Set(coords.map((c) => `${c.tx}/${c.ty}`))];
  if (keys.length > 40) return null;
  await Promise.all(keys.map(async (k) => {
    const res = await fetch(`${TERRAIN_TILES}/${z}/${k}.png`, { cf: { cacheTtl: 2592000, cacheEverything: true } });
    if (!res.ok) throw new Error(`terrain tile ${res.status}`);
    tiles.set(k, decodePng(new Uint8Array(await res.arrayBuffer())));
  }));
  return coords.map(({ tx, ty, px, py }) => {
    const img = tiles.get(`${tx}/${ty}`);
    const i = (py * img.width + px) * img.channels;
    return img.data[i] * 256 + img.data[i + 1] + img.data[i + 2] / 256 - 32768;
  });
}

async function elevations(points) {
  try {
    const e = await terrainElevations(points);
    if (e) return e;
  } catch (err) {
    console.error('terrain tiles failed, falling back', err.message);
  }
  return openMeteoElevations(points);
}

async function openMeteoElevations(points) {
  const lat = points.map((x) => x.p[0].toFixed(5)).join(',');
  const lng = points.map((x) => x.p[1].toFixed(5)).join(',');
  try {
    let res = await fetch(`${ELEVATION_API}?latitude=${lat}&longitude=${lng}`, { cf: { cacheTtl: 86400 } });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1200)); res = await fetch(`${ELEVATION_API}?latitude=${lat}&longitude=${lng}`); }
    if (!res.ok) return null;
    const { elevation } = await res.json();
    return Array.isArray(elevation) && elevation.length === points.length ? elevation : null;
  } catch {
    return null;
  }
}

const smooth = (a) => a.map((_, i) => { const w = a.slice(Math.max(0, i - 1), i + 2); return w.reduce((x, y) => x + y, 0) / w.length; });

/** Gain/loss with a small hysteresis so DEM noise doesn't inflate totals. */
function climb(elev, threshold = 3) {
  let gain = 0, loss = 0, ref = elev[0];
  for (const e of elev) {
    if (e - ref >= threshold) { gain += e - ref; ref = e; }
    else if (ref - e >= threshold) { loss += ref - e; ref = e; }
  }
  return { gain, loss };
}

/**
 * Build a route from user waypoints.
 * @returns {{ path, snapped, distance_m, elevation_gain_m, elevation_loss_m, profile }}
 */
export async function planRoute(rawWaypoints, { snap = true, outAndBack = false } = {}) {
  const waypoints = cleanWaypoints(rawWaypoints);
  if (waypoints.length < 2) return { waypoints, path: waypoints, snapped: false, distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, profile: [] };

  let path = snap ? await snapPath(waypoints) : null;
  const snapped = !!path;
  if (!path) path = waypoints;

  const oneWay = pathLength(path);
  const samples = resample(path, Math.min(100, Math.max(2, Math.ceil(oneWay / 25))));
  const elev = await elevations(samples);

  let profile = elev ? samples.map((s, i) => [Math.round(s.d), Math.round(elev[i])]) : [];
  let fullPath = path;
  if (outAndBack) {
    fullPath = [...path, ...path.slice(0, -1).reverse()];
    if (profile.length) profile = [...profile, ...profile.slice(0, -1).reverse().map(([d, e]) => [Math.round(2 * oneWay - d), e])];
  }
  const { gain, loss } = elev ? climb(smooth(profile.map(([, e]) => e))) : { gain: 0, loss: 0 };
  return {
    waypoints, path: fullPath, snapped,
    distance_m: Math.round(pathLength(fullPath)),
    elevation_gain_m: Math.round(gain), elevation_loss_m: Math.round(loss),
    profile,
  };
}

/** Evenly thin a path for list thumbnails. */
export function simplify(path, max = 60) {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]);
}
