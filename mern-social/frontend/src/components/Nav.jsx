import { Link } from 'react-router-dom';
import { fetchApi } from '../api';

export default function Nav({ user, setUser }) {
  async function handleLogout() {
    await fetchApi('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <nav className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/" className="text-xl font-semibold text-cyan-300">Secure Social</Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <>
              <Link to="/friends" className="rounded-md bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700">
                Friends
              </Link>
              <Link to="/profile" className="rounded-md bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700">
                Profile
              </Link>
              <span className="text-sm text-slate-300">{user.username}</span>
              <button onClick={handleLogout} className="rounded-md bg-cyan-500 px-4 py-2 text-slate-950 font-semibold hover:bg-cyan-400">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="rounded-md bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
