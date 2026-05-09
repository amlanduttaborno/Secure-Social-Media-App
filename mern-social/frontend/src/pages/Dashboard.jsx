import { useEffect, useState } from 'react';
import { fetchApi } from '../api';

export default function Dashboard({ user }) {
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchApi('/api/posts')
      .then((data) => setPosts(data.posts))
      .catch(() => setError('Unable to load posts'));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/posts/${editingId}` : '/api/posts';
      const data = await fetchApi(url, {
        method,
        body: JSON.stringify({ title, body }),
      });
      if (editingId) {
        setPosts((prev) => prev.map((p) => (p.id === editingId ? data.post : p)));
        setEditingId(null);
      } else {
        setPosts((prev) => [data.post, ...prev]);
      }
      setTitle('');
      setBody('');
      setStatus(editingId ? 'Post updated' : 'Post published');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this post?')) return;
    try {
      await fetchApi(`/api/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setStatus('Post deleted');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(post) {
    setTitle(post.title);
    setBody(post.body);
    setEditingId(post.id);
  }

  function cancelEdit() {
    setTitle('');
    setBody('');
    setEditingId(null);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Feed</p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">Hello, {user.profile.displayName || user.username}</h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base">Your secure feed keeps posts encrypted in the backend using RSA and ECC hybrid protection.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-950 px-4 py-4 text-slate-200">
              <div className="text-2xl sm:text-3xl font-semibold text-white">{posts.length}</div>
              <div className="text-sm text-slate-400">Total posts</div>
            </div>
            <div className="rounded-3xl bg-slate-950 px-4 py-4 text-slate-200">
              <div className="text-2xl sm:text-3xl font-semibold text-white">{user.emailVerified ? 'Verified' : 'Pending'}</div>
              <div className="text-sm text-slate-400">Email status</div>
            </div>
          </div>
        </div>
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500 text-2xl font-bold text-slate-950 flex-shrink-0">{user.username[0].toUpperCase()}</div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white truncate">{user.profile.displayName || user.username}</h2>
              <p className="text-sm text-slate-400">{user.role === 'admin' ? 'Administrator' : 'Member'}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>
              <span className="text-slate-400">Bio:</span>
              <p className="mt-1 text-slate-200 line-clamp-2">{user.profile.bio || 'No bio yet.'}</p>
            </div>
          </div>
        </aside>
      </section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">{editingId ? 'Edit post' : 'Create a secure post'}</h2>
        {status && <div className="mt-4 rounded-lg bg-cyan-500/10 border border-cyan-500 px-4 py-3 text-cyan-200 text-sm">{status}</div>}
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500 px-4 py-3 text-rose-200 text-sm">{error}</div>}
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share what you're thinking in a secure way..."
            rows="6"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
          />
          <div className="flex gap-3 flex-wrap">
            <button type="submit" className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              {editingId ? 'Update' : 'Publish'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="space-y-4 sm:space-y-6">
        {posts.map((post) => (
          <article key={post.id} className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-lg shadow-slate-950/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-slate-400">
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate">{post.author.displayName || post.author.username}</p>
                <p className="text-sm truncate">@{post.author.username}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] flex-shrink-0">{new Date(post.createdAt).toLocaleString()}</span>
            </div>
            <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl font-semibold text-white break-words">{post.title}</h3>
            <p className="mt-2 sm:mt-3 text-slate-300 whitespace-pre-line text-sm sm:text-base">{post.body}</p>
            {post.author.id === user.id && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <button onClick={() => startEdit(post)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-slate-700">
                  Edit
                </button>
                <button onClick={() => handleDelete(post.id)} className="rounded-lg bg-rose-900 px-3 py-2 text-xs sm:text-sm font-medium text-rose-200 hover:bg-rose-800">
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
