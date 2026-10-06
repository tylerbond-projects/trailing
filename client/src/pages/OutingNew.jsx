import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TrailSelect, { useTrails } from '../components/TrailSelect.jsx';
import { ErrorText } from '../components/ui.jsx';
import Icon, { IconText } from '../components/Icon.jsx';

function defaultStart() {
  const d = new Date(Date.now() + 2 * 86400000);
  d.setHours(8, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function OutingNew() {
  const [params] = useSearchParams();
  const trails = useTrails();
  const navigate = useNavigate();
  const [f, setF] = useState({ trail_id: null, title: '', description: '', starts_at: defaultStart(), visibility: 'public', max_people: '', pace: 'moderate' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  useEffect(() => {
    const slug = params.get('trail');
    const t = slug && trails.find((x) => x.slug === slug);
    if (t && !f.trail_id) setF((s) => ({ ...s, trail_id: t.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails]);

  const trail = trails.find((t) => t.id === f.trail_id);

  async function submit(e) {
    e.preventDefault();
    try {
      const { outing } = await api('/outings', { method: 'POST', body: { ...f, starts_at: new Date(f.starts_at).toISOString(), title: f.title || trail?.name } });
      navigate(`/hikes/${outing.id}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Plan a group hike</h1></div>
      <form className="card form" onSubmit={submit}>
        <label>Trail<TrailSelect value={f.trail_id} onChange={set('trail_id')} required placeholder="Choose a trail…" /></label>
        <label>Title<input value={f.title} onChange={set('title')} placeholder={trail ? trail.name : 'Sunrise hike'} maxLength={100} /></label>
        <label>Start time<input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} required /></label>
        <label>Details<textarea rows={3} value={f.description} onChange={set('description')} placeholder="Where to meet, what to bring, carpool plans…" maxLength={1000} /></label>
        <fieldset>
          <legend>Pace</legend>
          <div className="segmented">
            {[['relaxed', 'leaf', 'Relaxed'], ['moderate', 'walk', 'Moderate'], ['fast', 'bolt', 'Fast']].map(([v, ic, l]) => (
              <button type="button" key={v} className={f.pace === v ? 'active' : ''} onClick={() => set('pace')(v)}><IconText icon={ic}>{l}</IconText></button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Who can see and join?</legend>
          <div className="option-grid two">
            <button type="button" className={`option ${f.visibility === 'public' ? 'active' : ''}`} onClick={() => set('visibility')('public')}>
              <strong className="with-icon"><Icon name="globe" />Public</strong><span className="muted small">Anyone on Trailing can find and join</span>
            </button>
            <button type="button" className={`option ${f.visibility === 'friends' ? 'active' : ''}`} onClick={() => set('visibility')('friends')}>
              <strong className="with-icon"><Icon name="users" />Friends only</strong><span className="muted small">Only your friends can see it</span>
            </button>
          </div>
        </fieldset>
        <label>Group size limit<input type="number" min="2" max="100" value={f.max_people} onChange={set('max_people')} placeholder="No limit" /></label>
        <ErrorText error={error} />
        <button className="btn primary block">Create hike & group chat</button>
      </form>
    </div>
  );
}
