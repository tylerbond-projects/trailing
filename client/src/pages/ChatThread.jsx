import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvent, getSocket } from '../lib/socket.js';
import { Avatar, Spinner, ErrorText } from '../components/ui.jsx';
import { parseDate, eventDate } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

export default function ChatThread() {
  const { id } = useParams();
  const convId = Number(id);
  const { user } = useAuth();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const bottom = useRef(null);
  const lastTyping = useRef(0);
  const stick = useRef(true);

  useEffect(() => {
    setConv(null); setMessages(null); setError('');
    api(`/conversations/${convId}`).then((d) => setConv(d.conversation)).catch((e) => setError(e.message));
    api(`/conversations/${convId}/messages`).then((d) => { setMessages(d.messages); setHasOlder(d.messages.length === 50); }).catch(() => {});
    api(`/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
  }, [convId]);

  useLayoutEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: 'end' }); }, [messages, typing]);

  useSocketEvent('message', (m) => {
    if (m.conversation_id !== convId) return;
    setMessages((list) => (list?.some((x) => x.id === m.id) ? list : [...(list || []), m]));
    if (m.user_id) setTyping(null);
    if (m.user_id !== user.id) api(`/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
  });
  useSocketEvent('typing', ({ conversationId, userId }) => {
    if (conversationId !== convId) return;
    const who = conv?.members.find((m) => m.id === userId);
    setTyping(who?.display_name || 'Someone');
    clearTimeout(window.__typingTimer);
    window.__typingTimer = setTimeout(() => setTyping(null), 3000);
  });

  function onDraft(e) {
    setDraft(e.target.value);
    if (Date.now() - lastTyping.current > 2000 && conv) {
      lastTyping.current = Date.now();
      getSocket()?.emit('typing', { conversationId: convId, memberIds: conv.members.map((m) => m.id) });
    }
  }

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    stick.current = true;
    try {
      const { message } = await api(`/conversations/${convId}/messages`, { method: 'POST', body: { body } });
      setMessages((list) => (list.some((x) => x.id === message.id) ? list : [...list, message]));
    } catch (err) { setError(err.message); setDraft(body); }
  }

  async function loadOlder() {
    stick.current = false;
    const { messages: older } = await api(`/conversations/${convId}/messages?before=${messages[0].id}`);
    setMessages([...older, ...messages]);
    setHasOlder(older.length === 50);
  }

  if (error && !conv) return <div className="page"><ErrorText error={error} /></div>;
  if (!conv || !messages) return <Spinner />;

  return (
    <div className="chat">
      <header className="chat-head">
        <Link to="/chat" className="icon-btn" aria-label="Back"><Icon name="arrow-left" size={20} /></Link>
        {conv.type === 'direct'
          ? <Link to={`/u/${conv.other.username}`} className="chat-title"><Avatar user={conv.other} size={36} /><strong>{conv.other.display_name}</strong></Link>
          : (
            <Link to={`/hikes/${conv.outing.id}`} className="chat-title">
              <span className="avatar group" style={{ width: 36, height: 36 }}><Icon name="users" size={18} /></span>
              <span><strong>{conv.title}</strong><span className="muted xsmall block">{eventDate(conv.outing.starts_at)} · {conv.members.length} going</span></span>
            </Link>
          )}
      </header>

      <div className="messages">
        {hasOlder && <button className="btn small center-self" onClick={loadOlder}>Load earlier messages</button>}
        {messages.map((m, i) => {
          if (!m.user_id) return <div key={m.id} className="system-msg">{m.body}</div>;
          const mine = m.user_id === user.id;
          const prev = messages[i - 1];
          const grouped = prev && prev.user_id === m.user_id && parseDate(m.created_at) - parseDate(prev.created_at) < 5 * 60000;
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
              {!mine && !grouped && <Avatar user={m.user} size={28} />}
              <div>
                {!mine && !grouped && conv.type === 'outing' && <div className="msg-name">{m.user.display_name}</div>}
                <div className="bubble" title={parseDate(m.created_at).toLocaleString()}>{m.body}</div>
              </div>
            </div>
          );
        })}
        {typing && <div className="typing">{typing} is typing…</div>}
        <div ref={bottom} />
      </div>

      <form className="composer" onSubmit={send}>
        <input value={draft} onChange={onDraft} placeholder="Message…" maxLength={4000} autoFocus />
        <button className="btn primary" disabled={!draft.trim()}>Send</button>
      </form>
      {error && <ErrorText error={error} />}
    </div>
  );
}
