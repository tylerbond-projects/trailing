import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ErrorText } from '../components/ui.jsx';
import TrailArt from '../components/TrailArt.jsx';
import { IconText } from '../components/Icon.jsx';

const DIFFICULTY_PREFS = [
  { value: 2, label: 'Easy strolls', hint: 'Short, mostly flat' },
  { value: 4, label: 'Moderate', hint: 'A few miles, some climbing' },
  { value: 6, label: 'Challenging', hint: 'Big climbs, longer days' },
  { value: 9, label: 'Bring it on', hint: 'Summits & epic days' },
];

export default function Auth({ mode }) {
  const signup = mode === 'signup';
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '', username: '', email: '', display_name: '', activity_type: 'both', preferred_difficulty: 4 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = signup
        ? await api('/auth/signup', { method: 'POST', body: form })
        : await api('/auth/login', { method: 'POST', body: { login: form.login, password: form.password } });
      signIn(data);
      navigate(signup ? '/for-you' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-art"><TrailArt trail={{ slug: 'trailing-auth-cover', features: ['summit', 'lake', 'shade'] }} /></div>
      <form className="auth-card card" onSubmit={submit}>
        <div className="brand big"><img src="/icon.svg" alt="" /> Trailing</div>
        <p className="muted">{signup ? 'Join hikers and runners exploring Utah County.' : 'Welcome back to the trail.'}</p>

        {signup ? (
          <>
            <label>Name<input value={form.display_name} onChange={set('display_name')} placeholder="Your name" required /></label>
            <label>Username<input value={form.username} onChange={set('username')} placeholder="trailblazer" required autoComplete="username" /></label>
            <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
            <label>Password<input type="password" value={form.password} onChange={set('password')} minLength={8} required autoComplete="new-password" /></label>
            <fieldset>
              <legend>I mostly…</legend>
              <div className="segmented">
                {[['hiker', 'boot', 'Hike'], ['runner', 'run', 'Run'], ['both', 'mountain', 'Both']].map(([v, ic, l]) => (
                  <button type="button" key={v} className={form.activity_type === v ? 'active' : ''} onClick={() => set('activity_type')(v)}><IconText icon={ic}>{l}</IconText></button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>What kind of trails do you like?</legend>
              <div className="option-grid">
                {DIFFICULTY_PREFS.map((d) => (
                  <button type="button" key={d.value} className={`option ${form.preferred_difficulty === d.value ? 'active' : ''}`} onClick={() => set('preferred_difficulty')(d.value)}>
                    <strong>{d.label}</strong><span className="muted small">{d.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <label>Username or email<input value={form.login} onChange={set('login')} required autoComplete="username" /></label>
            <label>Password<input type="password" value={form.password} onChange={set('password')} required autoComplete="current-password" /></label>
          </>
        )}
        <ErrorText error={error} />
        <button className="btn primary block" disabled={busy}>{busy ? '…' : signup ? 'Create account' : 'Log in'}</button>
        <p className="muted small center">
          {signup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}
        </p>
        {!signup && <p className="muted xsmall center">Demo account: <code>demo</code> / <code>password123</code></p>}
      </form>
    </div>
  );
}
