-- Openly licensed cover photos (Wikimedia Commons), hosted in our R2 bucket.
CREATE TABLE IF NOT EXISTS trail_covers (
  trail_id INTEGER PRIMARY KEY REFERENCES trails(id) ON DELETE CASCADE,
  url TEXT NOT NULL,            -- /uploads/cover-<slug>.jpg (1600px)
  url_small TEXT NOT NULL,      -- /uploads/cover-<slug>-sm.jpg (640px)
  author TEXT,
  license TEXT NOT NULL,
  license_url TEXT,
  source_url TEXT NOT NULL,     -- Commons file page
  updated_at TEXT DEFAULT (datetime('now'))
);
