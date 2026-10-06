import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// A Leaflet map that has been removed keeps its container but loses its panes;
// touching it (e.g. re-enabling dragging) leaves stale listeners behind.
const live = (map) => !!map && !!map._mapPane?.isConnected;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Shared zoom/fullscreen behaviour for Leaflet maps.
 *  - Scroll-wheel zoom turns on after the map is clicked (or always, for the
 *    route builder), so scrolling the page past a map never hijacks it.
 *  - ⌘/Ctrl + wheel (and trackpad pinch) zooms without clicking first.
 *  - Full screen makes the map fully interactive on phones.
 */
export function useMapUX(mapRef, wrapRef, { touchLocked = false, wheelAlways = false, ready = false } = {}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState(wheelAlways);
  const [hint, setHint] = useState(false);
  const [zoom, setZoom] = useState(null);
  const hintTimer = useRef(null);
  const last = useRef(0);

  const flashHint = useCallback(() => {
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1400);
  }, []);

  // Wire map events once the Leaflet map exists.
  useEffect(() => {
    const map = mapRef.current;
    const wrap = wrapRef.current;
    if (!ready || !live(map) || !wrap) return;
    const onZoom = () => setZoom(map.getZoom());
    onZoom();
    map.on('zoomend', onZoom);
    const activate = () => setActive(true);
    wrap.addEventListener('pointerdown', activate);
    map.on('focus', activate);
    const deactivate = () => { if (!wheelAlways) setActive(false); };
    wrap.addEventListener('mouseleave', deactivate);

    const onWheel = (e) => {
      if (map.scrollWheelZoom.enabled()) return; // Leaflet handles it
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const now = Date.now();
        if (now - last.current < 120) return;
        last.current = now;
        const pt = map.mouseEventToContainerPoint(e);
        map.setZoomAround(pt, map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5));
      } else {
        flashHint();
      }
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      map.off('zoomend', onZoom);
      wrap.removeEventListener('pointerdown', activate);
      map.off('focus', activate);
      wrap.removeEventListener('mouseleave', deactivate);
      wrap.removeEventListener('wheel', onWheel);
    };
  }, [mapRef, wrapRef, wheelAlways, flashHint, ready]);

  // Apply interaction modes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !live(map)) return;
    const wheel = wheelAlways || active || fullscreen;
    wheel ? map.scrollWheelZoom.enable() : map.scrollWheelZoom.disable();
    const drag = !touchLocked || fullscreen;
    drag ? map.dragging.enable() : map.dragging.disable();
    if (map.tap) drag ? map.tap.enable() : map.tap.disable();
  }, [mapRef, active, fullscreen, touchLocked, wheelAlways, ready]);

  // Full screen: lock page scroll, resize the map, Esc to exit.
  useEffect(() => {
    const map = mapRef.current;
    document.body.classList.toggle('map-open', fullscreen);
    const t = setTimeout(() => live(map) && map.invalidateSize({ pan: false }), 60);
    if (!fullscreen) return () => clearTimeout(t);
    const onKey = (e) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.classList.remove('map-open'); };
  }, [fullscreen, mapRef]);

  return { fullscreen, setFullscreen, hint, zoom };
}

export function MapControls({ mapRef, ux, onFit, fitLabel = 'Fit to view' }) {
  const map = mapRef.current;
  const min = map?.getMinZoom() ?? 0, max = map?.getMaxZoom() ?? 19;
  return (
    <>
      <div className="map-controls" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="map-btn-group">
          <button type="button" className="map-btn" onClick={() => map?.zoomIn(1)} disabled={ux.zoom != null && ux.zoom >= max} aria-label="Zoom in" title="Zoom in"><Icon name="plus" size={20} /></button>
          <button type="button" className="map-btn" onClick={() => map?.zoomOut(1)} disabled={ux.zoom != null && ux.zoom <= min} aria-label="Zoom out" title="Zoom out"><Icon name="minus" size={20} /></button>
        </div>
        {onFit && <button type="button" className="map-btn solo" onClick={onFit} aria-label={fitLabel} title={fitLabel}><Icon name="fit" size={19} /></button>}
        <button type="button" className="map-btn solo" onClick={() => ux.setFullscreen(!ux.fullscreen)}
          aria-label={ux.fullscreen ? 'Exit full screen' : 'Full screen map'} title={ux.fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}>
          <Icon name={ux.fullscreen ? 'collapse' : 'expand'} size={19} />
        </button>
      </div>
      {ux.hint && <div className="map-hint">Click the map to zoom with scroll, or hold {isMac ? '⌘' : 'Ctrl'} while scrolling</div>}
    </>
  );
}
