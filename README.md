# Trailing

A social app for hikers and runners. Follow people, post hikes and runs (logged by hand or imported from Strava), chat with friends, plan group hikes that come with their own group chat, get trail recommendations, review and photograph trails, and earn achievements.

**Live:** https://trailing.pages.dev

It covers **all of Utah**: 119 hand-picked hikes and runs across 10 regions, from Logan to Kanab and Moab. Users can also draw their own running routes.

## Stack

Everything runs on **Cloudflare**:

| Piece | Service |
|---|---|
| Web app (React + Vite) | Pages (`client/`), which proxies `/api`, `/uploads` and `/ws` to the Worker through a service binding |
| API (Hono) | Workers (`server/`). It has no public URL of its own |
| Database | D1 (SQLite) |
| Photos | R2 |
| Realtime chat, notifications, achievement pop-ups | One Durable Object holding the WebSockets |

## Quick start (local)

```bash
npm install
cp server/.dev.vars.example server/.dev.vars   # set JWT_SECRET
npm run setup                                  # local D1: schema + trails + demo data
npm run dev                                    # Worker on :8787, web app on :5173
```

Open http://localhost:5173 and log in as **demo / password123**.

Wrangler runs D1, R2 and the Durable Object locally, under `server/.wrangler/`, so nothing touches production.

## Deploying

```bash
npx wrangler login
npm run deploy          # builds the client, deploys the API Worker, then the Pages site
```

Database changes go out as migrations in `server/migrations/`, applied with:

```bash
npm run db:migrate:remote -w server
```

Demo users (log in as `demo` / `password123`), including example routes, can be added or refreshed with `npm run db:demo:remote -w server`. This only replaces demo accounts; real users are never touched. Route geometry is cached in `seed/demo-routes.json`.

Trail data changes go out with:

```bash
npm run db:trails:remote -w server
```

Secrets are set with `npx wrangler secret put <NAME>` from `server/`:

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs login tokens (required) |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava import |
| `RESEND_API_KEY` | Emails in-app feedback to `FEEDBACK_TO` (set in `wrangler.jsonc`). Feedback is always stored in the `feedback` table either way. |
| `GOOGLE_PLACES_API_KEY` | Trail cover photos, taken from each trail's Google Maps listing |

## Features

| Area | What it does |
|---|---|
| **Accounts and social** | Sign up as a hiker, runner or both, and set a preferred difficulty. Follow people. Two people who follow each other are **friends**. |
| **Feed** | Posts from you and the people you follow, with distance, elevation, time, pace, the trail, and photos. You can like and comment. |
| **Strava** | OAuth connection. Lists your recent hikes, runs and walks, matches each to a trail by its GPS start point, and imports it as a post. |
| **Chat** | Realtime 1:1 chat (WebSockets on a Durable Object). Only friends can message each other. Shows unread counts and typing indicators. |
| **Group hikes** | Pick a trail and a time. Make it **public** (anyone can see and join) or **friends only**. Joining puts you in a group chat with everyone going. Supports group size limits and pace. |
| **Routes** | Draw your own run or hike on a map. It snaps to trails and roads using OSRM's foot profile, and shows distance, elevation gain, an elevation profile and an estimated time at your pace. Routes can be public or private, and you can log runs on a route and see your best time. |
| **Feedback** | A form in Settings. Feedback is saved, and emailed to the owner when Resend is set up. |
| **Trails** | Search and filters (difficulty, length, features, runnable, dog/kid friendly), list and map views, and a detail page with stats, a tip, good-to-know facts, a map, directions, nearby trails and upcoming group hikes. |
| **Difficulty** | A 1–10 score with a label (Easy → Strenuous), worked out the same way for every trail. Reviewers vote on whether a trail felt easier or harder than its rating. |
| **Reviews and photos** | 1–5 star reviews with text, plus photo uploads per trail. Photos from posts tagged to a trail also appear in its gallery. |
| **For You** | Recommendations based on what you've done, saved and rated, your difficulty level, the season, ratings, what your friends have done and upcoming group hikes. Each pick says why it was suggested. |
| **Achievements** | 37+ badges across Milestones, Distance, Elevation, Running, Exploration, Habits and Community. Each shows progress and pops up live when you earn it. |

