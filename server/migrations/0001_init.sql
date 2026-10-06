-- Trailing schema (Cloudflare D1)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  activity_type TEXT DEFAULT 'both',          -- hiker | runner | both
  preferred_difficulty INTEGER DEFAULT 4,     -- 1-10
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strava_accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  connected_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT,
  country TEXT,
  center_lat REAL, center_lng REAL, zoom INTEGER
);

CREATE TABLE IF NOT EXISTS trails (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  region_id TEXT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL,
  area TEXT,
  description TEXT,
  tips TEXT,
  lat REAL, lng REAL,
  distance_mi REAL NOT NULL,
  elevation_gain_ft INTEGER NOT NULL,
  max_elevation_ft INTEGER,
  route_type TEXT,
  difficulty_score INTEGER NOT NULL,
  difficulty_label TEXT NOT NULL,
  est_minutes INTEGER,
  features TEXT DEFAULT '[]',
  activities TEXT DEFAULT '[]',
  best_seasons TEXT DEFAULT '[]',
  dogs TEXT,
  kid_friendly INTEGER,
  technical INTEGER DEFAULT 0,
  surface TEXT,
  fee TEXT,
  permit TEXT
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual',      -- manual | strava
  strava_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                          -- Hike | Run | TrailRun | Walk
  distance_m REAL DEFAULT 0,
  moving_time_s INTEGER DEFAULT 0,
  elevation_gain_m REAL DEFAULT 0,
  start_date TEXT NOT NULL,                    -- local time ISO string
  trail_id INTEGER REFERENCES trails(id),
  polyline TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  trail_id INTEGER REFERENCES trails(id),
  body TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS post_photos (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trail_reviews (
  id INTEGER PRIMARY KEY,
  trail_id INTEGER NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  difficulty_vote TEXT,                        -- easier | accurate | harder
  body TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (trail_id, user_id)
);
CREATE TABLE IF NOT EXISTS trail_photos (
  id INTEGER PRIMARY KEY,
  trail_id INTEGER NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS saved_trails (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  trail_id INTEGER REFERENCES trails(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, trail_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,                          -- direct | outing
  direct_key TEXT UNIQUE,                      -- "minId:maxId" for direct chats
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- NULL = system message
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE TABLE IF NOT EXISTS outings (
  id INTEGER PRIMARY KEY,
  trail_id INTEGER NOT NULL REFERENCES trails(id),
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  starts_at TEXT NOT NULL,                     -- ISO UTC
  visibility TEXT NOT NULL DEFAULT 'public',   -- public | friends
  max_people INTEGER,
  pace TEXT,                                   -- relaxed | moderate | fast
  cancelled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outing_members (
  outing_id INTEGER REFERENCES outings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (outing_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_outings_start ON outings(starts_at);
CREATE INDEX IF NOT EXISTS idx_trails_region ON trails(region_id);
