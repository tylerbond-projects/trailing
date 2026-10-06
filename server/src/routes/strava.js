import { Hono } from 'hono';
import { requireAuth, signState, verifyState, readJson } from '../auth.js';
import { stravaConfigured, authorizeUrl, exchangeCode, listActivities, getActivity, disconnect, SUPPORTED_TYPES } from '../strava.js';
import { createActivity, matchTrail, hydratePosts } from '../services.js';
import { checkAchievements } from '../achievements.js';

const r = new Hono();

// Strava redirects the browser here (no bearer token), so the user is
// identified by the signed `state` created in /connect-url.
r.get('/callback', async (c) => {
  const origin = new URL(c.req.url).origin;
  const { code, state, error } = c.req.query();
  if (error || !code) return c.redirect(`${origin}/settings?strava=denied`);
  try {
    const { uid, returnTo } = await verifyState(c.env, state);
    await exchangeCode(c.env, c.get('db'), uid, code);
    return c.redirect(`${returnTo || origin}/settings?strava=connected`);
  } catch (e) {
    console.error(e);
    return c.redirect(`${origin}/settings?strava=error`);
  }
});

r.use('*', requireAuth);

r.get('/status', async (c) => {
  const acct = await c.get('db').first('SELECT athlete_id FROM strava_accounts WHERE user_id = ?', c.get('user').id);
  return c.json({ configured: stravaConfigured(c.env), connected: !!acct, athlete_id: acct?.athlete_id ?? null });
});

r.get('/connect-url', async (c) => {
  if (!stravaConfigured(c.env)) return c.json({ error: 'Strava is not configured yet. Set the STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET secrets.' }, 503);
  // returnTo lets a native app pass its own deep link (e.g. trailing://) later.
  const state = await signState(c.env, { uid: c.get('user').id, returnTo: c.req.query('returnTo') });
  return c.json({ url: authorizeUrl(c.env, new URL(c.req.url).origin, state) });
});

r.get('/activities', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const list = await listActivities(c.env, db, uid, Number(c.req.query('page')) || 1);
  const imported = new Set((await db.all('SELECT strava_id FROM activities WHERE user_id = ? AND strava_id IS NOT NULL', uid)).map((x) => x.strava_id));
  const activities = await Promise.all(list.map(async (a) => ({
    strava_id: a.id, name: a.name, type: a.sport_type || a.type,
    distance_mi: Math.round((a.distance / 1609.344) * 100) / 100,
    elevation_gain_ft: Math.round(a.total_elevation_gain * 3.28084),
    moving_time_s: a.moving_time, start_date: a.start_date_local,
    imported: imported.has(a.id),
    suggested_trail_id: await matchTrail(db, a.start_latlng?.[0], a.start_latlng?.[1]),
  })));
  return c.json({ activities });
});

// Import a Strava activity, optionally publishing it as a post.
r.post('/import', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const { strava_id, body = '', trail_id, post = true } = await readJson(c);
  if (await db.first('SELECT id FROM activities WHERE strava_id = ? AND user_id = ?', Number(strava_id), uid)) {
    return c.json({ error: 'Already imported' }, 409);
  }
  const a = await getActivity(c.env, db, uid, strava_id);
  const type = a.sport_type || a.type;
  if (!SUPPORTED_TYPES.includes(type)) return c.json({ error: 'Only hikes, walks and runs can be imported' }, 400);

  const trailId = trail_id ? Number(trail_id) : await matchTrail(db, a.start_latlng?.[0], a.start_latlng?.[1]);
  const activityId = await createActivity(db, uid, {
    source: 'strava', strava_id: a.id, name: a.name, type: type === 'VirtualRun' ? 'Run' : type,
    distance_m: a.distance, moving_time_s: a.moving_time, elevation_gain_m: a.total_elevation_gain,
    start_date: a.start_date_local.replace('Z', ''), trail_id: trailId, polyline: a.map?.summary_polyline || null,
  });
  let postOut = null;
  if (post) {
    const postId = await db.insert('INSERT INTO posts (user_id, activity_id, trail_id, body) VALUES (?, ?, ?, ?)',
      uid, activityId, trailId, String(body || a.description || '').slice(0, 2000));
    [postOut] = await hydratePosts(db, [await db.first('SELECT * FROM posts WHERE id = ?', postId)], uid);
  }
  await checkAchievements(c, uid);
  return c.json({ activity_id: activityId, post: postOut }, 201);
});

r.delete('/', async (c) => {
  await disconnect(c.env, c.get('db'), c.get('user').id);
  return c.json({ ok: true });
});

export default r;
