// Small async helpers over Cloudflare D1.
// D1 rejects `undefined` bindings, so they are normalised to null.
const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

export function makeDb(d1) {
  const stmt = (sql, ...p) => d1.prepare(sql).bind(...clean(p));
  return {
    stmt,
    all: async (sql, ...p) => (await stmt(sql, ...p).all()).results,
    first: (sql, ...p) => stmt(sql, ...p).first(),
    run: (sql, ...p) => stmt(sql, ...p).run(),
    /** Insert and return the new row id. */
    insert: async (sql, ...p) => (await stmt(sql, ...p).run()).meta.last_row_id,
    /** Run several statements atomically. */
    batch: (stmts) => d1.batch(stmts),
  };
}

const JSON_COLS = ['features', 'activities', 'best_seasons'];
/** Columns to SELECT (with `LEFT JOIN trail_covers c ON c.trail_id = t.id`) for a trail's cover photo. */
export const COVER_COLS = 'c.url AS cover_url, c.url_small AS cover_small, c.author AS cover_author, c.license AS cover_license, c.license_url AS cover_license_url, c.source_url AS cover_source';

export function parseTrail(row) {
  if (!row) return row;
  const t = { ...row };
  if ('cover_url' in t) {
    t.cover = t.cover_url ? { url: t.cover_url, url_small: t.cover_small, author: t.cover_author, license: t.cover_license,
      license_url: t.cover_license_url, source_url: t.cover_source } : null;
    for (const k of ['cover_url', 'cover_small', 'cover_author', 'cover_license', 'cover_license_url', 'cover_source']) delete t[k];
  }
  for (const c of JSON_COLS) if (typeof t[c] === 'string') t[c] = JSON.parse(t[c]);
  if (t.kid_friendly != null) t.kid_friendly = !!t.kid_friendly;
  t.technical = !!t.technical;
  return t;
}

export const placeholders = (arr) => arr.map(() => '?').join(',');
