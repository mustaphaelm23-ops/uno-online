import { useCallback, useEffect, useState } from 'react';
import { dmApi } from '../api/friends';
import { getSocket } from '../api/socket';

// useDMs — owns the inbox + total unread count + currently-open thread.
// Live updates piggyback on dm:incoming and dm:read_by. The thread API
// is exposed via openThread(partnerId) which fetches + marks read.

export default function useDMs() {
  const [threads, setThreads]   = useState([]);
  const [unread, setUnread]     = useState(0);
  const [openWith, setOpenWith] = useState(null);          // partner user object
  const [thread, setThread]     = useState({ messages: [], partner: null, loading: false });

  const refreshInbox = useCallback(async () => {
    try {
      const res = await dmApi.threads();
      if (!res?.success) return;
      const list = res.threads || [];
      setThreads(list);
      setUnread(list.reduce((s, t) => s + (t.unread || 0), 0));
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refreshInbox();
    const sk = getSocket();
    if (!sk) return;
    const onIncoming = (msg) => {
      // If a thread is open with this partner, append + auto-read.
      setOpenWith((cur) => {
        if (cur && cur.id === msg.from) {
          setThread((tCur) => ({ ...tCur, messages: [...tCur.messages, msg] }));
          dmApi.read(msg.from);
        }
        return cur;
      });
      refreshInbox();
    };
    const onReadBy = () => refreshInbox();
    sk.on('dm:incoming', onIncoming);
    sk.on('dm:read_by',  onReadBy);
    return () => {
      sk.off('dm:incoming', onIncoming);
      sk.off('dm:read_by',  onReadBy);
    };
  }, [refreshInbox]);

  const openThread = useCallback(async (partner) => {
    setOpenWith(partner);
    setThread({ messages: [], partner, loading: true });
    try {
      const res = await dmApi.thread(partner.id);
      if (!res?.success) {
        setThread({ messages: [], partner, loading: false });
        return;
      }
      setThread({ messages: res.messages || [], partner: res.partner || partner, loading: false });
      refreshInbox();
    } catch {
      setThread({ messages: [], partner, loading: false });
    }
  }, [refreshInbox]);

  const closeThread = () => { setOpenWith(null); setThread({ messages: [], partner: null, loading: false }); };

  const send = useCallback(async (text) => {
    if (!openWith) return { success: false, reason: 'no_thread' };
    const res = await dmApi.send(openWith.id, text);
    if (res?.success && res.message) {
      setThread((cur) => ({ ...cur, messages: [...cur.messages, res.message] }));
      refreshInbox();
    }
    return res;
  }, [openWith, refreshInbox]);

  return {
    threads, unread, openWith, thread,
    openThread, closeThread, send, refreshInbox,
  };
}
