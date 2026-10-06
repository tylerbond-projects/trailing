import { Hono } from 'hono';
import { requireAuth, publicUser, areFriends, friendIds } from '../auth.js';
import { achievementsFor, userStats, checkAchievements } from '../achievements.js';
import { hydratePosts, formatActivity } from '../services.js';
import { emitToUsers } from '../realtime.js';
import { placeholders } from '../db.js';

const r = new Hono();
r.use('*', requireAuth);

const findUser = (c) => c.get('db').first('SELECT * FROM users WHERE username = ?', c.req.param('username'));
const notFound = (c) => c.json({ error: 'User not found' }, 404);

r.get('/', async (c) => {
  const me = c.get('user');
  const q = `%${(c.req.query('q') || '').trim()}%`;
  const rows = await c.get('db').all(`SELECT u.*, EXISTS(SELECT 1 FROM follows WHERE follower_id = ?1 AND followee_id = u.id) AS following
    FROM users u WHERE u.id != ?1 AND (u.username LIKE ?2 OR u.display_name LIKE ?2) ORDER BY u.display_name LIMIT 30`, me.id, q);
  return c.json({ users: rows.map((u) => ({ ...publicUser(u), following: !!u.following })) });
});

r.get('/friends', async (c) => {
  const db = c.get('db');
  const ids = await friendIds(db, c.get('user').id);
  const users = ids.length ? await db.all(`SELECT * FROM users WHERE id IN (${placeholders(ids)}) ORDER BY display_name`, ...ids) : [];
  return c.json({ users: users.map(publicUser) });
});

r.get('/:username', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const u = await findUser(c);
  if (!u) return notFound(c);
  const [stats, counts, following, followsYou, isFriend] = await Promise.all([
    userStats(db, u.id),
    db.first(`SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
      (SELECT COUNT(*) FROM user_achievements WHERE user_id = ?1) AS achievements`, u.id),
    db.first('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', me.id, u.id),
    db.first('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', u.id, me.id),
    areFriends(db, me.id, u.id),
  ]);
  return c.json({
    user: publicUser(u),
    stats: {
      activities: stats.activities,
      total_miles: Math.round(stats.totalMiles * 10) / 10,
      total_elevation_ft: Math.round(stats.totalElevationFt),
      unique_trails: stats.uniqueTrails,
      ...counts,
    },
    is_me: u.id === me.id,
    following: !!following,
    follows_you: !!followsYou,
    is_friend: isFriend,
  });
});

r.get('/:username/posts', async (c) => {
  const db = c.get('db');
  const u = await findUser(c);
  if (!u) return notFound(c);
  const rows = await db.all('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', u.id);
  return c.json({ posts: await hydratePosts(db, rows, c.get('user').id) });
});

r.get('/:username/activities', async (c) => {
  const u = await findUser(c);
  if (!u) return notFound(c);
  const rows = await c.get('db').all(`SELECT a.*, t.name AS trail_name, t.slug AS trail_slug FROM activities a
    LEFT JOIN trails t ON t.id = a.trail_id WHERE a.user_id = ? ORDER BY a.start_date DESC LIMIT 100`, u.id);
  return c.json({ activities: rows.map((a) => ({ ...formatActivity(a), trail_name: a.trail_name, trail_slug: a.trail_slug })) });
});

r.get('/:username/achievements', async (c) => {
  const u = await findUser(c);
  if (!u) return notFound(c);
  return c.json({ achievements: await achievementsFor(c.get('db'), u.id) });
});

const listFollows = (sql) => async (c) => {
  const u = await findUser(c);
  if (!u) return notFound(c);
  return c.json({ users: (await c.get('db').all(sql, u.id)).map(publicUser) });
};
r.get('/:username/followers', listFollows('SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?'));
r.get('/:username/following', listFollows('SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?'));

r.post('/:id/follow', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const id = Number(c.req.param('id'));
  if (id === me.id) return c.json({ error: "You can't follow yourself" }, 400);
  if (!(await db.first('SELECT 1 FROM users WHERE id = ?', id))) return notFound(c);
  const res = await db.run('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)', me.id, id);
  if (res.meta.changes) emitToUsers(c, [id], 'notification', { type: 'follow', user: publicUser(me) });
  await Promise.all([checkAchievements(c, me.id), checkAchievements(c, id)]);
  return c.json({ following: true, is_friend: await areFriends(db, me.id, id) });
});

r.delete('/:id/follow', async (c) => {
  await c.get('db').run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', c.get('user').id, Number(c.req.param('id')));
  return c.json({ following: false, is_friend: false });
});

export default r;
