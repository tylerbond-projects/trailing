// Bootstrap a new region from OpenStreetMap.
//
//   node scripts/import-osm.js <region-id> "<Region Name>" <south,west,north,east> [state]
//   e.g. node scripts/import-osm.js salt-lake-county "Salt Lake County" 40.41,-112.26,40.85,-111.55 UT
//
// Pulls named hiking routes + named footpaths from the Overpass API, measures
// their length, and writes data/regions/<region-id>.json in the same format as
// utah-county.json. Elevation gain isn't in OSM, so the output marks those
// trails with "needs_review": true — fill in elevation/descriptions (or wire
// up an elevation API) before shipping. Restart the server to load the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , id, name, bboxArg, state = null] = process.argv;
if (!id || !name || !bboxArg) {
  console.error('Usage: node scripts/import-osm.js <region-id> "<Region Name>" <south,west,north,east> [state]');
  process.exit(1);
}
const bbox = bboxArg.split(',').map(Number);
const query = `[out:json][timeout:120];
(
  relation["route"="hiking"]["name"](${bbox});
  way["highway"~"path|footway"]["name"]["sac_scale"](${bbox});
);
out geom tags;`;

const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }) });
if (!res.ok) throw new Error(`Overpass error ${res.status}`);
const { elements } = await res.json();

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const pointsOf = (el) => el.type === 'way' ? [el.geometry] : (el.members || []).filter((m) => m.geometry).map((m) => m.geometry);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const byName = new Map();
for (const el of elements) {
  const n = el.tags?.name;
  if (!n) continue;
  const lines = pointsOf(el);
  const lengthKm = lines.reduce((s, line) => s + line.slice(1).reduce((acc, p, i) => acc + km(line[i], p), 0), 0);
  if (lengthKm < 0.3) continue;
  const prev = byName.get(n);
  if (!prev || lengthKm > prev.lengthKm) byName.set(n, { el, lengthKm, start: lines[0][0] });
}

const trails = [...byName.entries()].map(([n, { el, lengthKm, start }]) => ({
  slug: slugify(`${n}-${id}`),
  name: n,
  area: el.tags['is_in'] || null,
  lat: Math.round(start.lat * 1e4) / 1e4,
  lng: Math.round(start.lon * 1e4) / 1e4,
  distance_mi: Math.round(lengthKm * 0.621371 * 2 * 10) / 10, // assume out-and-back
  elevation_gain_ft: 0,
  route_type: 'out-and-back',
  features: [],
  activities: ['hike'],
  dogs: el.tags.dog === 'no' ? 'no' : null,
  technical: /demanding|alpine/.test(el.tags.sac_scale || ''),
  best_seasons: ['spring', 'summer', 'fall'],
  surface: el.tags.surface || null,
  description: el.tags.description || '',
  needs_review: true,
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'data', 'regions', `${id}.json`);
fs.writeFileSync(out, JSON.stringify({
  region: { id, name, state, country: 'US', center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], zoom: 10 },
  notes: 'Generated from OpenStreetMap (ODbL). Review elevation, descriptions and features before release.',
  trails,
}, null, 2));
console.log(`Wrote ${trails.length} trails to ${out}`);
