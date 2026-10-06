import { Hono } from 'hono';
import { parseTrail, COVER_COLS } from '../db.js';
import { requireAuth, publicUser, readJson } from '../auth.js';
import { filesFrom, storePhoto, field } from '../uploads.js';
import { checkAchievements } from '../achievements.js';
import { recommendTrails } from '../recommend.js';
import { visibleOutings } from './outings.js';
import { haversineM } from '../routing.js';
import { trailCover } from '../photos.js';

const r = new Hono();
r.use('*', requireAuth);

const SORTS = {
  popular: 'review_count DESC, avg_rating DESC',
  rating: 'avg_rating DESC, review_count DESC',
  easiest: 't.difficulty_score ASC, t.distance_mi ASC',
  hardest: 't.difficulty_score DESC, t.elevation_gain_ft DESC',
  shortest: 't.distance_mi ASC',
  longest: 't.distance_mi DESC',
  name: 't.name ASC',
};

r.get('/regions', async (c) => c.json({
  regions: await c.get('db').all(`SELECT r.*, COUNT(t.id) AS trail_count FROM regions r
    LEFT JOIN trails t ON t.region_id = r.id GROUP BY r.id ORDER BY r.name`),
}));

r.get('/', async (c) => {
  const q = c.req.query();
  const features = c.req.queries('feature') || [];
  const uid = c.get('user').id;
  const where = [];
  const params = [uid];
  const add = (sql, ...p) => { where.push(sql); params.push(...p); };
  if (q.q) add('(t.name LIKE ? OR t.area LIKE ? OR t.description LIKE ?)', `%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
  if (q.region) add('t.region_id = ?', q.region);
  if (q.minDifficulty) add('t.difficulty_score >= ?', Number(q.minDifficulty));
  if (q.maxDifficulty) add('t.difficulty_score <= ?', Number(q.maxDifficulty));
  if (q.maxDistance) add('t.distance_mi <= ?', Number(q.maxDistance));
  for (const f of features) add('EXISTS (SELECT 1 FROM json_each(t.features) WHERE value = ?)', f);
  if (q.activity) add('EXISTS (SELECT 1 FROM json_each(t.activities) WHERE value = ?)', q.activity);
  if (q.dogs === '1') where.push("t.dogs IN ('leash','yes')");
  if (q.kid === '1') where.push('t.kid_friendly = 1');
  const [nlat, nlng] = (q.near || '').split(',').map(Number);
  const near = Number.isFinite(nlat) && Number.isFinite(nlng);
  let order = SORTS[q.sort] || SORTS.popular;
  if (near && q.sort === 'nearest') {
    params.push(nlat, nlng);
    order = `((t.lat - ?${params.length - 1}) * (t.lat - ?${params.length - 1}) + (t.lng - ?${params.length}) * (t.lng - ?${params.length}) * 0.58)`;
  }

  // ?1 is the viewer; the remaining anonymous ? map to params[1..] in order.
  const rows = await c.get('db').all(`
    SELECT t.*, ${COVER_COLS}, COALESCE(AVG(r.rating), 0) AS avg_rating, COUNT(r.id) AS review_count,
      EXISTS(SELECT 1 FROM saved_trails s WHERE s.trail_id = t.id AND s.user_id = ?1) AS saved,
      EXISTS(SELECT 1 FROM activities a WHERE a.trail_id = t.id AND a.user_id = ?1) AS done
    FROM trails t LEFT JOIN trail_reviews r ON r.trail_id = t.id LEFT JOIN trail_covers c ON c.trail_id = t.id
    ${where.length ? 'WHERE ' + numbered(where.join(' AND '), 2) : ''}
    GROUP BY t.id ORDER BY ${order}`, ...params);
  const milesFrom = (t) => (near ? Math.round((haversineM([nlat, nlng], [t.lat, t.lng]) / 1609.344) * 10) / 10 : undefined);
  return c.json({ trails: rows.map((t) => ({ ...parseTrail(t), saved: !!t.saved, done: !!t.done, miles_away: milesFrom(t) })) });
});

// Rewrite anonymous `?` placeholders as ?N starting at `from` (D1 can't mix them with ?1).
function numbered(sql, from) {
  let i = from;
  return sql.replace(/\?(?!\d)/g, () => `?${i++}`);
}

r.get('/recommended', async (c) => c.json(await recommendTrails(c.get('db'), c.get('user'), { limit: Number(c.req.query('limit')) || 20 })));

r.get('/saved', async (c) => {
  const rows = await c.get('db').all(`SELECT t.*, ${COVER_COLS}, COALESCE((SELECT AVG(rating) FROM trail_reviews WHERE trail_id = t.id),0) AS avg_rating,
    (SELECT COUNT(*) FROM trail_reviews WHERE trail_id = t.id) AS review_count
    FROM saved_trails s JOIN trails t ON t.id = s.trail_id LEFT JOIN trail_covers c ON c.trail_id = t.id WHERE s.user_id = ? ORDER BY s.created_at DESC`, c.get('user').id);
  return c.json({ trails: rows.map((t) => ({ ...parseTrail(t), saved: true })) });
});

r.get('/:slug', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const t = await db.first(`SELECT t.*, ${COVER_COLS} FROM trails t LEFT JOIN trail_covers c ON c.trail_id = t.id WHERE t.slug = ?`, c.req.param('slug'));
  if (!t) return c.json({ error: 'Trail not found' }, 404);

  const [reviews, photos, completions, nearby, saved, done] = (await db.batch([
    db.stmt(`SELECT r.*, u.username, u.display_name, u.avatar_url FROM trail_reviews r
      JOIN users u ON u.id = r.user_id WHERE r.trail_id = ? ORDER BY r.created_at DESC`, t.id),
    db.stmt(`SELECT * FROM (SELECT p.id, p.url, p.caption, p.created_at, u.username, u.display_name FROM trail_photos p
      JOIN users u ON u.id = p.user_id WHERE p.trail_id = ?1
      UNION ALL
      SELECT pp.id * -1, pp.url, po.body, po.created_at, u.username, u.display_name FROM post_photos pp
      JOIN posts po ON po.id = pp.post_id JOIN users u ON u.id = po.user_id WHERE po.trail_id = ?1)
      ORDER BY created_at DESC LIMIT 60`, t.id),
    db.stmt('SELECT COUNT(DISTINCT user_id) n FROM activities WHERE trail_id = ?', t.id),
    db.stmt(`SELECT t.id, t.slug, t.name, t.area, t.difficulty_score, t.difficulty_label, t.distance_mi, t.elevation_gain_ft, t.features, ${COVER_COLS},
      ((t.lat - ?1) * (t.lat - ?1) + (t.lng - ?2) * (t.lng - ?2)) AS d2 FROM trails t LEFT JOIN trail_covers c ON c.trail_id = t.id
      WHERE t.id != ?3 ORDER BY d2 LIMIT 4`, t.lat, t.lng, t.id),
    db.stmt('SELECT 1 AS x FROM saved_trails WHERE user_id = ? AND trail_id = ?', uid, t.id),
    db.stmt('SELECT 1 AS x FROM activities WHERE user_id = ? AND trail_id = ? LIMIT 1', uid, t.id),
  ])).map((x) => x.results);

  const dist = [1, 2, 3, 4, 5].map((n) => reviews.filter((x) => x.rating === n).length);
  const votes = { easier: 0, accurate: 0, harder: 0 };
  for (const x of reviews) if (votes[x.difficulty_vote] != null) votes[x.difficulty_vote]++;

  return c.json({
    trail: parseTrail(t),
    rating: { average: reviews.length ? reviews.reduce((s, x) => s + x.rating, 0) / reviews.length : 0, count: reviews.length, distribution: dist },
    difficulty_votes: votes,
    reviews: reviews.map((x) => ({ id: x.id, rating: x.rating, body: x.body, difficulty_vote: x.difficulty_vote, created_at: x.created_at,
      user: { id: x.user_id, username: x.username, display_name: x.display_name, avatar_url: x.avatar_url } })),
    my_review: reviews.find((x) => x.user_id === uid) || null,
    photos,
    completions: completions[0].n,
    saved: saved.length > 0,
    done: done.length > 0,
    outings: await visibleOutings(db, uid, { trailId: t.id }),
    nearby: nearby.map(parseTrail),
  });
});

// Main photo for a trail from its Google Maps listing (when configured).
r.get('/:slug/cover', async (c) => {
  const t = await c.get('db').first('SELECT id, slug, name, area, lat, lng, google_place_id FROM trails WHERE slug = ?', c.req.param('slug'));
  if (!t) return c.json({ error: 'Trail not found' }, 404);
  const cover = await trailCover(c.env, c.get('db'), t, Number(c.req.query('w')) || 1200);
  c.header('Cache-Control', 'private, max-age=3600');
  return c.json({ cover });
});

r.post('/:id/reviews', async (c) => {
  const b = await readJson(c);
  const rating = Number(b.rating);
  if (!(rating >= 1 && rating <= 5)) return c.json({ error: 'Rating must be 1–5 stars' }, 400);
  const vote = ['easier', 'accurate', 'harder'].includes(b.difficulty_vote) ? b.difficulty_vote : null;
  await c.get('db').run(`INSERT INTO trail_reviews (trail_id, user_id, rating, difficulty_vote, body) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(trail_id, user_id) DO UPDATE SET rating=excluded.rating, difficulty_vote=excluded.difficulty_vote,
    body=excluded.body, created_at=datetime('now')`, Number(c.req.param('id')), c.get('user').id, Math.round(rating), vote, String(b.body || '').slice(0, 2000));
  await checkAchievements(c, c.get('user').id);
  return c.json({ ok: true }, 201);
});

r.delete('/:id/reviews', async (c) => {
  await c.get('db').run('DELETE FROM trail_reviews WHERE trail_id = ? AND user_id = ?', Number(c.req.param('id')), c.get('user').id);
  return c.json({ ok: true });
});

r.post('/:id/photos', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const trailId = Number(c.req.param('id'));
  if (!(await db.first('SELECT 1 FROM trails WHERE id = ?', trailId))) return c.json({ error: 'Trail not found' }, 404);
  const body = await c.req.parseBody({ all: true });
  const files = filesFrom(body, 'photos');
  if (!files.length) return c.json({ error: 'Add at least one image (JPEG, PNG, WebP or HEIC, max 10 MB)' }, 400);
  const urls = await Promise.all(files.map((f) => storePhoto(c.env, f)));
  const caption = String(field(body, 'caption') || '').slice(0, 280);
  await db.batch(urls.map((url) => db.stmt('INSERT INTO trail_photos (trail_id, user_id, url, caption) VALUES (?, ?, ?, ?)', trailId, me.id, url, caption)));
  await checkAchievements(c, me.id);
  return c.json({ ok: true, user: publicUser(me) }, 201);
});

r.post('/:id/save', async (c) => {
  await c.get('db').run('INSERT OR IGNORE INTO saved_trails (user_id, trail_id) VALUES (?, ?)', c.get('user').id, Number(c.req.param('id')));
  return c.json({ saved: true });
});
r.delete('/:id/save', async (c) => {
  await c.get('db').run('DELETE FROM saved_trails WHERE user_id = ? AND trail_id = ?', c.get('user').id, Number(c.req.param('id')));
  return c.json({ saved: false });
});

export default r;
