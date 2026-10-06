import { Hono } from 'hono';
import { makeDb } from './db.js';
import { verifyToken } from './auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import trailRoutes from './routes/trails.js';
import postRoutes from './routes/posts.js';
import outingRoutes from './routes/outings.js';
import chatRoutes from './routes/chat.js';
import stravaRoutes from './routes/strava.js';
import achievementRoutes from './routes/achievements.js';

export { Realtime } from './realtime.js';

const app = new Hono();

app.use('*', async (c, next) => {
  c.set('db', makeDb(c.env.DB));
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/trails', trailRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/outings', outingRoutes);
app.route('/api/conversations', chatRoutes);
app.route('/api/strava', stravaRoutes);
app.route('/api/achievements', achievementRoutes);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Uploaded photos live in R2.
app.get('/uploads/:key', async (c) => {
  const obj = await c.env.PHOTOS.get(c.req.param('key'));
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});

// Realtime: authenticate, then hand the WebSocket to the Durable Object.
app.get('/ws', async (c) => {
  if (c.req.header('upgrade') !== 'websocket') return c.text('Expected WebSocket', 426);
  let userId;
  try { userId = await verifyToken(c.env, c.req.query('token')); } catch { return c.text('Unauthorized', 401); }
  const stub = c.env.REALTIME.get(c.env.REALTIME.idFromName('global'));
  const req = new Request(c.req.raw);
  req.headers.set('x-user-id', String(userId));
  return stub.fetch(req);
});

app.onError((err, c) => {
  if (!err.status) console.error(err);
  return c.json({ error: err.status ? err.message : 'Something went wrong' }, err.status || 500);
});

export default app;
