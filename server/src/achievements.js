import { emitToUsers } from './realtime.js';

const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

// Each achievement reads one metric from userStats() and unlocks at `target`.
// tier: bronze | silver | gold | platinum (purely cosmetic).
const STATIC_ACHIEVEMENTS = [
  // Getting started
  { id: 'first-steps', name: 'First Steps', icon: '👣', category: 'Milestones', tier: 'bronze', metric: 'activities', target: 1, description: 'Log your first hike or run.' },
  { id: 'regular', name: 'Trail Regular', icon: '🥾', category: 'Milestones', tier: 'silver', metric: 'activities', target: 25, description: 'Log 25 activities.' },
  { id: 'centurion', name: 'Centurion', icon: '💯', category: 'Milestones', tier: 'gold', metric: 'activities', target: 100, description: 'Log 100 activities.' },

  // Distance
  { id: 'miles-10', name: 'Double Digits', icon: '📏', category: 'Distance', tier: 'bronze', metric: 'totalMiles', target: 10, description: 'Cover 10 total miles.' },
  { id: 'miles-100', name: 'Century Club', icon: '🧭', category: 'Distance', tier: 'silver', metric: 'totalMiles', target: 100, description: 'Cover 100 total miles.' },
  { id: 'miles-500', name: 'Long Hauler', icon: '🗺️', category: 'Distance', tier: 'gold', metric: 'totalMiles', target: 500, description: 'Cover 500 total miles.' },
  { id: 'miles-1000', name: 'Thousand Miler', icon: '🌎', category: 'Distance', tier: 'platinum', metric: 'totalMiles', target: 1000, description: 'Cover 1,000 total miles.' },
  { id: 'big-day', name: 'Big Day Out', icon: '☀️', category: 'Distance', tier: 'silver', metric: 'longestHikeMi', target: 10, description: 'Complete a single hike of 10+ miles.' },

  // Elevation
  { id: 'climb-10k', name: 'Ten Thousand Feet', icon: '⛰️', category: 'Elevation', tier: 'bronze', metric: 'totalElevationFt', target: 10000, description: 'Climb 10,000 ft in total.' },
  { id: 'everest', name: 'Everesting', icon: '🏔️', category: 'Elevation', tier: 'gold', metric: 'totalElevationFt', target: 29032, description: 'Climb the height of Mount Everest (29,032 ft) in total.' },
  { id: 'vertical-mile', name: 'Vertical Mile', icon: '🧗', category: 'Elevation', tier: 'gold', metric: 'maxGainFt', target: 5280, description: 'Gain 5,280 ft in a single activity.' },

  // Running
  { id: 'first-5k', name: '5K Finisher', icon: '🏃', category: 'Running', tier: 'bronze', metric: 'longestRunMi', target: 3.1, description: 'Complete a run of at least 5 km.' },
  { id: 'ten-k', name: '10K Strong', icon: '🏃‍♀️', category: 'Running', tier: 'bronze', metric: 'longestRunMi', target: 6.2, description: 'Complete a run of at least 10 km.' },
  { id: 'half-marathon', name: 'Half Marathoner', icon: '🥈', category: 'Running', tier: 'silver', metric: 'longestRunMi', target: 13.1, description: 'Run 13.1 miles in one go.' },
  { id: 'marathon', name: 'Marathoner', icon: '🥇', category: 'Running', tier: 'gold', metric: 'longestRunMi', target: 26.2, description: 'Run 26.2 miles in one go.' },
  { id: 'ultra', name: 'Ultra', icon: '🔥', category: 'Running', tier: 'platinum', metric: 'longestRunMi', target: 31, description: 'Run 50 km or more in one go.' },

  // Exploration
  { id: 'explorer-5', name: 'Explorer', icon: '🧭', category: 'Exploration', tier: 'bronze', metric: 'uniqueTrails', target: 5, description: 'Complete 5 different trails.' },
  { id: 'explorer-15', name: 'Pathfinder', icon: '🗺️', category: 'Exploration', tier: 'silver', metric: 'uniqueTrails', target: 15, description: 'Complete 15 different trails.' },
  { id: 'peak-bagger', name: 'Peak Bagger', icon: '🚩', category: 'Exploration', tier: 'silver', metric: 'summitTrails', target: 3, description: 'Reach 3 different summits.' },
  { id: 'summit-collector', name: 'Summit Collector', icon: '👑', category: 'Exploration', tier: 'gold', metric: 'summitTrails', target: 10, description: 'Reach 10 different summits.' },
  { id: 'timp', name: 'King of Timp', icon: '🏔️', category: 'Exploration', tier: 'gold', metric: 'timp', target: 1, description: 'Summit Mount Timpanogos by any route.' },
  { id: 'waterfalls', name: 'Chasing Waterfalls', icon: '💦', category: 'Exploration', tier: 'silver', metric: 'waterfallTrails', target: 5, description: 'Visit 5 trails with waterfalls.' },
  { id: 'lakes', name: 'Lake Hopper', icon: '🏞️', category: 'Exploration', tier: 'silver', metric: 'lakeTrails', target: 3, description: 'Visit 3 trails with alpine lakes.' },
  { id: 'hot-springs', name: 'Soak It In', icon: '♨️', category: 'Exploration', tier: 'bronze', metric: 'hotSpringTrails', target: 1, description: 'Hike to a hot spring.' },

  // Habits
  { id: 'early-bird', name: 'Early Bird', icon: '🌅', category: 'Habits', tier: 'bronze', metric: 'earlyStarts', target: 1, description: 'Start an activity before 6 AM.' },
  { id: 'dawn-patrol', name: 'Dawn Patrol', icon: '🌄', category: 'Habits', tier: 'silver', metric: 'earlyStarts', target: 10, description: 'Start 10 activities before 6 AM.' },
  { id: 'four-seasons', name: 'Four Seasons', icon: '🍂', category: 'Habits', tier: 'gold', metric: 'seasons', target: 4, description: 'Get out in spring, summer, fall and winter.' },

  // Community
  { id: 'critic', name: 'Trail Critic', icon: '✍️', category: 'Community', tier: 'bronze', metric: 'reviews', target: 5, description: 'Review 5 trails.' },
  { id: 'guidebook', name: 'Walking Guidebook', icon: '📚', category: 'Community', tier: 'gold', metric: 'reviews', target: 25, description: 'Review 25 trails.' },
  { id: 'shutterbug', name: 'Shutterbug', icon: '📸', category: 'Community', tier: 'bronze', metric: 'photos', target: 10, description: 'Upload 10 photos.' },
  { id: 'trail-leader', name: 'Trail Leader', icon: '🎒', category: 'Community', tier: 'bronze', metric: 'hosted', target: 1, description: 'Plan a group hike.' },
  { id: 'pack-leader', name: 'Pack Leader', icon: '🐺', category: 'Community', tier: 'gold', metric: 'hosted', target: 10, description: 'Plan 10 group hikes.' },
  { id: 'tag-along', name: 'Tag Along', icon: '🤝', category: 'Community', tier: 'bronze', metric: 'joined', target: 1, description: "Join someone else's planned hike." },
  { id: 'social', name: 'Trail Buddies', icon: '👋', category: 'Community', tier: 'bronze', metric: 'friends', target: 5, description: 'Make 5 friends (mutual follows).' },
  { id: 'popular', name: 'Trail Famous', icon: '⭐', category: 'Community', tier: 'silver', metric: 'followers', target: 25, description: 'Get 25 followers.' },
];