### Achievements

- **Milestones:** First Steps (1 activity), Trail Regular (25), Centurion (100)
- **Distance:** 10 / 100 / 500 / 1,000 total miles; Big Day Out (a single hike of 10+ miles)
- **Elevation:** 10,000 ft total; Everesting (29,032 ft total); Vertical Mile (5,280 ft in one activity)
- **Running:** 5K, 10K, Half Marathon, Marathon, Ultra (50K) in a single run
- **Exploration:** 5 and 15 unique trails; Peak Bagger (3 summits); Summit Collector (10); King of Timp; Chasing Waterfalls; Lake Hopper; Soak It In (a hot spring); plus **Halfway** and **Completionist** badges for every region
- **Habits:** Early Bird (start before 6 AM); Dawn Patrol (10 early starts); Four Seasons (get out in all four seasons)
- **Community:** Trail Critic (5 reviews); Walking Guidebook (25); Shutterbug (10 photos); Trail Leader / Pack Leader (host group hikes); Tag Along (join someone else's hike); Trail Buddies (5 friends); Trail Famous (25 followers)

The definitions are in `server/src/achievements.js`. Each one reads a metric and unlocks at a target, so adding a new badge takes one line.

## Strava setup

1. Create an API app at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `trailing.pages.dev`. Use `localhost` for local dev.
3. Add the keys:
   - **Production:** from `server/`, run `npx wrangler secret put STRAVA_CLIENT_ID` and `npx wrangler secret put STRAVA_CLIENT_SECRET`.
   - **Local:** put them in `server/.dev.vars`.
4. Go to **Settings → Connect Strava**, or **Share → Import from Strava**.

Without the keys, everything else still works and manual logging is available.

## Trail data and adding regions

The trails live in `server/data/regions/<region-id>.json`. `scripts/build-trails-sql.mjs` compiles every region file into `seed/trails.sql`, which upserts trails by `slug`. To add a region, drop in a new JSON file and run `npm run db:trails:remote -w server`. It then shows up in Explore's region filter and in recommendations, and gets its own Halfway and Completionist achievements automatically.

Each trail has these fields: `slug, name, area, lat, lng, distance_mi, elevation_gain_ft, max_elevation_ft, route_type, features[], activities[], dogs, kid_friendly, technical, best_seasons[], surface, fee, permit, description, tips`.

You can generate a first draft of a new region from OpenStreetMap:

```bash
npm run import:osm -w server -- salt-lake-county "Salt Lake County" 40.41,-112.26,40.85,-111.55 UT
```

OSM doesn't include elevation gain, so imported trails are marked `needs_review`. Fill in elevation and descriptions, or connect an elevation API, before shipping.

**Difficulty** is computed in `server/src/difficulty.js` using the Shenandoah formula, `sqrt(gain_ft × 2 × miles)`, scaled to 1–10. Technical terrain adds +1. Every region gets rated the same way. You can override a trail's score by setting `difficulty_score` in its JSON entry.

> ⚠️ The Utah County numbers (distances, elevation, coordinates, dog rules, fees) were put together by hand and are **approximate**. Check them against USFS, the National Park Service or OpenStreetMap before a public launch.

## Trail photos (Wikimedia Commons)

62 trails have an openly licensed cover photo (CC0, public domain, CC BY or CC BY-SA) from Wikimedia Commons. The photos are hosted in R2 at `/uploads/cover-<slug>.jpg` (1280px) and `cover-<slug>-sm.jpg` (500px), and every photo shows its author and license with links. These licenses require that credit, so keep it.

Pipeline (in `server/`):
1. `node scripts/find-trail-photos.mjs [slug…]` gathers candidates from matching Commons categories, Commons search and the Wikipedia lead image. It keeps only free licenses, Utah locations and landscape photos, and writes them to `scripts/photos/candidates.json`.
2. `node scripts/photo-sheets.mjs` builds contact sheets in `scripts/photos/sheets/` for review by eye.
3. Record the chosen candidate index per trail in `scripts/photos/picks.json`.
4. `node scripts/build-trail-photos.mjs` downloads the picks and writes `data/trail-photos.json` and `seed/trail-covers.sql`.
5. `scripts/upload-trail-photos.sh --remote`, then `npx wrangler d1 execute trailing --remote --file seed/trail-covers.sql`.

The other 57 trails had no good, correctly identified free photo, so they use the generated illustration. A user-uploaded photo also replaces the illustration on the trail page.

## Cover photos (Google Places, optional)

With `GOOGLE_PLACES_API_KEY` set (Places API (New) enabled, billing on), each trail's main photo comes from its Google Maps listing. The server finds the place with Text Search near the trailhead and ignores matches more than 15 km away. It then fetches the listing's first photo and shows the photographer credit, as Google's terms require. Only the place id is stored; photo URLs are fetched fresh, and cards load them only when they scroll into view. Without the key, trails fall back to user photos and then to the generated illustration.

## Route planning services

Snapping uses the public OSRM foot router at routing.openstreetmap.de. Elevation comes from the AWS Terrain Tiles open dataset (Terrarium PNGs decoded in the Worker; about 10 m resolution in the US, no key or rate limit). Open-Meteo is the fallback. Both are called only from `server/src/routing.js`, so moving to a paid provider (Mapbox, Stadia, GraphHopper) means changing that one file.

## Turning it into an app

The client is a static React SPA. It talks to the API only through bearer tokens and an API base URL you can configure, so it can be wrapped in **Capacitor** without changing any code:

```bash
cd client
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Trailing app.trailing --web-dir dist
VITE_API_URL=https://api.your-domain.com npm run build
npx cap add ios && npx cap add android
npx cap open ios
```

What's already in place for this:
- **Token auth, not cookies.** Storage goes through `client/src/lib/storage.js`, so you can swap in `@capacitor/preferences` or a secure keychain there.
- **API base URL.** `VITE_API_URL` points the bundle at your hosted API. Upload URLs resolve through `assetUrl()`.
- **CORS.** Add CORS for the `capacitor://localhost` origin (Hono's `cors()` middleware in `server/src/index.js`) when you wrap it; on the web the app and API share an origin, so none is needed.
- **Mobile-first UI.** Bottom tab bar, safe-area insets, sheet-style modals, and a PWA manifest (it can also be installed from the browser).
- **Strava return links.** `/api/strava/connect-url?returnTo=trailing://` lets a native app receive the OAuth redirect through a deep link.

Next steps worth considering:
- add push notifications (`emitToUsers()` in `server/src/realtime.js` is the hook point)
- add Strava webhooks for automatic imports
- shard the realtime Durable Object (for example, one per user) once you have thousands of people online at the same time

## Project layout

```
server/                 Cloudflare Worker
  wrangler.jsonc        bindings: D1, R2, Durable Object, static assets
  migrations/           D1 schema migrations
  src/
    index.js            Hono app, /uploads (R2), /ws (WebSocket -> Durable Object)
    realtime.js         Realtime Durable Object + emitToUsers()
    db.js               D1 helpers
    auth.js             PBKDF2 passwords, JWT, friendship helpers
    difficulty.js       difficulty scoring
    recommend.js        recommendation engine
    achievements.js     achievement definitions + awarding
    strava.js           Strava OAuth/API client
    routes/             auth, users, trails, posts, outings, chat, strava, achievements
  data/regions/         trail data, one JSON file per region
  scripts/              build-trails-sql, build-demo-sql, import-osm
client/
  src/
    pages/              Feed, Explore, TrailDetail, ForYou, Outings, Chat, Profile, Achievements, Settings…
    components/         Layout, PostCard, TrailCard, Map (Leaflet), TrailArt, Toasts…
    lib/                api, auth, socket (WebSocket client), storage, format
```
