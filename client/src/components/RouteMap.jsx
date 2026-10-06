import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UTAH_CENTER } from '../lib/geo.js';
import { useMapUX, MapControls } from './MapControls.jsx';

const pinIcon = (label, kind) => L.divIcon({
  className: 'route-pin',
  html: `<span class="${kind}">${label}</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/**
 * Map for drawing/viewing a route.
 *  editable: tap the map to add a point; drag points to move; tap a point to remove it.
 */
export default function RouteMap({ path = [], waypoints = [], editable = false, onAdd, onMove, onRemove, highlight, center, height = 420, fitKey, lockOnTouch = false, children, userLocation }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const handlers = useRef({});
  handlers.current = { onAdd, onMove, onRemove };
  const wrap = useRef(null);
  const [ready, setReady] = useState(false);
  const touchLocked = lockOnTouch && L.Browser.mobile;
  const ux = useMapUX(map, wrap, { touchLocked, wheelAlways: editable, ready });

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, zoomSnap: 0.5, scrollWheelZoom: editable, dragging: !touchLocked, tap: !touchLocked, doubleClickZoom: !editable })
      .setView(center || UTAH_CENTER, center ? 14 : 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    layers.current = {
      line: L.polyline([], { className: 'route-line', weight: 5, opacity: 0.95 }).addTo(m),
      pins: L.layerGroup().addTo(m),
      hi: L.circleMarker([0, 0], { radius: 7, className: 'route-hi', opacity: 0, fillOpacity: 0 }).addTo(m),
    };
    if (editable) m.on('click', (e) => handlers.current.onAdd?.([e.latlng.lat, e.latlng.lng]));
    map.current = m;
    setReady(true);
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Neighborhood-level zoom (~2 miles across) — a good scale for drawing a run.
  useEffect(() => { if (center && map.current) map.current.setView(center, 14.5); }, [center]);
  const you = useRef(null);
  useEffect(() => {
    if (!ready || !userLocation) return;
    you.current?.remove();
    you.current = L.circleMarker(userLocation, { radius: 8, className: 'you-dot', interactive: false }).addTo(map.current);
  }, [ready, userLocation]);

  useEffect(() => { layers.current.line.setLatLngs(path); }, [path]);

  useEffect(() => {
    const { pins } = layers.current;
    pins.clearLayers();
    const pts = editable ? waypoints : path.length ? [path[0], path[path.length - 1]] : [];
    pts.forEach((p, i) => {
      const isStart = i === 0, isEnd = i === pts.length - 1 && pts.length > 1;
      if (!editable && i > 0 && Math.abs(p[0] - pts[0][0]) < 1e-5 && Math.abs(p[1] - pts[0][1]) < 1e-5) return; // loop: one pin
      const marker = L.marker(p, {
        icon: pinIcon(isStart ? 'S' : isEnd && !editable ? 'F' : String(i + 1), isStart ? 'start' : isEnd ? 'end' : 'mid'),
        draggable: editable,
        keyboard: false,
      }).addTo(pins);
      if (editable) {
        marker.on('dragend', (e) => { const ll = e.target.getLatLng(); handlers.current.onMove?.(i, [ll.lat, ll.lng]); });
        marker.on('click', (e) => { L.DomEvent.stopPropagation(e); handlers.current.onRemove?.(i); });
      }
    });
  }, [waypoints, path, editable]);

  useEffect(() => {
    const { hi } = layers.current;
    if (highlight) hi.setLatLng(highlight).setStyle({ opacity: 1, fillOpacity: 1 });
    else hi.setStyle({ opacity: 0, fillOpacity: 0 });
  }, [highlight]);

  // Fit the view to the route when asked (e.g. on load of a saved route).
  useEffect(() => {
    if (fitKey != null && path.length > 1) map.current.fitBounds(path, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const fit = () => {
    const pts = path.length > 1 ? path : waypoints;
    if (pts.length > 1) map.current.fitBounds(pts, { padding: [24, 24] });
    else if (pts.length === 1) map.current.setView(pts[0], 16);
  };

  return (
    <div ref={wrap} className={`map-wrap ${ux.fullscreen ? 'map-fullscreen' : ''}`} style={{ height }}>
      <div ref={el} className={`map route-map ${editable ? 'editable' : ''}`} />
      {ready && <MapControls mapRef={map} ux={ux} onFit={path.length > 1 || waypoints.length ? fit : null} fitLabel="Fit route"
        onLocate={userLocation ? () => map.current.setView(userLocation, 14.5) : null} />}
      {children}
    </div>
  );
}
