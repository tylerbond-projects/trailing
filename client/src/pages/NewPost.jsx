import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Tabs, ErrorText, Spinner, Empty } from '../components/ui.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';
import TrailSelect, { useTrails } from '../components/TrailSelect.jsx';
import { miles, feet, duration, parseLocal, ACTIVITY_ICON, ACTIVITY_LABEL } from '../lib/format.js';
import Icon, { IconText } from '../components/Icon.jsx';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function NewPost() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'manual');
  return (
    <div className="page narrow">
      <div className="page-head"><h1>Share an activity</h1></div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'manual', label: <IconText icon="pencil">Log manually</IconText> },
        { value: 'strava', label: <IconText icon="activity">Import from Strava</IconText> },
      ]} />
      {tab === 'strava' ? <StravaImport /> : <ManualPost initialTrail={params.get('trail')} routeId={params.get('route')} />}
    </div>
  );
}

function Composer({ body, setBody, photos, setPhotos, trailId, setTrailId }) {
  return (
    <>
      <label>Trail<TrailSelect value={trailId} onChange={setTrailId} /></label>
      <label>Caption<textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How was it? Conditions, highlights, tips…" maxLength={2000} /></label>
      <PhotoPicker files={photos} onChange={setPhotos} />
    </>
  );
}

function ManualPost({ initialTrail, routeId }) {
  const navigate = useNavigate();
  const trails = useTrails();
  const [trailId, setTrailIdRaw] = useState(null);
  const [a, setA] = useState({ type: 'Hike', name: '', distance_mi: '', elevation_gain_ft: '', duration_min: '', start_date: nowLocal() });
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setA({ ...a, [k]: e.target.value });
  const [route, setRoute] = useState(null);

  useEffect(() => {
    if (!routeId) return;
    api(`/routes/${routeId}`).then(({ route: r }) => {
      setRoute(r);
      setA((s) => ({ ...s, type: r.activity === 'hike' ? 'Hike' : 'Run', name: r.name,
        distance_mi: (r.distance_m / 1609.344).toFixed(2), elevation_gain_ft: Math.round(r.elevation_gain_m * 3.28084) }));
    }).catch(() => {});
  }, [routeId]);

  // Picking a trail pre-fills its distance and elevation.
  function setTrailId(id) {
    setTrailIdRaw(id);
    const t = trails.find((x) => x.id === id);
    if (t) setA((s) => ({ ...s, name: s.name || t.name, distance_mi: t.distance_mi, elevation_gain_ft: t.elevation_gain_ft, duration_min: s.duration_min || t.est_minutes }));
  }
  useEffect(() => {
    if (initialTrail && trails.length && !trailId) {
      const t = trails.find((x) => x.slug === initialTrail);
      if (t) setTrailId(t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrail, trails]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData();
    for (const [k, v] of Object.entries(a)) form.append(k, v);
    if (trailId) form.append('trail_id', trailId);
    if (route) form.append('route_id', route.id);
    form.append('body', body);
    photos.forEach((p) => form.append('photos', p));
    try {
      await api('/posts', { method: 'POST', form });
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="segmented">
        {['Hike', 'TrailRun', 'Run', 'Walk'].map((t) => (
          <button type="button" key={t} className={a.type === t ? 'active' : ''} onClick={() => setA({ ...a, type: t })}><IconText icon={ACTIVITY_ICON[t]}>{ACTIVITY_LABEL[t]}</IconText></button>
        ))}
      </div>
      {route && <div className="post-trail"><span className="with-icon"><Icon name="route" size={16} />Route: {route.name}</span></div>}
      <Composer {...{ body, setBody, photos, setPhotos, trailId, setTrailId }} />
      <label>Title<input value={a.name} onChange={set('name')} placeholder="Morning hike" /></label>
      <div className="row-3">
        <label>Distance (mi)<input type="number" step="0.01" min="0" value={a.distance_mi} onChange={set('distance_mi')} required /></label>
        <label>Elevation (ft)<input type="number" min="0" value={a.elevation_gain_ft} onChange={set('elevation_gain_ft')} /></label>
        <label>Time (min)<input type="number" min="0" value={a.duration_min} onChange={set('duration_min')} /></label>
      </div>
      <label>When<input type="datetime-local" value={a.start_date} onChange={set('start_date')} max={nowLocal()} /></label>
      <ErrorText error={error} />
      <button className="btn primary block" disabled={busy}>{busy ? 'Posting…' : 'Post activity'}</button>
    </form>
  );
}

function StravaImport() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [trailId, setTrailId] = useState(null);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/strava/status').then((s) => {
      setStatus(s);
      if (s.connected) api('/strava/activities').then((d) => setList(d.activities)).catch((e) => setError(e.message));
    });
  }, []);

  async function connect() {
    try { window.location.href = (await api('/strava/connect-url')).url; } catch (e) { setError(e.message); }
  }

  function pick(act) {
    setSelected(act);
    setTrailId(act.suggested_trail_id);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // 1) import the activity, 2) publish a post for it (so photos can be attached)
      const { activity_id } = await api('/strava/import', { method: 'POST', body: { strava_id: selected.strava_id, trail_id: trailId, post: false } });
      const form = new FormData();
      form.append('activity_id', activity_id);
      if (trailId) form.append('trail_id', trailId);
      form.append('body', body);
      photos.forEach((p) => form.append('photos', p));
      await api('/posts', { method: 'POST', form });
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!status) return <Spinner />;
  if (!status.configured) {
    return (
      <Empty icon="activity" title="Strava isn't set up on this server yet">
        Add <code>STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> to <code>server/.env</code> (see the README), then restart.
      </Empty>
    );
  }
  if (!status.connected) {
    return (
      <div className="card center pad">
        <p>Connect Strava to import your hikes and runs — distance, elevation and time come over automatically, and we match them to the trail you were on.</p>
        <button className="btn strava" onClick={connect}>Connect with Strava</button>
        <ErrorText error={error} />
      </div>
    );
  }
  if (!list) return error ? <ErrorText error={error} /> : <Spinner />;

  if (selected) {
    return (
      <form className="card form" onSubmit={submit}>
        <div className="strava-selected">
          <strong className="with-icon"><Icon name={ACTIVITY_ICON[selected.type] || 'run'} />{selected.name}</strong>
          <span className="muted small">{miles(selected.distance_mi)} · {feet(selected.elevation_gain_ft)} · {duration(selected.moving_time_s)}</span>
          <button type="button" className="btn small" onClick={() => setSelected(null)}>Change</button>
        </div>
        {selected.suggested_trail_id && <p className="muted small with-icon"><Icon name="pin" size={14} />We matched this to a trail based on where you started.</p>}
        <Composer {...{ body, setBody, photos, setPhotos, trailId, setTrailId }} />
        <ErrorText error={error} />
        <button className="btn primary block" disabled={busy}>{busy ? 'Importing…' : 'Import & post'}</button>
      </form>
    );
  }

  return (
    <div className="list">
      {list.length === 0 && <Empty title="No recent hikes or runs on Strava" />}
      {list.map((act) => (
        <button key={act.strava_id} className="card list-row" disabled={act.imported} onClick={() => pick(act)}>
          <span className="list-icon"><Icon name={ACTIVITY_ICON[act.type] || 'run'} size={24} /></span>
          <span className="grow left">
            <strong>{act.name}</strong>
            <span className="muted small block">{parseLocal(act.start_date).toLocaleDateString()} · {miles(act.distance_mi)} · {feet(act.elevation_gain_ft)}</span>
          </span>
          {act.imported ? <span className="pill">Imported</span> : <span className="btn small">Import</span>}
        </button>
      ))}
      <p className="muted small center"><Link to="/settings">Manage Strava connection</Link></p>
    </div>
  );
}
