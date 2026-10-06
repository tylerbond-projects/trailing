import { parseTrail, placeholders } from './db.js';
import { friendIds } from './auth.js';

const SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
export const currentSeason = (d = new Date()) => SEASONS[d.getMonth()];

/**
 * Content-based + social recommendations.
 *
 * Builds a taste profile from what the user has done, saved and rated, then
 * scores every trail they haven't done yet. Each component contributes a
 * human-readable reason so the UI can explain *why* a trail was suggested.
 */
export async function recommendTrails(db, user, { limit = 20 } = {}) {
  const [trailRows, doneRows, savedRows, ratingRows, friends, upcomingRows] = await Promise.all([
    db.all(`SELECT t.*, COALESCE(AVG(r.rating), 0) AS avg_rating, COUNT(r.id) AS review_count
      FROM trails t LEFT JOIN trail_reviews r ON r.trail_id = t.id GROUP BY t.id`),
    db.all('SELECT DISTINCT trail_id FROM activities WHERE user_id = ? AND trail_id IS NOT NULL', user.id),
    db.all('SELECT trail_id FROM saved_trails WHERE user_id = ?', user.id),
    db.all('SELECT trail_id, rating FROM trail_reviews WHERE user_id = ?', user.id),
    friendIds(db, user.id),
    db.all(`SELECT trail_id, COUNT(*) n FROM outings WHERE visibility = 'public' AND cancelled = 0 AND starts_at > ? GROUP BY trail_id`, new Date().toISOString()),
  ]);
  const trails = trailRows.map(parseTrail);
  const done = new Set(doneRows.map((r) => r.trail_id));
  const saved = new Set(savedRows.map((r) => r.trail_id));
  const myRatings = new Map(ratingRows.map((r) => [r.trail_id, r.rating]));
  const upcoming = new Map(upcomingRows.map((r) => [r.trail_id, r.n]));
  const byId = new Map(trails.map((t) => [t.id, t]));

  // --- Taste profile ---------------------------------------------------------
  const featureWeight = {};
  const addFeatures = (t, w) => { for (const f of t.features) featureWeight[f] = (featureWeight[f] || 0) + w; };
  const signals = [];
  for (const id of done) { const t = byId.get(id); if (t) { addFeatures(t, 1); signals.push(t); } }
  for (const id of saved) { const t = byId.get(id); if (t) addFeatures(t, 0.75); }
  for (const [id, rating] of myRatings) { const t = byId.get(id); if (t) addFeatures(t, (rating - 3) * 0.8); }

  // Preferred difficulty: blend the user's stated preference with what they actually do.
  const doneScores = signals.map((t) => t.difficulty_score);
  const targetDifficulty = doneScores.length
    ? (user.preferred_difficulty + doneScores.reduce((a, b) => a + b, 0) / doneScores.length) / 2
    : user.preferred_difficulty;

  const friendDone = new Map();
  if (friends.length) {
    for (const r of await db.all(`SELECT trail_id, COUNT(DISTINCT user_id) n FROM activities
      WHERE user_id IN (${placeholders(friends)}) AND trail_id IS NOT NULL GROUP BY trail_id`, ...friends)) friendDone.set(r.trail_id, r.n);
  }

  const season = currentSeason();
  const topFeatures = Object.entries(featureWeight).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);
  const maxFeatureWeight = Math.max(1, ...Object.values(featureWeight));
  const wantsRunning = user.activity_type === 'runner';

  // --- Score -------------------------------------------------------------------
  const scored = trails.filter((t) => !done.has(t.id)).map((t) => {
    let score = 0;
    const reasons = [];

    const featureMatch = t.features.reduce((s, f) => s + (featureWeight[f] || 0), 0) / maxFeatureWeight;
    score += featureMatch * 2;
    const shared = t.features.filter((f) => topFeatures.includes(f));
    if (shared.length && featureMatch > 0.5) reasons.push(`You enjoy ${shared.slice(0, 2).map(pretty).join(' & ')}`);

    const diffGap = Math.abs(t.difficulty_score - targetDifficulty);
    score += Math.max(0, 3 - diffGap);
    if (diffGap <= 1) reasons.push('Matches your usual difficulty');
    else if (t.difficulty_score - targetDifficulty > 1 && t.difficulty_score - targetDifficulty <= 2.5) {
      score += 0.5; reasons.push('A step up from your usual — good next challenge');
    }

    if (t.best_seasons.includes(season)) { score += 1.5; reasons.push(`Great in ${season}`); }
    else score -= 1;

    // Bayesian average so a single 5-star review doesn't dominate.
    const bayes = (t.avg_rating * t.review_count + 3.8 * 3) / (t.review_count + 3);
    score += (bayes - 3) * 1.2;
    if (t.review_count >= 2 && t.avg_rating >= 4.5) reasons.push(`Rated ${t.avg_rating.toFixed(1)}★ by hikers`);

    const fd = friendDone.get(t.id) || 0;
    if (fd) { score += Math.min(fd, 3) * 0.8; reasons.push(`${fd} friend${fd > 1 ? 's have' : ' has'} done this`); }

    if (upcoming.get(t.id)) { score += 0.7; reasons.push('Group hike planned soon'); }
    if (saved.has(t.id)) { score += 1; reasons.push('On your saved list'); }

    if (wantsRunning) {
      if (t.activities.includes('run') || t.activities.includes('trail-run')) { score += 1.5; reasons.push('Good for running'); }
      else score -= 1;
    }

    return { ...t, score: Math.round(score * 100) / 100, reasons: reasons.slice(0, 3) };
  });

  scored.sort((a, b) => b.score - a.score);
  return { profile: { targetDifficulty: Math.round(targetDifficulty * 10) / 10, topFeatures, season }, trails: scored.slice(0, limit) };
}

const pretty = (f) => f.replace(/-/g, ' ') + (['waterfall', 'lake', 'summit', 'river', 'canyon'].includes(f) ? 's' : '');
