# Trailing

A social app for hikers and runners. Follow people, post hikes and runs (logged by hand or imported from Strava), chat with friends, plan group hikes that come with their own group chat, get trail recommendations, review and photograph trails, and earn achievements.

The first region is **Utah County, UT** (39 trails). The data is set up so more regions can be added.

## Stack

Everything runs on **Cloudflare**:

| Piece | Service |
|---|---|
| Web app (React + Vite) | Workers static assets |
| API (Hono) | Workers |
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
npm run deploy          # builds the client, then deploys the Worker and assets
```

Database changes go out as migrations in `server/migrations/`, applied with:

```bash
npm run db:migrate:remote -w server
```

Demo users (log in as `demo` / `password123`) can be added or refreshed with `npm run db:demo:remote -w server`. This only replaces demo accounts; real users are never touched.

Trail data changes go out with:

```bash
npm run db:trails:remote -w server
```

Secrets are set with `npx wrangler secret put <NAME>` from `server/`. The secrets are `JWT_SECRET`, `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.

## Features

| Area | What it does |
|---|---|
| **Accounts and social** | Sign up as a hiker, runner or both, and set a preferred difficulty. Follow people. Two people who follow each other are **friends**. |
| **Feed** | Posts from you and the people you follow, with distance, elevation, time, pace, the trail, and photos. You can like and comment. |
| **Strava** | OAuth connection. Lists your recent hikes, runs and walks, matches each to a trail by its GPS start point, and imports it as a post. |
| **Chat** | Realtime 1:1 chat (WebSockets on a Durable Object). Only friends can message each other. Shows unread counts and typing indicators. |
| **Group hikes** | Pick a trail and a time. Make it **public** (anyone can see and join) or **friends only**. Joining puts you in a group chat with everyone going. Supports group size limits and pace. |
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
2. Set **Authorization Callback Domain** to your site's domain, for example `trailing.<you>.workers.dev`. Use `localhost` for local dev.
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
