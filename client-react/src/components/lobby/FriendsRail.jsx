import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { getSocket } from '../../api/socket';
import Avatar from '../ui/Avatar';
import { useToast } from '../../contexts/ToastContext';

// Right-rail friends list — matches the mockup tightly:
//   • Header "FRIENDS ONLINE — N" with N = online count
//   • Each row: avatar (online dot) + name + colored status + action button
//     - status 'in_match' → red "In Match" + JOIN (spectate the live game)
//     - status 'in_lobby' → amber "In Lobby" + JOIN (jump into their room)
//     - status 'online'   → green "Online" + INVITE (when host has a room)
//     - status 'offline'  → grey "Offline" + button disabled
//
// Live presence still piggybacks on friend:presence socket events; a
// long backstop poll catches the (room-state change) cases the live
// event doesn't cover yet.

const STATUS = {
  in_match: { label: 'In Match', color: 'text-rose',     dot: 'bg-rose'    },
  in_lobby: { label: 'In Lobby', color: 'text-accent',   dot: 'bg-accent'  },
  online:   { label: 'Online',   color: 'text-emerald',  dot: 'bg-emerald' },
  offline:  { label: 'Offline',  color: 'text-ink-faint',dot: 'bg-ink-faint'},
};

function statusOf(f) {
  return STATUS[f.status] || (f.isOnline ? STATUS.online : STATUS.offline);
}

export default function FriendsRail({ activeRoomId }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

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
    const t = setInterval(fetchFriends, 15_000);
    const sk = getSocket();
    const onPresence = ({ userId, online }) => {
      // Live event only flips online; room transitions still come from
      // the periodic poll. Good enough for an at-a-glance rail.
      setFriends((cur) => cur.map((f) => f.id === userId
        ? { ...f, isOnline: online, status: online ? (f.status === 'offline' ? 'online' : f.status) : 'offline' }
        : f));
    };
    if (sk) sk.on('friend:presence', onPresence);
    return () => {
      alive = false;
      clearInterval(t);
      if (sk) sk.off('friend:presence', onPresence);
    };
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

  const join = (f) => {
    if (!f.currentRoom) return;
    if (f.status === 'in_match') navigate(`/watch/${f.currentRoom.id}`);
    else                         navigate(`/room/${f.currentRoom.id}`);
  };

  const onlineCount = friends.filter((f) => f.isOnline).length;

  return (
    <aside className="panel-card p-4 lg:p-5 w-full lg:w-72 shrink-0">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base lg:text-lg tracking-wider text-ink">
          FRIENDS ONLINE <span className="text-accent">— {onlineCount}</span>
        </h3>
      </header>

      {loading ? (
        <div className="text-ink-soft text-sm py-6 text-center">Loading…</div>
      ) : friends.length === 0 ? (
        <div className="text-ink-soft text-sm py-8 text-center leading-relaxed">
          No friends yet.<br/>
          <span className="text-ink-faint text-xs">Add some from the friends panel.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1 -mr-1">
          {friends.map((f) => {
            const s = statusOf(f);
            const canJoin   = f.status === 'in_lobby' || f.status === 'in_match';
            const canInvite = f.status === 'online' && !!activeRoomId;
            return (
              <li
                key={f.id}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-bg-3/40 border border-line hover:border-violet/40 transition"
              >
                <Avatar src={f.avatar} name={f.username} size="sm" online={f.isOnline} />
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[13px] font-bold truncate">{f.username}</div>
                  <div className={`text-[10px] flex items-center gap-1 ${s.color}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </div>
                </div>
                {canJoin ? (
                  <button
                    type="button"
                    onClick={() => join(f)}
                    className="rounded-lg bg-violet text-white text-[10px] font-extrabold tracking-wider px-2.5 py-1 hover:brightness-110 transition shrink-0"
                  >JOIN</button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendInvite(f.id)}
                    disabled={!canInvite}
                    className="rounded-lg border border-violet/50 text-violet-soft text-[10px] font-extrabold tracking-wider px-2.5 py-1 hover:bg-violet/15 transition shrink-0
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >INVITE</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
