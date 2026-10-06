import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

let cache = null;
export function useTrails() {
  const [trails, setTrails] = useState(cache || []);
  useEffect(() => {
    if (!cache) api('/trails?sort=name').then(({ trails }) => { cache = trails; setTrails(trails); });
  }, []);
  return trails;
}

export default function TrailSelect({ value, onChange, required, placeholder = 'No specific trail' }) {
  const trails = useTrails();
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} required={required}>
      <option value="">{placeholder}</option>
      {trails.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.distance_mi} mi · {t.difficulty_label}</option>)}
    </select>
  );
}
