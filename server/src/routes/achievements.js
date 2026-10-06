import { Hono } from 'hono';
import { requireAuth } from '../auth.js';
import { achievementsFor, checkAchievements } from '../achievements.js';

const r = new Hono();
r.use('*', requireAuth);

r.get('/', async (c) => {
  await checkAchievements(c, c.get('user').id);
  return c.json({ achievements: await achievementsFor(c.get('db'), c.get('user').id) });
});

export default r;
