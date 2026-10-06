// Finds openly licensed photos for each trail on Wikimedia Commons.
//
//   node scripts/find-trail-photos.mjs [slug ...]
//
// Candidates come from (1) the lead image of a matching Wikipedia article,
// (2) a Commons text search for the trail/landmark name, and (3) Commons
// photos geotagged near the trailhead. Only free licenses are kept (CC0,
// public domain, CC BY, CC BY-SA); NonCommercial/NoDerivatives are never on
// Commons. Results go to scripts/photos/candidates.json for review, and
// data/photo-overrides.json can pin or veto a file per trail.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'TrailingApp/1.0 (https://trailing.pages.dev; trail cover photos)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const GENERIC = new Set(['trail', 'trails', 'via', 'loop', 'the', 'and', 'to', 'of', 'from', 'up', 'bottom', 'lower', 'upper', 'road', 'utah', 'canyon', 'lake', 'lakes', 'peak', 'falls', 'mount', 'mountain', 'point', 'park', 'trailhead', 'formerly', 'parkway', 'river', 'creek', 'springs']);
const BAD_TITLE = /\b(map|maps|sign|signage|logo|diagram|plaque|kiosk|brochure|chart|graph|parking|restroom|toilet|vehicle|car|truck|bus|people|selfie|portrait|interior|museum|svg|webp|tif|house|church|school|census|magazine|gymnasium|building|store|temple|campaign|rally|volunteer|event|meeting|hall|stadium|highway|interstate|modis|satellite|aerial|ward|chapel|cemetery|hotel|restaurant)\b/i;
const FREE = /^(cc0|public domain|pd|cc[ -]by(-sa)?[ -]?\d|cc[ -]by(-sa)?$)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    return res.json();
  }
  throw new Error(`API failed: ${url}`);
}

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function km(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const core = (name) => name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(trail|loop)\b/g, ' ').split(/\bvia\b/)[0].replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !GENERIC.has(w));

/** Commons file info for a batch of File: titles. */
async function fileInfo(titles) {
  if (!titles.length) return [];
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const d = await api(COMMONS, {
      action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'imageinfo|coordinates',
      iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1600', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|ObjectName|Categories',
    });
    for (const p of d.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii || p.missing) continue;
      const m = ii.extmetadata || {};
      out.push({
        title: p.title, width: ii.width, height: ii.height, mime: ii.mime,
        thumb: ii.thumburl, page: ii.descriptionurl,
        license: m.LicenseShortName?.value || '', license_url: m.LicenseUrl?.value || null,
        author: strip(m.Artist?.value), description: strip(m.ImageDescription?.value).slice(0, 300),
        categories: m.Categories?.value || '',
        coords: p.coordinates?.[0] ? [p.coordinates[0].lat, p.coordinates[0].lon] : null,
      });
    }
    await sleep(200);
  }
  return out;
}

async function wikipediaLead(t) {
  const q = t.name.replace(/\(.*?\)/g, '').replace(/\b(via|trail|loop)\b.*$/i, '').trim();
  const d = await api(WIKI, { action: 'query', generator: 'search', gsrsearch: `${q} Utah`, gsrlimit: '4', prop: 'pageimages|coordinates', piprop: 'name' });
  const pages = (d.query?.pages || []).sort((a, b) => a.index - b.index);
  const want = tokens(t.name);
  for (const p of pages) {
    const titleToks = tokens(p.title);
    const overlap = want.filter((w) => titleToks.includes(w)).length;
    const near = p.coordinates?.[0] ? km([t.lat, t.lng], [p.coordinates[0].lat, p.coordinates[0].lon]) < 25 : false;
    if (p.pageimage && overlap && (near || overlap === want.length)) return { file: `File:${p.pageimage}`, article: p.title };
  }
  return null;
}

