import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { fetchApi } from '../api';

export default function Chat() {
  const { friendId } = useParams();
  const location = useLocation();
  const [friendName, setFriendName] = useState(location.state?.username || 'Friend');
  const [pin, setPin] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function loadFriendName() {
    try {
      const data = await fetchApi('/api/friends');
      const friend = data.friends.find((item) => item.id === friendId);
      if (friend) {
        setFriendName(friend.username);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!location.state?.username) {
      loadFriendName();
    }
  }, [friendId]);

  async function handleRestore(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const data = await fetchApi('/api/messages/restore', {
        method: 'POST',
        body: JSON.stringify({ friendId, pin }),
      });
      setMessages(data.conversation);
      setLoaded(true);
      setStatus('Chat history restored securely.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setError('');
    setStatus('');
    try {
      await fetchApi('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ friendId, message: text }),
      });
      setText('');
      setStatus('Message sent securely.');
      if (loaded) {
        await handleRestore(event);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-950/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Secure chat</h1>
            <p className="mt-2 text-slate-400">Encrypted conversation with {friendName}.</p>
          </div>
          <Link to="/friends" className="rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-100 hover:bg-slate-700">Back to friends</Link>
        </div>
        {status && <div className="mt-4 rounded-lg bg-cyan-500/10 border border-cyan-500 px-4 py-3 text-cyan-200 text-sm">{status}</div>}
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500 px-4 py-3 text-rose-200 text-sm">{error}</div>}
        <form onSubmit={handleRestore} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Recovery PIN to restore chat"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
          />
          <button className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Restore chat</button>
        </form>
      </div>

      {loaded ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-slate-400">No messages yet.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`rounded-3xl p-4 ${message.sender === friendId ? 'bg-slate-800 text-slate-200' : 'bg-cyan-950 text-cyan-100'}`}>
                    <div className="text-xs text-slate-400">{new Date(message.createdAt).toLocaleString()}</div>
                    <div className="mt-2 whitespace-pre-wrap break-words">{message.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <form onSubmit={handleSend} className="grid gap-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows="4"
              placeholder="Write a secure message..."
              className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm"
            />
            <button type="submit" className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Send message</button>
          </form>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <p className="text-slate-400">Enter your recovery PIN to decrypt the chat history.</p>
        </div>
      )}
    </div>
  );
}
