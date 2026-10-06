import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import TrailCard from '../components/TrailCard.jsx';
import OutingCard from '../components/OutingCard.jsx';
import { Spinner, Tabs } from '../components/ui.jsx';
import { featureLabel } from '../lib/format.js';

export default function ForYou() {
  const [recs, setRecs] = useState(null);
  const [saved, setSaved] = useState([]);
  const [outings, setOutings] = useState([]);
  const [tab, setTab] = useState('recommended');

  useEffect(() => {
    api('/trails/recommended').then(setRecs);
    api('/trails/saved').then((d) => setSaved(d.trails));
    api('/outings').then((d) => setOutings(d.outings.filter((o) => !o.is_member).slice(0, 3)));
  }, []);

  if (!recs) return <Spinner />;
  const { profile, trails } = recs;
  const [top, ...rest] = trails;

  return (
    <div className="page">
      <div className="page-head"><h1>For you</h1></div>
      <div className="card pad taste">
        <div>
          <span className="label">Your sweet spot</span>
          <strong>Difficulty ~{profile.targetDifficulty}/10</strong>
        </div>
        {profile.topFeatures.length > 0 && (
          <div>
            <span className="label">You love</span>
            <div className="chips small">{profile.topFeatures.map((f) => <span key={f} className="chip static">{featureLabel(f)}</span>)}</div>
          </div>
        )}
        <div><span className="label">Season</span><strong className="cap">{profile.season}</strong></div>
        <Link to="/settings" className="small">Adjust preferences</Link>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'recommended', label: 'Recommended' }, { value: 'saved', label: 'Saved', count: saved.length }]} />

      {tab === 'recommended' ? (
        <>
          {top && (
            <div className="featured">
              <span className="label">Top pick for you</span>
              <TrailCard trail={top} reasons={top.reasons} />
            </div>
          )}
          {outings.length > 0 && (
            <section>
              <div className="section-head"><h2>Group hikes you could join</h2><Link to="/hikes" className="small">See all</Link></div>
              <div className="list">{outings.map((o) => <OutingCard key={o.id} outing={o} />)}</div>
            </section>
          )}
          <h2 className="section-title">More trails you might like</h2>
          <div className="grid">{rest.map((t) => <TrailCard key={t.id} trail={t} reasons={t.reasons} />)}</div>
          <p className="muted small center">Recommendations get better as you log hikes, save trails and leave ratings.</p>
        </>
      ) : (
        saved.length === 0
          ? <p className="muted">Tap ☆ Save on any trail to build your wishlist.</p>
          : <div className="grid">{saved.map((t) => <TrailCard key={t.id} trail={t} />)}</div>
      )}
    </div>
  );
}
