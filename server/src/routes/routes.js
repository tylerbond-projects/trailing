import { Hono } from 'hono';
import { requireAuth, publicUser, readJson } from '../auth.js';
import { planRoute, simplify, MAX_WAYPOINTS } from '../routing.js';
import { checkAchievements } from '../achievements.js';

const r = new Hono();
r.use('*', requireAuth);

function shape(row, { full = false } = {}) {
  const path = JSON.parse(row.path);
  const out = {
    id: row.id, name: row.name, description: row.description, activity: row.activity,
    distance_m: row.distance_m, elevation_gain_m: row.elevation_gain_m, is_public: !!row.is_public,
    out_and_back: !!row.out_and_back, snapped: !!row.snapped, start: [row.start_lat, row.start_lng],
    created_at: row.created_at, times_logged: row.times_logged ?? 0,
    user: row.u_username ? publicUser({ id: row.user_id, username: row.u_username, display_name: row.u_display_name, avatar_url: row.u_avatar_url }) : undefined,
    preview: simplify(path, 60),
  };
  if (full) {
    out.path = path;
    out.waypoints = JSON.parse(row.waypoints);
    out.profile = row.elevation_profile ? JSON.parse(row.elevation_profile) : [];
  }
  return out;
}

const SELECT = `SELECT r.*, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url,
  (SELECT COUNT(*) FROM activities a WHERE a.route_id = r.id) AS times_logged
  FROM routes r JOIN users u ON u.id = r.user_id`;

// Preview a route while drawing (not saved).
r.post('/plan', async (c) => {
  const b = await readJson(c);
  if ((b.waypoints || []).length > MAX_WAYPOINTS) return c.json({ error: `Up to ${MAX_WAYPOINTS} points per route` }, 400);
  return c.json(await planRoute(b.waypoints, { snap: b.snap !== false, outAndBack: !!b.out_and_back }));
});

r.get('/', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const scope = c.req.query('scope') || 'mine';
  const [lat, lng] = (c.req.query('near') || '').split(',').map(Number);
  const near = Number.isFinite(lat) && Number.isFinite(lng);
  const params = [];
  const p = (v) => { params.push(v); return `?${params.length}`; };
  const where = scope === 'mine' ? `r.user_id = ${p(uid)}`
    : scope === 'user' ? `r.user_id = ${p(Number(c.req.query('userId')) || 0)} AND r.is_public = 1`
    : 'r.is_public = 1';
  // lng distance scaled by cos(latitude) ≈ 0.76 in Utah (squared ≈ 0.58)
  const order = near ? `((r.start_lat - ${p(lat)}) * (r.start_lat - ?${params.length}) + (r.start_lng - ${p(lng)}) * (r.start_lng - ?${params.length}) * 0.58)` : 'r.created_at DESC';
  const rows = await db.all(`${SELECT} WHERE ${where} ORDER BY ${order} LIMIT 60`, ...params);
  return c.json({ routes: rows.map((row) => shape(row)) });
});

r.get('/:id', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const row = await db.first(`${SELECT} WHERE r.id = ?`, Number(c.req.param('id')));
  if (!row || (!row.is_public && row.user_id !== uid)) return c.json({ error: 'Route not found' }, 404);
  const mine = await db.all(`SELECT id, moving_time_s, start_date FROM activities WHERE route_id = ? AND user_id = ? AND moving_time_s > 0
    ORDER BY moving_time_s ASC LIMIT 1`, row.id, uid);
  return c.json({ route: { ...shape(row, { full: true }), is_mine: row.user_id === uid, my_best: mine[0] || null } });
});

r.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const b = await readJson(c);
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) return c.json({ error: 'Give your route a name' }, 400);
  const plan = await planRoute(b.waypoints, { snap: b.snap !== false, outAndBack: !!b.out_and_back });
  if (plan.path.length < 2 || plan.distance_m < 50) return c.json({ error: 'Add at least two points on the map' }, 400);
  const row = await db.first(`INSERT INTO routes (user_id, name, description, activity, waypoints, path, snapped, out_and_back,
    distance_m, elevation_gain_m, elevation_profile, start_lat, start_lng, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  me.id, name, String(b.description || '').slice(0, 1000), b.activity === 'hike' ? 'hike' : 'run',
  JSON.stringify(plan.waypoints), JSON.stringify(plan.path), plan.snapped, !!b.out_and_back,
  plan.distance_m, plan.elevation_gain_m, JSON.stringify(plan.profile), plan.path[0][0], plan.path[0][1], b.is_public !== false);
  await checkAchievements(c, me.id);
  return c.json({ id: row.id }, 201);
});

r.patch('/:id', async (c) => {
  const db = c.get('db');
  const b = await readJson(c);
  const row = await db.first('SELECT * FROM routes WHERE id = ? AND user_id = ?', Number(c.req.param('id')), c.get('user').id);
  if (!row) return c.json({ error: 'Route not found' }, 404);
  await db.run('UPDATE routes SET name = ?, description = ?, is_public = ? WHERE id = ?',
    String(b.name ?? row.name).trim().slice(0, 80) || row.name, String(b.description ?? row.description).slice(0, 1000),
    b.is_public == null ? row.is_public : !!b.is_public, row.id);
  return c.json({ ok: true });
});

r.delete('/:id', async (c) => {
  const res = await c.get('db').run('DELETE FROM routes WHERE id = ? AND user_id = ?', Number(c.req.param('id')), c.get('user').id);
  return res.meta.changes ? c.json({ ok: true }) : c.json({ error: 'Route not found' }, 404);
});

export default r;
