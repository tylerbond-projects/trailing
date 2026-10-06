const toRad = (d) => (d * Math.PI) / 180;
export function haversineM([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

/** Point at `d` metres along a path (for linking the elevation chart to the map). */
export function pointAtDistance(path, d) {
  if (!path?.length) return null;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineM(path[i - 1], path[i]);
    if (acc + seg >= d) {
      const t = seg ? (d - acc) / seg : 0;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    acc += seg;
  }
  return path[path.length - 1];
}

/** Ask the browser for the viewer's location (resolves null if denied/unavailable). */
export function locate({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 600000 },
    );
  });
}

export const UTAH_CENTER = [39.5, -111.6];

/** True if the viewer already allowed location (no prompt will be shown). */
export async function locationGranted() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch { return false; }
}

/** Zoom that shows roughly the nearest 20–30 miles, slightly closer on phones. */
export const nearbyZoom = () => (window.innerWidth < 600 ? 9.5 : 10);
