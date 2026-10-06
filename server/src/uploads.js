const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic', 'image/heif': '.heif' };
const MAX_BYTES = 10 * 1024 * 1024;

/** Pull image File objects for `field` out of a parsed multipart body. */
export function filesFrom(body, field, max = 8) {
  const v = body[field] ?? body[`${field}[]`];
  const list = (Array.isArray(v) ? v : v ? [v] : []).filter((f) => typeof f === 'object' && f && 'arrayBuffer' in f);
  return list.filter((f) => TYPES[f.type] && f.size <= MAX_BYTES).slice(0, max);
}

/** Store an image in R2 and return its public path (served by GET /uploads/:key). */
export async function storePhoto(env, file) {
  const key = crypto.randomUUID() + TYPES[file.type];
  await env.PHOTOS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return `/uploads/${key}`;
}

/** Normalise parseBody() string fields (it can return arrays for repeated keys). */
export const field = (body, k) => (Array.isArray(body[k]) ? body[k][0] : body[k]);
