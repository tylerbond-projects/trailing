import { Link } from 'react-router-dom';
import { assetUrl } from '../lib/api.js';

const AVATAR_COLORS = ['#2f6b4f', '#b4572e', '#3a6ea5', '#7a5c99', '#a8742c', '#3f7f7a', '#9c4363'];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ user, size = 40 }) {
  if (!user) return null;
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (user.avatar_url) return <img className="avatar" style={style} src={assetUrl(user.avatar_url)} alt="" />;
  const initials = (user.display_name || user.username || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ ...style, background: AVATAR_COLORS[hash(user.username) % AVATAR_COLORS.length] }}>{initials}</span>;
}

export function UserLink({ user, children }) {
  return <Link to={`/u/${user.username}`} className="user-link">{children || user.display_name}</Link>;
}

const DIFF_CLASS = { Easy: 'easy', Moderate: 'moderate', Hard: 'hard', 'Very Hard': 'very-hard', Strenuous: 'strenuous' };
export function Difficulty({ score, label, compact }) {
  return (
    <span className={`difficulty ${DIFF_CLASS[label] || ''}`} title={`Difficulty ${score}/10`}>
      <span className="difficulty-score">{score}</span>{!compact && <span>{label}</span>}
    </span>
  );
}

export function Stars({ value = 0, size = 16, onChange }) {
  return (
    <span className={`stars ${onChange ? 'interactive' : ''}`} style={{ fontSize: size }} role={onChange ? 'radiogroup' : undefined}
      aria-label={`${value.toFixed ? value.toFixed(1) : value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - n + 1));
        const star = (
          <span className="star" key={n}>
            <span className="star-bg">★</span>
            <span className="star-fg" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
        return onChange
          ? <button type="button" key={n} className="star-btn" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>{star}</button>
          : star;
      })}
    </span>
  );
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function Empty({ icon = '🌲', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'active' : ''} onClick={() => onChange(t.value)}>
          {t.label}{t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ErrorText({ error }) {
  return error ? <p className="error-text" role="alert">{error}</p> : null;
}
