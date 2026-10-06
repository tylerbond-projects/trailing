import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { locate, pointAtDistance } from '../lib/geo.js';
import { storage } from '../lib/storage.js';
import RouteMap from '../components/RouteMap.jsx';
import ElevationChart from '../components/ElevationChart.jsx';
import Icon, { IconText } from '../components/Icon.jsx';
import { ErrorText } from '../components/ui.jsx';
import { metersToMiles, metersToFeet, duration } from '../lib/format.js';

const DRAFT = 'trailing.routeDraft';

export default function RouteBuilder() {
  const navigate = useNavigate();
  const draft = useMemo(() => { try { return JSON.parse(storage.get(DRAFT) || 'null'); } catch { return null; } }, []);
  const [waypoints, setWaypoints] = useState(draft?.waypoints || []);
  const [snap, setSnap] = useState(draft?.snap ?? true);
  const [outAndBack, setOutAndBack] = useState(draft?.outAndBack ?? false);
  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [center, setCenter] = useState(null);
  const [here, setHere] = useState(null);
  const [hoverPt, setHoverPt] = useState(null);
  const [pace, setPace] = useState(Number(storage.get('trailing.pace')) || 9);
  const [form, setForm] = useState({ name: '', description: '', is_public: true, activity: 'run' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  // Start near the runner if they allow location.
  useEffect(() => { locate().then((p) => { if (!p) return; setHere(p); if (!waypoints.length) setCenter(p); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-plan (snap + elevation) shortly after the drawing changes.
  useEffect(() => {
    storage.set(DRAFT, JSON.stringify({ waypoints, snap, outAndBack }));
    if (waypoints.length < 2) { setPlan(null); return; }
    const id = ++seq.current;
    setPlanning(true);
    const t = setTimeout(async () => {
      try {
        const p = await api('/routes/plan', { method: 'POST', body: { waypoints, snap, out_and_back: outAndBack } });
        if (id === seq.current) setPlan(p);
      } catch (e) { setError(e.message); }
      if (id === seq.current) setPlanning(false);
    }, 350);
    return () => clearTimeout(t);
  }, [waypoints, snap, outAndBack]);

  const add = (p) => setWaypoints((w) => (w.length >= 60 ? w : [...w, p]));
  const move = (i, p) => setWaypoints((w) => w.map((x, j) => (j === i ? p : x)));
  const remove = (i) => setWaypoints((w) => w.filter((_, j) => j !== i));
  const closeLoop = () => waypoints.length > 1 && setWaypoints((w) => [...w, w[0]]);
  const path = plan?.path || waypoints;
  const mi = plan ? metersToMiles(plan.distance_m) : 0;
  const isLoop = waypoints.length > 2 && waypoints[0][0] === waypoints.at(-1)[0] && waypoints[0][1] === waypoints.at(-1)[1];

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { id } = await api('/routes', { method: 'POST', body: { ...form, waypoints, snap, out_and_back: outAndBack } });
      storage.remove(DRAFT);
      navigate(`/routes/${id}`);
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="page builder">
      <div className="page-head">
        <h1>Build a route</h1>
        <span className="muted small">{waypoints.length ? `${waypoints.length} point${waypoints.length > 1 ? 's' : ''}` : 'Tap the map to start'}</span>
      </div>

      <div className="builder-grid">
        <div className="builder-map">
          <RouteMap editable path={path} waypoints={waypoints} onAdd={add} onMove={move} onRemove={remove}
            center={center} highlight={hoverPt} height="100%" userLocation={here}>
          <div className="map-tools">
            <button type="button" className="tool" onClick={() => setWaypoints((w) => w.slice(0, -1))} disabled={!waypoints.length} aria-label="Undo last point"><Icon name="undo" /></button>
            <button type="button" className="tool" onClick={() => { if (confirm('Clear this route?')) setWaypoints([]); }} disabled={!waypoints.length} aria-label="Clear route"><Icon name="trash" /></button>
          </div>
          {planning && <div className="map-status">Planning…</div>}
          {plan && <div className="map-chip">{mi.toFixed(2)} mi · {Math.round(metersToFeet(plan.elevation_gain_m)).toLocaleString()} ft gain</div>}
          </RouteMap>
        </div>

        <div className="builder-panel">
          <div className="stat-grid card builder-stats">
            <div><span className="label">Distance</span><strong>{mi.toFixed(2)} mi</strong></div>
            <div><span className="label">Elevation gain</span><strong>{Math.round(metersToFeet(plan?.elevation_gain_m || 0)).toLocaleString()} ft</strong></div>
            <div>
              <span className="label">Est. time</span>
              <strong>{mi ? duration(mi * pace * 60) : '—'}</strong>
              <label className="pace-input">at <input type="number" min="4" max="30" step="0.25" value={pace}
                onChange={(e) => { setPace(Number(e.target.value) || 9); storage.set('trailing.pace', e.target.value); }} /> min/mi</label>
            </div>
          </div>

          <div className="card pad">
            <ElevationChart profile={plan?.profile} onHover={(d) => setHoverPt(d == null ? null : pointAtDistance(plan.path, d))} />
          </div>

          <div className="chips">
            <button type="button" className={`chip ${snap ? 'active' : ''}`} onClick={() => setSnap(!snap)}><IconText icon="magic" size={14}>Snap to paths</IconText></button>
            <button type="button" className={`chip ${isLoop ? 'active' : ''}`} onClick={closeLoop} disabled={waypoints.length < 2 || isLoop}><IconText icon="loop" size={14}>Close loop</IconText></button>
            <button type="button" className={`chip ${outAndBack ? 'active' : ''}`} onClick={() => setOutAndBack(!outAndBack)}><IconText icon="out-back" size={14}>Out & back</IconText></button>
          </div>
          {plan && snap && !plan.snapped && <p className="muted small">Couldn't find paths between these points, so they're joined with straight lines.</p>}
          <p className="muted xsmall">Tap the map to add points · drag a point to move it · tap a point to remove it.</p>

          <form className="card form" onSubmit={save}>
            <label>Route name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning river loop" maxLength={80} required /></label>
            <label>Notes<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Water fountains, parking, surface…" maxLength={1000} /></label>
            <div className="segmented">
              <button type="button" className={form.activity === 'run' ? 'active' : ''} onClick={() => setForm({ ...form, activity: 'run' })}><IconText icon="run">Run</IconText></button>
              <button type="button" className={form.activity === 'hike' ? 'active' : ''} onClick={() => setForm({ ...form, activity: 'hike' })}><IconText icon="boot">Hike</IconText></button>
            </div>
            <div className="segmented">
              <button type="button" className={form.is_public ? 'active' : ''} onClick={() => setForm({ ...form, is_public: true })}><IconText icon="globe">Public</IconText></button>
              <button type="button" className={!form.is_public ? 'active' : ''} onClick={() => setForm({ ...form, is_public: false })}><IconText icon="lock">Only me</IconText></button>
            </div>
            <ErrorText error={error} />
            <button className="btn primary block" disabled={saving || waypoints.length < 2 || planning}>{saving ? 'Saving…' : 'Save route'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
