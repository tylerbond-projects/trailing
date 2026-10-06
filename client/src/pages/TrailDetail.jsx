import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, assetUrl } from '../lib/api.js';
import TrailArt from '../components/TrailArt.jsx';
import TrailMap from '../components/Map.jsx';
import TrailCard from '../components/TrailCard.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';
import OutingCard from '../components/OutingCard.jsx';
import { Difficulty, Stars, Spinner, Avatar, UserLink, Modal, ErrorText } from '../components/ui.jsx';
import { miles, feet, durationMin, timeAgo } from '../lib/format.js';
import Icon, { Feature, IconText } from '../components/Icon.jsx';

const DOGS = { leash: 'Allowed on leash', yes: 'Allowed', no: 'Not allowed' };
const VOTE_LABEL = { easier: 'Easier than rated', accurate: 'About right', harder: 'Harder than rated' };

export default function TrailDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(() => api(`/trails/${slug}`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { setData(null); load(); window.scrollTo(0, 0); }, [load]);

  if (error) return <div className="page"><ErrorText error={error} /></div>;
  if (!data) return <Spinner />;
  const { trail: t, rating, reviews, photos, outings, nearby, difficulty_votes: votes } = data;
  const totalVotes = votes.easier + votes.accurate + votes.harder;

  async function toggleSave() {
    await api(`/trails/${t.id}/save`, { method: data.saved ? 'DELETE' : 'POST' });
    setData({ ...data, saved: !data.saved });
  }

  return (
    <div className="page trail-detail">
      <div className="hero">
        {photos[0] ? <img src={assetUrl(photos[0].url)} alt="" /> : <TrailArt trail={t} />}
        <div className="hero-overlay">
          <div className="muted-light small">{t.area}</div>
          <h1>{t.name}</h1>
          <div className="hero-meta">
            <Difficulty score={t.difficulty_score} label={t.difficulty_label} />
            {rating.count > 0 && <span><Stars value={rating.average} size={15} /> {rating.average.toFixed(1)} ({rating.count})</span>}
            {data.completions > 0 && <span className="with-icon"><Icon name="footprints" size={16} />{data.completions} completed</span>}
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button className={`btn ${data.saved ? 'active' : ''}`} onClick={toggleSave}><Icon name={data.saved ? 'star-fill' : 'star'} size={17} /> {data.saved ? 'Saved' : 'Save'}</button>
        <Link className="btn primary" to={`/post/new?trail=${t.slug}`}><Icon name={data.done ? 'check' : 'boot'} size={17} /> {data.done ? 'Log again' : 'Log this hike'}</Link>
        <Link className="btn" to={`/hikes/new?trail=${t.slug}`}><Icon name="users" size={17} /> Plan a group hike</Link>
        <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`} target="_blank" rel="noreferrer"><Icon name="compass" size={17} /> Directions</a>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="stat-grid card">
            <div><span className="label">Length</span><strong>{miles(t.distance_mi)}</strong></div>
            <div><span className="label">Elevation gain</span><strong>{feet(t.elevation_gain_ft)}</strong></div>
            {t.max_elevation_ft && <div><span className="label">High point</span><strong>{feet(t.max_elevation_ft)}</strong></div>}
            <div><span className="label">Route</span><strong className="cap">{t.route_type?.replace(/-/g, ' ')}</strong></div>
            <div><span className="label">Est. time</span><strong>{durationMin(t.est_minutes)}</strong></div>
            {t.surface && <div><span className="label">Surface</span><strong className="cap">{t.surface}</strong></div>}
          </section>

          <section>
            <p className="lead">{t.description}</p>
            {t.tips && <div className="callout with-icon top"><Icon name="lightbulb" size={18} /><span><strong>Tip:</strong> {t.tips}</span></div>}
            {t.permit && <div className="callout warn with-icon top"><Icon name="ticket" size={18} /><span>{t.permit}</span></div>}
            <div className="chips">{t.features.map((f) => <span key={f} className="chip static"><Feature f={f} /></span>)}</div>
          </section>

          <section className="card pad">
            <h2>Difficulty: {t.difficulty_score}/10 · {t.difficulty_label}</h2>
            <div className="difficulty-meter"><div style={{ width: `${t.difficulty_score * 10}%` }} /></div>
            <p className="muted small">
              Calculated from length and elevation gain{t.technical ? ', plus a bump for technical terrain (scrambling, talus or exposure)' : ''}.
            </p>
            {totalVotes > 0 && (
              <div className="votes">
                <strong className="small">What hikers say</strong>
                {Object.entries(votes).map(([k, n]) => (
                  <div key={k} className="vote-row">
                    <span className="small">{VOTE_LABEL[k]}</span>
                    <div className="bar"><div style={{ width: `${(n / totalVotes) * 100}%` }} /></div>
                    <span className="small muted">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="section-head">
              <h2>Group hikes</h2>
              <Link to={`/hikes/new?trail=${t.slug}`} className="btn small">+ Plan one</Link>
            </div>
            {outings.length === 0 ? <p className="muted">No upcoming group hikes here yet. Plan one and others can join you!</p>
              : <div className="list">{outings.map((o) => <OutingCard key={o.id} outing={o} hideTrail />)}</div>}
          </section>

          <section>
            <div className="section-head">
              <h2>Photos {photos.length > 0 && <span className="muted">({photos.length})</span>}</h2>
              <button className="btn small" onClick={() => setPhotoOpen(true)}><Icon name="camera" size={16} /> Add photos</button>
            </div>
            {photos.length === 0 ? <p className="muted">No photos yet — be the first to share one.</p> : (
              <div className="gallery">
                {photos.map((p) => (
                  <button key={p.id} onClick={() => setLightbox(p)}><img src={assetUrl(p.url)} alt={p.caption || ''} loading="lazy" /></button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="section-head">
              <h2>Reviews</h2>
              <button className="btn small primary" onClick={() => setReviewOpen(true)}><Icon name="pencil" size={16} /> {data.my_review ? 'Edit your review' : 'Write a review'}</button>
            </div>
            {rating.count > 0 && (
              <div className="rating-summary card pad">
                <div className="rating-big"><strong>{rating.average.toFixed(1)}</strong><Stars value={rating.average} size={18} /><span className="muted small">{rating.count} review{rating.count > 1 ? 's' : ''}</span></div>
                <div className="rating-bars">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div key={n} className="vote-row"><span className="small with-icon">{n}<Icon name="star-fill" size={11} /></span><div className="bar"><div style={{ width: `${(rating.distribution[n - 1] / rating.count) * 100}%` }} /></div></div>
                  ))}
                </div>
              </div>
            )}
            {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="review">
                <Link to={`/u/${r.user.username}`}><Avatar user={r.user} size={36} /></Link>
                <div className="grow">
                  <div><UserLink user={r.user} /> <span className="muted xsmall">· {timeAgo(r.created_at)}</span></div>
                  <Stars value={r.rating} size={14} />
                  {r.difficulty_vote && <span className="pill small">{VOTE_LABEL[r.difficulty_vote]}</span>}
                  {r.body && <p>{r.body}</p>}
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="detail-side">
          <section className="card pad">
            <h3>Good to know</h3>
            <dl className="facts">
              <dt><IconText icon="paw">Dogs</IconText></dt><dd>{DOGS[t.dogs] || 'Check local rules'}</dd>
              <dt><IconText icon="family">Kids</IconText></dt><dd>{t.kid_friendly == null ? '—' : t.kid_friendly ? 'Kid friendly' : 'Better for experienced hikers'}</dd>
              <dt><IconText icon="calendar">Best seasons</IconText></dt><dd className="cap">{t.best_seasons.join(', ')}</dd>
              <dt><IconText icon="run">Good for</IconText></dt><dd className="cap">{t.activities.join(', ').replace(/-/g, ' ')}</dd>
              <dt><IconText icon="coin">Fees</IconText></dt><dd>{t.fee || 'None'}</dd>
              <dt><IconText icon="pin">Trailhead</IconText></dt><dd>{t.lat.toFixed(4)}, {t.lng.toFixed(4)}</dd>
            </dl>
          </section>
          <TrailMap trails={[t]} center={[t.lat, t.lng]} zoom={13} height={260} />
          {nearby.length > 0 && (
            <section>
              <h3>Nearby trails</h3>
              <div className="list">{nearby.map((n) => <TrailCard key={n.id} trail={n} />)}</div>
            </section>
          )}
        </aside>
      </div>

      {reviewOpen && <ReviewModal trail={t} existing={data.my_review} onClose={() => setReviewOpen(false)} onSaved={() => { setReviewOpen(false); load(); }} />}
      {photoOpen && <PhotoModal trail={t} onClose={() => setPhotoOpen(false)} onSaved={() => { setPhotoOpen(false); load(); }} />}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={assetUrl(lightbox.url)} alt="" />
          <div className="lightbox-caption">{lightbox.caption} — {lightbox.display_name}</div>
        </div>
      )}
    </div>
  );
}

function ReviewModal({ trail, existing, onClose, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [vote, setVote] = useState(existing?.difficulty_vote || '');
  const [body, setBody] = useState(existing?.body || '');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setError('Pick a star rating');
    try {
      await api(`/trails/${trail.id}/reviews`, { method: 'POST', body: { rating, difficulty_vote: vote, body } });
      onSaved();
    } catch (err) { setError(err.message); }
  }
  async function remove() {
    await api(`/trails/${trail.id}/reviews`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <Modal title={`Review ${trail.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="center"><Stars value={rating} size={34} onChange={setRating} /></div>
        <fieldset>
          <legend>How did the difficulty ({trail.difficulty_label}) feel?</legend>
          <div className="segmented">
            {Object.entries(VOTE_LABEL).map(([k, l]) => <button type="button" key={k} className={vote === k ? 'active' : ''} onClick={() => setVote(k)}>{l}</button>)}
          </div>
        </fieldset>
        <label>Your review<textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Conditions, parking, highlights, tips for others…" maxLength={2000} /></label>
        <ErrorText error={error} />
        <div className="row">
          {existing && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
          <button className="btn primary grow">Save review</button>
        </div>
      </form>
    </Modal>
  );
}

function PhotoModal({ trail, onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    form.append('caption', caption);
    try { await api(`/trails/${trail.id}/photos`, { method: 'POST', form }); onSaved(); } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <Modal title="Add photos" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <PhotoPicker files={files} onChange={setFiles} />
        <label>Caption<input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} placeholder="Optional" /></label>
        <ErrorText error={error} />
        <button className="btn primary block" disabled={!files.length || busy}>{busy ? 'Uploading…' : `Upload ${files.length || ''} photo${files.length === 1 ? '' : 's'}`}</button>
      </form>
    </Modal>
  );
}
