// Trailing's icon set: 24px grid, 1.75px rounded strokes, one color
// (currentColor) so icons inherit the text color in light and dark mode.
import { FEATURES } from '../lib/format.js';

const F = { fill: 'currentColor', stroke: 'none' };

const ICONS = {
  // ---- Navigation & UI ----
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9v11h13V9" /><path d="M10 20v-5.5h4V20" /></>,
  map: <><path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  sparkle: <><path d="M11 3.5c.6 4 2.6 6 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.5 5.9-2.5 6.5-6.5z" /><path d="M18.5 14.5c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2z" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.6 3.5 2.6 3.5 5.7" /></>,
  'user-plus': <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M19 8v6M16 11h6" /></>,
  chat: <path d="M20 15a2 2 0 0 1-2 2H8.5L4 20.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7A3 3 0 0 0 7.3 10M17 5.5h2.5V7a3 3 0 0 1-2.8 3" /><path d="M12 14v3M8.5 20.5h7M9.5 17h5v3.5h-5z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'check-circle': <><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.3 2.6 2.6 5-5.3" /></>,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  more: <><circle cx="5.5" cy="12" r="1.4" {...F} /><circle cx="12" cy="12" r="1.4" {...F} /><circle cx="18.5" cy="12" r="1.4" {...F} /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" {...F} /><circle cx="4.5" cy="12" r="1.2" {...F} /><circle cx="4.5" cy="18" r="1.2" {...F} /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  'star-fill': <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...F} />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  'heart-fill': <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" {...F} />,
  pin: <><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  elevation: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.5-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5.2 1.4 5.2 4.1 0 1.1-1.2 2-2.7 2-1.1 0-2.1-.5-2.6-1.3M12 6.5V8M12 16v1.5" /></>,
  lightbulb: <><path d="M9.5 18h5M10.5 21h3" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>,
  ticket: <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M14.5 8v1.5M14.5 11.25v1.5M14.5 14.5V16" /></>,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  shield: <><path d="M12 3 19.5 6v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" /><path d="m8.8 12 2.3 2.3 4.2-4.4" /></>,
  family: <><circle cx="8.5" cy="7" r="3" /><path d="M3 20c0-3.3 2.5-5.5 5.5-5.5S14 16.7 14 20" /><circle cx="17.5" cy="11.5" r="2" /><path d="M15 20c.3-2 1.3-3.3 2.5-3.3S19.7 18 20 20" /></>,

  // ---- Activities ----
  boot: <><path d="M6 3h6v7l6 2.4a2.5 2.5 0 0 1 1.5 2.3V18H5V4a1 1 0 0 1 1-1z" /><path d="M4 21h16.5M8.5 6.5H12M8.5 9.5H12" /></>,
  run: <><circle cx="15.5" cy="4.5" r="1.9" /><path d="m14 8-2.5 5 3 3-1 5M11.5 13l-3 2.5-3.5-.5M7.5 10l3-2.5H14l2.5 3.5 3 .5" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.9" /><path d="m12.5 8-1 6-2.5 7M11.5 14l3 3 .5 4M8.5 11.5l4-3.5 3 3.5" /></>,
  mountain: <><path d="M2.5 19.5 9 8l4 6.5 2.5-3.5 6 8.5z" /><path d="m7.1 11.4 1.3 1.1 1.2-1 1.3 1.3" /></>,
  mountains: <><path d="M2 20 8.5 9l4.2 7.2M10 20l5.5-9.5L21.5 20" /><path d="M2 20h19.5" /></>,
  'mountain-flag': <><path d="M2.5 20 10 8l3 4.5 2-2.5 6.5 10z" /><path d="M10 8V3.5l3.5 1.5L10 6.5" /></>,

  // ---- Trail features ----
  flag: <><path d="M5 21V4" /><path d="M5 4.5h11l-2 4 2 4H5" /></>,
  binoculars: <><circle cx="6.5" cy="15.5" r="3.5" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M10 15.5h4M3.2 14.5 5.5 6h3l1.2 6M20.8 14.5 18.5 6h-3l-1.2 6" /></>,
  buildings: <><path d="M3.5 20.5h17M5 20.5V9l5-2.5v14M10 20.5V4h9v16.5" /><path d="M13 8h3M13 11.5h3M13 15h3" /></>,
  waterfall: <><path d="M4 4h16" /><path d="M9.5 4v11M12 4v11M14.5 4v11" /><path d="M4.5 18.5c1.3-1.2 2.7-1.2 4 0s2.7 1.2 4 0 2.7-1.2 4 0 2.7 1.2 3 .4" /></>,
  lake: <><path d="m5 11 4-5 3 3.5 2-2 4 3.5" /><path d="M3 15c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 19.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0" /></>,
  waves: <path d="M3 7c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 12c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 17c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0" />,
  flower: <><path d="M12 21v-8" /><path d="M12 13c-3.5 0-5.5-2.5-5.5-6.5L9.3 8 12 4.5 14.7 8l2.8-1.5c0 4-2 6.5-5.5 6.5z" /><path d="M12 17.5c-1.5-2-3.5-2.6-5.5-2.3.3 2.4 2.6 3.8 5.5 3.8" /></>,
  leaf: <><path d="M5 19c0-8 5-13.5 14-14 .5 9-5 14-12.5 14" /><path d="M5 19c3-4.5 6-7 9.5-9" /></>,
  paw: <><path d="M12 13c-2.8 0-5 3-5 5.3 0 1.4 1 1.9 2.2 1.9 1.1 0 1.8-.6 2.8-.6s1.7.6 2.8.6c1.2 0 2.2-.5 2.2-1.9C17 16 14.8 13 12 13z" /><circle cx="6.3" cy="11" r="1.7" /><circle cx="9.6" cy="7" r="1.7" /><circle cx="14.4" cy="7" r="1.7" /><circle cx="17.7" cy="11" r="1.7" /></>,
  cave: <><path d="M2.5 20 9 7l3 3 2-2 7.5 12z" /><path d="M9 20v-3a3 3 0 0 1 6 0v3" /></>,
  steam: <><path d="M8 3.5c-1.2 1.3-1.2 2.7 0 4s1.2 2.7 0 4M12 3.5c-1.2 1.3-1.2 2.7 0 4s1.2 2.7 0 4M16 3.5c-1.2 1.3-1.2 2.7 0 4s1.2 2.7 0 4" /><path d="M3 15.5h18M4.5 15.5c.8 3 3.8 5 7.5 5s6.7-2 7.5-5" /></>,
  canyon: <><path d="M3 4v16h5v-5l2-3V4M21 4v16h-5v-5l-2-3V4" /><path d="M8 20c1.4-.9 2.6-.9 4 0s2.6.9 4 0" /></>,
  tree: <><path d="M12 3 6.5 11H9l-3.5 5.5h13L15 11h2.5z" /><path d="M12 16.5V21" /></>,
  moon: <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" />,
  accessible: <><circle cx="10" cy="4.5" r="1.8" /><path d="M10 8v6h6l2.5 5M10 11h4.5" /><path d="M7.5 11.2A5 5 0 1 0 14 18.5" /></>,
  carabiner: <><path d="M9 4h3.5A4.5 4.5 0 0 1 17 8.5v7a4.5 4.5 0 0 1-4.5 4.5h-1A4.5 4.5 0 0 1 7 15.5v-9A2.5 2.5 0 0 1 9 4z" /><path d="M10.5 7.5v8" /></>,

  // ---- Achievements ----
  footprints: <><path d="M7 3.5c1.7 0 2.7 1.6 2.7 4 0 1.9-.7 3.4-.9 4.8H5.6c-.3-1.6-1.1-2.9-1.1-4.7C4.5 5.2 5.5 3.5 7 3.5z" /><path d="M5.7 14.6h3.1v1.3a1.55 1.55 0 0 1-3.1 0z" /><path d="M17 8c1.5 0 2.5 1.7 2.5 4.1 0 1.8-.8 3.1-1.1 4.7h-3.2c-.2-1.4-.9-2.9-.9-4.8 0-2.4 1-4 2.7-4z" /><path d="M15.2 19.1h3.1v1.3a1.55 1.55 0 0 1-3.1 0z" /></>,
  ruler: <><path d="M3.5 16.5 16.5 3.5l4 4-13 13z" /><path d="m7 13 2 2M10 10l1.5 1.5M13 7l2 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  sunrise: <><path d="M3 18h18M8 21h8" /><path d="M7 18a5 5 0 0 1 10 0" /><path d="M12 5.5v3M5.6 11.1l1.5 1.5M18.4 11.1l-1.5 1.5" /></>,
  'sunrise-mountain': <><path d="M2.5 20 9.5 9l4 6 2.5-3.5 5.5 8.5z" /><circle cx="17" cy="5.5" r="2" /></>,
  medal: <><path d="m8 3 2.6 6.2M16 3l-2.6 6.2" /><circle cx="12" cy="14.5" r="5.5" /><circle cx="12" cy="14.5" r="2.3" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 2.6-5.5 3.8-8.8 1.9 1.5 2.4 3.4 2.2 5 1.1-.9 1.9-2.4 1.9-4.5 2.6 2 5.1 5 5.1 8.3 0 3.6-2.6 6.2-6.5 6.2z" />,
  crown: <><path d="m3.5 8 4 4L12 5.5l4.5 6.5 4-4L19 18.5H5z" /><path d="M5 21h14" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
  backpack: <><path d="M6.5 9.5A5.5 5.5 0 0 1 12 4a5.5 5.5 0 0 1 5.5 5.5V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" /><path d="M10 4V3h4v1M9 11h6M9 14h6v4.5H9z" /></>,
  half: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" {...F} /></>,
};

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.75, label }) {
  const glyph = ICONS[name] || ICONS.sparkle;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {glyph}
    </svg>
  );
}

/** Icon + label for a trail feature tag (waterfall, summit, …). */
export function Feature({ f, size = 14 }) {
  const meta = FEATURES[f] || { icon: 'sparkle', label: f };
  return <span className="with-icon"><Icon name={meta.icon} size={size} />{meta.label}</span>;
}

/** Inline icon followed by text, vertically aligned. */
export function IconText({ icon, size = 16, children }) {
  return <span className="with-icon"><Icon name={icon} size={size} />{children}</span>;
}
