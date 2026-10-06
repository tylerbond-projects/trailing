import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Avatar, Spinner, Tabs, Empty, Modal } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import { AchievementBadge } from './Achievements.jsx';
import { miles, feet, duration, parseLocal, ACTIVITY_ICON } from '../lib/format.js';
import Icon, { IconText } from '../components/Icon.jsx';
import { RouteCard } from './Routes.jsx';

const TYPE_LABEL = { hiker: ['boot', 'Hiker'], runner: ['run', 'Runner'], both: ['mountain', 'Hiker & runner'] };

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState(null);
  const [activities, setActivities] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [list, setList] = useState(null);
  const [routes, setRoutes] = useState(null);

  useEffect(() => {
    setP(null); setPosts(null); setActivities(null); setAchievements(null); setRoutes(null); setTab('posts');
    api(`/users/${username}`).then(setP);
    api(`/users/${username}/posts`).then((d) => setPosts(d.posts));
    api(`/users/${username}/achievements`).then((d) => setAchievements(d.achievements));
  }, [username]);
  useEffect(() => {
    if (tab === 'activities' && !activities) api(`/users/${username}/activities`).then((d) => setActivities(d.activities));
    if (tab === 'routes' && !routes && p) api(p.is_me ? '/routes?scope=mine' : `/routes?scope=user&userId=${p.user.id}`).then((d) => setRoutes(d.routes));
  }, [tab, username, activities, routes, p]);

  async function toggleFollow() {
    const r = await api(`/users/${p.user.id}/follow`, { method: p.following ? 'DELETE' : 'POST' });
    setP({ ...p, following: r.following, is_friend: r.is_friend, stats: { ...p.stats, followers: p.stats.followers + (r.following ? 1 : -1) } });
  }
  async function message() {
    const { conversation } = await api('/conversations/direct', { method: 'POST', body: { user_id: p.user.id } });
    navigate(`/chat/${conversation.id}`);
  }
  async function showList(kind) {
    setList({ kind, users: null });
    const { users } = await api(`/users/${username}/${kind}`);
    setList({ kind, users });
  }

  if (!p) return <Spinner />;
  const { user: u, stats } = p;
  const earned = achievements?.filter((a) => a.earned_at) || [];

  return (
    <div className="page narrow">
      <div className="card profile-head">
        <Avatar user={u} size={88} />
        <div className="grow">
          <h1>{u.display_name}</h1>
          <div className="muted">@{u.username} · <IconText icon={TYPE_LABEL[u.activity_type][0]} size={14}>{TYPE_LABEL[u.activity_type][1]}</IconText></div>
          {u.bio && <p>{u.bio}</p>}
          <div className="follow-counts">
            <button className="link" onClick={() => showList('followers')}><strong>{stats.followers}</strong> followers</button>
            <button className="link" onClick={() => showList('following')}><strong>{stats.following}</strong> following</button>
            {p.follows_you && !p.is_me && <span className="pill small">Follows you</span>}
            {p.is_friend && <span className="pill pill-done small">Friends</span>}
          </div>
          <div className="row wrap">
            {p.is_me ? <Link to="/settings" className="btn">Edit profile</Link> : (
              <>
                <button className={`btn ${p.following ? '' : 'primary'}`} onClick={toggleFollow}>{p.following ? <><Icon name="check" size={16} /> Following</> : p.follows_you ? 'Follow back' : 'Follow'}</button>
                {p.is_friend && <button className="btn" onClick={message}><Icon name="chat" size={17} /> Message</button>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stat-grid card">
        <div><span className="label">Activities</span><strong>{stats.activities}</strong></div>
        <div><span className="label">Miles</span><strong>{stats.total_miles}</strong></div>
        <div><span className="label">Elevation</span><strong>{feet(stats.total_elevation_ft)}</strong></div>
        <div><span className="label">Trails</span><strong>{stats.unique_trails}</strong></div>
      </div>

      {earned.length > 0 && (
        <div className="badge-strip">
          {earned.slice(0, 8).map((a) => <AchievementBadge key={a.id} a={a} small />)}
          {earned.length > 8 && <button className="link small" onClick={() => setTab('achievements')}>+{earned.length - 8} more</button>}
        </div>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'posts', label: 'Posts' }, { value: 'activities', label: 'Activities' }, { value: 'routes', label: 'Routes' },
        { value: 'achievements', label: 'Achievements', count: earned.length },
      ]} />

      {tab === 'posts' && (!posts ? <Spinner /> : posts.length === 0 ? <Empty title="No posts yet" /> :
        posts.map((post) => <PostCard key={post.id} post={post} onDelete={(id) => setPosts(posts.filter((x) => x.id !== id))} />))}

      {tab === 'activities' && (!activities ? <Spinner /> : activities.length === 0 ? <Empty title="No activities yet" /> : (
        <div className="card">
          {activities.map((a) => (
            <div key={a.id} className="list-row plain">
              <span className="list-icon"><Icon name={ACTIVITY_ICON[a.type]} size={24} /></span>
              <span className="grow">
                <strong>{a.name}</strong>
                <span className="muted small block">
                  {parseLocal(a.start_date).toLocaleDateString()} · {miles(a.distance_mi)} · {feet(a.elevation_gain_ft)} gain{a.moving_time_s ? ` · ${duration(a.moving_time_s)}` : ''}
                  {a.trail_slug && <> · <Link to={`/trails/${a.trail_slug}`}>{a.trail_name}</Link></>}
                </span>
              </span>
              {a.source === 'strava' && <span className="strava-tag">Strava</span>}
            </div>
          ))}
        </div>
      ))}

      {tab === 'routes' && (!routes ? <Spinner /> : routes.length === 0 ? <Empty icon="route" title="No routes yet" /> :
        <div className="list">{routes.map((r) => <RouteCard key={r.id} route={r} showUser={false} />)}</div>)}

      {tab === 'achievements' && (!achievements ? <Spinner /> : (
        <div className="achievement-grid">
          {[...achievements].sort((a, b) => !!b.earned_at - !!a.earned_at).map((a) => <AchievementBadge key={a.id} a={a} />)}
        </div>
      ))}

      {list && (
        <Modal title={list.kind === 'followers' ? 'Followers' : 'Following'} onClose={() => setList(null)}>
          {!list.users ? <Spinner /> : list.users.length === 0 ? <p className="muted">Nobody yet.</p> : list.users.map((x) => (
            <Link key={x.id} to={`/u/${x.username}`} className="list-row plain" onClick={() => setList(null)}>
              <Avatar user={x} size={36} /><span className="grow"><strong>{x.display_name}</strong> <span className="muted small">@{x.username}</span></span>
            </Link>
          ))}
        </Modal>
      )}
    </div>
  );
}
