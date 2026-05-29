import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket';
import { useAuth } from './AuthContext';

// NotificationsContext — listens for the events the server already
// broadcasts and accumulates them into a transient feed. Cap is small
// (50) because heavy-weight history lives in its own UI (friends tab,
// chat panels, etc.); this is the at-a-glance "what happened while I
// was away" surface for the 🔔 icon.
//
// Unread count = items added since the last markAllRead() call. The
// panel calls markAllRead() on open.

const CAP = 50;
const NotifCtx = createContext(null);

function entry(type, text, payload) {
  return {
    id:   `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type, text,
    at:   Date.now(),
    payload,
  };
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [unread, setUnread]   = useState(0);
  const seenAtRef = useRef(0);                 // millis of last markAllRead()

  const push = useCallback((it) => {
    setItems((cur) => [it, ...cur].slice(0, CAP));
    if (it.at > seenAtRef.current) setUnread((u) => Math.min(99, u + 1));
  }, []);

  const markAllRead = useCallback(() => {
    seenAtRef.current = Date.now();
    setUnread(0);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setUnread(0);
  }, []);

  // Subscribe to socket events that warrant a notification. We listen at
  // the provider level so even pages that aren't mounted (e.g. game
  // screen) still feed the feed. Re-subscribes on user change (login /
  // logout) since getSocket() returns null until auth opens the connection.
  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return; }
    const sk = getSocket();
    if (!sk) return;

    const onFriendReq      = ({ from })             => push(entry('friend_request',  `${from?.username || 'Someone'} sent you a friend request`, { from }));
    const onFriendAccepted = ({ by })               => push(entry('friend_accepted', `${by?.username || 'Someone'} accepted your friend request`, { by }));
    const onFriendInvite   = ({ from, code })       => push(entry('friend_invite',   `${from?.username || 'A friend'} invited you to room ${code || ''}`.trim(), { from, code }));
    const onPayout         = (p)                    => push(entry('payout',          `Match payout: +${p.gained || 0} 🪙`, p));
    const onLevelup        = (d)                    => push(entry('levelup',         `Level ${d.level} reached!`, d));
    const onPenalty        = (d)                    => push(entry('penalty',         `ELO penalty: ${d.elo} (${d.reason || 'abandon'})`, d));
    const onDM             = (m)                    => push(entry('dm',              `💬 ${m.fromName || 'Friend'}: ${m.text}`, m));

    sk.on('friend:request',  onFriendReq);
    sk.on('friend:accepted', onFriendAccepted);
    sk.on('friend:invite',   onFriendInvite);
    sk.on('match:payout',    onPayout);
    sk.on('account:levelup', onLevelup);
    sk.on('ranked:penalty',  onPenalty);
    sk.on('dm:incoming',     onDM);

    return () => {
      sk.off('friend:request',  onFriendReq);
      sk.off('friend:accepted', onFriendAccepted);
      sk.off('friend:invite',   onFriendInvite);
      sk.off('match:payout',    onPayout);
      sk.off('account:levelup', onLevelup);
      sk.off('ranked:penalty',  onPenalty);
      sk.off('dm:incoming',     onDM);
    };
  }, [push, user?.id]);

  return (
    <NotifCtx.Provider value={{ items, unread, markAllRead, clear, push }}>
      {children}
    </NotifCtx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifCtx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
