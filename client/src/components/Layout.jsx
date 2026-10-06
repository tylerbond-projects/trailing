import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useSocketEvent } from '../lib/socket.js';
import { Avatar } from './ui.jsx';
import Icon from './Icon.jsx';

const NAV = [
  { to: '/', label: 'Feed', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'map' },
  { to: '/for-you', label: 'For You', icon: 'sparkle' },
  { to: '/hikes', label: 'Group Hikes', short: 'Hikes', icon: 'users' },
  { to: '/chat', label: 'Chat', icon: 'chat', badge: 'unread' },
];
const MORE = [
  { to: '/achievements', label: 'Achievements', icon: 'trophy' },
  { to: '/people', label: 'Find People', icon: 'search' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Layout() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const refreshUnread = () => api('/conversations').then(({ conversations }) =>
    setUnread(conversations.reduce((s, c) => s + c.unread, 0))).catch(() => {});
  useEffect(() => { refreshUnread(); }, [location.pathname]);
  useSocketEvent('message', () => setTimeout(refreshUnread, 300));

  const navItem = (n, mobile) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon"><Icon name={n.icon} size={22} />{n.badge && unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}</span>
      <span className="nav-label">{mobile ? n.short || n.label : n.label}</span>
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand"><img src="/icon.svg" alt="" /> Trailing</Link>
        <nav>{NAV.map((n) => navItem(n))}<hr />{MORE.map((n) => navItem(n))}</nav>
        <Link to="/post/new" className="btn primary block"><Icon name="plus" size={17} /> Share an activity</Link>
        <Link to={`/u/${user.username}`} className="sidebar-me">
          <Avatar user={user} size={36} />
          <div><strong>{user.display_name}</strong><div className="muted small">@{user.username}</div></div>
        </Link>
      </aside>

      <header className="topbar">
        <Link to="/" className="brand"><img src="/icon.svg" alt="" /> Trailing</Link>
        <div className="topbar-actions">
          <Link to="/achievements" className="icon-btn" aria-label="Achievements"><Icon name="trophy" size={21} /></Link>
          <Link to="/post/new" className="icon-btn" aria-label="New post"><Icon name="plus" size={22} /></Link>
          <Link to={`/u/${user.username}`} aria-label="Your profile"><Avatar user={user} size={32} /></Link>
        </div>
      </header>

      <main className="content"><Outlet /></main>

      <nav className="tabbar">{NAV.map((n) => navItem(n, true))}</nav>
    </div>
  );
}
