import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, ErrorText } from '../components/ui.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';
import { IconText } from '../components/Icon.jsx';
import { getTheme, setTheme } from '../lib/theme.js';

const STRAVA_MSG = {
  connected: 'Strava connected! You can now import activities.',
  denied: 'Strava connection was cancelled.',
  error: 'Something went wrong connecting to Strava. Please try again.',
};

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [params] = useSearchParams();
  const [f, setF] = useState({ display_name: user.display_name, bio: user.bio || '', activity_type: user.activity_type, preferred_difficulty: user.preferred_difficulty });
  const [avatar, setAvatar] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [strava, setStrava] = useState(null);
  const [theme, setThemeState] = useState(getTheme());
  const chooseTheme = (t) => { setTheme(t); setThemeState(t); };
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  useEffect(() => { api('/strava/status').then(setStrava); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    const form = new FormData();
    for (const [k, v] of Object.entries(f)) form.append(k, v);
    if (avatar[0]) form.append('avatar', avatar[0]);
    try {
      const { user: u } = await api('/auth/me', { method: 'PATCH', form });
      setUser({ ...user, ...u });
      setAvatar([]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { setError(err.message); }
  }

  async function connect() {
    try { window.location.href = (await api('/strava/connect-url')).url; } catch (e) { setError(e.message); }
  }
  async function disconnect() {
    if (!confirm('Disconnect Strava? Imported activities will stay on your profile.')) return;
    await api('/strava', { method: 'DELETE' });
    setStrava({ ...strava, connected: false });
  }

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Settings</h1></div>
      {params.get('strava') && <div className={`callout ${params.get('strava') === 'connected' ? '' : 'warn'}`}>{STRAVA_MSG[params.get('strava')]}</div>}

      <form className="card form" onSubmit={save}>
        <h2>Profile</h2>
        <div className="row">
          <Avatar user={user} size={64} />
          <div className="grow"><PhotoPicker files={avatar} onChange={(fl) => setAvatar(fl.slice(-1))} max={1} /></div>
        </div>
        <label>Name<input value={f.display_name} onChange={set('display_name')} maxLength={60} /></label>
        <label>Bio<textarea rows={2} value={f.bio} onChange={set('bio')} maxLength={280} placeholder="Tell people what you're into" /></label>
        <fieldset>
          <legend>I mostly…</legend>
          <div className="segmented">
            {[['hiker', 'boot', 'Hike'], ['runner', 'run', 'Run'], ['both', 'mountain', 'Both']].map(([v, ic, l]) => (
              <button type="button" key={v} className={f.activity_type === v ? 'active' : ''} onClick={() => set('activity_type')(v)}><IconText icon={ic}>{l}</IconText></button>
            ))}
          </div>
        </fieldset>
        <label>
          Preferred difficulty: <strong>{f.preferred_difficulty}/10</strong>
          <input type="range" min="1" max="10" value={f.preferred_difficulty} onChange={set('preferred_difficulty')} />
          <span className="muted xsmall">Used to tailor your recommendations.</span>
        </label>
        <ErrorText error={error} />
        <button className="btn primary">{saved ? 'Saved' : 'Save changes'}</button>
      </form>

      <div className="card form">
        <h2>Appearance</h2>
        <div className="segmented">
          {[['system', 'settings', 'System'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([v, ic, l]) => (
            <button type="button" key={v} className={theme === v ? 'active' : ''} onClick={() => chooseTheme(v)}><IconText icon={ic}>{l}</IconText></button>
          ))}
        </div>
      </div>

      <div className="card form">
        <h2>Connected apps</h2>
        <div className="row">
          <span className="strava-logo">S</span>
          <div className="grow">
            <strong>Strava</strong>
            <div className="muted small">
              {!strava ? '…' : !strava.configured ? 'Not configured on this server (add Strava API keys to server/.env).'
                : strava.connected ? 'Connected — import activities from Share an activity.' : 'Import your hikes and runs automatically.'}
            </div>
          </div>
          {strava?.configured && (strava.connected
            ? <button className="btn" onClick={disconnect}>Disconnect</button>
            : <button className="btn strava" onClick={connect}>Connect</button>)}
        </div>
      </div>

      <div className="card form">
        <h2>Account</h2>
        <div className="muted small">Signed in as {user.email}</div>
        <button className="btn danger" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
