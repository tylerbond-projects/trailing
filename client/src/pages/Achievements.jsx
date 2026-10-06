import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';
import { parseDate } from '../lib/format.js';

const fmt = (n) => (n >= 1000 ? Math.round(n).toLocaleString() : Number.isInteger(n) ? n : n.toFixed(1));

export function AchievementBadge({ a, small }) {
  const earned = !!a.earned_at;
  const pct = Math.min(100, (a.current / a.target) * 100);
  if (small) {
    return <span className={`ach-mini tier-${a.tier}`} title={`${a.name} — ${a.description}`}>{a.icon}</span>;
  }
  return (
    <div className={`achievement card tier-${a.tier} ${earned ? 'earned' : 'locked'}`}>
      <div className="ach-icon">{a.icon}</div>
      <div className="grow">
        <strong>{a.name}</strong>
        <div className="muted small">{a.description}</div>
        {earned
          ? <div className="xsmall ach-earned">Earned {parseDate(a.earned_at).toLocaleDateString()}</div>
          : (
            <div className="ach-progress">
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
              <span className="xsmall muted">{fmt(a.current)} / {fmt(a.target)}</span>
            </div>
          )}
      </div>
    </div>
  );
}

export default function Achievements() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/achievements').then((d) => setList(d.achievements)); }, []);
  if (!list) return <Spinner />;

  const earned = list.filter((a) => a.earned_at).length;
  const categories = [...new Set(list.map((a) => a.category))];

  return (
    <div className="page">
      <div className="page-head"><h1>Achievements</h1></div>
      <div className="card pad ach-summary">
        <div className="ach-ring" style={{ '--pct': `${(earned / list.length) * 100}%` }}><span>{earned}<small>/{list.length}</small></span></div>
        <div>
          <strong>{earned === 0 ? 'Your trophy case is empty — for now.' : `${earned} unlocked`}</strong>
          <p className="muted small">Log hikes and runs, explore new trails, review, share photos and hike with others to earn badges.</p>
        </div>
      </div>
      {categories.map((c) => {
        const items = list.filter((a) => a.category === c).sort((a, b) => !!b.earned_at - !!a.earned_at || b.current / b.target - a.current / a.target);
        return (
          <section key={c}>
            <h2 className="section-title">{c} <span className="muted small">{items.filter((a) => a.earned_at).length}/{items.length}</span></h2>
            <div className="achievement-grid">{items.map((a) => <AchievementBadge key={a.id} a={a} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
