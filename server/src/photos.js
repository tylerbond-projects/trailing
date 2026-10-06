// Trail cover photos from Google Places (the main photo on a place's Google
// Maps listing). Requires GOOGLE_PLACES_API_KEY with the Places API (New)
// enabled. Per Google's terms only the place id is stored; photo URLs are
// fetched fresh and must be shown with the author attribution.
const PLACES = 'https://places.googleapis.com/v1';
const NO_MATCH = '-';
const MAX_MATCH_KM = 15;

function km([a, b], [c, d]) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function places(env, path, { method = 'GET', body, fields }) {
  const res = await fetch(`${PLACES}${path}`, {
    method,
    headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fields, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function findPlace(env, t) {
  const data = await places(env, '/places:searchText', {
    method: 'POST',
    fields: 'places.id,places.location,places.photos,places.googleMapsUri',
    body: {
      textQuery: `${t.name} ${t.area || ''} Utah`,
      locationBias: { circle: { center: { latitude: t.lat, longitude: t.lng }, radius: 10000 } },
      maxResultCount: 1,
    },
  });
  const p = data.places?.[0];
  if (!p || km([t.lat, t.lng], [p.location.latitude, p.location.longitude]) > MAX_MATCH_KM) return null;
  return p;
}

export async function trailCover(env, db, t, width = 1200) {
  if (!env.GOOGLE_PLACES_API_KEY || t.google_place_id === NO_MATCH) return null;
  try {
    let place;
    if (t.google_place_id) {
      place = await places(env, `/places/${t.google_place_id}`, { fields: 'id,photos,googleMapsUri' });
    } else {
      place = await findPlace(env, t);
      await db.run('UPDATE trails SET google_place_id = ? WHERE id = ?', place?.id || NO_MATCH, t.id);
    }
    const photo = place?.photos?.[0];
    if (!photo) return null;
    const w = Math.min(1600, Math.max(200, width));
    const media = await places(env, `/${photo.name}/media?maxWidthPx=${w}&skipHttpRedirect=true`, { fields: '*' });
    const author = photo.authorAttributions?.[0];
    return {
      url: media.photoUri,
      attribution: author ? { name: author.displayName, url: author.uri } : null,
      maps_url: place.googleMapsUri || null,
    };
  } catch (e) {
    console.error('cover photo', t.slug, e.message);
    return null;
  }
}
