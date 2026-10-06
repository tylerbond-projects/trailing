import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { pointAtDistance } from '../lib/geo.js';
import { storage } from '../lib/storage.js';
import RouteMap from '../components/RouteMap.jsx';
import ElevationChart from '../components/ElevationChart.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, Spinner, ErrorText } from '../components/ui.jsx';
import { metersToMiles, metersToFeet, duration, pace, timeAgo } from '../lib/format.js';

export default function RouteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [hoverPt, setHoverPt] = useState(null);
  const [copied, setCopied] = useState(false);
  const myPace = Number(storage.get('trailing.pace')) || 9;

  useEffect(() => { api(`/routes/${id}`).then((d) => setR(d.route)).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="page"><ErrorText error={error} /></div>;
  if (!r) return <Spinner />;
  const mi = metersToMiles(r.distance_m);

  async function share() {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: r.name, url }); } catch { /* cancelled */ } return; }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function togglePublic() {
    await api(`/routes/${r.id}`, { method: 'PATCH', body: { is_public: !r.is_public } });
    setR({ ...r, is_public: !r.is_public });
  }
  async function remove() {
    if (!confirm('Delete this route?')) return;
    await api(`/routes/${r.id}`, { method: 'DELETE' });
    navigate('/routes');
  }

  return (
    <div className="page narrow">
      <div>
        <div className="muted small with-icon"><Icon name={r.activity === 'hike' ? 'boot' : 'run'} size={14} />{r.activity === 'hike' ? 'Hiking' : 'Running'} route · {r.is_public ? 'Public' : 'Private'}</div>
        <h1>{r.name}</h1>
        <Link to={`/u/${r.user.username}`} className="outing-meta"><Avatar user={r.user} size={22} /><span className="small">{r.user.display_name} · {timeAgo(r.created_at)}</span></Link>
      </div>

      <RouteMap path={r.path} fitKey={r.id} highlight={hoverPt} height={340} lockOnTouch />

      <div className="stat-grid card">
        <div><span className="label">Distance</span><strong>{mi.toFixed(2)} mi</strong></div>
        <div><span className="label">Elevation gain</span><strong>{Math.round(metersToFeet(r.elevation_gain_m)).toLocaleString()} ft</strong></div>
        <div><span className="label">At {myPace}:00/mi</span><strong>{duration(mi * myPace * 60)}</strong></div>
        {r.my_best && <div><span className="label">Your best</span><strong>{duration(r.my_best.moving_time_s)}</strong><span className="muted xsmall">{pace(mi, r.my_best.moving_time_s)}</span></div>}
        <div><span className="label">Times run</span><strong>{r.times_logged}</strong></div>
      </div>

      <section className="card pad">
        <h2>Elevation</h2>
        <ElevationChart profile={r.profile} onHover={(d) => setHoverPt(d == null ? null : pointAtDistance(r.path, d))} />
      </section>

      {r.description && <p className="pre">{r.description}</p>}

      <div className="action-bar">
        <Link className="btn primary" to={`/post/new?route=${r.id}`}><Icon name={r.activity === 'hike' ? 'boot' : 'run'} size={17} /> Log a {r.activity === 'hike' ? 'hike' : 'run'} on this route</Link>
        <button className="btn" onClick={share}><Icon name="share" size={17} /> {copied ? 'Link copied' : 'Share'}</button>
        <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${r.start[0]},${r.start[1]}`} target="_blank" rel="noreferrer"><Icon name="compass" size={17} /> Directions</a>
      </div>
      {r.is_mine && (
        <div className="row wrap">
          <button className="btn small" onClick={togglePublic}><Icon name={r.is_public ? 'lock' : 'globe'} size={15} /> Make {r.is_public ? 'private' : 'public'}</button>
          <button className="btn small danger" onClick={remove}><Icon name="trash" size={15} /> Delete</button>
        </div>
      )}
      {!r.snapped && <p className="muted xsmall">Drawn with straight lines between points.</p>}
    </div>
  );
}
