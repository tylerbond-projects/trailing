import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Trail cover photos come from Google Places via our API. Results are kept in
// memory for the session (not persisted) and only fetched when visible.
const cache = new Map();

export function useCover(slug, { lazy = false, width = 1200 } = {}) {
  const key = `${slug}:${width}`;
  const [cover, setCover] = useState(cache.get(key));
  const ref = useRef(null);

  useEffect(() => {
    if (!slug || cache.has(key)) { setCover(cache.get(key)); return; }
    let alive = true;
    const load = () => {
      const p = cache.get(key) instanceof Promise ? cache.get(key)
        : api(`/trails/${slug}/cover?w=${width}`).then((d) => d.cover).catch(() => null);
      cache.set(key, p);
      p.then((c) => { cache.set(key, c); if (alive) setCover(c); });
    };
    if (!lazy || !ref.current || !('IntersectionObserver' in window)) { load(); return () => { alive = false; }; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => { alive = false; io.disconnect(); };
  }, [slug, key, lazy, width]);

  return [cover instanceof Promise ? undefined : cover, ref];
}

export function Attribution({ cover, className = '' }) {
  if (!cover?.attribution) return null;
  const { name, url } = cover.attribution;
  return (
    <span className={`photo-credit ${className}`}>
      Photo: {url ? <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{name}</a> : name} · Google
    </span>
  );
}
