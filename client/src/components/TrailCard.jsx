import { Link } from 'react-router-dom';
import TrailArt from './TrailArt.jsx';
import { Difficulty, Stars } from './ui.jsx';
import { miles, feet, durationMin } from '../lib/format.js';
import Icon, { Feature } from './Icon.jsx';
import { useCover, Attribution } from '../lib/cover.jsx';

export default function TrailCard({ trail, reasons, children, compact }) {
  const [cover, coverRef] = useCover(trail.slug, { lazy: true, width: compact ? 300 : 700 });
  return (
    <Link to={`/trails/${trail.slug}`} className={`trail-card card ${compact ? 'compact' : ''}`}>
      <div className="trail-card-art" ref={coverRef}>
        {cover?.url ? <img src={cover.url} alt="" loading="lazy" className="cover-img" /> : <TrailArt trail={trail} />}
        {!compact && <Attribution cover={cover} />}
        <div className="trail-card-badges">
          <Difficulty score={trail.difficulty_score} label={trail.difficulty_label} />
          {trail.done && <span className="pill pill-done with-icon"><Icon name="check" size={12} strokeWidth={2.5} />Done</span>}
          {trail.saved && <span className="pill with-icon"><Icon name="star-fill" size={12} />Saved</span>}
        </div>
      </div>
      <div className="trail-card-body">
        <h3>{trail.name}</h3>
        <div className="muted small">{trail.area}</div>
        <div className="trail-stats">
          <span>{miles(trail.distance_mi)}</span>
          <span className="with-icon"><Icon name="elevation" size={14} />{feet(trail.elevation_gain_ft)}</span>
          {trail.est_minutes && <span className="with-icon"><Icon name="clock" size={14} />{durationMin(trail.est_minutes)}</span>}
          {trail.miles_away != null && <span className="with-icon muted"><Icon name="pin" size={14} />{trail.miles_away} mi away</span>}
        </div>
        {trail.review_count > 0 && (
          <div className="trail-rating"><Stars value={trail.avg_rating} size={14} /> <span className="muted small">{trail.avg_rating.toFixed(1)} ({trail.review_count})</span></div>
        )}
        {reasons?.length > 0 && (
          <ul className="reasons">{reasons.map((r) => <li key={r}><Icon name="check" size={13} strokeWidth={2.25} />{r}</li>)}</ul>
        )}
        {!reasons && !compact && trail.features?.length > 0 && (
          <div className="chips small">{trail.features.slice(0, 3).map((f) => <span key={f} className="chip static"><Feature f={f} /></span>)}</div>
        )}
        {children}
      </div>
    </Link>
  );
}
