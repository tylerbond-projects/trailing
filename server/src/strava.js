const OAUTH = 'https://www.strava.com/oauth';
const API = 'https://www.strava.com/api/v3';

export const stravaConfigured = (env) => !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);
export const SUPPORTED_TYPES = ['Hike', 'Run', 'TrailRun', 'Walk', 'VirtualRun'];

export function authorizeUrl(env, origin, state) {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: `${origin}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  return `${OAUTH}/authorize?${params}`;
}

async function tokenRequest(env, body) {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...body }),
  });
  if (!res.ok) throw new Error(`Strava token error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exchangeCode(env, db, userId, code) {
  const t = await tokenRequest(env, { code, grant_type: 'authorization_code' });
  await db.run(`INSERT INTO strava_accounts (user_id, athlete_id, access_token, refresh_token, expires_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET athlete_id=excluded.athlete_id,
    access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at`,
  userId, t.athlete.id, t.access_token, t.refresh_token, t.expires_at);
}

async function accessToken(env, db, userId) {
  const acct = await db.first('SELECT * FROM strava_accounts WHERE user_id = ?', userId);
  if (!acct) throw Object.assign(new Error('Strava is not connected'), { status: 400 });
  if (acct.expires_at - 60 > Date.now() / 1000) return acct.access_token;
  const t = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: acct.refresh_token });
  await db.run('UPDATE strava_accounts SET access_token=?, refresh_token=?, expires_at=? WHERE user_id=?',
    t.access_token, t.refresh_token, t.expires_at, userId);
  return t.access_token;
}

async function api(env, db, userId, path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken(env, db, userId)}` } });
  if (!res.ok) throw Object.assign(new Error(`Strava API error ${res.status}`), { status: 502 });
  return res.json();
}

export async function listActivities(env, db, userId, page = 1) {
  const list = await api(env, db, userId, `/athlete/activities?per_page=30&page=${page}`);
  return list.filter((a) => SUPPORTED_TYPES.includes(a.sport_type || a.type));
}

export const getActivity = (env, db, userId, id) => api(env, db, userId, `/activities/${Number(id)}`);

export async function disconnect(env, db, userId) {
  try {
    const token = await accessToken(env, db, userId);
    await fetch(`${OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* already revoked — still remove locally */ }
  await db.run('DELETE FROM strava_accounts WHERE user_id = ?', userId);
}
