import { Hono } from 'hono';
import { signToken, requireAuth, publicUser, hashPassword, checkPassword, readJson } from '../auth.js';
import { filesFrom, storePhoto, field } from '../uploads.js';

const r = new Hono();
const me = (u) => ({ ...publicUser(u), email: u.email, preferred_difficulty: u.preferred_difficulty });

r.post('/signup', async (c) => {
  const db = c.get('db');
  const { username, email, password, display_name, activity_type = 'both', preferred_difficulty = 4 } = await readJson(c);
  if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username || '')) return c.json({ error: 'Username must be 3–24 letters, numbers, _ or .' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email || '')) return c.json({ error: 'Enter a valid email' }, 400);
  if ((password || '').length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);
  if (await db.first('SELECT 1 FROM users WHERE username = ? OR email = ?', username, email)) {
    return c.json({ error: 'That username or email is already taken' }, 409);
  }
  const user = await db.first(`INSERT INTO users (username, email, password_hash, display_name, activity_type, preferred_difficulty)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *`, username, email, await hashPassword(password), (display_name || username).slice(0, 60),
  ['hiker', 'runner', 'both'].includes(activity_type) ? activity_type : 'both',
  Math.min(10, Math.max(1, Number(preferred_difficulty) || 4)));
  return c.json({ token: await signToken(c.env, user.id), user: me(user) }, 201);
});

r.post('/login', async (c) => {
  const { login, password } = await readJson(c);
  const user = await c.get('db').first('SELECT * FROM users WHERE username = ? OR email = ?', login || '', login || '');
  if (!user || !(await checkPassword(password || '', user.password_hash))) {
    return c.json({ error: 'Wrong username/email or password' }, 401);
  }
  return c.json({ token: await signToken(c.env, user.id), user: me(user) });
});

r.get('/me', requireAuth, async (c) => {
  const u = c.get('user');
  const strava = await c.get('db').first('SELECT athlete_id FROM strava_accounts WHERE user_id = ?', u.id);
  return c.json({ user: { ...me(u), strava_connected: !!strava } });
});

r.patch('/me', requireAuth, async (c) => {
  const db = c.get('db');
  const u = c.get('user');
  const b = await c.req.parseBody({ all: true });
  const [avatar] = filesFrom(b, 'avatar', 1);
  const type = field(b, 'activity_type');
  const diff = field(b, 'preferred_difficulty');
  const updated = await db.first(`UPDATE users SET display_name=?, bio=?, activity_type=?, preferred_difficulty=?, avatar_url=?
    WHERE id=? RETURNING *`,
  (field(b, 'display_name') ?? u.display_name).slice(0, 60),
  (field(b, 'bio') ?? u.bio ?? '').slice(0, 280),
  ['hiker', 'runner', 'both'].includes(type) ? type : u.activity_type,
  diff ? Math.min(10, Math.max(1, Number(diff))) : u.preferred_difficulty,
  avatar ? await storePhoto(c.env, avatar) : u.avatar_url,
  u.id);
  return c.json({ user: me(updated) });
});

export default r;
