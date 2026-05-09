import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../api';

export default function Login({ setUser }) {
  const [stage, setStage] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', otp: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const response = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      if (response.pending) {
        setStage('verify');
        setPendingUsername(form.username);
        setStatus(response.message);
      } else {
        setUser(response.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const response = await fetchApi('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ username: pendingUsername, otp: form.otp }),
      });
      setUser(response.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Secure Login</h1>
        <p className="mt-3 text-slate-400 text-sm sm:text-base">Use your account and verification code to sign in.</p>
        {status && <div className="mt-4 rounded-lg bg-cyan-500/10 border border-cyan-500 px-4 py-3 text-cyan-200 text-sm">{status}</div>}
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500 px-4 py-3 text-rose-200 text-sm">{error}</div>}
        {stage === 'login' ? (
          <form onSubmit={handleLogin} className="mt-8 space-y-6">
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
              <label className="block text-sm text-slate-300">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
              />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm text-slate-300">Verification code</label>
              <input
                type="text"
                value={form.otp}
                onChange={(e) => setForm({ ...form, otp: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
              />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Verify code
            </button>
          </form>
        )}
        <p className="mt-6 text-sm text-slate-400 text-center">
          New here? <Link to="/register" className="text-cyan-300 hover:text-cyan-200">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