// One "completionist" pair per region, so adding a region automatically
// adds new achievements.
export async function allAchievements(db) {
  const regions = await db.all(`
    SELECT r.id, r.name, COUNT(t.id) AS n FROM regions r JOIN trails t ON t.region_id = r.id GROUP BY r.id`);
  const regional = regions.flatMap((r) => [
    { id: `region-half:${r.id}`, name: `${r.name} Halfway`, icon: '🧩', category: 'Exploration', tier: 'gold', metric: `region:${r.id}`, target: Math.ceil(r.n / 2), description: `Complete half of the trails in ${r.name}.` },
    { id: `region-all:${r.id}`, name: `${r.name} Completionist`, icon: '🏆', category: 'Exploration', tier: 'platinum', metric: `region:${r.id}`, target: r.n, description: `Complete every trail in ${r.name}.` },
  ]);
  return [...STATIC_ACHIEVEMENTS, ...regional];
}

export async function userStats(db, userId) {
  const n = (sql, ...p) => db.stmt(sql, ...p);
  const [a, trailRows, reviews, photos, hosted, joined, followers, friends] = (await db.batch([
    n(`SELECT COUNT(*) AS activities,
        COALESCE(SUM(distance_m),0) AS dist, COALESCE(SUM(elevation_gain_m),0) AS gain,
        COALESCE(MAX(elevation_gain_m),0) AS maxGain,
        COALESCE(MAX(CASE WHEN type IN ('Run','TrailRun') THEN distance_m END),0) AS longestRun,
        COALESCE(MAX(CASE WHEN type IN ('Hike','Walk') THEN distance_m END),0) AS longestHike,
        COALESCE(SUM(CASE WHEN CAST(substr(start_date,12,2) AS INTEGER) < 6 THEN 1 ELSE 0 END),0) AS earlyStarts,
        COUNT(DISTINCT CASE
          WHEN CAST(substr(start_date,6,2) AS INTEGER) IN (3,4,5) THEN 'spring'
          WHEN CAST(substr(start_date,6,2) AS INTEGER) IN (6,7,8) THEN 'summer'
          WHEN CAST(substr(start_date,6,2) AS INTEGER) IN (9,10,11) THEN 'fall'
          ELSE 'winter' END) AS seasons
      FROM activities WHERE user_id = ?`, userId),
    n(`SELECT DISTINCT t.id, t.slug, t.region_id, t.features FROM activities a JOIN trails t ON t.id = a.trail_id WHERE a.user_id = ?`, userId),
    n('SELECT COUNT(*) n FROM trail_reviews WHERE user_id = ?', userId),
    n(`SELECT (SELECT COUNT(*) FROM trail_photos WHERE user_id = ?1) +
      (SELECT COUNT(*) FROM post_photos pp JOIN posts p ON p.id = pp.post_id WHERE p.user_id = ?1) AS n`, userId),
    n('SELECT COUNT(*) n FROM outings WHERE host_id = ? AND cancelled = 0', userId),
    n(`SELECT COUNT(*) n FROM outing_members m JOIN outings o ON o.id = m.outing_id
      WHERE m.user_id = ?1 AND o.host_id != ?1 AND o.cancelled = 0`, userId),
    n('SELECT COUNT(*) n FROM follows WHERE followee_id = ?', userId),
    n(`SELECT COUNT(*) n FROM follows f1 JOIN follows f2
      ON f1.followee_id = f2.follower_id AND f2.followee_id = f1.follower_id WHERE f1.follower_id = ?`, userId),
  ])).map((r) => r.results);

  const s = a[0];
  const hasFeature = (f) => trailRows.filter((t) => JSON.parse(t.features).includes(f)).length;
  const stats = {
    activities: s.activities,
    totalMiles: s.dist / M_PER_MI,
    totalElevationFt: s.gain * FT_PER_M,
    maxGainFt: s.maxGain * FT_PER_M,
    longestRunMi: s.longestRun / M_PER_MI,
    longestHikeMi: s.longestHike / M_PER_MI,
    earlyStarts: s.earlyStarts,
    seasons: s.activities ? s.seasons : 0,
    uniqueTrails: trailRows.length,
    summitTrails: hasFeature('summit'),
    waterfallTrails: hasFeature('waterfall'),
    lakeTrails: hasFeature('lake'),
    hotSpringTrails: hasFeature('hot-springs'),
    timp: trailRows.some((t) => t.slug.startsWith('mount-timpanogos')) ? 1 : 0,
    reviews: reviews[0].n,
    photos: photos[0].n,
    hosted: hosted[0].n,
    joined: joined[0].n,
    followers: followers[0].n,
    friends: friends[0].n,
  };
  for (const t of trailRows) stats[`region:${t.region_id}`] = (stats[`region:${t.region_id}`] || 0) + 1;
  return stats;
}

