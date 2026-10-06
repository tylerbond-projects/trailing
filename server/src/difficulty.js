// Difficulty model shared by every region so new data is rated consistently.
// Based on the Shenandoah National Park hiking difficulty formula:
//   rating = sqrt(elevationGainFt * 2 * distanceMi)
// mapped onto a 1–10 score. Technical routes (scrambling, talus) get +1.

export const DIFFICULTY_LABELS = [
  { max: 2, label: 'Easy' },
  { max: 4, label: 'Moderate' },
  { max: 6, label: 'Hard' },
  { max: 8, label: 'Very Hard' },
  { max: 10, label: 'Strenuous' },
];

export function difficultyScore({ distance_mi, elevation_gain_ft, technical }) {
  const raw = Math.sqrt(Math.max(elevation_gain_ft, 0) * 2 * Math.max(distance_mi, 0));
  let score = Math.round(raw / 25);
  if (technical) score += 1;
  return Math.min(10, Math.max(1, score));
}

export function difficultyLabel(score) {
  return DIFFICULTY_LABELS.find((d) => score <= d.max).label;
}

// Naismith's rule: 3 mph on the flat + 1 hour per 2,000 ft of climbing.
export function estimatedMinutes({ distance_mi, elevation_gain_ft }) {
  return Math.round((distance_mi / 3 + elevation_gain_ft / 2000) * 60);
}
