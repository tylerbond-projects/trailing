import { parseTrail, placeholders } from './db.js';
import { publicUser } from './auth.js';
import { emitToUsers } from './realtime.js';

const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Match a GPS start point to the closest trailhead within 1.5 km. */
export async function matchTrail(db, lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null;
  for (const t of await db.all('SELECT id, lat, lng FROM trails')) {
    const d = haversineKm(lat, lng, t.lat, t.lng);
    if (d < 1.5 && (!best || d < best.d)) best = { id: t.id, d };
  }
  return best?.id ?? null;
}

export function createActivity(db, userId, a) {
  return db.insert(`INSERT INTO activities (user_id, source, strava_id, name, type, distance_m, moving_time_s,
    elevation_gain_m, start_date, trail_id, polyline) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  userId, a.source || 'manual', a.strava_id ?? null, a.name, a.type, a.distance_m || 0, a.moving_time_s || 0,
  a.elevation_gain_m || 0, a.start_date, a.trail_id ?? null, a.polyline ?? null);
}

export function formatActivity(a) {
  if (!a) return null;
  return {
    id: a.id, source: a.source, strava_id: a.strava_id, name: a.name, type: a.type,
    distance_mi: Math.round((a.distance_m / M_PER_MI) * 100) / 100,
    elevation_gain_ft: Math.round(a.elevation_gain_m * FT_PER_M),
    moving_time_s: a.moving_time_s, start_date: a.start_date, trail_id: a.trail_id, polyline: a.polyline,
  };
}

/** Turn post rows into fully hydrated feed items (one batched round trip). */
export async function hydratePosts(db, rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const activityIds = rows.map((r) => r.activity_id).filter(Boolean);
  const trailIds = [...new Set(rows.map((r) => r.trail_id).filter(Boolean))];
  const ph = placeholders(ids);
  const none = [0];

  const [photos, likes, comments, users, activities, trails] = (await db.batch([
    db.stmt(`SELECT post_id, url FROM post_photos WHERE post_id IN (${ph}) ORDER BY id`, ...ids),
    db.stmt(`SELECT post_id, COUNT(*) n, MAX(user_id = ?) mine FROM post_likes WHERE post_id IN (${ph}) GROUP BY post_id`, viewerId, ...ids),
    db.stmt(`SELECT post_id, COUNT(*) n FROM post_comments WHERE post_id IN (${ph}) GROUP BY post_id`, ...ids),
    db.stmt(`SELECT * FROM users WHERE id IN (${placeholders(userIds)})`, ...userIds),
    db.stmt(`SELECT * FROM activities WHERE id IN (${placeholders(activityIds.length ? activityIds : none)})`, ...(activityIds.length ? activityIds : none)),
    db.stmt(`SELECT id, slug, name, area, difficulty_score, difficulty_label, distance_mi, elevation_gain_ft, features FROM trails
      WHERE id IN (${placeholders(trailIds.length ? trailIds : none)})`, ...(trailIds.length ? trailIds : none)),
  ])).map((r) => r.results);

  const byId = (list) => new Map(list.map((x) => [x.id, x]));
  const likeMap = new Map(likes.map((l) => [l.post_id, l]));
  const commentMap = new Map(comments.map((x) => [x.post_id, x.n]));
  const userMap = byId(users), actMap = byId(activities), trailMap = byId(trails);

  return rows.map((p) => ({
    id: p.id,
    body: p.body,
    created_at: p.created_at,
    user: publicUser(userMap.get(p.user_id)),
    activity: formatActivity(actMap.get(p.activity_id)),
    trail: p.trail_id ? parseTrail(trailMap.get(p.trail_id)) : null,
    photos: photos.filter((x) => x.post_id === p.id).map((x) => x.url),
    like_count: likeMap.get(p.id)?.n || 0,
    liked: !!likeMap.get(p.id)?.mine,
    comment_count: commentMap.get(p.id) || 0,
  }));
}

// --- Chat helpers --------------------------------------------------------------

export async function conversationMemberIds(db, conversationId) {
  return (await db.all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', conversationId)).map((r) => r.user_id);
}

export async function sendMessage(c, conversationId, user, body) {
  const db = c.get('db');
  const msg = await db.first('INSERT INTO messages (conversation_id, user_id, body) VALUES (?, ?, ?) RETURNING *',
    conversationId, user?.id ?? null, body);
  const full = { ...msg, user: user ? publicUser(user) : null };
  emitToUsers(c, await conversationMemberIds(db, conversationId), 'message', full);
  return full;
}
