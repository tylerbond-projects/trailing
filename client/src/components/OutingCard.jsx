import { Link } from 'react-router-dom';
import { Avatar, Difficulty } from './ui.jsx';
import { parseDate, miles } from '../lib/format.js';
import Icon from './Icon.jsx';

export default function OutingCard({ outing: o, hideTrail }) {
  const d = parseDate(o.starts_at);
  const full = o.max_people && o.member_count >= o.max_people;
  return (
    <Link to={`/hikes/${o.id}`} className="card outing-card">
      <div className="date-block">
        <span className="month">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
        <span className="day">{d.getDate()}</span>
        <span className="time">{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <div className="grow">
        <h3>{o.title}</h3>
        {!hideTrail && (
          <div className="muted small"><Icon name="pin" size={13} className="inline" /> {o.trail.name} · {miles(o.trail.distance_mi)} <Difficulty score={o.trail.difficulty_score} label={o.trail.difficulty_label} compact /></div>
        )}
        <div className="outing-meta">
          <Avatar user={o.host} size={22} /> <span className="small">{o.host.display_name}</span>
          <span className="small muted">· {o.member_count}{o.max_people ? `/${o.max_people}` : ''} going</span>
          {o.visibility === 'friends' && <span className="pill small">Friends only</span>}
          {o.pace && <span className="pill small cap">{o.pace} pace</span>}
          {o.is_member && <span className="pill pill-done small">You're going</span>}
          {full && !o.is_member && <span className="pill small">Full</span>}
        </div>
      </div>
    </Link>
  );
}