/** All achievements with the user's progress. */
export async function achievementsFor(db, userId) {
  const [stats, defs, rows] = await Promise.all([
    userStats(db, userId), allAchievements(db),
    db.all('SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?', userId),
  ]);
  const earned = new Map(rows.map((r) => [r.achievement_id, r.earned_at]));
  return defs.map((ach) => ({
    ...ach,
    current: Math.round(Math.min(stats[ach.metric] || 0, ach.target) * 10) / 10,
    earned_at: earned.get(ach.id) || null,
  }));
}

/**
 * Re-evaluate a user's achievements and award any newly reached ones.
 * Pushes a realtime event so the client can celebrate.
 */
export async function checkAchievements(c, userId) {
  const db = c.get('db');
  const [stats, defs, rows] = await Promise.all([
    userStats(db, userId), allAchievements(db),
    db.all('SELECT achievement_id FROM user_achievements WHERE user_id = ?', userId),
  ]);
  const have = new Set(rows.map((r) => r.achievement_id));
  const fresh = defs.filter((ach) => !have.has(ach.id) && (stats[ach.metric] || 0) >= ach.target);
  if (fresh.length) {
    await db.batch(fresh.map((ach) => db.stmt('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', userId, ach.id)));
    emitToUsers(c, [userId], 'achievements', fresh);
  }
  return fresh;
}
