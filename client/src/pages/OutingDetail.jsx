import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, Difficulty, Spinner, ErrorText } from '../components/ui.jsx';
import TrailArt from '../components/TrailArt.jsx';
import { eventDate, miles, feet } from '../lib/format.js';
import Icon, { IconText } from '../components/Icon.jsx';

export default function OutingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const load = () => api(`/outings/${id}`).then((d) => setO(d.outing)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(method, path = 'join') {
    setError('');
    try {
      if (method === 'POST') {
        await api(`/outings/${id}/join`, { method });
        const { outing } = await api(`/outings/${id}`);
        navigate(`/chat/${outing.conversation_id}`);
        return;
      }
      await api(`/outings/${id}${path ? '/' + path : ''}`, { method });
      if (!path) return navigate('/hikes');
      load();
    } catch (e) { setError(e.message); }
  }

  if (!o) return error ? <div className="page"><ErrorText error={error} /></div> : <Spinner />;
  const isHost = o.host.id === user.id;
  const full = o.max_people && o.member_count >= o.max_people;

  return (
    <div className="page narrow">
      <div className="card outing-hero">
        <TrailArt trail={{ slug: o.trail.slug, features: [] }} />
        <div className="pad">
          <div className="muted small">{eventDate(o.starts_at)}</div>
          <h1>{o.title}</h1>
          {o.cancelled && <div className="callout warn">This hike was cancelled.</div>}
          <Link to={`/trails/${o.trail.slug}`} className="post-trail">
            <span className="with-icon"><Icon name="pin" size={16} />{o.trail.name} · {miles(o.trail.distance_mi)} · {feet(o.trail.elevation_gain_ft)} gain</span>
            <Difficulty score={o.trail.difficulty_score} label={o.trail.difficulty_label} compact />
          </Link>
          <div className="chips small">
            <span className="chip static">{o.visibility === 'public' ? <IconText icon="globe" size={14}>Public</IconText> : <IconText icon="users" size={14}>Friends only</IconText>}</span>
            {o.pace && <span className="chip static cap">{o.pace} pace</span>}
            <span className="chip static"><IconText icon="users" size={14}>{o.member_count}{o.max_people ? ` / ${o.max_people}` : ''} going</IconText></span>
          </div>
          {o.description && <p className="pre">{o.description}</p>}

          <ErrorText error={error} />
          {!o.cancelled && (
            <div className="row wrap">
              {o.is_member ? (
                <>
                  <Link className="btn primary" to={`/chat/${o.conversation_id}`}><Icon name="chat" size={17} /> Open group chat</Link>
                  {isHost ? <button className="btn danger" onClick={() => confirm('Cancel this hike for everyone?') && act('DELETE', '')}>Cancel hike</button>
                    : <button className="btn" onClick={() => act('DELETE')}>Leave</button>}
                </>
              ) : (
                <button className="btn primary" disabled={full} onClick={() => act('POST')}>{full ? 'Group is full' : <><Icon name="user-plus" size={17} /> Join this hike</>}</button>
              )}
              <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${o.trail.lat},${o.trail.lng}`} target="_blank" rel="noreferrer"><Icon name="compass" size={17} /> Directions</a>
            </div>
          )}
          {!o.is_member && !o.cancelled && <p className="muted small">Joining adds you to a group chat with everyone going.</p>}
        </div>
      </div>

      <h2 className="section-title">Who's going</h2>
      <div className="card">
        {o.members.map((m) => (
          <Link key={m.id} to={`/u/${m.username}`} className="list-row plain">
            <Avatar user={m} size={36} />
            <span className="grow"><strong>{m.display_name}</strong> <span className="muted small">@{m.username}</span></span>
            {m.id === o.host.id && <span className="pill small">Host</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
