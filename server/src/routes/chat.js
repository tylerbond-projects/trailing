import { Hono } from 'hono';
import { requireAuth, publicUser, areFriends, readJson } from '../auth.js';
import { sendMessage, conversationMemberIds } from '../services.js';

const r = new Hono();
r.use('*', requireAuth);

const membership = (db, convId, uid) => db.first('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', convId, uid);

async function summarize(db, conv, uid) {
  const [members, last, mine, outing] = (await db.batch([
    db.stmt(`SELECT u.* FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ?`, conv.id),
    db.stmt('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1', conv.id),
    db.stmt(`SELECT (SELECT COUNT(*) FROM messages WHERE conversation_id = ?1 AND created_at > m.last_read_at
        AND (user_id IS NULL OR user_id != ?2)) AS unread
      FROM conversation_members m WHERE m.conversation_id = ?1 AND m.user_id = ?2`, conv.id, uid),
    db.stmt(`SELECT o.id, o.title, o.starts_at, o.cancelled, t.name AS trail_name, t.slug AS trail_slug
      FROM outings o JOIN trails t ON t.id = o.trail_id WHERE o.conversation_id = ?`, conv.id),
  ])).map((x) => x.results);
  const people = members.map(publicUser);
  const other = conv.type === 'direct' ? people.find((m) => m.id !== uid) : null;
  const o = conv.type === 'outing' ? outing[0] || null : null;
  return {
    id: conv.id, type: conv.type, members: people, outing: o, other,
    title: o ? o.title : other?.display_name || 'Chat',
    last_message: last[0] ? { body: last[0].body, created_at: last[0].created_at, user_id: last[0].user_id } : null,
    unread: mine[0]?.unread || 0,
  };
}

r.get('/', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const convs = await db.all(`SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id WHERE m.user_id = ?`, uid);
  const list = await Promise.all(convs.map((conv) => summarize(db, conv, uid)));
  list.sort((a, b) => (b.last_message?.created_at || '').localeCompare(a.last_message?.created_at || ''));
  return c.json({ conversations: list });
});

// Open (or create) a 1:1 chat. Only friends — people who follow each other — can DM.
r.post('/direct', async (c) => {
  const db = c.get('db');
  const uid = c.get('user').id;
  const other = Number((await readJson(c)).user_id);
  if (!(await areFriends(db, uid, other))) return c.json({ error: 'You can only message friends (people who follow you back).' }, 403);
  const key = [uid, other].sort((a, b) => a - b).join(':');
  let conv = await db.first('SELECT * FROM conversations WHERE direct_key = ?', key);
  if (!conv) {
    conv = await db.first("INSERT INTO conversations (type, direct_key) VALUES ('direct', ?) ON CONFLICT(direct_key) DO UPDATE SET type = type RETURNING *", key);
    await db.batch([
      db.stmt('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.id, uid),
      db.stmt('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.id, other),
    ]);
  }
  return c.json({ conversation: await summarize(db, conv, uid) });
});

r.get('/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (!(await membership(db, id, c.get('user').id))) return c.json({ error: 'Conversation not found' }, 404);
  return c.json({ conversation: await summarize(db, await db.first('SELECT * FROM conversations WHERE id = ?', id), c.get('user').id) });
});

r.get('/:id/messages', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (!(await membership(db, id, c.get('user').id))) return c.json({ error: 'Conversation not found' }, 404);
  const before = Number(c.req.query('before')) || Number.MAX_SAFE_INTEGER;
  const rows = await db.all(`SELECT m.*, u.username, u.display_name, u.avatar_url FROM messages m
    LEFT JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 50`, id, before);
  return c.json({
    messages: rows.reverse().map((m) => ({
      id: m.id, conversation_id: m.conversation_id, body: m.body, created_at: m.created_at, user_id: m.user_id,
      user: m.user_id ? { id: m.user_id, username: m.username, display_name: m.display_name, avatar_url: m.avatar_url } : null,
    })),
  });
});

r.post('/:id/messages', async (c) => {
  const db = c.get('db');
  const me = c.get('user');
  const id = Number(c.req.param('id'));
  if (!(await membership(db, id, me.id))) return c.json({ error: 'Conversation not found' }, 404);
  const conv = await db.first('SELECT * FROM conversations WHERE id = ?', id);
  if (conv.type === 'direct') {
    const other = (await conversationMemberIds(db, id)).find((x) => x !== me.id);
    if (!(await areFriends(db, me.id, other))) return c.json({ error: 'You are no longer friends with this person.' }, 403);
  }
  const body = String((await readJson(c)).body || '').trim().slice(0, 4000);
  if (!body) return c.json({ error: 'Message is empty' }, 400);
  const msg = await sendMessage(c, id, me, body);
  await db.run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', msg.created_at, id, me.id);
  return c.json({ message: msg }, 201);
});

r.post('/:id/read', async (c) => {
  await c.get('db').run("UPDATE conversation_members SET last_read_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE conversation_id = ? AND user_id = ?",
    Number(c.req.param('id')), c.get('user').id);
  return c.json({ ok: true });
});

export default r;