async function candidatesFor(t, overrides) {
  const want = tokens(t.name);
  const titles = new Map(); // title -> source tags
  const tag = (title, src) => titles.set(title, [...(titles.get(title) || []), src]);

  if (overrides[t.slug] === null) return { trail: t.slug, picks: [] };
  if (overrides[t.slug]) tag(overrides[t.slug], 'override');

  const lead = await wikipediaLead(t).catch(() => null);
  if (lead) tag(lead.file, 'wikipedia');

  const q = t.name.replace(/\(.*?\)/g, '').replace(/\b(via|trail)\b/gi, '').replace(/\s+/g, ' ').trim();
  const phrase = core(t.name);

  // 1) Curated Commons categories whose name matches the trail/landmark.
  const cats = await api(COMMONS, { action: 'query', list: 'search', srsearch: q, srnamespace: '14', srlimit: '8' });
  for (const c of cats.query?.search || []) {
    const ct = c.title.toLowerCase();
    const ok = want.length ? want.every((w) => ct.includes(w)) : ct.includes(phrase);
    if (!ok || /\b(maps?|people|signs?|buildings?)\b/.test(ct)) continue;
    const m = await api(COMMONS, { action: 'query', list: 'categorymembers', cmtitle: c.title, cmtype: 'file', cmlimit: '60' });
    for (const r of m.query?.categorymembers || []) tag(r.title, 'category');
    await sleep(150);
  }

  // 2) Text search on file pages.
  const s = await api(COMMONS, { action: 'query', list: 'search', srsearch: `${q} Utah filetype:bitmap`, srnamespace: '6', srlimit: '30' });
  for (const r of s.query?.search || []) tag(r.title, 'search');

  const infos = await fileInfo([...titles.keys()]);
  const scored = [];
  for (const f of infos) {
    const src = titles.get(f.title) || [];
    const isOverride = src.includes('override');
    if (!isOverride) {
      if (!/jpe?g|png/.test(f.mime) || f.width < 1000 || BAD_TITLE.test(f.title)) continue;
      const ratio = f.width / f.height;
      if (ratio < 1.15 || ratio > 2.4) continue;
      if (!FREE.test(f.license.trim())) continue;
    }
    const text = `${f.title} ${f.description} ${f.categories}`.toLowerCase();
    const matched = want.filter((w) => text.includes(w)).length;
    const fullMatch = want.length ? matched === want.length : text.includes(phrase);
    const dist = f.coords ? km([t.lat, t.lng], f.coords) : null;
    // Strict: must be in a matching category, be the Wikipedia lead image, or name the place.
    if (!isOverride && !src.includes('category') && !src.includes('wikipedia') && !fullMatch) continue;
    if (!isOverride && dist != null && dist > 30) continue;
    if (!isOverride && !/utah|\but\b|zion|bryce|arches|canyonlands|capitol reef|wasatch|uinta|moab|provo|ogden|logan|salt lake/.test(text) && dist == null && !src.includes('category')) continue;
    let score = 0;
    if (isOverride) score += 1000;
    if (src.includes('wikipedia')) score += 35;
    if (src.includes('category')) score += 30;
    score += fullMatch ? 30 : 0;
    if (dist != null) score += Math.max(0, 12 - dist);
    if (/quality images|featured pictures|valued images/i.test(f.categories)) score += 15;
    score += Math.min(10, f.width / 400);
    scored.push({ ...f, sources: src, matched, distance_km: dist == null ? null : Math.round(dist * 10) / 10, score: Math.round(score) });
  }
  scored.sort((a, b) => b.score - a.score);
  return { trail: t.slug, name: t.name, want, picks: scored.slice(0, 6) };
}

const trails = fs.readdirSync(path.join(root, 'data', 'regions')).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'regions', f), 'utf8')).trails);
const overridesPath = path.join(root, 'data', 'photo-overrides.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
const only = process.argv.slice(2);
const outPath = path.join(root, 'scripts', 'photos', 'candidates.json');
const results = only.length && fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

for (const t of trails.filter((x) => !only.length || only.includes(x.slug))) {
  try {
    const r = await candidatesFor(t, overrides);
    results[t.slug] = r;
    const top = r.picks[0];
    console.log(`${top ? `${String(top.score).padStart(4)} ✓` : '   – ✗'} ${t.slug.padEnd(34)} ${top ? `${top.title.slice(5, 70)} [${top.sources.join(',')}] ${top.license}` : 'no free photo found'}`);
  } catch (e) {
    console.log(`   ! ${t.slug}: ${e.message}`);
  }
  await sleep(300);
}
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nWrote ${outPath}`);
