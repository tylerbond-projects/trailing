// Builds seed/demo.sql: demo users, follows, activities, posts, reviews, group
// hikes and chats, with dates relative to *now*.
//   npm run db:demo:local | npm run db:demo:remote      (log in as demo / password123)
// It runs the seed against an in-memory SQLite copy of the schema, then dumps
// the rows as SQL. Trails are referenced by slug so ids never drift.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [path.join(root, 'scripts', 'build-trails-sql.mjs')], { stdio: 'inherit' });

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(root, 'migrations', '0001_init.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(root, 'seed', 'trails.sql'), 'utf8'));

const ID_BASE = 900000; // keep demo ids far away from real rows
const password = (() => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync('password123', salt, 100000, 32, 'sha256');
  return `pbkdf2$100000$${salt.toString('base64')}$${hash.toString('base64')}`;
})();

const USERS = [
  { username: 'demo', display_name: 'Demo Hiker', activity_type: 'both', pref: 5, bio: 'Exploring every trail in Utah County, one summit at a time.' },
  { username: 'maya.trails', display_name: 'Maya Chen', activity_type: 'hiker', pref: 7, bio: 'Peak bagger. Sunrise summits > sleep.' },
  { username: 'jrun', display_name: 'Jordan Ellis', activity_type: 'runner', pref: 4, bio: 'Trail runner training for my first 50K.' },
  { username: 'alex_outside', display_name: 'Alex Morgan', activity_type: 'both', pref: 5, bio: 'Weekend warrior · dog parent · waterfall chaser' },
  { username: 'priya.k', display_name: 'Priya Kapoor', activity_type: 'hiker', pref: 3, bio: 'Photographer. Here for the wildflowers.' },
  { username: 'benw', display_name: 'Ben Walker', activity_type: 'runner', pref: 6, bio: 'Provo River Parkway regular.' },
];
const ids = {};
let nextUser = ID_BASE;
for (const u of USERS) {
  ids[u.username] = ++nextUser;
  db.prepare(`INSERT INTO users (id, username, email, password_hash, display_name, bio, activity_type, preferred_difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(nextUser, u.username, `${u.username}@example.com`, password, u.display_name, u.bio, u.activity_type, u.pref);
}
const follow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)');
for (const [a, b] of [['demo', 'maya.trails'], ['demo', 'jrun'], ['demo', 'alex_outside'], ['maya.trails', 'priya.k'], ['jrun', 'benw'], ['alex_outside', 'priya.k']]) {
  follow.run(ids[a], ids[b]); follow.run(ids[b], ids[a]);
}
follow.run(ids.benw, ids.demo);
follow.run(ids.demo, ids['priya.k']);

let seq = ID_BASE;
const next = () => ++seq;
const trail = (slug) => db.prepare('SELECT * FROM trails WHERE slug = ?').get(slug);
const pad = (x) => String(x).padStart(2, '0');
const daysAgo = (n, hour = 8) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:15:00`;
};
const inDays = (n, hourUtc) => { const d = new Date(Date.now() + n * 86400000); d.setUTCHours(hourUtc, 0, 0, 0); return d.toISOString(); };

function log(user, slug, o) {
  const t = trail(slug);
  const type = o.type || 'Hike';
  const mi = o.distance ?? t.distance_mi;
  const id = next();
  db.prepare(`INSERT INTO activities (id, user_id, source, name, type, distance_m, moving_time_s, elevation_gain_m, start_date, trail_id)
    VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?)`).run(id, ids[user], o.name || t.name, type, mi * 1609.344,
    Math.round((mi / (type === 'Hike' ? 2.2 : 6)) * 3600 + (t.elevation_gain_ft / 1500) * 3600 * (type === 'Hike' ? 1 : 0.4)),
    (o.gain ?? t.elevation_gain_ft) * 0.3048, daysAgo(o.ago, o.hour), t.id);
  return id;
}
const post = (user, activityId, slug, body, ago) => db.prepare(`INSERT INTO posts (id, user_id, activity_id, trail_id, body, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', ?))`).run(next(), ids[user], activityId, trail(slug).id, body, `-${ago} days`);
const review = (user, slug, rating, body, vote = 'accurate') => db.prepare(
  'INSERT INTO trail_reviews (id, trail_id, user_id, rating, body, difficulty_vote) VALUES (?, ?, ?, ?, ?, ?)').run(next(), trail(slug).id, ids[user], rating, body, vote);

post('maya.trails', log('maya.trails', 'mount-timpanogos-timpooneke', { ago: 3, hour: 4 }), 'mount-timpanogos-timpooneke', 'Sunrise on Timp never gets old. Goats were out in full force near the saddle 🐐', 3);
post('maya.trails', log('maya.trails', 'box-elder-peak', { ago: 12, hour: 6 }), 'box-elder-peak', 'Box Elder had about 1/10th the people Timp did. Upper ridge is loose — poles recommended.', 12);
log('maya.trails', 'kyhv-peak', { ago: 20, hour: 6 });
log('maya.trails', 'provo-peak', { ago: 34, hour: 5 });
post('jrun', log('jrun', 'murdock-canal-trail', { ago: 1, type: 'Run', distance: 13.4, name: 'Long run on Murdock', hour: 6 }), 'murdock-canal-trail', 'Half marathon distance done ✅ legs feel great. 50K training block week 6.', 1);
post('jrun', log('jrun', 'bonneville-shoreline-provo', { ago: 5, type: 'TrailRun', distance: 7.1, hour: 7 }), 'bonneville-shoreline-provo', 'BST tempo with the crew. That climb out of Rock Canyon 😮‍💨', 5);
log('jrun', 'rock-canyon', { ago: 9, type: 'TrailRun', hour: 6 });
post('alex_outside', log('alex_outside', 'stewart-falls', { ago: 2, hour: 10 }), 'stewart-falls', 'Aspens are turning! Stewart Falls was busy but worth it. Pup approved 🐶🍂', 2);
post('alex_outside', log('alex_outside', 'fifth-water-hot-springs', { ago: 15, hour: 9 }), 'fifth-water-hot-springs', 'Fifth Water soak after a long week. Go early to snag a pool.', 15);
log('alex_outside', 'battle-creek-falls', { ago: 22 });
post('priya.k', log('priya.k', 'big-springs-hollow', { ago: 6, hour: 17 }), 'big-springs-hollow', 'Golden hour in South Fork. Late wildflowers + first fall colors.', 6);
log('priya.k', 'cascade-springs', { ago: 30 });
post('benw', log('benw', 'provo-river-parkway', { ago: 4, type: 'Run', distance: 8.2, hour: 5 }), 'provo-river-parkway', 'Early 8 up the canyon to Bridal Veil. Freezing at 5am but beautiful.', 4);
post('demo', log('demo', 'y-mountain', { ago: 8, hour: 7 }), 'y-mountain', 'Quick Y hike before work. Never gets old.', 8);
log('demo', 'stewart-falls', { ago: 18 });
log('demo', 'bridal-veil-falls', { ago: 40, type: 'Run', distance: 4.2 });

review('maya.trails', 'mount-timpanogos-timpooneke', 5, 'The best hike in Utah County, period. Start early for the goats and to beat the storms.');
review('maya.trails', 'box-elder-peak', 5, 'Underrated! Amazing Timp view. Final ridge is steep and loose.', 'harder');
review('maya.trails', 'kyhv-peak', 4, 'Steep but quick. Great views of Provo.');
review('alex_outside', 'stewart-falls', 5, 'Perfect family hike. Fall colors are unreal in late Sept.');
review('alex_outside', 'fifth-water-hot-springs', 4, 'Super fun but crowded on weekends. Please pack out your trash!', 'easier');
review('alex_outside', 'battle-creek-falls', 4, 'Short and sweet. Muddy near the falls.');
review('priya.k', 'big-springs-hollow', 5, 'Wildflower heaven in July.');
review('priya.k', 'cascade-springs', 4, 'Easy boardwalk with crystal clear water. Great for grandparents.');
review('jrun', 'bonneville-shoreline-provo', 5, 'Best trail running in Provo. Tons of access points.');
review('jrun', 'rock-canyon', 4, 'Rocky and technical in spots. Great hill training.', 'harder');
review('benw', 'provo-river-parkway', 5, 'Flat, paved, gorgeous canyon section.');
review('demo', 'y-mountain', 4, 'Short but steep! Go for sunset.');

const latestPost = (u) => db.prepare('SELECT id FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(ids[u]).id;
db.prepare('INSERT INTO post_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(next(), latestPost('maya.trails'), ids.demo, 'Incredible! Taking me next time?');
db.prepare('INSERT INTO post_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(next(), latestPost('maya.trails'), ids.alex_outside, 'Those goats 😍');
for (const u of ['demo', 'alex_outside', 'priya.k']) db.prepare('INSERT INTO post_likes (post_id, user_id) SELECT id, ? FROM posts WHERE user_id = ?').run(ids[u], ids['maya.trails']);
for (const u of ['demo', 'benw']) db.prepare('INSERT INTO post_likes (post_id, user_id) SELECT id, ? FROM posts WHERE user_id = ?').run(ids[u], ids.jrun);

const msg = (conv, user, body, ago = null) => db.prepare(`INSERT INTO messages (id, conversation_id, user_id, body, created_at)
  VALUES (?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now', ?))`).run(next(), conv, user ? ids[user] : null, body, ago || '+0 seconds');
function outing(host, slug, title, days, hourUtc, visibility, members, description, pace, max = null) {
  const t = trail(slug);
  const conv = next();
  db.prepare("INSERT INTO conversations (id, type) VALUES (?, 'outing')").run(conv);
  const oid = next();
  db.prepare(`INSERT INTO outings (id, trail_id, host_id, conversation_id, title, description, starts_at, visibility, pace, max_people)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(oid, t.id, ids[host], conv, title, description, inDays(days, hourUtc), visibility, pace, max);
  msg(conv, null, `${USERS.find((u) => u.username === host).display_name} planned a hike on ${t.name}. Anyone who joins will show up here.`, '-1 hours');
  for (const m of [host, ...members]) {
    db.prepare('INSERT INTO outing_members (outing_id, user_id) VALUES (?, ?)').run(oid, ids[m]);
    db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(conv, ids[m]);
  }
  return conv;
}
// Hours are UTC; Utah is UTC-6 (MDT) / UTC-7 (MST).
const c1 = outing('maya.trails', 'box-elder-peak', 'Box Elder sunrise push', 4, 11, 'public', ['priya.k'], 'Meeting at Granite Flat TH at 5am. Headlamps required. Moving at a steady pace with photo breaks at the top.', 'moderate', 8);
msg(c1, 'priya.k', "I'm in! Bringing my big lens for the summit 📷", '-30 minutes');
msg(c1, 'maya.trails', 'Yes!! Carpool from Orem?', '-25 minutes');
outing('jrun', 'bonneville-shoreline-provo', 'Saturday BST trail run', 2, 13, 'public', ['benw'], '7–9 mi at conversational pace. All paces welcome, we regroup at intersections.', 'fast');
outing('alex_outside', 'stewart-falls', 'Fall colors at Stewart Falls 🍂', 6, 15, 'friends', [], 'Chill hike to see the leaves. Dogs welcome!', 'relaxed');
outing('priya.k', 'cascade-springs', 'Photo walk at Cascade Springs', 9, 22, 'public', [], 'Easy golden-hour photo walk. Beginners welcome.', 'relaxed', 10);

const dm = next();
db.prepare("INSERT INTO conversations (id, type, direct_key) VALUES (?, 'direct', ?)").run(dm, [ids.demo, ids['maya.trails']].sort((a, b) => a - b).join(':'));
db.prepare("INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, '2000-01-01'), (?, ?, datetime('now'))").run(dm, ids.demo, dm, ids['maya.trails']);
msg(dm, 'maya.trails', 'Are you coming to Box Elder this week?', '-50 minutes');
msg(dm, 'demo', 'Thinking about it! How hard is the ridge?', '-45 minutes');
msg(dm, 'maya.trails', "Steep + loose but you'll crush it. Poles help a ton.", '-40 minutes');

// ---- Dump ---------------------------------------------------------------------
const slugById = new Map(db.prepare('SELECT id, slug FROM trails').all().map((t) => [t.id, t.slug]));
const lit = (v) => (v == null ? 'NULL' : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const TABLES = ['users', 'follows', 'activities', 'posts', 'post_likes', 'post_comments', 'trail_reviews',
  'conversations', 'conversation_members', 'messages', 'outings', 'outing_members'];
const names = USERS.map((u) => lit(u.username)).join(', ');
// Only demo rows are removed on re-run: deleting the demo users cascades to
// their posts, activities, reviews, follows, outings and chat memberships;
// then chats left with no members are dropped. Real users are never touched.
const out = [
  '-- Generated by scripts/build-demo-sql.mjs — demo users and content.',
  `DELETE FROM users WHERE username IN (${names});`,
  'DELETE FROM conversations WHERE id NOT IN (SELECT conversation_id FROM conversation_members);',
];
for (const table of TABLES) {
  for (const row of db.prepare(`SELECT * FROM ${table}`).all()) {
    const cols = Object.keys(row);
    const vals = cols.map((c) => (c === 'trail_id' && row[c] != null ? `(SELECT id FROM trails WHERE slug = ${lit(slugById.get(row[c]))})` : lit(row[c])));
    out.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
  }
}
fs.writeFileSync(path.join(root, 'seed', 'demo.sql'), out.join('\n') + '\n');
console.log(`Wrote seed/demo.sql (${out.length - 3} rows). Log in with demo / password123`);
