import { Hono } from 'hono';
import { requireAuth, readJson } from '../auth.js';

const r = new Hono();
r.use('*', requireAuth);

const CATEGORIES = { general: 'General', bug: 'Bug report', idea: 'Feature idea', 'trail-data': 'Trail info correction' };

/**
 * Email via Resend (https://resend.com). Without a verified domain, Resend's
 * shared sender can only deliver to the address that owns the Resend account,
 * which is exactly what feedback needs. Set RESEND_API_KEY to enable.
 */
async function emailOwner(env, { category, message, page, user }) {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return false;
  const lines = [
    message, '', '—',
    `From: ${user.display_name} (@${user.username}) <${user.email}>`,
    `Category: ${CATEGORIES[category]}`,
    page ? `Page: ${page}` : null,
    `Sent: ${new Date().toISOString()}`,
  ].filter((x) => x != null);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM || 'Trailing Feedback <onboarding@resend.dev>',
      to: [env.FEEDBACK_TO],
      reply_to: user.email,
      subject: `[Trailing] ${CATEGORIES[category]}: ${message.replace(/\s+/g, ' ').slice(0, 60)}`,
      text: lines.join('\n'),
    }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
  return res.ok;
}

r.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const b = await readJson(c);
  const category = CATEGORIES[b.category] ? b.category : 'general';
  const message = String(b.message || '').trim().slice(0, 5000);
  if (message.length < 3) return c.json({ error: 'Please write a little more' }, 400);

  const recent = await db.first("SELECT COUNT(*) n FROM feedback WHERE user_id = ? AND created_at > datetime('now', '-1 hour')", me.id);
  if (recent.n >= 5) return c.json({ error: "Thanks! You've sent a lot of feedback recently — please try again in a bit." }, 429);

  const page = String(b.page || '').slice(0, 200) || null;
  const { id } = await db.first(`INSERT INTO feedback (user_id, category, message, page, user_agent) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    me.id, category, message, page, (c.req.header('user-agent') || '').slice(0, 300));
  let emailed = false;
  try { emailed = await emailOwner(c.env, { category, message, page, user: me }); } catch (e) { console.error(e); }
  if (emailed) await db.run('UPDATE feedback SET emailed = 1 WHERE id = ?', id);
  return c.json({ ok: true }, 201);
});

export default r;
