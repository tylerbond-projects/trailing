import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { locate } from '../lib/geo.js';
import { Avatar, Spinner, Tabs, Empty } from '../components/ui.jsx';
import Icon, { IconText } from '../components/Icon.jsx';
import RoutePreview from '../components/RoutePreview.jsx';
import { metersToMiles, metersToFeet, miles, feet } from '../lib/format.js';

export function ExploreSwitch({ value }) {
  return (
    <div className="segmented small">
      <Link to="/explore" className={value === 'trails' ? 'active' : ''}><IconText icon="mountain" size={15}>Trails</IconText></Link>
      <Link to="/routes" className={value === 'routes' ? 'active' : ''}><IconText icon="route" size={15}>Routes</IconText></Link>
    </div>
  );
}

export function RouteCard({ route: r, showUser = true }) {
  return (
    <Link to={`/routes/${r.id}`} className="card route-card">
      <RoutePreview points={r.preview} />
      <div className="grow">
        <h3>{r.name}</h3>
        <div className="trail-stats">
          <span>{miles(metersToMiles(r.distance_m))}</span>
          <span className="with-icon"><Icon name="elevation" size={14} />{feet(metersToFeet(r.elevation_gain_m))}</span>
          {r.out_and_back && <span className="with-icon muted"><Icon name="out-back" size={14} />Out & back</span>}
        </div>
        <div className="outing-meta">
          {showUser && r.user && <><Avatar user={r.user} size={20} /><span className="small">{r.user.display_name}</span></>}
          {!r.is_public && <span className="pill small with-icon"><Icon name="lock" size={11} />Private</span>}
          {r.times_logged > 0 && <span className="small muted">{showUser && r.user ? '· ' : ''}Run {r.times_logged}×</span>}
        </div>
      </div>
    </Link>
  );
}

export default function Routes() {
  const [tab, setTab] = useState('mine');
  const [routes, setRoutes] = useState(null);

  useEffect(() => {
    let alive = true;
    setRoutes(null);
    (async () => {
      let q = `/routes?scope=${tab === 'mine' ? 'mine' : 'public'}`;
      if (tab === 'nearby') {
        const here = await locate();
        if (here) q += `&near=${here[0]},${here[1]}`;
      }
      const { routes } = await api(q);
      if (alive) setRoutes(routes);
    })();
    return () => { alive = false; };
  }, [tab]);

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Routes</h1>
        <ExploreSwitch value="routes" />
      </div>
      <Link to="/routes/new" className="card build-cta">
        <span className="toast-icon"><Icon name="route" size={22} /></span>
        <span className="grow"><strong>Build a route</strong><span className="muted small block">Tap the map to draw a run. Snaps to trails and roads, with distance and elevation.</span></span>
        <Icon name="plus" size={22} />
      </Link>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'mine', label: 'My routes' }, { value: 'nearby', label: 'Near me' }, { value: 'recent', label: 'Community' }]} />
      {!routes ? <Spinner /> : routes.length === 0 ? (
        <Empty icon="route" title={tab === 'mine' ? "You haven't made any routes yet" : 'No public routes yet'}>
          <Link to="/routes/new">Draw your first route</Link> — it takes about a minute.
        </Empty>
      ) : <div className="list">{routes.map((r) => <RouteCard key={r.id} route={r} showUser={tab !== 'mine'} />)}</div>}
    </div>
  );
}
