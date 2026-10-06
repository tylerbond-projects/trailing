import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
export default function TrailMap({ trails, center, zoom = 10, height = 420 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView(center || [40.3, -111.68], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
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
    if (pts.length > 1 && !center) map.current.fitBounds(pts, { padding: [30, 30] });
  }, [trails, center, navigate]);

  return <div ref={el} className="map" style={{ height }} />;
}
