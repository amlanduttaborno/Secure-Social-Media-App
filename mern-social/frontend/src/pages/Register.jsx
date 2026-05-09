import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../api';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', phone: '', recoveryPin: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Create account</h1>
        <p className="mt-3 text-slate-400 text-sm sm:text-base">Start building your encrypted feed.</p>
        {message && <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500 px-4 py-3 text-emerald-200 text-sm">{message}</div>}
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500 px-4 py-3 text-rose-200 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm text-slate-300">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300">Recovery PIN</label>
            <input
              type="password"
              value={form.recoveryPin}
              onChange={(e) => setForm({ ...form, recoveryPin: e.target.value })}
              placeholder="Optional pin to recover chats"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
          </div>
          <button type="submit" className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Register
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-400 text-center">
          Already have an account? <Link to="/login" className="text-cyan-300 hover:text-cyan-200">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
