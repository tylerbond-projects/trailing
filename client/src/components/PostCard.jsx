import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, UserLink, Difficulty } from './ui.jsx';
import { timeAgo, miles, feet, duration, pace, parseLocal, ACTIVITY_LABEL, ACTIVITY_ICON } from '../lib/format.js';
import Icon from './Icon.jsx';

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [draft, setDraft] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const a = post.activity;
  const isRun = a && ['Run', 'TrailRun'].includes(a.type);

  async function toggleLike() {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    await api(`/posts/${post.id}/like`, { method: liked ? 'DELETE' : 'POST' }).catch(() => {});
  }

  async function openComments() {
    setShowComments((s) => !s);
    if (!comments) setComments((await api(`/posts/${post.id}/comments`)).comments);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const { comment } = await api(`/posts/${post.id}/comments`, { method: 'POST', body: { body: draft } });
    setComments((c) => [...(c || []), comment]);
    setCommentCount((n) => n + 1);
    setDraft('');
  }

  async function remove() {
    if (!confirm('Delete this post?')) return;
    await api(`/posts/${post.id}`, { method: 'DELETE' });
    onDelete?.(post.id);
  }

  return (
    <article className="card post">
      <header className="post-head">
        <Link to={`/u/${post.user.username}`}><Avatar user={post.user} size={42} /></Link>
        <div className="grow">
          <UserLink user={post.user} />
          <div className="muted small">
            {a ? <><Icon name={ACTIVITY_ICON[a.type]} size={13} className="inline" /> {ACTIVITY_LABEL[a.type]} · {parseLocal(a.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</> : 'Post'}
            {' · '}{timeAgo(post.created_at)}
            {a?.source === 'strava' && <span className="strava-tag">via Strava</span>}
          </div>
        </div>
        {post.user.id === user.id && <button className="icon-btn subtle" onClick={remove} aria-label="Delete post"><Icon name="more" size={20} /></button>}
      </header>

      {a && <h3 className="post-title">{a.name}</h3>}
      {post.body && <p className="post-body">{post.body}</p>}

      {a && (
        <div className="activity-stats">
          <div><span className="label">Distance</span><strong>{miles(a.distance_mi)}</strong></div>
          <div><span className="label">Elevation</span><strong>{feet(a.elevation_gain_ft)}</strong></div>
          {a.moving_time_s > 0 && <div><span className="label">Time</span><strong>{duration(a.moving_time_s)}</strong></div>}
          {isRun && a.moving_time_s > 0 && <div><span className="label">Pace</span><strong>{pace(a.distance_mi, a.moving_time_s)}</strong></div>}
        </div>
      )}

      {post.trail && (
        <Link to={`/trails/${post.trail.slug}`} className="post-trail">
          <span className="with-icon"><Icon name="pin" size={16} />{post.trail.name}</span>
          <Difficulty score={post.trail.difficulty_score} label={post.trail.difficulty_label} compact />
        </Link>
      )}

      {post.photos.length > 0 && (
        <div className={`photo-grid n${Math.min(post.photos.length, 4)}`}>
          {post.photos.slice(0, 4).map((url) => (
            <button key={url} onClick={() => setLightbox(url)}><img src={assetUrl(url)} alt="" loading="lazy" /></button>
          ))}
        </div>
      )}

      <footer className="post-actions">
        <button className={`action ${liked ? 'liked' : ''}`} onClick={toggleLike} aria-label={liked ? 'Unlike' : 'Like'}><Icon name={liked ? 'heart-fill' : 'heart'} size={19} /> {likes || ''}</button>
        <button className="action" onClick={openComments} aria-label="Comments"><Icon name="chat" size={19} /> {commentCount || ''}</button>
      </footer>

      {showComments && (
        <div className="comments">
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <Avatar user={c.user} size={28} />
              <div><UserLink user={c.user} /> <span>{c.body}</span><div className="muted xsmall">{timeAgo(c.created_at)}</div></div>
            </div>
          ))}
          <form onSubmit={addComment} className="comment-form">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" maxLength={1000} />
            <button className="btn small" disabled={!draft.trim()}>Post</button>
          </form>
        </div>
      )}
      {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><img src={assetUrl(lightbox)} alt="" /></div>}
    </article>
  );
}
