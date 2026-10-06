import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import TrailCard from '../components/TrailCard.jsx';
import TrailMap from '../components/Map.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import { featureLabel } from '../lib/format.js';
import { storage } from '../lib/storage.js';

const DIFFICULTY = [
  { label: 'Easy', min: 1, max: 2 }, { label: 'Moderate', min: 3, max: 4 },
  { label: 'Hard', min: 5, max: 6 }, { label: 'Very hard+', min: 7, max: 10 },
];
const LENGTHS = [{ label: '< 3 mi', v: 3 }, { label: '< 6 mi', v: 6 }, { label: '< 10 mi', v: 10 }];
const FEATURES = ['waterfall', 'summit', 'lake', 'views', 'fall-colors', 'wildflowers', 'river', 'hot-springs', 'cave', 'solitude'];
const SORTS = [['popular', 'Most popular'], ['rating', 'Top rated'], ['easiest', 'Easiest'], ['hardest', 'Hardest'], ['shortest', 'Shortest'], ['longest', 'Longest'], ['name', 'A–Z']];

export default function Explore() {
  const [trails, setTrails] = useState(null);
  const [regions, setRegions] = useState([]);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ region: '', diff: null, maxDistance: null, features: [], run: false, dogs: false, kid: false, sort: 'popular' });
  const [view, setViewRaw] = useState(storage.get('explore.view') || 'list');
  const setView = (v) => { setViewRaw(v); storage.set('explore.view', v); };

  useEffect(() => { api('/trails/regions').then((d) => setRegions(d.regions)); }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ sort: filters.sort });
    if (debounced) p.set('q', debounced);
    if (filters.region) p.set('region', filters.region);
    if (filters.diff) { p.set('minDifficulty', filters.diff.min); p.set('maxDifficulty', filters.diff.max); }
    if (filters.maxDistance) p.set('maxDistance', filters.maxDistance);
    filters.features.forEach((f) => p.append('feature', f));
    if (filters.run) p.set('activity', 'trail-run');
    if (filters.dogs) p.set('dogs', '1');
    if (filters.kid) p.set('kid', '1');
    return p.toString();
  }, [debounced, filters]);

  useEffect(() => { api(`/trails?${query}`).then((d) => setTrails(d.trails)); }, [query]);

  const toggle = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));
  const toggleFeature = (v) => setFilters((f) => ({ ...f, features: f.features.includes(v) ? f.features.filter((x) => x !== v) : [...f.features, v] }));
  const region = regions.find((r) => r.id === filters.region);
  const active = filters.diff || filters.maxDistance || filters.features.length || filters.run || filters.dogs || filters.kid;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Explore trails</h1>
        <div className="segmented small">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ List</button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>🗺️ Map</button>
        </div>
      </div>

      <div className="filters">
        <div className="search-row">
          <input type="search" className="search" placeholder="Search trails, canyons, towns…" value={q} onChange={(e) => setQ(e.target.value)} />
          {regions.length > 1 && (
            <select value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}>
              <option value="">All regions</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} aria-label="Sort">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="chips scroll">
          {DIFFICULTY.map((d) => <button key={d.label} className={`chip ${filters.diff === d ? 'active' : ''}`} onClick={() => toggle('diff', d)}>{d.label}</button>)}
          <span className="chip-sep" />
          {LENGTHS.map((l) => <button key={l.v} className={`chip ${filters.maxDistance === l.v ? 'active' : ''}`} onClick={() => toggle('maxDistance', l.v)}>{l.label}</button>)}
          <span className="chip-sep" />
          <button className={`chip ${filters.run ? 'active' : ''}`} onClick={() => setFilters({ ...filters, run: !filters.run })}>🏃 Runnable</button>
          <button className={`chip ${filters.dogs ? 'active' : ''}`} onClick={() => setFilters({ ...filters, dogs: !filters.dogs })}>🐕 Dog friendly</button>
          <button className={`chip ${filters.kid ? 'active' : ''}`} onClick={() => setFilters({ ...filters, kid: !filters.kid })}>👨‍👧 Kid friendly</button>
        </div>
        <div className="chips scroll">
          {FEATURES.map((f) => <button key={f} className={`chip ${filters.features.includes(f) ? 'active' : ''}`} onClick={() => toggleFeature(f)}>{featureLabel(f)}</button>)}
        </div>
      </div>

      {!trails ? <Spinner /> : (
        <>
          <p className="muted small">
            {trails.length} trail{trails.length === 1 ? '' : 's'}{region ? ` in ${region.name}` : ''}
            {active ? <> · <button className="link" onClick={() => setFilters({ ...filters, diff: null, maxDistance: null, features: [], run: false, dogs: false, kid: false })}>Clear filters</button></> : null}
          </p>
          {trails.length === 0 && <Empty icon="🔍" title="No trails match those filters" />}
          {view === 'map'
            ? <TrailMap trails={trails} height={560} />
            : <div className="grid">{trails.map((t) => <TrailCard key={t.id} trail={t} />)}</div>}
        </>
      )}
    </div>
  );
}
