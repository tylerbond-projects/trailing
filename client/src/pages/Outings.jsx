import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import OutingCard from '../components/OutingCard.jsx';
import { Spinner, Tabs, Empty } from '../components/ui.jsx';

export default function Outings() {
  const [tab, setTab] = useState('upcoming');
  const [outings, setOutings] = useState(null);
  useEffect(() => { setOutings(null); api(`/outings?scope=${tab}`).then((d) => setOutings(d.outings)); }, [tab]);

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Group hikes</h1>
        <Link to="/hikes/new" className="btn primary">+ Plan a hike</Link>
      </div>
      <p className="muted">Plan a time to hit the trail. Public hikes are visible to everyone; anyone who joins is added to the group chat.</p>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'mine', label: "I'm going" }]} />
      {!outings ? <Spinner /> : outings.length === 0 ? (
        <Empty icon="👥" title={tab === 'mine' ? "You haven't joined any hikes yet" : 'No upcoming group hikes'}>
          <Link to="/hikes/new">Plan one</Link> and invite the community.
        </Empty>
      ) : <div className="list">{outings.map((o) => <OutingCard key={o.id} outing={o} />)}</div>}
    </div>
  );
}
