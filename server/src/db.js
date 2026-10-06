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
export function parseTrail(row) {
  if (!row) return row;
  const t = { ...row };
  for (const c of JSON_COLS) if (typeof t[c] === 'string') t[c] = JSON.parse(t[c]);
  if (t.kid_friendly != null) t.kid_friendly = !!t.kid_friendly;
  t.technical = !!t.technical;
  return t;
}

export const placeholders = (arr) => arr.map(() => '?').join(',');
