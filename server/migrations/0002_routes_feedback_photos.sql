-- Personalized routes drawn by users (mainly for running).
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  activity TEXT NOT NULL DEFAULT 'run',        -- run | hike
  waypoints TEXT NOT NULL,                     -- JSON [[lat,lng],...] the user placed
  path TEXT NOT NULL,                          -- JSON [[lat,lng],...] full (snapped) line
  snapped INTEGER NOT NULL DEFAULT 1,
  out_and_back INTEGER NOT NULL DEFAULT 0,
  distance_m REAL NOT NULL,
  elevation_gain_m REAL DEFAULT 0,
  elevation_profile TEXT,                      -- JSON [[distance_m, elevation_m],...]
  start_lat REAL, start_lng REAL,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_routes_user ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_public ON routes(is_public, created_at);

ALTER TABLE activities ADD COLUMN route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL;

-- Google Places id for each trail's cover photo (place ids may be stored indefinitely).
ALTER TABLE trails ADD COLUMN google_place_id TEXT;

-- In-app feedback (also emailed to the owner when email is configured).
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',    -- general | bug | idea | trail-data
  message TEXT NOT NULL,
  page TEXT,
  user_agent TEXT,
  emailed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
