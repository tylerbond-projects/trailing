import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { haversineM, locate, locationGranted } from '../lib/geo.js';

let cache = null;
export function useTrails() {
  const [trails, setTrails] = useState(cache || []);
  useEffect(() => {
    if (!cache) api('/trails?sort=name').then(({ trails }) => { cache = trails; setTrails(trails); });
  }, []);
  return trails;
}

// Only uses location if the viewer already allowed it — never prompts.
let herePromise = null;
function useGrantedLocation() {
  const [here, setHere] = useState(null);
  useEffect(() => {
    let alive = true;
    herePromise ||= locationGranted().then((ok) => (ok ? locate() : null));
    herePromise.then((p) => { if (alive) setHere(p); });
    return () => { alive = false; };
  }, []);
  return here;
}

const MI = 1609.344;

/** Trail picker: closest trails first when location is on, otherwise A–Z. */
export default function TrailSelect({ value, onChange, required, placeholder = 'No specific trail' }) {
  const trails = useTrails();
  const here = useGrantedLocation();

  const options = useMemo(() => {
    if (!here) return trails.map((t) => ({ t, away: null }));
    return trails
      .map((t) => ({ t, away: haversineM(here, [t.lat, t.lng]) / MI }))
      .sort((a, b) => a.away - b.away);
  }, [trails, here]);

  const awayLabel = (mi) => (mi < 10 ? mi.toFixed(1) : Math.round(mi));

  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} required={required}>
      <option value="">{here ? `${placeholder} · nearest first` : placeholder}</option>
      {options.map(({ t, away }) => (
        <option key={t.id} value={t.id}>
          {t.name} — {t.distance_mi} mi · {t.difficulty_label}{away != null ? ` · ${awayLabel(away)} mi away` : ''}
        </option>
      ))}
    </select>
  );
}
