import { useEffect, useRef, useState } from 'react';
import { api, assetUrl } from './api.js';

// Trail covers come from two places:
//  1. trail.cover — an openly licensed photo (Wikimedia Commons) we host, sent with the trail.
//  2. Google Places (only if the server has a key) — fetched lazily, never stored.
const cache = new Map();

export function useCover(trail, { lazy = false, width = 1200 } = {}) {
  const own = trail?.cover;
  const slug = own ? null : trail?.slug;
  const key = `${slug}:${width}`;
  const [google, setGoogle] = useState(cache.get(key));
  const ref = useRef(null);

  useEffect(() => {
    if (!slug) return;
    if (cache.has(key)) { const v = cache.get(key); if (!(v instanceof Promise)) setGoogle(v); else v.then(setGoogle); return; }
    let alive = true;
    const load = () => {
      const p = api(`/trails/${slug}/cover?w=${width}`).then((d) => d.cover).catch(() => null);
      cache.set(key, p);
      p.then((c) => { cache.set(key, c); if (alive) setGoogle(c); });
    };
    if (!lazy || !ref.current || !('IntersectionObserver' in window)) { load(); return () => { alive = false; }; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => { alive = false; io.disconnect(); };
  }, [slug, key, lazy, width]);

  if (own) {
    return [{
      url: assetUrl(width <= 700 ? own.url_small : own.url),
      credit: { name: own.author, url: own.source_url, license: own.license, license_url: own.license_url, via: 'Wikimedia Commons' },
    }, ref];
  }
  const g = google instanceof Promise ? undefined : google;
  return [g?.url ? { url: g.url, credit: g.attribution ? { name: g.attribution.name, url: g.attribution.url, via: 'Google' } : null } : null, ref];
}

/** Photo credit shown on top of a cover image (required by the photo licenses). */
export function Attribution({ cover, className = '', compact = false }) {
  const c = cover?.credit;
  if (!c) return null;
  // Compact credits sit inside clickable cards, so they're plain text (no nested links);
  // the trail page shows the full credit with links to the photo and license.
  const link = (href, text) => (!compact && href ? <a href={href} target="_blank" rel="noreferrer">{text}</a> : text);
  return (
    <span className={`photo-credit ${className}`}>
      {compact ? '© ' : 'Photo: '}
      {link(c.url, c.name || 'Unknown')}
      {c.license && <> · {link(c.license_url, c.license)}</>}
      {!compact && c.via && <> · {c.via}</>}
    </span>
  );
}
