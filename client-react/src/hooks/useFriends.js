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
    const t = setInterval(refresh, 10_000);
    const sk = getSocket();
    const onChange = () => refresh();
    if (sk) {
      sk.on('friend:request',  onChange);
      sk.on('friend:accepted', onChange);
    }
    return () => {
      clearInterval(t);
      if (sk) {
        sk.off('friend:request',  onChange);
        sk.off('friend:accepted', onChange);
      }
    };
  }, [refresh]);

  return { friends, requests, loading, refresh };
}
