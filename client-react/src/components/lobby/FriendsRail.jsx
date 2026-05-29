import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Avatar from '../ui/Avatar';
import { useToast } from '../../contexts/ToastContext';

// Right-rail friends list. Polls every 8s as a backstop in case socket
// presence events haven't been wired yet. If the current user is in a
// hosted room, the per-friend button switches to INVITE (calls
// /api/friends/invite); for friends already "in a room" we show JOIN
// which opens that room. Otherwise we show the bare INVITE-when-room
// affordance disabled.

export default function FriendsRail({ activeRoomId }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    const fetchFriends = async () => {
      try {
        const data = await api.get('/api/friends');
        if (alive) setFriends(data.friends || []);
      } catch { /* keep stale state */ }
      finally { if (alive) setLoading(false); }
    };
    fetchFriends();
    const t = setInterval(fetchFriends, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const sendInvite = async (friendId) => {
    if (!activeRoomId) {
      toast.info('Create or join a room first, then invite friends.');
      return;
    }
    try {
      await api.post('/api/friends/invite', { friendId, roomId: activeRoomId });
      toast.success('Invite sent');
    } catch (err) {
      toast.error(err.message || 'Invite failed');
    }
  };

  const onlineCount = friends.filter((f) => f.isOnline).length;

  return (
    <aside className="panel-card p-4 lg:p-5 w-full lg:w-72 shrink-0">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg tracking-wider text-ink">
          FRIENDS ONLINE <span className="text-accent">— {onlineCount}</span>
        </h3>
      </header>

      {loading ? (
        <div className="text-ink-soft text-sm py-6 text-center">Loading…</div>
      ) : friends.length === 0 ? (
        <div className="text-ink-soft text-sm py-8 text-center leading-relaxed">
          No friends yet.<br/>
          <span className="text-ink-faint text-xs">Add some from the friends panel to invite them to rooms.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-bg-3/40 border border-line">
              <Avatar src={f.avatar} name={f.username} size="sm" online={f.isOnline} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{f.username}</div>
                <div className={`text-[11px] ${f.isOnline ? 'text-emerald' : 'text-ink-faint'}`}>
                  {f.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => sendInvite(f.id)}
                disabled={!activeRoomId || !f.isOnline}
                className="btn-violet text-[11px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >INVITE</button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
