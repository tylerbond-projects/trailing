import { Hono } from 'hono';
import { requireAuth, publicUser, readJson } from '../auth.js';
import { filesFrom, storePhoto, field } from '../uploads.js';
import { checkAchievements } from '../achievements.js';
import { hydratePosts, createActivity } from '../services.js';
import { emitToUsers } from '../realtime.js';

const r = new Hono();
r.use('*', requireAuth);

const M_PER_MI = 1609.344;
const M_PER_FT = 0.3048;

// Feed: your posts + people you follow, newest first. `before` = cursor (created_at of the last post seen).
r.get('/feed', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const rows = await db.all(`SELECT p.* FROM posts p WHERE p.created_at < ?1 AND (p.user_id = ?2 OR p.user_id IN
    (SELECT followee_id FROM follows WHERE follower_id = ?2)) ORDER BY p.created_at DESC, p.id DESC LIMIT 20`, c.req.query('before') || '9999', uid);
  return c.json({ posts: await hydratePosts(db, rows, uid) });
});

// Discover: recent posts from everyone (used when your feed is empty).
r.get('/discover', async (c) => {
  const db = c.get('db');
  const rows = await db.all('SELECT * FROM posts WHERE user_id != ? ORDER BY created_at DESC, id DESC LIMIT 20', c.get('user').id);
  return c.json({ posts: await hydratePosts(db, rows, c.get('user').id) });
});

/**
 * Create a post. Multipart form fields:
 *   body, trail_id, activity_id (existing, e.g. imported from Strava)
 *   OR manual activity: name, type, distance_mi, elevation_gain_ft, duration_min, start_date
 *   photos (images, repeated)
 */
r.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const b = await c.req.parseBody({ all: true });
  const f = (k) => field(b, k);
  const files = filesFrom(b, 'photos');
  let activityId = f('activity_id') ? Number(f('activity_id')) : null;
  let trailId = f('trail_id') ? Number(f('trail_id')) : null;
  let routeId = f('route_id') ? Number(f('route_id')) : null;
  if (routeId && !(await db.first('SELECT 1 FROM routes WHERE id = ? AND (is_public = 1 OR user_id = ?)', routeId, me.id))) routeId = null;
  const text = String(f('body') || '').slice(0, 2000);

  if (activityId) {
    const a = await db.first('SELECT * FROM activities WHERE id = ? AND user_id = ?', activityId, me.id);
    if (!a) return c.json({ error: 'Activity not found' }, 400);
    trailId = trailId || a.trail_id;
    if (trailId && !a.trail_id) await db.run('UPDATE activities SET trail_id = ? WHERE id = ?', trailId, a.id);
  } else if (f('type')) {
    const distance = Number(f('distance_mi')) || 0;
    if (distance <= 0) return c.json({ error: 'Enter a distance' }, 400);
    const trailName = trailId ? (await db.first('SELECT name FROM trails WHERE id = ?', trailId))?.name : null;
    activityId = await createActivity(db, me.id, {
      name: f('name') || trailName || f('type'),
      type: ['Hike', 'Run', 'TrailRun', 'Walk'].includes(f('type')) ? f('type') : 'Hike',
      distance_m: distance * M_PER_MI,
      elevation_gain_m: (Number(f('elevation_gain_ft')) || 0) * M_PER_FT,
      moving_time_s: Math.round((Number(f('duration_min')) || 0) * 60),
      start_date: f('start_date') || new Date().toISOString().slice(0, 19),
      trail_id: trailId,
      route_id: routeId,
    });
  }
  if (!activityId && !text.trim() && !files.length) return c.json({ error: 'Post is empty' }, 400);

  const urls = await Promise.all(files.map((file) => storePhoto(c.env, file)));
  const postId = await db.insert('INSERT INTO posts (user_id, activity_id, trail_id, body) VALUES (?, ?, ?, ?)', me.id, activityId, trailId, text);
  if (urls.length) await db.batch(urls.map((url) => db.stmt('INSERT INTO post_photos (post_id, url) VALUES (?, ?)', postId, url)));
  await checkAchievements(c, me.id);
  const [post] = await hydratePosts(db, [await db.first('SELECT * FROM posts WHERE id = ?', postId)], me.id);
  return c.json({ post }, 201);
});

r.delete('/:id', async (c) => {
  const db = c.get('db');
  const p = await db.first('SELECT * FROM posts WHERE id = ? AND user_id = ?', Number(c.req.param('id')), c.get('user').id);
  if (!p) return c.json({ error: 'Post not found' }, 404);
  await db.run('DELETE FROM posts WHERE id = ?', p.id);
  return c.json({ ok: true });
});

r.post('/:id/like', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const p = await db.first('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')));
  if (!p) return c.json({ error: 'Post not found' }, 404);
  const res = await db.run('INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', p.id, me.id);
  if (res.meta.changes && p.user_id !== me.id) emitToUsers(c, [p.user_id], 'notification', { type: 'like', post_id: p.id, user: publicUser(me) });
  return c.json({ liked: true });
});
r.delete('/:id/like', async (c) => {
  await c.get('db').run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', Number(c.req.param('id')), c.get('user').id);
  return c.json({ liked: false });
});

r.get('/:id/comments', async (c) => {
  const rows = await c.get('db').all(`SELECT c.*, u.username, u.display_name, u.avatar_url FROM post_comments c
    JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.id`, Number(c.req.param('id')));
  return c.json({ comments: rows.map((x) => ({ id: x.id, body: x.body, created_at: x.created_at,
    user: { id: x.user_id, username: x.username, display_name: x.display_name, avatar_url: x.avatar_url } })) });
});
r.post('/:id/comments', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const p = await db.first('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')));
  const body = String((await readJson(c)).body || '').trim().slice(0, 1000);
  if (!p) return c.json({ error: 'Post not found' }, 404);
  if (!body) return c.json({ error: 'Comment is empty' }, 400);
  const row = await db.first('INSERT INTO post_comments (post_id, user_id, body) VALUES (?, ?, ?) RETURNING id, created_at', p.id, me.id, body);
  if (p.user_id !== me.id) emitToUsers(c, [p.user_id], 'notification', { type: 'comment', post_id: p.id, user: publicUser(me) });
  return c.json({ comment: { id: row.id, body, created_at: row.created_at, user: publicUser(me) } }, 201);
});

export default r;
