import { sign, verify } from 'hono/jwt';

// ---- Passwords: PBKDF2-SHA256 via Web Crypto (fast, native in Workers) ----
const ITERATIONS = 100000;
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function checkPassword(password, stored) {
  const [scheme, iter, salt, hash] = (stored || '').split('$');
  if (scheme !== 'pbkdf2') return false;
  const actual = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// ---- Tokens: bearer JWTs so the same API serves web + future native apps ----
const secret = (env) => env.JWT_SECRET || 'dev-secret';
const DAY = 86400;

export const signToken = (env, userId) => sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + 30 * DAY }, secret(env));
export async function verifyToken(env, token) {
  const p = await verify(token, secret(env), 'HS256');
  return p.sub;
}
export const signState = (env, payload) => sign({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 }, secret(env));
export const verifyState = (env, token) => verify(token, secret(env), 'HS256');

export async function requireAuth(c, next) {
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return c.json({ error: 'Not signed in' }, 401);
  let id;
  try { id = await verifyToken(c.env, token); } catch { return c.json({ error: 'Session expired' }, 401); }
  const user = await c.get('db').first('SELECT * FROM users WHERE id = ?', id);
  if (!user) return c.json({ error: 'Account not found' }, 401);
  c.set('user', user);
  await next();
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, display_name: u.display_name, bio: u.bio,
    avatar_url: u.avatar_url, activity_type: u.activity_type, created_at: u.created_at,
  };
}

/** Friends = people who follow each other. */
export async function areFriends(db, a, b) {
  if (a === b) return false;
  return !!(await db.first(`
    SELECT 1 FROM follows f1 JOIN follows f2
      ON f1.follower_id = f2.followee_id AND f1.followee_id = f2.follower_id
    WHERE f1.follower_id = ? AND f1.followee_id = ?`, a, b));
}

export async function friendIds(db, userId) {
  return (await db.all(`
    SELECT f1.followee_id AS id FROM follows f1 JOIN follows f2
      ON f1.followee_id = f2.follower_id AND f2.followee_id = f1.follower_id
    WHERE f1.follower_id = ?`, userId)).map((r) => r.id);
}

export async function readJson(c) {
  try { return await c.req.json(); } catch { return {}; }
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
