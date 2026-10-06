import { createContext, useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '../lib/socket.js';
import { useAuth } from '../lib/auth.jsx';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((all) => [...all, { id, ...t }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.duration || 5000);
  }, []);

  // Celebrate achievements and surface social notifications in realtime.
  useSocketEvent('achievements', (list) => {
    for (const a of list) push({ icon: a.icon, title: 'Achievement unlocked!', body: a.name, to: '/achievements', kind: 'achievement', duration: 7000 });
  });
  useSocketEvent('notification', (n) => {
    const name = n.user?.display_name;
    if (n.type === 'follow') push({ icon: '👋', title: `${name} followed you`, to: `/u/${n.user.username}` });
    if (n.type === 'like') push({ icon: '♥', title: `${name} liked your post` });
    if (n.type === 'comment') push({ icon: '💬', title: `${name} commented on your post` });
  });
  useSocketEvent('message', (m) => {
    if (!user || m.user_id === user.id || location.pathname === `/chat/${m.conversation_id}`) return;
    push({ icon: '💬', title: m.user ? m.user.display_name : 'Group hike', body: m.body.slice(0, 80), to: `/chat/${m.conversation_id}` });
  });

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} className={`toast ${t.kind || ''}`} onClick={() => { if (t.to) navigate(t.to); setToasts((all) => all.filter((x) => x.id !== t.id)); }}>
            <span className="toast-icon">{t.icon}</span>
            <span><strong>{t.title}</strong>{t.body && <span className="toast-body">{t.body}</span>}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
