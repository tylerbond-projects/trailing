import { Hono } from 'hono';
import { requireAuth, publicUser, friendIds, readJson, httpError } from '../auth.js';
import { checkAchievements } from '../achievements.js';
import { sendMessage } from '../services.js';

const r = new Hono();
r.use('*', requireAuth);

// ?1 = viewer id
const BASE = `
  SELECT o.*, t.slug AS trail_slug, t.name AS trail_name, t.area AS trail_area, t.difficulty_label, t.difficulty_score,
    t.distance_mi, t.elevation_gain_ft, t.lat, t.lng,
    (SELECT COUNT(*) FROM outing_members m WHERE m.outing_id = o.id) AS member_count,
    EXISTS(SELECT 1 FROM outing_members m WHERE m.outing_id = o.id AND m.user_id = ?1) AS is_member,
    h.username AS h_username, h.display_name AS h_display_name, h.avatar_url AS h_avatar_url, h.bio AS h_bio,
    h.activity_type AS h_activity_type, h.created_at AS h_created_at
  FROM outings o JOIN trails t ON t.id = o.trail_id JOIN users h ON h.id = o.host_id`;

function shape(o) {
  return {
    id: o.id, title: o.title, description: o.description, starts_at: o.starts_at, visibility: o.visibility,
    max_people: o.max_people, pace: o.pace, cancelled: !!o.cancelled, conversation_id: o.is_member ? o.conversation_id : null,
    member_count: o.member_count, is_member: !!o.is_member,
    host: publicUser({ id: o.host_id, username: o.h_username, display_name: o.h_display_name, avatar_url: o.h_avatar_url,
      bio: o.h_bio, activity_type: o.h_activity_type, created_at: o.h_created_at }),
    trail: { id: o.trail_id, slug: o.trail_slug, name: o.trail_name, area: o.trail_area, difficulty_label: o.difficulty_label,
      difficulty_score: o.difficulty_score, distance_mi: o.distance_mi, elevation_gain_ft: o.elevation_gain_ft, lat: o.lat, lng: o.lng },
  };
}

/** Outings the user is allowed to see: public ones, ones by friends, and ones they're in. */
export async function visibleOutings(db, uid, { trailId, scope = 'upcoming' } = {}) {
  const friends = await friendIds(db, uid);
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // keep in-progress hikes visible
  const params = [uid, since];
  const where = ['o.cancelled = 0', 'o.starts_at > ?2'];
  if (trailId) { params.push(trailId); where.push(`o.trail_id = ?${params.length}`); }
  if (scope === 'mine') where.push('(o.host_id = ?1 OR is_member)');
  else {
    where.push(`(o.visibility = 'public' OR o.host_id = ?1 OR is_member
      ${friends.length ? `OR o.host_id IN (${friends.map(Number).join(',')})` : ''})`);
  }
  return (await db.all(`${BASE} WHERE ${where.join(' AND ')} ORDER BY o.starts_at ASC LIMIT 100`, ...params)).map(shape);
}

async function loadOuting(db, id, uid) {
  const o = await db.first(`${BASE} WHERE o.id = ?2`, uid, id);
  if (!o) throw httpError(404, 'Outing not found');
  const visible = o.visibility === 'public' || o.host_id === uid || o.is_member || (await friendIds(db, o.host_id)).includes(uid);
  if (!visible) throw httpError(404, 'Outing not found');
  return o;
}

r.get('/', async (c) => {
  const trailId = c.req.query('trailId');
  return c.json({ outings: await visibleOutings(c.get('db'), c.get('user').id, { scope: c.req.query('scope'), trailId: trailId ? Number(trailId) : undefined }) });
});

r.get('/:id', async (c) => {
  const db = c.get('db');
  const o = await loadOuting(db, Number(c.req.param('id')), c.get('user').id);
  const members = await db.all(`SELECT u.* FROM outing_members m JOIN users u ON u.id = m.user_id
    WHERE m.outing_id = ? ORDER BY m.joined_at`, o.id);
  return c.json({ outing: { ...shape(o), members: members.map(publicUser) } });
});

r.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const { trail_id, title, description = '', starts_at, visibility = 'public', max_people, pace } = await readJson(c);
  const trail = await db.first('SELECT * FROM trails WHERE id = ?', Number(trail_id));
  if (!trail) return c.json({ error: 'Pick a trail' }, 400);
  const when = new Date(starts_at);
  if (isNaN(when) || when < new Date()) return c.json({ error: 'Pick a start time in the future' }, 400);

  const conv = await db.insert("INSERT INTO conversations (type) VALUES ('outing')");
  const oid = await db.insert(`INSERT INTO outings (trail_id, host_id, conversation_id, title, description, starts_at, visibility, max_people, pace)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, trail.id, me.id, conv, (title || trail.name).slice(0, 100), String(description).slice(0, 1000),
  when.toISOString(), visibility === 'friends' ? 'friends' : 'public', max_people ? Number(max_people) : null,
  ['relaxed', 'moderate', 'fast'].includes(pace) ? pace : null);
  await db.batch([
    db.stmt('INSERT INTO outing_members (outing_id, user_id) VALUES (?, ?)', oid, me.id),
    db.stmt('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv, me.id),
  ]);
  await sendMessage(c, conv, null, `${me.display_name} planned a hike on ${trail.name}. Anyone who joins will show up here.`);
  await checkAchievements(c, me.id);
  return c.json({ outing: shape(await loadOuting(db, oid, me.id)) }, 201);
});

r.post('/:id/join', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const o = await loadOuting(db, Number(c.req.param('id')), me.id);
  if (o.cancelled) return c.json({ error: 'This hike was cancelled' }, 400);
  if (o.is_member) return c.json({ outing: shape(o) });
  if (o.max_people && o.member_count >= o.max_people) return c.json({ error: 'This group is full' }, 400);
  await db.batch([
    db.stmt('INSERT INTO outing_members (outing_id, user_id) VALUES (?, ?)', o.id, me.id),
    db.stmt('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', o.conversation_id, me.id),
  ]);
  await sendMessage(c, o.conversation_id, null, `${me.display_name} joined the hike`);
  await checkAchievements(c, me.id);
  return c.json({ outing: shape(await loadOuting(db, o.id, me.id)) });
});

r.delete('/:id/join', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const o = await loadOuting(db, Number(c.req.param('id')), me.id);
  if (o.host_id === me.id) return c.json({ error: 'Hosts cancel the hike instead of leaving' }, 400);
  await db.batch([
    db.stmt('DELETE FROM outing_members WHERE outing_id = ? AND user_id = ?', o.id, me.id),
    db.stmt('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', o.conversation_id, me.id),
  ]);
  await sendMessage(c, o.conversation_id, null, `${me.display_name} left the hike`);
  return c.json({ ok: true });
});

r.delete('/:id', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const o = await loadOuting(db, Number(c.req.param('id')), me.id);
  if (o.host_id !== me.id) return c.json({ error: 'Only the host can cancel' }, 403);
  await db.run('UPDATE outings SET cancelled = 1 WHERE id = ?', o.id);
  await sendMessage(c, o.conversation_id, null, `${me.display_name} cancelled this hike.`);
  return c.json({ ok: true });
});

export default r;
