import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvent } from '../lib/socket.js';
import { Avatar, Spinner, Empty, Modal } from '../components/ui.jsx';
import { timeAgo, parseDate } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

export default function ChatList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState(null);
  const [picker, setPicker] = useState(false);
  const [friends, setFriends] = useState(null);

  const load = () => api('/conversations').then((d) => setConvs(d.conversations));
  useEffect(() => { load(); }, []);
  useSocketEvent('message', load);

  async function openPicker() {
    setPicker(true);
    if (!friends) setFriends((await api('/users/friends')).users);
  }
  async function startChat(friend) {
    const { conversation } = await api('/conversations/direct', { method: 'POST', body: { user_id: friend.id } });
    navigate(`/chat/${conversation.id}`);
  }

  if (!convs) return <Spinner />;
  return (
    <div className="page narrow">
      <div className="page-head"><h1>Chat</h1><button className="btn primary" onClick={openPicker}><Icon name="plus" size={17} /> New message</button></div>
      {convs.length === 0 && <Empty icon="chat" title="No conversations yet">Message a friend, or join a group hike to chat with everyone going.</Empty>}
      <div className="card">
        {convs.map((c) => {
          const outingPast = c.outing && parseDate(c.outing.starts_at) < new Date();
          return (
            <Link key={c.id} to={`/chat/${c.id}`} className={`list-row plain conv ${c.unread ? 'unread' : ''}`}>
              {c.type === 'direct' ? <Avatar user={c.other} size={46} /> : <span className="avatar group" style={{ width: 46, height: 46 }}><Icon name="users" size={22} /></span>}
              <span className="grow left">
                <span className="conv-title">
                  <strong>{c.title}</strong>
                  {c.type === 'outing' && <span className="pill small">{c.outing?.cancelled ? 'Cancelled' : outingPast ? 'Past hike' : `${c.members.length} going`}</span>}
                </span>
                <span className="muted small block ellipsis">
                  {c.last_message ? `${c.last_message.user_id === user.id ? 'You: ' : ''}${c.last_message.body}` : 'Say hi'}
                </span>
              </span>
              <span className="conv-side">
                {c.last_message && <span className="muted xsmall">{timeAgo(c.last_message.created_at)}</span>}
                {c.unread > 0 && <span className="badge static">{c.unread}</span>}
              </span>
            </Link>
          );
        })}
      </div>
      {picker && (
        <Modal title="Message a friend" onClose={() => setPicker(false)}>
          <p className="muted small">You can message people who follow you back.</p>
          {!friends ? <Spinner /> : friends.length === 0 ? <p>No friends yet — <Link to="/people">find people</Link> and follow each other.</p> : (
            friends.map((f) => (
              <button key={f.id} className="list-row plain" onClick={() => startChat(f)}>
                <Avatar user={f} size={36} /><span className="grow left"><strong>{f.display_name}</strong> <span className="muted small">@{f.username}</span></span>
              </button>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}
