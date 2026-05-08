import { useState, useEffect } from 'react';
import { fetchApi } from '../api';

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '', phone: '' });
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi('/api/users/profile')
      .then((data) => {
        setProfile({ ...data.user.profile, phone: data.user.phone || '' });
        setEmail(data.user.email);
      })
      .catch(() => setStatus('Unable to load profile'));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('');
    setSaving(true);
    try {
      const data = await fetchApi('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      setStatus('Profile updated successfully');
      setUser(data.user);
    } catch (err) {
      setStatus(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-800 text-4xl leading-[96px] text-cyan-300 flex-shrink-0">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-white break-words">{user.username}</h2>
            <p className="text-sm text-slate-400 break-words">{email}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
            {user.emailVerified ? '✓ Email verified' : 'Email verification pending'}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Edit profile</h2>
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm text-slate-300">Display name</label>
            <input
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows="4"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Avatar URL</label>
            <input
              value={profile.avatarUrl}
              onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Phone</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <button type="submit" disabled={saving} className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 w-full">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        {status && <div className="mt-4 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-200">{status}</div>}
      </section>
    </div>
  );
}
