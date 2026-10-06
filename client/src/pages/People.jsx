import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Avatar, Spinner } from '../components/ui.jsx';

export default function People() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => api(`/users?q=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function toggle(u) {
    await api(`/users/${u.id}/follow`, { method: u.following ? 'DELETE' : 'POST' });
    setUsers(users.map((x) => (x.id === u.id ? { ...x, following: !x.following } : x)));
  }

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Find people</h1></div>
      <input type="search" className="search" placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <p className="muted small">Follow each other to become friends — friends can message each other and see friends-only hikes.</p>
      {!users ? <Spinner /> : (
        <div className="card">
          {users.length === 0 && <p className="pad muted">No one found.</p>}
          {users.map((u) => (
            <div key={u.id} className="list-row plain">
              <Link to={`/u/${u.username}`}><Avatar user={u} size={44} /></Link>
              <Link to={`/u/${u.username}`} className="grow">
                <strong>{u.display_name}</strong> <span className="muted small">@{u.username}</span>
                {u.bio && <span className="muted small block ellipsis">{u.bio}</span>}
              </Link>
              <button className={`btn small ${u.following ? '' : 'primary'}`} onClick={() => toggle(u)}>{u.following ? 'Following' : 'Follow'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
