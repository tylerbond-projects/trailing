// Server timestamps are UTC "YYYY-MM-DD HH:MM:SS" (no zone) or full ISO strings.
export function parseDate(s) {
  if (!s) return null;
  if (/Z$|[+-]\d\d:\d\d$/.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}
// Activity start times are already in the athlete's local time.
export const parseLocal = (s) => (s ? new Date(s.replace(' ', 'T').replace(/Z$/, '')) : null);

export function timeAgo(s) {
  const d = parseDate(s);
  const secs = (Date.now() - d) / 1000;
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const miles = (n) => `${Number(n).toFixed(n >= 100 ? 0 : 1)} mi`;
export const feet = (n) => `${Math.round(n).toLocaleString()} ft`;

export function duration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
export const durationMin = (min) => duration(min * 60);

export function pace(distanceMi, seconds) {
  if (!distanceMi || !seconds) return null;
  const spm = seconds / distanceMi;
  return `${Math.floor(spm / 60)}:${String(Math.round(spm % 60)).padStart(2, '0')} /mi`;
}

export function eventDate(iso) {
  const d = parseDate(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const ACTIVITY_LABEL = { Hike: 'Hike', Run: 'Run', TrailRun: 'Trail run', Walk: 'Walk' };
export const ACTIVITY_ICON = { Hike: 'boot', Run: 'run', TrailRun: 'mountain', Walk: 'walk' };

export const FEATURES = {
  summit: { icon: 'flag', label: 'Summit' },
  views: { icon: 'binoculars', label: 'Views' },
  'city-views': { icon: 'buildings', label: 'City views' },
  waterfall: { icon: 'waterfall', label: 'Waterfall' },
  lake: { icon: 'lake', label: 'Lake' },
  river: { icon: 'waves', label: 'River' },
  wildflowers: { icon: 'flower', label: 'Wildflowers' },
  'fall-colors': { icon: 'leaf', label: 'Fall colors' },
  wildlife: { icon: 'paw', label: 'Wildlife' },
  cave: { icon: 'cave', label: 'Cave' },
  'hot-springs': { icon: 'steam', label: 'Hot springs' },
  canyon: { icon: 'canyon', label: 'Canyon' },
  shade: { icon: 'tree', label: 'Shade' },
  solitude: { icon: 'moon', label: 'Solitude' },
  accessible: { icon: 'accessible', label: 'Accessible' },
  climbing: { icon: 'carabiner', label: 'Climbing' },
  arch: { icon: 'arch', label: 'Arch' },
  history: { icon: 'history', label: 'History' },
};
export const featureLabel = (f) => FEATURES[f]?.label || f;

export const metersToMiles = (m) => m / 1609.344;
export const metersToFeet = (m) => m * 3.28084;
