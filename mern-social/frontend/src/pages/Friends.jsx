import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../api';

export default function Friends() {
  const [friendUsername, setFriendUsername] = useState('');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    setStatus('');
    try {
      const [friendsData, requestData] = await Promise.all([
        fetchApi('/api/friends'),
        fetchApi('/api/friends/requests'),
      ]);
      setFriends(friendsData.friends);
      setRequests(requestData.requests);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSendRequest(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await fetchApi('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username: friendUsername }),
      });
      setStatus('Friend request sent.');
      setFriendUsername('');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAccept(requestId) {
    setError('');
    setStatus('');
    try {
      await fetchApi(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
      setStatus('Friend request accepted.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReject(requestId) {
    setError('');
    setStatus('');
    try {
      await fetchApi(`/api/friends/requests/${requestId}/reject`, { method: 'POST' });
      setStatus('Friend request rejected.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(friendId) {
    if (!window.confirm('Remove this friend?')) return;
    setError('');
    setStatus('');
    try {
      await fetchApi(`/api/friends/${friendId}`, { method: 'DELETE' });
      setStatus('Friend removed.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Secure Friends</h1>
        <p className="mt-3 text-slate-400">Manage encrypted contacts and open secure chats with your trusted friends.</p>
        {status && <div className="mt-4 rounded-lg bg-cyan-500/10 border border-cyan-500 px-4 py-3 text-cyan-200 text-sm">{status}</div>}
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500 px-4 py-3 text-rose-200 text-sm">{error}</div>}
        <form onSubmit={handleSendRequest} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <input
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            placeholder="Friend username"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
          />
          <button className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Send request</button>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Pending requests</h2>
          {requests.length === 0 ? (
            <p className="mt-4 text-slate-400">No pending requests.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-white font-semibold">{request.username}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(request.id)} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
                        Accept
                      </button>
                      <button onClick={() => handleReject(request.id)} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-rose-400">
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Your friends</h2>
          {friends.length === 0 ? (
            <p className="mt-4 text-slate-400">No friends yet. Send a request to start a secure chat.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {friends.map((friend) => (
                <div key={friend.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-white font-semibold">{friend.username}</div>
                      <div className="text-slate-400 text-sm">Added {new Date(friend.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Link to={`/chat/${friend.id}`} state={{ username: friend.username }} className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                        Chat
                      </Link>
                      <button onClick={() => handleRemove(friend.id)} className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-400">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
