import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapUX, MapControls } from './MapControls.jsx';
import { nearbyZoom } from '../lib/geo.js';

const COLORS = { Easy: '#3f8f5b', Moderate: '#c9a227', Hard: '#e07a3f', 'Very Hard': '#c4452f', Strenuous: '#7d2e46' };

function pin(trail) {
  const c = COLORS[trail.difficulty_label] || '#2f6b4f';
  return L.divIcon({
    className: 'map-pin',
    html: `<span style="background:${c}">${trail.difficulty_score ?? ''}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Leaflet map of trails. Clicking a pin opens the trail. */
export default function TrailMap({ trails, center, zoom = 10, height = 420, lockOnTouch = false, userLocation, onLocate }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const wrap = useRef(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const touchLocked = lockOnTouch && L.Browser.mobile;
  const ux = useMapUX(map, wrap, { touchLocked, ready });
  const bounds = useRef(null);
  const you = useRef(null);

  useEffect(() => {
    // lockOnTouch: embedded maps on phones ignore one-finger drags so the page can scroll past them
    // (pinch still zooms, and full screen unlocks everything).
    map.current = L.map(el.current, { zoomControl: false, zoomSnap: 0.5, scrollWheelZoom: false, dragging: !touchLocked, tap: !touchLocked })
      .setView(center || [39.5, -111.6], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    setReady(true);
    return () => map.current.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layer.current.clearLayers();
    const pts = [];
    for (const t of trails) {
      if (t.lat == null) continue;
      pts.push([t.lat, t.lng]);
      const m = L.marker([t.lat, t.lng], { icon: pin(t), title: t.name }).addTo(layer.current);
      if (t.slug) {
        m.bindTooltip(`<strong>${t.name}</strong><br>${t.distance_mi} mi · ${t.difficulty_label}`);
        m.on('click', () => navigate(`/trails/${t.slug}`));
      }
    }
    bounds.current = pts;
    if (pts.length > 1 && !center && !userLocation) map.current.fitBounds(pts, { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails, center, navigate]);

  // Start near the viewer when we know where they are.
  useEffect(() => {
    if (!ready || !userLocation) return;
    you.current?.remove();
    you.current = L.circleMarker(userLocation, { radius: 8, className: 'you-dot', interactive: false }).addTo(map.current);
    map.current.setView(userLocation, nearbyZoom());
  }, [ready, userLocation]);

  const fit = () => {
    const pts = bounds.current || [];
    if (pts.length > 1) map.current.fitBounds(pts, { padding: [30, 30] });
    else map.current.setView(center || pts[0] || [39.5, -111.6], zoom);
  };

  return (
    <div ref={wrap} className={`map-wrap ${ux.fullscreen ? 'map-fullscreen' : ''}`} style={{ height }}>
      <div ref={el} className="map" />
      {ready && <MapControls mapRef={map} ux={ux} onFit={fit} fitLabel={trails.length > 1 ? 'Show all trails' : 'Back to trailhead'}
        onLocate={onLocate || (userLocation ? () => map.current.setView(userLocation, nearbyZoom()) : null)} />}
    </div>
  );
}
