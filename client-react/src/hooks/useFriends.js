import { useCallback, useEffect, useState } from 'react';
import { friendsApi } from '../api/friends';
import { getSocket } from '../api/socket';

// useFriends — owns the friends + incoming-requests state. Polls every
// 10 s as a safety net; live updates piggyback on the socket events the
// backend already emits (friend:request, friend:accepted). On mount we
// fetch both lists in parallel.

export default function useFriends() {
  const [friends, setFriends]   = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(f.friends || []);
      setRequests(r.requests || []);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    // Backstop poll: kept long because friend:presence + friend:request /
    // friend:accepted cover the live cases. Only triggers if a friend's
    // username/avatar changed (rare).
    const t = setInterval(refresh, 30_000);
    const sk = getSocket();
    const onChange   = () => refresh();
    const onPresence = ({ userId, online }) => {
      // Surgical merge — flip the dot without losing scroll position or
      // re-rendering the whole list. New friends still land via refresh().
      setFriends((cur) => cur.map((f) => f.id === userId ? { ...f, isOnline: online } : f));
    };
    if (sk) {
      sk.on('friend:request',  onChange);
      sk.on('friend:accepted', onChange);
      sk.on('friend:presence', onPresence);
    }
    return () => {
      clearInterval(t);
      if (sk) {
        sk.off('friend:request',  onChange);
        sk.off('friend:accepted', onChange);
        sk.off('friend:presence', onPresence);
      }
    };
  }, [refresh]);

  return { friends, requests, loading, refresh };
}
