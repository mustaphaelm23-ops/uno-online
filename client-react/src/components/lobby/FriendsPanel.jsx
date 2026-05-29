import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Avatar from '../ui/Avatar';
import { friendsApi } from '../../api/friends';
import useFriends from '../../hooks/useFriends';
import useDMs from '../../hooks/useDMs';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Unified right-side slide-out social panel with three tabs:
//   • Friends  : list + add (username) + remove + DM-jump per row
//   • DMs      : inbox + thread view (single panel that swaps modes)
//   • Requests : incoming friend requests + accept/decline (badge in tab strip)
//
// Visibility is controlled by `open` and `initialTab` from the parent
// (LobbyPage / TopBar 💬 + 👥 icons). All HTTP/socket work goes through
// useFriends / useDMs so the state stays consistent across tabs.

const TABS = [
  { id: 'friends',  label: 'Friends',  icon: '👥' },
  { id: 'dms',      label: 'Messages', icon: '💬' },
  { id: 'requests', label: 'Requests', icon: '✉️' },
];

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function FriendRow({ friend, onMessage, onRemove, onInvite, activeRoomId }) {
  return (
    <li className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-3/40 border border-line">
      <Avatar src={friend.avatar} name={friend.username} size="sm" online={friend.isOnline} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{friend.username}</div>
        <div className={`text-[11px] ${friend.isOnline ? 'text-emerald' : 'text-ink-faint'}`}>
          {friend.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
      <button type="button" onClick={() => onMessage(friend)}
              title="Message"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-violet hover:text-violet-soft">💬</button>
      {activeRoomId && friend.isOnline && (
        <button type="button" onClick={() => onInvite(friend)}
                title="Invite to room"
                className="btn-violet text-[11px] px-2.5 py-1">INVITE</button>
      )}
      <button type="button" onClick={() => onRemove(friend)}
              title="Remove friend"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose">✕</button>
    </li>
  );
}

function FriendsTab({ friends, loading, onMessage, refresh, activeRoomId }) {
  const toast = useToast();
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const name = adding.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await friendsApi.request(name);
      toast.success(`Friend request sent to ${name}`);
      setAdding('');
    } catch (err) {
      toast.error(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (friend) => {
    if (!confirm(`Remove ${friend.username} from friends?`)) return;
    try {
      await friendsApi.remove(friend.id);
      refresh();
      toast.success('Removed');
    } catch (err) {
      toast.error(err.message || 'Remove failed');
    }
  };

  const invite = async (friend) => {
    if (!activeRoomId) return;
    try {
      await friendsApi.invite(friend.id, activeRoomId);
      toast.success(`Invite sent to ${friend.username}`);
    } catch (err) {
      toast.error(err.message || 'Invite failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input py-2 text-sm"
          maxLength={20}
          placeholder="Add by username"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        />
        <button type="submit" disabled={busy || !adding.trim()}
                className="btn-violet py-2 px-3 text-sm disabled:opacity-50">Add</button>
      </form>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {loading ? (
          <div className="text-ink-soft text-sm py-6 text-center animate-pulse">Loading…</div>
        ) : friends.length === 0 ? (
          <div className="text-ink-faint text-sm py-8 text-center leading-relaxed">
            No friends yet.<br/>Add someone by username above.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <FriendRow
                key={f.id} friend={f}
                onMessage={onMessage} onRemove={remove} onInvite={invite}
                activeRoomId={activeRoomId}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestsTab({ requests, refresh }) {
  const toast = useToast();
  const accept = async (r) => {
    try {
      await friendsApi.accept(r.id);
      refresh();
      toast.success(`Now friends with ${r.username}`);
    } catch (err) {
      toast.error(err.message || 'Accept failed');
    }
  };
  const decline = async (r) => {
    try {
      await friendsApi.decline(r.id);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Decline failed');
    }
  };
  if (requests.length === 0) {
    return <div className="text-ink-faint text-sm py-8 text-center">No pending requests.</div>;
  }
  return (
    <ul className="flex flex-col gap-2 overflow-y-auto">
      {requests.map((r) => (
        <li key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-3/40 border border-line">
          <Avatar src={r.avatar} name={r.username} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{r.username}</div>
            <div className="text-[11px] text-ink-faint">wants to be friends</div>
          </div>
          <button type="button" onClick={() => accept(r)}
                  className="btn-violet text-[11px] px-3 py-1.5">Accept</button>
          <button type="button" onClick={() => decline(r)}
                  className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose">✕</button>
        </li>
      ))}
    </ul>
  );
}

function ThreadList({ threads, onOpen }) {
  if (threads.length === 0) {
    return <div className="text-ink-faint text-sm py-8 text-center leading-relaxed">
      No conversations yet.<br/>Tap 💬 on a friend to start a chat.
    </div>;
  }
  return (
    <ul className="flex flex-col gap-2 overflow-y-auto">
      {threads.map((t) => (
        <li key={t.partnerId}>
          <button
            type="button"
            onClick={() => onOpen({ id: t.partnerId, username: t.partnerName, avatar: t.partnerAvatar })}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-bg-3/40 border border-line
                       hover:border-violet/50 transition text-left"
          >
            <Avatar src={t.partnerAvatar} name={t.partnerName} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate flex items-center justify-between gap-2">
                <span>{t.partnerName}</span>
                <span className="text-[10px] text-ink-faint">{fmtTime(t.lastAt)}</span>
              </div>
              <div className="text-xs text-ink-soft truncate">
                {t.lastFromMe ? 'You: ' : ''}{t.lastText}
              </div>
            </div>
            {t.unread > 0 && (
              <span className="chip bg-rose text-white">{t.unread}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ThreadView({ thread, myId, onSend, onBack }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [thread.messages.length]);

  const submit = async (e) => {
    e.preventDefault();
    const clean = text.trim().slice(0, 240);
    if (!clean || busy) return;
    setBusy(true); setText('');
    const res = await onSend(clean);
    setBusy(false);
    if (res?.success === false) {
      // Surface known reasons; otherwise the toast in the parent handles it.
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={onBack}
                className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-violet">←</button>
        <Avatar src={thread.partner?.avatar} name={thread.partner?.username} size="sm" />
        <div className="font-bold text-sm">{thread.partner?.username}</div>
      </div>
      <div ref={bodyRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {thread.loading ? (
          <div className="text-ink-soft text-sm py-6 text-center animate-pulse">Loading…</div>
        ) : thread.messages.length === 0 ? (
          <div className="text-ink-faint text-xs italic text-center py-8">Say hi 👋</div>
        ) : thread.messages.map((m) => {
          const mine = m.from === myId;
          return (
            <div key={`${m.from}_${m.at}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm
                ${mine ? 'bg-violet text-white rounded-br-sm'
                       : 'bg-bg-3/70 text-ink rounded-bl-sm border border-line'}`}>
                <div className="leading-snug break-words">{m.text}</div>
                <div className="text-[9px] opacity-60 mt-1 text-right">{fmtTime(m.at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input py-2 text-sm" maxLength={240} placeholder="Message…"
               value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <button type="submit" disabled={busy || !text.trim()}
                className="btn-violet py-2 px-3 text-sm disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}

export default function FriendsPanel({ open, onClose, initialTab = 'friends', activeRoomId }) {
  const { user } = useAuth();
  const { friends, requests, loading, refresh } = useFriends();
  const dms = useDMs();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const goMessage = (friend) => {
    setTab('dms');
    dms.openThread(friend);
  };

  const send = async (text) => {
    const res = await dms.send(text);
    if (res?.success === false) {
      toast.error(res.reason === 'rate_limit' ? 'Slow down' : res.reason || 'DM failed');
    }
    return res;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: 360, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed top-0 right-0 bottom-0 z-50 w-[340px] panel-card rounded-none border-0 border-l border-line flex flex-col"
        >
          <header className="flex items-center justify-between p-3 border-b border-line">
            <h3 className="font-display text-lg tracking-wider">Social</h3>
            <button type="button" onClick={onClose} aria-label="Close"
                    className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose">✕</button>
          </header>

          <div className="flex gap-1 p-2 border-b border-line">
            {TABS.map((t) => {
              const badge = t.id === 'requests' ? requests.length : (t.id === 'dms' ? dms.unread : 0);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); if (t.id !== 'dms') dms.closeThread(); }}
                  className={`relative flex-1 py-1.5 rounded-lg text-xs font-bold transition
                    ${tab === t.id ? 'bg-violet text-white shadow-glow' : 'text-ink-soft hover:text-ink'}`}
                >
                  {t.icon} {t.label}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose text-white rounded-full
                                     min-w-[18px] h-[18px] px-1 text-[10px] font-bold grid place-items-center">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 p-3 flex flex-col">
            {tab === 'friends' && (
              <FriendsTab
                friends={friends} loading={loading}
                onMessage={goMessage} refresh={refresh}
                activeRoomId={activeRoomId}
              />
            )}
            {tab === 'requests' && (
              <RequestsTab requests={requests} refresh={refresh} />
            )}
            {tab === 'dms' && (
              dms.openWith ? (
                <ThreadView
                  thread={dms.thread}
                  myId={user?.id}
                  onSend={send}
                  onBack={dms.closeThread}
                />
              ) : (
                <ThreadList threads={dms.threads} onOpen={dms.openThread} />
              )
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
